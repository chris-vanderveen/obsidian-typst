use ecow::EcoVec;
use serde::Serialize;
use serde_wasm_bindgen::to_value;
use wasm_bindgen::JsValue;

use typst::diag::SourceDiagnostic;

use crate::serde::diagnostic::SourceDiagnosticSer;

#[derive(Serialize)]
struct SvgResultSer {
    svg: String,
    diags: Vec<SourceDiagnosticSer>,
}

pub fn svg(svg: String, diags: EcoVec<SourceDiagnostic>) -> Result<JsValue, JsValue> {
    let result = SvgResultSer {
        svg,
        diags: diags.iter().map(|d| d.into()).collect(),
    };
    Ok(to_value(&result)?)
}
