import type fsModule from "node:fs";
import type osModule from "node:os";
import type pathModule from "node:path";

import { proxy, type Remote, wrap } from "comlink";
import {
  debounce,
  type EventRef,
  loadMathJax,
  MenuItem,
  Notice,
  Platform,
  Plugin,
  renderMath,
  requestUrl,
  type WorkspaceLeaf,
} from "obsidian";
import { tex2typst, typst2tex } from "tex2typst";
import { EditorHelper } from "./core/editor/editor";
import {
  DEFAULT_SETTINGS,
  type Settings,
  SettingTab,
} from "./core/settings/settings";
import ExcalidrawPlugin from "./extensions/excalidraw";
import TypstManager from "./libs/typst";
import type $ from "./libs/worker";
import Typst from "./libs/worker";
import TypstWorker from "./libs/worker?worker&inline";
import { ExcalidrawModal } from "./ui/modals/excalidraw";
import { TypstPDFView } from "./ui/views/typst-pdf/typstPDF";
import { TypstTextView } from "./ui/views/typst-text/typstText";
import { TypstToolsView } from "./ui/views/typst-tools/typstTools";
import {
  type MathSegment,
  replaceMathSegments,
} from "./utils/findMathSegments";
import { Observer } from "./utils/observer";
import { zip } from "./utils/packageCompressor";

import "./main.css";

export default class ObsidianTypstMate extends Plugin {
  pluginId = "typst-mate";
  settings!: Settings;

  wasmPath!: string;
  baseDirPath!: string;
  fontsDirNPath!: string; // ? NPath ... Obsidian 用に Normalized された Path
  cachesDirNPath!: string;
  pluginDirNPath!: string;
  packagesDirNPath!: string;
  typstDirNPath!: string;
  localPackagesDirPaths!: string[]; // ? ローカルも含む, 0 番目は packagesDirNPath なので NPath

  originalTex2chtml: any;
  typst!: $ | Remote<$>;
  worker?: Worker;
  typstManager!: TypstManager;
  observer!: Observer;

  baseColor = "#000000";
  listeners: EventRef[] = [];

  excalidraw?: ExcalidrawPlugin;
  excalidrawPluginInstalled = false;

  editorHelper!: EditorHelper;

  fs?: typeof fsModule;
  os?: typeof osModule;
  path?: typeof pathModule;

  override async onload() {
    await this.loadSettings(); // ユーザーの設定 (data.json) を読み込む

    const { app } = this;
    const vault = app.vault;
    const adapter = vault.adapter;

    if (Platform.isDesktopApp) {
      this.fs = require("node:fs");
      this.os = require("node:os");
      this.path = require("node:path");
    }

    // 基本的なパスの設定
    this.setPaths();
    // SVG のベースにする色を設定
    const styles = getComputedStyle(document.body);
    this.baseColor = styles.getPropertyValue("--color-base-100").trim();
    // マニフェストの読み込みと Wasm のパスを設定
    const manifestPath = `${this.pluginDirNPath}/manifest.json`;
    const version = JSON.parse(await adapter.read(manifestPath)).version;
    this.wasmPath = `${this.pluginDirNPath}/typst-${version}.wasm`;

    // 必要なディレクトリの作成
    await this.tryCreateDirs();
    // 他のプラグインとの連携
    this.connectOtherPlugins();

    // Wasm の準備
    if (!(await adapter.exists(this.wasmPath)))
      await this.downloadWasm(version);
    // MathJax を読み込む
    await this.prepareMathJax();
    // TypstManager を設定する
    await this.prepareTypst();

    // ? Obsidian の起動時間を短縮するため setTimeout を使用
    this.app.workspace.onLayoutReady(() => {
      const leafs = [
        ...this.app.workspace.getLeavesOfType(TypstToolsView.viewtype),
        ...this.app.workspace.getLeavesOfType(TypstTextView.viewtype),
        ...this.app.workspace.getLeavesOfType(TypstPDFView.viewtype),
      ];
      for (const leaf of leafs) leaf.detach();

      // 設定タブを登録
      this.addSettingTab(new SettingTab(this.app, this));

      // EditorHelper を初期化
      this.editorHelper = new EditorHelper(this);

      // Typst Tools を登録
      this.registerView(
        TypstToolsView.viewtype,
        (leaf) => new TypstToolsView(leaf, this),
      );
      this.registerView(
        TypstTextView.viewtype,
        (leaf) => new TypstTextView(leaf),
      );
      this.registerView(
        TypstPDFView.viewtype,
        (leaf) => new TypstPDFView(leaf, this),
      );
      this.registerExtensions(["typ"], TypstPDFView.viewtype);
      if (this.settings.openTypstToolsOnStartup) this.activateLeaf();

      // コマンドを登録する
      this.addCommands();

      // 監視を登録する
      this.registerListeners();
    });
  }

