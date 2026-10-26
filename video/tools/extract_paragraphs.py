"""Split script.md narration into numbered paragraphs (one voiceover clip each)."""
import json, re, sys
src, out = sys.argv[1], sys.argv[2]
text = open(src, encoding="utf-8").read().split("\n---\n")[0]
paras, section = [], None
for line in text.splitlines():
    line = line.strip()
    m = re.fullmatch(r"\[(HOOK|BEGINNING|MID|CONCLUSION)\]", line)
    if m:
        section = m.group(1); continue
    if not line or line.startswith("#") or section is None:
        continue
    paras.append({"id": len(paras) + 1, "section": section, "text": line})
json.dump(paras, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(len(paras), "paragraphs,", sum(len(p["text"].split()) for p in paras), "words")
