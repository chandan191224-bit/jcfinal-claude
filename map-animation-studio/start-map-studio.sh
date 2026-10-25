#!/bin/sh
# macOS / Linux launcher for Map Animation Studio.
cd "$(dirname "$0")" || exit 1
command -v node >/dev/null 2>&1 || { echo "Node.js is not installed: https://nodejs.org"; exit 1; }
[ -f node_modules/vite/package.json ] || npm install || exit 1
exec node server/server.mjs "$@"
