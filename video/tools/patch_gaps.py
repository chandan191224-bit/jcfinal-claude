"""Re-transcribe stretches that Whisper skipped (long silent gaps in the word list) and patch them in.

Usage: python3 video/tools/patch_gaps.py part.wav part.words.json
"""
import json, os, subprocess, sys, tempfile
from faster_whisper import WhisperModel
import numpy as np

wav, words_path = sys.argv[1], sys.argv[2]
words = json.load(open(words_path, encoding="utf-8"))
gaps = []
for a, b in zip(words, words[1:]):
    if b["s"] - a["e"] > 2.5 or b["e"] - b["s"] > 3:
        gaps.append((max(0.0, a["s"] - 4), b["e"] + 4))
model = WhisperModel("small", device="cpu", compute_type="int8", cpu_threads=4)
for lo, hi in gaps:
    pcm = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{lo}", "-to", f"{hi}", "-i", wav, "-ac", "1",
                          "-ar", "16000", "-f", "f32le", "-"], capture_output=True, check=True).stdout
    segs, _ = model.transcribe(np.frombuffer(pcm, dtype=np.float32), language="hi", word_timestamps=True,
                               beam_size=1, condition_on_previous_text=False)
    new = [{"w": w.word.strip(), "s": round(lo + w.start, 2), "e": round(lo + w.end, 2)}
           for s in segs for w in s.words]
    if not new:
        continue
    a, b = new[0]["s"], new[-1]["e"]
    words = [w for w in words if not (a - 0.05 <= w["s"] < b)] + new
    words.sort(key=lambda w: w["s"])
    print(f"patched {lo:.1f}-{hi:.1f}s with {len(new)} words")
json.dump(words, open(words_path, "w", encoding="utf-8"), ensure_ascii=False)