  private setPaths() {
    this.baseDirPath = this.app.vault.adapter.basePath;
    this.pluginDirNPath = `${this.app.vault.configDir}/plugins/${this.pluginId}`; // .obsidian/plugins/typst-mate
    this.fontsDirNPath = `${this.pluginDirNPath}/fonts`;
    this.cachesDirNPath = `${this.pluginDirNPath}/caches`;
    this.packagesDirNPath = `${this.pluginDirNPath}/packages`;
    this.typstDirNPath = "/typst";

    this.localPackagesDirPaths = [this.packagesDirNPath];
    if (!Platform.isDesktopApp) return; // ? iOS/iPadOS でも Platform.isMacOS が true になる
    switch (true) {
      case Platform.isWin: {
        const localAppData =
          process.env.LOCALAPPDATA ??
          this.path!.join(this.os!.homedir(), "AppData", "Local");
        const winPackagesPath = this.path!.join(
          localAppData,
          "typst",
          "packages",
        );
        this.localPackagesDirPaths.push(winPackagesPath);
        break;
      }
      case Platform.isMacOS: {
        const macLibraryCachePath = this.path!.join(
          this.os!.homedir(),
          "Library",
          "Caches",
        );
        const macPackagesPath = this.path!.join(
          macLibraryCachePath,
          "typst",
          "packages",
        );
        this.localPackagesDirPaths.push(macPackagesPath);
        break;
      }
      case Platform.isLinux: {
        const xdgCachePath =
          process.env.XDG_CACHE_HOME ??
          this.path!.join(this.os!.homedir(), ".local", "share");
        const linuxPackagesPath = this.path!.join(
          xdgCachePath,
          "typst",
          "packages",
        );
        this.localPackagesDirPaths.push(linuxPackagesPath);
        break;
      }
    }
  }

  private async tryCreateDirs() {
    const dirPaths = [
      this.fontsDirNPath,
      this.cachesDirNPath,
      this.packagesDirNPath,
      this.typstDirNPath,
    ];

    await Promise.allSettled(
      dirPaths.map((dirPath) => this.app.vault.adapter.mkdir(dirPath)),
    ).catch(() => {});
  }

  private async prepareMathJax() {
    await loadMathJax();
    if (window.MathJax === undefined)
      throw new Error("Failed to load MathJax.");
    renderMath("", false); // ? 副作用 (スタイル) のため
    this.originalTex2chtml = window.MathJax.tex2chtml; // ? Plugin を unload したときに戻すため。Fallback 処理のため。
  }

  private async prepareTypst() {
    this.observer = new Observer();
    this.typstManager = new TypstManager(this);
    this.typstManager.registerOnce();
    await this.init(this.wasmPath).catch((err) => {
      console.error(err);
      new Notice(
        "Failed to initialize Typst. Please check that the processor ID does not contain any symbols, try clearing the package cache, and ensure that there are no invalid fonts installed.",
      );
    });
  }

  private async downloadWasm(version: string) {
    new Notice("Downloading latest wasm...");

    // 古い Wasm を削除する
    const oldWasms = (
      await this.app.vault.adapter.list(this.pluginDirNPath)
    ).files.filter((file) => file.endsWith(".wasm"));
    oldWasms.forEach(
      this.app.vault.adapter.remove.bind(this.app.vault.adapter),
    );

    // 最新の Wasm がある URL を取得する
    const releaseUrl = `https://api.github.com/repos/azyarashi/obsidian-typst-mate/releases/tags/${version}`;
    const releaseResponse = await requestUrl(releaseUrl);
    const releaseData = (await releaseResponse.json) as {
      assets: GitHubAsset[];
    };
    const asset = releaseData.assets.find(
      (asset) => asset.name === `typst-${version}.wasm`,
    );
    if (!asset)
      throw new Error(`Could not find ${this.wasmPath} in release assets`);

    // Wasm をダウンロードする
    const response = await requestUrl({
      url: asset.url,
      headers: { Accept: "application/octet-stream" },
    });
    const data = response.arrayBuffer;
    await this.app.vault.adapter.writeBinary(this.wasmPath, data);

    new Notice("Wasm downloaded!");
  }

  async activateLeaf() {
    let leaf: WorkspaceLeaf | null | undefined;
    [leaf] = this.app.workspace.getLeavesOfType(TypstToolsView.viewtype);

    if (!leaf) {
      leaf = this.app.workspace.getLeftLeaf(false);
      await leaf?.setViewState({ type: TypstToolsView.viewtype });
    }

    return leaf;
  }

