// Scene transitions drawn live on top of the scenes (transition.html), in the current form's colour and look: Derez grid
// and Logo shutters. Princess Trina's look draws them in her lattice, with gold edges, sparkles and her title font; the
// Blobfish's in deep water, with teal edges, a ripple and bubbles; Tron's in the grid. OBS plays a Stinger with an invisible "hold" video (assets/trongates-hold.webm, 1.2 s, cut at 600 ms)
// so the cut waits; this page hears the Stinger start over the OBS WebSocket and covers the screen around the cut, then
// clears onto the new scene. Which animation: the Stinger's name (…Derez…, …Shutter…). See obs/README.md, "Transitions".
//
//   TGLTransition.pick('Trongates · Derez')  → 'derez'
//   TGLTransition.player({ now, frame, later, draw, clear })  the timing, apart from any drawing (the tests drive it)
(() => {
  const MS = 1200;                  // the hold video's length; OBS cuts at 600 ms, the middle
  // Both animations cover the whole screen from 40% to 60% (480–720 ms): the cut at 600 ms lands inside with room for
  // the WebSocket message arriving late.
  /** @type {[number, number]} */
  const COVER = [0.4, 0.6];
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const ease = (t) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const easeIn = (t) => t * t * t;
  const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
  const VOID = '#040a14';
  // each look's void, edges and logo font (the same as the scenes' titles: overlay.css, "Form looks")
  const LOOK = {
    tron: { bg: VOID, edge: null, font: 'Orbitron', scale: 1 },
    princess: { bg: '#0a0510', second: '#b48cff', edge: '#ffd98a', font: '"Cinzel Decorative"', scale: .8 },
    blobfish: { bg: '#020b11', second: '#45d6c8', edge: '#45d6c8', font: '"Lilita One"', scale: 1.12 },
  };
  const lookFor = (l) => LOOK[l] || LOOK.tron;
  // a four-pointed sparkle
  function sparkle(ctx, x, y, r, a, fill) {
    if (a <= 0 || r <= 0) return;
    ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = fill; ctx.beginPath();
    for (let i = 0; i < 8; i++) { const rr = i % 2 ? r * .28 : r, an = i * Math.PI / 4 - Math.PI / 2; ctx.lineTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr); }
    ctx.fill(); ctx.restore();
  }

  /** @param {string} name a transition's name in OBS @returns {'derez' | 'shutters' | null} */
  const pick = (name) => (/derez/i.test(name || '') ? 'derez' : /shutter/i.test(name || '') ? 'shutters' : null);

  // The void a cover is made of, drawn once per colour, look and size: Tron's dark glass with the grid; Princess's
  // quilted lattice under a lilac glow; the Blobfish's deep water, lit from above, with sand ripples at the bottom.
  let texture = null;
  function voidTexture(W, H, accent, look = 'tron') {
    const key = `${W}x${H}${accent}${look}`;
    if (texture && texture.key === key) return texture.canvas;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'), s = H / 540, step = 40 * s, L = lookFor(look);
    g.fillStyle = L.bg; g.fillRect(0, 0, W, H);
    g.lineWidth = 1;
    if (look === 'princess') {
      const glow = g.createRadialGradient(W / 2, -H * .1, 0, W / 2, -H * .1, H * .9);
      glow.addColorStop(0, rgba(L.second, .22)); glow.addColorStop(1, rgba(L.second, 0));
      g.fillStyle = glow; g.fillRect(0, 0, W, H);
      g.strokeStyle = rgba(accent, .14);
      for (let x = -H; x < W + H; x += step * 1.4) {
        g.beginPath(); g.moveTo(x, 0); g.lineTo(x + H, H); g.stroke();
        g.beginPath(); g.moveTo(x, H); g.lineTo(x + H, 0); g.stroke();
      }
    } else if (look === 'blobfish') {
      const light = g.createLinearGradient(0, 0, 0, H);
      light.addColorStop(0, rgba(L.second, .16)); light.addColorStop(.45, rgba(L.second, 0)); light.addColorStop(1, 'rgba(0,0,0,.4)');
      g.fillStyle = light; g.fillRect(0, 0, W, H);
      g.fillStyle = rgba(L.second, .05);
      for (let x = -H; x < W; x += 110 * s) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 40 * s, 0); g.lineTo(x + 40 * s + H * .2, H); g.lineTo(x + H * .2, H); g.fill(); }
      g.lineWidth = 1.5 * s;
      for (let y = H * .72, i = 0; y < H + 20 * s; y += 26 * s, i++) {
        g.strokeStyle = i % 2 ? rgba(L.second, .12) : rgba(accent, .22);
        g.beginPath();
        for (let x = 0; x <= W; x += 8 * s) g.lineTo(x, y + Math.sin(x / (40 * s) + i) * 5 * s);
        g.stroke();
      }
    } else {
      g.strokeStyle = rgba(accent, .16);
      for (let x = 0; x < W; x += step) { g.beginPath(); g.moveTo(x + .5, 0); g.lineTo(x + .5, H); g.stroke(); }
      for (let y = 0; y < H; y += step) { g.beginPath(); g.moveTo(0, y + .5); g.lineTo(W, y + .5); g.stroke(); }
    }
    texture = { key, canvas: c };
    return c;
  }

  const ANIMS = {
    // Dark grid tiles flip in from the centre outwards until the scene has derezzed, then flip away onto the new one.
    derez(ctx, p, W, H, accent, look = 'tron') {
      const C = 16, R = 9, tw = W / C, th = H / R, s = H / 540, tex = voidTexture(W, H, accent, look), L = lookFor(look);
      const first = p < .5, q = first ? clamp(p / COVER[0]) : clamp((p - COVER[1]) / (1 - COVER[1]));
      for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
        const d = Math.hypot((c + .5) / C - .5, ((r + .5) / R - .5) * .56) / .58 * .5 + ((c * 7 + r * 13) % 10) / 100;
        const k = clamp((q - d) / .4), cover = first ? easeOut(k) : 1 - easeIn(k);
        if (cover <= 0) continue;
        const tx = Math.floor(c * tw), y = Math.floor(r * th), w = Math.ceil((c + 1) * tw) - tx, hh = Math.ceil((r + 1) * th) - y, h = hh * cover;
        const top = y + (hh - h) / 2;
        // the Blobfish's tiles sway in as through water (still once they cover, so the cut is always fully covered)
        const x = tx + (look === 'blobfish' ? Math.round(Math.sin(r * .9 + q * 7) * 14 * s * (1 - cover)) : 0);
        ctx.drawImage(tex, tx, y, w, hh, x, top, w, h);
        const e = Math.sin(k * Math.PI) * .9 + .12;
        ctx.strokeStyle = rgba(L.edge && (c + r) % 2 ? L.edge : accent, e); ctx.lineWidth = Math.max(1, 1.5 * s);
        ctx.strokeRect(x + 1, top + .5, w - 2, Math.max(1, h - 1));
        // Princess's tiles sparkle as they flip; the Blobfish's let a bubble go
        if (look === 'princess' && (c * 3 + r * 5) % 4 === 0) sparkle(ctx, x + w / 2, top + h / 2, 12 * s * Math.sin(k * Math.PI), Math.sin(k * Math.PI), L.edge);
        if (look === 'blobfish' && (c * 3 + r * 5) % 5 === 0 && k > 0 && k < 1) {
          ctx.save(); ctx.globalAlpha = Math.sin(k * Math.PI) * .8; ctx.strokeStyle = L.second; ctx.lineWidth = 1.5 * s;
          ctx.beginPath(); ctx.arc(x + w / 2 + Math.sin(k * 9) * 4 * s, top + h / 2 - k * 30 * s, (3 + (c % 3) * 2) * s, 0, 6.3); ctx.stroke(); ctx.restore();
        }
      }
    },
    // Two panels with the grid slam shut on a chevron seam, the logo hits, and they open on the new scene.
    shutters(ctx, p, W, H, accent, look = 'tron') {
      const close = ease(clamp(p / .32)), open = ease(clamp((p - .66) / .34)), f = close * (1 - open), s = H / 540, a = 60 * s;
      const tex = voidTexture(W, H, accent, look), L = lookFor(look);
      for (const dir of [-1, 1]) {
        const e = W / 2 + dir * (1 - f) * W * .62, far = dir < 0 ? -10 : W + 10;
        ctx.save(); ctx.beginPath(); ctx.moveTo(far, 0); ctx.lineTo(e - a, 0); ctx.lineTo(e + a, H / 2); ctx.lineTo(e - a, H); ctx.lineTo(far, H); ctx.closePath();
        ctx.clip(); ctx.drawImage(tex, 0, 0); ctx.restore();
        ctx.save(); ctx.shadowColor = accent; ctx.shadowBlur = 18 * s; ctx.strokeStyle = accent; ctx.lineWidth = 4 * s;
        ctx.beginPath(); ctx.moveTo(e - a, 0); ctx.lineTo(e + a, H / 2); ctx.lineTo(e - a, H); ctx.stroke();
        if (L.edge) {                               // a second, finer edge: gold for Princess, teal for the Blobfish
          ctx.shadowBlur = 0; ctx.strokeStyle = L.edge; ctx.lineWidth = 1.5 * s; const o = dir * 10 * s;
          ctx.beginPath(); ctx.moveTo(e - a + o, 0); ctx.lineTo(e + a + o, H / 2); ctx.lineTo(e - a + o, H); ctx.stroke();
        }
        ctx.restore();
        // Princess's seam sheds sparkles; bubbles rise along the Blobfish's
        if (look !== 'tron' && f > .05 && f < .98) for (let i = 0; i < 7; i++) {
          const t = (i / 7 + p * 2.3) % 1, y = H * (1 - t), x = e - a + 2 * a * (1 - Math.abs(y - H / 2) / (H / 2)) + dir * 14 * s;
          if (look === 'princess') sparkle(ctx, x, y, (6 + (i % 3) * 3) * s, Math.sin(t * Math.PI), i % 2 ? L.edge : '#fff');
          else {
            ctx.save(); ctx.globalAlpha = Math.sin(t * Math.PI) * .8; ctx.strokeStyle = i % 2 ? L.second : accent; ctx.lineWidth = 1.5 * s;
            ctx.beginPath(); ctx.arc(x + Math.sin(t * 12 + i) * 5 * s, y, (3 + (i % 3) * 2) * s, 0, 6.3); ctx.stroke(); ctx.restore();
          }
        }
      }
      const la = clamp((p - .26) / .08) * (1 - clamp((p - .64) / .06));
      if (la > 0) {
        const k = 1 + (1 - easeOut(clamp((p - .26) / .12))) * .35;
        ctx.save(); ctx.globalAlpha = la; ctx.translate(W / 2, H / 2); ctx.scale(k, k); ctx.textAlign = 'center';
        ctx.fillStyle = L.bg; ctx.fillRect(-250 * s, -60 * s, 500 * s, 140 * s);
        ctx.font = `900 ${64 * s * L.scale}px ${L.font}, Orbitron`; ctx.shadowColor = accent; ctx.shadowBlur = 16 * s; ctx.strokeStyle = accent; ctx.lineWidth = 2.5 * s;
        ctx.strokeText('TRONGATES', 0, -6 * s);
        ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.font = `900 ${54 * s * L.scale}px ${L.font}, Orbitron`; ctx.fillText('LEGACY', 0, 56 * s);
        ctx.restore();
      }
    },
    // Reduced motion: the void fades in, holds over the cut, and fades out.
    fade(ctx, p, W, H, accent, look = 'tron') {
      const a = p < COVER[0] ? p / COVER[0] : p > COVER[1] ? (1 - p) / (1 - COVER[1]) : 1;
      ctx.globalAlpha = clamp(a); ctx.drawImage(voidTexture(W, H, accent, look), 0, 0); ctx.globalAlpha = 1;
    },
  };

  /**
   * The timing of one overlay, apart from drawing. A transition plays for MS; a new one starting while another plays
   * carries on from the same amount of cover (never uncovering mid-switch); when OBS says the transition ended, whatever
   * cover is left clears at once; and a timer clears it whatever happens, so the screen can never stay covered.
   * @param {{ now: () => number, frame: (fn: () => void) => void, later: (fn: () => void, ms: number) => any, cancel?: (id: any) => void,
   *   draw: (anim: string, p: number) => void, clear: () => void }} io
   */
  function player({ now, frame, later, cancel = () => {}, draw, clear }) {
    let anim = null, t0 = 0, running = false, safety = null, ended = false;
    const progress = () => (anim ? (now() - t0) / MS : 1);
    const stop = () => { anim = null; running = false; ended = false; cancel(safety); safety = null; clear(); };
    const tick = () => {
      if (!anim) return;
      let p = progress();
      if (ended && p < COVER[1]) { t0 = now() - COVER[1] * MS; p = COVER[1]; }   // OBS has cut already: start clearing
      if (p >= 1) return stop();
      draw(anim, p);
      frame(tick);
    };
    return {
      /** @param {string} which */
      start(which) {
        const p = anim ? progress() : 0;
        // carry on from the same cover: covering (or covered) keeps its place, clearing turns back into covering
        const from = p < .5 ? p : 1 - p;
        anim = which; ended = false; t0 = now() - clamp(from, 0, COVER[0]) * MS;
        cancel(safety); safety = later(stop, MS + 400);
        if (!running) { running = true; frame(tick); }
      },
      end() { if (anim) ended = true; },
      get playing() { return anim; },
      get progress() { return anim ? progress() : null; },
    };
  }

  window.TGLTransition = { MS, COVER, ANIMS, LOOK, pick, player };
})();
