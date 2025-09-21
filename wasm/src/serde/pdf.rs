use ecow::EcoVec;
use serde::Serialize;
use serde_wasm_bindgen::to_value;
use wasm_bindgen::JsValue;

use typst::{diag::SourceDiagnostic, ecow};

use crate::serde::diagnostic::SourceDiagnosticSer;

#[derive(Serialize)]
struct PdfResultSer {
    pdf: Vec<u8>,
    diags: Vec<SourceDiagnosticSer>,
}

pub fn pdf(pdf: Vec<u8>, diags: EcoVec<SourceDiagnostic>) -> Result<JsValue, JsValue> {
    let result = PdfResultSer {
        pdf,
        diags: diags.iter().map(|d| d.into()).collect(),
    };
    Ok(to_value(&result)?)
}
