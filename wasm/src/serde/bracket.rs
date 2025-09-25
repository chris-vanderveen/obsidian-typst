use serde::Serialize;

use crate::parser::bracket::BracketPair;

#[derive(Serialize)]
pub struct BracketPairSer {
    pub kind: String,

    pub depth: usize,

    pub open_byte: usize,
    pub open_line: usize,
    pub open_column: usize,

    pub close_byte: usize,
    pub close_line: usize,
    pub close_column: usize,
}

impl From<&BracketPair> for BracketPairSer {
    fn from(pair: &BracketPair) -> Self {
        BracketPairSer {
            kind: match pair.kind {
                typst::syntax::SyntaxKind::LeftParen => "paren".into(),
                typst::syntax::SyntaxKind::LeftBracket => "bracket".into(),
                typst::syntax::SyntaxKind::LeftBrace => "brace".into(),
                _ => "unknown".into(),
            },

            depth: pair.depth,

            open_byte: pair.open.byte,
            open_line: pair.open.line,
            open_column: pair.open.column,

            close_byte: pair.close.byte,
            close_line: pair.close.line,
            close_column: pair.close.column,
        }
    }
}
