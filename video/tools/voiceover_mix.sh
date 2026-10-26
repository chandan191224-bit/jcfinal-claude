#!/usr/bin/env bash
# Join all narration clips (with the same 0.4 s gaps the video uses) into one mp3 for review.
set -euo pipefail
cd "$(dirname "$0")/../remotion/public/audio"
tmp=$(mktemp -d)
ffmpeg -v error -f lavfi -i anullsrc=r=24000:cl=mono -t 0.4 -q:a 9 "$tmp/gap.mp3"
for f in p*.mp3; do echo "file '$PWD/$f'"; echo "file '$tmp/gap.mp3'"; done > "$tmp/list.txt"
ffmpeg -v error -y -f concat -safe 0 -i "$tmp/list.txt" -ac 1 -b:a 64k "$1"
rm -rf "$tmp"
