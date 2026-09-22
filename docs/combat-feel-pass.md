# Combat feedback pass — 0.4 design and acceptance

A readable, rewarding siege at phone size. The 0.3 scene has density and weapon mechanics, but lacks a clear feedback hierarchy. This pass adds information and impact without turning the center of the battlefield into a wall of numbers.

## Feedback hierarchy

1. Ordinary shot: brief directional tracer, small hit spark, body reaction, accurate health loss.
2. Wounded enemy: screen-sized HP bar above the head, delayed loss segment; electricity shows a short cyan status accent. Healthy distant enemies do not fill the screen with bars.
3. Heavy event: different shell, bolt and electric impacts; reactive local light, readable shock front, distinct death motion and short aftermath.
4. Multi-kill: one grouped localized pack number at the explosion, not a number above every body. Individual damage numbers are pooled, coalesced and capped.
5. Streak: compact, persistent kill-chain meter with a clearly draining timeout. Milestone flourish has priority; no fullscreen announcements over the tower. The streak is visual feedback, not an invented damage multiplier.
6. Manual overcharge: charge cue, expanding visible discharge, short controlled camera impulse, distinctive aftermath. Respect reduced-motion/impact settings and avoid repeated fullscreen white flashes.

## Visual direction

Retain the sharp portrait canvas, chunky silhouettes and emerald ground. Improve warm/cool lighting separation and localized illumination. Keep readable silhouettes in shadows. Make damage feel connected to the zombie and firing point rather than scattered random particles.

## Resource contract

GPU-instanced health bars and numeric glyphs; no per-zombie DOM, canvas textures or material allocations. Fixed pools, bounded event queues, shared glyph atlas, stable number of actual lights. Offscreen simulation remains active. Limit simultaneous labels and prioritize big events. Pause must freeze VFX and streak time; mute remains opt-in. All counts and timers reflect real damage/kills.

## Review plan

- Capture the baseline and new version at 390×844, 320×568, desktop phone frame and density 1,600.
- Inspect motion for overlapping health bars/numbers, hidden enemies, sudden corpse disappearance, and whether each weapon is distinguishable with sound off.
- Isolate guns, ballistas, Tesla, mortars and overcharge for timing review.
- Verify real damage values, no repeated reward for one death, streak expiry/reset, slot reuse and pause behavior.
- Profile CPU/GPU draw counts, fixed pool limits, repeated scene toggles and long-running resource stability. Desktop phone emulation is not a physical phone benchmark.
- Publish only after browser checks and public runtime verification; preserve learning on `game-engine` branch.

## Implemented behavior

- HP bars are 17×4 CSS pixels for ordinary enemies and 25×5.5 for brutes. They appear after damage, preserve a short loss trail, and turn cyan during the actual electric slow. Scene offers damaged/all/off modes.
- Damage numbers report applied damage, including capped overkill. Rapid hits on the same generation of one enemy combine. Mortar and surge kills use one gold pack total instead of a label for every body.
- Kill chains use a 2.4-second gap and thresholds of 10, 25, 50, 100, 200, 500 and 1,000. A mass kill announces the highest threshold once. The best chain lasts for this page session. The automatic-reset cleanup blast is excluded from chains and personal bests; the scene's total eliminated counter still counts those removed enemies.
- Guns have a warm tracer core and brass ejection. Ballistas have visible feathered bolts and recoil. Mortars have modeled shells, warm light on nearby surfaces, ground glow and layered impact. Tesla survivors carry short local filaments. Overcharge has a crown charge, at most twelve distributed arcs and a fading dome/rim.
- Bodies fall, land with dust, remain for a short aftermath and dissolve over their final 0.8 seconds. Brutes have heavier motion. Offscreen deaths continue to count but do not consume the visible debris budget.
- Wall attackers create bounded local stone strikes. Low health adds smoke, an amber/red defense panel and a subtle peripheral tint. Reset clears old pack/damage labels.

## Resource limits

| Channel | Bound |
|---|---:|
| Health bars / status filaments | 2,048 instances each; only visible eligible units submitted |
| Damage / pack labels | 32 labels, 192 atlas glyphs |
| Contact stars | 120 |
| Reactive lights | Three fixed point lights; no additional shadows |
| Light events / ground glows | 24 |
| Bodies | 400 total, seven-second lifetime |
| Surge arcs | At most twelve; gameplay damage still reaches all in-range enemies |

## Review findings

The previous release and this build were observed at equal 390×844 viewports with the same seeded input sequence. Wounded survivors and heavy-event consequences are more legible. Intermediate reviews rejected an over-dense lightning web, a long noisy corpse dissolve, overlapping number labels and a bottom recharge line that escaped its button. A real touch swipe exposed the page-level `touch-action` conflict. A natural no-defense run exposed the unearned reset streak; both were corrected.

The checks cover Chrome and WebKit, 320×568 through desktop portrait framing, actual file startup, sound opt-in, pause, graphics-loss recovery and the pressure/reset sequence. Machine-readable reports live in `qa/feedback*.json`, `qa/portrait.json`, `qa/graphics.json` and `qa/audio.json`.

Performance must be read with its environment report. The Mac switched to battery during review; a blank visible WebKit page also measured roughly 30 FPS while Chrome stayed near 60. No power settings were changed. Direct GPU timings, CPU submission timings and browser frame cadence are different measurements. Physical Android/iPhone performance and the user's judgment of the visual result remain unverified by desktop emulation.

The current endless automatic-fire scene can maintain a chain for a very long time. The meter is honest kill feedback, not evidence of skill or an economy multiplier. Meaningful chain risk/reward and encounter breaks should be designed with the eventual wave/upgrade loop rather than fabricated for this visual test.
