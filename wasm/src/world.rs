use std::{path::PathBuf, str::FromStr, sync::Mutex};

use chrono::{DateTime, Datelike, FixedOffset, Local, Utc};
use rustc_hash::{FxHashMap, FxHashSet};
use send_wrapper::SendWrapper;
use wasm_bindgen::{JsCast, JsValue};

use typst::{
    Library, World,
    diag::{FileError, FileResult, PackageError},
    foundations::{Bytes, Content, Datetime, Style, Value},
    layout::{Abs, Length},
    syntax::{FileId, Source, VirtualPath, package::PackageSpec},
    text::{Font, FontBook, TextElem},
    utils::LazyHash,
    visualize::{Color, Paint},
};

use crate::vfs::FileSlot;

pub struct WasmWorld {
    main: FileId,
    library: LazyHash<Library>,
    book: LazyHash<FontBook>,
    fonts: Vec<Font>,
    slots: Mutex<FxHashMap<FileId, FileSlot>>,
    now: DateTime<Utc>,

    read: SendWrapper<js_sys::Function>,
    packages: FxHashSet<PackageSpec>,
}

impl WasmWorld {
    pub fn new(read: js_sys::Function, fontsize: f64) -> Self {
        let main = FileId::new(None, VirtualPath::new("main.typ"));
        let mut slots = FxHashMap::default();
        slots.insert(main, FileSlot::new_from_text(main, "".into()));

        let mut book = LazyHash::new(FontBook::new());
        let mut fonts = Vec::new();
        for data in typst_assets::fonts() {
            for font in Font::iter(Bytes::new(data)) {
                book.push(font.info().clone());
                fonts.push(font);
            }
        }

        let mut library = Library::default();
        let fontsize_val = Value::Length(Length::from(Abs::pt(fontsize * 0.75)));

        let cursor_text = TextElem::new("|".into());
        let cursor_paint = Paint::Solid(Color::from_str("#00f").unwrap());
        let cursor_style = Style::Property(TextElem::set_fill(cursor_paint));
        let cursor_val = Value::Content(Content::new(cursor_text).styled(cursor_style));

        library.global.scope_mut().define("fontsize", fontsize_val);
        library.global.scope_mut().define("CURSOR", cursor_val);

        Self {
            main,
            library: LazyHash::new(library),
            book,
            fonts,
            slots: Mutex::new(slots),
            now: Utc::now(),

            read: SendWrapper::new(read),
            packages: FxHashSet::default(),
        }
    }

    pub fn set_fontsize(&mut self, fontsize: f64) {
        let fontsize_val = Value::Length(Length::from(Abs::pt(fontsize)));
        self.library
            .global
            .scope_mut()
            .define("fontsize", fontsize_val);
    }

    pub fn set_main(&mut self, new: Source) {
        self.slots
            .lock()
            .unwrap()
            .get_mut(&self.main)
            .unwrap()
            .set_source_result(Ok(new));
    }

    pub fn replace(&mut self, new: &str) {
        self.slots
            .lock()
            .unwrap()
            .get_mut(&self.main)
            .unwrap()
            .replace(new);
    }

    pub fn add_file_text(&self, vpath: &str, text: String) {
        let mut m = self.slots.lock().unwrap();
        let file_id = FileId::new(None, VirtualPath::new(vpath));

        m.insert(file_id, FileSlot::new_from_text(file_id, text));
    }

    pub fn add_file_bytes(&self, vpath: &str, bytes: Vec<u8>) {
        let mut m = self.slots.lock().unwrap();
        let file_id = FileId::new(None, VirtualPath::new(vpath));

        m.insert(file_id, FileSlot::new_from_bytes(file_id, bytes));
    }

    pub fn add_package(&mut self, spec: PackageSpec, vpath: &str, bytes: Vec<u8>) {
        let mut m = self.slots.lock().unwrap();

        let file_id = FileId::new(Some(spec.clone()), VirtualPath::new(vpath));
        m.insert(file_id, FileSlot::new_from_bytes(file_id, bytes));

        self.packages.insert(spec);
    }

