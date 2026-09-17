import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import demo from '../demo.config.ts';
import type { Theme } from './define.ts';

/**
 * Every number the studio is allowed to have an opinion about, in one place.
 *
 * `demo` (below) is the whole of what this file trusts about the app being
 * filmed; everything else here is either a literal from `demo.config.ts`, a
 * derivation of one, or an env override layered on top of it. A demo asset is
 * only worth automating if the same command produces the same file next
 * month, so nothing here may be read from the machine beyond that: not the
 * clock, not the zone, not the window size unless a `DEMO_*` variable asked
 * for it explicitly.
 *
 * `VIDEO_SCALE`/`STILL_SCALE` are the one pair with a real trade-off behind
 * them. The screencast encoder inside Chrome shares a thread with
 * compositing, so asking for retina frames at 60fps is asking the browser to
 * choose between painting and encoding — and it chooses painting, silently,
 * by handing back fewer frames. `recorder.ts` measures what it actually got
 * and says so, rather than letting a soft clip pass as a smooth one.
 */

export { demo };

/**
 * What `demo.mock` actually returns, inferred rather than hardcoded.
 *
 * There is no `DemoServer` type here: the server shape is whatever the app's
 * own `mock` produces, and every module that needs to type a scene's `server`
 * reads it off `demo.mock` itself instead of naming a type this file would
 * otherwise have to import from somewhere app-specific.
 */
export type ConfigServer = Awaited<ReturnType<typeof demo.mock>>;

function must<T>(value: T | undefined, field: string): T {
  if (value === undefined) {
    throw new Error(`demo.config.ts: ${field} is required`);
  }
  return value;
}

must(demo.name, 'name');
must(demo.build?.command, 'build.command');
must(demo.build?.output, 'build.output');
must(demo.clock?.anchor, 'clock.anchor');
must(demo.clock?.timezone, 'clock.timezone');
must(demo.entries?.app, 'entries.app');

/**
 * The app's own root — one level above wherever `demo/` sits inside it — and
 * every filesystem path below is resolved from here, never `process.cwd()`.
 * `pnpm demo`, `pnpm --filter <app> demo` and a bare `playwright test` run
 * from inside `demo/` are all normal ways to start a run and they have three
 * different working directories between them; a path relative to whichever
 * one was typed is a path nobody can find twice.
 */
export const APP_ROOT = fileURLToPath(new URL('../../', import.meta.url));

export const STAGE = {
  width: Number(process.env.DEMO_WIDTH ?? demo.stage?.width ?? 1920),
  height: Number(process.env.DEMO_HEIGHT ?? demo.stage?.height ?? 1080),
} as const;

/**
 * The video and the stills are captured at different scales, on purpose.
 *
 * These used to be one number and it forced a choice nobody should have to
 * make. Measured on this machine, same scene, same choreography: at 1080p the
 * motion runs 760 of 793 inter-frame gaps inside 34ms, and at 4K a hundred and
 * sixty of three hundred fall slower than 20fps. That is not a bug to fix, it
 * is a fixed pixels-per-second budget, and a push-in is exactly when it runs
 * out — so 4K video zooms visibly stepped.
 *
 * They can be separated because the two capture paths read different things.
 * CDP's screencast follows the *browser's* device scale factor, while
 * `page.screenshot` follows the context's own. So the browser runs at 1x for
 * smooth 60fps video and the context at 2x for retina stills, and the corpus
 * gets both instead of trading one for the other.
 */
export const VIDEO_SCALE = Number(process.env.DEMO_VIDEO_SCALE ?? 1);
export const STILL_SCALE = Number(process.env.DEMO_STILL_SCALE ?? 2);

/** The zone every seeded instant is stated in, and the page is pinned to. */
export const TZ = demo.clock.timezone;

export const LOCALE = demo.clock.locale ?? 'en-US';

/** The instant the whole corpus is filmed at — see `demo.config.ts`'s own `clock.anchor` comment for why it's a fixed literal. */
export const ANCHOR = new Date(demo.clock.anchor);

/**
 * The rate the capture can actually sustain at this resolution, not a wish.
 *
 * Screencast throughput on this hardware is roughly constant in pixels per
 * second, so the frame rate is a consequence of the frame size: measured at
 * about 84fps for 1080p, 52 for 1440p and 30 for 4K. Encoding 4K at 60 would
 * mean duplicating every second frame, which is not smoother than 30 — it is
 * 30 with a longer file and a number that flatters it. So the default follows
 * the stage, and `DEMO_FPS` overrides for anyone who has measured otherwise.
 */
