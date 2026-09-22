# Portrait retro visual study — 0.2.0

## Reference evidence

Sampled the three supplied local videos at 15%, 40%, 65% and 85% using ffmpeg (frames remain local in `research/retro/`). The long Megabonk review is 575 seconds, the short review 61 seconds, and the weapon clip 24 seconds. This is sampled visual analysis, not a claim to have watched every frame.

The useful direction is deliberate simplification: chunky enemy silhouettes, readable light faces against colored ground, angular geometry, colored shadows, and bright warm/cyan impact contrast. Lower resolution alone is insufficient. Dense microtexture makes a horde harder to read.

## Implementation

- Desktop uses a centered portrait game surface with a dark surround and phone frame. Mobile portrait fills the viewport. The game HUD uses container queries, so desktop width cannot accidentally select the wide HUD inside a narrow phone frame.
- Retro is the initial style. Following user feedback that 320-pixel rendering looked wrong, the default now renders at canvas size × device pixel ratio (capped at 1.6). Coarse 320-pixel rendering is an explicit, initially disabled Scene filter. The DOM HUD remains native-resolution.
- A deterministic 512×512 world-aligned ground texture uses clustered texels, worn approach paths, a dry central apron, nearest filtering and no mipmaps. Emerald ground, cool ambient shadows and warm sunlight replace the olive palette in Retro.
- Three cached retro zombie geometries have larger heads and wider silhouettes, pale skin and more distinct clothing. Live and fallen bodies use matching geometry. Original geometry remains available.
- Existing mortar explosions, Tesla ribbons, muzzle flashes, particles and death motion all pass through the same pixel grid. They retain their timing and pooled rendering.
- Scene → Original restores the prior models, ground, lighting and smooth render resolution. Switching does not restart the simulation. The portrait framing remains in both modes.
- Camera aspect, pointer raycasting, focus markers and particle size use the actual game canvas rather than the browser window. Particle projection uses drawing-buffer height, avoiding oversized effects in the low-resolution pass.

## Scope

This is a visual comparison prototype, not a finished progression game or a reproduction of Megabonk assets. No balance changes. Sound remains opt-in. The First 100 Days transcript is now archived locally for subsequent gameplay design; its numerical recommendations have not been treated as validated balance data.

## 0.2.1 follow-up

The user correctly flagged excessive whole-scene pixelation. Native-sized rendering is now the default. The further art pass adds a copper conductor crown, a rotating cyan core, shader-animated red banners, a stone apron, low plants between approach streams and broken fence remnants. New dressing appears only in Retro; Original remains available.


## 0.3.0 motion and readability pass

- Solid, faceted mortar fire and brief irregular impact flashes establish a readable explosion before smoke; directional muzzle cones and recoil give the batteries mechanical weight. Luminous cores ignore environmental fog.
- The Tesla crown pulses on discharge. Brutes have small footstep dust puffs. Runners lean forward; brutes have a heavier belly, shoulders and hands.
- Limbs rotate their lighting normals together with their positions. Dead bodies use a bent-limb pose, element-specific fall timing and a short electrical tint; blast marks fade out over their last three seconds.
- Focus fire has a five-second world-space reticle. Large pack-clear messages take priority over smaller subsequent clears.
- Conservative per-instance culling avoids drawing off-screen bodies while keeping their simulation active. Bounds retain edge-visible heads/arms. Corpses keep aging/moving even when not rendered.
- Fixed material variants are compiled before the first visible volley. Shared particle shaders now explicitly convert color space.
- Resize redraws the canvas while paused, and the frame loop detects display-density changes even when no resize/media-query event is delivered. A synthetic stale animation timestamp verifies that startup cannot run the simulation backward.

A one-minute recorded sequence was inspected at the overcharge transition: a visible discharge, falling bodies, expanding ring and a clear gap in the horde. That review exposed the small-clear popup overwriting the large clear, which prompted the priority rule. This evidence supports presentation, not any claim about long-term gameplay quality.
