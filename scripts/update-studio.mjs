#!/usr/bin/env node
import { cp, readFile, readdir, rm, stat } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Carries an engine fix to every demo that already vendored the old one.
 *
 * The line this holds is between the engine and the app, and it is drawn by
 * an allowlist rather than by judgement. `studio/` and the four scripts that
 * start a run are the engine: generic, identical in every app, and the only
 * things here that get overwritten. Everything else under a `demo/` folder —
 * `demo.config.ts`, `mock.ts`, `ui.ts`, `seed/`, `scenes/` — is what makes
 * that app's demo its own, and a script meant to be pointed at a dozen
 * scaffolded apps at once must never be the thing that eats somebody's
 * scenes.
 *
 * `studio/` is replaced wholesale, so a file deleted from the engine goes
 * away rather than lingering as a stale module that still resolves. The root
 * scripts are written in place, because they sit in a directory that is not
 * ours to sweep.
 */

const TEMPLATE = fileURLToPath(new URL('../template/demo', import.meta.url));

/** Replaced wholesale — the engine owns every path inside. */
const ENGINE_DIRS = ['studio'];

/**
 * The generic scripts that start a run. They live beside the app's own files
 * rather than under `studio/` because that is where a package.json script can
 * name them, which is exactly why they need listing here: an engine fix to
 * the runner or the build pin would otherwise reach no app that already
 * scaffolded.
 */
const ENGINE_FILES = [
  'run.mjs',
  'pin-build.mjs',
  'serve.mjs',
  'playwright.demo.ts',
  /**
   * The one file that does not come from `template/`. `doctor.sh` is also run
   * straight out of this skill, before any app has been scaffolded, so it
   * lives in `scripts/` and is copied into a demo from there rather than
   * being kept twice and left to drift.
   */
  ['doctor.sh', fileURLToPath(new URL('./doctor.sh', import.meta.url))],
];

const appRootArg = process.argv[2];
if (!appRootArg) {
  process.stderr.write('usage: update-studio.mjs <appRoot>\n');
  process.exit(1);
}

const appRoot = resolve(appRootArg);
const targetDemo = join(appRoot, 'demo');

async function readTree(root) {
  const files = new Map();

  async function recurse(dir) {
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        await recurse(full);
        continue;
      }
      files.set(relative(root, full), await readFile(full, 'utf8'));
    }
  }

  await recurse(root);
  return files;
}

const targetStat = await stat(join(targetDemo, 'studio')).catch(() => null);
if (!targetStat) {
  process.stderr.write(
    `update-studio: no ${join(targetDemo, 'studio')}. Scaffold this app first:\n` +
      `                scripts/scaffold.mjs ${appRoot}\n`
  );
  process.exit(1);
}

const added = [];
const changed = [];
const removed = [];
let unchanged = 0;

function classify(path, before, after) {
  if (before === undefined) {
    added.push(path);
    return;
  }
  if (before !== after) {
    changed.push(path);
    return;
  }
  unchanged += 1;
}

for (const dir of ENGINE_DIRS) {
  const from = join(TEMPLATE, dir);
  const to = join(targetDemo, dir);
  const before = await readTree(to);
  const after = await readTree(from);

  for (const [path, content] of after) {
    classify(join(dir, path), before.get(path), content);
  }
  for (const path of before.keys()) {
    if (!after.has(path)) {
      removed.push(join(dir, path));
    }
  }

  await rm(to, { recursive: true, force: true });
  await cp(from, to, { recursive: true });
}

for (const entry of ENGINE_FILES) {
  const [file, source] = Array.isArray(entry) ? entry : [entry, null];
  const from = source ?? join(TEMPLATE, file);
  const after = await readFile(from, 'utf8').catch(() => null);
  if (after === null) {
    continue;
  }
  const to = join(targetDemo, file);
  classify(file, await readFile(to, 'utf8').catch(() => undefined), after);
  await cp(from, to);
}

function report(label, paths) {
  if (paths.length === 0) {
    return;
  }
  process.stdout.write(`  ${label}:\n`);
  for (const path of paths.sort()) {
    process.stdout.write(`    ${path}\n`);
  }
}

process.stdout.write(`update-studio: ${targetDemo}\n`);
report('added', added);
report('changed', changed);
report('removed', removed);
process.stdout.write(`  unchanged: ${unchanged} file(s)\n`);

if (added.length === 0 && changed.length === 0 && removed.length === 0) {
  process.stdout.write('\n  already up to date.\n');
}
