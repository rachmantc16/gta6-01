// Marisol Bay — handover program for the gta6-01 make.fun entry.
//
// What this does, in order:
//   1. works out where the entry goes (MAKEFUN_OUTPUT_DIR when it is set,
//      otherwise the grader's /output),
//   2. copies the static game (game/) and the screenshots (screenshots/)
//      from this repository into that place, untouched,
//   3. asks the vendored make.fun library to summarise the copied tree as
//      dossier.json, the one document the judge reads.
//
// Node 22, standard library only, no network. Running it twice over the same
// repository writes the same bytes twice: the copy is a plain file copy and
// the dossier builder sorts everything it lists.

import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoDir = fileURLToPath(new URL('.', import.meta.url));
const targetDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// A handover that copies the repository into itself would never finish, so
// refuse that one layout up front instead of recursing forever.
if (join(repoDir, 'game') === join(targetDir, 'game')) {
  throw new Error('output directory must not be the repository itself');
}

function countFiles(dir: string): number {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    total += entry.isDirectory() ? countFiles(join(dir, entry.name)) : 1;
  }
  return total;
}

// Fail in plain words when the checkout is incomplete, not with a raw
// copy error: the game tree is the entry, and the screenshots are part of
// the score, so both have to be here before anything is copied across.
const gameDir = join(repoDir, 'game');
if (!existsSync(join(gameDir, 'index.html'))) {
  throw new Error('game/index.html is missing — this checkout cannot be handed in');
}
const shotsDir = join(repoDir, 'screenshots');
const shotNames = existsSync(shotsDir)
  ? readdirSync(shotsDir).filter((name) => /\.(png|jpe?g)$/i.test(name))
  : [];
if (shotNames.length < 3 || shotNames.length > 4) {
  throw new Error(`screenshots/ must hold 3 or 4 images, found ${shotNames.length}`);
}

mkdirSync(targetDir, { recursive: true });
cpSync(gameDir, join(targetDir, 'game'), { recursive: true });
cpSync(shotsDir, join(targetDir, 'screenshots'), { recursive: true });

// The caps below are the scorer's own limits for this competition; the
// dossier builder enforces the text cap on the bytes it writes and reports
// the rest, so an entry that would be refused is refused here first.
const dossierText = buildDossier(targetDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(targetDir, 'dossier.json'), dossierText);

console.log(
  `handed in ${countFiles(join(targetDir, 'game'))} game files and ` +
    `${countFiles(join(targetDir, 'screenshots'))} screenshots to ${targetDir}`,
);
