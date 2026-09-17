import { defineConfig, devices } from '@playwright/test';

import {
  APP_ROOT,
  BASE_URL,
  LOCALE,
  PORT,
  STAGE,
  STILL_SCALE,
  THEMES,
  TZ,
  VIDEO_SCALE,
  WORKERS,
} from './studio/config.ts';

/**
 * The studio's own runner, deliberately not the e2e one.
 *
 * The suite next door is tuned for throughput — four workers, a retry, its own
 * artifacts on failure. Filming wants the opposite of all three. Two workers,
 * because a screencast at this resolution competes with the compositor for the
 * same thread and a third browser is what turns a 60fps capture into a 40fps
 * one. No trace and no video, because Playwright's own recording is the thing
 * `studio/recorder.ts` exists to replace. And `--forbid-only` off, because
 * filming one scene while iterating on it is the normal way to work here.
 *
 * `reducedMotion` is left at its default on purpose and set per page instead:
 * a demo with animations disabled is a demo of a different application.
 */
process.env.TZ = TZ;

export default defineConfig({
  testDir: './scenes',
  testMatch: '**/*.scene.ts',
  fullyParallel: true,
  /** `WORKERS` in `studio/config.ts` carries the reasoning: resolution, not taste. */
  workers: WORKERS,
  retries: 0,
  timeout: 4 * 60_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  use: {
    baseURL: BASE_URL,
    timezoneId: TZ,
    locale: LOCALE,
    trace: 'off',
    video: 'off',
    screenshot: 'off',
    viewport: { width: STAGE.width, height: STAGE.height },
    deviceScaleFactor: STILL_SCALE,
    launchOptions: {
      args: [
        /**
         * This sets the *video's* resolution, and it is not the same thing as
         * the context's `deviceScaleFactor` above, which sets the stills'.
         *
         * CDP's screencast hands back frames at the CSS viewport size and
         * ignores an emulated scale factor entirely, so only the browser's
         * real one changes what is captured. That is what makes the split
         * possible: 1x here for video the compositor can actually paint at
         * 60fps, 2x in the context for retina screenshots, and the corpus
         * stops having to choose. See `VIDEO_SCALE` in `studio/config.ts` for
         * the measurements behind picking 1.
         */
        `--force-device-scale-factor=${VIDEO_SCALE}`,
        // Lifts Chrome's own 60fps compositor cap so a paint is never held
        // back waiting for a vsync the headless browser does not have.
        '--disable-gpu-vsync',
        '--disable-frame-rate-limit',
        '--force-color-profile=srgb',
        '--font-render-hinting=none',
        '--hide-scrollbars',
      ],
    },
  },
  /**
   * `deviceScaleFactor` is repeated after the device spread deliberately:
   * `devices['Desktop Chrome']` carries its own `1`, project `use` beats
   * top-level `use`, and the result is a corpus of 1x screenshots that look
   * soft on every display sold in the last decade. It has to be restated
   * here, downstream of the spread, to survive.
   */
  projects: THEMES.map((theme) => ({
    name: theme,
    use: {
      ...devices['Desktop Chrome'],
      colorScheme: theme,
      viewport: { width: STAGE.width, height: STAGE.height },
      deviceScaleFactor: STILL_SCALE,
    },
  })),
  globalSetup: './studio/run-id.ts',
  globalTeardown: './studio/stitch.ts',
  webServer: {
    command: `node demo/serve.mjs demo/.build ${PORT}`,
    url: BASE_URL,
    cwd: APP_ROOT,
    /**
     * Never reused, and never a dev server.
     *
     * A corpus run died mid-flight to a dev server whose module graph belongs
     * to whoever is editing the source: one run when another session touched
     * the app's own source, one when an install rewrote `node_modules`
     * underneath the bundler. Both times the scenes that failed looked broken
     * and were not. `demo/serve.mjs` serves the pinned build
     * (`demo/.build`), which a keystroke cannot invalidate, and
     * `demo/pin-build.mjs` builds fresh before every run so the corpus is
     * always of the code in the tree. It is also the production bundle, which
     * is what anybody actually ships.
     */
    reuseExistingServer: false,
    stdout: 'ignore',
    stderr: 'pipe',
    timeout: 60_000,
  },
});
