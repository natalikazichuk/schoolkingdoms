#!/usr/bin/env bash
# publish-demo.sh — збирає демо й публікує його в публічний репозиторій
# natalikazichuk/schoolkingdoms-demo (GitHub Pages, гілка main).
# Основний репозиторій лишається приватним; назовні йде лише dist-demo/.
#
#   bash tools/publish-demo.sh            # зібрати й запушити
#   DEMO_REMOTE=<url> bash tools/publish-demo.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REMOTE="${DEMO_REMOTE:-https://github.com/natalikazichuk/schoolkingdoms-demo.git}"
SRC_SHA="$(git -C "$ROOT" rev-parse --short HEAD)"

node "$ROOT/tools/build-demo.mjs"
cp "$ROOT/demo/PUBLIC-README.md" "$ROOT/dist-demo/README.md"
touch "$ROOT/dist-demo/.nojekyll"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
git clone --quiet --depth 1 "$REMOTE" "$WORK/repo" 2>/dev/null || git init --quiet -b main "$WORK/repo"
cd "$WORK/repo"
git checkout --quiet -B main
find . -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
cp -a "$ROOT/dist-demo/." .
git add -A
if git diff --cached --quiet; then echo "демо без змін"; exit 0; fi
git commit --quiet -m "Demo build from schoolkingdoms@$SRC_SHA"
git remote get-url origin >/dev/null 2>&1 || git remote add origin "$REMOTE"
git push -u origin main
