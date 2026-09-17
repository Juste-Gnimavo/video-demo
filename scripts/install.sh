#!/usr/bin/env bash
set -euo pipefail

# Everything that has to happen once, on this machine, before anything can be
# filmed. Run it after cloning, and again after `git pull` if the engine's
# dependency changed.
#
# Node and ffmpeg are not installed here on purpose: they are system packages
# with their own managers, and a script that tried would be guessing. doctor.sh
# names the command for each at the end.

SKILL="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$SKILL"

if ! command -v node >/dev/null 2>&1; then
  printf 'install: node not found. Install Node 22.18 or newer first.\n'
  exit 1
fi

printf 'install: the engine (about 100MB)\n'
if [ -f package-lock.json ]; then
  npm ci
else
  npm install
fi

# How a workspace resolves `video-demo/scene` and friends: its own
# `node_modules` symlink points here, and this points back at the skill root,
# where the `exports` map turns those specifiers into engine paths. One link,
# and nothing has to be installed into anybody's project.
mkdir -p node_modules
ln -sfn .. node_modules/video-demo

printf '\ninstall: chromium (about 150MB)\n'
if [ "$(uname -s)" = "Linux" ]; then
  npx playwright install --with-deps chromium
else
  npx playwright install chromium
fi

printf '\n'
exec "$SKILL/scripts/doctor.sh"
