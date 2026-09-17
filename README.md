# video-demo

A Claude Code skill that films a web app: narrated, zooming, cursor-driven
demo videos and retina stills, made on your own machine.

Say "record a demo of this app" in a repo, or "record a demo of
https://example.com". The agent works out how to set it up, films one
scene, shows you the mp4, and films the rest once you have said yes.

Per scene you get a 1080p60 mp4 with a local voice-over, a poster and
3840x2160 stills. Per run, a stitched tour, a manifest.json a website can
read, and a preview page. Nothing is installed into your project and
nothing leaves the machine.

## Install

```bash
git clone https://github.com/nilbuild/video-demo ~/.claude/skills/video-demo
~/.claude/skills/video-demo/scripts/install.sh
```

`install.sh` installs the engine and Chromium inside the skill, then runs
`scripts/doctor.sh`, which prints the one command that fixes each miss.

| | | |
|---|---|---|
| Node 22.18+ | required | the engine is TypeScript that Node loads itself |
| ffmpeg | required | `brew install ffmpeg` or `apt install ffmpeg` |
| Chromium | required | `install.sh` does it |
| uv + Kokoro voice | optional | `scripts/install-voice.sh`, ~350MB once; without it the film is silent |

Your project needs nothing: no Playwright, no scripts, no config changes.
macOS and Linux; Windows is not supported.

Update with `git -C ~/.claude/skills/video-demo pull && scripts/install.sh`.
For a team, clone into `<repo>/.claude/skills/video-demo` instead.

## Use

Say one of these in Claude Code:

- **"record a demo of this app"**, in the repo you want filmed
- **"record a demo of https://example.com"**, from anywhere

The agent picks the mode, sets itself up, proposes a handful of scenes and
films one. Then it stops and asks: that is your turn to fix the register of
the writing, the zoom, the pacing and the voice before twenty more scenes
inherit it.

Your config, mocks and scenes live in `~/.video-demo/<name>/`, one workspace
per project. Pass `--project <path>` to `scripts/scaffold.mjs` to keep them in
the repo instead, committed like a test suite.

## Output

```
~/.video-demo/<name>/demo-out/
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
swaps a still for a clip on hover, or light for dark on a theme toggle,
without knowing anything about how the corpus was made.

## Two modes

| | `build` | `site` |
|---|---|---|
| films | a repo it builds | a URL already live |
| needs | a build command and its output dir | one line: `site: 'https://…'` |
| mocks | every request, in-process | none; the site answers |
| clock | pinned to a fixed instant | the real one |
| reproducible | yes | no, it films what was served |

`build` is the mode for anything signed in, and the only one whose corpus is
safe to publish and repeatable next month. `site` is for a public page, a
deploy preview, a marketing site. Same camera, same cursor, same voice.

## A scene

```ts
import { scene } from 'video-demo/scene';
import { row } from '../ui.ts';

scene('tasks', { title: 'Your to-dos, beside your calendar', blurb: '...' },
  async ({ actor, page, shot }) => {
    await actor.click(page.getByRole('radio', { name: 'Today' }));
    await actor.settle();
    await actor.spotlight(
      row(page, 'Send Sam the feedback'),
      'And this one is from yesterday that I never got to, so it is flagged.',
      { scale: 1.8, stay: true }
    );
    await shot('overdue');
    await actor.unfocus();
  });
```

`spotlight` takes the narration line, then moves camera and cursor over its
opening words, so the pointer arrives with the sentence rather than before it.
[scenes.md](references/scenes.md) has the rules.

## Running it

```bash
scripts/demo                                # the whole corpus
scripts/demo --grep tasks                   # one scene, merged into the manifest
DEMO_BUILD=0 scripts/demo --grep tasks      # skip the rebuild while iterating
DEMO_VOICE=0 scripts/demo                   # silent
scripts/demo --project ~/.video-demo/other  # a workspace by path
```

Run it from inside the app to film that app; a workspace records which repo it
belongs to, so it is found again without a flag.

| | |
|---|---|
| `DEMO_BUILD=0` | film the pinned build instead of making a new one |
| `DEMO_VOICE=0` | film silent |
| `DEMO_THEMES` | `light,dark` to film both; one theme is the default |
| `DEMO_PORT` / `DEMO_OUT` | two runs at once without collision |
| `DEMO_TRACE_FRAMES=1` | print the inter-frame gap histogram per clip |

[runs.md](references/runs.md) has the rest, and `scripts/gaps.mjs demo-out`
fails a corpus whose motion is stepped.

## Layout

```
SKILL.md              what the agent reads
engine/               the studio: capture, cursor, camera, voice, stitching
template/             the stubs a new workspace starts from
scripts/              install, doctor, scaffold, demo, install-voice, say, gaps, probe-fps
references/           config, mocking, scenes, narration, capture, runs, troubleshooting
examples/calendar/    the app-side half of a real demo, to read
```

The engine lives here and runs from here. One clone films every project on the
machine, so a fix reaches all of them and nothing is vendored anywhere.

## Licence

MIT.
