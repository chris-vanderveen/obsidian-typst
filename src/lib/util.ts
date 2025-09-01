export function hashLike(input: string, length = 6): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = (h * 33) ^ input.charCodeAt(i);
  }
  const n = h >>> 0;

  const s = n.toString(36);
  return s.length >= length ? s.slice(-length) : s.padStart(length, '0');
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export function zip(map: Map<string, Uint8Array | undefined>): Uint8Array {
  let total = 4;
  for (const [k, v] of map) {
    const keyBytes = textEncoder.encode(k);
    total += 4 + keyBytes.length;
    total += 1;
    if (v) {
      total += 4 + v.byteLength;
    }
  }

  const out = new Uint8Array(total);
  const dv = new DataView(out.buffer, out.byteOffset, out.byteLength);
  let offset = 0;

  dv.setUint32(offset, map.size, true);
  offset += 4;

  for (const [k, v] of map) {
    const keyBytes = textEncoder.encode(k);
    dv.setUint32(offset, keyBytes.length, true);
    offset += 4;
    out.set(keyBytes, offset);
    offset += keyBytes.length;

    if (v === undefined) {
      out[offset++] = 0;
    } else {
      out[offset++] = 1;
      dv.setUint32(offset, v.byteLength, true);
      offset += 4;
      out.set(v, offset);
      offset += v.byteLength;
    }
  }

  if (offset !== total) throw new Error('internal error: length mismatch');

  return out;
}

export function unzip(
  input: ArrayBuffer | Uint8Array,
): Map<string, Uint8Array | undefined> {
  const buf = input instanceof Uint8Array ? input : new Uint8Array(input);
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let offset = 0;
  const result = new Map<string, Uint8Array | undefined>();

  if (buf.byteLength < 4)
    throw new Error('internal error: buffer too small for count');
  const count = dv.getUint32(offset, true);
  offset += 4;

  for (let i = 0; i < count; i++) {
    if (offset + 4 > buf.byteLength)
      throw new Error('internal error: unexpected end (keyLen)');
    const keyLen = dv.getUint32(offset, true);
    offset += 4;
    if (offset + keyLen > buf.byteLength)
      throw new Error('internal error: unexpected end (keyBytes)');
    const keyBytes = buf.subarray(offset, offset + keyLen);
    const key = textDecoder.decode(keyBytes);
    offset += keyLen;

    if (offset + 1 > buf.byteLength)
      throw new Error('internal error: unexpected end (hasValue)');
    const hasValue = buf[offset++] !== 0;

    if (!hasValue) {
      result.set(key, undefined);
    } else {
      if (offset + 4 > buf.byteLength)
        throw new Error('internal error: unexpected end (valueLen)');
      const valueLen = dv.getUint32(offset, true);
      offset += 4;
      if (offset + valueLen > buf.byteLength)
        throw new Error('internal error: unexpected end (valueBytes)');
      const valueBytes = buf.subarray(offset, offset + valueLen);
      const value = new Uint8Array(valueBytes);
      offset += valueLen;
      result.set(key, value);
    }
  }

  return result;
}
