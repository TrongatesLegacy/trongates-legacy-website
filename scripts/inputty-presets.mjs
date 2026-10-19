// Builds Inputty's preset library (docs/widgets.md, "Inputty") from input-overlay's presets folder, in a local clone
// of github.com/univrsal/input-overlay (GPL-2.0): converts the textures we ship to lossless WebP in
// public/inputty/presets/ and writes public/inputty/lib/presets.js (every layout inline, so pages need no fetch).
// Presets whose art isn't the contributor's to share (brand product photos, art cleared only for input-overlay,
// assets of unclear origin) are left out. Hand-run, like build-words.mjs; needs cwebp.
//
//   git clone --depth 1 https://github.com/univrsal/input-overlay /tmp/input-overlay
//   node scripts/inputty-presets.mjs /tmp/input-overlay/presets
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SRC = process.argv[2];
if (!SRC || !existsSync(SRC)) throw new Error("pass the path to input-overlay's presets folder");
const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "../public/inputty");
const SHIP = (p) => !["brand", "ask", "unclear"].includes(p.licence);

// licence: ok (drawn by the contributor, GPL-2.0 with the repo), cc0, brand (product photo / brand logo: not usable),
// ask (artist's permission was for input-overlay), unclear (assets of unknown origin), check (not looked at yet)
const v = (name, json, arts) => ({ name, json, arts: arts.map(([n, f]) => ({ name: n, file: f })) });
const CATALOG = [
  // keyboards
  { id: "wasd", group: "Keyboard", name: "WASD", licence: "ok", variants: [
    v("WASD + extras", "wasd/wasd-full.json", [["Outline", "wasd/wasd.png"]]),
    v("Just WASD", "wasd/wasd-minimal.json", [["Outline", "wasd/wasd.png"]]),
    v("Shooter", "wasd/wasd-valorant.json", [["Outline", "wasd/wasd.png"]]),
    v("Shooter, small", "wasd/wasd-valorant-micro.json", [["Outline", "wasd/wasd.png"]]),
    v("With arrows", "wasd/wasd-plus-arrow-keys.json", [["Outline", "wasd/wasd-plus-arrow-keys.png"]]),
    v("French keyboard (ZQSD)", "wasd/zqsd-spoof-minimal.json", [["Outline", "wasd/wasd.png"]]),
    v("Whole left hand", "mouse/alternative/FAT9L/wasd_pink_FAT9L.json", [["Pink", "mouse/alternative/FAT9L/wasdwithblankpink.png"]]),
  ] },
  { id: "wasd-numpad", group: "Keyboard", name: "WASD + number pad", licence: "ok", variants: [
    v("Standard", "wasd-numpad/wasd-numpad.json", [["Standard", "wasd-numpad/wasd-numpad.png"]]) ] },
  { id: "wasd-extended", group: "Keyboard", name: "WASD + number row", licence: "ok", variants: [
    v("With 1 to 5", "wasd-extended-numeric/wasd-extended-numeric.json", [["Standard", "wasd-extended-numeric/wasd-extended-numeric.png"]]),
    v("With 1 to 4, smaller", "wasd-extended-numeric/wasd-extended-numeric-min.json", [["Standard", "wasd-extended-numeric/wasd-extended-numeric.png"]]) ] },
  { id: "yghj", group: "Keyboard", name: "YGHJ (one key right)", licence: "ok", variants: [
    v("Minimal", "yghj/yghj-minimal.json", [["Standard", "yghj/yghj-minimal.png"]]) ] },
  { id: "zqsd", group: "Keyboard", name: "French keyboard (ZQSD)", licence: "ok", variants: [
    v("Minimal", "zqsd-azerty-minimal/zqsd-minimal.json", [["Standard", "zqsd-azerty-minimal/zqsd-minimal.png"]]) ] },
  { id: "qwerty", group: "Keyboard", name: "Full keyboard", licence: "ok", variants: [
    v("Standard", "qwerty/qwerty.json", [["Standard", "qwerty/qwerty.png"]]) ] },
  { id: "qwerty-arrows", group: "Keyboard", name: "Full keyboard + arrows", licence: "ok", variants: [
    v("Standard", "qwerty_arrow_keys/qwerty_arrow_keys.json", [["Standard", "qwerty_arrow_keys/qwerty_arrow_keys.png"]]) ] },
  { id: "qwerty-pixel", group: "Keyboard", name: "Pixel keyboard", licence: "ok", variants: [
    v("Whole keyboard", "qwerty-pixel-with-keypad/qwerty-pixel-with-keypad.json", [["Standard", "qwerty-pixel-with-keypad/qwerty-pixel-with-keypad.png"]]),
    v("Main keys", "qwerty-pixel-with-keypad/qwerty-pixel-left-side.json", [["Standard", "qwerty-pixel-with-keypad/qwerty-pixel-with-keypad.png"]]),
    v("Arrows and number pad", "qwerty-pixel-with-keypad/qwerty-pixel-right-side.json", [["Standard", "qwerty-pixel-with-keypad/qwerty-pixel-with-keypad.png"]]) ] },
  { id: "qwertz", group: "Keyboard", name: "German keyboard (QWERTZ)", licence: "ok", variants: [
    v("Standard", "qwertz_full_size_german/qwertz_full_size_german_2.json", [["Standard", "qwertz_full_size_german/qwertz_full_size_german.png"]]),
    v("Older key mapping", "qwertz_full_size_german/qwertz_full_size_german.json", [["Standard", "qwertz_full_size_german/qwertz_full_size_german.png"]]) ] },
  { id: "gpro", group: "Keyboard", name: "Compact keyboard", licence: "ok", variants: [
    v("Whole keyboard", "gpro/gpro-full.json", [["Standard", "gpro/gpro-full.png"]]),
    v("Gaming keys", "gpro/gpro-wasd.json", [["Standard", "gpro/gpro-full.png"]]),
    v("Gaming keys, one key right", "gpro/gpro-tfgh.json", [["Standard", "gpro/gpro-full.png"]]) ] },
  { id: "sc6", group: "Keyboard", name: "Fighting game keys", licence: "unclear", variants: [
    v("Standard", "sc6_kb/sc6.json", [["Standard", "sc6_kb/sc6.png"]]) ] },
  { id: "history", group: "Keyboard", name: "Key history", licence: "ours", history: true, variants: [
    { name: "Recent keys", json: null, arts: [] } ] },
  // mice
  // the outline mouse: one picture, two choices (side buttons x movement), every combination generated below
  { id: "mouse", group: "Mouse", name: "Mouse", licence: "ok", generate: "mouse", variants: [] },
  { id: "g502x", group: "Mouse", name: "G502 X", licence: "brand", variants: [
    v("Photo", "g502x/g502x.json", [["Black", "g502x/g502x.png"], ["White", "g502x/g502x-white.png"]]),
    v("Outline", "g502x/g502x-outline.json", [["Grey", "g502x/g502x-outline.png"], ["Blue", "g502x/g502x-outline-blue.png"]]) ] },
  { id: "g602", group: "Mouse", name: "G602", licence: "brand", variants: [
    v("Standard", "g602/g602-F.json", [["Standard", "g602/g602-map-1080-f.png"]]) ] },
  { id: "inphic", group: "Mouse", name: "Inphic mice", licence: "brand", variants: [
    v("IN9", "inphic/IN9.json", [["White", "inphic/IN9-white.fw.png"], ["Blue", "inphic/IN9-blue.fw.png"], ["Pro", "inphic/IN9-Pro.fw.png"], ["Ultra", "inphic/IN9-Ultra.fw.png"]]),
    v("IN10", "inphic/IN10.json", [["Black", "inphic/IN10-black.fw.png"], ["White", "inphic/IN10-white.fw.png"]]),
    v("PW1", "inphic/PW1.json", [["Black", "inphic/PW1-black.png"], ["Grey", "inphic/PW1-grey.png"]]),
    v("PW1 colour", "inphic/PW1-color.json", [["Colour", "inphic/PW1-color.png"]]) ] },
  // controllers
  { id: "xbox360", group: "Controller", name: "Xbox 360", licence: "cc0", variants: [
    v("Standard", "xbox-controller/xbox-controller.json", [["Standard", "xbox-controller/xbox-controller.png"], ["Black", "xbox-controller/xbox-controller-black.png"], ["White", "xbox-controller/xbox-controller-white.png"], ["Clear", "xbox-controller/xbox-controller-clear.png"], ["Player number lit", "xbox-controller/xbox-controller-show-player.png"]]) ] },
  { id: "xboxone", group: "Controller", name: "Xbox One", licence: "ok", variants: [
    v("Standard", "xbox-one-controller/xbox-one-controller.json", [["Standard", "xbox-one-controller/xbox-one-controller.png"]]) ] },
  { id: "xbox-min", group: "Controller", name: "Xbox, simple", licence: "check", variants: [
    v("With player number", "Xbox KBA minimal/XBox KBA Minimal 03 GID.json", [["Standard", "Xbox KBA minimal/XBox-KBA.png"]]),
    v("Plain", "Xbox KBA minimal/XBox KBA Minimal 03 GIDless.json", [["Standard", "Xbox KBA minimal/XBox-KBA.png"]]) ] },
  { id: "dualsense", group: "Controller", name: "DualSense (PS5)", licence: "check", variants: [
    v("Standard", "dualsense/dualsense.json", [["Standard", "dualsense/dualsense.png"], ["Black", "dualsense/dualsenseblack.png"], ["White", "dualsense/dualsensewhite.png"]]) ] },
  { id: "ds3", group: "Controller", name: "DualShock 3 (PS3)", licence: "check", variants: [
    v("Standard", "ds3/overlay.json", [["Standard", "ds3/ds3.png"], ["Black", "ds3/ds3_black.png"], ["White", "ds3/ds3_white.png"]]) ] },
  { id: "switch", group: "Controller", name: "Switch Pro controller", licence: "check", variants: [
    v("Standard", "switch-pro-controller/switch-pro-controller.json", [["Classic", "switch-pro-controller/switch-pro-controller-classic.png"], ["Neon", "switch-pro-controller/switch-pro-controller-splatoon2.png"]]) ] },
  // its buttons were numbered for a raw adapter (a=2, b=3, y=4, z=8, start=16); remap to the standard pad's
  { id: "gamecube", group: "Controller", name: "GameCube", licence: "check", remap: { 1: 1, 2: 0, 3: 2, 4: 3, 8: 10, 16: 6 }, variants: [
    v("Standard", "gamecube/gamecube.json", [["Standard", "gamecube/gamecube.png"]]) ] },
  { id: "gamepad", group: "Controller", name: "Any controller", licence: "ok", variants: [
    v("Standard", "gamepad/game-pad.json", [["Standard", "gamepad/game-pad.png"]]) ] },
  { id: "gamesir", group: "Controller", name: "GameSir G7 Pro", licence: "ok", variants: [
    v("Disc d-pad", "gamesir-g7-pro/gamesir-g7-pro.json", ["shadow-ember", "mech-white", "amber-flame", "plum-purple", "metallic-silver"].map((c) => [c.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" "), `gamesir-g7-pro/gamesir-g7-pro-${c}-disc.png`])),
    v("Cross d-pad", "gamesir-g7-pro/gamesir-g7-pro.json", ["shadow-ember", "mech-white", "amber-flame", "plum-purple", "metallic-silver"].map((c) => [c.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" "), `gamesir-g7-pro/gamesir-g7-pro-${c}-cross.png`])),
    v("Disc + cross", "gamesir-g7-pro/gamesir-g7-pro.json", ["shadow-ember", "mech-white", "amber-flame", "plum-purple", "metallic-silver"].map((c) => [c.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" "), `gamesir-g7-pro/gamesir-g7-pro-${c}-disc-cross.png`])) ] },
  { id: "f710", group: "Controller", name: "F710", licence: "brand", variants: [
    v("Standard", "f710/f710-1080.json", [["Standard", "f710/f710-1080-f-3.png"], ["High contrast", "f710/f710-1080-HICON.png"]]) ] },
  // retro
  { id: "nes", group: "Retro", name: "NES", licence: "check", variants: [
    v("Standard", "nes/NES.json", [["Standard", "nes/NES.png"]]) ] },
  { id: "snes", group: "Retro", name: "SNES", licence: "check", variants: [
    v("Standard", "snes/generic-gamepad.json", [["Standard", "snes/SNES.png"], ["Other colours", "snes/SNESAlt.png"]]) ] },
  { id: "nes-pixel", group: "Retro", name: "NES, pixel art", licence: "ask", variants: [
    v("D-pad", "nes-pixel/overlay.json", [["NES", "nes-pixel/nes.png"], ["Famicom", "nes-pixel/famicom.png"]]),
    v("With stick", "nes-pixel/overlay-analog.json", [["NES", "nes-pixel/nes.png"], ["Famicom", "nes-pixel/famicom.png"]]) ] },
  { id: "snes-pixel", group: "Retro", name: "SNES, pixel art", licence: "ask", variants: [
    v("D-pad", "snes-pixel/overlay.json", [["Standard", "snes-pixel/snes.png"]]),
    v("With stick", "snes-pixel/overlay-analog.json", [["Standard", "snes-pixel/snes.png"]]) ] },
  { id: "n64-pixel", group: "Retro", name: "N64, pixel art", licence: "ask", variants: [
    v("Standard", "n64-pixel/overlay.json", [["Standard", "n64-pixel/n64.png"]]) ] },
  { id: "gameboy-pixel", group: "Retro", name: "Game Boy, pixel art", licence: "ask", variants: [
    v("Game Boy", "gameboy-pixel/overlay.json", [["Solid", "gameboy-pixel/gameboy.png"], ["See-through", "gameboy-pixel/gameboy-semitransparent.png"]]),
    v("Game Boy, with stick", "gameboy-pixel/overlay-analog.json", [["Solid", "gameboy-pixel/gameboy.png"], ["See-through", "gameboy-pixel/gameboy-semitransparent.png"]]),
    v("Game Boy Color", "gameboy-pixel/overlay-color.json", [["Solid", "gameboy-pixel/gameboy-color.png"], ["See-through", "gameboy-pixel/gameboy-color-semitransparent.png"]]),
    v("Game Boy Color, with stick", "gameboy-pixel/overlay-color-analog.json", [["Solid", "gameboy-pixel/gameboy-color.png"], ["See-through", "gameboy-pixel/gameboy-color-semitransparent.png"]]) ] },
  // fight sticks
  { id: "hitbox", group: "Fight stick", name: "All-button stick", licence: "ok", variants: [
    v("Standard", "hitbox/hitbox.json", [["Standard", "hitbox/hitbox.png"]]) ] },
  { id: "arcade", group: "Fight stick", name: "Arcade stick", licence: "ok", variants: [
    v("Standard", "arcade-stick/arcade-stick.json", [["Standard", "arcade-stick/arcade-stick.png"]]) ] },
];

