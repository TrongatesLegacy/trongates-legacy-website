// An original synthwave track for Chaplinko's trailer, synthesised here (nothing licensed, no attribution needed):
// 96 BPM, 12 bars = 30 s, F minor, Fm–Db–Ab–Eb. Deliberately unlike Chatagram's (128 BPM house in A minor): detuned saw
// pads, an octave-pulsing saw bass, gated big snares, a sparkling square arpeggio, and plinks for the balls hitting pegs
// in the cold open. Bars 1–2 cold open (pad, plinks), bar 3 the build (snare roll, riser), bars 4–11 full (a crash and a
// bright stab on the jackpot at bar 8), bar 12 the ending chord and the last hit.
// Usage: node music.mjs out.m4a   (ffmpeg adds the reverb, evens the loudness and encodes)
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const OUT = process.argv[2] || join(tmpdir(), 'chaplinko-music.m4a');
const SR = 44100, BPM = 96, B = 60 / BPM, BAR = 4 * B, LEN = 30, N = SR * LEN;
const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
// Fm, Db, Ab, Eb: root (bass, octave 2) and chord tones (octave 3–4)
const CHORDS = [[41, [53, 56, 60]], [37, [49, 53, 56]], [44, [56, 60, 63]], [39, [51, 55, 58]]];
let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
const L = new Float32Array(N), R = new Float32Array(N);
const saw = (ph) => 2 * (ph - Math.floor(ph + 0.5));
const sq = (ph) => (ph % 1 < 0.5 ? 1 : -1);
// one-pole low-pass per voice (state kept across samples)
const lp = (st, x, a) => (st.v += a * (x - st.v));
const padF = [{ v: 0 }, { v: 0 }], bassF = { v: 0 }, arpF = { v: 0 };
// the cold open's plinks: a ball falling through pegs, faster and faster (times in seconds)
const PLINKS = [0.35, 0.8, 1.2, 1.55, 1.85, 2.12, 2.36, 2.58, 2.78, 2.96, 3.12, 3.27, 3.4, 3.52, 3.63, 3.73, 3.82, 3.9, 3.97, 4.03];
const PLINK_NOTES = [84, 87, 91, 89, 84, 92, 87, 96, 91, 89, 94, 87, 96, 91, 99, 94, 96, 91, 99, 103];

