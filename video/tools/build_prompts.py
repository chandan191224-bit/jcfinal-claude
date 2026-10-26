"""Build prompts.md (for generating images on the phone) and shots.json (timing for Remotion)."""
import json, os, sys
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, HERE)
from shots import SHOTS, STYLE

GAP = 0.4  # seconds of silence between narration paragraphs
paras = {p["id"]: p for p in json.load(open(os.path.join(HERE, "paragraphs.json"), encoding="utf-8"))}
missing = sorted(set(paras) - {pid for pid, _ in SHOTS})
assert not missing, f"paragraphs without a shot: {missing}"
assert [pid for pid, _ in SHOTS] == sorted(pid for pid, _ in SHOTS), "shots out of order"

# Timing: each paragraph's duration is split evenly between its shots.
by_para = {}
for i, (pid, _) in enumerate(SHOTS):
    by_para.setdefault(pid, []).append(i)
t, shots, audio = 0.0, [], []
for pid in sorted(paras):
    p = paras[pid]
    audio.append({"file": p["audio"], "start": round(t, 3), "duration": p["duration"]})
    idxs = by_para[pid]
    span = p["duration"] + GAP
    for k, i in enumerate(idxs):
        shots.append({"n": i + 1, "image": f"{i + 1:03d}", "paragraph": pid,
                      "section": p["section"], "start": round(t + span * k / len(idxs), 3),
                      "duration": round(span / len(idxs), 3)})
    t += span
json.dump({"total": round(t + 2.0, 3), "audio": audio, "shots": shots},
          open(os.path.join(HERE, "remotion", "src", "shots.json"), "w"), indent=1)

def mmss(s):
    return f"{int(s // 60)}:{int(s % 60):02d}"

BATCHES = 5
per = -(-len(SHOTS) // BATCHES)
outdir = os.path.join(HERE, "prompts")
os.makedirs(outdir, exist_ok=True)
for b in range(BATCHES):
    lo, hi = b * per, min((b + 1) * per, len(SHOTS))
    lines = [
        f"# Batch {b + 1} of {BATCHES}: images {lo + 1:03d} to {hi:03d}", "",
        "दिल्ली का इतिहास · realistic cinematic images · **16:9 landscape**", "",
        f"Save each image with its number as the file name ({lo + 1:03d}.png … {hi:03d}.png).",
        "Every prompt already includes the style. Copy one block, paste, generate, save.", "",
    ]
    for i in range(lo, hi):
        pid, prompt = SHOTS[i]
        lines += [f"**{i + 1:03d}**  ·  {mmss(shots[i]['start'])}", "", "```", f"{prompt}. {STYLE}", "```", ""]
    open(os.path.join(outdir, f"batch-{b + 1}.md"), "w", encoding="utf-8").write("\n".join(lines))

readme = [
    "# Image prompts: दिल्ली का इतिहास", "",
    f"**{len(SHOTS)} images**, one new picture every ~3.5 seconds of a {mmss(t)} video.", "",
    "| Batch | Images | Video time |", "|---|---|---|",
]
for b in range(BATCHES):
    lo, hi = b * per, min((b + 1) * per, len(SHOTS))
    readme.append(f"| [batch-{b + 1}.md](batch-{b + 1}.md) | {lo + 1:03d}–{hi:03d} | "
                  f"{mmss(shots[lo]['start'])}–{mmss(shots[hi - 1]['start'] + shots[hi - 1]['duration'])} |")
readme += ["", "## How to do it", "",
    "1. Open a batch, copy one prompt (each already has the realistic style), paste it into your image app",
    "   (Google Flow / Gemini / Higgsfield / any) and pick **16:9 landscape**.",
    "2. Save the image with its number as the name: `001.png`, `002.png` … (jpg/webp also fine).",
    "   Can't rename on the phone? Generate strictly in order and tell me; I'll sort by time.",
    "3. Bad result (gibberish text, extra fingers, modern objects in old scenes)? Regenerate it.",
    "   A few missing is OK: the neighbouring image fills the gap.",
    "4. Zip each finished batch (or everything) and send it to me.", "",
]
open(os.path.join(outdir, "README.md"), "w", encoding="utf-8").write("\n".join(readme))
old = os.path.join(HERE, "prompts.md")
if os.path.exists(old):
    os.remove(old)
avg = t / len(SHOTS)
print(f"{len(SHOTS)} shots in {BATCHES} batches of {per}, {mmss(t)} total, avg {avg:.1f}s/shot, "
      f"range {min(s['duration'] for s in shots):.1f}-{max(s['duration'] for s in shots):.1f}s")
