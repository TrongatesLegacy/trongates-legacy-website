// Minimal APNG writer. Each frame after the first stores only the pixels that changed (everything else
// is transparent and blended over the previous frame), which is what keeps a mostly-static banner small.
import { deflateSync } from "node:zlib";

const CRC = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buf) => { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0); out.write(type, 4, "latin1"); data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

// PNG scanline filtering: pick, per row, whichever of None/Sub/Up/Paeth gives the smallest residuals.
function filterRows(rgba, w, h) {
  const stride = w * 4, out = Buffer.alloc((stride + 1) * h), cand = [0, 1, 2, 4].map(() => Buffer.alloc(stride));
  for (let y = 0; y < h; y++) {
    const row = rgba.subarray(y * stride, (y + 1) * stride), prev = y ? rgba.subarray((y - 1) * stride, y * stride) : null;
    const sums = [0, 0, 0, 0];
    for (let i = 0; i < stride; i++) {
      const a = i >= 4 ? row[i - 4] : 0, b = prev ? prev[i] : 0, c = prev && i >= 4 ? prev[i - 4] : 0, x = row[i];
      const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      const paeth = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      const v = [x, (x - a) & 255, (x - b) & 255, (x - paeth) & 255];
      for (let f = 0; f < 4; f++) { cand[f][i] = v[f]; sums[f] += v[f] < 128 ? v[f] : 256 - v[f]; }
    }
    const best = sums.indexOf(Math.min(...sums));
    out[y * (stride + 1)] = [0, 1, 2, 4][best];
    cand[best].copy(out, y * (stride + 1) + 1);
  }
  return out;
}

export function encodeApng(frames, w, h, fps) {
  const parts = [Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])];
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr.set([8, 6, 0, 0, 0], 8);
  const actl = Buffer.alloc(8); actl.writeUInt32BE(frames.length, 0); actl.writeUInt32BE(0, 4); // loop forever
  parts.push(chunk("IHDR", ihdr), chunk("acTL", actl));
  let seq = 0, prev = null;
  frames.forEach((frame, n) => {
    let x0 = 0, y0 = 0, x1 = w - 1, y1 = h - 1, pixels = frame;
    if (prev) {
      // bounding box of what changed, with untouched pixels inside it made transparent
      x0 = w; y0 = h; x1 = -1; y1 = -1;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (frame[i] !== prev[i] || frame[i + 1] !== prev[i + 1] || frame[i + 2] !== prev[i + 2]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      }
      if (x1 < 0) { x0 = y0 = 0; x1 = y1 = 0; }
      const bw = x1 - x0 + 1, bh = y1 - y0 + 1; pixels = Buffer.alloc(bw * bh * 4);
      for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
        const s = ((y + y0) * w + x + x0) * 4, d = (y * bw + x) * 4;
        if (frame[s] !== prev[s] || frame[s + 1] !== prev[s + 1] || frame[s + 2] !== prev[s + 2]) { pixels[d] = frame[s]; pixels[d + 1] = frame[s + 1]; pixels[d + 2] = frame[s + 2]; pixels[d + 3] = 255; }
      }
    }
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
    const fctl = Buffer.alloc(26);
    fctl.writeUInt32BE(seq++, 0); fctl.writeUInt32BE(bw, 4); fctl.writeUInt32BE(bh, 8); fctl.writeUInt32BE(x0, 12); fctl.writeUInt32BE(y0, 16);
    fctl.writeUInt16BE(1, 20); fctl.writeUInt16BE(fps, 22); fctl[24] = 0; fctl[25] = prev ? 1 : 0; // dispose: none, blend: over
    parts.push(chunk("fcTL", fctl));
    const data = deflateSync(filterRows(pixels, bw, bh), { level: 9 });
    if (n === 0) parts.push(chunk("IDAT", data));
    else { const fd = Buffer.alloc(4 + data.length); fd.writeUInt32BE(seq++, 0); data.copy(fd, 4); parts.push(chunk("fdAT", fd)); }
    prev = frame;
  });
  parts.push(chunk("IEND", Buffer.alloc(0)));
  return Buffer.concat(parts);
}
