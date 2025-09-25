use typst::syntax::SyntaxKind;

#[derive(Debug, Clone)]
pub struct BracketToken {
    pub kind: SyntaxKind,
    pub open: bool,
    pub byte: usize,
    pub line: usize,
    pub column: usize,
}

pub fn bracket_lexer(src: &str) -> Vec<BracketToken> {
    let mut ret = Vec::new();
    let mut chars = src.char_indices().peekable();
    let mut in_str = false;
    let mut str_escape = false;
    let mut in_line_comment = false;
    let mut in_block_comment = 0usize;

    while let Some((i, c)) = chars.next() {
        // 文字列内
        if in_str {
            if str_escape {
                str_escape = false;
                continue;
            }
            match c {
                '"' => in_str = false,
                '\\' => str_escape = true,
                _ => {}
            }
            continue;
        }
        // 行コメント
        if in_line_comment {
            if c == '\n' {
                in_line_comment = false;
            }
            continue;
        }
        // ブロックコメント
        if in_block_comment > 0 {
            if c == '*' {
                if let Some((_, '/')) = chars.peek() {
                    chars.next();
                    in_block_comment -= 1;
                }
            } else if c == '/' {
                if let Some((_, '*')) = chars.peek() {
                    chars.next();
                    in_block_comment += 1;
                }
            }
            continue;
        }
        // コメント開始
        if c == '/' {
            if let Some((_, next)) = chars.peek() {
                if *next == '/' {
                    chars.next();
                    in_line_comment = true;
                    continue;
                } else if *next == '*' {
                    chars.next();
                    in_block_comment += 1;
                    continue;
                }
            }
        }
        // 文字列開始
        if c == '"' {
            in_str = true;
            continue;
        }
        // 括弧判定
        let kind = match c {
            '(' => Some(SyntaxKind::LeftParen),
            ')' => Some(SyntaxKind::RightParen),
            '[' => Some(SyntaxKind::LeftBracket),
            ']' => Some(SyntaxKind::RightBracket),
            '{' => Some(SyntaxKind::LeftBrace),
            '}' => Some(SyntaxKind::RightBrace),
            _ => None,
        };

        if let Some(kind) = kind {
            let open = matches!(
                kind,
                SyntaxKind::LeftParen | SyntaxKind::LeftBracket | SyntaxKind::LeftBrace
            );
            let (line, column) = calc_line_col(src, i);

            ret.push(BracketToken {
                kind,
                open,
                byte: i,
                line,
                column,
            });
        }
    }
    ret
}

fn calc_line_col(src: &str, byte: usize) -> (usize, usize) {
    let mut line = 0;
    let mut col = 0;
    let mut idx = 0;

    for c in src.chars() {
        if idx >= byte {
            break;
        }

        if c == '\n' {
            line += 1;
            col = 0;
        } else {
            col += 1;
        }

        idx += c.len_utf8();
    }

    (line, col)
}
