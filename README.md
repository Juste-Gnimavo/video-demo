# video-demo

A Claude Code skill for filming your web app with narrated, zooming cursor
demos and screenshots, made on your own machine.

## Install

You need Node 22.18 or newer and ffmpeg (`brew install ffmpeg`, or
`apt install ffmpeg`). macOS and Linux.

```bash
npx skills add nilbuild/video-demo
```

It asks before it installs anything.

## Use

Say what you want filmed. Prefix it with `/video-demo` to call this skill
directly, or just say it and it will be picked up:

- **"record a demo of this app"**, in the repo you want filmed
- **"record a demo of https://example.com"**, from anywhere
- **"record just the search on the home page"**
- **"demo the checkout flow, skip the account settings"**

Be as broad or as specific as you like. Ask for the whole product and it
proposes what to cover before filming any of it; name one feature and it
films that one thing.

You can say what to say, too: "tell them it works offline now", "mention the
keyboard shortcut", "keep it under twenty seconds".

## It is a conversation, not a render

It films one scene first and shows you the video before doing the rest, and
you can change anything at any point:

- **the words**: "that line is too long", "say screenshots, not stills"
- **the framing**: "zoom in more on the toolbar", "stop zooming so much"
- **the pace**: "slow down at the end", "cut the last beat"
- **the content**: "start on the calendar instead", "film the pricing page too"
- **the voice**: "try a different voice", "no voice-over on this one"

Say what is wrong and it re-films. Nothing is final until you say so.

## What you get

An mp4 per scene with the voice-over on it, a screenshot at every moment
worth keeping, and one video of the whole thing end to end. Everything stays
on your machine.

## Licence

MIT. Copyright [Kamran Ahmed](https://kamran.fyi).
