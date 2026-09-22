# Rendering decision and performance evidence

## Decision

Use JavaScript + Three.js WebGL2 for the first visual prototype. Keep the simulation independent of rendering so a worker or WebAssembly module can be substituted if measurements later justify it.

Changing the language alone does not reduce draw calls, transparent overdraw, texture bandwidth, or GPU cost. [Three.js InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html) batches shared geometry with per-instance transforms. [MDN's WebGL guidance](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices) recommends batching draws and managing resolution. These are the first constraints addressed here.

## Concrete budgets

- 2,048 simulation slots; scene controls expose up to 1,600 active zombies.
- Three living zombie meshes, with limb animation in the vertex shader. No per-zombie scene graph or skeleton.
- A 50×50 grid limits separation checks to at most 25 candidate neighbors per zombie per step.
- 400 retained corpses, at most 180 per visual type; 12-second retention.
- 2,400 debris particles, 350 smoke billboards, 240 glow billboards, 900 line segments, 64 pressure rings, and 160 scorch marks.
- Chain lightning visits at most 13 targets per shot; piercing bolts hit at most three targets.
- Merged environment meshes, a single directional shadow light, and no per-enemy shadow map pass.
- Pixel ratio capped at 1.6. The application pauses simulation while the tab is hidden.

## Measurement

`scripts/verify-browser.mjs` runs the actual game, not a detached particle demo. It records mean presented frame interval, frame p95, CPU simulation p95, CPU render-submission p95, alive/visible counts, draw calls, triangles and retained GPU resources. CPU render time is **not GPU execution time**.

`qa/performance.json` contains the latest results and GPU identity. Tests use headless installed Chrome on an Apple M1 Max. Portrait 390×844 with touch/DPR emulation is still running on that Mac, **not a physical phone**. Initial measurements sustained approximately 60 FPS at 300/600/1,000/1,600 living zombies. At portrait size, about 350 of 600 were within the camera frustum.

Do not infer an Android/iPhone guarantee from those results. Validate on a midrange physical device, including a several-minute heat/load run. If GPU-bound, lower resolution, shadow size and transparency before rewriting the simulation. If simulation time becomes the limit after adding full gameplay, first profile neighbor/targeting work, then assess a worker or WASM implementation against the same scene.

## Verification boundaries

The deterministic simulation test advances five minutes at 1,600 target density, checking finite positions, fort exclusion, pool accounting and neighbor limits. Browser tests check actual rendering, controls and console errors. These establish stability/performance for the tested environment, not enjoyment, retention or final combat balance.