for (let i = 0; i < N; i++) {
  const t = i / SR, bar = Math.floor(t / BAR), [root, tones] = CHORDS[bar % 4];
  const bt = t % B, et = t % (B / 2), st = t % (B / 4), step = Math.floor(t / (B / 4)) % 16;
  const full = bar >= 3 && bar <= 10, build = bar === 2, end = bar === 11;
  let l = 0, r = 0;

  // pad: detuned saws, filter opening over the track; swells in, holds the last chord at the end
  const padGain = (t < 2 ? t / 2 : 1) * (end ? Math.max(0, 1 - (t - 11 * BAR) / BAR * 0.6) : 1) * 0.055;
  const cut = 0.02 + 0.06 * Math.min(1, t / 12);
  let pl = 0, pr = 0;
  for (const m of tones) { const f = midi(m); pl += saw(f * t * 0.998) + saw(f * t * 1.004); pr += saw(f * t * 1.002) + saw(f * t * 0.996); }
  l += lp(padF[0], pl, cut) * padGain; r += lp(padF[1], pr, cut) * padGain;

  // bass: octave-pulsing saw eighths (root, root an octave up), from the build on
  if (full || build || end) {
    const f = midi(root) * (Math.floor(t / (B / 2)) % 2 ? 2 : 1), env = Math.exp(-et * 6) * (end ? Math.max(0, 1 - (t - 11 * BAR) / B) : 1);
    const b = lp(bassF, saw(f * t) + 0.5 * saw(f * 1.006 * t), 0.08) * 0.22 * env; l += b; r += b;
  }
  if (full) {
    // kick on 1 and 3, a gated big snare on 2 and 4, eighth hats
    const beat = Math.floor(t / B) % 4;
    if (beat === 0 || beat === 2) { const k = Math.sin(2 * Math.PI * (48 + 110 * Math.exp(-bt * 28)) * bt) * Math.exp(-bt * 6) * 0.9; l += k; r += k; }
    if (beat === 1 || beat === 3) { const g = bt < 0.22 ? 1 : Math.max(0, 1 - (bt - 0.22) * 30); const sn = (rnd() * 0.7 + Math.sin(2 * Math.PI * 190 * bt) * 0.3) * Math.exp(-bt * 5) * g * 0.42; l += sn; r += sn; }
    const hh = rnd() * Math.exp(-et * 55) * 0.09; l += hh * 0.7; r += hh * 1.2;
    // arpeggio: square sixteenths up and down the chord, an octave up, bouncing left to right
    const seq = [0, 1, 2, 1, 0, 2, 1, 2, 0, 1, 2, 1, 2, 1, 0, 1], f = midi(tones[seq[step]] + 12);
    const a = lp(arpF, sq(f * t), 0.25) * Math.exp(-st * 12) * 0.06; l += a * (step % 2 ? 0.5 : 1.2); r += a * (step % 2 ? 1.2 : 0.5);
  }
  // the build (bar 3): a snare roll getting denser and a noise riser into the drop
  if (build) {
    const p = (t - 2 * BAR) / BAR, div = p < 0.5 ? 4 : p < 0.75 ? 8 : 16, rt = t % (BAR / div);
    const roll = rnd() * Math.exp(-rt * 40) * (0.1 + p * 0.3); l += roll; r += roll;
    const rise = rnd() * p * p * 0.16; l += rise * 0.8; r += rise;
  }
  // the jackpot (bar 8): a crash and a bright major stab
  if (bar === 7) { const u = t - 7 * BAR; const c = rnd() * Math.exp(-u * 2.2) * 0.3 + (Math.sin(2 * Math.PI * midi(72) * u) + Math.sin(2 * Math.PI * midi(76) * u) + Math.sin(2 * Math.PI * midi(79) * u)) * Math.exp(-u * 3) * 0.08; l += c; r += c; }
  // plinks in the cold open
  for (let j = 0; j < PLINKS.length; j++) { const u = t - PLINKS[j]; if (u >= 0 && u < 0.6) { const p = Math.sin(2 * Math.PI * midi(PLINK_NOTES[j]) * u) * Math.exp(-u * 9) * 0.14; l += p * (j % 2 ? 0.7 : 1.1); r += p * (j % 2 ? 1.1 : 0.7); } }
  // the last hit (bar 12, beat 3): a low boom and a shimmer
  const hitAt = 11 * BAR + 2 * B;
  if (t >= hitAt) { const u = t - hitAt; const h = Math.sin(2 * Math.PI * (40 + 60 * Math.exp(-u * 10)) * u) * Math.exp(-u * 2.5) * 0.9 + rnd() * Math.exp(-u * 4) * 0.12; l += h; r += h; }
  L[i] = l; R[i] = r;
}
// 16-bit stereo WAV
const buf = Buffer.alloc(44 + N * 4);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20);
buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
buf.write('data', 36); buf.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) {
  buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, Math.tanh(L[i] * 1.1))) * 32767), 44 + i * 4);
  buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, Math.tanh(R[i] * 1.1))) * 32767), 46 + i * 4);
}
const wav = join(tmpdir(), 'chaplinko-music.wav');
writeFileSync(wav, buf);
// a big 80s room (two echoes, one long), then even loudness
execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', wav, '-af', 'aecho=0.8:0.55:95|260:0.3|0.18,loudnorm=I=-14:TP=-1.2:LRA=9', '-ar', '44100', '-c:a', 'aac', '-b:a', '192k', OUT]);
console.log(OUT);
