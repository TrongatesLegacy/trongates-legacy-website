// A pretend chat that plays Chatagram, for the set-up page's live preview and screenshots (play.html?demo=1). Every
// name is made up. Guesses arrive every 1–3 s: mostly words on the board, some repeats, some misses.
(() => {
  const C = (window.Chatagram = window.Chatagram || {});
  const NAMES = ['PixelPanda', 'NeonNacho', 'SleepyWaffle', 'GridRunner', 'CaptainQuack', 'MossyMoose', 'ByteSizeBea', 'TurboTofu', 'LunaLlama', 'WaffleWizard'];
  const MISSES = ['lol', 'gg', 'hello', 'nice', 'pog', 'hype', 'omg'];

  /**
   * @param {() => any} state  the game's state  @param {(m: any) => void} say  where messages go
   * @param {{ platforms: string[], random?: () => number, setTimeout?: Function, clearTimeout?: Function, pace?: number }} o
   */
  function demo(state, say, o) {
    const rnd = o.random || Math.random, st = o.setTimeout || setTimeout, ct = o.clearTimeout || clearTimeout;
    const pick = (xs) => xs[Math.floor(rnd() * xs.length)];
    const platforms = o.platforms.length ? o.platforms : ['twitch', 'kick'];
    let timer = null;
    const message = () => {
      const s = state(), name = pick(NAMES), platform = platforms[NAMES.indexOf(name) % platforms.length];
      let text = pick(MISSES);
      if (s.phase === 'playing' && s.round) {
        const open = s.round.answers.filter((a) => !a.by), r = rnd();
        if (open.length && r < 0.62) text = pick(open.slice(0, Math.max(3, Math.ceil(open.length * 0.7)))).word;   // shorter words get found first
        else if (r < 0.75) text = pick(s.round.answers).word;
      }
      return { platform, user: name.toLowerCase(), name, text, mod: false, owner: false };
    };
    const next = () => { timer = st(() => { say(message()); next(); }, (1000 + rnd() * 2200) / (o.pace || 1)); };
    next();
    return { stop() { ct(timer); }, message };
  }
  C.demo = demo;
  C.demo.NAMES = NAMES;
})();
