import type { Page, Route } from '@playwright/test';

import type { FixtureApi } from '../e2e/support/fixtures.ts';
import { createFixtureApi, eventDto } from '../e2e/support/fixtures.ts';
import {
  DEMO_ACCOUNTS,
  DEFAULT_CALENDAR,
  PERSONAL,
  WORK,
} from './seed/accounts.ts';
import {
  createDemoBookingPage,
  createDemoSchedulingLinks,
} from './seed/links.ts';
import { publicLink, publicPage } from './seed/public-booking.ts';
import { createDemoTasks } from './seed/tasks.ts';
import { createDemoDiary } from './seed/week.ts';
import { HANDLE, VIEWER } from './seed/viewer.ts';
import type { MockContext } from './studio/define.ts';

/**
 * The whole server, for the length of a film.
 *
 * Every byte the app reads during a demo is answered in this process. That is
 * not a convenience, it is the requirement: a demo corpus filmed against a
 * real account would be filmed against real meetings with real people's names
 * and addresses in them, and it would look different every time it ran. So
 * there is no API, no database, no Google — a `page.route` per surface, a
 * pinned clock, and a diary in memory.
 *
 * Writes are absorbed rather than swallowed. `createFixtureApi` is the e2e
 * suite's own mock, which models a write the way the real route does — a
 * scoped edit detaches a sitting, an RSVP lands on the viewer's own row, a
 * flag mints the hidden task — and the reason the demo borrows it rather than
 * faking 200s is that a scene does not end when it writes. The panel reads
 * back, the sweep reads back, the grid rehydrates by id; a stub answering
 * "fine" to everything would show the viewer's change being quietly undone
 * on film.
 *
 * Route precedence is Playwright's: last registered, first asked. Broad
 * handlers go on first here, so the catch-all is the handler of last resort
 * and no request escapes to the dev server to come back as a page of HTML.
 */

/**
 * What the panels send. Narrow on purpose: `Record<string, unknown>` would
 * typecheck and then quietly stringify an object into a title.
 */
type LinkInput = {
  title?: string;
  slug?: string;
  description?: string | null;
  durationMinutes?: number;
  windows?: { start: string; end: string }[];
};

export type DemoServer = {
  api: FixtureApi;
  /** Bookings the booking page took during the film, newest first. */
  booked: unknown[];
};

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

function calendarsPayload() {
  return {
    accounts: DEMO_ACCOUNTS,
    defaultCalendarId: DEFAULT_CALENDAR,
  };
}

/**
 * One rule, and it is the one worth showing: the studio diary projected onto
 * the employer's calendar as opaque time with no titles on it, so a colleague
 * looking for a slot sees a wall and not a physio appointment. See ADR 0030.
 */
const BLOCK_RULES = [
  {
    id: 'blk_personal_to_work',
    sourceCalendarId: PERSONAL,
    targetCalendarId: WORK,
    mode: 'busy' as const,
    createdAt: '2026-08-19T09:00:00.000Z',
    paused: null,
  },
];

const MCP_KEY = {
  preview: 'cal_live_7Qa2…f19d',
  createdAt: '2026-09-02T14:12:00.000Z',
  lastUsedAt: '2026-09-15T21:44:00.000Z',
};

/**
 * `main`, `secondary` and `description`, which is how Google spells a place
 * and therefore how the location field reads one. A stub that invents its own
 * field names answers 200 with a list the field draws as blank rows — the
 * failure looks like a styling bug and is a contract one.
 */
const PLACES = [
  {
    id: 'plc_kings',
    main: 'Kings Place',
    secondary: '90 York Way, London N1 9AG',
    description: 'Kings Place, 90 York Way, London N1 9AG',
  },
  {
    id: 'plc_trullo',
    main: 'Trullo',
    secondary: '300-302 St Paul’s Road, London N1 2LH',
    description: 'Trullo, 300-302 St Paul’s Road, London N1 2LH',
  },
  {
    id: 'plc_eagle',
    main: 'The Eagle',
    secondary: '159 Farringdon Road, London EC1R 3AL',
    description: 'The Eagle, 159 Farringdon Road, London EC1R 3AL',
  },
  {
    id: 'plc_lido',
    main: 'London Fields Lido',
    secondary: 'London Fields West Side, London E8 3EU',
    description: 'London Fields Lido, London Fields West Side, London E8 3EU',
  },
];

