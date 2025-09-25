export type MathSegment = {
  type: 'display' | 'inline';
  raw: string;
  content: string;
  start: number;
  end: number;
};

function isEscaped(input: string, pos: number): boolean {
  let count = 0;
  for (let j = pos - 1; j >= 0 && input[j] === '\\'; j--) count++;
  return count % 2 === 1;
}

export function findMathSegments(input: string): MathSegment[] {
  const out: MathSegment[] = [];
  const n = input.length;
  let i = 0;

  while (i < n) {
    const ch = input[i];

    if ((ch === '`' && input.startsWith('```', i)) || (ch === '~' && input.startsWith('~~~', i))) {
      const fence = input.startsWith('```', i) ? '```' : '~~~';
      i += fence.length;
      const idx = input.indexOf(fence, i);
      if (idx === -1) i = n;
      else i = idx + fence.length;
      continue;
    }

    if (ch === '`' && !isEscaped(input, i)) {
      const open = i;
      i++;
      let close = -1;
      for (let j = i; j < n; j++) {
        if (input[j] === '`' && !isEscaped(input, j)) {
          close = j;
          break;
        }
      }
      if (close === -1) i = open + 1;
      else i = close + 1;
      continue;
    }

    if (ch === '$' && !isEscaped(input, i)) {
      const nextIsDollar = i + 1 < n && input[i + 1] === '$' && !isEscaped(input, i + 1);
      if (nextIsDollar) {
        let found = false;
        for (let k = i + 2; k < n - 1; k++) {
          if (input[k] === '$' && input[k + 1] === '$' && !isEscaped(input, k)) {
            const inner = input.slice(i + 2, k);
            const startsWithDollar = inner.length > 0 && inner[0] === '$';
            const endsWithDollar = inner.length > 0 && inner[inner.length - 1] === '$';
            if (!startsWithDollar && !endsWithDollar) {
              const raw = input.slice(i, k + 2);
              out.push({ type: 'display', raw, content: inner, start: i, end: k + 2 });
              i = k + 2;
              found = true;
              break;
            }
          }
        }
        if (found) continue;
        i++;
        continue;
      } else {
        let found = false;
        for (let k = i + 1; k < n; k++) {
          if (input[k] === '$' && !isEscaped(input, k)) {
            const inner = input.slice(i + 1, k);
            if (inner.length === 0) continue;
            if (inner.indexOf('\n') !== -1) continue;
            const raw = input.slice(i, k + 1);
            out.push({ type: 'inline', raw, content: inner, start: i, end: k + 1 });
            i = k + 1;
            found = true;
            break;
          }
        }
        if (found) continue;
        i++;
        continue;
      }
    }

    i++;
  }

  return out;
}

export async function replaceMathSegments(
  input: string,
  replacer: (seg: MathSegment) => Promise<string>,
): Promise<string> {
  const segments = findMathSegments(input);
  if (segments.length === 0) return input;

  let out = '';
  let last = 0;
  for (const seg of segments) {
    if (last < seg.start) out += input.slice(last, seg.start);
    try {
      out += await replacer(seg);
    } catch {
      out += seg.raw;
    }

    last = seg.end;
  }
  if (last < input.length) out += input.slice(last);
  return out;
}
