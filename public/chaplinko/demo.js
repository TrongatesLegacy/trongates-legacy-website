// A pretend chat that plays Chaplinko, for the set-up page's preview, the page's hero and screenshots (play.html?demo=1).
// Every name is made up. Mostly a !drop every second or two, now and then with an emoji; every so often a burst of
// everyone at once (a raid), so the preview shows the board going into Frenzy.
(() => {
  const K = (window.Chaplinko = window.Chaplinko || {});
  const PEOPLE = [['PixelPanda', '#ff4f9a'], ['NeonNacho', '#1e90ff'], ['SleepyWaffle', '#ffb000'], ['GridRunner', '#2ee6a8'], ['CaptainQuack', '#b36bff'],
    ['MossyMoose', '#7ed957'], ['ByteSizeBea', '#ff6a3d'], ['TurboTofu', '#00c2d1'], ['LunaLlama', '#ff9ecb'], ['WaffleWizard', ''], ['KevXD', '#ffd23f'], ['Sprout', '#5ad1ff']];
  const EMOJI = ['🔥', '😂', '💜', '🐸', '⭐', '🍕', '👑', '💀'];

  /**
   * @param {(m: any) => void} say  where messages go
   * @param {{ platforms: string[], cmd?: string, random?: () => number, setTimeout?: Function, clearTimeout?: Function, pace?: number, bursts?: boolean }} o
   */
  function demo(say, o) {
    const rnd = o.random || Math.random, st = o.setTimeout || setTimeout, ct = o.clearTimeout || clearTimeout;
    const platforms = o.platforms.length ? o.platforms : ['twitch', 'kick'];
    const cmd = o.cmd || '!drop';
    let timer = null, n = 0, burst = 0;
    const message = () => {
      const i = Math.floor(rnd() * PEOPLE.length), [name, color] = PEOPLE[i], r = rnd();
      const text = r < 0.25 ? `${cmd} ${EMOJI[Math.floor(rnd() * EMOJI.length)]}` : r < 0.3 ? 'gg' : cmd;
      return { platform: platforms[i % platforms.length], user: name.toLowerCase(), name, text, mod: false, owner: false, color, emotes: [] };
    };
    const next = () => {
      n++;
      if (o.bursts !== false && n % 45 === 0) burst = 26;           // every so often, everyone at once
      const wait = burst > 0 ? (burst--, 90 + rnd() * 120) : 700 + rnd() * 1600;
      timer = st(() => { say(message()); next(); }, wait / (o.pace || 1));
    };
    next();
    return { stop() { ct(timer); }, message };
  }
  K.demo = demo;
  K.demo.PEOPLE = PEOPLE;
})();