export async function mock(page: Page, ctx: MockContext): Promise<DemoServer> {
  const reference = ctx.reference;
  const signedIn = ctx.signedIn;

  const api = createFixtureApi(reference, {
    events: (at) => createDemoDiary(at).map(eventDto),
    tasks: (at) => createDemoTasks(at),
  });

  let links = createDemoSchedulingLinks(reference);
  let bookingPage = createDemoBookingPage(reference);
  const booked: unknown[] = [];

  await page.addInitScript(() => {
    (window as Window & { __calendarWired?: boolean }).__calendarWired = true;
  });

  await page.route('**/api/**', (route) => json(route, {}));

  await page.route('**/api/v1/events**', (route) => {
    if (new URL(route.request().url()).pathname.endsWith('/updates')) {
      return route.abort();
    }
    const request = route.request();
    const answer = api.answer(
      request.method(),
      new URL(request.url()),
      request.postDataJSON() as unknown
    );
    return json(route, answer.body, answer.status);
  });

  await page.route('**/api/v1/tasks**', (route) => {
    const request = route.request();
    const answer = api.answerTasks(
      request.method(),
      new URL(request.url()),
      request.postDataJSON() as unknown
    );
    return json(route, answer.body, answer.status);
  });

  await page.route('**/api/v1/sync/incremental**', (route) =>
    json(route, {
      events: [],
      cursors: [],
      errors: [],
      tasks: { tasks: [], cursor: 'demo-tasks-cursor' },
    })
  );

  await page.route('**/api/v1/calendars**', (route) =>
    json(route, calendarsPayload())
  );
  await page.route('**/api/v1/blocks**', (route) =>
    json(route, { rules: BLOCK_RULES })
  );
  await page.route('**/api/v1/auth/me', (route) => {
    if (!signedIn) {
      return json(route, { message: 'No session' }, 401);
    }
    return json(route, { ...VIEWER, username: HANDLE });
  });
  await page.route('**/api/v1/mcp/key', (route) => {
    if (route.request().method() === 'POST') {
      return json(route, {
        key: 'cal_live_7Qa2NxHc0vTbKpR4sZmEjWu6yLdQf19d',
        ...MCP_KEY,
      });
    }
    if (route.request().method() === 'DELETE') {
      return json(route, {});
    }
    return json(route, { key: MCP_KEY });
  });

  await page.route('**/api/v1/places**', (route) => {
    const term = (new URL(route.request().url()).searchParams.get('q') ?? '')
      .trim()
      .toLowerCase();
    const found = term
      ? PLACES.filter((place) => place.description.toLowerCase().includes(term))
      : PLACES;
    return json(route, { places: found.slice(0, 5) });
  });

  await page.route('**/api/v1/scheduling/links**', (route) => {
    const request = route.request();
    const method = request.method();
    const path = new URL(request.url()).pathname;
    const id = path.replace(/^.*\/scheduling\/links\/?/, '');

    if (method === 'POST') {
      const body = request.postDataJSON() as LinkInput;
      const made = {
        ...links[0]!,
        id: `slk_made_${links.length + 1}`,
        slug: `made-${links.length + 1}`,
        url: `${links[0]!.url.replace(/[^/]+$/, '')}made-${links.length + 1}`,
        title: body.title ?? 'Untitled',
        description: body.description ?? null,
        durationMinutes: body.durationMinutes ?? 30,
        windows: body.windows ?? [],
        bookings: [],
      };
      links = [made, ...links];
      return json(route, { link: made }, 201);
    }

    if (method === 'DELETE' && id) {
      links = links.filter((link) => link.id !== id);
      return json(route, {});
    }

    if (method === 'PATCH' && id) {
      const body = request.postDataJSON() as Record<string, unknown>;
      links = links.map((link) =>
        link.id === id ? { ...link, ...body } : link
      );
      return json(route, { link: links.find((link) => link.id === id) });
    }

    return json(route, { links });
  });

  /**
   * Broad first, so the specific handler below wins.
   *
   * Playwright asks handlers in reverse registration order, which makes route
   * order load-bearing and easy to get backwards: registered after the
   * handler below, this glob matches `/booking/links/...` too, answers every
   * write with the page unmutated, and the panel's optimistic update snaps
   * back a beat later on film. It reads as a bug in the app.
   */
  await page.route('**/api/v1/booking**', (route) =>
    json(route, { page: bookingPage })
  );

  await page.route('**/api/v1/booking/**', (route) => {
    const request = route.request();
    const method = request.method();
    const path = new URL(request.url()).pathname;

    if (method !== 'GET') {
      const body = (request.postDataJSON() ?? {}) as LinkInput &
        Record<string, unknown>;

      if (path.includes('/booking/links')) {
        const id = path.replace(/^.*\/booking\/links\/?/, '');
        if (method === 'DELETE') {
          bookingPage = {
            ...bookingPage,
            links: bookingPage.links.filter((link) => link.id !== id),
          };
          return json(route, {});
        }
        if (method === 'POST') {
          const made = {
            ...bookingPage.links[0]!,
            id: `bkl_made_${bookingPage.links.length + 1}`,
            slug: body.slug ?? `made-${bookingPage.links.length + 1}`,
            title: body.title ?? 'Untitled',
            durationMinutes: body.durationMinutes ?? 30,
            position: bookingPage.links.length + 1,
            hidden: false,
            disabled: false,
          };
          bookingPage = { ...bookingPage, links: [...bookingPage.links, made] };
          return json(route, { link: made }, 201);
        }
        bookingPage = {
          ...bookingPage,
          links: bookingPage.links.map((link) =>
            link.id === id ? { ...link, ...body } : link
          ),
        };
        return json(route, {
          link: bookingPage.links.find((link) => link.id === id),
        });
      }

      bookingPage = { ...bookingPage, ...body } as typeof bookingPage;
      return json(route, { page: bookingPage });
    }

    return json(route, { page: bookingPage });
  });

  /**
   * The guest's side of the seam, and the one route here with no session
   * behind it at all.
   *
   * `/@user/<slug>` resolves a one-time link first and a standing link
   * second (ADR 0034), which is why both come back from `publicLink` rather
   * than from two handlers: the address does not say which kind it is, and
   * the `kind` discriminant in the answer is how the page finds out.
   */
  await page.route('**/api/v1/meet/**', (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const rest = url.pathname
      .replace(/^.*\/v1\/meet\//, '')
      .replace(/\/+$/, '');
    const [username = '', slug] = rest.split('/');

    if (request.method() === 'POST') {
      const body = request.postDataJSON() as {
        start?: string;
        name?: string;
        email?: string;
      };
      booked.unshift(body);
      const start =
        body.start ??
        new Date(reference.getTime() + 26 * 3600_000).toISOString();
      const link = slug ? publicLink(reference, slug, null) : null;
      const minutes = link?.durationMinutes ?? 30;

      return json(route, {
        booking: {
          id: 'bkg_demo',
          title: link?.title ?? 'Intro call',
          start,
          end: new Date(
            new Date(start).getTime() + minutes * 60_000
          ).toISOString(),
          durationMinutes: minutes,
          host: { name: VIEWER.name },
          guestName: body.name ?? 'Jamie Rosen',
          guestEmail: body.email ?? 'jamie@example.org',
          meetingUrl: 'https://meet.google.com/dmo-book-ing',
          location: null,
        },
      });
    }

    if (username !== HANDLE) {
      return json(route, { message: 'No such page' }, 404);
    }

    if (!slug) {
      return json(route, publicPage(reference));
    }

    const link = publicLink(reference, slug, url.searchParams.get('month'));
    if (!link) {
      return json(route, { message: 'No such link' }, 404);
    }

    return json(route, link);
  });

  return { api, booked };
}
