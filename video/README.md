# Video: दिल्ली का इतिहास

A ~22 minute Hindi documentary for the favorite Show: Cartesia "Vishal" Hindi voiceover (2 parts), 449 realistic cinematic images
(a new one every ~3.5 s), edited in Remotion.

| What | Where |
|---|---|
| Script and research | `scripts/delhi-history/` |
| Image prompts (5 batches) | `video/prompts/` |
| Final joined voiceover | `video/remotion/public/audio/voiceover.mp3` |
| Voiceover transcripts (word timings) | `video/voiceover/` |
| Old Edge-TTS guide voiceover | `video/voiceover-hindi.mp3` |
| Narration paragraphs + timings | `video/paragraphs.json` |
| Shot list (source of the prompts) | `video/shots.py` |
| Remotion project | `video/remotion/` |

## Rebuild steps

```bash
pip install edge-tts
python3 video/tools/extract_paragraphs.py scripts/delhi-history/script.md video/paragraphs.json
python3 video/tools/tts.py video/paragraphs.json video/remotion/public/audio hi-IN-MadhurNeural +8%
# the user's own voiceover (two parts that overlap a little at the joint):
python3 video/tools/transcribe.py part1.wav part1.words.json && python3 video/tools/patch_gaps.py part1.wav part1.words.json
python3 video/tools/transcribe.py part2.wav part2.words.json && python3 video/tools/patch_gaps.py part2.wav part2.words.json
python3 video/tools/align_voiceover.py part1.wav part1.words.json part2.wav part2.words.json
python3 video/tools/build_prompts.py           # prompts/ + remotion/src/shots.json
python3 video/tools/ingest_images.py images.zip  # -> remotion/public/images/001.jpg ...
cd video/remotion && npm i && npx remotion render DelhiHistory out/delhi-history.mp4
```

If you change the script, rerun everything from step 2, because the image timing comes from the voiceover lengths.
