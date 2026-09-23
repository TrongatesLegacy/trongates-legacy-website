#!/bin/sh
# Copies the OBS overlays (public/obs) to Dropbox so the streaming PC gets them as local files.
# Local files are needed for the scenes to follow veadotube: browsers block public websites from talking to
# 127.0.0.1 (ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS), but a local page may. Run after changing anything
# in public/obs; Dropbox syncs it to the PC and OBS picks it up on the next refresh.
set -e
cd "$(dirname "$0")/.."
DEST="${1:-$HOME/Dropbox/Kick/obs-overlays}"
mkdir -p "$DEST"
rsync -a --delete public/obs/ "$DEST/"
echo "synced to $DEST ($(find "$DEST" -type f | wc -l | tr -d ' ') files)"
