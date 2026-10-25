# the favorite Show: script writer

A Claude Code skill (and a matching subagent) that writes YouTube scripts in the creator's
own Hindi/Hinglish storytelling voice.

## How to use

Open this repo in Claude Code and run:

```
/script-writer भारत और नेपाल का बॉर्डर विवाद
/script-writer path/to/research-paper.pdf 8 min
/script-writer https://example.com/article  focus on common people POV
```

You can also just ask in plain words: "is paper pe script likho" or "write a script on the
Kashmir water dispute".

Each run produces:
- `scripts/<topic>/research.md`: the fact sheet with sources, plus the story-chain outline
- `scripts/<topic>/script.md`: the final script in four sections, **Hook → Beginning → Mid →
  Conclusion**, with the word count, estimated time and alternative hooks

## How it learns your style

| File | What it holds |
|---|---|
| `.claude/skills/script-writer/references/style-guide.md` | Language mix, word choice, numbers, devices, tone |
| `.claude/skills/script-writer/references/section-playbook.md` | What each section does, how it's built, and the length budget |
| `.claude/skills/script-writer/references/sample-script-india-china.md` | Your original script, the ground truth for voice |
| `.claude/skills/script-writer/references/learned-preferences.md` | Corrections you give, saved as rules for future scripts |

To make it sound even more like you, share more of your scripts. Each one gets saved as
another `sample-script-*.md`, and the style guide is updated from it.

---

# Map Animation Studio

`map-animation-studio/` makes map and travel animations: flight paths, road trips on real highways, 3D terrain flyovers, country highlights, flags inside countries, and a keyframe timeline. See [map-animation-studio/README.md](map-animation-studio/README.md).

**To use it, install the desktop app** with `Map-Animation-Studio-Setup-<version>.exe` (Windows 10/11). Build it with `npm run build-desktop`. There's also a single-file browser version, [`map-animation-studio/Map Animation Studio.html`](map-animation-studio/Map%20Animation%20Studio.html).

For developers, the Remotion Studio version:

```
cd map-animation-studio && npm install && npm run studio
```
