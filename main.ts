// Neon Drift Arena — make.fun best-game-01 entry program.
//
// The grader runs this file in a sandbox: the repository is mounted
// read-only and a writable output directory is provided (MAKEFUN_OUTPUT_DIR
// names it locally; /output is the sandbox default). The job is to hand in
// the game exactly as the bounty asks: copy game/ and screenshots/ into the
// output directory, then write the dossier the judge reads, built by the
// kit's own library from the copied files so it matches byte for byte.

import { cpSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

cpSync(join(repoRoot, 'game'), join(outputDir, 'game'), { recursive: true });
cpSync(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'), {
  recursive: true,
});

const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
});
writeFileSync(join(outputDir, 'dossier.json'), dossier);
