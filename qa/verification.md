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


## 0.2.0 portrait / retro follow-up

- Added `scripts/verify-portrait.mjs`: five viewport sizes, including 1920×1080 and narrow/short screens; portrait canvas bounds, header separation, footer bounds, offset pointer-to-world mapping, real style buttons and repeated GPU-resource reuse checks pass. Evidence: `portrait.json`.
- Retro and Original share simulation state but use separately cached model and texture variants. After warming both modes, 20 switches do not increase geometry/texture counts.
- Inspected actual desktop, 390×844 and 320×568 screenshots. Ground texture was simplified after the first screenshot showed excess noise.
- Density performance results have been refreshed for the portrait Retro renderer in `performance.json`; the two-minute 1,600-target soak was also repeated for 0.2.0 (`stability.json`): all 12 samples recorded 60 FPS, 29 geometries and 2 textures.

## 0.2.1 resolution correction

- Default Retro uses canvas CSS size times DPR (cap 1.6), not the previous 320-pixel buffer. Coarse pixels require explicit opt-in. The portrait verifier asserts the default drawing-buffer width and exercises the filter toggle.
- Verified additional crown geometry, animated banners, world-aligned paths and low terrain dressing in desktop/phone screenshots. Density benchmarks refreshed for this sharper rendering.

## 0.3.0 — sharp retro motion and complete audio replacement

- `npm test`: 4 simulation tests passed, including five simulated minutes at 1,600 density.
- `verify-graphics.mjs`: Chrome and WebKit passed native-resolution/DPR, stale first-frame time, conservative culling at three zooms, actual-pointer focus feedback, and bounded effect capacity checks.
- `verify-portrait.mjs`: five desktop/mobile/landscape viewport layouts passed, including DPR 2 phone emulation and repeated style-resource reuse.
- Ten-minute graphics soak: 1,600 alive, no runtime errors, 60 FPS samples, fixed 44 geometries / 4 textures / 23 programs after both styles were warm. JS heap after forced GC changed from 5.98 MB to 6.43 MB, not a claim of zero allocation. `qa/graphics-soak.json` identifies the tested graphics runtime hash, which predates the added audio engine and combo popup priority fix.
- `verify-audio.mjs`: Chrome and WebKit passed all 22 decodes, explicit activation with no initial audio request/context, pause/mute/resume, persistent levels without autoplay, event coverage, bounded voices, and self-contained HTML decoding. Chrome recorded 94 seconds at 1,600 density, crossing the 87.27-second score loop; peak simultaneous transient count 11, no dropped priority voices, sampled frame rate 55–60.
- Captured Chrome mix at the QA slider settings (music 62%, effects 70%, ambience 30%) measured -22.5 LUFS integrated and -4.2 dBFS true peak via ffmpeg ebur128. This is technical signal validation; the laptop remained physically muted, so no headphone/physical-phone listening claim is made.
- Final assets: approximately 3.6 MB on disk, lazy-loaded on sound activation; standalone HTML approximately 5.3 MiB including audio.
- Source sound pack licenses are preserved under `public/audio/`. Original score and edited effects are reproducible with `scripts/design-audio.py`.

Additional lifecycle checks passed: failed-download retry, synthetic page-background suspend/resume, and sound from a real local `file://` standalone URL.

Public release verified at https://wiserax.github.io/zombie-tower/?v=0.3.0 after Pages workflow 35744470436 succeeded. SHA-256 of index, standalone HTML, all runtime bundles and all 22 audio files matches the local tested build. A fresh Chrome phone viewport verified silent startup, opt-in playback, 22 decoded buffers / three loops, overcharge, scrolling sound controls, style changes and mute/suspend without page errors. Details in `qa/public-release.json`.
