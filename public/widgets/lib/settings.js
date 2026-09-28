// Settings kept in a widget's link (docs/widgets.md, "Settings in the link"). Each widget describes its settings once
// (a schema); the set-up page writes the link from it and the overlay reads the link back through it. Only settings
// that differ from their default go in the link, so links stay short and a default can improve later without old
// links pinning the old value. Anything missing, unknown or out of range falls back to the default.
//
//   schema = { time: { type: 'int', def: 90, min: 30, max: 300 }, theme: { type: 'enum', def: 'neutral', values: [...] }, … }
//   types: str (max length), int (min/max), bool (1/0), enum (values), list (comma separated, lowercase), color (hex, no #)
(() => {
  const W = (window.Widgets = window.Widgets || {});

  /** @typedef {{ type: 'str'|'int'|'bool'|'enum'|'list'|'color', def: any, min?: number, max?: number, values?: string[], maxLen?: number }} Field */

  /** one value from the link → a valid setting (or undefined: use the default) @param {Field} f @param {string} raw */
  function read(f, raw) {
    if (raw == null) return undefined;
    raw = String(raw).trim();
    switch (f.type) {
      case 'int': { if (!/^-?\d+$/.test(raw)) return undefined; const n = +raw; return n < (f.min ?? -Infinity) || n > (f.max ?? Infinity) ? undefined : n; }
      case 'bool': return raw === '1' || raw === 'true' ? true : raw === '0' || raw === 'false' ? false : undefined;
      case 'enum': return f.values.includes(raw.toLowerCase()) ? raw.toLowerCase() : undefined;
      case 'list': return raw.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean).slice(0, 200);
      case 'color': { const c = raw.replace(/^#/, '').toLowerCase(); return /^[0-9a-f]{6}$/.test(c) ? c : undefined; }
      default: return raw.slice(0, f.maxLen || 200);
    }
  }
  const same = (a, b) => (Array.isArray(a) || Array.isArray(b) ? JSON.stringify(a) === JSON.stringify(b) : a === b);
  const write = (f, v) => (f.type === 'bool' ? (v ? '1' : '0') : f.type === 'list' ? v.join(',') : String(v));

  /** the defaults @param {Record<string, Field>} schema */
  const defaults = (schema) => Object.fromEntries(Object.entries(schema).map(([k, f]) => [k, Array.isArray(f.def) ? [...f.def] : f.def]));

  /** a link's query (string or URLSearchParams) → every setting, valid @param {Record<string, Field>} schema */
  function decode(schema, query) {
    const q = typeof query === 'string' ? new URLSearchParams(query) : query, out = defaults(schema);
    for (const [k, f] of Object.entries(schema)) { const v = read(f, q.get(k)); if (v !== undefined) out[k] = v; }
    return out;
  }
  /** settings → the query for a link, only what differs from the defaults (in the schema's order) */
  function encode(schema, values) {
    const q = new URLSearchParams();
    for (const [k, f] of Object.entries(schema)) {
      const v = values[k];
      if (v === undefined || same(v, f.def)) continue;
      const clean = read(f, write(f, v));
      if (clean !== undefined && !same(clean, f.def)) q.set(k, write(f, clean));
    }
    return q.toString().replace(/%2C/g, ',').replace(/%21/g, '!');
  }
  /** how many settings differ from their default, among these keys (the set-up page's "changed" badge) */
  const changed = (schema, values, keys = Object.keys(schema)) => keys.filter((k) => !same(values[k], schema[k].def)).length;

  W.settings = { read, decode, encode, defaults, changed };
})();
