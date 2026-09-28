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
    slots: { type: 'int', def: 40, min: 12, max: 50 },               // most boxes on the board (12 at level 1, +3 a level up to this)
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
    // advanced: chat commands (several names: comma separated) and who can use them. All start "!cg" so they don't clash
    // with other bots (changed from !start… on 2026-09-28: a link that set its own names keeps them)
    cstart: { type: 'list', def: ['!cg start'] },
    cnext: { type: 'list', def: ['!cg next'] },
    cskip: { type: 'list', def: ['!cg skip'] },
    creset: { type: 'list', def: ['!cg reset'] },
    ctop: { type: 'list', def: ['!cg top', '!cg'] },                  // show the leaderboard for a few seconds
    cclear: { type: 'list', def: ['!cg clearscores'] },               // wipe both leaderboards: the broadcaster only
    perm: { type: 'enum', def: 'mods', values: ['me', 'mods', 'all'] },
    lb: { type: 'bool', def: true },                                  // the leaderboard command is on
    // advanced: chat
    wrong: { type: 'bool', def: false },                              // show wrong guesses (right ones light up on the board)
    ignore: { type: 'list', def: ['botrix', 'botrixoficial', 'nightbot', 'streamelements', 'moobot', 'fossabot', 'streamlabs', 'kicklet', 'kickbot', 'sery_bot', 'wizebot', 'missxss'] },
    block: { type: 'list', def: [] },
    top: { type: 'bool', def: true },
    // advanced: other. remember: show the All time leaderboard (it's always recorded; the name is from when this switch
    // decided whether it was kept, so old links still mean the same thing to their streamer)
    remember: { type: 'bool', def: true },
    bgo: { type: 'int', def: 95, min: 50, max: 100 },                // the background's opacity, % (default a hint of the game behind; 100: solid)
    credit: { type: 'bool', def: true },
  };
  const MAIN = ['twitch', 'kick', 'layout', 'theme', 'accent', 'time', 'diff', 'next', 'restart'];
  // full is 16:9, exactly half of 1920 × 1080, so it can fill the whole screen at a clean 2×
  const SIZES = { full: [960, 540], compact: [560, 230] };
  C.settings = { SCHEMA, MAIN, THEMES, SIZES };
})();