// old (pre-5.0) gamepad codes → SDL button index, as input-overlay's own converter does
const OLD_PAD = { 0xec00: 0, 0xec01: 1, 0xec02: 2, 0xec03: 3, 0xec04: 9, 0xec05: 10, 0xec06: 4, 0xec07: 6, 0xec08: 5, 0xec09: 7, 0xec0a: 8, 0xec0b: 13, 0xec0c: 14, 0xec0d: 11, 0xec0e: 12 };


// ---- the outline mouse, generated: side buttons (left, right, both, none) x movement (none, arrow, dot, dot no frame,
// dot with trail, ball). Right-side buttons are the left ones mirrored, so every combination uses the same art.
function mouseVariants() {
  const J = (f) => JSON.parse(readFileSync(join(SRC, f), "utf8")).elements;
  const conv = (e) => { const o = { t: e.type, x: e.pos[0], y: e.pos[1], m: e.mapping, z: e.z_level || 0 };
    if (e.code !== undefined) o.c = e.code; if (e.mouse_radius !== undefined) o.r = e.mouse_radius; if (e.mouse_type !== undefined) o.mt = e.mouse_type; return o; };
  const dot = J("mouse/mouse-dot.json"), arrow = J("mouse/mouse-arrow.json");
  const pick = (els, id) => conv(els.find((e) => e.id === id));
  const body = pick(dot, "body"), lmb = pick(dot, "lmb"), rmb = pick(dot, "rmb"), wheel = pick(dot, "wheel");
  const left = [pick(dot, "smb1"), pick(dot, "smb2")];
  const cx = body.x + body.m[2] / 2;
  const right = left.map((e) => ({ ...e, x: Math.round(2 * cx - (e.x + e.m[2])), f: 1 }));
  const dotEl = pick(dot, "dot");
  const area = (u, v) => ({ t: 0, x: 91, y: 245, m: [u, v, 100, 100], z: 0 });
  const SIDES = [["left", "Left"], ["right", "Right"], ["both", "Both sides"], ["none", "None"]];
  const MOVES = [["none", "None", []], ["arrow", "Arrow", [pick(arrow, "arrow")]], ["dot", "Dot", [area(614, 104), dotEl]],
    ["dotfree", "Dot, no frame", [area(614, 244), dotEl]], ["trail", "Dot with trail", [area(493, 245), dotEl]], ["ball", "Ball", [area(614, 104), dotEl]]];
  const out = [];
  for (const [mk, mn, mv] of MOVES) for (const [sk, sn] of SIDES) {
    const sideEls = sk === "left" ? left : sk === "right" ? right : sk === "both" ? [...left, ...right] : [];
    const art = mk === "ball" ? "mouse/alternative/DJOSH95/mouse - red-boll dot.png" : "mouse/mouse.png";
    // the body's left edge has a notch for the side buttons: build it from two halves, each drawn as is or mirrored
    // from the other side, so a side gets the notch only when it has buttons
    const hw = body.m[2] / 2, [bu, bv, , bh] = body.m;
    const notched = { t: 0, x: body.x, y: body.y, m: [bu, bv, hw, bh], z: 0 };              // left half, with notch
    const plain = { t: 0, x: body.x + hw, y: body.y, m: [bu + hw, bv, hw, bh], z: 0 };      // right half, no notch
    const lhalf = sk === "left" || sk === "both" ? notched : { ...plain, x: body.x, f: 1 };
    const rhalf = sk === "right" || sk === "both" ? { ...notched, x: body.x + hw, f: 1 } : plain;
    const moveEls = mv.map((e) => (e.t === 9 && e.mt === 1 ? { ...e, ax: cx } : e));
    out.push({ name: `${sn} · ${mn}`, opts: { side: sk, move: mk }, layout: { w: 285, h: 421, els: [lhalf, rhalf, ...moveEls.filter((e) => e.t === 0), lmb, rmb, wheel, ...sideEls, ...moveEls.filter((e) => e.t !== 0)] }, pixel: false, arts: [{ name: "Standard", file: art }] });
  }
  // the default (index 0) is left side buttons, no movement
  out.sort((a, b) => (a.opts.side === "left" && a.opts.move === "none" ? -1 : b.opts.side === "left" && b.opts.move === "none" ? 1 : 0));
  return { axes: [{ key: "side", label: "Side buttons", values: SIDES.map(([k, n]) => [k, n]) }, { key: "move", label: "Movement", values: MOVES.map(([k, n]) => [k, n]) }], variants: out };
}

