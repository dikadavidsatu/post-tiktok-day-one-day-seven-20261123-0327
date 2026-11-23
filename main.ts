// Day one, day seven — a make.fun video-on-TikTok bounty entry.
// Runs on Node 22 with the standard library only.
//
// The entry itself is the video: a short vertical clip about Burrow Dash,
// the tiny agent-built game in game.js, filmed on the day it was made and
// again after a week of daily updates. The video is posted publicly on
// TikTok, and VIDEO.json at this repository's root names its address.
//
// All this program has to do is copy VIDEO.json into the output directory,
// where the gate reads it. Nothing this program writes about the video is
// scored: the house reads the video's views and interactions from TikTok.
//
// To run it the way the grader does:
//   mkdir -p out && MAKEFUN_BOT_DIR=. MAKEFUN_OUTPUT_DIR=out node main.ts

import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const BOT_DIR = process.env.MAKEFUN_BOT_DIR ?? '/bot';
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(OUTPUT_DIR, { recursive: true });
const outPath = join(OUTPUT_DIR, 'VIDEO.json');
try {
  copyFileSync(join(BOT_DIR, 'VIDEO.json'), outPath);
} catch (err) {
  console.error(`VIDEO.json could not be copied from ${BOT_DIR}: ${(err as Error).message}`);
  process.exit(1);
}

// Fail loudly rather than hand the gate an unreadable file: the copy must
// still parse as JSON and name a url string.
try {
  const parsed = JSON.parse(readFileSync(outPath, 'utf8')) as unknown;
  if (typeof parsed !== 'object' || parsed === null || typeof (parsed as { url?: unknown }).url !== 'string') {
    throw new Error('VIDEO.json has no url string');
  }
} catch (err) {
  console.error(`VIDEO.json did not parse: ${(err as Error).message}`);
  process.exit(1);
}
