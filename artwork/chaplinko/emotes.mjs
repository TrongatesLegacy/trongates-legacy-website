// Chaplinko's own animated emotes, for the pretend chat on its page (the hero and the set-up preview drop them, to show
// animated emotes playing as they fall): original drawings in the brand's colours, never anyone's real emotes.
// public/chaplinko/assets/emotes/<name>.gif, 64 × 64, 16 frames at 12.5 fps, transparent.
// Usage: node --experimental-websocket artwork/chaplinko/emotes.mjs   (needs Google Chrome + ffmpeg)
import { writeFileSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launch } from '../../tests/helpers/chrome.mjs';
import { siteServer } from '../../tests/helpers/server.mjs';

const root = join(new URL('.', import.meta.url).pathname, '../..'), out = join(root, 'public/chaplinko/assets/emotes');
const N = 16, S = 64;
// each draws frame i of N on a 64 × 64 canvas (t: 0 → 1 round the loop)
const DRAW = `
const TAU = Math.PI * 2;
function ball(g, x, y, r, sx = 1, sy = 1) {
  g.save(); g.translate(x, y); g.scale(sx, sy);
  const gr = g.createRadialGradient(-r * .35, -r * .4, 0, 0, 0, r); gr.addColorStop(0, '#ffd2ad'); gr.addColorStop(.35, '#ff7a1a'); gr.addColorStop(1, '#d9560a');
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill(); g.restore();
}
const EMOTES = {
  chapBounce(g, t) {                                   // the tangerine ball bouncing, with a face
    const h = Math.abs(Math.sin(t * Math.PI)), y = 50 - h * 30, squash = h < .15 ? 1 - (.15 - h) * 2 : 1;
    g.fillStyle = 'rgba(10,18,51,.35)'; g.beginPath(); g.ellipse(32, 60, 16 - h * 6, 3, 0, 0, TAU); g.fill();
    ball(g, 32, y, 13, 2 - squash, squash);
    g.fillStyle = '#1a0a00'; g.beginPath(); g.arc(27, y - 2, 2.2, 0, TAU); g.arc(37, y - 2, 2.2, 0, TAU); g.fill();
    g.strokeStyle = '#1a0a00'; g.lineWidth = 2; g.lineCap = 'round'; g.beginPath(); g.arc(32, y + 2, 4.5, .15 * Math.PI, .85 * Math.PI); g.stroke();
  },
  chapHype(g, t) {                                     // a jackpot-pink heart beating, sparkles turning round it
    const k = 1 + .14 * Math.max(0, Math.sin(t * TAU * 2));
    g.save(); g.translate(32, 33); g.scale(k, k);
    g.fillStyle = '#ff3d8b'; g.beginPath(); g.moveTo(0, 14); g.bezierCurveTo(-22, 0, -14, -18, 0, -8); g.bezierCurveTo(14, -18, 22, 0, 0, 14); g.fill();
    g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.ellipse(-7, -7, 4, 2.5, -.6, 0, TAU); g.fill(); g.restore();
    for (let i = 0; i < 3; i++) { const a = t * TAU + i * TAU / 3, x = 32 + Math.cos(a) * 25, y = 32 + Math.sin(a) * 25, s = 4;
      g.fillStyle = i % 2 ? '#eef3ff' : '#ff7a1a'; g.beginPath(); g.moveTo(x, y - s); g.lineTo(x + s * .3, y - s * .3); g.lineTo(x + s, y); g.lineTo(x + s * .3, y + s * .3); g.lineTo(x, y + s); g.lineTo(x - s * .3, y + s * .3); g.lineTo(x - s, y); g.lineTo(x - s * .3, y - s * .3); g.fill(); }
  },
  chapStar(g, t) {                                     // a cobalt star spinning, with a glint
    g.save(); g.translate(32, 32); g.rotate(t * TAU / 5 * 2);
    g.fillStyle = '#2f5bff'; g.strokeStyle = '#eef3ff'; g.lineWidth = 2.5; g.lineJoin = 'round';
    g.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 11 : 25, a = -Math.PI / 2 + i * Math.PI / 5; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill(); g.stroke();
    g.restore();
    const gl = Math.max(0, Math.sin(t * TAU)); g.globalAlpha = gl; g.fillStyle = '#fff'; g.beginPath(); g.arc(24, 24, 3 + gl * 2, 0, TAU); g.fill(); g.globalAlpha = 1;
  },
  chapGG(g, t) {                                       // GG, wobbling
    g.save(); g.translate(32, 34); g.rotate(Math.sin(t * TAU) * .2); g.scale(1 + Math.sin(t * TAU * 2) * .06, 1);
    g.font = '400 30px Bungee'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 6; g.strokeStyle = '#0a1233'; g.lineJoin = 'round'; g.strokeText('GG', 0, 0);
    g.fillStyle = '#ff7a1a'; g.fillText('GG', 0, 0); g.restore();
  },
};
window.frames64 = (name) => { const c = document.createElement('canvas'); c.width = c.height = ${S}; const g = c.getContext('2d'), out = [];
  for (let i = 0; i < ${N}; i++) { g.clearRect(0, 0, ${S}, ${S}); EMOTES[name](g, i / ${N}); out.push(c.toDataURL('image/png')); } return out; };
window.names = Object.keys(EMOTES);`;
const PAGE = `<!doctype html><style>@font-face { font-family: Bungee; src: url(/assets/fonts/bungee.woff2); }</style><body style="font-family:Bungee">GG<script>${DRAW}</script>`;

mkdirSync(out, { recursive: true });
const site = await siteServer({ files: { '/emotes.html': PAGE } }), chrome = await launch();
try {
  const tab = await chrome.open(site.origin + '/emotes.html', { width: 200, height: 200 });
  await tab.eval('document.fonts.load("30px Bungee").then(() => 1)');
  for (const name of JSON.parse(await tab.eval('JSON.stringify(names)'))) {
    const frames = JSON.parse(await tab.eval(`JSON.stringify(frames64(${JSON.stringify(name)}))`));
    const dir = join(tmpdir(), 'cp-emote-' + name); rmSync(dir, { recursive: true, force: true }); mkdirSync(dir);
    frames.forEach((d, i) => writeFileSync(join(dir, `${String(i).padStart(2, '0')}.png`), Buffer.from(d.split(',')[1], 'base64')));
    const gif = join(out, name + '.gif');
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', '12.5', '-i', join(dir, '%02d.png'), '-filter_complex', '[0:v]split[a][b];[a]palettegen=reserve_transparent=1[p];[b][p]paletteuse=alpha_threshold=128', '-loop', '0', gif]);
    console.log(`${gif.replace(root, '')} ${Math.round(statSync(gif).size / 1024)} KB`);
  }
} finally { await chrome.close(); await site.close(); }
