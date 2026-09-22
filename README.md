# Deadwood — Zombie Tower visual prototype

A stationary, industrial fortress holds off a dense animated zombie horde. This is a **visual combat study**, not the complete progression game.

## Play

[Open the live prototype](https://wiserax.github.io/zombie-tower/) · [Single-file HTML](https://wiserax.github.io/zombie-tower/Deadwood.html)

- Defenses fire automatically. Tap the battlefield to focus fire for five seconds.
- **Overcharge** (or Space) clears a large area with chained electrical impacts.
- Toggle gun/crossbow, Tesla, and mortar batteries to compare their effects.
- Open **Scene** to compare **Retro / Original** visuals, change crowd density (300–1,600), zoom, screen shake, and performance counters.
- Wounded zombies show health bars and a delayed damage trail. Scene can show all bars or hide them, disable damage numbers, or switch off reactive lighting.
- Consecutive kills build a timed **kill chain**. The draining meter shows the remaining gap before the chain ends. Pack totals and streaks count real kills; they do not grant a damage multiplier.
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

Build once and serve the frozen output in a separate terminal:

```sh
npm run build
python3 -m http.server 5197 --directory dist
```

```sh
npm test
python3 tests/wiki_export_test.py
node scripts/verify-browser.mjs
node scripts/verify-portrait.mjs
node scripts/verify-graphics.mjs
node scripts/verify-audio.mjs
node scripts/verify-audio-lifecycle.mjs
node scripts/verify-feedback.mjs
node scripts/verify-feedback-lifecycle.mjs
node scripts/verify-siege-pressure.mjs
node scripts/profile-feedback.mjs
SOAK_ENGINE=webkit SOAK_SECONDS=600 node scripts/soak-feedback.mjs
SOAK_ENGINE=chrome SOAK_SECONDS=600 node scripts/soak-feedback.mjs
```

Serve `dist/` at port 5197 for the feedback checks. The browser verifier uses installed Chrome, runs desktop and portrait emulation, exercises pause/overcharge/settings, captures screenshots, and writes `qa/performance.json`. Set `BASE_URL` to test another build (the audio verifier uses `TEST_URL`). The graphics and feedback verifiers also use installed Playwright WebKit (`npx playwright install webkit`). The feedback soak runs at 1,600 target density, repeatedly changes settings, and records the runtime bundle hash. The profiler uses GPU timer queries when supported; CPU throttling is explicitly separate from a physical-phone benchmark.

Desktop uses a portrait phone frame; mobile portrait fills the screen. Version **0.4.0** adds damaged-enemy HP bars, damage and pack numbers, kill streaks, warm/cold impact lighting, electrical crackle, moving bolts and shells, recoil, and more readable falling bodies. The HUD remains compact, including in short windows. Reduced-motion preferences disable camera shake and UI flourish. A lost graphics context pauses the siege and recovers it without advancing unseen combat.

The sharp retro scene and sample-based adaptive score from 0.3 remain. Coarse pixel rendering is optional; the UI stays sharp. See the [combat feedback design](docs/combat-feel-pass.md), [visual study](docs/retro-visual-study.md), and [sound design](docs/sound-design.md).

## Implementation

- Three.js / WebGL2, instanced zombie geometry, shader-driven gait.
- Typed-array horde simulation, bounded spatial-neighbor queries.
- Fixed-capacity debris, glow and smoke pools; bounded corpse/scorch retention.
- Procedural original models and textures. No extracted commercial art or video files in this repository.
- Firstfire's font/visual-language reuse: Lilita One and DM Sans, with OFL licenses under `public/fonts/`.

See [visual brief](docs/visual-brief.md), [technology findings](docs/technology.md), and [reference archive](docs/reference-archive.md).
