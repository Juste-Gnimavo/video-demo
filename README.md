# video-demos

A Claude Code skill that films a web app: narrated, zooming, cursor-driven
demo videos and retina screenshots, from a pinned production build against
mocked data, entirely on your own machine.

You say "make a video demo of this app" in the repo. It works out how the app
builds and what it renders, writes a config and a mock layer, films one scene,
shows it to you, and only then films the rest.

```
$ pnpm demo

demo: building (VITE_API_URL=/api pnpm run build)
demo: pinned build/client to demo/.build

Running 28 tests using 2 workers
  ✓  1 [dark] › week (22.6s)
  ✓  2 [dark] › tasks (43.1s)
  …

  captured
    dark  week              74.3fps in motion  worst gap  33ms   18.8s    617 frames  3 still(s)   4 spoken
    dark  tasks             50.6fps in motion  worst gap  60ms   36.7s    735 frames  5 still(s)   6 spoken
  ! dark  mcp               22.2fps in motion  worst gap 123ms   21.2s    256 frames  4 still(s)   3 spoken
    dark  smoke                held, barely moves    4.5s        2 frames  1 still(s)   1 spoken

  demo-out/manifest.json  (28 scenes, 28 clips; 28 filmed this run)
  demo-out/index.html     open this to look at the corpus

  1 clip(s) under 45fps of real paints — encoded at 60 regardless, so they
  will read as judder:
    dark/mcp at 22.2fps

  28 passed (7.3m)
```

That last part is the point of the report, not an accident of this run: `mcp`
opens a large settings dialog, and the app repaints slowly enough while the
pointer crosses it that the clip is honestly 22fps. The run says so rather
than encoding 60fps over it and calling it done.

## What comes out

```
demo-out/
  manifest.json        every scene, per theme: clip, stills, poster, duration,
                       measured frame rate, gap histogram, lines spoken
  index.html           a preview page that reads only the manifest
  dark/
    tasks.mp4          1920x1080 @ 60fps, voice-over on the audio track
    tasks.poster.jpg
    tasks-overdue.png  3840x2160
    full-tour.mp4      every clip, stream-copied end to end
```

`manifest.json` is the whole interface between a corpus and a website. A page
swaps a still for a clip on hover, or light for dark on a theme toggle, without
knowing anything about how the corpus was made. `index.html` exists to prove
that: it reads nothing else.

## Install

Clone it anywhere, then link it where Claude Code looks for skills:

```bash
git clone <this repo> ~/skills/video-demos
ln -s ~/skills/video-demos ~/.claude/skills/video-demos
~/skills/video-demos/scripts/doctor.sh
```

`doctor.sh` checks what a run actually depends on and prints the one command
that fixes each miss. Then, in the app's repo, ask for a demo video.

## How a demo gets made

The agent follows `SKILL.md`. Roughly:

1. **Discovery, writing nothing.** The build command and output directory, the
   API base and any real host in `.env`, the key the theme boot script reads,
   what the main screen shows once its data lands, the selectors (an existing
   e2e helper module first, then `data-testid`), an existing fixture API or MSW
   handlers, and which routes carry no credential.
2. **`demo/demo.config.ts`.** The one file that knows the app exists.
   Everything under `studio/` reads it and imports nothing of yours.
3. **`demo/mock.ts` and `demo/seed/`.** Every request the app makes, answered
   in-process, around a pinned clock.
4. **The smoke scene.** Open the app, hold still, take one still. It proves the
   build was pinned and served, the mocks answered, readiness resolves when the
   app is genuinely ready, and the capture holds its rate. Four things which,
   if any is wrong, make every richer scene fail while pointing somewhere else.
5. **One real scene, then a full stop.** The agent films it, hands you the mp4
   and asks about the writing, the zoom scale, the pacing and the voice. It is
   told to write nothing else until you answer. On the demo this was built
   from, that gate caught four defects before twenty-six more scenes were
   filmed with them.
6. **Then batches**, `--grep` at a time, merged into the manifest per scene and
   per theme.

## A scene

A scene is one file, filmed once, yielding both the clip and the stills:

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

