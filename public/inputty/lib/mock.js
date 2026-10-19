// Practice runs of the real screens: Windows installing input-overlay, OBS's settings, adding the Browser source.
// Each screen has one thing to click (pulsing); clicking it moves on, so people rehearse the exact clicks before doing
// them for real. "Show me" plays it with a pretend cursor. Wording matches the real windows (input-overlay's own
// dialog strings, Inno Setup's pages, OBS's menus).
(() => {
  const I = () => window.Guide.INSTALLER;
  const win = (title, body, cls = '') => `<div class="mk-win ${cls}"><div class="mk-tb"><span>${title}</span><i>–</i><i>□</i><i class="x">✕</i></div>${body}</div>`;
  const inno = (head, sub, body, btns = ['< Back', 'Next >', 'Cancel'], go = 1) => win('Setup - input-overlay', `
    <div class="mk-inno"><div class="mk-inno-h"><b>${head}</b><small>${sub}</small><span class="mk-inno-logo">⚙</span></div>
    <div class="mk-inno-b">${body}</div>
    <div class="mk-inno-f">${btns.map((b, i) => `<button ${i === go ? 'data-go' : ''} class="${i === go ? 'pri' : ''}">${b}</button>`).join('')}</div></div>`, 'mk-light');
  const obsMenu = (open, items = '', goTools = false) => `<div class="mk-obs-menu">${['File', 'Edit', 'View', 'Docks', 'Profile', 'Scene Collection', 'Tools', 'Help'].map((m) => `<span ${m === open ? 'class="on"' : ''} ${m === 'Tools' && goTools ? 'data-go' : ''}>${m}</span>`).join('')}${items}</div>`;
  const obs = (inner, menu = obsMenu()) => win('OBS 31.1 - Profile: Untitled - Scenes: Untitled', `${menu}<div class="mk-obs">${inner}</div>`, 'mk-obswin');
  const obsBody = (sourcesExtra = '', plusGo = false) => `
    <div class="mk-obs-canvas"><div class="mk-game"></div></div>
    <div class="mk-docks">
      <div class="mk-dock"><h6>Scenes</h6><p class="on">Gaming</p><p>Just chatting</p><div class="mk-dock-f"><b>＋</b><b>－</b></div></div>
      <div class="mk-dock"><h6>Sources</h6><p>Game Capture</p><p>Webcam</p>${sourcesExtra}<div class="mk-dock-f"><b ${plusGo ? 'data-go' : ''}>＋</b><b>－</b><b>⚙</b></div></div>
      <div class="mk-dock"><h6>Audio Mixer</h6><div class="mk-meter"></div><div class="mk-meter"></div></div>
      <div class="mk-dock"><h6>Controls</h6><p class="btn">Start Streaming</p><p class="btn">Start Recording</p><p class="btn">Settings</p></div>
    </div>`;
  const ioDialog = (tab, ticked) => win('input-overlay configuration', `
    <div class="mk-dlg">
      <div class="mk-tabs"><span ${tab === 0 ? 'class="on"' : ''}>Local features</span><span ${tab === 1 ? 'class="on"' : 'data-go'}>WebSocket server</span><span>About</span><span>Event util</span></div>
      <div class="mk-tabbody">${tab === 0 ? `
        <p class="mk-muted">Most of these settings will require a restart!</p>
        <label class="mk-cb on">Enable mouse and keyboard hook</label><label class="mk-cb on">Enable gamepad hook</label>
        <label class="mk-cb">Enable DualSense enhanced mode</label><label class="mk-cb on">Enable Input Overlay Source</label><label class="mk-cb">Enable Input Control</label>` : `
        <div class="mk-row"><label class="mk-cb ${ticked ? 'on' : ''}" ${ticked ? '' : 'data-go'}>Forward and receive events through websocket server with address</label></div>
        <div class="mk-row"><span class="mk-field">0.0.0.0</span><span class="mk-field sm">16899</span></div>
        <label class="mk-cb">Enable logging</label><p class="mk-muted">Local IP of this machine: 192.168.1.23</p>`}
      </div>
      <div class="mk-dlg-f"><button ${tab === 1 && ticked ? 'data-go class="pri"' : ''}>OK</button><button>Cancel</button></div>
    </div>`, 'mk-dialog');

  let G = null;   // the guide of the practice run being acted out (for the link and size)
  const size = () => ({ w: G?.size?.w || 900, h: G?.size?.h || 510 });
  const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  /** type into a pretend box: select what's there (highlighted), then type over it a letter at a time with a caret */
  async function type(box, text, { select = false } = {}) {
    if (!box) return;
    if (still()) { box.textContent = text; return; }
    box.classList.add('mk-typing');
    if (select) { box.innerHTML = `<mark>${box.textContent}</mark>`; await wait(380); }
    for (let n = 1; n <= text.length; n++) { box.textContent = text.slice(0, n); await wait(text.length > 12 ? 45 : 85); }
    await wait(250);
    box.classList.remove('mk-typing');
  }
  /** paste into a pretend box: select it, show Ctrl+V, then the link drops in */
  async function paste(box, text) {
    if (!box) return;
    if (still()) { box.textContent = text; return; }
    box.classList.add('mk-typing');
    box.innerHTML = `<mark>${box.textContent}</mark>`;
    await wait(350);
    const keys = document.createElement('span');
    keys.className = 'mk-keys';
    keys.innerHTML = '<kbd>Ctrl</kbd>+<kbd>V</kbd>';
    box.parentElement.append(keys);
    await wait(550);
    box.textContent = text;
    box.classList.add('mk-pasted');
    await wait(700);
    keys.remove();
    box.classList.remove('mk-typing');
  }

  const FLOWS = {
    install: [
      // today's Chrome (and Edge, Firefox): no download bar at the bottom; a download button at the top right of the
      // toolbar opens a little panel with the file in it
      { say: 'Click the <b>download</b> button at the top right', note: 'Edge and Firefox put it in the same place.',
        phases: [{ say: 'Click the <b>download</b> button at the top right', act: (sc) => { sc.querySelector('.mk-bubble').hidden = false; return wait(350); } },
          { say: 'Click the file to open it' }],
        html: () => `<div class="mk-browser">
          <div class="mk-tabs-b"><span class="mk-tab">Inputty · input display for OBS</span><i>+</i></div>
          <div class="mk-toolbar"><b>‹</b><b>›</b><b>↻</b><span class="mk-omni">trongateslegacy.com/inputty</span><span class="mk-dlbtn" data-go="1"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3v9m-4-4 4 4 4-4M4 15h12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span><b>⋮</b></div>
          <div class="mk-page"><div class="mk-pg-h"></div><div class="mk-pg-l"></div><div class="mk-pg-l s"></div></div>
          <div class="mk-bubble" hidden><p class="mk-bubble-h">Recent download history</p>
            <div class="mk-dlrow" data-go="2"><span class="mk-exe">EXE</span><span><b>${I().file.replace(/-/g, '-<wbr>')}</b><small>${I().size} · Done</small></span></div></div>
        </div>` },
      { say: 'If Windows shows this, click <b>More info</b>', note: "It's free and open source, just not paid-for \"signed\", so Windows doesn't recognise it.", html: () => `<div class="mk-smart"><h4>Windows protected your PC</h4><p>Microsoft Defender SmartScreen prevented an unrecognized app from starting. Running this app might put your PC at risk.</p><a data-go>More info</a><div class="mk-smart-f"><button>Don't run</button></div></div>` },
      { say: 'Then <b>Run anyway</b>', html: () => `<div class="mk-smart"><h4>Windows protected your PC</h4><p>Microsoft Defender SmartScreen prevented an unrecognized app from starting. Running this app might put your PC at risk.</p><p>App: ${I().file}<br>Publisher: Unknown publisher</p><div class="mk-smart-f"><button data-go>Run anyway</button><button>Don't run</button></div></div>` },
      { say: 'Click <b>Yes</b>', html: () => `<div class="mk-uac"><h5>User Account Control</h5><h4>Do you want to allow this app from an unknown publisher to make changes to your device?</h4><p>${I().file}</p><p class="mk-muted">Publisher: Unknown<br>File origin: Hard drive on this computer</p><div class="mk-uac-f"><button data-go class="pri">Yes</button><button>No</button></div></div>` },
      { say: '<b>Next</b>', html: () => inno('License Information', 'Please review the license terms before installing input-overlay', `<div class="mk-memo">GNU GENERAL PUBLIC LICENSE<br>Version 2, June 1991<br><br>Copyright (C) 1989, 1991 Free Software Foundation, Inc.<br>Everyone is permitted to copy and distribute verbatim copies…</div>`) },
      { say: '<b>Next</b>: it has found OBS by itself', html: () => inno('Select Destination Location', 'Where should input-overlay be installed?', `<p>Setup will install input-overlay into the following folder.</p><div class="mk-path">C:\\Program Files\\obs-studio</div><p class="mk-muted">That's your OBS folder. Leave it as it is.</p>`) },
      { say: '<b>Next</b>', html: () => inno('Select Start Menu Folder', "Where should Setup place the program's shortcuts?", `<p>Setup will create the program's shortcuts in the following Start Menu folder.</p><div class="mk-path">input-overlay</div>`) },
      { say: '<b>Install</b>', html: () => inno('Ready to Install', 'Setup is now ready to begin installing input-overlay on your computer.', `<div class="mk-memo">Destination location:<br>&nbsp;&nbsp;C:\\Program Files\\obs-studio<br><br>Start Menu folder:<br>&nbsp;&nbsp;input-overlay</div>`, ['< Back', 'Install', 'Cancel']) },
      { say: '<b>Finish</b>. Installed!', html: () => inno('Completing the input-overlay Setup Wizard', 'Setup has finished installing input-overlay on your computer.', `<p>Click Finish to exit Setup.</p>`, ['Finish'], 0) },
    ],
    obs: [
      { say: 'Open OBS and click <b>Tools</b>', html: () => obs(obsBody(), obsMenu(null, '', true)) },
      { say: 'Click <b>input-overlay settings</b>', note: 'Not "WebSocket Server Settings": that\'s a different one.', html: () => obs(obsBody(), obsMenu('Tools', `<div class="mk-drop" style="left:var(--tools-x)"><p>Auto-Configuration Wizard</p><p>Output Timer</p><p>Scripts</p><p class="dim">WebSocket Server Settings</p><hr><p data-go>input-overlay settings</p></div>`)) },
      { say: 'Click the <b>WebSocket server</b> tab', html: () => ioDialog(0) },
      { say: 'Tick the first box', html: () => ioDialog(1, false) },
      { say: 'Click <b>OK</b>', html: () => ioDialog(1, true) },
      { say: 'Close OBS and open it again', note: 'File → Exit, then start OBS. It only switches on when OBS starts.', html: () => obs(obsBody(), obsMenu('File', `<div class="mk-drop" style="left:0"><p>Show Recordings</p><p>Remux Recordings</p><hr><p>Settings</p><p>Show Settings Folder</p><p>Show Profile Folder</p><hr><p data-go>Exit</p></div>`)) },
    ],
    source: [
      { say: 'In <b>Sources</b>, click <b>＋</b>', html: () => obs(obsBody('', true)) },
      { say: 'Pick <b>Browser</b>', html: () => obs(obsBody() + `<div class="mk-drop up"><p>Application Audio Capture</p><p>Audio Input Capture</p><p>Audio Output Capture</p><p data-go>Browser</p><p>Color Source</p><p>Display Capture</p><p>Game Capture</p><p>Image</p><p>Media Source</p><p>Text (GDI+)</p></div>`) },
      // OBS's own starting values: the name "Browser", its sample URL, 800 × 600. Each step is several clicks (phases):
      // clicking a box acts it out (typing, pasting) and moves the glow to the next thing to click.
      { say: 'Type a name, like <b>Input display</b>', note: 'Any name is fine. It\'s just so you can find it in Sources later.',
        phases: [{ say: 'Type a name, like <b>Input display</b>', act: (sc) => type(sc.querySelector('[data-go="1"]'), 'Input display', { select: true }) },
          { say: 'Click <b>OK</b>' }],
        html: () => win('Create/Select Source', `<div class="mk-dlg"><label class="mk-radio on">Create new</label><span class="mk-field wide mk-input" data-go="1">Browser</span><label class="mk-radio">Add Existing</label><label class="mk-cb on">Make source visible</label><div class="mk-dlg-f"><button data-go="2" class="pri">OK</button><button>Cancel</button></div></div>`, 'mk-dialog') },
      { say: 'Click the <b>URL</b> box and paste your link',
        phases: [
          { say: 'Click the <b>URL</b> box and paste your link (<b>Ctrl+V</b>)', act: (sc, g) => paste(sc.querySelector('[data-go="1"]'), g ? g.url(false) : 'https://www.trongateslegacy.com/…') },
          { say: () => `Set <b>Width</b> to <b>${size().w}</b>`, act: (sc) => type(sc.querySelector('[data-go="2"]'), String(size().w), { select: true }) },
          { say: () => `Set <b>Height</b> to <b>${size().h}</b>`, act: (sc) => type(sc.querySelector('[data-go="3"]'), String(size().h), { select: true }) },
          { say: 'Click <b>OK</b>' }],
        html: () => win("Properties for 'Input display'", `<div class="mk-dlg mk-props"><label class="mk-cb">Local file</label>
          <div class="mk-prop"><span>URL</span><span class="mk-field wide mk-input" data-go="1">https://obsproject.com/browser-source</span></div>
          <div class="mk-prop"><span>Width</span><span class="mk-field sm mk-input" data-go="2">800</span></div>
          <div class="mk-prop"><span>Height</span><span class="mk-field sm mk-input" data-go="3">600</span></div>
          <label class="mk-cb">Use custom frame rate</label><label class="mk-cb">Control audio via OBS</label>
          <div class="mk-dlg-f"><button>Defaults</button><button data-go="4" class="pri">OK</button><button>Cancel</button></div></div>`, 'mk-dialog') },
      { say: "There it is. Drag it where you like. You're live!", html: (g) => obs(`<div class="mk-obs-canvas"><div class="mk-game"></div><iframe class="mk-live" tabindex="-1" src="${g ? g.url(true) : ''}" title="Your input display in OBS"></iframe></div><div class="mk-docks"><div class="mk-dock"><h6>Scenes</h6><p class="on">Gaming</p></div><div class="mk-dock"><h6>Sources</h6><p class="on">Input display</p><p>Game Capture</p><p>Webcam</p></div></div>`), end: true },
    ],
  };

  /** el: where it goes; flow: install | obs | source; g: the guide (for the link and size) */
  function mount(el, flow, g, { onDone } = {}) {
    const steps = FLOWS[flow];
    let i = 0, phase = 0, playing = false, busy = false;
    el.classList.add('mk');
    el.innerHTML = `<div class="mk-say"><span class="mk-n"></span><span class="mk-text"></span></div><div class="mk-stage"><div class="mk-screen"></div><div class="mk-cursor" aria-hidden="true"></div></div><div class="mk-note"></div>
      <div class="mk-bar"><button type="button" class="mk-prev" aria-label="Back">‹</button><div class="mk-dots">${steps.map(() => '<i></i>').join('')}</div><button type="button" class="mk-next" aria-label="Next">›</button><button type="button" class="mk-play">▶ Show me</button></div>`;
    const screen = el.querySelector('.mk-screen'), cursor = el.querySelector('.mk-cursor'), stage = el.querySelector('.mk-stage');
    const fit = () => { el.style.setProperty('--u', stage.clientWidth / 600 + 'px'); };
    new ResizeObserver(fit).observe(el);
    const say = (t) => { el.querySelector('.mk-text').innerHTML = typeof t === 'function' ? t() : t; };
    /** the thing to click now: in a step with phases, data-go="n" for phase n (from 1); otherwise the one [data-go] */
    const target = () => (steps[i].phases ? screen.querySelector(`[data-go="${phase + 1}"]`) : screen.querySelector('[data-go]'));
    function mark() {
      screen.querySelectorAll('.mk-now').forEach((e) => e.classList.remove('mk-now'));
      target()?.classList.add('mk-now');
      if (steps[i].phases) say(steps[i].phases[phase].say);
    }
    function show(n) {
      G = g;
      i = Math.max(0, Math.min(steps.length - 1, n)); phase = 0;
      const st = steps[i];
      screen.innerHTML = st.html(g);
      const tools = screen.querySelector('.mk-obs-menu span:nth-child(7)');
      if (tools) screen.style.setProperty('--tools-x', tools.offsetLeft + 'px');
      el.querySelector('.mk-n').textContent = `${i + 1}/${steps.length}`;
      say(st.say);
      el.querySelector('.mk-note').textContent = st.note || '';
      el.querySelectorAll('.mk-dots i').forEach((d, k) => d.classList.toggle('on', k <= i));
      mark();
      if (st.end) onDone?.();
    }
    /** do the current click: act it out if it has an action, then the next phase, or the next step */
    async function advance() {
      if (busy) return;
      const st = steps[i];
      if (!st.phases) { if (i < steps.length - 1) show(i + 1); return; }
      busy = true;
      G = g;
      screen.querySelector('.mk-now')?.classList.remove('mk-now');
      await st.phases[phase].act?.(screen, g);
      busy = false;
      if (phase < st.phases.length - 1) { phase++; mark(); } else if (i < steps.length - 1) show(i + 1);
    }
    screen.addEventListener('click', (e) => { const t = e.target.closest('[data-go]'); if (t && t === target() && !playing) advance(); });
    el.querySelector('.mk-prev').onclick = () => !busy && show(i - 1);
    el.querySelector('.mk-next').onclick = () => !busy && show(i + 1);
    el.querySelector('.mk-play').onclick = async () => {
      if (playing || busy) return;
      playing = true; show(0);
      cursor.classList.add('on');
      for (let guard = 0; guard < 60; guard++) {
        const t = target();
        if (!t) break;
        // the target's centre in the stage's own coordinates
        // (screen rects, divided by the stage's on-screen scale so a tilted or scaled page still lines up)
        const a = stage.getBoundingClientRect(), b = t.getBoundingClientRect(), k = a.width / stage.offsetWidth || 1;
        const x = (b.left - a.left + b.width / 2) / k, y = (b.top - a.top + b.height / 2) / k;
        cursor.style.transform = `translate(${x}px, ${y}px)`;
        await wait(900);
        t.classList.add('mk-press');
        await wait(220);
        t.classList.remove('mk-press');
        const last = i === steps.length - 1;
        await advance();
        if (last) break;
        await wait(450);
      }
      cursor.classList.remove('on');
      playing = false;
    };
    show(0); fit();
    return { show, get step() { return i; } };
  }

  window.Mock = { mount, FLOWS };
})();
