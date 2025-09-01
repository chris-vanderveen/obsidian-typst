use std::ops::Range;

use serde::Serialize;

use typst::diag::{Severity, SourceDiagnostic};

#[derive(Serialize)]
pub struct TraceSer {
    span: Range<usize>,
    point: String,
}

#[derive(Serialize)]
pub struct SourceDiagnosticSer {
    pub severity: u8,
    pub span: Range<usize>,
    pub message: String,
    pub trace: Vec<TraceSer>,
    pub hints: Vec<String>,
}

impl From<&SourceDiagnostic> for SourceDiagnosticSer {
    fn from(diag: &SourceDiagnostic) -> Self {
        SourceDiagnosticSer {
            severity: match diag.severity {
                Severity::Error => 1,
                Severity::Warning => 2,
            },
            span: diag.span.range().unwrap_or(Range { start: 0, end: 0 }),
            message: diag.message.as_str().to_string(),
            trace: diag
                .trace
                .iter()
                .map(|t| TraceSer {
                    span: t.span.range().unwrap_or(Range { start: 0, end: 0 }),
                    point: t.v.to_string(),
                })
                .collect(),
            hints: diag.hints.iter().map(|h| h.as_str().to_string()).collect(),
        }
    }
}
