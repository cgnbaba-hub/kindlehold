# Kindlehold — Art Direction

## Pillars

1. **Readable from 40 m up.** Every building has a unique silhouette (roof shape +
   one signature prop) recognisable at gameplay zoom without labels.
2. **Grounded, slightly stylised.** Chunky proportions (roofs ~1.3× realistic
   pitch, oversized doors and props), clean bevelled geometry, no noisy
   micro-detail. Materials are PBR (`MeshStandardMaterial`) with procedural,
   low-frequency albedo variation.
3. **Warm hearth vs. cold wilderness.** Hearthbound settlement: warm limewash,
   honey timber, slate-blue roofs, ember-orange lights. Rustfang Reavers: rust,
   soot, bone and dull crimson cloth. Wilderness: desaturated sage greens, cool
   grey-blue stone, peat browns.
4. **Honest lighting.** Tone-mapped (AgX), sRGB output, physically plausible sun and
   sky; no bloom or grading used to hide geometry.

## Palette (linear-ish sRGB hex)

| Role | Colour |
|---|---|
| Limewash walls | `#d9ccb0` |
| Timber frame | `#6b4a2f` |
| Honey planks | `#a77b4f` |
| Slate roof | `#4f5a66` |
| Thatch | `#b09a5e` |
| Hearthbound faction (cloth, banners) | `#2f6f8f` teal-blue with `#e3b04b` gold trim |
| Rustfang faction | `#8c3b2a` rust-crimson, `#3a302a` soot |
| Grass (sage) | `#6f8a4a` → `#56703a` |
| Dirt / road | `#8a6f50` |
| Rock | `#7d7f80` |
| Water deep / shallow | `#1f4f5c` / `#4f8a86` |
| Ember light | `#ffb35c` |

Faction colours are kept at ≤ 60% saturation so they read without looking toy-like.

## Lighting & atmosphere

- Directional sun with camera-fitted shadow map (2048², PCF soft), hemisphere sky
  fill, atmospheric `Sky` shader for the dome, exponential distance fog tinted by
  time of day.
- Day–night cycle: dawn (pink-gold, long shadows), midday (neutral), sunset
  (orange), night (moonlit blue, ~15% sun-equivalent exposure, windows and braziers
  lit with ember light). Night must remain playable: units keep readable rim/outline
  from the selection ring and faction cloth.

## Buildings — silhouette language

| Building | Signature |
|---|---|
| Keep | Squat round stone tower + hall, brazier on top, faction banner |
| Cottage | Steep thatch roof, chimney with smoke |
| Woodcutter's Lodge | Open-sided shed with log stack and chopping stump |
| Quarry | Timber crane (A-frame) + stone blocks |
| Farmstead | Long low barn, fenced crop plots around it |
| Iron Mine | Timbered adit into a rock mound, ore cart on rails |
| Barracks | Long hall with weapon racks and training dummy |
| Watchtower | Tall timber tower on stone plinth, pointed roof, lantern |
| Rustfang Warhall | Palisade-ringed hall with rust-red hides and horn totems |

Construction stages: (1) staked outline + material piles, (2) foundation, (3) frame
(timber skeleton), (4) complete. Damaged buildings show smoke; <35% HP shows fire.

## Characters

Low-poly segmented figures (~350–600 triangles), 1.7 m tall, readable pose
animation (walk, work, attack, die). Settlers: earth-tone tunics with faction trim;
tool held per profession. Soldiers: helmet + shield/weapon shapes per class.
Maren: long coat, hood, lantern pole with emissive lantern. Vharek: 1.3× scale,
horned helm, great axe.

## UI

Original "slate & brass" identity: dark blue-grey slate panels (`#1d2329` at 92%
opacity), thin brass rule lines (`#c9a45c`), warm off-white text (`#efe6d2`), serif
headings (system serif stack: *Iowan Old Style, Palatino, Georgia*), sans body text.
Resource ribbon top-left, objectives top-right, selection card bottom-centre,
command grid bottom-right, minimap bottom-left. Icons are drawn as inline SVG made
for this project.

## Things we do not do

- No imitation of any existing game's UI frames, icons, logos or building designs.
- No programmer art (untextured grey boxes, default materials) in the playable game.
- No heavy bloom, depth of field, vignettes or darkness used to hide geometry.
