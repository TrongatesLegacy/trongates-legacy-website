// Draws one input-overlay preset (its layout + texture atlas) on a canvas, the way the plugin does: every element has
// a rectangle on the atlas, and its pressed look sits 3px below it (or, for d-pads, wheels and player lights, in a row
// to its right). Themes recolour the atlas once: each pixel's brightness is mapped onto the theme's key colours, and
// the parts of a pressed look that differ from the resting look onto the accent, so any preset takes any theme.
(() => {
  const GAP = 3;
  const T = { TEXTURE: 0, KEY: 1, PAD_BUTTON: 2, MOUSE_BUTTON: 3, WHEEL: 4, STICK: 5, TRIGGER: 6, PLAYER: 7, DPAD: 8, MOVEMENT: 9 };
  const { SDL } = window.IOCodes;

  const imageCache = new Map();
  // preset textures live in /inputty/presets/ (window.IO_BASE can point elsewhere, e.g. for a test)
  function loadImage(src) {
    if (!/^(https?:|\/|data:)/.test(src)) src = (window.IO_BASE ?? '/inputty/') + src;
    if (!imageCache.has(src)) {
      imageCache.set(src, new Promise((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = src;
      }));
    }
    return imageCache.get(src);
  }

  // ---- colour helpers ----
  const hexRgb = (h) => { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };
  const mix = (a, b, t) => [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t));
  const rgbHex = (c) => c.map((v) => v.toString(16).padStart(2, '0')).join('');
  // a 256-entry lookup from brightness to colour, through the given stops [[at, rgb], ...]
  function ramp(stops) {
    const lut = new Uint8ClampedArray(256 * 3);
    for (let l = 0; l < 256; l++) {
      const t = l / 255;
      let i = 0;
      while (i < stops.length - 2 && t > stops[i + 1][0]) i++;
      const [t0, c0] = stops[i], [t1, c1] = stops[i + 1];
      const c = mix(c0, c1, Math.min(1, Math.max(0, (t - t0) / (t1 - t0 || 1))));
      lut.set(c, l * 3);
    }
    return lut;
  }
  /** look: { edge, key, hi, accent } as hex → the two lookups */
  function luts(look) {
    const edge = hexRgb(look.edge), key = hexRgb(look.key), hi = hexRgb(look.hi), acc = hexRgb(look.accent);
    return {
      base: ramp([[0, edge], [0.5, key], [1, hi]]),
      accent: ramp([[0, mix(acc, edge, 0.55)], [0.35, acc], [0.94, acc], [1, mix(acc, [255, 255, 255], 0.55)]]),
    };
  }

  class PresetView {
    /** @param {{ w:number, h:number, els:any[] }} layout @param {string} artSrc
     *  aw: the width the layout's numbers were measured on. The file can be smaller (the site ships shrunk copies, and
     *  tiny ones for the set-up's pictures); every crop is scaled by file width / aw, so no number changes */
    constructor(layout, artSrc, { pixel = false, aw = 0 } = {}) {
      this.layout = layout;
      this.artSrc = artSrc;
      this.aw = aw;
      this.pixel = pixel;
      this.els = [...layout.els].sort((a, b) => a.z - b.z);
      // the movement arrow's own numbers put it ~17px right of the mouse's middle (in input-overlay too): centre it
      // across the mouse body it sits on, as the movement-dot styles centre their circle
      for (const e of this.els) {
        if (e.t !== T.MOVEMENT || e.mt !== 1) continue;
        const cx = e.x - e.m[2] / 2, cy = e.y + e.m[3] / 2;
        const body = this.els.filter((b) => b.t === T.TEXTURE && cx >= b.x && cx <= b.x + b.m[2] && cy >= b.y && cy <= b.y + b.m[3])
          .sort((a, b) => b.m[2] * b.m[3] - a.m[2] * a.m[3])[0];
        if (body && e.ax === undefined) e.ax = body.x + body.m[2] / 2;
      }
      // pixel-art presets are tiny (12×19): draw them at a whole-number scale with no smoothing
      this.scale = pixel ? Math.max(1, Math.round(320 / layout.h)) : 1;
      this.canvas = document.createElement('canvas');
      this.canvas.width = layout.w * this.scale;
      this.canvas.height = layout.h * this.scale;
      this.ctx = this.canvas.getContext('2d');
      this.atlas = null;     // what we draw from: the art as is, or recoloured
      this.look = null;
      this.lookKey = '';
    }

    async load() {
      this.img = await loadImage(this.artSrc);
      this.atlas = this.img;
      this.k = this.aw ? this.img.width / this.aw : 1;
      return this;
    }

    /** the atlas pixels that belong to a pressed look and differ from the resting look (1 = accent) */
    pressedMask() {
      if (this._mask) return this._mask;
      const { width: W, height: H } = this.img;
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(this.img, 0, 0);
      const px = g.getImageData(0, 0, W, H).data;
      const mask = new Uint8Array(W * H);
      const k = this.k || 1, R = Math.round;
      const mark = (pu, pv, bu, bv, w, h, full) => {
        pu = R(pu * k); pv = R(pv * k); bu = R(bu * k); bv = R(bv * k); w = R(w * k); h = R(h * k);
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const px1 = pu + x, py1 = pv + y, px0 = bu + x, py0 = bv + y;
            if (px1 < 0 || py1 < 0 || px1 >= W || py1 >= H) continue;
            const i = (py1 * W + px1) * 4;
            if (px[i + 3] < 8) continue;
            if (full || px0 >= W || py0 >= H) { mask[py1 * W + px1] = 1; continue; }
            const j = (py0 * W + px0) * 4;
            const d = Math.abs(px[i] - px[j]) + Math.abs(px[i + 1] - px[j + 1]) + Math.abs(px[i + 2] - px[j + 2]) + Math.abs(px[i + 3] - px[j + 3]);
            if (d > 48) mask[py1 * W + px1] = 1;
          }
        }
      };
      const sat = (i) => { const mx = Math.max(px[i], px[i + 1], px[i + 2]), mn = Math.min(px[i], px[i + 1], px[i + 2]); return mx ? (mx - mn) / mx : 0; };
      const moving = (u, v, w, h) => {
        const gap = R(GAP * k); u = R(u * k); v = R(v * k); w = R(w * k); h = R(h * k);
        let changed = 0, opaque = 0;
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          const a = ((v + y) * W + u + x) * 4, b = ((v + y) * W + u + w + gap + x) * 4;
          if (px[a + 3] < 8 && px[b + 3] < 8) continue;
          opaque++;
          if (Math.abs(px[a + 3] - px[b + 3]) + Math.abs(px[a] - px[b]) > 60) changed++;
        }
        return opaque && changed / opaque > 0.3;
      };
      const markColoured = (u, v, w, h) => {
        u = R(u * k); v = R(v * k); w = R(w * k); h = R(h * k);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          const i = ((v + y) * W + u + x) * 4;
          if (u + x < W && v + y < H && px[i + 3] > 8 && sat(i) > 0.35) mask[(v + y) * W + u + x] = 1;
        }
      };
      for (const e of this.els) {
        const [u, v, w, h] = e.m;
        if ([T.KEY, T.PAD_BUTTON, T.MOUSE_BUTTON, T.STICK, T.TRIGGER].includes(e.t)) mark(u, v + h + GAP, u, v, w, h);
        else if (e.t === T.DPAD) {
          // a d-pad whose frames move the whole picture (the arcade stick's ball) isn't a highlight: there, the
          // strongly coloured part (the ball) takes the accent in every frame, and the rest stays the key colour
          if (moving(u, v, w, h)) for (let k = 0; k <= 8; k++) markColoured(u + k * (w + GAP), v, w, h);
          else for (let k = 1; k <= 8; k++) mark(u + k * (w + GAP), v, u, v, w, h);
        }
        else if (e.t === T.WHEEL) for (let k = 1; k <= 3; k++) mark(u + k * (w + GAP), v, u, v, w, h);
        else if (e.t === T.PLAYER) mark(u + 4 * (w + GAP), v, u, v, w, h, true);
        else if (e.t === T.MOVEMENT) mark(u, v, u, v, w, h, true);
      }
      this._mask = { mask, px, W, H };
      return this._mask;
    }

    /** the art's brightness range (2nd–98th percentile of solid pixels) and whether it's mostly light line art */
    levels() {
      if (this._levels) return this._levels;
      const { px, mask } = this.pressedMask();
      const hist = new Uint32Array(256);
      let n = 0, sum = 0, rest = 0, restSum = 0;
      for (let i = 0, p = 0; i < px.length; i += 4, p++) {
        if (px[i + 3] < 128) continue;
        const l = (px[i] * 77 + px[i + 1] * 150 + px[i + 2] * 29) >> 8;
        hist[l]++; n++; sum += l;
        // "light line art" is judged on the resting look only (pressed sprites are often filled and darker)
        if (!mask[p]) { rest++; restSum += l; }
      }
      const at = (q) => { let c = 0; for (let l = 0; l < 256; l++) { c += hist[l]; if (c >= q * n) return l; } return 255; };
      let lo = at(0.02), hi = at(0.98);
      if (hi - lo < 40) { lo = Math.max(0, lo - 20); hi = Math.min(255, hi + 20); }
      return (this._levels = { lo, hi, light: rest > 0 ? restSum / rest > 185 : n > 0 && sum / n > 185 });
    }

    /** look: null (the art's own colours) or { edge, key, hi, accent } */
    setLook(look) {
      const k = look ? [look.edge, look.key, look.hi, look.accent, look.lightBg].join() : 'orig';
      if (k === this.lookKey) return;
      this.lookKey = k;
      if (!look) { this.atlas = this.img; return; }
      const { mask, px, W, H } = this.pressedMask();
      let { base, accent } = luts(look);
      const { lo, hi, light } = this.levels();
      // light line art (white outlines) on a light theme would vanish: draw it dark instead
      const flip = light && look.lightBg;
      // light line art on dark: lines take the theme's key colour (not its near-white shine), so the theme shows
      if (light && !flip) {
        base = luts({ ...look, hi: rgbHex(mix(hexRgb(look.key), hexRgb(look.hi), 0.3)) }).base;
      }
      const out = new ImageData(W, H);
      const o = out.data;
      for (let p = 0, i = 0; p < W * H; p++, i += 4) {
        const a = px[i + 3];
        if (!a) continue;
        // stretch the art's own brightness range to the full ramp, so dark photos and faint art still read
        let l = (px[i] * 77 + px[i + 1] * 150 + px[i + 2] * 29) >> 8;
        l = Math.max(0, Math.min(255, Math.round(((l - lo) * 255) / (hi - lo || 1))));
        if (flip && !mask[p]) l = 255 - l;
        const lut = mask[p] ? accent : base;
        o[i] = lut[l * 3]; o[i + 1] = lut[l * 3 + 1]; o[i + 2] = lut[l * 3 + 2];
        // some presets draw the pressed look see-through, which muddies the accent: make it near-solid
        o[i + 3] = mask[p] && a > 40 ? Math.max(a, 235) : a;
      }
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      c.getContext('2d').putImageData(out, 0, 0);
      this.atlas = c;
    }

    crop(u, v, w, h, x, y, dw = w, dh = h) {
      if (w <= 0 || h <= 0) return;
      const k = this.k || 1;
      this.ctx.drawImage(this.atlas, u * k, v * k, w * k, h * k, x, y, dw, dh);
    }

    /** the centre of an element, as a fraction of the view (for sparkles) */
    centre(e) { return [(e.x + e.m[2] / 2) / this.layout.w, (e.y + e.m[3] / 2) / this.layout.h]; }

    /** which elements show this input (for sparkles) */
    elementsFor(ev) {
      return this.els.filter((e) => (ev.kind === 'key' && e.t === T.KEY && e.c === ev.code)
        || (ev.kind === 'mouse' && ((e.t === T.MOUSE_BUTTON && e.c === ev.code) || (e.t === T.WHEEL && ev.code === 3)))
        || (ev.kind === 'pad' && ((e.t === T.PAD_BUTTON && e.c === ev.code) || (e.t === T.DPAD && ev.code >= 11 && ev.code <= 14)
          || (e.t === T.STICK && ev.code === (e.side ? SDL.RIGHT_STICK : SDL.LEFT_STICK)))));
    }

    draw(s, now = performance.now()) {
      if (!this.atlas) return;
      const g = this.ctx;
      g.setTransform(this.scale, 0, 0, this.scale, 0, 0);
      g.imageSmoothingEnabled = !this.pixel;
      g.clearRect(0, 0, this.layout.w, this.layout.h);
      const pad = s.pad, ax = pad.axes;
      for (const e of this.els) {
        const [u, v, w, h] = e.m;
        switch (e.t) {
          case T.TEXTURE:
            if (e.f) { g.save(); g.translate(e.x * 2 + w, 0); g.scale(-1, 1); }
            this.crop(u, v, w, h, e.x, e.y);
            if (e.f) g.restore();
            break;
          case T.KEY: case T.MOUSE_BUTTON: case T.PAD_BUTTON: {
            const down = e.t === T.KEY ? s.keys.has(e.c) : e.t === T.MOUSE_BUTTON ? s.mouse.has(e.c) : !!pad.buttons[e.c];
            // f: a mirrored copy (the outline mouse's right-hand side buttons are its left ones, flipped)
            if (e.f) { g.save(); g.translate(e.x * 2 + w, 0); g.scale(-1, 1); }
            this.crop(u, down ? v + h + GAP : v, w, h, e.x, e.y);
            if (e.f) g.restore();
            break;
          }
          case T.WHEEL: {
            const k = s.mouse.has(3) ? 1 : 0;
            this.crop(u + k * (w + GAP), v, w, h, e.x, e.y);
            if (now - s.wheel.t < 150 && s.wheel.rot) this.crop(u + (s.wheel.rot > 0 ? 2 : 3) * (w + GAP), v, w, h, e.x, e.y);
            break;
          }
          case T.STICK: {
            const r = e.r || 0, [ix, iy] = e.side ? [2, 3] : [0, 1];
            const down = !!pad.buttons[e.side ? SDL.RIGHT_STICK : SDL.LEFT_STICK];
            this.crop(u, down ? v + h + GAP : v, w, h, e.x + ax[ix] * r, e.y + ax[iy] * r);
            break;
          }
          case T.TRIGGER: {
            const p = Math.min(1, Math.max(0, ax[e.side ? 5 : 4] || 0));
            if (e.tm) { this.crop(u, p >= 0.1 ? v + h + GAP : v, w, h, e.x, e.y); break; }
            this.crop(u, v, w, h, e.x, e.y);
            const pv = v + h + GAP;
            if (e.dir === 1) { const c = Math.round(h * p); this.crop(u, pv + h - c, w, c, e.x, e.y + h - c); }
            else if (e.dir === 2) { const c = Math.round(h * p); this.crop(u, pv, w, c, e.x, e.y); }
            else if (e.dir === 3) { const c = Math.round(w * p); this.crop(u + w - c, pv, c, h, e.x + w - c, e.y); }
            else if (e.dir === 4) { const c = Math.round(w * p); this.crop(u, pv, c, h, e.x, e.y); }
            break;
          }
          case T.PLAYER: {
            if (!pad.connected) break;
            if (pad.buttons[SDL.GUIDE]) this.crop(u + 4 * (w + GAP), v, w, h, e.x, e.y);
            this.crop(u + (Math.min(pad.index, 2) + 1) * (w + GAP), v, w, h, e.x, e.y);
            break;
          }
          case T.DPAD: {
            const b = pad.buttons, up = b[SDL.DPAD_UP], dn = b[SDL.DPAD_DOWN], lf = b[SDL.DPAD_LEFT], rt = b[SDL.DPAD_RIGHT];
            // 0 rest, then left, right, up, down, up-left, up-right, down-left, down-right
            const k = up ? (lf ? 5 : rt ? 6 : 3) : dn ? (lf ? 7 : rt ? 8 : 4) : rt ? 2 : lf ? 1 : 0;
            this.crop(u + k * (w + GAP), v, w, h, e.x, e.y);
            break;
          }
          case T.MOVEMENT: {
            const m = s.move;
            if (e.mt === 1) {
              g.save();
              // input-overlay turns the arrow round (x - w/2, y + h/2), not its box's middle; presets are placed for that
              g.translate(e.ax ?? e.x - w / 2, e.y + h / 2);
              g.rotate(m.angle);
              this.crop(u, v, w, h, -w / 2, -h / 2);
              g.restore();
            } else {
              const r = e.r || 0, sens = 9;
              const fx = Math.max(-1, Math.min(1, m.vx / sens)), fy = Math.max(-1, Math.min(1, m.vy / sens));
              this.crop(u, v, w, h, e.x + r * fx, e.y + r * fy);
            }
            break;
          }
        }
      }
    }
  }

  window.IORender = { PresetView, loadImage, luts, hexRgb, mix, T };
})();
