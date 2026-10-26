// Daily check that Inputty's download button is input-overlay's latest stable release (.github/workflows/daily.yml;
// docs/widgets.md, "Inputty"). input-overlay has no updater and puts its version in each file's name, so GitHub's
// releases/latest/download/ address can't be used: the button's links live in public/inputty/lib/guide.js (INSTALLER)
// and this rewrites them. It prints one status line and writes `status` and `summary` for the workflow:
//
//   ok            the button is already the latest stable release
//   updated       a newer release: guide.js updated (the workflow tests, commits and pushes it)
//   review        a newer release a person should look at first (no Windows installer, its notes mention the
//                 websocket or key codes, or which OBS it needs can't be told): nothing written
//   unreachable   GitHub couldn't be asked, or its answer changed shape
//
// The oldest OBS a release works with is the OBS its source was built against (buildspec.json at its tag: 5.0.6 was
// built against 30.1.2, 5.1.x against 33.0.0, "only compatible with OBS versions 33 and newer"), else what its notes
// say. The button says it ("Needs OBS 33 or newer"), and older OBS gets a link to the newest stable release built for
// an older OBS (`old`): when a release needs a different OBS, that's worked out again from every release.
//
// The workflow opens a GitHub issue for review and unreachable, and closes it once a later check is ok.
// Run by hand: node scripts/check-input-overlay.mjs [--dry] (--dry: don't write guide.js)
import { readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const GUIDE_JS = fileURLToPath(new URL("../public/inputty/lib/guide.js", import.meta.url));
const REPO = "univrsal/input-overlay";
const BLOCK = /  const INSTALLER = \{\n[\s\S]*?\n  \};\n/;
// what Inputty relies on: its websocket messages, and keys read by rawcode (5.1 already changed its own key codes)
const RISKY = /web ?socket|key ?codes?|rawcode/i;

/** guide.js's text → its INSTALLER's { version, size, obs, old } (old: the release for older OBS, '' for none) */
export function installerIn(text) {
  const b = text.match(BLOCK);
  if (!b) throw new Error("INSTALLER not found in guide.js");
  const get = (k) => (b[0].match(new RegExp(`${k}: '([^']*)'`)) || [])[1];
  return { version: get("version"), size: get("size"), obs: get("obs"), old: get("old") };
}
/** guide.js's text with a new INSTALLER (every link from the version, so they can't drift apart) */
export function withInstaller(text, { version, size, obs, old }) {
  const dl = `https://github.com/${REPO}/releases/download/${version}/input-overlay-${version}`;
  return text.replace(BLOCK, `  const INSTALLER = {
    version: '${version}', size: '${size}', obs: '${obs}',
    // the latest stable release and the oldest OBS it works with, kept current by scripts/check-input-overlay.mjs;
    // older OBS gets \`old\` (none: ''), linked under the button
    url: '${dl}-windows-x64-Installer.exe',
    file: 'input-overlay-${version}-windows-x64-Installer.exe',
    linux: '${dl}-x86_64-linux-gnu.deb',
    page: 'https://github.com/${REPO}/releases/tag/${version}',
    old: '${old}', oldPage: '${old ? `https://github.com/${REPO}/releases/tag/${old}` : ""}',
  };
`);
}
/** bytes → "4.2 MB", as the button shows it */
export const mb = (bytes) => `${(bytes / 1e6).toFixed(1)} MB`;
/** a release's notes → the oldest OBS it supports ("only compatible with OBS versions 33 and newer"), if it says */
export const obsIn = (notes) => ((notes || "").match(/OBS (?:versions? )?(\d+)(?:\.\d+)* (?:and|or) (?:newer|later|above)/i) || [])[1];

/** the oldest OBS this release works with: the major version its source was built against, else its notes' */
async function oldestObs(fetch_, tag, notes) {
  try {
    const r = await fetch_(`https://raw.githubusercontent.com/${REPO}/${tag}/buildspec.json`);
    const v = r.ok && (await r.json())?.dependencies?.["obs-studio"]?.version;
    if (/^\d+\./.test(v || "")) return v.split(".")[0];
  } catch {}
  return obsIn(notes);
}

