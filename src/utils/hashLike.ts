// ? 同じ postscript をもつフォントを識別するため
export function hashLike(input: string, length = 6): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = (h * 33) ^ input.charCodeAt(i);
  }
  const n = h >>> 0;

  const s = n.toString(36);
  return s.length >= length ? s.slice(-length) : s.padStart(length, "0");
}
