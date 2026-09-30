// Chaplinko's settings: every one the set-up page can change, with its default and range (docs/widgets.md, "Chaplinko
// settings"). The link only carries the ones that differ (Widgets.settings), so these defaults are what a streamer who
// changes nothing gets. The board's link and the separate leaderboard's link both come from these.
(() => {
  const K = (window.Chaplinko = window.Chaplinko || {});
  const THEMES = ['chatagram', 'chaplinko', 'neutral', 'light', 'neon', 'candy', 'royal', 'deep', 'cozy'];
  const BOTS = ['botrix', 'botrixoficial', 'nightbot', 'streamelements', 'moobot', 'fossabot', 'streamlabs', 'kicklet', 'kickbot', 'sery_bot', 'wizebot', 'missxss'];
  /** @type {Record<string, any>} */
  const SCHEMA = {
    twitch: { type: 'str', def: '', maxLen: 25 },
    kick: { type: 'str', def: '', maxLen: 40 },
    kickid: { type: 'int', def: 0, min: 0, max: 1e10 },               // Kick chatroom id, looked up by the set-up page
    layout: { type: 'enum', def: 'separate', values: ['separate', 'combined'] },   // two sources, or the board with the leaderboard beside it
    side: { type: 'enum', def: 'right', values: ['right', 'left', 'off'] },       // combined: where the leaderboard sits (off: the board alone)
    rows: { type: 'int', def: 10, min: 8, max: 12 },
    theme: { type: 'enum', def: 'chaplinko', values: THEMES },
    accent: { type: 'color', def: '' },                                 // '' = the theme's own
    bgo: { type: 'int', def: 0, min: 0, max: 100 },                    // background, %: 0 = transparent (the default), 100 = solid
    // the leaderboard
    lbshape: { type: 'enum', def: 'panel', values: ['panel', 'strip'] },           // the separate source's shape
    lbn: { type: 'int', def: 5, min: 3, max: 10 },                    // how many players
    lbshow: { type: 'enum', def: 'both', values: ['both', 'stream', 'all'] },      // both: switches between them
    lbevery: { type: 'int', def: 15, min: 5, max: 300 },              // seconds between switches
    lbtheme: { type: 'enum', def: 'same', values: ['same', ...THEMES] },           // the separate leaderboard's own look
    lbaccent: { type: 'color', def: '' },
    lbbgo: { type: 'int', def: 0, min: 0, max: 100 },
    // advanced: the board
    slots: { type: 'str', def: '', maxLen: 120 },                      // slot values, comma separated ('' = the default for the rows)
    bigwin: { type: 'enum', def: 'top', values: ['top', 'top2', 'off'] },          // the big win card: the top slot, the top two, or never
    showcmd: { type: 'bool', def: true },                               // the commands in the drop chute
    color: { type: 'enum', def: 'chat', values: ['chat', 'accent', 'platform', 'rainbow'] },   // ball colour
    balls: { type: 'int', def: 5, min: 1, max: 10 },                  // balls per !drop
    cool: { type: 'int', def: 0, min: 0, max: 300 },                  // seconds a viewer waits between drops (0: none, spam away)
    max: { type: 'int', def: 100, min: 20, max: 200 },                // most balls on the board at once (the rest queue)
    speed: { type: 'enum', def: 'normal', values: ['slow', 'normal', 'fast'] },
    motion: { type: 'enum', def: 'auto', values: ['auto', 'full', 'calm', 'reduce'] },   // calm: fewer effects; reduce: nothing falls
    nearmiss: { type: 'bool', def: true },                             // "so close!" when a ball just misses the top slot
    // advanced: commands (several names: comma separated) and who can use them
    cdrop: { type: 'list', def: ['!drop'] },
    ctop: { type: 'list', def: ['!drop top'] },
    cpause: { type: 'list', def: ['!drop pause'] },
    cresume: { type: 'list', def: ['!drop resume'] },
    cclear: { type: 'list', def: ['!drop clear'] },
    cwipe: { type: 'list', def: ['!drop clearscores'] },             // wipe both leaderboards: the broadcaster only
    perm: { type: 'enum', def: 'mods', values: ['me', 'mods', 'all'] },
    lb: { type: 'bool', def: false },                                  // !drop top: off (the leaderboard is usually on screen)
    ignore: { type: 'list', def: BOTS },
    remember: { type: 'bool', def: true },                             // show All time
    credit: { type: 'bool', def: true },
  };
  // the default slot values for each row count: the edge slots are the rarest (odds.js), so they score the most
  const SLOTS = {
    8: [25, 10, 5, 2, 1, 2, 5, 10, 25],
    9: [50, 15, 5, 2, 1, 1, 2, 5, 15, 50],
    10: [100, 25, 10, 5, 2, 1, 2, 5, 10, 25, 100],
    11: [100, 50, 10, 5, 2, 1, 1, 2, 5, 10, 50, 100],
    12: [250, 50, 20, 10, 5, 2, 1, 2, 5, 10, 20, 50, 250],
  };
  /** the slot values for these settings: the streamer's own list if it fits the rows, otherwise the default */
  function slotValues(cfg) {
    const own = String(cfg.slots || '').split(',').map((x) => x.trim()).filter(Boolean);
    const n = cfg.rows + 1;
    if (own.length === n && own.every((x) => /^\d{1,4}$/.test(x) && +x <= 1000)) return own.map(Number);
    return SLOTS[cfg.rows] || SLOTS[10];
  }
  // what goes in each source's link: the board's, and the separate leaderboard's (which carries its own look as theme=…)
  const LB_KEYS = ['twitch', 'kick', 'theme', 'accent', 'bgo', 'lbshape', 'lbn', 'lbshow', 'lbevery', 'remember', 'credit', 'motion'];
  /** the separate leaderboard's settings: its own look, unless it matches the board */
  const leaderboardSettings = (s) => {
    const own = s.lbtheme !== 'same';
    const out = {}; for (const k of LB_KEYS) out[k] = s[k];
    if (own) Object.assign(out, { theme: s.lbtheme, accent: s.lbaccent, bgo: s.lbbgo });
    return out;
  };
  // sizes: the board, the board with the leaderboard beside it, the separate leaderboard (panel height follows how many)
  const SIZES = { separate: [640, 540], combined: [960, 540], strip: [720, 72], panel: (n) => [300, 100 + 34 * n] };
  const MAIN = ['twitch', 'kick', 'layout', 'side', 'rows', 'theme', 'accent', 'bgo'];
  K.settings = { SCHEMA, SLOTS, THEMES, SIZES, MAIN, LB_KEYS, slotValues, leaderboardSettings };
})();
