"""Transcribe a Hindi voiceover with word timestamps (faster-whisper) -> JSON list of words."""
import json, subprocess, sys
import numpy as np
from faster_whisper import WhisperModel

src, out = sys.argv[1], sys.argv[2]
size = sys.argv[3] if len(sys.argv) > 3 else "small"
model = WhisperModel(size, device="cpu", compute_type="int8", cpu_threads=4)
# decode with ffmpeg ourselves (avoids PyAV version issues)
pcm = subprocess.run(["ffmpeg", "-v", "error", "-i", src, "-ac", "1", "-ar", "16000", "-f", "f32le", "-"],
                     capture_output=True, check=True).stdout
audio = np.frombuffer(pcm, dtype=np.float32)
segments, info = model.transcribe(audio, language="hi", word_timestamps=True, vad_filter=False,
                                  beam_size=1, condition_on_previous_text=False)
words = []
for seg in segments:
    for w in seg.words:
        words.append({"w": w.word.strip(), "s": round(w.start, 2), "e": round(w.end, 2)})
    print(f"{seg.end:7.1f}s  {seg.text[:80]}", flush=True)
json.dump(words, open(out, "w", encoding="utf-8"), ensure_ascii=False)
print("words:", len(words))
