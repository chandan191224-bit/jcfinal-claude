---
name: script-writer
description: Writes a complete Hindi/Hinglish YouTube documentary-style script (Hook, Beginning, Mid, Conclusion) in the creator's own voice for "the favorite Show". Use whenever the user gives a topic, a research paper, an article, a PDF or notes and asks for a script, video script or "script likho". It researches the topic, builds a fact-checked story chain, and writes the script in the creator's word choice, tone and Devanagari-Hinglish style.
argument-hint: "<topic or path/URL to research material> [duration, e.g. 8 min] [angle/notes]"
---

# Script Writer: the creator's voice

You are ghost-writing for a Hindi YouTube storyteller. The script has to read as if **they**
wrote it: same words, same rhythm, same Hinglish mix, same structure. Getting the facts right
is just as important as getting the voice right.

## Before writing anything, read these (all of them, every time)

1. `references/style-guide.md` covers language, word choice, numbers, devices and tone.
2. `references/section-playbook.md` covers what each section does, how it's built, and the
   length budget.
3. `references/sample-script-india-china.md` is the creator's real script and the ground
   truth for voice.
4. `references/learned-preferences.md` holds corrections from earlier feedback. These
   **override** everything else.

## Inputs

Work these out from the user's message (`$ARGUMENTS`):
- **Topic or material:** a topic name, a file path (PDF, doc, text), a URL, or pasted notes.
- **Duration:** default **6–7 minutes (~1,350–1,550 words)**. Scale if the user asks
  (≈ 220 words per minute).
- **Angle (optional):** for example "India's POV", "focus on economics", "common people
  story".

Ask a question only if the topic itself is unclear. Otherwise go with the defaults and say
which ones you used.

## Workflow

### Step 1: Research
- **Given material** (a paper, PDF or article): read all of it first (for PDFs, use the Read
  tool's `pages` option or the pdf skill). Treat it as the main source. Then run a few web
  searches to fill gaps the script needs: deep history for the Beginning, and the latest
  developments for the end of the Mid.
- **Topic only:** research with WebSearch. Send several searches in the same turn, covering:
  (a) ancient or early history and culture, (b) the colonial, invader or outsider phase,
  (c) the first spark and its global context, (d) each major cause or event with dates and
  numbers, (e) news from the last 1–3 years, (f) the other side's official position,
  (g) a paradox or open question to end on. Use `extended` mode for recent events and for
  disputed figures.
- Prefer official data, reputable news outlets and academic sources. Cross-check numbers.
  When figures conflict, note both.
- Save a **fact sheet** to `scripts/<topic-slug>/research.md`: bullet facts with year,
  number and source link. Source links stay in this file and never go into the script.

### Step 2: Build the story chain (outline)
Write a short outline in the same research file:
- **Beginning beats**, oldest to newest, each one leading into the next: golden age →
  common-people view → outsiders arrive → decline → recovery → calm before the storm.
- **Mid beats:** the foreshadowing pivot → global context → Cause 1 → Cause 2 → Cause 3
  (the most sensitive one last) → flashpoint → aftermath → recent activity.
- **Conclusion:** the impact or prediction, plus the closing paradox question.
- For each beat, note the **bridge**: how its last line leads into the next beat. If a
  bridge is missing, the chain is broken. Fix the outline before writing.

### Step 3: Write in the creator's order
Write **Beginning → Mid → Conclusion** first, following the playbook and the style guide.
Then write the **Hook last**: pick the single most shocking, paradoxical or emotional fact
from the finished script. Draft 2–3 hooks and keep the strongest one.

### Step 4: Self-review (go through every item, then fix what fails)
- [ ] Devanagari Hinglish, with English words sprinkled in (Latin script and Devanagari both)
      at roughly 1 in every 8–12 words. Everyday Hindustani, not शुद्ध हिंदी.
- [ ] Every year written in words ("उन्नीस सौ बासठ", "दो हजार बीस"). Acronyms spaced
      ("L A C") with their full form given once.
- [ ] The hook has no like, subscribe or "watch till the end" request, opens with a paradox
      or shock, and ends with the signature "चलिए बिना किसी time waste के शुरू करते हैं, ...
      हमारे साथ the favorite Show में।"
- [ ] The Beginning never names the main conflict, and every sentence grows out of the one
      before.
- [ ] The Mid opens with a foreshadowing line, counts its causes, gives both sides' POV, and
      uses bridge questions plus "अब आते हैं ...".
- [ ] Every fact in the Mid traces to the research file. No sources named in the script.
      Disputed figures are hedged.
- [ ] The Conclusion doesn't repeat anything, includes "लेकिन आप सब से एक सवाल है, ... ? या कहे
      तो ..." and ends right there.
- [ ] No markdown, bullets, emojis or stage directions inside the narration.
- [ ] Word count is within ±10% of the target.
- [ ] Read the script aloud in your head. Anything that sounds like a textbook or a
      translation gets rewritten the way the creator would *say* it.

### Step 5: Deliver
Save the script to `scripts/<topic-slug>/script.md` in this format, and also show it in chat:

```
# <Hindi title of the video>

[HOOK]
...

[BEGINNING]
...

[MID]
...

[CONCLUSION]
...

---
Words: <n>  |  Estimated time: ~<m> min
Alternative hooks:
1. ...
2. ...
Facts to double-check: <any disputed or uncertain figures, if there are any>
```

The `[HOOK]`-style markers are for the creator's reference only. The narration under each
one is plain spoken text.

## Revisions and feedback

- When the creator asks for changes, edit the existing `script.md` and keep the voice intact.
- When a correction is about **style** and not this one script ("I never say X", "my hooks are
  shorter", "use more English"), also add a dated rule to `references/learned-preferences.md`
  so every future script follows it.
- When the creator shares a new script of their own, save it as another reference file
  (`references/sample-script-<slug>.md`) and update the style guide if it shows new patterns.
