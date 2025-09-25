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

impl SourceDiagnosticSer {
    pub fn from_diag<W>(diag: &SourceDiagnostic, world: &W) -> Self
    where
        W: typst::WorldExt,
    {
        SourceDiagnosticSer {
            severity: match diag.severity {
                Severity::Error => 1,
                Severity::Warning => 2,
            },
            span: world.range(diag.span).unwrap_or(Range { start: 0, end: 0 }),
            message: diag.message.as_str().to_string(),
            trace: diag
                .trace
                .iter()
                .map(|t| TraceSer {
                    span: world.range(t.span).unwrap_or(Range { start: 0, end: 0 }),
                    point: t.v.to_string(),
                })
                .collect(),
            hints: diag.hints.iter().map(|h| h.as_str().to_string()).collect(),
        }
    }
}
