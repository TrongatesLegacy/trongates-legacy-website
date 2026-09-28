// Chatagram's settings: every one the set-up page can change, with its default and range (docs/widgets.md,
// "Chatagram settings"). The link only carries the ones that differ (Widgets.settings), so these defaults are what a
// streamer who changes nothing gets. MAIN are shown on the set-up page; the rest are under Advanced settings.
(() => {
  const C = (window.Chatagram = window.Chatagram || {});
  const THEMES = ['chatagram', 'neutral', 'light', 'neon', 'candy', 'royal', 'deep', 'cozy'];
  /** @type {Record<string, any>} */
  const SCHEMA = {
    twitch: { type: 'str', def: '', maxLen: 25 },
    kick: { type: 'str', def: '', maxLen: 40 },
    kickid: { type: 'int', def: 0, min: 0, max: 1e10 },              // Kick chatroom id, looked up by the set-up page
    layout: { type: 'enum', def: 'full', values: ['full', 'compact'] },
    theme: { type: 'enum', def: 'chatagram', values: THEMES },
    accent: { type: 'color', def: '' },                               // '' = the theme's own
    time: { type: 'int', def: 90, min: 30, max: 300 },                // round length, seconds
    diff: { type: 'enum', def: 'normal', values: ['easy', 'normal', 'hard'] },
    // advanced: rules
    shuffle: { type: 'int', def: 10, min: 0, max: 60 },               // seconds between shuffles, 0 = never
    minlen: { type: 'int', def: 3, min: 3, max: 4 },
    goal: { type: 'int', def: 65, min: 30, max: 100 },                // % of the words
    tricky: { type: 'int', def: 3, min: 0, max: 20 },                 // hidden and fake letters from this level, 0 = never
    longbonus: { type: 'bool', def: true },
    bonus: { type: 'bool', def: true },                               // rarer real words score a little
    // advanced: padlocks (off: people don't know them)
    locks: { type: 'int', def: 0, min: 0, max: 4 },
    lockmsg: { type: 'bool', def: true },                             // show "wait for the padlock"
    // advanced: flow (0 = wait for the command)
    next: { type: 'int', def: 10, min: 0, max: 60 },
    restart: { type: 'int', def: 15, min: 0, max: 120 },
    // advanced: chat commands (several names: comma separated) and who can use them
    cstart: { type: 'list', def: ['!start'] },
    cnext: { type: 'list', def: ['!next'] },
    cskip: { type: 'list', def: ['!skip'] },
    creset: { type: 'list', def: ['!reset'] },
    perm: { type: 'enum', def: 'mods', values: ['me', 'mods', 'all'] },
    // advanced: chat
    wrong: { type: 'bool', def: false },                              // show wrong guesses (right ones light up on the board)
    ignore: { type: 'list', def: ['botrix', 'botrixoficial', 'nightbot', 'streamelements', 'moobot', 'fossabot', 'streamlabs', 'kicklet', 'kickbot', 'sery_bot', 'wizebot'] },
    block: { type: 'list', def: [] },
    top: { type: 'bool', def: true },
    // advanced: other
    remember: { type: 'bool', def: true },
    credit: { type: 'bool', def: true },
  };
  const MAIN = ['twitch', 'kick', 'layout', 'theme', 'accent', 'time', 'diff', 'next', 'restart'];
  // full is 16:9, exactly half of 1920 × 1080, so it can fill the whole screen at a clean 2×
  const SIZES = { full: [960, 540], compact: [560, 230] };
  C.settings = { SCHEMA, MAIN, THEMES, SIZES };
})();