`actor` moves a real cursor: an eased tween sampled at the capture rate with a
CDP mouse event per sample, so hover, drag thresholds and pointer capture all
behave as they do for a person. `spotlight` takes the narration line, then
moves camera and cursor over its opening words, so the pointer arrives with the
sentence rather than a second and a half before it.

The rule that took longest to learn is in that snippet: **do the gesture, then
narrate while pushed in on the result.** Narrating first means talking about
something that is not on screen yet, and it is what made an early cut zoom at
what felt like the wrong moments.

## How it films

`Page.startScreencast` over CDP, which hands back a JPEG **per paint** rather
than on a clock. So a frame's spacing is the real spacing of the animation, a
held moment costs nothing, and every frame's own timestamp is kept and handed
to ffmpeg's concat demuxer as an explicit duration, resampled onto a constant
grid at the end. Playwright's own `recordVideo` is the obvious alternative and
gives no control over rate, resolution or where a clip starts.

What cannot be fixed downstream is a paint that never happened, so every clip
reports the rate it actually achieved during motion, plus the distribution
behind it. Both matter. A mean that excludes idle gaps hides judder completely:
a 4K clip that visibly stepped reported a healthy 34fps while 160 of its 300
inter-frame gaps were slower than 20fps.

Three things follow from measuring rather than assuming:

- **Video and stills are captured at different scales.** CDP's screencast
  follows the *browser's* device scale factor; `page.screenshot` follows the
  *context's*. So the browser runs at 1x for motion the compositor can paint at
  60fps, and the context at 2x for retina stills. These used to be one number,
  which forced a choice nobody should have to make.
- **Frame rate is a consequence of frame size.** Throughput is roughly constant
  in pixels per second: measured on an M-series Mac, about 84fps at 1080p,
  52 at 1440p, 30 at 4K. 4K60 would duplicate every second frame, which is not
  smoother than 30, just larger.
- **What counts as motion is something the actor says, not something
  inferred.** "Any gap under 50ms is motion" is the obvious rule and it fails
  both ways: typing at a human 58ms a character reads as a stalled animation,
  while a dialog held open for twenty seconds fills the distribution with gaps
  that were never motion at all. So the actor brackets its own tweens, wheel
  sweeps and camera transitions, and the rate is measured inside those.
- **A rate needs a sample, measured in seconds.** Under a second of animation,
  a clip is reported as `held` rather than rated. The floor is time and not a
  count of paints, because a clip that judders paints *less* — a paint-count
  floor excuses precisely the worst clips.

## Voice-over

