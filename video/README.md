# Video: दिल्ली का इतिहास

A ~26 minute Hindi documentary for the favorite Show: AI voiceover, 449 Ghibli-style images
(a new one every ~3.5 s), edited in Remotion.

| What | Where |
|---|---|
| Script and research | `scripts/delhi-history/` |
| Image prompts (5 batches) | `video/prompts/` |
| Full voiceover to review | `video/voiceover-hindi.mp3` |
| Narration paragraphs + timings | `video/paragraphs.json` |
| Shot list (source of the prompts) | `video/shots.py` |
| Remotion project | `video/remotion/` |

## Rebuild steps

```bash
pip install edge-tts
python3 video/tools/extract_paragraphs.py scripts/delhi-history/script.md video/paragraphs.json
python3 video/tools/tts.py video/paragraphs.json video/remotion/public/audio hi-IN-MadhurNeural +8%
python3 video/tools/build_prompts.py           # prompts/ + remotion/src/shots.json
python3 video/tools/ingest_images.py images.zip  # -> remotion/public/images/001.jpg ...
cd video/remotion && npm i && npx remotion render DelhiHistory out/delhi-history.mp4
```

If you change the script, rerun everything from step 2, because the image timing comes from the voiceover lengths.