  private connectOtherPlugins() {
    // Excalidraw
    if ("obsidian-excalidraw-plugin" in this.app.plugins.plugins) {
      const excalidrawPlugin =
        this.app.plugins.plugins["obsidian-excalidraw-plugin"];
      this.excalidraw = new ExcalidrawPlugin(this, excalidrawPlugin);
      this.excalidrawPluginInstalled = true;
    }
  }

  private addCommands() {
    this.addCommand({
      id: "typst-tools-open",
      name: "Open Typst Tools",
      callback: async () => {
        const leaf = await this.activateLeaf();
        if (leaf) this.app.workspace.revealLeaf(leaf);
      },
    });

    this.addCommand({
      id: "typst-toggle-background-rendering",
      name: "Toggle Background Rendering",
      callback: async () => {
        this.settings.enableBackgroundRendering =
          !this.settings.enableBackgroundRendering;
        await this.saveSettings();
        await this.reload(false);
      },
    });

    this.addCommand({
      id: "typst-tex2typ",
      name: "Replace tex in markdown content or selection to typst",
      editorCallback: async (editor) => {
        const selection = editor.getSelection();
        const tex2typ = async (seg: MathSegment) => {
          try {
            // ? typst から tex に変換できればその数式は typst ではない
            typst2tex(seg.content);
            return seg.raw;
          } catch {
            try {
              return seg.raw.replace(seg.content, tex2typst(seg.content));
            } catch {
              return seg.raw.replace(
                seg.content,
                await this.typst.mitex(seg.content),
              );
            }
          }
        };
        if (selection) {
          const replaced = await replaceMathSegments(selection, tex2typ);
          editor.replaceSelection(replaced);
        } else {
          const content = editor.getDoc().getValue();
          const replaced = await replaceMathSegments(content, tex2typ);
          editor.replaceRange(
            replaced,
            { line: 0, ch: 0 },
            {
              line: editor.lineCount(),
              ch: editor.getLine(editor.lineCount() - 1).length,
            },
          );
        }
      },
    });

    this.addCommand({
      id: "typst-box-current-equation",
      name: "Box current equation",
      editorCallback: this.editorHelper.boxCurrentEquation.bind(
        this.editorHelper,
      ),
    });

    this.addCommand({
      id: "typst-select-current-equation",
      name: "Select current equation",
      editorCallback: this.editorHelper.selectCurrentEquation.bind(
        this.editorHelper,
      ),
    });

    if (this.excalidrawPluginInstalled) {
      this.addCommand({
        id: "typst-render-to-excalidraw",
        name: "Render to Excalidraw",
        callback: () => {
          new ExcalidrawModal(this.app, this).open();
        },
      });
    }
  }

  private registerListeners() {
    this.listeners.push(
      this.app.workspace.on("css-change", this.applyBaseColor.bind(this)),
      this.app.workspace.on(
        "active-leaf-change",
        this.editorHelper.onActiveLeafChange.bind(this.editorHelper),
      ),
      this.app.workspace.on("leaf-menu", (menu, leaf) => {
        if (leaf.view.getViewType() === "markdown") {
          const pdfItems = menu.items
            .filter((item) => item instanceof MenuItem)
            .filter((item) =>
              item.titleEl?.innerText.toLowerCase().includes("pdf"),
            );

          pdfItems.forEach((pdfItem) => {
            const defaultAction = pdfItem.callback ?? (() => {});
            const beforeBaseColor = this.baseColor;
            const beforeEnableBackgroundRendering =
              this.settings.enableBackgroundRendering;

            let disconnected = false;
            const observer = new MutationObserver(async (mutations) => {
              for (const m of mutations) {
                if (!m.removedNodes.length) return;
                if (
                  document.querySelector("div.modal") ||
                  document.querySelector("div.progress-bar-container")
                )
                  return;
                observer.disconnect();
                clearTimeout(id);
                disconnected = true;

                // postprocess
                this.baseColor = beforeBaseColor;
                if (beforeEnableBackgroundRendering) {
                  this.settings.enableBackgroundRendering = true;
                  await this.init(this.wasmPath);
                }
              }
            });

            let id: NodeJS.Timeout;
            pdfItem.callback = async () => {
              // preprocess
              if (this.settings.patchPDFExport)
                this.baseColor = this.settings.baseColor;
              if (this.settings.enableBackgroundRendering) {
                this.settings.enableBackgroundRendering = false;
                await this.init(this.wasmPath);
              }

              defaultAction();
              observer.observe(document.body, {
                childList: true,
                subtree: true,
              });
              id = setTimeout(async () => {
                if (disconnected) return;
                observer.disconnect();

                // postprocess
                this.baseColor = beforeBaseColor;
                if (beforeEnableBackgroundRendering) {
                  this.settings.enableBackgroundRendering = true;
                  await this.init(this.wasmPath);
                }
              }, 60000);
            };
          });
        }

        if (leaf.view.getViewType() !== TypstTextView.viewtype) return;
        menu.addItem(async (item) => {
          item.setTitle("Open as PDF").onClick(async () => {
            await leaf.setViewState({
              type: TypstPDFView.viewtype,
              state: { file: (leaf.view as TypstTextView).file },
            });
          });
        });
      }),
    );
  }