export const FPS = Number(
  process.env.DEMO_FPS ?? (STAGE.width * VIDEO_SCALE >= 3840 ? 30 : 60)
);

/**
 * The capture at 1:1 rather than a downscale of it.
 *
 * A stage at `VIDEO_SCALE: 2` is a surface twice its width and height, so
 * this encodes what the compositor drew with no resampling in between. That
 * is the whole of the quality argument: any output smaller than the capture
 * is a filter, and any output larger is an invention.
 */
export const VIDEO = {
  width: STAGE.width * VIDEO_SCALE,
  height: STAGE.height * VIDEO_SCALE,
  crf: 18,
  webmCrf: 32,
} as const;

/** VP9 at 4K costs more time than it is worth unless somebody asks. */
export const WEBM = process.env.DEMO_WEBM === '1';

/**
 * Whether to stitch the tour at all. Purely a run-time choice: the tour is a
 * quarter of a gigabyte per theme at length, and a run iterating on one scene
 * does not want to rebuild it.
 */
export const TOUR = process.env.DEMO_TOUR
  ? process.env.DEMO_TOUR !== '0'
  : true;

/**
 * The editorial order, and where an unlisted scene goes.
 *
 * Returns a sort index, so a scene the config never mentions lands after every
 * scene it does. That way adding a scene is not a config edit, and a corpus
 * mid-build still tells a coherent story.
 */
export function tourIndex(scene: string): number {
  const order = demo.tour ?? [];
  const at = order.indexOf(scene);
  return at === -1 ? order.length : at;
}

/**
 * Kept as a list rather than collapsed to a constant: the manifest keys assets
 * by theme and the preview page switches on it, so a corpus that wants light
 * back is `DEMO_THEMES=light,dark` (or `themes: ['light', 'dark']` in
 * `demo.config.ts`) and nothing else has to change.
 */
export const THEMES = (
  process.env.DEMO_THEMES ?? (demo.themes ?? ['dark']).join(',')
)
  .split(',')
  .map((theme) => theme.trim())
  .filter(Boolean) as Theme[];

/**
 * Overridable so two studio runs can coexist. The default is owned by the run
 * rather than shared: see `reuseExistingServer` in `playwright.demo.ts`.
 */
export const PORT = Number(process.env.DEMO_PORT ?? 5499);
export const BASE_URL = `http://localhost:${PORT}`;

/**
 * Where the corpus lands, and where frames wait to be encoded. Both are
 * absolute, resolved from `APP_ROOT` rather than `process.cwd()` — see the
 * comment on `APP_ROOT` for why that distinction is load-bearing.
 */
export const OUT_DIR = process.env.DEMO_OUT ?? join(APP_ROOT, 'demo-out');

/**
 * Inside the output directory, so `DEMO_OUT` isolates a whole run.
 *
 * Frames used to live in one fixed place beside the corpus, which made them a
 * third shared resource after the port and the manifest: a run sweeping its
 * own leftovers deleted the in-flight frames of a run filming next to it, and
 * the victim reported a missing-file error that pointed nowhere near the
 * cause. One knob now moves everything a run writes.
 */
export const FRAME_DIR = join(OUT_DIR, '.frames');

/**
 * One worker at 4K, two below it.
 *
 * Screencast throughput is roughly a fixed number of pixels per second on
 * this machine, and two browsers filming 3840x2160 at once split it: each
 * clip then lands under its own frame-rate floor and the whole corpus gets
 * flagged for a reason that has nothing to do with the app. At 1080p there is
 * headroom for two, and the run is half as long. Not a `demo.config.ts`
 * field: it is a consequence of the stage, not a fact about the app.
 */
export const WORKERS = Number(
  process.env.DEMO_WORKERS ?? (STAGE.width * VIDEO_SCALE >= 3840 ? 1 : 2)
);

/** Prints every main-frame navigation and page error — see `stage.ts`. */
export const TRACE_NAV = Boolean(process.env.DEMO_TRACE_NAV);

/** Prints the gap histogram for every clip — see `recorder.ts`. */
export const TRACE_FRAMES = Boolean(process.env.DEMO_TRACE_FRAMES);

/** Off films silent rather than downloading the voice model behind anyone's back. */
export const VOICE_ENABLED = process.env.DEMO_VOICE !== '0';
