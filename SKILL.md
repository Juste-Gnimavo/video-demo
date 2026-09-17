---
name: video-demos
description: Film a narrated, zooming, cursor-driven demo of a web app from a pinned build against mocked data: 1080p60 mp4 clips with a local Kokoro voice-over, retina stills, a stitched tour, a manifest.json and a preview page a site can read. Use when the user asks for a demo video, product video, walkthrough, screencast, screen recording of an app, hero or landing-page footage, app screenshots for a website, "show off this feature", or wants to add, re-film, re-narrate or fix a demo scene.
---

# Video demos

One command films a web app and writes `demo-out/`: per scene an mp4 with
voice-over, a poster, retina stills, plus `full-tour.mp4`, `manifest.json` and
`index.html`. All local. Nothing touches a real account.

## Non-negotiables

Each of these cost a run or a user's patience.

1. **A pinned build, never a dev server.** Its module graph belongs to whoever
   is editing source. Copy it somewhere private and verify its API base by
   reading the bundle.
2. **Mock every request in-process; pin the clock.** A corpus gets published,
   and a real account publishes real people's addresses.
3. **Own your port and output directory.** The studio refuses to adopt a server
   it did not start. Never `pkill` by pattern.
4. **1080p60 video, 2x stills.** They are separate settings. 4K video judders
   because throughput is a fixed pixels-per-second budget.
5. **Do the gesture, then narrate while pushed in on the result.** One subject
   per line. Never narrate before the subject exists. Where the app has its own
   timer — an undo window, a toast — the gesture goes inside it and the words
   after, or the film shows a feature that does not work.
6. **One scene, then stop and ask** (step 7). It caught four defects before
   twenty-six more scenes were filmed.
7. **Read the PNG, every time.** A scene that passes while framing the wrong
   thing is a failure, and only an eye on the still catches it.

## Workflow

1. `scripts/doctor.sh`. If the voice model is missing, say it is a ~350MB
   download, offer `scripts/install-voice.sh`, and film silent until then.
2. **Discover, writing nothing.** Build command and output; the API base and
   any real host in `.env` (that host goes in `build.forbid`); the key the theme
   boot script reads; what the main screen shows once data lands; selectors,
   preferring an existing e2e helper module, then `data-testid`, then roles;
   an existing fixture API or MSW handlers; routes, noting credential-free pages.
3. `scripts/scaffold.mjs <appRoot>`. It writes the engine and the stubs that
   steps 4 and 5 fill in, so it comes before them, not after: there is no
   `demo/` to write into until it has run, and running it later either refuses
   or overwrites what you wrote.
4. **Fill in `demo/demo.config.ts`.** A required field still unknown means
   discovery is not done. [config.md](references/config.md)
5. **Write `demo/mock.ts` and `demo/seed/`**, then `DEMO_VOICE=0 pnpm demo --
   --grep smoke`. Reuse the repo's fixture API if it has one
   ([mocking.md](references/mocking.md)). Read the still: signed in, seeded
   data, right theme, no login page. Read the capture line. Fix until both are
   right, then write `demo/ui.ts` with only what the smoke run proved.
6. **Propose 6 to 10 scenes**, each a title and a one-line blurb, in tour order.
   Ask which to film first.
7. **STOP.** Film that one scene with voice. Verify the spoken count matches the
   `say` calls, nothing overran, the rate held. Read every still. Give the user
   the mp4 path and ask about the writing's register, the zoom scale, the pacing
   and the voice. **Write nothing else until they answer.**
8. Then batches of three or four via `--grep`; the manifest merges. Read the
   stills after every batch. `DEMO_BUILD=0` skips the rebuild while iterating
   on a scene — twenty seconds instead of four minutes; drop it for the run
   that produces the corpus.
9. Full run with `DEMO_TRACE_FRAMES=1`, then `scripts/gaps.mjs` and open
   `demo-out/index.html`. Report the capture table and any slow clips.

## A scene

```ts
scene('tasks', { title: 'Your to-dos, beside your calendar', blurb: '...' },
  async ({ actor, page, shot }) => {
    await actor.click(page.getByRole('radio', { name: 'Today' }));
    await actor.settle();
    await actor.spotlight(
      row('Send Sam the feedback'),
      'And this one is from yesterday that I never got to, so it is flagged.',
      { scale: 1.8, stay: true }
    );
    await shot('overdue');
    await actor.unfocus();
  });
```

`spotlight` takes the narration mark, then moves camera and cursor over the
line's opening words. Scale by subject: panel ~1.4, row ~1.7, single control ~2.
A line about the whole screen gets a plain `say` and no zoom.
[scenes.md](references/scenes.md) · [narration.md](references/narration.md)

## Never

Subtitles (the voice is the channel). Cloud TTS (the film is of private data).
Playwright's `recordVideo` (no control of rate, size or start; the recorder
replaces it). 4K as a default. Music, intro cards or cross-fades. Scenes
generated from a route crawl: a scene is choreography with a point. Retries: a
retried scene is a different film.

## Also

[capture.md](references/capture.md) before changing any capture number.
[runs.md](references/runs.md) for builds, isolation and the manifest.
[troubleshooting.md](references/troubleshooting.md) when a run dies or a shot
looks wrong. Fixes to `studio/` belong in this skill's `template/` too, or the
next demo inherits the bug.