  async init(wasmPath: string) {
    this.worker?.terminate();

    const { fs, path, baseDirPath, packagesDirNPath, cachesDirNPath } = this;
    const adapter = this.app.vault.adapter;

    const main = {
      notice(message: string, duration?: number) {
        new Notice(message, duration);
      },

      readBinary(p: string) {
        // MobileApp
        if (!fs) return adapter.readBinary(p);

        // DesktopApp
        if (path!.isAbsolute(p)) return fs.readFileSync(p);
        return fs.readFileSync(`${baseDirPath}/${p}`);
      },

      async writePackage(path: string, files: tarFile[]) {
        const map = new Map<string, Uint8Array>();

        // ディレクトリ
        for (const file of files.filter((f) => f.type === "5")) {
          await adapter.mkdir(`${packagesDirNPath}/${path}/${file.name}`);
        }

        // ファイル
        for (const file of files.filter((f) => f.type === "0")) {
          await adapter.writeBinary(
            `${packagesDirNPath}/${path}/${file.name}`,
            file.buffer,
          );
          map.set(`${path}/${file.name}`, new Uint8Array(file.buffer));
        }

        // シンボリックリンク
        for (const file of files.filter((f) => f.type === "2")) {
          await adapter.copy(
            `${packagesDirNPath}/${path}/${file.name}`,
            `${packagesDirNPath}/${path}/${file.linkname}`,
          );
          map.set(`${path}/${file.linkname}`, map.get(`${path}/${file.name}`)!);
        }

        const [namespace, name, version] = path.split("/");
        await adapter
          .writeBinary(
            // ? .DS_STORE などが紛れ込まないようにするため
            `${cachesDirNPath}/${namespace}_${name}_${version}.cache`,
            zip(map).slice().buffer,
          )
          .catch(() => {});
      },
    };
    const wasm = await adapter.readBinary(wasmPath);

    if (this.settings.enableBackgroundRendering) {
      this.worker = new TypstWorker();
      const api = wrap<typeof $>(this.worker);
      this.typst = await new api(
        wasm,
        this.localPackagesDirPaths,
        this.baseDirPath,
        Platform.isDesktopApp,
      );
      await this.typst.setMain(proxy(main));
    } else {
      this.typst = new Typst(
        wasm,
        this.localPackagesDirPaths,
        this.baseDirPath,
        Platform.isDesktopApp,
      );
      this.typst.setMain(main);
    }

    await this.typstManager.init();
  }

  applyBaseColor() {
    if (!this.settings.autoBaseColor) return;

    const bodyStyles = getComputedStyle(document.body);
    const beforeColor = this.baseColor;
    this.baseColor = bodyStyles.getPropertyValue("--color-base-100").trim();

    const svgEls = document.querySelectorAll("svg.typst-doc"); // Typst が typst-doc を自動で付与する
    for (const svgEl of svgEls)
      svgEl.innerHTML = svgEl.innerHTML.replaceAll(beforeColor, this.baseColor);
  }

  override async onunload() {
    const temporaryEls = document.querySelectorAll(".typstmate-temporary");
    for (const temporaryEl of temporaryEls) temporaryEl.remove();

    // 監視を終了
    this.observer.stopAll();
    this.listeners.forEach(this.app.workspace.offref.bind(this.app.workspace));
    this.editorHelper.close();

    // Worker を終了
    this.worker?.terminate();

    // MathJax のオーバーライドを解除
    if (window.MathJax !== undefined)
      window.MathJax.tex2chtml = this.originalTex2chtml;

    // MarkdownCodeBlockProcessor のオーバーライドは自動で解除

    // TODO: anti-pattern らしい
    // 登録した Leaf を閉じる
    const leafs = [
      ...this.app.workspace.getLeavesOfType(TypstToolsView.viewtype),
      ...this.app.workspace.getLeavesOfType(TypstTextView.viewtype),
      ...this.app.workspace.getLeavesOfType(TypstPDFView.viewtype),
    ];
    for (const leaf of leafs) leaf.detach();
  }

  async reload(openSettingsTab: boolean) {
    await this.app.plugins.disablePlugin(this.pluginId); // ? onunload も呼ばれる
    await this.app.plugins.enablePlugin(this.pluginId); // ? onload も呼ばれる
    if (openSettingsTab) this.app.setting.openTabById(this.pluginId);
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  override onConfigFileChange = debounce(
    this.loadSettings.bind(this),
    500,
    true,
  );
}
