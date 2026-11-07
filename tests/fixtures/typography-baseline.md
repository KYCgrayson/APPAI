# Typography baseline

`typography-default.html` was rendered from `origin/main` commit `4dc13ee13d87f33ee72e84ce71b1a8904f6f821b`, using all 29 section types in `typography-page.json`.

Sources and the hosted-render loader were extracted with `git archive origin/main src tests/helpers docs/examples` into `/tmp/appai-round2-origin`, with a symlink to the workspace node_modules. React `renderToPipeableStream` rendered the PageRenderer with `onAllReady`, collecting UTF-8 chunks. `Date.prototype.toISOString` was fixed to `2026-01-01T00:00:00.000Z` for the video JSON-LD upload date; the test uses the same clock. No stash or workspace checkout was used.

The test compares the exact output for omitted settings, explicit md/normal, empty overrides, and all-md role overrides. It also rejects any section rendering errors.
