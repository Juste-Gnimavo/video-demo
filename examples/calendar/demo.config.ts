import { defineDemo } from 'video-demo/define';
import { all, attribute, networkIdle, tallerThan, visible } from 'video-demo/ready';

/**
 * The one file that knows this app is a calendar.
 *
 * Everything under `studio/` reads the resolved value of this and imports
 * nothing of ours directly, which is what lets the engine be shared with
 * other apps — see `references/config.md` in the skill.
 */
export default defineDemo({
  name: 'calendar',

  build: {
    command: 'VITE_API_URL=/api pnpm run build',
    output: 'build/client',
    /**
     * The one bake that has actually broken a run.
     *
     * A build made for development carries the API's absolute address, so
     * every request leaves the studio's origin, CORS refuses it, the mocks
     * never see it, and the app sits on its login screen while scene after
     * scene fails looking for a grid. `pin-build.mjs` greps the bundle for
     * these before a frame is filmed, because the failure is silent and
     * points anywhere but here.
     */
    forbid: [/https?:\/\/localhost:8585/, 'api.example.com'],
  },

  stage: { width: 1920, height: 1080 },

  clock: {
    /** Wednesday 16 September 2026, 10:00 in Europe/London (BST, GMT+1). */
    anchor: '2026-09-16T09:00:00.000Z',
    /** The zone every seeded instant is stated in, and the page is pinned to. */
    timezone: 'Europe/London',
    locale: 'en-US',
  },

  themes: ['dark'],

  /**
   * `app/root.tsx` reads this key in a script that runs before React mounts,
   * precisely so no dark viewer ever sees a light frame (the app's own notes's
   * neighbour). Writing it here is what keeps the recorder from catching the
   * frame that script exists to prevent.
   */
  storage: (theme, overrides) => ({
    'calendar:preferences': JSON.stringify({
      theme,
      weekStartsOn: 1,
      hourCycle: '12',
      accountMenuSeen: true,
      ...overrides,
    }),
  }),

  entries: {
    /**
     * The grid is not ready when it is visible.
     *
     * The week is fetched rather than seeded, and the canvas sizes itself
     * from the window after the first paint — so a scene that reaches for a
     * chip on "visible" races both, and fails one run in five with a
     * locator error that says nothing about either. All four of these are
     * things the app itself says about its own state.
     */
    app: {
      path: '/',
      ready: all(
        visible('time-grid'),
        attribute('time-grid', 'data-loaded', 'true'),
        attribute('calendars-button', 'data-loaded', 'true'),
        tallerThan('time-grid', 900)
      ),
    },
    /**
     * A guest's booking page: the one surface in the product that holds no
     * credential. It has no grid and no calendar list to wait for, and the
     * `signedIn: false` is load-bearing — answering `auth/me` as the owner
     * regardless draws the owner's own bar over a page whose entire claim is
     * that it knows nothing about them.
     */
    public: {
      path: `/@pat`,
      signedIn: false,
      ready: networkIdle(),
    },
  },

  /**
   * Imported lazily, and that is not a style choice.
   *
   * This file is read by plain Node as well as by Playwright — `pin-build.mjs`
   * needs `build` before a browser exists — and plain Node's resolver has none
   * of the test runner's tolerance for an extensionless specifier. A static
   * import here pulls the mock's whole graph (the e2e fixtures, and through
   * them `@calendar/core`) into that resolver, and pinning the build dies on a
   * module path that has nothing to do with building. Deferring it means only
   * the runner ever evaluates the mock.
   */
  mock: (page, ctx) => import('./mock.ts').then((made) => made.mock(page, ctx)),

  /**
   * Kokoro reads "live" as in "hive" wherever it appears, and the grid's
   * copy means it as in "give". A respelling is cheaper than rewording every
   * line that wants the word.
   */
  voice: { name: 'af_heart', speed: 1, saidAs: [[/\blive\b/gi, 'liv']] },

  /**
   * The order the tour tells the story in.
   *
   * Alphabetical would be easier and wrong: a stitched tour has to open on
   * something recognisable and end on something that lands, and a viewer who
   * meets the MCP server before they have seen the week has been shown the
   * roof before the walls. Scenes not named here still film and still reach
   * the manifest; they simply fall to the end of the tour, in the order they
   * ran.
   */
  tour: [
    'week',
    'views',
    'month',
    'zoom',
    'create',
    'quick-add',
    'editor',
    'move',
    'series',
    'undo',
    'search',
    'command-menu',
    'shortcuts',
    'rail',
    'tasks',
    'task-to-grid',
    'calendars',
    'timezones',
    'travel',
    'blocking',
    'scheduling',
    'booking',
    'booking-public',
    'assistant',
    'settings',
    'mcp',
    'theme',
  ],
});
