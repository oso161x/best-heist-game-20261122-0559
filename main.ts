// Midnight Vault: the hand-in program for the make.fun best-heist-game bounty.
// It copies game/ and screenshots/ from beside this file to the output directory and
// writes /output/dossier.json with the vendored make.fun library, the summary the judge
// reads. Unlike a blind copy it validates the entry first — the same caps the scorer
// enforces — and prints what it handed in, so a broken entry fails loudly here instead
// of silently at the gate.
//
//   node main.ts [--out <dir>] [--help]
//   MAKEFUN_OUTPUT_DIR=out node main.ts
//
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output.

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The scorer's own caps (competition.yaml / reference/gate.json): only text_max_bytes shapes
// the dossier bytes; the others refuse an entry the scorer would refuse.
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function fail(message) {
  console.error(`main.ts: ${message}`);
  process.exit(1);
}

function usage() {
  console.log(`Usage: node main.ts [--out <dir>] [--help]

Hands in the Midnight Vault game: copies game/ and screenshots/ to the output
directory (default /output, or MAKEFUN_OUTPUT_DIR) and writes dossier.json there.
Validates the entry against the scorer's caps first and refuses to hand in a
broken one: game/index.html must exist, game/ must hold at most ${CAPS.game_max_files}
files and ${CAPS.game_max_bytes} bytes, screenshots/ must hold 3 or 4 images of at
most ${CAPS.screenshots.max_bytes} bytes each.`);
}

function countTree(dir) {
  let files = 0;
  let bytes = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      const sub = countTree(path);
      files += sub.files;
      bytes += sub.bytes;
    } else if (entry.isFile()) {
      files += 1;
      bytes += statSync(path).size;
    }
  }
  return { files, bytes };
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    usage();
    return;
  }
  const outFlag = args.indexOf('--out');
  const out = outFlag >= 0 ? args[outFlag + 1] : (process.env.MAKEFUN_OUTPUT_DIR ?? '/output');
  if (outFlag >= 0 && !args[outFlag + 1]) fail('--out needs a directory after it.');
  if (!out || out.startsWith('-')) fail('no output directory given (use --out <dir> or MAKEFUN_OUTPUT_DIR).');

  const here = fileURLToPath(new URL('.', import.meta.url));
  const gameDir = join(here, 'game');
  const shotsDir = join(here, 'screenshots');

  if (!existsSync(join(gameDir, 'index.html'))) fail('game/index.html is missing — nothing playable to hand in.');
  const gameTree = countTree(gameDir);
  if (gameTree.files > CAPS.game_max_files) {
    fail(`game/ holds ${gameTree.files} files, over the cap of ${CAPS.game_max_files}.`);
  }
  if (gameTree.bytes > CAPS.game_max_bytes) {
    fail(`game/ holds ${gameTree.bytes} bytes, over the cap of ${CAPS.game_max_bytes}.`);
  }
  if (!existsSync(shotsDir)) fail('screenshots/ is missing — the judge needs 3 or 4 renders of the game.');
  const shots = readdirSync(shotsDir).filter((name) => !name.startsWith('.'));
  if (shots.length < 3 || shots.length > CAPS.screenshots.max) {
    fail(`screenshots/ holds ${shots.length} images; the entry needs 3 or 4.`);
  }
  for (const name of shots) {
    const size = statSync(join(shotsDir, name)).size;
    if (size > CAPS.screenshots.max_bytes) fail(`screenshots/${name} is ${size} bytes, over the cap of ${CAPS.screenshots.max_bytes}.`);
  }

  mkdirSync(out, { recursive: true });
  cpSync(gameDir, join(out, 'game'), { recursive: true });
  mkdirSync(join(out, 'screenshots'), { recursive: true });
  cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });
  const dossier = buildDossier(out, CAPS);
  writeFileSync(join(out, 'dossier.json'), dossier);

  console.log(`Handed in Midnight Vault to ${out}:`);
  console.log(`  game/: ${gameTree.files} files, ${gameTree.bytes} bytes`);
  console.log(`  screenshots/: ${shots.sort().join(', ')}`);
  console.log(`  dossier.json: ${dossier.length} bytes`);
}

main();