const copied = new Set();
const TEXTURES = {};   // texture name -> { file, layouts using it }
const SHIPPED = CATALOG.filter(SHIP);
for (const p of SHIPPED) {
  if (p.generate === "mouse") { const g = mouseVariants(); p.axes = g.axes; p.variants = g.variants; delete p.generate; }
  for (const variant of p.variants) {
    if (variant.json) {
      const j = JSON.parse(readFileSync(join(SRC, variant.json), "utf8"));
      const els = j.elements.map((e) => {
        const o = { t: e.type, x: e.pos[0], y: e.pos[1], m: e.mapping, z: e.z_level || 0 };
        if (e.code !== undefined) o.c = e.type === 2 && e.code >= 0xec00 ? OLD_PAD[e.code] ?? -1 : e.code;
        if (e.type === 2 && p.remap && p.remap[e.code] !== undefined) o.c = p.remap[e.code];
        if (e.side !== undefined) o.side = e.side;
        if (e.stick_radius !== undefined) o.r = e.stick_radius;
        if (e.mouse_radius !== undefined) o.r = e.mouse_radius;
        if (e.mouse_type !== undefined) o.mt = e.mouse_type;
        if (e.direction !== undefined) o.dir = e.direction;
        if (e.trigger_mode !== undefined) o.tm = !!e.trigger_mode;
        return o;
      });
      variant.layout = { w: j.overlay_width, h: j.overlay_height, els };
      variant.pixel = j.overlay_width < 100;
    }
    for (const a of variant.arts) {
      const name = a.file.replace(/ /g, "-").replace(/\.png$/, "");
      const t = (TEXTURES[name] ??= { file: a.file, layouts: [] });
      t.layouts.push({ w: variant.layout.w, h: variant.layout.h, pixel: variant.pixel });
      a.src = `presets/${name}.webp`;
      a.thumb = `presets/thumbs/${name}.webp`;
      a.tex = name;
      delete a.file;
    }
    delete variant.json;
  }
  delete p.remap;
}