Every `actor.say` line is spoken by [Kokoro-82M](https://github.com/thewh1teagle/kokoro-onnx)
running locally as ONNX on the CPU. There are no subtitles: the voice is the
channel, and a demo that needs both is a demo saying the same thing twice.

`say` holds for as long as its line takes to speak, so the choreography and the
narration cannot drift apart, and a closing line that outruns its clip holds
the last frame rather than being cut mid-word. Lines are cached by a hash of
the text together with every setting that decides what the audio sounds like,
so re-filming a scene re-cuts nothing, and a second theme speaks nothing at
all.

Install is deliberately not automatic: a missing model prints the commands and
films silent rather than pulling a quarter of a gigabyte on a metered
connection. `scripts/install-voice.sh` does it once per machine, and
`scripts/say.sh` auditions a line before committing a scene to it.

## Running it yourself

Once an app is scaffolded, `package.json` has `demo` and `demo:doctor`:

```bash
pnpm demo                                # the whole corpus
pnpm demo -- --grep tasks                # one scene, merged into the manifest
pnpm demo -- --grep "tasks|undo"         # a batch
DEMO_BUILD=0 pnpm demo -- --grep tasks   # skip the rebuild while iterating
DEMO_VOICE=0 pnpm demo                   # silent
pnpm demo:doctor                         # check this machine
```

| variable | for |
|---|---|
| `DEMO_BUILD=0` | film the build already pinned, instead of making a new one |
| `DEMO_VOICE=0` | film silent |
| `DEMO_PORT` / `DEMO_OUT` | run two corpora at once without collision |
| `DEMO_THEMES` | `light,dark` to film both; one theme is the default |
| `DEMO_WIDTH` / `DEMO_HEIGHT` | a different stage |
| `DEMO_VIDEO_SCALE` / `DEMO_STILL_SCALE` | the two capture scales, separately |
| `DEMO_FPS` | override the rate the stage implies |
| `DEMO_TOUR=0` | skip the stitched tour |
| `DEMO_WEBM=1` | also encode VP9 |
| `DEMO_TRACE_FRAMES=1` | print the gap histogram as the run goes |
| `DEMO_TRACE_NAV=1` | print every navigation and page error |

Two concurrent runs need both `DEMO_PORT` and `DEMO_OUT`: everything a run
writes, including the frames on their way to being encoded, lives under the
latter. Without them, runs race on the port, overwrite each other's stills,
lose entries from a shared manifest, and delete each other's in-flight frames.
All four happened. If a port is busy, take the next one rather than killing
what is on it, which is how one run ended another mid-flight.

`scripts/gaps.mjs demo-out` reads a finished manifest and fails if any clip
spends more than a quarter of its gaps slower than 50ms.

## Requirements

| | |
|---|---|
| Node | 22.18+ (the config is imported under type stripping) |
| ffmpeg | with `libx264`; `h264_videotoolbox` is used when present |
| Playwright | Chromium (CDP screencast is Chromium only) |
| uv | only to install the voice model |
| voice | Kokoro-82M, ~350MB, once, via `scripts/install-voice.sh` |

macOS is the tested platform. Linux works, encoding with x264 instead of
VideoToolbox. Windows is not supported: `nice`, the encoder detection and the
path handling all assume a POSIX shell.

## Everything is local

No audio, no frames and no data leave the machine. That is deliberate rather
than incidental. A demo is filmed against mocked data precisely so a published
corpus cannot carry real records, and it would be strange to then upload the
narration.

## Layout

```
SKILL.md              what the agent reads
references/           config, mocking, scenes, narration, capture, runs, troubleshooting
scripts/              doctor, install-voice, scaffold, say, gaps, probe-fps, update-studio
template/demo/        what gets copied into an app
  demo.config.ts      the seam: the one file the engine reads app knowledge from
  mock.ts, seed/, ui.ts, scenes/smoke.scene.ts
  run.mjs, pin-build.mjs, serve.mjs, playwright.demo.ts
  studio/             the portable engine, vendored into each app
examples/calendar/    the app-side half of a real demo, to read
```

The engine is vendored into each app rather than published as a package: an
agent in a fresh repo can read and patch it, there is no version to bump, and
`scripts/update-studio.mjs` carries a fix into an app that already has an older
copy. The price is that a fix has to be made in `template/` too, or the next
demo inherits the bug.

## Where this came from

Built by filming a calendar app end to end, then taken back apart: the engine
was extracted, the app re-scaffolded onto it, and all twenty-eight scenes
re-filmed from the extracted copy to prove the extraction had not broken
anything. That pass found five defects worth naming, because each of them
presents as something other than what it is:

- `pnpm demo -- --grep smoke` silently filmed the whole corpus. pnpm appends
  the `--`, Playwright reads everything after it as file filters, and nothing
  warns. A shell `&&` cannot fix this, so a script owns the arguments now.
- A static `import { mock }` in the config killed the run before it filmed
  anything, because the config is also read by plain Node, whose resolver will
  not follow an extensionless specifier.
- A scene's `preferences` were written as literal `localStorage` entries, which
  is wrong for any app that keeps a JSON blob under one key. They go through
  the app's own serializer now.
- The jank check condemned the `smoke` scene, which holds still by design.
- A scene spent the app's six-second undo window on narration, and filmed an
  Undo that appeared not to work.

Most of `references/` is like those: a bug that took a while to find, written
down with its cause, so the next person recognises the symptom. The gap
histogram, the cursor's `translate` property, the fixed transform origin and
the one-scene approval gate are all there because something looked broken and
was not, or looked fine and was.
