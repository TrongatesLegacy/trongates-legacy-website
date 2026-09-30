// Chaplinko's physics (docs/widgets.md, "Chaplinko: the board"): balls falling through a triangle of pegs into slots.
// Rules and movement only: nothing is drawn here and no timers run. A fixed 120 steps a second; the only randomness is
// when a ball is dropped (its start position and a little sideways speed, from its own seed), so any drop replays
// exactly, and the odds table (odds.js, made by scripts/chaplinko-odds.mjs) can be checked against it. Plain IEEE maths
// only (+, -, *, /, sqrt): the same drop lands in the same slot in every browser.
//
//   const w = Chaplinko.physics.world({ rows: 10 });   w.add({ seed: 7 });   const events = w.step();
//   events: { type: 'hit', ball, peg, speed } | { type: 'land', ball, slot, x }
(() => {
  const K = (window.Chaplinko = window.Chaplinko || {});
  const STEP = 1 / 120;
  const W0 = 640, H0 = 540;
  const G = 1500;                 // px/s². The board's speed setting plays these steps slower or faster instead of changing
                                  // gravity: gravity changed where balls land (chaos), speed doesn't, so one odds table holds
  const BOUNCE = 0.42;            // how much of its speed into a peg a ball keeps, bounced back
  const GRIP = 0.94;              // how much of its speed along a peg a ball keeps
  const VMAX = 900;               // px/s, so a ball never tunnels through a peg

  /** a seeded random number generator (mulberry32) */
  function rng(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  /**
   * the board's shape for a number of rows (8–12) on the 640 × 540 board: pegs, slots, where balls enter. One ball size:
   * smaller balls slip past the edge pegs (the edge slots got far too easy), and more than 12 rows made the edge slots
   * all but impossible (none in 50,000 drops at 14)
   * @param {number} rows
   */
  function layout(rows = 10) {
    rows = Math.max(8, Math.min(12, rows | 0));
    // rows are evenly spaced (dy = 0.85 × gap, near equilateral) at every row count, so a ball falls about as far between
    // rows as it drifts: fewer rows are simply bigger (pegs and balls scale with the gap), never stretched
    const cx = W0 / 2, sy = 430, bottomRow = sy - 22, AR = 0.85;
    const gap = Math.min(64, 580 / (rows + 1), (bottomRow - 72) / ((rows - 1) * AR)), dy = gap * AR, k = gap / 46;
    const top = bottomRow - (rows - 1) * dy;
    // the ball is big next to the gap (like a real Plinko chip), so it meets a peg on nearly every row: that's what makes
    // the landings a bell, with the edge slots rare (about 1 in 1,000 each at 10 rows, the same as a fair coin per row)
    const pegR = 6 * k, ballR = 15 * k;
    const pegs = [];
    for (let r = 0; r < rows; r++) { const n = r + 3; for (let i = 0; i < n; i++) pegs.push({ x: cx + (i - (n - 1) / 2) * gap, y: top + r * dy, r: pegR, row: r, i }); }
    const n = rows + 1, x0 = cx - (n * gap) / 2;
    // no walls: a ball bounced out past the edge pegs (rare) falls into the edge slot, as on a real board. Walls along
    // the triangle were tried: balls rode them down into the edge slots.
    const walls = [];
    return { W: W0, H: H0, rows, cx, top, dy, gap, pegR, ballR, pegs, walls, slots: { n, x0, w: gap, y: sy, h: 44 }, spawnY: Math.max(16, top - 1.6 * dy) };
  }

  /** the slot a ball at x falls into */
  const slotAt = (L, x) => Math.max(0, Math.min(L.slots.n - 1, Math.floor((x - L.slots.x0) / L.slots.w)));

  /**
   * @param {{ rows?: number, collide?: boolean }} o
   */
  function world(o = {}) {
    const L = layout(o.rows);
    const g = G;
    // pegs by row, for finding the few a ball could touch
    const byRow = []; for (const p of L.pegs) (byRow[p.row] = byRow[p.row] || []).push(p);
    let balls = [], ids = 0, t = 0;
    const self = { layout: L, collide: o.collide !== false, get balls() { return balls; }, get time() { return t; } };

    /** drop a ball: seed decides where it starts; data rides along (who dropped it, its colour or emote) */
    self.add = (d = {}) => {
      const rand = rng(d.seed == null ? (Math.random() * 4294967296) >>> 0 : d.seed);
      const m = d.mirror ? -1 : 1;                    // mirror: the same drop flipped left to right (the fairness test)
      const b = { id: ++ids, x: L.cx + m * (rand() - 0.5) * L.gap * 0.6, y: L.spawnY, vx: m * (rand() - 0.5) * 40, vy: 20, r: L.ballR, born: t, still: 0, spin: 0, angle: 0, data: d.data, seed: d.seed };
      balls.push(b);
      return b;
    };
    self.remove = (b) => { balls = balls.filter((x) => x !== b); };
    self.clear = () => { const was = balls; balls = []; return was; };

    function hitCircle(b, cx, cy, cr, events, peg) {
      const dx = b.x - cx, dy = b.y - cy, min = b.r + cr, d2 = dx * dx + dy * dy;
      if (d2 >= min * min || d2 === 0) return false;
      const d = Math.sqrt(d2), nx = dx / d, ny = dy / d;
      b.x = cx + nx * min; b.y = cy + ny * min;                                   // out of the peg
      const vn = b.vx * nx + b.vy * ny;
      if (vn < 0) {
        const tx = -ny, ty = nx, vt = b.vx * tx + b.vy * ty;
        b.vx = tx * vt * GRIP - nx * vn * BOUNCE; b.vy = ty * vt * GRIP - ny * vn * BOUNCE;
        b.spin = vt / b.r;
        if (peg && -vn > 60) events.push({ type: 'hit', ball: b, peg, speed: -vn });
      }
      return true;
    }
    function hitWall(b, [x1, y1, x2, y2]) {
      const ex = x2 - x1, ey = y2 - y1, len2 = ex * ex + ey * ey;
      let u = ((b.x - x1) * ex + (b.y - y1) * ey) / len2; u = u < 0 ? 0 : u > 1 ? 1 : u;
      const px = x1 + ex * u, py = y1 + ey * u, dx = b.x - px, dy = b.y - py, d2 = dx * dx + dy * dy;
      if (d2 >= b.r * b.r || d2 === 0) return;
      const d = Math.sqrt(d2), nx = dx / d, ny = dy / d;
      b.x = px + nx * b.r; b.y = py + ny * b.r;
      const vn = b.vx * nx + b.vy * ny;
      if (vn < 0) { const tx = -ny, ty = nx, vt = b.vx * tx + b.vy * ty; b.vx = tx * vt * GRIP - nx * vn * BOUNCE; b.vy = ty * vt * GRIP - ny * vn * BOUNCE; }
    }
    // balls bump each other (off in Frenzy: a flood pours through instead of jamming)
    function collideBalls() {
      const cell = L.ballR * 2.2, grid = new Map();
      for (const b of balls) { const k = Math.floor(b.x / cell) * 4096 + Math.floor(b.y / cell); (grid.get(k) || grid.set(k, []).get(k)).push(b); }
      for (const b of balls) {
        const gx = Math.floor(b.x / cell), gy = Math.floor(b.y / cell);
        for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
          const list = grid.get((gx + i) * 4096 + gy + j); if (!list) continue;
          for (const c of list) {
            if (c.id <= b.id) continue;
            const dx = c.x - b.x, dy = c.y - b.y, min = b.r + c.r, d2 = dx * dx + dy * dy;
            if (d2 >= min * min || d2 === 0) continue;
            const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, push = (min - d) / 2;
            b.x -= nx * push; b.y -= ny * push; c.x += nx * push; c.y += ny * push;
            const rel = (c.vx - b.vx) * nx + (c.vy - b.vy) * ny;
            if (rel < 0) { const j2 = -(1 + BOUNCE) * rel / 2; b.vx -= j2 * nx; b.vy -= j2 * ny; c.vx += j2 * nx; c.vy += j2 * ny; }
          }
        }
      }
    }

    /** one fixed step (1/120 s) @returns {any[]} what happened */
    self.step = () => {
      const events = [], landed = [];
      t += STEP;
      for (const b of balls) {
        b.vy += g * STEP;
        const sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
        if (sp > VMAX) { b.vx *= VMAX / sp; b.vy *= VMAX / sp; }
        b.x += b.vx * STEP; b.y += b.vy * STEP;
        b.angle += b.spin * STEP; b.spin *= 0.995;
        // the pegs it touches, the deepest first (not left to right: that would favour one side)
        const row = Math.round((b.y - L.top) / L.dy), near = [];
        for (let r = row - 1; r <= row + 1; r++) for (const p of byRow[r] || []) {
          const dx = b.x - p.x, dy = b.y - p.y, d2 = dx * dx + dy * dy, min = b.r + p.r;
          if (d2 < min * min) near.push([d2, p]);
        }
        if (near.length > 1) near.sort((a, c) => a[0] - c[0]);
        for (const [, p] of near) hitCircle(b, p.x, p.y, p.r, events, p);
        for (const w of L.walls) hitWall(b, w);
        // resting on a peg (it can happen, rarely): a small push, the same way for the same ball
        b.still = sp < 12 ? b.still + STEP : 0;
        const age = t - b.born;
        if (b.still > 0.4 || (age > 20 && b.still > 0.05)) { b.vx += (b.x < L.cx ? 1 : -1) * 60; b.vy -= 30; b.still = 0; }   // towards the middle: fair either side
        if (b.y >= L.slots.y || age > 30) landed.push(b);                          // in a slot (or put in the nearest after 30 s)
      }
      if (self.collide && balls.length > 1) collideBalls();
      for (const b of landed) { balls = balls.filter((x) => x !== b); events.push({ type: 'land', ball: b, slot: slotAt(L, b.x), x: b.x }); }
      return events;
    };
    return self;
  }

  /** where a single ball dropped with this seed lands (no other balls): the odds script and the tests use this */
  function drop(seed, o = {}) {
    const w = world({ ...o, collide: false });
    w.add({ seed, mirror: o.mirror });
    for (let i = 0; i < 120 * 40; i++) { const e = w.step().find((x) => x.type === 'land'); if (e) return { slot: e.slot, time: w.time }; }
    return { slot: -1, time: w.time };
  }

  K.physics = { world, layout, drop, rng, slotAt, STEP, ROWS: [8, 12] };
})();