/** the newest stable release built for an OBS older than `obs` ('' for none; null: releases couldn't be listed) */
async function forOlder(fetch_, headers, obs) {
  let list;
  try {
    const r = await fetch_(`https://api.github.com/repos/${REPO}/releases?per_page=100`, { headers });
    list = r.ok && (await r.json());
  } catch {}
  if (!Array.isArray(list)) return null;
  const stable = list.filter((x) => !x.prerelease && !x.draft && x.tag_name);   // GitHub lists the newest first
  for (const x of stable) {
    const o = await oldestObs(fetch_, x.tag_name, x.body);
    if (o && +o < +obs) return x.tag_name;
  }
  return "";
}

/** the whole check → { status, summary } (writes guide.js on updated unless dry) */
export async function check({ fetch_ = fetch, read = () => readFileSync(GUIDE_JS, "utf8"), write = (t) => writeFileSync(GUIDE_JS, t), dry = false, token = process.env.GITHUB_TOKEN } = {}) {
  const ours = installerIn(read());
  const headers = { Accept: "application/vnd.github+json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  let rel;
  try {
    const r = await fetch_(`https://api.github.com/repos/${REPO}/releases/latest`, { headers });
    if (!r.ok) throw new Error(`GitHub answered ${r.status}`);
    rel = await r.json();
    if (!rel.tag_name || !Array.isArray(rel.assets)) throw new Error("its answer has no tag or files");
  } catch (e) {
    return { status: "unreachable", summary: `Couldn't ask GitHub for input-overlay's latest release (${e.message}). Inputty's download button still offers ${ours.version}.` };
  }
  const version = rel.tag_name.replace(/^v/, "");
  if (version === ours.version) return { status: "ok", summary: `Inputty's download button is input-overlay's latest stable release, ${version}.` };

  const url = `https://github.com/${REPO}/releases/tag/${rel.tag_name}`;
  const exe = rel.assets.find((a) => a.name === `input-overlay-${version}-windows-x64-Installer.exe`);
  const deb = rel.assets.find((a) => a.name === `input-overlay-${version}-x86_64-linux-gnu.deb`);
  const obs = await oldestObs(fetch_, rel.tag_name, rel.body);
  // a different oldest OBS: which release older OBS gets is worked out again
  const old = obs && obs !== ours.obs ? await forOlder(fetch_, headers, obs) : ours.old;
  const why = [
    !exe && "it has no Windows installer named the usual way",
    !deb && "it has no Linux .deb named the usual way",
    rel.tag_name !== version && `its tag (${rel.tag_name}) isn't the bare version the download links use`,
    RISKY.test(rel.body || "") && "its notes mention the websocket or key codes, which Inputty reads (src/network/websocket_server.cpp in their source; lib/input.js here)",
    !obs && "couldn't tell which OBS it needs (no buildspec.json in its source, nothing in its notes)",
    obs && old === null && `it needs OBS ${obs} or newer (not ${ours.obs}), but GitHub couldn't list its releases to find the one for older OBS`,
  ].filter(Boolean);
  if (why.length) {
    return { status: "review", summary: `input-overlay ${version} is out (${url}), but Inputty's download button still offers ${ours.version}: ${why.join("; ")}. Check it, then update INSTALLER in public/inputty/lib/guide.js (docs/widgets.md, "Inputty").` };
  }
  if (!dry) write(withInstaller(read(), { version, size: mb(exe.size), obs, old }));
  const obsNote = obs === ours.obs ? "" : ` It needs OBS ${obs} or newer (was ${ours.obs}): older OBS now gets ${old || "no link (no stable release is built for an older OBS)"}.`;
  return { status: "updated", summary: `input-overlay ${version} is out (${url}): Inputty's download button now offers it instead of ${ours.version}.${obsNote}` };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const r = await check({ dry: process.argv.includes("--dry") });
  console.log(`${r.status}: ${r.summary}`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `status=${r.status}\nsummary=${r.summary.replace(/\n/g, " ")}\n`);
  process.exit(0);
}
