// Chaplinko's settings: every one the set-up page can change, with its default and range (docs/widgets.md, "Chaplinko
// settings"). The link only carries the ones that differ (Widgets.settings), so these defaults are what a streamer who
// changes nothing gets. The board's link and the separate leaderboard's link both come from these.
(() => {
  const K = (window.Chaplinko = window.Chaplinko || {});
  // every widget theme but Chatagram's own brand (the owner, 2026-09-30)
  const THEMES = ['chaplinko', 'neutral', 'light', 'neon', 'candy', 'royal', 'deep', 'cozy'];
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
    lbbgo: { type: 'int', def: 0, min: 0, max: 100 },               // the leaderboard's own background, always (0: transparent)
    // advanced: the board
    bigwin: { type: 'enum', def: 'top', values: ['top', 'top2', 'off'] },          // the big win card: the top slot, the top two, or never
    showcmd: { type: 'bool', def: false },
    hint: { type: 'bool', def: true },                                 // a quiet board shows the command big, now and then                              // the commands in the drop chute (off: the chute shows who leads)
    color: { type: 'enum', def: 'chat', values: ['chat', 'accent', 'platform', 'rainbow'] },   // ball colour
    balls: { type: 'int', def: 5, min: 1, max: 10 },                  // balls per !plinko
    cool: { type: 'int', def: 0, min: 0, max: 300 },                  // seconds a viewer waits between drops (0: none, spam away)
    max: { type: 'int', def: 100, min: 20, max: 200 },                // most balls on the board at once (the rest queue)
    speed: { type: 'enum', def: 'normal', values: ['slow', 'normal', 'fast'] },
    motion: { type: 'enum', def: 'auto', values: ['auto', 'full', 'calm', 'reduce'] },   // calm: fewer effects; reduce: nothing falls
    nearmiss: { type: 'bool', def: true },                             // "so close!" when a ball just misses the top slot
    // advanced: commands (several names: comma separated) and who can use them
    // the command (the owner, 2026-09-30: one setting, the rest are fixed words after it): !plinko drops; !plinko top,
    // pause, resume, clear, clearscores (the broadcaster only)
    cmd: { type: 'str', def: '!plinko', maxLen: 24 },
    perm: { type: 'enum', def: 'mods', values: ['me', 'mods', 'all'] },
    ignore: { type: 'list', def: BOTS },
    remember: { type: 'bool', def: true },                             // show All time
    credit: { type: 'bool', def: true },
  };
  // the default slot values for each row count: the edge slots are the rarest (odds.js), so they score the most
  const SLOTS = {
    8: [25, 10, 5, 2, 1, 2, 5, 10, 25],
    9: [50, 15, 5, 2, 1, 1, 2, 5, 15, 50],
    10: [100, 25, 10, 5, 2, 1, 2, 5, 10, 25, 100],
    11: [150, 50, 10, 5, 2, 1, 1, 2, 5, 10, 50, 150],
    12: [150, 50, 20, 10, 5, 2, 1, 2, 5, 10, 20, 50, 150],
  };
  /** the slot values for these settings (the owner removed the setting for their own, 2026-09-30) */
  const slotValues = (cfg) => SLOTS[cfg.rows] || SLOTS[10];
  // what goes in each source's link: the board's, and the separate leaderboard's (which carries its own look as theme=…)
  const LB_KEYS = ['twitch', 'kick', 'theme', 'accent', 'bgo', 'lbshape', 'lbn', 'lbshow', 'lbevery', 'remember', 'credit', 'motion', 'cmd'];
  /** the separate leaderboard's settings: its own look, unless it matches the board */
  const leaderboardSettings = (s) => {
    const out = {}; for (const k of LB_KEYS) out[k] = s[k];
    out.bgo = s.lbbgo;                                                  // its own background, always
    if (s.lbtheme !== 'same') Object.assign(out, { theme: s.lbtheme, accent: s.lbaccent });
    return out;
  };
  // sizes: the board, the board with the leaderboard beside it, the separate leaderboard (panel height follows how many)
  const SIZES = { separate: [640, 540], combined: [960, 540], strip: [720, 72], panel: (n) => [300, 100 + 34 * n] };
  /** the command as typed in chat: lowercase, one word (the default if it's empty) */
  const command = (cfg) => String(cfg.cmd || '').trim().toLowerCase().split(/\s+/)[0] || SCHEMA.cmd.def;
  /** the command for a new link: up to 6 characters after the ! (the idle prompt shows it big); older links keep theirs */
  const CMD_MAX = 6;
  const shortCommand = (v) => { const c = command({ cmd: v }), bang = c.startsWith('!') ? 1 : 0; return c.slice(0, bang + CMD_MAX); };
  const MAIN = ['twitch', 'kick', 'layout', 'side', 'rows', 'theme', 'accent', 'bgo'];
  K.settings = { SCHEMA, SLOTS, THEMES, SIZES, MAIN, LB_KEYS, slotValues, leaderboardSettings, command, shortCommand, CMD_MAX };
})();
