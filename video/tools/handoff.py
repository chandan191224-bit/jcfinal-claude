"""Write a self-contained hand-off document (and an .srt) for continuing this video in another chat."""
import json, os, sys
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, HERE)
from shots import STYLE  # noqa: E402
ROOT = os.path.dirname(HERE)
paras = json.load(open(os.path.join(HERE, "paragraphs.json"), encoding="utf-8"))
data = json.load(open(os.path.join(HERE, "remotion", "src", "shots.json")))
shots = data["shots"]
total = data["audio"][0]["duration"]

def ts(s, srt=False):
    h, m, sec = int(s // 3600), int(s % 3600 // 60), s % 60
    return f"{h:02d}:{m:02d}:{sec:06.3f}".replace(".", ",") if srt else f"{int(s // 60)}:{sec:05.2f}"

by_para = {}
for s in shots:
    by_para.setdefault(s["paragraph"], []).append(s["n"])

L = [
    "# Hand-off: दिल्ली का इतिहास (the favorite Show)", "",
    "Paste this whole file into a new chat to continue the project. Everything needed is here.", "",
    "## Project", "",
    "- **Video:** History of Delhi, Hindi/Hinglish documentary for the YouTube channel \"the favorite Show\".",
    "- **Script:** ~3,900 words, Hook → Beginning → Mid → Conclusion, written in the creator's style.",
    f"- **Length:** {ts(total)} (min:sec), 1920x1080, 30 fps.",
    "- **Pictures:** 449 photorealistic cinematic images (historical-epic film look, not cartoon/Ghibli), "
    "one about every 2.9 s, numbered 001–449. Each image gets a slow zoom/pan (Ken Burns) and an "
    "8-frame cross-fade, a soft vignette, and a fade in and out from black.",
    "- **Edit:** Remotion (React). Composition id `DelhiHistory`.",
    "- **Repo:** GitHub `chandan191224-bit/jcfinal-claude`, branch `ccr-527db3aa-s1uvaw`.", "",
    "## Voiceover", "",
    "- **Voice:** Cartesia, voice \"Vishal\", model sonic-3.6, Hindi (hi-IN). It was made by the creator in 2 parts.",
    "- **Part 1:** `cartesia_2026-10-26T12_11_07Z_Vishal_sonic-3.6_hi-IN.wav`, 18:07.6, 44.1 kHz mono 16-bit. "
    "Drive: https://drive.google.com/file/d/1Lsf7aasHU4nOS0AW7e3nIb0zUPvAIzBD/view",
    "- **Part 2:** `cartesia_2026-10-26T12_38_14Z_Vishal_sonic-3.6_hi-IN.wav`, 3:55.8, 44.1 kHz mono 16-bit. "
    "Drive: https://drive.google.com/file/d/1dFrZm7WJT0kS4Rvl7IqMCQk_Y4KNrJ5w/view",
    "- **Joint:** Part 1 ends in the middle of paragraph 78 (\"और आखिरकार चौदह अगस्त…\"), and Part 2 starts "
    "paragraph 78 again from the beginning. Part 1 was used from 0.0 to 1081.9 s, so it ends after "
    "\"…इंकलाब ज़िंदाबाद का नारा लगाया\". Part 2 was used in full (0.0–235.8 s). Nothing is repeated.",
    "- **Final file:** `video/remotion/public/audio/voiceover.mp3`, 128 kbps mono, loudness normalised "
    f"to -16 LUFS, {ts(total)}.",
    "- **Timing method:** faster-whisper (small model) word timestamps, matched to the script word by word "
    "(`video/tools/align_voiceover.py`). Stretches that Whisper skipped were re-transcribed "
    "(`video/tools/patch_gaps.py`). Raw word timings are in `video/voiceover/part1.words.json` and `part2.words.json`.", "",
    "## Picture style (added to the end of every prompt)", "",
    "> " + STYLE,
]
L += ["", "Prompts are in `video/prompts/batch-1.md` … `batch-5.md` (5 batches, 001–090, 091–180, 181–270, "
      "271–360, 361–449). The source of truth is `video/shots.py`.", "",
      "## Status", "",
      "- [x] Research and script (`scripts/delhi-history/research.md`, `script.md`, `voiceover.txt`)",
      "- [x] Voiceover joined and every paragraph timed",
      "- [x] 449 prompts in 5 batches, timed to this voiceover",
      "- [x] Remotion project built and test-rendered with placeholder cards",
      "- [ ] The creator generates the 449 images (`001.png` … `449.png`) and sends a zip",
      "- [ ] Ingest: `python3 video/tools/ingest_images.py images.zip` (cover-crops to 1920x1080; "
      "missing numbers reuse the previous image; `--by-time` if the files aren't numbered)",
      "- [ ] Render: `cd video/remotion && npm i && npx remotion render DelhiHistory out/delhi-history.mp4` "
      "(~40 min on 4 CPUs)", "",
      "## Timed transcript", "",
      "Times are positions in the final voiceover (min:sec). The text is the script as read. "
      "\"Images\" lists the pictures shown during that paragraph.", ""]
section = None
for p in paras:
    if p["section"] != section:
        section = p["section"]
        L += [f"### {section}", ""]
    imgs = by_para[p["id"]]
    L += [f"**¶{p['id']}**  ·  {ts(p['vo_start'])} → {ts(p['vo_end'])}  ·  images {imgs[0]:03d}–{imgs[-1]:03d}", "",
          p["text"], ""]
L += ["## Image timing", "", "| Image | Starts | Lasts (s) | ¶ |", "|---|---|---|---|"]
L += [f"| {s['image']} | {ts(s['start'])} | {s['duration']:.2f} | {s['paragraph']} |" for s in shots]
open(os.path.join(ROOT, "scripts", "delhi-history", "handoff.md"), "w", encoding="utf-8").write("\n".join(L) + "\n")

srt = []
for i, p in enumerate(paras, 1):
    srt += [str(i), f"{ts(p['vo_start'], True)} --> {ts(p['vo_end'], True)}", p["text"], ""]
open(os.path.join(ROOT, "scripts", "delhi-history", "voiceover.srt"), "w", encoding="utf-8").write("\n".join(srt))
print("ok", len(L), "lines")
