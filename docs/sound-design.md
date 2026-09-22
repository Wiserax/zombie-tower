# Deadwood siege sound design — 0.3

The sound should support a long-running siege without becoming tiring. The previous single-oscillator effects are removed. This is a complete sample-based replacement, with an original rendered score and edited CC0 foley layers.

## Identity and arrangement

- **Music:** 32 bars / 87.27 seconds, 88 BPM, D minor. A warm low pulse, restrained metallic plucks, slowly changing suspended chords and sparse drums. Four eight-bar sections change register, density and phrasing. Circular delay tails make the phrase loop continuously. Two aligned stems share one AudioContext start time and exact musical loop boundary.
- **Pressure:** the percussion layer rises with horde size and lost bastion health. This is a visual lab without round progression; the music responds to conditions that actually exist.
- **Ambience:** a quiet wind bed and occasional distant creature calls. Hundreds of zombies do not create hundreds of simultaneous voices.
- **Weapons:** gun crack + low body + mechanism, wooden ballista snap/string, mortar tube report separate from the delayed debris/pressure explosion, and an electrical crackle distinct from gunfire.
- **Overcharge:** immediate, wide-spectrum discharge with a longer collapse tail, synchronized to the actual strike. Music ducks briefly so the discharge has room.
- **Feedback:** tactile buttons, focus target tick, bastion impact, subdued grouped deaths, pack-clear flourish and charge-ready cue. These are throttled to avoid constant reward noise.

## Mix and performance contract

One lazy-created AudioContext; three user buses (music, effects, ambience); 22 decoded assets; three persistent loop sources; at most 24 transient sources. Repeated effects have per-type interval and concurrency limits. Gun attacks alternate three source variations, explosions and creature calls alternate two; playback speed varies slightly. Higher-priority events can replace a lower-priority voice.

A shared short convolution space is used only for heavy effects. A high-pass removes subsonic energy, a compressor controls peaks, and a final soft-knee limiter keeps output below full scale. Weapon stereo placement is deliberately narrow for phones. Music is not spatialized.

No effects, loops, network audio downloads or AudioContext start on page load. First explicit sound activation loads the assets. Pause, mute and backgrounding fade the master and suspend the context. Resuming retains the music playhead and does not stack loops. Volume choices persist locally; consent to autoplay does not persist. A failed download can be retried.

Hosted playback loads audio on demand. `Deadwood.html` embeds the same audio as data URLs, so it remains self-contained. Source pack licenses and production provenance are in `public/audio/`.

## Verification

`scripts/verify-audio.mjs` covers Chrome and WebKit decoding, user-gesture activation, mute/pause/resume, no loop duplication, volume persistence, transient caps, observed mix headroom and actual combat event coverage. Chrome capture crosses the complete 87-second musical loop. The standalone build is separately checked for decoding without external audio requests.

The Mac stays physically muted during automation. Captured audio and signal measurements can establish technical correctness, not whether the user likes the music. Headphone/real-phone listening remains a subjective acceptance check; do not claim studio-quality listening validation from numerical tests.

## Reproduction

Download the official Kenney Impact, Sci-Fi and Interface Sounds CC0 packs to `research/audio/{impact,scifi,ui}` (licenses included in the shipped folder). Run `python3 scripts/design-audio.py` with numpy and ffmpeg available. The script records every sample, transformation and composed note; it writes the 22 assets and a signal manifest. Only the selected final assets ship, not the complete source libraries.
