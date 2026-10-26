"""Join a voiceover recorded in parts and time every script paragraph against it.

Usage:
  python3 video/tools/align_voiceover.py part1.wav part1.words.json [part2.wav part2.words.json ...]

The words files come from transcribe.py. Each part's words are matched against the script
(runs of 3+ matching words become time anchors; everything in between is interpolated), so we
know when every paragraph starts inside it. Neighbouring parts may repeat a few lines at the
joint: the earlier part is cut where the first paragraph that the later part has from its very
beginning starts, and the later part starts at that same paragraph, so nothing is said twice.

Writes:
  video/remotion/public/audio/voiceover.mp3   the joined voiceover
  video/paragraphs.json                       vo_start / vo_end for each paragraph (seconds)
"""
import bisect, difflib, json, os, re, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PARAS = os.path.join(HERE, "paragraphs.json")
OUT = os.path.join(HERE, "remotion", "public", "audio", "voiceover.mp3")
MIN_RUN = 3   # matched words in a row needed for a trusted anchor
PAD = 0.15    # seconds of breath kept before a paragraph at a cut

MATRAS = re.compile(r"[़ा-्ऀ-ःॢॣ‌‍]")

def skeleton(word):
    """Consonant skeleton of a Hindi word, so Whisper's spelling slips still match."""
    return re.sub(r"[^\w]", "", MATRAS.sub("", word.lower()))

def script_words(paras):
    words, first = [], {}
    for p in paras:
        first[p["id"]] = len(words)
        words += [k for k in (skeleton(w) for w in p["text"].split()) if k]
    return words, first

class Part:
    def __init__(self, wav, words_json, script):
        self.wav = wav
        self.dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                                         "-of", "csv=p=0", wav], capture_output=True, text=True).stdout)
        spoken = json.load(open(words_json, encoding="utf-8"))
        keys = [skeleton(w["w"]) for w in spoken]
        sm = difflib.SequenceMatcher(None, script, keys, autojunk=False)
        self.idx, self.time, self.end = [], [], []  # anchors: script word index -> spoken start/end
        for a, b, n in sm.get_matching_blocks():
            if n >= MIN_RUN:
                for k in range(n):
                    if not self.time or spoken[b + k]["s"] >= self.time[-1]:
                        self.idx.append(a + k)
                        self.time.append(spoken[b + k]["s"])
                        self.end.append(spoken[b + k]["e"])
        if not self.idx:
            sys.exit(f"{wav}: could not match it to the script")
        self.lo, self.hi = self.idx[0], self.idx[-1]  # script words this part covers

    def at(self, i):
        """Spoken time of script word i, interpolated between anchors."""
        k = bisect.bisect_left(self.idx, i)
        if k < len(self.idx) and self.idx[k] == i:
            return self.time[k]
        if k == 0:
            return max(0.0, self.time[0] - (self.idx[0] - i) * 0.33)
        if k == len(self.idx):
            return min(self.dur, self.time[-1] + (i - self.idx[-1]) * 0.33)
        # unmatched words between two anchors share the time from the end of one to the start of the next
        i0, i1, t0, t1 = self.idx[k - 1], self.idx[k], self.end[k - 1], self.time[k]
        return t0 + (t1 - t0) * (i - i0 - 1) / max(1, i1 - i0 - 1)

def main():
    args = sys.argv[1:]
    paras = json.load(open(PARAS, encoding="utf-8"))
    script, first = script_words(paras)
    parts = [Part(args[i], args[i + 1], script) for i in range(0, len(args), 2)]
    ids = [p["id"] for p in paras]

    # Which paragraphs each part supplies: from its first fully-heard paragraph onwards,
    # until the paragraph the next part takes over from.
    starts = []
    for n, part in enumerate(parts):
        if n == 0:
            starts.append(ids[0])
        else:
            # start at the paragraph the previous part was in the middle of when it ended
            prev = parts[n - 1]
            pid = max(p for p in ids if first[p] <= prev.hi)
            nxt = ids.index(pid) + 1
            end_of_pid = first[ids[nxt]] - 1 if nxt < len(ids) else len(script) - 1
            if prev.hi >= end_of_pid - 2 and nxt < len(ids):
                pid = ids[nxt]
            if part.lo > first[pid] + 40:
                print(f"WARNING: {os.path.basename(part.wav)} seems to start after paragraph {pid} begins")
            starts.append(pid)
    plan, timing, offset = [], {}, 0.0
    for n, part in enumerate(parts):
        mine = [pid for pid in ids if pid >= starts[n] and (n + 1 == len(parts) or pid < starts[n + 1])]
        a = 0.0 if n == 0 else max(0.0, part.at(first[mine[0]]) - PAD)
        if a < 1.5:  # the part opens with this paragraph: keep its very first breath
            a = 0.0
        b = part.dur if n + 1 == len(parts) else max(a, part.at(first[starts[n + 1]]) - PAD)
        for pid in mine:
            timing[pid] = offset + max(0.0, part.at(first[pid]) - PAD - a)
        timing[mine[0]] = offset
        plan.append((part.wav, a, b))
        print(f"{os.path.basename(part.wav)}: paragraphs {mine[0]}-{mine[-1]}, using {a:.1f}s-{b:.1f}s of {part.dur:.1f}s")
        offset += b - a

    tmp = tempfile.mkdtemp()
    pieces = []
    for k, (wav, a, b) in enumerate(plan):
        piece = os.path.join(tmp, f"{k}.wav")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", wav, "-ss", f"{a:.3f}", "-to", f"{b:.3f}",
                        "-ac", "1", "-ar", "44100", piece], check=True)
        pieces.append(piece)
    lst = os.path.join(tmp, "list.txt")
    open(lst, "w").write("".join(f"file '{p}'\n" for p in pieces))
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst,
                    "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-ar", "44100", "-ac", "1", "-b:a", "128k", OUT], check=True)

    for i, p in enumerate(paras):
        p["vo_start"] = round(timing[p["id"]], 3)
    for i, p in enumerate(paras):
        p["vo_end"] = paras[i + 1]["vo_start"] if i + 1 < len(paras) else round(offset, 3)
    json.dump(paras, open(PARAS, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"voiceover: {offset / 60:.2f} min -> {OUT}")

main()
