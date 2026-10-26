"""Generate the Hindi voiceover, one mp3 per paragraph, with Microsoft Edge neural TTS.

Usage: python3 video/tools/tts.py video/paragraphs.json video/remotion/public/audio [voice] [rate]
"""
import asyncio, json, os, ssl, subprocess, sys
import edge_tts, edge_tts.communicate as comm

# The cloud proxy re-signs TLS, so trust its CA bundle when it exists.
CA = "/root/.ccr/ca-bundle.crt"
if os.path.exists(CA):
    comm._SSL_CTX = ssl.create_default_context(cafile=CA)
PROXY = os.environ.get("HTTPS_PROXY")

src, outdir = sys.argv[1], sys.argv[2]
voice = sys.argv[3] if len(sys.argv) > 3 else "hi-IN-MadhurNeural"
rate = sys.argv[4] if len(sys.argv) > 4 else "+0%"
os.makedirs(outdir, exist_ok=True)
paras = json.load(open(src, encoding="utf-8"))

def duration(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                        "-of", "csv=p=0", path], capture_output=True, text=True)
    return float(r.stdout.strip())

async def one(p, sem):
    path = os.path.join(outdir, f"p{p['id']:03d}.mp3")
    async with sem:
        for attempt in range(5):
            try:
                if not (os.path.exists(path) and os.path.getsize(path) > 1000):
                    await edge_tts.Communicate(p["text"], voice, rate=rate, proxy=PROXY).save(path)
                p["audio"] = os.path.basename(path)
                p["duration"] = round(duration(path), 3)
                return
            except Exception as e:
                print("retry", p["id"], e, file=sys.stderr)
                await asyncio.sleep(2 ** attempt)
        raise RuntimeError(f"TTS failed for paragraph {p['id']}")

async def main():
    sem = asyncio.Semaphore(4)
    await asyncio.gather(*(one(p, sem) for p in paras))
    json.dump(paras, open(src, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    total = sum(p["duration"] for p in paras)
    print(f"{len(paras)} clips, {total/60:.1f} min of narration")

asyncio.run(main())
