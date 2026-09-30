// A pretend chat that plays Chatagram, for the set-up page's live preview, the page's hero and screenshots (play.html?demo=1). Every
// name is made up. Guesses arrive every 1–3 s: mostly words on the board, some repeats, some misses.
(() => {
  const C = (window.Chatagram = window.Chatagram || {});
  // each with a chat colour dark enough to read on the page hero's cream and yellow bubbles
  const PEOPLE = [['PixelPanda', '#c2255c'], ['NeonNacho', '#1864ab'], ['SleepyWaffle', '#9c4a00'], ['GridRunner', '#0b7285'], ['CaptainQuack', '#7b2fbf'],
    ['MossyMoose', '#2b7a0b'], ['ByteSizeBea', '#6f2dbd'], ['TurboTofu', '#1a7f37'], ['LunaLlama', '#a61e4d'], ['WaffleWizard', '#3b5bdb']];
  const NAMES = PEOPLE.map((p) => p[0]);
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
      const s = state(), [name, color] = pick(PEOPLE), platform = platforms[NAMES.indexOf(name) % platforms.length];
      let text = pick(MISSES);
      if (s.phase === 'playing' && s.round) {
        const open = s.round.answers.filter((a) => !a.by), r = rnd();
        if (open.length && r < 0.62) text = pick(open.slice(0, Math.max(3, Math.ceil(open.length * 0.7)))).word;   // shorter words get found first
        else if (r < 0.75) text = pick(s.round.answers).word;
      }
      return { platform, user: name.toLowerCase(), name, text, mod: false, owner: false, color };
    };
    const next = () => { timer = st(() => { say(message()); next(); }, (1000 + rnd() * 2200) / (o.pace || 1)); };
    next();
    return { stop() { ct(timer); }, message };
  }
  C.demo = demo;
  C.demo.NAMES = NAMES;
})();
