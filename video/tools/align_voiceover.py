"""Join a voiceover recorded in parts and time every script paragraph against it.

Usage:
  python3 video/tools/align_voiceover.py part1.wav part1.words.json [part2.wav part2.words.json ...]

The words files come from transcribe.py. Each part is matched word by word against the script,
so we know where every paragraph starts and ends inside it. Neighbouring parts may repeat a few
lines at the joint: the earlier part is cut at the end of its last complete paragraph and the
later part starts at the beginning of the next paragraph, so nothing is said twice.

Writes:
  video/remotion/public/audio/voiceover.mp3   the joined voiceover
  video/paragraphs.json                       vo_start / vo_end for each paragraph (seconds)
"""
import difflib, json, os, re, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PARAS = os.path.join(HERE, "paragraphs.json")
OUT = os.path.join(HERE, "remotion", "public", "audio", "voiceover.mp3")
WORD_SEC = 0.33  # rough length of one spoken word, used to fill small gaps
PAD = 0.12       # keep a little breath before a paragraph and after its last word

MATRAS = re.compile(r"[़ा-्ऀ-ःॢॣ‌‍]")

def skeleton(word):
    """Consonant skeleton of a Hindi word, so Whisper's spelling slips still match."""
    w = MATRAS.sub("", word.lower())
    w = re.sub(r"[^\w]", "", w)
    return w.translate(str.maketrans("ढड़ढ़ज़फ़", "ढडढजफ"))

def script_words(paras):
    words, owner = [], []
    for p in paras:
        for w in p["text"].split():
            k = skeleton(w)
            if k:
                words.append(k)
                owner.append(p["id"])
    return words, owner

def align(script, owner, spoken):
    """Map paragraph id -> (start, end) seconds inside one part."""
    keys = [skeleton(w["w"]) for w in spoken]
    sm = difflib.SequenceMatcher(None, script, keys, autojunk=False)
    hits = {}  # script word index -> spoken word
    for a, b, n in sm.get_matching_blocks():
        for k in range(n):
            hits[a + k] = spoken[b + k]
    found = {}
    for pid in sorted(set(owner)):
        idx = [i for i, o in enumerate(owner) if o == pid]
        matched = [i for i in idx if i in hits]
        # a paragraph counts as spoken in this part if enough of its words were heard
        if len(matched) < max(2, 0.35 * len(idx)):
            continue
        first, last = matched[0], matched[-1]
        start = hits[first]["s"] - (first - idx[0]) * WORD_SEC
        end = hits[last]["e"] + (idx[-1] - last) * WORD_SEC
        found[pid] = [max(0.0, start), end, len(matched) / len(idx)]
    return found

def main():
    args = sys.argv[1:]
    parts = [(args[i], args[i + 1]) for i in range(0, len(args), 2)]
    paras = json.load(open(PARAS, encoding="utf-8"))
    script, owner = script_words(paras)
    ids = [p["id"] for p in paras]

    plan, covered = [], set()  # (wav, cut_start, cut_end, {pid: (s, e)})
    for wav, words in parts:
        spoken = json.load(open(words, encoding="utf-8"))
        found = align(script, owner, spoken)
        keep = sorted(pid for pid in found if pid not in covered)
        # only keep a contiguous run of paragraphs, starting right after what is already covered
        run = []
        for pid in keep:
            if run and pid != run[-1] + 1:
                break
            run.append(pid)
        if not run:
            sys.exit(f"{wav}: no new paragraphs recognised")
        last_part = (wav, words) == parts[-1]
        if not last_part:
            # drop the last paragraph of this part if the next part repeats it, or it got cut off
            nxt = align(script, owner, json.load(open(parts[parts.index((wav, words)) + 1][1], encoding="utf-8")))
            while run and run[-1] in nxt and nxt[run[-1]][2] >= 0.9:
                run.pop()
        dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                                    "-of", "csv=p=0", wav], capture_output=True, text=True).stdout)
        cut_start = max(0.0, found[run[0]][0] - PAD) if plan else 0.0
        cut_end = min(dur, found[run[-1]][1] + PAD) if not last_part else dur
        plan.append((wav, cut_start, cut_end, {pid: found[pid][:2] for pid in run}))
        covered.update(run)
        print(f"{os.path.basename(wav)}: paragraphs {run[0]}-{run[-1]}, using {cut_start:.1f}s-{cut_end:.1f}s of {dur:.1f}s")

    missing = [pid for pid in ids if pid not in covered]
    if missing:
        print("WARNING paragraphs not found in the voiceover:", missing)

    # join the parts and convert to one mp3
    tmp = tempfile.mkdtemp()
    pieces, offset, timing = [], 0.0, {}
    for k, (wav, a, b, found) in enumerate(plan):
        piece = os.path.join(tmp, f"{k}.wav")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", wav, "-ss", f"{a:.3f}", "-to", f"{b:.3f}",
                        "-ac", "1", "-ar", "44100", piece], check=True)
        pieces.append(piece)
        for pid, (s, e) in found.items():
            timing[pid] = (offset + s - a, offset + e - a)
        offset += b - a
    lst = os.path.join(tmp, "list.txt")
    open(lst, "w").write("".join(f"file '{p}'\n" for p in pieces))
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst,
                    "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-ar", "44100", "-ac", "1", "-b:a", "128k", OUT], check=True)

    # paragraphs the aligner missed get squeezed in between their neighbours
    for p in paras:
        if p["id"] in timing:
            p["vo_start"], p["vo_end"] = round(timing[p["id"]][0], 3), round(timing[p["id"]][1], 3)
    for i, p in enumerate(paras):
        if "vo_start" not in p:
            prev_end = paras[i - 1]["vo_end"] if i else 0.0
            nxt = next((q["vo_start"] for q in paras[i + 1:] if "vo_start" in q), offset)
            p["vo_start"], p["vo_end"] = round(prev_end, 3), round(nxt, 3)
    json.dump(paras, open(PARAS, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"voiceover: {offset / 60:.1f} min -> {OUT}")

main()