// ---- the pictures: the original kept (artwork/inputty/presets/, not served), a copy shrunk to what the overlay ever
// shows (the overlay draws a layout about 400px tall; 480 leaves room to scale it up in OBS), and a tiny one for the
// set-up's pictures (their cards are at most 360 x 200 pixels, even on a retina screen).
// A texture shared by several layouts is sized for the one that magnifies it most. Each is saved as lossless or as
// high-quality lossy WebP, whichever is smaller (flat line art suits lossless, shaded art lossy). Pixel art: kept as is.
const ORIG = join(HERE, "../artwork/inputty/presets");
const { tmpdir } = await import("node:os");
const { statSync, rmSync } = await import("node:fs");
const size = (f) => statSync(f).size;
function encode(src, dest, width, origW) {
  mkdirSync(dirname(dest), { recursive: true });
  const resize = width < origW ? ["-resize", String(width), "0"] : [];
  const a = join(tmpdir(), "inputty-ll.webp"), b = join(tmpdir(), "inputty-lossy.webp");
  execFileSync("cwebp", ["-quiet", "-lossless", "-m", "6", "-q", "100", ...resize, src, "-o", a]);
  execFileSync("cwebp", ["-quiet", "-q", "82", "-alpha_q", "100", "-sharp_yuv", "-m", "6", ...resize, src, "-o", b]);
  const best = size(a) <= size(b) ? a : b;
  writeFileSync(dest, readFileSync(best));
  rmSync(a); rmSync(b);
  return size(dest);
}
const dims = (f) => { const b = readFileSync(f); return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }; };   // PNG header
let full = 0, thumbs = 0;
const sizeOf = {};
for (const [name, t] of Object.entries(TEXTURES)) {
  const src = join(SRC, t.file);
  mkdirSync(dirname(join(ORIG, name + ".png")), { recursive: true });
  copyFileSync(src, join(ORIG, name + ".png"));
  const { w: W, h: H } = dims(src);
  const pixel = t.layouts.some((l) => l.pixel);
  const sFull = pixel ? 1 : Math.min(1, Math.max(...t.layouts.map((l) => 480 / l.h)));
  const sThumb = pixel ? 1 : Math.min(1, Math.max(...t.layouts.map((l) => Math.min(360 / l.w, 200 / l.h))));
  full += encode(src, join(OUT, "presets", name + ".webp"), Math.max(1, Math.round(W * sFull)), W);
  const t1 = join(OUT, "presets/thumbs", name + ".webp");
  encode(src, t1, Math.max(1, Math.round(W * sThumb)), W);
  // resizing thin line art can make it compress worse: then the set-up just uses the full copy
  if (size(t1) > size(join(OUT, "presets", name + ".webp"))) copyFileSync(join(OUT, "presets", name + ".webp"), t1);
  thumbs += size(t1);
  sizeOf[name] = { aw: W, ah: H };
}
for (const p of SHIPPED) for (const v of p.variants) for (const a of v.arts || []) { Object.assign(a, sizeOf[a.tex]); delete a.tex; }
console.log(`pictures: ${(full / 1e6).toFixed(2)} MB shrunk, ${(thumbs / 1e6).toFixed(2)} MB set-up pictures`);

mkdirSync(join(OUT, "lib"), { recursive: true });
writeFileSync(join(OUT, "lib/presets.js"),
  "// Generated by tools/build-presets.mjs from input-overlay's presets (github.com/univrsal/input-overlay, GPL-2.0 unless noted)\n" +
  "window.IO_PRESETS = " + JSON.stringify(SHIPPED) + ";\n");
console.log(`${SHIPPED.length} presets, ${SHIPPED.reduce((n, p) => n + p.variants.length, 0)} layouts, ${Object.keys(TEXTURES).length} textures`);
