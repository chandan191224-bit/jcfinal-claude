"""Turn the user's images (zip file or folder) into public/images/001.jpg ... for Remotion.

Usage:
  python3 video/tools/ingest_images.py <images.zip | folder> [--by-time]
  python3 video/tools/ingest_images.py --placeholders        # numbered test cards

Files are matched by the number in their name (001.png, img_12.jpg, ...). With --by-time,
or when names carry no numbers, they are ordered by modification time instead.
Every image is cover-cropped to 1920x1080. Missing numbers reuse the nearest earlier image.
"""
import json, os, re, shutil, subprocess, sys, tempfile, zipfile
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(HERE, "remotion", "public", "images")
TOTAL = len(json.load(open(os.path.join(HERE, "remotion", "src", "shots.json")))["shots"])
EXTS = (".png", ".jpg", ".jpeg", ".webp", ".avif", ".heic")
VF = "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080"

def convert(src, dst):
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-vf", VF, "-q:v", "2", dst], check=True)

def placeholders():
    def card(n):
        hue = (n * 37) % 360
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i",
                        f"color=c=0x203040:s=1920x1080,hue=h={hue}", "-frames:v", "1", "-vf",
                        f"drawtext=text='{n:03d}':fontsize=260:fontcolor=white:x=(w-tw)/2:y=(h-th)/2",
                        os.path.join(OUT, f"{n:03d}.jpg")], check=True)
    with ThreadPoolExecutor(8) as ex:
        list(ex.map(card, range(1, TOTAL + 1)))
    print(f"{TOTAL} placeholder cards in {OUT}")

def main():
    os.makedirs(OUT, exist_ok=True)
    if sys.argv[1] == "--placeholders":
        return placeholders()
    src, by_time = sys.argv[1], "--by-time" in sys.argv
    work = tempfile.mkdtemp()
    if zipfile.is_zipfile(src):
        with zipfile.ZipFile(src) as z:
            z.extractall(work)
        src = work
    files = []
    for root, _, names in os.walk(src):
        for name in names:
            if name.lower().endswith(EXTS) and not name.startswith("._"):
                files.append(os.path.join(root, name))
    numbered = {}
    for f in files:
        m = re.findall(r"\d+", os.path.splitext(os.path.basename(f))[0])
        if m and not by_time and 1 <= int(m[-1]) <= TOTAL:
            numbered.setdefault(int(m[-1]), f)
    if by_time or len(numbered) < len(files) // 2:
        files.sort(key=os.path.getmtime)
        numbered = {i + 1: f for i, f in enumerate(files[:TOTAL])}
        print("ordered by file time")
    jobs = [(f, os.path.join(OUT, f"{n:03d}.jpg")) for n, f in numbered.items()]
    with ThreadPoolExecutor(8) as ex:
        list(ex.map(lambda j: convert(*j), jobs))
    missing = [n for n in range(1, TOTAL + 1) if n not in numbered]
    for n in missing:  # reuse the nearest earlier image, or the next one at the very start
        donor = next((k for k in range(n - 1, 0, -1) if k in numbered), None) or \
                next(k for k in range(n + 1, TOTAL + 1) if k in numbered)
        shutil.copy(os.path.join(OUT, f"{donor:03d}.jpg"), os.path.join(OUT, f"{n:03d}.jpg"))
    shutil.rmtree(work, ignore_errors=True)
    print(f"{len(numbered)} images ingested, {len(missing)} missing filled in: {missing[:40]}")

main()
