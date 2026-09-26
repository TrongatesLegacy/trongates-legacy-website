#!/bin/sh
# Type-check the OBS scripts (public/obs/shared/) from their JSDoc comments, with TypeScript fetched by npx: nothing
# is installed in the repo and nothing is built; the files stay plain JavaScript. jsconfig.json says what's checked,
# types/obs-globals.d.ts declares what the scripts put on window. Editors (VS Code) show the same errors as you type.
cd "$(dirname "$0")/.." || exit 1
npx --yes -p typescript@5 tsc -p jsconfig.json && echo "types: no errors"
