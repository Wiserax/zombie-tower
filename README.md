# Deadwood — Zombie Tower visual prototype

A stationary, industrial fortress holds off a dense animated zombie horde. This is a **visual combat study**, not the complete progression game.

## Play

[Open the live prototype](https://wiserax.github.io/zombie-tower/) · [Single-file HTML](https://wiserax.github.io/zombie-tower/Deadwood.html)

- Defenses fire automatically. Tap the battlefield to focus fire for five seconds.
- **Overcharge** (or Space) clears a large area with chained electrical impacts.
- Toggle gun/crossbow, Tesla, and mortar batteries to compare their effects.
- Open **Scene** to compare **Retro / Original** visuals, change crowd density (300–1,600), zoom, screen shake, and performance counters.
- Sound starts **off**. Tap ♪ for the new siege soundtrack and sound mix. Scene has separate music, effects, and ambience sliders. Pause is available at the upper right.
- If the bastion falls, the visual lab automatically starts another last stand.

## Run locally

```sh
npm ci
npm run dev
```

Open the URL printed by Vite. `npm run build` produces a static `dist/` directory suitable for GitHub Pages. No server, login, analytics, or external asset service is required at runtime.

The build also creates **`dist/Deadwood.html`**, a self-contained approximately 5.3 MiB playable with its scripts, styles, fonts, generated art, soundtrack, and sound effects embedded. It was checked through a local `file://` URL in Chrome. Mobile file viewers vary; the hosted URL is the simplest way to play on a phone.

## Verify

```sh
npm test
python3 tests/wiki_export_test.py
node scripts/verify-browser.mjs
node scripts/verify-portrait.mjs
node scripts/verify-graphics.mjs
node scripts/verify-audio.mjs
node scripts/soak-graphics.mjs
```

The browser verifier uses an installed Chrome, runs desktop and portrait emulation, exercises pause/overcharge/settings, captures screenshots, and writes `qa/performance.json`. Set `BASE_URL` to test a deployed build. The graphics verifier additionally uses installed Playwright WebKit (`npx playwright install webkit`). The graphics soak runs for ten minutes at 1,600 target density and records the runtime bundle hash. Physical-phone performance remains a separate test.

Desktop uses a portrait phone frame; mobile portrait fills the screen. Version **0.3.0** adds a sharp retro battlefield (coarse pixel rendering is optional), chunky zombie silhouettes and a cooler emerald palette. UI remains sharp. This release also replaces the old tones with a complete sample-based sound mix and adaptive original score. See the [visual study](docs/retro-visual-study.md) and [sound design](docs/sound-design.md).

## Implementation

- Three.js / WebGL2, instanced zombie geometry, shader-driven gait.
- Typed-array horde simulation, bounded spatial-neighbor queries.
- Fixed-capacity debris, glow and smoke pools; bounded corpse/scorch retention.
- Procedural original models and textures. No extracted commercial art or video files in this repository.
- Firstfire's font/visual-language reuse: Lilita One and DM Sans, with OFL licenses under `public/fonts/`.

See [visual brief](docs/visual-brief.md), [technology findings](docs/technology.md), and [reference archive](docs/reference-archive.md).
