# Graphics acceptance: portrait retro study

The objective is a visually satisfying, readable phone-sized siege with hundreds of animated enemies. This pass does not implement the eventual upgrade economy, chapters, or full game.

| Requirement | Implementation | Verification |
|---|---|---|
| Phone presentation on a desktop | Bounded portrait shell, dark surround, container-based HUD layout | `scripts/verify-portrait.mjs`, rendered desktop and phone screenshots |
| Sharp default resolution | Drawing buffer uses canvas size × device density, capped at 1.6; coarse pixels opt-in | Default-resolution assertion, runtime DPR-change test, public runtime check |
| Retro character beyond low resolution | Chunkier distinct enemy forms, clustered world texture, limited terrain palette, copper/cyan fortress focal point | Reference frame study, full-scene and impact captures; final taste remains a human judgment |
| Keep a visual comparison | Original restores original environment map, lighting and geometry; same simulation | Style-button checks and repeated GPU-resource reuse |
| Hundreds of recognizable bodies | Instanced shamblers, forward-leaning runners, heavy brutes; animated limbs and matching normal rotation | Chrome and WebKit render checks, 1,600-target density run |
| No clipping at viewport edges | Conservative animated-body bounds, camera-relative culling, gameplay continues outside view | Projected body-corner check at three zoom values |
| Distinct weapon impacts | Directional muzzle cones, recoil, cyan Tesla crown pulse, faceted mortar fire, brief jagged blast flash, debris, fading scorches | Timed impact snapshots, recorded battle sequence, bounded effect-pool test |
| Readable deaths | Bent-limb body poses, different lift/timing for shells and bullets, short electrical flash | Death-frame inspection in the recorded siege; corpse pool retained at 400 maximum |
| Feedback for focus fire | Ground-space animated reticle follows the five-second targeting period | Real pointer input and world-marker visibility assertion |
| Readable damage and status | Instanced damaged-only HP bars, delayed loss trail, generation-safe numeric labels and local electric filaments | `feedback.json`; actual damage, slot recycling, expiration and phone HUD exclusion checks |
| Rewarding multi-kills without a covered battlefield | Local pack totals, one timed streak meter, highest milestone once per frame, limited surge arcs | Equal-size 0.3/0.4 motion comparison, pause/timeout assertions, natural pressure/reset test |
| Surface lighting supports impacts | Three reused shadow-free point lights, warm shell light, cold Tesla light and instanced ground glows | Timed close-up captures and repeated toggles with stable shader/resource counts |
| Smooth startup and resize | Nonnegative frame time, fixed-material warmup, redraw on resize, density-change detection | Synthetic stale-first-frame timestamp and DPR changes while paused |
| Long-running stability | Fixed-capacity pools and cached style resources | `feedback-soak-chrome.json` and `feedback-soak-webkit.json`, each with runtime hash, wall duration and pool/resource samples |
| Recovery and touch UI | Freeze invisible combat on context loss, preserve pause, native Scene-panel panning | `feedback-lifecycle.json`, Chrome touch dispatch and forced context loss in both engines |
| No unwanted sound | Audio remains off until explicitly enabled | No audio context created during default startup or automated runs |

## Important limits

- Desktop Chrome and desktop WebKit with mobile viewports are engine/layout tests, not measurements from an Android or iPhone.
- CPU render-submission timings do not measure GPU execution directly.
- `feedback-performance.json` uses GPU timer queries where supported. `feedback-environment.json` records the battery-power cadence check; the WebKit blank-page baseline also ran around 30 FPS. Do not present a blanket 60 FPS claim.
- An attractive screenshot and a stable frame rate do not establish game retention or final gameplay balance.
- The default 320-pixel experiment was rejected by the user as looking like a resolution defect. Retain the lesson: stylization should survive a sharp render. The coarse filter is an optional comparison, not the default art direction.
