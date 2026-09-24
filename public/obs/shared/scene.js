// Behaviour shared by the scene overlays: light trails on the grid, countdown / elapsed timers, the layout
// guide labels, and a glitch on the title when the form changes. Loaded after theme.js.
(() => {
  const $$ = (s) => [...document.querySelectorAll(s)];

  // ---- guide labels: each [data-slot] gets its exact OBS transform written on it -------------------
  // Boxes are measured from the rendered page, so the numbers always match what's drawn.
  function labelSlots() {
    $$('[data-slot]').forEach((el) => {
      const b = el.getBoundingClientRect();
      let label = el.querySelector(':scope > .slot-label');
      if (!label) { label = document.createElement('div'); label.className = 'slot-label'; el.appendChild(label); }
      label.textContent = `${el.dataset.slot}\nX ${Math.round(b.left)}  Y ${Math.round(b.top)}  W ${Math.round(b.width)}  H ${Math.round(b.height)}`;
    });
  }

  // ---- timers ---------------------------------------------------------------------------------------
  // <span data-countdown>: counts down from ?minutes=N (or ?at=HH:MM local time), then shows "any second now".
  // <span data-elapsed>: counts up from when the source became visible (tick "Refresh browser when scene
  // becomes active" in OBS so it restarts each time you switch to the scene).
  const pad = (n) => String(n).padStart(2, '0');
  const fmt = (s) => `${Math.floor(s / 60)}:${pad(Math.floor(s % 60))}`;
  function startTimers() {
    const started = Date.now();
    let end = null;
    const mins = parseFloat(TGL.param('minutes', ''));
    const at = TGL.param('at', '');
    if (mins > 0) end = started + mins * 60000;
    else if (/^\d{1,2}:\d{2}$/.test(at)) {
      const [h, m] = at.split(':').map(Number), d = new Date(); d.setHours(h, m, 0, 0);
      if (d < new Date()) d.setDate(d.getDate() + 1);
      end = d.getTime();
    }
    const tick = () => {
      $$('[data-countdown]').forEach((el) => {
        if (!end) { el.hidden = true; return; }
        const left = Math.max(0, (end - Date.now()) / 1000);
        el.hidden = false;
        el.innerHTML = left > 0 ? `Starting in <em>${fmt(left)}</em>` : '<em>Any second now</em>';
      });
      $$('[data-elapsed]').forEach((el) => { el.innerHTML = `Away for <em>${fmt((Date.now() - started) / 1000)}</em>`; });
    };
    tick(); setInterval(tick, 500);
  }

  // ---- light cycles: riders on the grid that turn at intersections --------------------------------
  // Same idea as the website's background; they fade out under [data-quiet] zones (text) so they never
  // cut through copy. Canvas is capped at 30fps, which is plenty for OBS.
  function trails() {
    const cv = document.getElementById('trails');
    if (!cv || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = cv.getContext('2d'), W = cv.width = 1920, H = cv.height = 1080, CELL = 60;
    const count = +cv.dataset.riders || 6;
    const accent = () => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#22e5ff';
    const hex = (t) => Math.round(Math.max(0, Math.min(1, t)) * 255).toString(16).padStart(2, '0');
    const spawn = (r) => {
      const horiz = Math.random() < .6, fwd = Math.random() < .5;
      r.x = horiz ? (fwd ? -CELL : W + CELL) : Math.floor(Math.random() * W / CELL) * CELL;
      r.y = horiz ? Math.floor(Math.random() * (H - 440) / CELL) * CELL : (fwd ? -CELL : H - 440);
      r.dx = horiz ? (fwd ? 1 : -1) : 0; r.dy = horiz ? 0 : (fwd ? 1 : -1);
      r.speed = 120 + Math.random() * 120; r.left = CELL; r.pts = [[r.x, r.y]]; r.max = CELL * (5 + Math.random() * 5);
      return r;
    };
    const riders = Array.from({ length: count }, (_, i) => spawn({ rival: i === count - 1 }));
    const quiet = () => $$('[data-quiet]').map((el) => el.getBoundingClientRect());
    let zones = quiet(); setInterval(() => (zones = quiet()), 2000);
    let last = performance.now(), acc = 0;
    const frame = (t) => {
      requestAnimationFrame(frame);
      acc += t - last; last = t;
      if (acc < 33) return;                                  // ~30fps
      const dt = Math.min(acc / 1000, .08); acc = 0;
      ctx.clearRect(0, 0, W, H);
      const c = accent();
      for (const r of riders) {
        let move = r.speed * dt;
        while (move > 0) {
          const d = Math.min(move, r.left);
          r.x += r.dx * d; r.y += r.dy * d; r.left -= d; move -= d;
          if (r.left <= 0) { r.left = CELL; if (Math.random() < .25) { r.pts.push([r.x, r.y]); const s = Math.random() < .5 ? 1 : -1; [r.dx, r.dy] = r.dx ? [0, s] : [s, 0]; } }
        }
        const pts = [...r.pts, [r.x, r.y]];
        let len = 0; for (let i = 1; i < pts.length; i++) len += Math.abs(pts[i][0] - pts[i - 1][0]) + Math.abs(pts[i][1] - pts[i - 1][1]);
        while (len > r.max && r.pts.length > 1) { const a = r.pts[0], b = r.pts[1]; len -= Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]); r.pts.shift(); }
        if (r.x < -CELL * 12 || r.x > W + CELL * 12 || r.y < -CELL * 12 || r.y > H) spawn(r);
        const col = r.rival ? '#ff8a3d' : c;
        let run = 0, tot = Math.max(len, 1);
        for (let i = 1; i < pts.length; i++) {
          const a = pts[i - 1], b = pts[i], seg = Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]);
          const g = ctx.createLinearGradient(a[0], a[1], b[0], b[1]);
          g.addColorStop(0, col + hex(run / tot)); g.addColorStop(1, col + hex((run + seg) / tot)); run += seg;
          ctx.strokeStyle = g; ctx.lineCap = 'round';
          ctx.globalAlpha = .22; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
          ctx.globalAlpha = .95; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
        }
        ctx.globalAlpha = 1; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(r.x, r.y, 2.8, 0, 6.3); ctx.fill();
      }
      ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = '#000';
      for (const z of zones) for (const [p, a] of [[50, .4], [26, .5], [6, .7]]) {
        ctx.globalAlpha = a; ctx.beginPath(); ctx.roundRect(z.left - p, z.top - p, z.width + p * 2, z.height + p * 2, 30); ctx.fill();
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    };
    requestAnimationFrame(frame);
  }

  // ---- character art (starting, BRB, ending): cycles the forms with the website's glitch swap ------
  // cyan Tron -> Princess Trina -> the Blobfish, holding each for HOLD ms; the scene colour follows the form
  // on show. The glitch is the hero's: four 60ms steps of horizontal slices mixing the old and new art, with a
  // red/cyan split. ?cycle=0 shows the veadotube form (static) instead, ?art=0 hides the art.
  const ART = { cyan: 'tron-cyan-mclosed-eopen', yellow: 'tron-yellow-mclosed-eopen', red: 'tron-red-mclosed-eopen', princess: 'princess-uwu', blobfish: 'blobfish-mclosed-eopen' };
  const ART_T = { cyan: 'none', yellow: 'none', red: 'none', princess: 'translate(.75%, -1.9%) scale(.937)', blobfish: 'translate(-12.7%, -5.8%) scale(1.18)' };
  const CYCLE = ['cyan', 'princess', 'blobfish'], HOLD = 6000;
  const artSrc = (f) => `assets/forms/${ART[f] || ART.cyan}.webp`;
  const artBox = document.querySelector('.art-stage .art');
  if (TGL.param('art') === '0') document.documentElement.classList.add('no-art');
  if (artBox) {
    const img = artBox.querySelector('img[data-form-art]');
    const glitchEl = document.createElement('div'); glitchEl.className = 'art-glitch'; artBox.appendChild(glitchEl);
    const show = (f) => { img.src = artSrc(f); img.style.transform = ART_T[f]; };
    CYCLE.forEach((f) => { const i = new Image(); i.src = artSrc(f); });          // warm all three
    if (!TGL.cycling) { show(TGL.form); TGL.onChange(show); }
    else {
      const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      let n = 0; TGL.paint(CYCLE[0]); show(CYCLE[0]);
      const step = (ms) => new Promise((r) => setTimeout(r, ms));
      const slices = (from, to, p) => {
        let html = '', y = 0;
        while (y < 100) {
          const h = 10 + Math.random() * 16, f = Math.random() < p ? to : from, dx = (Math.random() - .5) * 30;
          html += `<i style="clip-path:inset(${y.toFixed(1)}% 0 ${Math.max(0, 100 - y - h).toFixed(1)}% 0);transform:translateX(${dx.toFixed(1)}px)"><b style="background-image:url('${artSrc(f)}');transform:${ART_T[f]}"></b></i>`;
          y += h;
        }
        glitchEl.innerHTML = html;
      };
      setInterval(async () => {
        const from = CYCLE[n], to = CYCLE[(n = (n + 1) % CYCLE.length)];
        if (reduced) { TGL.paint(to); show(to); return; }
        artBox.classList.add('glitching');
        for (const [i, p] of [.25, .5, .75, .92].entries()) { if (i === 2) TGL.paint(to); slices(from, to, p); await step(60); }
        show(to);
        await img.decode().catch(() => {});
        artBox.classList.remove('glitching'); glitchEl.innerHTML = '';
      }, HOLD);
    }
  }

  // ---- glitch the title whenever the form changes --------------------------------------------------
  TGL.onChange(() => $$('.glitch').forEach((el) => { el.classList.remove('now'); void el.offsetWidth; el.classList.add('now'); }));

  document.fonts.ready.then(() => { labelSlots(); startTimers(); trails(); });
})();
