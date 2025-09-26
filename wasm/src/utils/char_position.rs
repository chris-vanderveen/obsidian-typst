#[derive(Debug, Clone)]
pub struct CharPosition {
    pub line: usize,
    pub ch: usize,
    pub offset: usize, // utf16 参照: https://codemirror.net/docs/guide/
}

pub fn precompute_char_positions(src: &str) -> Vec<CharPosition> {
    let mut positions = Vec::new();
    let mut line = 0;
    let mut ch = 0;
    let mut offset = 0;

    for c in src.chars() {
        let utf16_len = c.len_utf16();
        let utf8_len = c.len_utf8();

        for _ in 0..utf8_len {
            positions.push(CharPosition { line, ch, offset });
        }

        if c == '\n' {
            line += 1;
            ch = 0;
        } else {
            ch += utf16_len;
        }

        offset += utf16_len;
    }

    positions
}
