/**
 * Where the data behind a demo lives, in memory, never on a real backend.
 *
 * `mock.ts` calls into modules under this directory to build whatever
 * `createStore` seeds it needs, each keyed off the `reference` date `mock`
 * is handed rather than `new Date()` — so the same command produces the same
 * corpus next month. One file per entity is the usual shape:
 *
 *   seed/
 *     things.ts   export function createSeedThings(reference: Date): Thing[]
 *
 * Prefer a handful of *recurring* rules expanded across the visible range
 * over a fixed list of one-off rows — a generator gives you a populated
 * week no matter how far a scene scrolls; a fixed list runs out the moment
 * a scene goes past it, and a scene that scrolls into empty space looks
 * exactly like a broken scene rather than an under-seeded one.
 *
 * Never a real name, company or email domain, even as a placeholder meant to
 * be replaced later. Invented names on `example.com`/`.org`/`.net` read as
 * obviously fictional and can never collide with a real inbox — a corpus
 * gets published, and a real name in it is a real person's name on a
 * marketing site.
 */

export {};