    pub fn list_packages(&self) -> Vec<PackageSpec> {
        self.packages.iter().cloned().collect()
    }

    pub fn add_font(&mut self, data: Bytes) {
        for f in Font::iter(data) {
            self.book.push(f.info().clone());
            self.fonts.push(f);
        }
    }

    fn fetch(&self, rpath: String) -> Result<JsValue, JsValue> {
        return self.read.call1(&JsValue::NULL, &rpath.into());
    }

    fn fetch_file(&self, rpath: String, spec: Option<&PackageSpec>) -> FileResult<Bytes> {
        let f = |e: JsValue| {
            if let Some(value) = e.as_f64() {
                return match value as i64 {
                    0 => FileError::Other(Some("implementation constraints".into())),

                    10 => FileError::AccessDenied,
                    11 => FileError::IsDirectory,
                    12 => FileError::NotFound(PathBuf::from(rpath.clone())),

                    20 => FileError::Package(PackageError::MalformedArchive(Some(
                        "invalid package format".into(),
                    ))),
                    21 => FileError::Package(PackageError::NetworkFailed(Some(
                        "network connection error".into(),
                    ))),
                    22 => FileError::Package(PackageError::NotFound(spec.unwrap().clone())),
                    _ => FileError::Other(Some("unexpected error".into())),
                };
            }
            FileError::Other(e.as_string().map(Into::into))
        };

        self.fetch(rpath.clone()).map_err(f).and_then(|js_value| {
            if let Some(u8arr) = js_value.dyn_ref::<js_sys::Uint8Array>() {
                Ok(Bytes::new(u8arr.to_vec()))
            } else {
                Err(FileError::Other(Some("unexpected error".into())))
            }
        })
    }

    fn read<F, T>(&self, id: FileId, f: F) -> FileResult<T>
    where
        F: FnOnce(&mut FileSlot) -> FileResult<T>,
    {
        let mut m = self.slots.lock().unwrap();

        if m.get(&id).map_or(true, |slot| slot.bytes().is_err()) {
            let result = match id.package() {
                Some(spec) => self.fetch_file(
                    format!(
                        "@{}/{}/{}/{}",
                        spec.namespace,
                        spec.name,
                        spec.version,
                        id.vpath().as_rootless_path().to_str().unwrap()
                    ),
                    Some(&spec),
                ),
                None => self.fetch_file(
                    id.vpath().as_rootless_path().to_str().unwrap().to_string(),
                    None,
                ),
            };

            m.insert(id, FileSlot::new_from_result(id, result));
        }

        f(m.get_mut(&id).unwrap())
    }
}

#[comemo::track]
impl World for WasmWorld {
    // Symbol など
    fn library(&self) -> &LazyHash<Library> {
        &self.library
    }

    // フォントの情報
    fn book(&self) -> &LazyHash<FontBook> {
        &self.book
    }

    // コンパイル対象の FileId を返す
    fn main(&self) -> FileId {
        self.main
    }

    // ? .typ ファイル
    fn source(&self, id: FileId) -> FileResult<Source> {
        self.read(id, |f| f.source())
    }

    // ? アセットファイル (画像や wasm など)
    fn file(&self, id: FileId) -> FileResult<Bytes> {
        self.read(id, |f| f.bytes())
    }

    // ? 登録されていないフォントにアクセスを試みると，Warning(severity: 2) が発生するる
    fn font(&self, index: usize) -> Option<Font> {
        Some(self.fonts[index].clone())
    }

    fn today(&self, offset: Option<i64>) -> Option<Datetime> {
        let with_offset = match offset {
            None => self.now.with_timezone(&Local).fixed_offset(),
            Some(hours) => {
                let seconds = i32::try_from(hours).ok()?.checked_mul(3600)?;
                self.now.with_timezone(&FixedOffset::east_opt(seconds)?)
            }
        };

        // ? 起動時の値に固定するので，hms は不要。
        Datetime::from_ymd(
            with_offset.year(),
            with_offset.month().try_into().ok()?,
            with_offset.day().try_into().ok()?,
        )
    }
}
