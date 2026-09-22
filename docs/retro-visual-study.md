# Portrait retro visual study — 0.2.0

## Reference evidence

Sampled the three supplied local videos at 15%, 40%, 65% and 85% using ffmpeg (frames remain local in `research/retro/`). The long Megabonk review is 575 seconds, the short review 61 seconds, and the weapon clip 24 seconds. This is sampled visual analysis, not a claim to have watched every frame.

The useful direction is deliberate simplification: chunky enemy silhouettes, readable light faces against colored ground, angular geometry, colored shadows, and bright warm/cyan impact contrast. Lower resolution alone is insufficient. Dense microtexture makes a horde harder to read.

## Implementation

- Desktop uses a centered portrait game surface with a dark surround and phone frame. Mobile portrait fills the viewport. The game HUD uses container queries, so desktop width cannot accidentally select the wide HUD inside a narrow phone frame.
- Retro is the initial style. Render width is capped at 320 physical pixels and upscaled with nearest-neighbor CSS; the DOM HUD keeps native resolution.
- A deterministic 128×128 painted ground texture uses restrained clustered texels, nearest filtering, no mipmaps. Emerald ground, cool ambient shadows and warm sunlight replace the olive palette in Retro.
- Three cached retro zombie geometries have larger heads and wider silhouettes, pale skin and more distinct clothing. Live and fallen bodies use matching geometry. Original geometry remains available.
- Existing mortar explosions, Tesla ribbons, muzzle flashes, particles and death motion all pass through the same pixel grid. They retain their timing and pooled rendering.
- Scene → Original restores the prior models, ground, lighting and smooth render resolution. Switching does not restart the simulation. The portrait framing remains in both modes.
- Camera aspect, pointer raycasting, focus markers and particle size use the actual game canvas rather than the browser window. Particle projection uses drawing-buffer height, avoiding oversized effects in the low-resolution pass.

## Scope

This is a visual comparison prototype, not a finished progression game or a reproduction of Megabonk assets. No balance changes. Sound remains opt-in. The First 100 Days transcript is now archived locally for subsequent gameplay design; its numerical recommendations have not been treated as validated balance data.
