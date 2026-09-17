import type { Page } from '@playwright/test';

import type { Ready } from './ready.ts';

/**
 * The whole of what the studio is allowed to know about an app.
 *
 * `demo.config.ts` is the only file that names anything of yours — every
 * module under `studio/` reads the resolved value of this type (`demo`, in
 * `config.ts`) and nothing else. `defineDemo` returns its argument unchanged;
 * it exists only so the config file gets inference without writing out this
 * type by hand.
 */

export type Theme = 'light' | 'dark';

/** What `mock` is told, so it can answer the way the entry being filmed needs. */
export type MockContext = {
  reference: Date;
  entry: string;
  signedIn: boolean;
};

/**
 * One surface a scene can open — the signed-in app, a public page, anything
 * else the product has. There is no special case for "no session": a
 * credential-free page is an entry like any other, with `signedIn: false` and
 * a `ready` that does not wait on an app shell.
 */
export type Entry = {
  path: string;
  /** Nothing is filmed before this resolves. Compose predicates from `ready.ts`. */
  ready: Ready;
  /** Default true. Told to `mock` as `ctx.signedIn`, for routes like `auth/me`. */
  signedIn?: boolean;
};

export type DemoConfig<Server = unknown> = {
  /** Names the voice cache directory and shows up in the manifest. */
  name: string;
  build: {
    /** Whatever the repo already runs for a production build. Run from `APP_ROOT`. */
    command: string;
    /** Where the build writes, relative to `APP_ROOT`. */
    output: string;
    /**
     * Strings or patterns the built bundle must not contain, checked before
     * anything is filmed. A real API host baked in by a stray build is the
     * failure this catches: every request then goes cross-origin, the mocks
     * never see it, and the app sits on its login screen while scene after
     * scene fails looking for content. Default none.
     */
    forbid?: (string | RegExp)[];
  };
  /** Default `{ width: 1920, height: 1080 }`. */
  stage?: { width: number; height: number };
  clock: { anchor: string; timezone: string; locale?: string };
  /** Default `['dark']`. */
  themes?: Theme[];
  /**
   * localStorage entries written before first paint, already serialized.
   *
   * `overrides` is whatever a scene passed as its own `preferences`, in your
   * app's shape rather than the engine's — the engine cannot know that a
   * scene asking for a different starting time zone means one field inside a
   * JSON blob under one key. Fold them in wherever they belong and the
   * serialization stays yours:
   *
   *     storage: (theme, overrides) => ({
   *       'myapp:preferences': JSON.stringify({ theme, ...overrides }),
   *     })
   *
   * Default none, in which case a scene that passes `preferences` is an
   * error rather than a silent no-op.
   */
  storage?: (
    theme: Theme,
    overrides?: Record<string, unknown>
  ) => Record<string, string>;
  /** `app` is the entry a scene opens when it does not say otherwise. */
  entries: Record<string, Entry> & { app: Entry };
  /**
   * The whole server, for the length of a scene. Called before every
   * navigation, for every entry — a public page is mocked exactly like the
   * app is; it simply asks for `signedIn: false` in its own entry.
   *
   * Reach it with a dynamic `import('./mock.ts')` inside the arrow rather than
   * a static import at the top of `demo.config.ts`: this config is loaded by
   * plain Node too, and that resolver cannot follow an extensionless specifier
   * the way the test runner's can. The template's own stub shows the shape.
   */
  mock: (page: Page, ctx: MockContext) => Promise<Server>;
  voice?: { name?: string; speed?: number; saidAs?: [RegExp, string][] };
  /**
   * The order scenes appear in the manifest and the stitched tour.
   *
   * Editorial, which is why it lives in config rather than being derived.
   * Left out, scenes sort by name, and a tour that opens on `assistant` and
   * `blocking` before anyone has seen `week` shows the roof before the walls.
   * Names not listed here fall to the end, so adding a scene does not require
   * touching this.
   *
   * Whether to build the tour file at all is a run-time concern, not an
   * editorial one: `DEMO_TOUR=0`.
   */
  tour?: string[];
};

export function defineDemo<Server = unknown>(
  config: DemoConfig<Server>
): DemoConfig<Server> {
  return config;
}
