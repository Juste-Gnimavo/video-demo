#!/usr/bin/env node
import { chmod, cp, readFile, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Bootstraps the engine into an app, and nothing an app has to get right
 * itself. Everything this writes is generic: `demo.config.ts`, `mock.ts`,
 * `ui.ts`, `seed/` and `scenes/` are what makes one app's demo differ from
 * another's, and none of them ship from here — see `scripts/update-studio.mjs`
 * for the same boundary in the other direction.
 */

const TEMPLATE_DIR = fileURLToPath(new URL('../template/demo', import.meta.url));
const DOCTOR_PATH = fileURLToPath(new URL('./doctor.sh', import.meta.url));
const DEMO_SCRIPT =
  'node demo/run.mjs';

/**
 * Read off the lockfile rather than assumed, because this template is not
 * only used from a pnpm workspace: the script this writes has to be typed
 * the way each manager actually expects it run, or the "next steps" this
 * prints is advice for somebody else's repo.
 */
const LOCKFILES = [
  ['pnpm-lock.yaml', 'pnpm'],
  ['yarn.lock', 'yarn'],
  ['bun.lockb', 'bun'],
  ['package-lock.json', 'npm'],
];

async function detectPackageManager(root) {
  for (const [lockfile, manager] of LOCKFILES) {
    if (await stat(join(root, lockfile)).catch(() => null)) {
      return manager;
    }
  }
  return null;
}

function runHint(manager, script, args) {
  switch (manager) {
    case 'pnpm':
      return args ? `pnpm ${script} -- ${args}` : `pnpm ${script}`;
    case 'yarn':
      return args ? `yarn ${script} ${args}` : `yarn ${script}`;
    case 'bun':
      return args ? `bun run ${script} ${args}` : `bun run ${script}`;
    default:
      return args ? `npm run ${script} -- ${args}` : `npm run ${script}`;
  }
}

const cliArgs = process.argv.slice(2);
const force = cliArgs.includes('--force');
const appRootArg = cliArgs.find((arg) => !arg.startsWith('--'));

if (!appRootArg) {
  process.stderr.write('usage: scaffold.mjs <appRoot> [--force]\n');
  process.exit(1);
}

const appRoot = resolve(appRootArg);
const demoDir = join(appRoot, 'demo');

const appStat = await stat(appRoot).catch(() => null);
if (!appStat?.isDirectory()) {
  process.stderr.write(`scaffold: ${appRoot} is not a directory\n`);
  process.exit(1);
}

const demoStat = await stat(demoDir).catch(() => null);
if (demoStat && !force) {
  process.stderr.write(
    `scaffold: ${demoDir} already exists. Pass --force to replace it wholesale\n` +
      '          (this overwrites everything under demo/, including any scenes,\n' +
      '          demo.config.ts or mock.ts already written — to update only the\n' +
      '          engine and keep those, use scripts/update-studio.mjs instead).\n'
  );
  process.exit(1);
}

await cp(TEMPLATE_DIR, demoDir, { recursive: true, force: true });

/**
 * Vendored rather than referenced, so the script this adds to package.json is
 * a path in the repo and not a path on this machine.
 *
 * Pointing at the skill's own copy is the obvious shortcut and it commits
 * somebody's home directory into a file the whole team runs: it works
 * precisely once, for the person who scaffolded, and fails for everyone else
 * with a missing-file error naming a directory they have never heard of. The
 * checks inside it are about the machine — node, ffmpeg, uv, the voice model
 * — so a copy that travels with the repo is the useful one.
 */
await cp(DOCTOR_PATH, join(demoDir, 'doctor.sh'));
await chmod(join(demoDir, 'doctor.sh'), 0o755);

const detectedManager = await detectPackageManager(appRoot);
const manager = detectedManager ?? 'npm';
const doctorScript = 'bash demo/doctor.sh';

const pkgPath = join(appRoot, 'package.json');
const pkgRaw = await readFile(pkgPath, 'utf8').catch(() => null);

if (pkgRaw === null) {
  process.stdout.write(
    `scaffold: no package.json at ${pkgPath}; add these scripts yourself:\n` +
      `  "demo": "${DEMO_SCRIPT}"\n` +
      `  "demo:doctor": "${doctorScript}"\n`
  );
} else {
  const pkg = JSON.parse(pkgRaw);
  pkg.scripts ??= {};
  if (pkg.scripts.demo && pkg.scripts.demo !== DEMO_SCRIPT && !force) {
    process.stdout.write(
      `scaffold: package.json already has a "demo" script; leaving it alone.\n` +
        `          add this yourself if it's meant to be this one:\n` +
        `  "demo": "${DEMO_SCRIPT}"\n`
    );
  } else {
    pkg.scripts.demo = DEMO_SCRIPT;
  }
  pkg.scripts['demo:doctor'] ??= doctorScript;
  await writeFile(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
}

const gitignorePath = join(appRoot, '.gitignore');
const gitignore = await readFile(gitignorePath, 'utf8').catch(() => '');
const lines = gitignore.split('\n');
const wanted = ['demo-out/', 'demo/.build/'];
const missing = wanted.filter((line) => !lines.includes(line));

if (missing.length > 0) {
  const separator = gitignore.length > 0 && !gitignore.endsWith('\n') ? '\n' : '';
  await writeFile(gitignorePath, `${gitignore}${separator}${missing.join('\n')}\n`);
}

const managerNote = detectedManager
  ? `detected ${manager} from its lockfile`
  : `no lockfile found; defaulting to ${manager}`;
process.stdout.write(`\nscaffold: wrote ${demoDir} (${managerNote})\n\n`);
process.stdout.write('next:\n');
process.stdout.write('  1. fill in demo/demo.config.ts\n');
process.stdout.write('  2. write demo/mock.ts\n');
process.stdout.write(
  `  3. run the smoke scene: DEMO_VOICE=0 ${runHint(manager, 'demo', '--grep smoke')}\n`
);
