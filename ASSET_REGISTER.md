# Asset Register

Policy: only CC0, explicitly redistributable permissive licences, procedurally
generated content, or content authored for this project. No asset from any
commercial game, no scraped or unverified files. Every external file must have a
row here **before** it is committed. `scripts/assets/check-register.mjs` fails the
build check if a file under `public/assets/` is not listed.

## External assets

| File | Source | Creator | Original URL | Licence | Attribution required | Modifications | Used by |
|---|---|---|---|---|---|---|---|
| *(none yet)* | | | | | | | |

## Libraries (runtime)

| Package | Version | Licence | Use |
|---|---|---|---|
| three | 0.186.0 | MIT | Rendering (incl. `examples/jsm` Sky addon) |

## Procedural / project-authored content

These are generated at runtime from seeded code in this repository (authored for
this project, same licence as the project). They are not placeholders unless marked.

| Content | Generator | Status |
|---|---|---|
| Terrain heightfield & splat map | `src/world/terrain-data.js`, `src/terrain/` | final |
| Ground textures (grass, dirt, rock, sand albedo/normal) | `src/terrain/textures.js` (canvas, seeded noise) | final |
| Building meshes (8 player + Warhall + palisade) | `src/buildings/meshes/*.js` | final |
| Character figures & animation | `src/units/figures.js` | final |
| Trees, rocks, iron veins, grass | `src/environment/vegetation.js` | final |
| Sky, water shader | three `Sky` addon (MIT) + `src/environment/water.js` | final |
| Particles (smoke, dust, sparks, fire, embers) | `src/effects/` sprite textures drawn on canvas | final |
| UI icons (inline SVG) | `src/ui/icons.js` | final |
| All audio (ambience, SFX, music, voice cues) | `src/audio/synth.js` WebAudio synthesis | final |
| Fonts | system font stacks only (no files shipped) | final |

Any item that becomes a temporary placeholder is marked `TEMPORARY` here and in
`docs/STATUS.json` until replaced.
