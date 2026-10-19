// Draws our own presets (js/ours.js) from scratch on a canvas: keycaps with depth and a shine, a gaming mouse. Every
// part takes the theme: its font, corner radius, ring and glow, and the look's colours (edge, key, shine, accent).
// Same interface as IORender.PresetView (canvas, load, setLook, draw, els, centre, elementsFor), so pages use either.
(() => {
  const { KEYS } = window.IOCodes;
  const { hexRgb, mix, T } = window.IORender;
  const U = 64, DEPTH = 6, PAD = 22;
  const css = (c, a = 1) => `rgb(${c[0]} ${c[1]} ${c[2]} / ${a})`;
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const best = (bg, options) => options.reduce((m, c) => (contrast(bg, c) > contrast(bg, m) ? c : m));

  class DrawnView {
    constructor(spec) {
      this.spec = spec;
      this.drawn = true;
      this.pixel = false;
      this.fade = new Map();   // element id → { down, up: time it was let go }
      if (spec.kind === 'keys') {
        const xs = spec.keys.map((k) => k[2]), ys = spec.keys.map((k) => k[3]);
        const x0 = Math.min(...xs), y0 = Math.min(...ys);
        const x1 = Math.max(...spec.keys.map((k) => k[2] + k[4])), y1 = Math.max(...spec.keys.map((k) => k[3] + k[5]));
        this.w = Math.round((x1 - x0) * U + PAD * 2);
        this.h = Math.round((y1 - y0) * U + PAD * 2 + DEPTH);
        this.els = spec.keys.map(([code, label, x, y, w, h]) => ({
          t: T.KEY, c: KEYS[code] || -1, label, id: code,
          x: (x - x0) * U + PAD, y: (y - y0) * U + PAD, w: w * U, h: h * U,
        }));
      } else {
        this.w = 236 + PAD * 2; this.h = 300 + PAD * 2 + DEPTH;
        const ox = PAD + 22, oy = PAD;
        this.mouse = { ox, oy, bw: 192, bh: 300 };
        this.els = [
          { t: T.MOUSE_BUTTON, c: 1, id: 'm1', x: ox, y: oy, w: 93, h: 128 },
          { t: T.MOUSE_BUTTON, c: 2, id: 'm2', x: ox + 99, y: oy, w: 93, h: 128 },
          { t: T.WHEEL, c: 3, id: 'm3', x: ox + 83, y: oy + 30, w: 26, h: 64 },
          { t: T.MOUSE_BUTTON, c: 5, id: 'm5', x: PAD - 8, y: oy + 128, w: 34, h: 42 },
          { t: T.MOUSE_BUTTON, c: 4, id: 'm4', x: PAD - 8, y: oy + 176, w: 34, h: 42 },
        ];
      }
      this.layout = { w: this.w, h: this.h };
      this.canvas = document.createElement('canvas');
      this.canvas.width = this.w; this.canvas.height = this.h;
      this.ctx = this.canvas.getContext('2d');
    }
    async load() { return this; }

    /** look: { edge, key, hi, accent }; style: the theme (font, weight, radius, ring, glow) */
    setLook(look, style) {
      this.c = { edge: hexRgb(look.edge), key: hexRgb(look.key), hi: hexRgb(look.hi), acc: hexRgb(look.accent) };
      this.style = style;
      this.font = (px) => `${style.weight || 700} ${px}px ${style.font || 'system-ui'}, system-ui, sans-serif`;
      document.fonts?.load(this.font(20)).catch(() => {});
    }

    centre(e) { return [(e.x + e.w / 2) / this.w, (e.y + e.h / 2) / this.h]; }
    elementsFor(ev) {
      return this.els.filter((e) => (ev.kind === 'key' && e.t === T.KEY && e.c === ev.code) || (ev.kind === 'mouse' && e.c === ev.code));
    }

    /** how pressed an element looks, 0–1: on at once, fading out over 140ms when let go */
    amount(e, down, now) {
      let f = this.fade.get(e.id);
      if (!f) this.fade.set(e.id, (f = { down: false, up: -1e9 }));
      if (f.down && !down) f.up = now;
      f.down = down;
      return down ? 1 : Math.max(0, 1 - (now - f.up) / 140);
    }

    /** one keycap: a darker side below, the cap (sinking as it's pressed), a shine, a ring, the legend */
    cap(g, x, y, w, h, p, label, r = this.style.radius ?? 10) {
      const { edge, key, hi, acc } = this.c, st = this.style;
      const capC = mix(key, acc, p);
      const side = mix(mix(key, edge, 0.5), mix(acc, edge, 0.45), p);
      const top = y + p * DEPTH * 0.7;
      g.beginPath(); g.roundRect(x, y + DEPTH, w, h, r); g.fillStyle = css(side); g.fill();
      if (p > 0) { g.shadowColor = css(acc, (st.glow ?? 0.55) * p); g.shadowBlur = st.glow > 0.8 ? 28 : 18; }
      const grad = g.createLinearGradient(0, top, 0, top + h);
      grad.addColorStop(0, css(mix(capC, hi, 0.22))); grad.addColorStop(1, css(capC));
      g.beginPath(); g.roundRect(x, top, w, h, r); g.fillStyle = grad; g.fill();
      g.shadowBlur = 0; g.shadowColor = 'transparent';
      g.beginPath(); g.roundRect(x + 2, top + 2, w - 4, h - 4, Math.max(0, r - 2)); g.strokeStyle = css(hi, 0.28 * (1 - p * 0.5)); g.lineWidth = 1.5; g.stroke();
      if (st.ring) {
        const ring = st.ring === 'accent' ? acc : hexRgb(st.ring);
        g.beginPath(); g.roundRect(x + 1, top + 1, w - 2, h - 2, r); g.strokeStyle = css(mix(ring, acc, p), st.ring === 'accent' ? 0.55 + 0.45 * p : 0.9); g.lineWidth = 2; g.stroke();
      }
      if (label) {
        const n = [...label].length, size = n === 1 ? U * 0.42 : n <= 3 ? U * 0.3 : U * 0.24;
        g.font = this.font(Math.round(size));
        // the theme's own deep or light colour, whichever reads better; plain white/black only if neither does
        let ink = best(capC, [edge, hi]);
        if (contrast(capC, ink) < 2.6) ink = best(capC, [[255, 255, 255], [20, 16, 30]]);
        g.fillStyle = css(ink);
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(label, x + w / 2, top + h / 2 + 1, w - 10);
      }
    }

    draw(s, now = performance.now()) {
      if (!this.c) return;
      const g = this.ctx;
      g.clearRect(0, 0, this.w, this.h);
      if (this.spec.kind === 'keys') {
        for (const e of this.els) this.cap(g, e.x + 3, e.y + 3, e.w - 6, e.h - 6, this.amount(e, s.keys.has(e.c), now), e.label);
        return;
      }
      this.drawMouse(g, s, now);
    }

    drawMouse(g, s, now) {
      const { edge, key, hi, acc } = this.c, { ox, oy, bw, bh } = this.mouse;
      const pOf = (id, down) => this.amount(this.els.find((e) => e.id === id), down, now);
      const p1 = pOf('m1', s.mouse.has(1)), p2 = pOf('m2', s.mouse.has(2)), p3 = pOf('m3', s.mouse.has(3));
      // side buttons, on the left edge
      this.cap(g, PAD - 8, oy + 128, 34, 42, pOf('m5', s.mouse.has(5)), '', 10);
      this.cap(g, PAD - 8, oy + 176, 34, 42, pOf('m4', s.mouse.has(4)), '', 10);
      const body = () => { g.beginPath(); g.roundRect(ox, oy, bw, bh, [96, 96, 110, 110]); };
      // the body's side, then the seams (its darker colour), then the panels clipped to the body's shape
      body(); g.save(); g.translate(0, DEPTH); g.fillStyle = css(mix(key, edge, 0.55)); g.fill(); g.restore();
      body(); g.fillStyle = css(mix(key, edge, 0.4)); g.fill();
      g.save(); body(); g.clip();
      const panel = (x, y, w, h, p) => {
        const c = mix(key, acc, p);
        if (p > 0) { g.shadowColor = css(acc, (this.style.glow ?? 0.55) * p); g.shadowBlur = 18; }
        const grad = g.createLinearGradient(0, y, 0, y + h);
        grad.addColorStop(0, css(mix(c, hi, 0.25))); grad.addColorStop(1, css(c));
        g.fillStyle = grad; g.fillRect(x, y + p * 3, w, h);
        g.shadowBlur = 0; g.shadowColor = 'transparent';
      };
      panel(ox, oy, 93, 128, p1);
      panel(ox + 99, oy, 93, 128, p2);
      panel(ox, oy + 134, bw, bh - 134, 0);
      g.restore();
      body(); g.strokeStyle = css(hi, 0.3); g.lineWidth = 2; g.stroke();
      if (this.style.ring) { body(); g.strokeStyle = css(this.style.ring === 'accent' ? acc : hexRgb(this.style.ring), 0.7); g.stroke(); }
      // the wheel: its well, the wheel (lit when pressed or scrolled), and an arrow for the scroll's direction
      const cx = ox + bw / 2, wheelOn = now - s.wheel.t < 150 && s.wheel.rot;
      g.beginPath(); g.roundRect(cx - 14, oy + 28, 28, 68, 14); g.fillStyle = css(mix(key, edge, 0.6)); g.fill();
      const wc = mix(mix(key, hi, 0.4), acc, Math.max(p3, wheelOn ? 0.8 : 0));
      g.beginPath(); g.roundRect(cx - 9, oy + 34, 18, 56, 9); g.fillStyle = css(wc); g.fill();
      g.strokeStyle = css(mix(wc, edge, 0.35)); g.lineWidth = 2;
      for (let i = 0; i < 5; i++) { const yy = oy + 42 + i * 10 + (wheelOn ? (now / 18) % 10 * Math.sign(s.wheel.rot) : 0) % 10; g.beginPath(); g.moveTo(cx - 6, yy); g.lineTo(cx + 6, yy); g.stroke(); }
      if (wheelOn) {
        const up = s.wheel.rot < 0, ty = up ? oy + 16 : oy + 110;
        g.beginPath(); g.moveTo(cx - 9, ty + (up ? 6 : -6)); g.lineTo(cx + 9, ty + (up ? 6 : -6)); g.lineTo(cx, ty + (up ? -5 : 5)); g.closePath();
        g.fillStyle = css(acc); g.fill();
      }
      // movement: a dot pushed around a ring in the palm
      if (this.spec.move) {
        const m = s.move, my = oy + 210;
        g.beginPath(); g.arc(cx, my, 36, 0, Math.PI * 2); g.strokeStyle = css(mix(key, edge, 0.5)); g.lineWidth = 3; g.stroke();
        const fx = Math.max(-1, Math.min(1, m.vx / 9)), fy = Math.max(-1, Math.min(1, m.vy / 9));
        g.shadowColor = css(acc, 0.7); g.shadowBlur = 12;
        g.beginPath(); g.arc(cx + fx * 26, my + fy * 26, 10, 0, Math.PI * 2); g.fillStyle = css(acc); g.fill();
        g.shadowBlur = 0; g.shadowColor = 'transparent';
      }
    }
  }

  window.IODrawn = { DrawnView };
})();
