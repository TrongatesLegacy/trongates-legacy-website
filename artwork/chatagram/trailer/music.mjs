// An original upbeat track for the trailer, synthesised here (nothing licensed): 128 BPM, 16 bars = 30 s, Am–F–C–G.
// Kick on every beat, clap on 2 and 4, off-beat hats, a pumping square bass, a bright arpeggio and a soft pad; the drums
// and arpeggio come in after two bars, a riser leads into bar 5 (the gameplay), and it all stops cleanly at the end.
// Usage: node music.mjs out.m4a   (ffmpeg adds a touch of echo, evens the loudness and encodes)
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const OUT = process.argv[2] || join(tmpdir(), 'chatagram-music.m4a');
const SR = 44100, LEN = 30, B = 60 / 128, BAR = 4 * B, N = SR * LEN;
const ROOTS = [110, 87.31, 130.81, 98];                 // A2 F2 C3 G2
const MINOR = [true, false, false, false];
let seed = 1; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
const L = new Float32Array(N), R = new Float32Array(N);
for (let i = 0; i < N; i++) {
  const t = i / SR, bar = Math.floor(t / BAR), k = bar % 4, f = ROOTS[k], third = MINOR[k] ? 1.1892 : 1.2599;
  const bt = t % B, et = t % (B / 2), st = t % (B / 4), step = Math.floor(t / (B / 4)) % 4;
  const drums = t >= 2 * BAR, end = t > LEN - B;
  let s = 0, w = 0;
  if (drums && !end) {
    s += Math.sin(2 * Math.PI * (45 + 120 * Math.exp(-bt * 30)) * bt) * Math.exp(-bt * 7) * 0.85;              // kick
    const cb = (t + B) % (2 * B); s += rnd() * Math.exp(-cb * 22) * 0.22;                                       // clap
    const hb = (t + B / 2) % B; w += rnd() * Math.exp(-hb * 70) * 0.16;                                        // hat (stereo)
    const ratio = [1, third, 1.4983, 2][step];
    w += (2 / Math.PI) * Math.asin(Math.sin(2 * Math.PI * f * 4 * ratio * t)) * 0.12 * Math.exp(-st * 9);       // arp
  }
  if (!end) {
    s += (Math.sin(2 * Math.PI * f / 2 * t) > 0 ? 1 : -1) * 0.13 * (1 - Math.exp(-et * 40)) * Math.exp(-et * 3.5); // bass
    s += (Math.sin(2 * Math.PI * f * 2 * t) + Math.sin(2 * Math.PI * f * 2 * third * t) + Math.sin(2 * Math.PI * f * 3 * t)) * 0.03; // pad
  }
  // riser into bar 5 (the gameplay starts there): noise swelling over bar 4
  if (t > 3 * BAR && t < 4 * BAR) { const p = (t - 3 * BAR) / BAR; s += rnd() * p * p * 0.18; }
  // a final hit on the last beat
  if (t >= LEN - B) { const u = t - (LEN - B); s += Math.sin(2 * Math.PI * 55 * u) * Math.exp(-u * 5) * 0.8 + rnd() * Math.exp(-u * 12) * 0.2; }
  L[i] = s + w * 0.8; R[i] = s + w * 1.2 * (step % 2 ? 1 : 0.6);
}
// 16-bit stereo WAV
const buf = Buffer.alloc(44 + N * 4);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20);
buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
buf.write('data', 36); buf.writeUInt32LE(N * 4, 40);
const clip = (x) => Math.max(-1, Math.min(1, Math.tanh(x * 0.9)));
for (let i = 0; i < N; i++) { buf.writeInt16LE(Math.round(clip(L[i]) * 32000), 44 + i * 4); buf.writeInt16LE(Math.round(clip(R[i]) * 32000), 46 + i * 4); }
const wav = join(tmpdir(), 'chatagram-music.wav'); writeFileSync(wav, buf);
execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', wav, '-af', 'aecho=0.8:0.4:176:0.15,afade=t=in:d=0.2,loudnorm=I=-14:TP=-1.5', '-ar', '44100', '-c:a', 'aac', '-b:a', '192k', OUT]);
console.log(OUT);
