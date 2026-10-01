# Asset Register

Policy: only CC0, explicitly redistributable permissive licences, procedurally
generated content, or content authored for this project. No asset from any
commercial game, no scraped or unverified files. Every external file must have a
row here **before** it is committed. `scripts/assets/check-register.mjs` fails the
build check if a file under `public/assets/` is not listed.

## External assets

| File | Source | Creator | Original URL | Licence | Attribution required | Modifications | Used by |
|---|---|---|---|---|---|---|---|
| `public/figures/kaykit.bin`, `public/figures/kaykit.json` | KayKit Adventurers Character Pack 1.0 (Knight, Barbarian, Rogue, Rogue_Hooded, Mage; helmets, hats, capes, swords, axes, shields, crossbows; 37 of its 76 animations) | Kay Lousberg (kaylousberg.com) | https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0 | CC0 1.0 | No (credited anyway) | Baked by `scripts/assets/bake-figures.mjs`: palette texture converted to vertex colours with tint slots, attachments moved into bone space, animations sampled at 24 fps as bone matrices | `src/units/skinned-figures.js`, `src/units/cast.js` |
| `public/figures/KAYKIT-LICENSE.txt` | the pack's licence file | Kay Lousberg | as above | CC0 1.0 | – | unchanged | – |
| `public/buildings/kaykit.bin`, `public/buildings/kaykit.json` | KayKit Medieval Hexagon Pack 1.0 (17 blue buildings, 9 neutral pieces, 16 props) | Kay Lousberg (kaylousberg.com) | https://github.com/KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack-1.0 | CC0 1.0 | No (credited anyway) | Baked by `scripts/assets/bake-buildings.mjs`: palette texture converted to vertex colours with a surface pattern per palette cell, window panes flagged for the night glow, moving parts (windmill sails, watermill wheel) split off | `src/buildings/kaykit.js`, `src/buildings/meshes.js` |
| `public/buildings/KAYKIT-LICENSE.txt` | the pack's licence file | Kay Lousberg | as above | CC0 1.0 | – | unchanged | – |
| `public/animals/quaternius.bin`, `public/animals/quaternius.json` | Ultimate Animated Animal Pack: Deer and Stag (6 of their animations) | Quaternius (quaternius.com) | https://quaternius.com/packs/ultimateanimatedanimals.html — files taken from the Poly Pizza mirror (https://poly.pizza/m/T6Cs7tmMHJ, https://poly.pizza/m/tQdzbZ1Cmw) as kept in https://github.com/jpabloglez/trailpaw (`assets/animals/deer/deer.glb` SHA-256 `fabf360b22eaccccd056ee99d698a9562d15aa245821f96e4fbad6db3751604e`, `assets/animals/stag/stag.glb` SHA-256 `3c2df7c13a3d37c8660684e46aa1e5a2bf7e91a9b279983921d48bd93d0b67ed`) | CC0 1.0 | No (credited anyway) | Baked by `scripts/assets/bake-animals.mjs`: material colours converted to vertex colours, antlers bound to their bone, turned to face +Z and scaled to the game's size, animations sampled at 15 fps as bone matrices | `src/environment/animals-skinned.js`, `src/environment/wildlife-view.js` |
| `public/animals/QUATERNIUS-LICENSE.txt` | the pack's licence file (from the owner's copy of the pack) | Quaternius | as above | CC0 1.0 | – | unchanged | – |

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
| Building meshes (8 player + Warhall + palisade) | `src/buildings/meshes.js` | final |
| Character figures & animation (fallback when the KayKit data cannot load; tools, goods, lantern) | `src/units/figures.js`, `src/units/poses.js` | final |
| Trees, rocks, iron veins, grass | `src/environment/vegetation.js` | final |
| Sky, water shader | three `Sky` addon (MIT) + `src/environment/water.js` | final |
| Particles (smoke, dust, sparks, fire, embers) | `src/effects/` sprite textures drawn on canvas | final |
| UI icons (inline SVG) | `src/ui/icons.js` | final |
| All audio (ambience, SFX, music, voice cues) | `src/audio/index.js` WebAudio synthesis | final |
| Fonts | system font stacks only (no files shipped) | final |
| `src/ui/assets/menu-backdrop.jpg` (main-menu backdrop) | rendered by the game's own engine with `scripts/assets/render-menu-art.mjs` (project-authored) | final |

Any item that becomes a temporary placeholder is marked `TEMPORARY` here and in
`docs/STATUS.json` until replaced.
