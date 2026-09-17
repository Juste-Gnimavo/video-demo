#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * One entry point, because the obvious two-command script has a trap in it.
 *
 * `"demo": "node demo/pin-build.mjs && playwright test --config=..."` is the
 * natural way to write this and it quietly breaks the first command anybody
 * runs. `pnpm demo -- --grep smoke` appends `-- --grep smoke` to the end of
 * the whole script string, the `--` reaches Playwright's CLI, and Playwright
 * reads everything after it as positional file filters rather than options.
 * It does not complain. It films all twenty-eight scenes, which is ten
 * minutes and a gigabyte instead of the four-second check that was asked
 * for, and the only clue is a scene count nobody reads on the way past.
 *
 * A script, unlike a shell `&&`, can be handed the arguments and look at
 * them. So this strips the separator pnpm leaves behind, hands the rest to
 * Playwright untouched, and the documented command means what it says.
 */

const DEMO_DIR = import.meta.dirname;

/**
 * Node keeps a bare `--` when it follows a script filename (it only consumes
 * one before), so it arrives here as a real argument and has to be dropped.
 */
const args = process.argv.slice(2).filter((arg) => arg !== '--');

function run(command, argv) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, argv, { stdio: 'inherit', shell: false });
    child.on('error', reject);
    child.on('close', (code, signal) =>
      signal
        ? reject(new Error(`${command} killed by ${signal}`))
        : resolve(code ?? 0)
    );
  });
}

/**
 * `DEMO_BUILD=0` skips the rebuild, which is the difference between a
 * twenty-second iteration and a four-minute one.
 *
 * The default is to build, because a corpus of the code in the tree is the
 * whole point and a stale one is worse than a slow one. But re-filming a
 * single scene while writing it does not need a new bundle every time, and
 * without a way to say so the loop is slow enough that people stop checking
 * their work. Skip it while iterating; let the full run build.
 */
if (process.env.DEMO_BUILD !== '0') {
  const built = await run(process.execPath, [join(DEMO_DIR, 'pin-build.mjs')]);
  if (built !== 0) {
    process.exit(built);
  }
}

/**
 * Found by walking up rather than assumed, because where a binary lands is a
 * property of the installer and not of this repo: pnpm links it beside the
 * app that depends on it, npm and yarn may hoist it to a workspace root, and
 * a wrong guess fails with ENOENT on a path nobody chose.
 */
function findPlaywright() {
  const bin = process.platform === 'win32' ? 'playwright.cmd' : 'playwright';
  let dir = DEMO_DIR;
  for (let up = 0; up < 6; up += 1) {
    const candidate = join(dir, 'node_modules', '.bin', bin);
    if (existsSync(candidate)) {
      return candidate;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  process.stderr.write(
    'demo: could not find the playwright binary in any node_modules/.bin\n' +
      '      above demo/. Install @playwright/test in this app.\n'
  );
  process.exit(1);
}

const playwright = findPlaywright();

process.exit(
  await run(playwright, [
    'test',
    `--config=${join(DEMO_DIR, 'playwright.demo.ts')}`,
    ...args,
  ])
);
