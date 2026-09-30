// The Short for X (Twitter): the same video with the Short's thumbnail as its first frame, since X shows a video's first
// frame as its preview. One frame (1/30 s) of the thumbnail, with the same sliver of silence, so the sound stays in sync.
// Needs the Short and its thumbnail first (record.mjs --vertical, thumbnail.mjs).
// Usage: node artwork/chaplinko/trailer/twitter.mjs [in.mp4] [thumbnail.jpg] [out.mp4]   (defaults in ~/Downloads)
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';

const dl = (f) => join(homedir(), 'Downloads', f);
const [IN = dl('chaplinko-trailer-short.mp4'), THUMB = dl('chaplinko-short-thumbnail.jpg'), OUT = dl('chaplinko-trailer-short-x.mp4')] = process.argv.slice(2);
execFileSync('ffmpeg', ['-loglevel', 'error', '-y',
  '-loop', '1', '-framerate', '30', '-t', String(1 / 30), '-i', THUMB,
  '-f', 'lavfi', '-t', String(1 / 30), '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
  '-i', IN,
  '-filter_complex', '[0:v]scale=1080:1920,setsar=1,fps=30,format=yuv420p[t];[2:v]setsar=1,fps=30,format=yuv420p[v];[t][1:a][v][2:a]concat=n=2:v=1:a=1[ov][oa]',
  '-map', '[ov]', '-map', '[oa]', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', OUT]);
console.log(OUT);
