# A worked example

These five files are the app-side half of a real demo, copied verbatim from the
calendar this engine was built for and filmed from. Twenty-eight scenes, one
theme, a local voice; every number in the reference tables elsewhere in this
skill was measured on it.

They are here to be read before writing your own, because the engine's shape is
much easier to see filled in than described:

| file                | what it shows                                                                    |
| ------------------- | -------------------------------------------------------------------------------- |
| `demo.config.ts`    | every required field answered for a real app, including the lazy `mock` import    |
| `mock.ts`           | a whole API answered in-process, reusing the repo's own e2e fixture               |
| `ui.ts`             | locators and geometry in one module, mostly re-exported from the e2e suite        |
| `tasks.scene.ts`    | the reference scene: gesture first, narration over the result                     |
| `undo.scene.ts`     | a beat written around the app's own six-second undo window                        |

Two things about them are worth saying out loud.

**`mock.ts` borrows the e2e suite's fixture API rather than answering 200 to
everything.** A scene does not end when it writes: the panel reads back, a
sweep reads back, the grid rehydrates by id. A stub that says "fine" to a write
and then hands back the old value on the next read films the viewer's own
change undoing itself, which looks exactly like a bug in the app and is a bug
in the mock.

**`ui.ts` is thin on purpose.** Most of it re-exports the e2e helpers, which
already encode things a demo would otherwise rediscover — that the month canvas
holds five weeks at once, that a minute of the day becomes a pixel through the
grid's own measured height. If the repo you are filming has an e2e suite, its
helpers are the first place to look for selectors, before writing any.

Do not copy these as a starting point. `scripts/scaffold.mjs` writes the
template's own stubs, which carry the TODOs and the reasoning; this directory
is what those stubs look like once an app has answered them.
