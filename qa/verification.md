# Visual prototype verification — 2026-09-22

## Passed

- Production build and self-contained HTML generation.
- Four simulation tests, including five minutes at 1,600 target density, finite transforms, unit-pool recycling, bounded neighbor queries, and scenery-footprint exclusion.
- Two MediaWiki exporter tests: continuation/resume/metadata and denial without repeated requests. Both dictionary and list namespace metadata shapes are covered.
- Actual-render density runs at 300, 600, 1,000, 1,600; approximately 60 FPS on Apple M1 Max / Chrome. Latest values are in `performance.json`.
- Portrait touch/DPR emulation at 390×844. The final sample had 309 of 600 units inside the camera frustum, 60 FPS, 0.5 ms simulation CPU p95 and 1.8 ms render-submission CPU p95.
- Two-minute rendered soak at 1,600 target density with repeated overcharge. Geometry count stayed at 29 and texture count at 2. Effect/unit pools stayed within their caps. This soak preceded the final additional wall-strike shader attribute; the final shader was separately exercised by all density runs.
- Pause, resume, settings, overcharge cooldown, and console-error checks.
- 320×568, 390×844, 844×390 and 1440×1000 layouts: no header overlap or horizontal overflow. The smallest-phone weapon labels received an additional compact treatment.
- Standalone `file://` startup in Chrome, including embedded font licenses.
- Public asset responses and SHA-256 comparison with the local production build; see `public-release.json` for the exact deployed source revision.
- `npm audit` after dependency update: zero reported vulnerabilities at the time of the check.

## Limits

No physical Android/iPhone measurement has been made. CPU render-submission time is not GPU execution time. The benchmark's 300-unit setup removes the initial 600-unit fixture before refilling, so its cumulative kill count is not a gameplay result. The lab automatically resets a breached bastion and is not evidence of final survival balance or retention.

Visual quality still requires the user's judgment against the references. Sound is an optional basic effect sketch and starts off; this was a visual iteration, not the final audio pass.
