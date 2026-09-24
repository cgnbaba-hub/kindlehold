# Kindlehold — Visual Critique, Round 2

- **Critic:** visual-critic (read-only)
- **Date:** 2026-09-24
- **Inputs:** `docs/screenshots/round2/*.png` (12 presets), `docs/screenshots/round1/*.png` for comparison, `docs/screenshots/e2e-20260924-101050/{main-menu,victory-screen}.png`, `ART_DIRECTION.md`, `docs/reports/round2/*.json`
- **Caveats:** The screenshots were rendered with SwiftShader, so I judged the art and not the FPS (2.5–3.8 fps is expected in software GL). Round 2 was captured before the latest commit. The faction discs, the button text labels and the control-group bar do not appear in these images and are **not scored**.
- **Technical gates:** All 12 presets pass. There are 0 page or console errors. Draw calls are 91–118 and triangles are about 1.07–1.13 M. The triangle count is high for what is on screen, since most of it is presumably grass and trees, but it is within budget.

## Scores

| Area | Score | One-line verdict |
|---|---|---|
| Terrain & ground | **5.5** | Blended roads and grass tufts are fine. The ground is a flat, over-saturated lime plane, the rock is a flat grey decal and the map edge/sky void shows in the corners. |
| Water | **5.0** | The river is a flat tinted ribbon with a repeating diagonal streak texture. There is no depth gradient or shore foam, and the ford shows as a lighter slab with hard edges. |
| Vegetation | **6.5** | The two tree types are coherent and chunky, and the clumping is good. Scale, hue and value vary too little, and they are too saturated for the "sage" brief. |
| Buildings | **6.0** | The keep, half-timber cottages and slate roofs are good up close. At overview zoom most buildings are the same small thatch box. Farm plots look like pallets. Construction stage 1 is almost empty. |
| Characters & animation readability | **4.5** | Block figures of about 8–12 px at overview. Combat is an unreadable blob of overlapping health bars. The archer pose reads as a T-pose. The hero is lost at night. |
| Lighting & time of day | **5.5** | Midday is flat but honest. Dawn is murky olive with stripes of shadow across the map. Sunset is muddy brown, not orange. Night is lit only by ember pools, and the units vanish. |
| Effects | **5.0** | The Beacon Flare is a thin yellow arc plus blown-out glow blobs. Smoke is barely visible. No projectile is readable. There is a stray full-height line artifact in the construction shot. |
| UI/HUD 1920 | **7.0** | A coherent slate & brass identity with clean type. Weak points: a blurry minimap, tiny resource icons and command buttons that were icon-only at capture time. |
| UI/HUD 1280 | **6.5** | Panels do not scale down. The selection card covers about 45% of the bottom width and the command grid about 22%, so the centre play area is crowded. |
| Menus | **5.5** | The card and typography are nice. The backdrop "keep" is three flat black rectangles, which is programmer art. The victory layout is misaligned and cramped. |
| Overall visual cohesion | **6.0** | Palette and style agree with each other. The whole thing reads as "clean procedural prototype", and lighting presets other than midday break the mood. |
| **Overall visual score** | **5.7 / 10** | A competent prototype in places and visibly programmer-made in others. It is far from 8.5. |

**Round 1 → Round 2 delta.** The midday, night and settlement frames are nearly pixel-identical between rounds. The visible changes are the riverbank strip (grey rock became beige sand) and the dawn and sunset grading. Visual progress this round is **marginal**.

## Art-direction pillar check

| Pillar | Status | Evidence |
|---|---|---|
| Readable silhouettes from RTS camera | **FAIL (partial)** | In `midday-overview`, cottages, lodge, barn and farmstead are all small beige-thatch boxes. Only the keep (round tower) and the slate-roofed barracks stand out. No signature props are visible at this zoom (log stack, crane, smoke). |
| No programmer art | **FAIL** | The main-menu backdrop keep is three black rectangles and a circle. Farm plots are flat plank quads. Construction stage 1 is stakes plus two cubes and a log pile. Health bars are unbordered dark rectangles. |
| No hiding behind fog/darkness | **FAIL** | `dawn-overview` and `sunset-overview` are about 60% dark shadow bands. In `night-overview` the forest and right half are near-black. In `hero-ability` the bottom-left third of the frame is a black shadow blob cast by an off-screen building. |
| Faction colours ≤60% saturation | **Mostly PASS** | Hearthbound blue and Rustfang rust read without looking toy-like (`combat-overview` centre). The ground green is the saturation offender, not the faction colours. |
| Night playable | **FAIL** | In `night-overview`, Maren (about x1195,y500) is readable only through her green selection ring. Settlers near the barn and farm (about x1350,y880) are black silhouettes on black grass. There is no moonlit blue fill and no rim light. |

---

## BLOCKERS (keeping the visual score under 8.5), ranked

### B1. Units are unreadable at gameplay zoom, and combat is a blob
- **Evidence:** In `combat-overview` (centre, about x700–900,y410–500), roughly 12 melee units overlap into one blue-red smear. Six health bars stack into an unreadable dark band. The archers (x760–900,y520–650) stand with both arms straight out and read as T-poses. In `midday-overview` and `enemy-raid` (right edge, x1760–1830,y420–460), units are 6–10 px specks and the raiders are a red cluster.
- **Fix:**
  1. Add an inverted-hull outline to every unit mesh: a back-face `MeshBasicMaterial` clone scaled ×1.06, in `#1b1f24` for own units and `#3a1410` for enemies. Cost is one extra draw per instanced batch.
  2. Scale unit meshes by 1.25× at camera heights above 30 m, lerped by camera distance. Settlers can stay at 1.0 in close-ups.
  3. Health bars: show them only when a unit is damaged or selected, give them a 1 px `#efe6d2` border, and make them 70% width at overview. Offset bars vertically per unit with `y += (id % 3) * 0.12`, or cluster them into one group bar when more than 4 overlap in screen space.
  4. Separation steering: raise the unit separation radius to 0.9 m so melee lines form instead of a stack.
  5. Archer idle and aim pose: bow arm forward (shoulder pitch −80°), draw arm bent (elbow 110°), never both arms at 90° abduction.

### B2. Dawn, sunset and night hide the scene in darkness (violates "honest lighting" and "night playable")
- **Evidence:** `dawn-overview` is olive-green, low-contrast and about 40% luminance, with long black tree-shadow streaks across the whole meadow (e.g. x900–1500,y500–700). `sunset-overview` is a brown-orange wash where the river is almost black (x900–1300,y250–600) and nothing reads as golden hour. In `night-overview` the bottom-right and top-left quadrants are near-black, and units are silhouettes (x850,y690; x1350,y880). In `hero-ability`, a huge black shadow covers x0–900,y550–1080.
- **Fix:**
  - Clamp the sun elevation to ≥ 18° at dawn and sunset. The streaks come from 5–10° elevations, and an RTS needs shadows no longer than about 3× object height.
  - Raise `HemisphereLight` intensity at dawn and sunset to at least 0.55 of the midday value, and set `shadow.intensity` (three r155+) or the equivalent ambient floor so shadows never go below about 35% of lit luminance.
  - Sunset: sun colour `#ffb070`, sky tint `#f2a36b`, fog `#c98a66`. Dawn: sun `#ffc9a8`, hemisphere sky `#e8b8c8` and ground `#5a5040`. Both should move away from the current olive/brown.
  - Night: add a moon directional light `#8fa8d8` at intensity about 0.35 (currently near 0) that casts no shadow, plus a hemisphere at `#2a3a5c`/`#101418` and 0.4. Give units a faction-trim emissive of `emissiveIntensity 0.35` at night.
  - AgX exposure: +0.3 EV at dawn and sunset, +0.6 EV at night.

### B3. Terrain is a flat, over-saturated lime plane, off-palette
- **Evidence:** In `midday-overview`, `settlement-closeup` and `enemy-raid`, the grass reads about `#7fae34`. That is bright lime, not the sage `#6f8a4a → #56703a` the art direction asks for. There is almost no macro value variation, no height relief in the play area and no slope shading. The rock mountain in the top-left of `midday-overview` is a flat grey plane with a crack decal, and trees sit on it with no transition.
- **Fix:**
  - Clamp the grass albedo to the palette: base `#6a8646`, and lerp to `#56703a` with 2-octave simplex noise at 60 m and 15 m wavelengths (amplitude ±12% value, ±6° hue).
  - Add dry patches (`#8f8a55`) where the noise is above 0.7.
  - Add low rolling height noise to the buildable meadow (amplitude 0.6–1.2 m at a 40 m wavelength) outside building footprints, so the sun gives form.
  - Rock: triplanar blend by slope (> 30° = rock), rock albedo `#7d7f80` with dark crevice AO from a curvature term, and a 4–6 m grass-to-scree transition band.
  - Reduce the grass-tuft density in close-ups by about 30% and tint the tufts with the same noise, so they stop reading as confetti.

### B4. Map edge and sky void visible in overview framing
- **Evidence:** `midday-overview` has a white triangle in the top-left corner (x330–420,y0–40). `sunset-overview` has a solid black triangle at the same spot. In `dawn-overview` the top-left corner is also cut. This is raw clear colour or un-rendered sky beyond the terrain.
- **Fix:**
  - Extend the terrain with a 200 m low-poly skirt that falls off to a distant hill ring, using vertex-coloured, unlit fog-blended geometry.
  - Clamp the camera target so the frustum never leaves the terrain bounds plus the skirt.
  - Set `scene.background` to the Sky shader or fog colour for every time-of-day preset, never black or white.

### B5. Water looks like a flat tinted ribbon
- **Evidence:** In `midday-overview` the river has uniform teal with no depth gradient. The ford crossings (x480–540,y60–160 and x1230–1370,y540–660) are lighter translucent rectangles with hard polygonal ends. In `combat-overview` and `enemy-raid` (top), a large diagonal streak texture repeats every 80–100 px. There is no shore foam or wet-edge darkening, and the beige sand bank is a uniform strip.
- **Fix:**
  - Colour water from depth. Compute depth as the water plane height minus terrain height (sampled from the heightmap in the vertex shader), then `mix(#4f8a86, #1f4f5c, smoothstep(0.0, 2.0, depth))`, with alpha 0.75 → 0.95.
  - Draw shore foam as a `1 - smoothstep(0.0, 0.25, depth)` band, multiplied by scrolling noise.
  - Replace the streak texture with two scrolling normal maps at different scales (8 m and 23 m, speeds 0.03 and 0.017, crossed directions), normal strength 0.25, plus a Fresnel sky reflection (Schlick, F0 0.02).
  - Ford: drop the separate lighter plane and let the depth gradient create the shallow crossing, with a few instanced stepping stones.
  - Bank: darken the terrain albedo by 25% within 1.5 m of the water line (wet edge), and break up the sand strip with the terrain noise.

### B6. Building silhouettes do not differentiate at overview zoom
- **Evidence:** In `midday-overview` (settlement, x0–520,y380–990) about 10 buildings are the same beige-thatch rectangle seen from above. The farmstead, lodge and cottages are indistinguishable. The signature props (log stack, crane, chimney smoke, ore cart) are invisible at this scale. Farm plots in `production-closeup` and `settlement-closeup` (e.g. x200–520,y750–950) are flat plank-textured quads that read like pallets, not ploughed soil.
- **Fix:**
  - Per-type roof and wall colour language: cottage thatch `#b09a5e`; farmstead long barn with a red-ochre board roof `#8a5a3a`; woodcutter open shed with a large log stack (at least 2× current size, visible from 40 m); quarry A-frame at 7–8 m tall (currently about 4 m, so it disappears); watchtower at 1.6× height.
  - Scale signature props so they project to at least 12 px at the default overview zoom.
  - Rebuild farm plots as a terrain decal in dark tilled soil (`#5a4430`) with furrow normal ridges and crop instances at 3× density. The plank borders should be a thin fence edge, not the whole surface.
  - Chimney smoke: opacity 0.35 → 0.6 and particle size ×2, so it shows at overview.

### B7. Construction stages are too sparse, and there is a stray line artifact
- **Evidence:** In `construction-closeup`, the site is 12 thin stakes, two small grey cubes (x980–1030,y450–510) and one log pile (x1015–1130,y605–680) on bare grass. There is no staked outline string, no cleared ground and no foundation. A 1 px dark vertical line runs from the top of the frame down to about y550 at x1045–1065, most likely a crane rope or debug line that spans to infinity. The progress bar (x970–1135,y425–438) floats with no frame.
- **Fix:**
  - Stage 1: add a flattened dirt footprint decal (`#8a6f50`) and connect the stakes with string (thin `LineSegments` in `#d9ccb0` at 0.3 m height). Make the material piles at least 3× bigger and sized to the building cost.
  - Stage 2: stone foundation slab at 0.4 m.
  - Stage 3: timber skeleton with a partial roof (this is visible on the barracks in `ui-1920`, so reuse it).
  - Fix the line: clamp the crane or rope geometry length to the site height, or remove the debug helper.
  - Progress bar: brass-bordered and anchored above the site's tallest point.

### B8. Menu backdrop is programmer art
- **Evidence:** In `main-menu.png`, the "keep" (x350–440,y560–710) is three flat black rectangles and an orange circle glow on flat 2D hill shapes. `victory-screen.png` uses the same backdrop.
- **Fix:**
  - Render the menu background with the real engine: a slow orbiting camera around the keep at sunset, the real Sky shader, with the UI card over it.
  - If CPU-bound, pre-render one hero image at build time from that scene and use it as a static backdrop, with a CSS Ken-Burns pan.
  - At minimum, redraw the SVG silhouette with crenellations, a hall roof, a banner, a lit window and a 3-layer parallax hill set.

### B9. Victory screen layout
- **Evidence:** In `victory-screen.png`, the "Victory" heading (centred, y285) sits on top of "The Toll Is Broken" (left-aligned, y315) with about 5 px gap, so the two headings collide and use mismatched alignment. The stat rows span 700 px with labels far from their values (x451 vs x1149), which is hard to scan.
- **Fix:** Centre the subtitle, add `margin-top: 12px`, and put a brass rule (`#c9a45c`, 1 px, 60% width) between the header and the body. Constrain the stats table to `max-width: 420px; margin: 0 auto`, with dotted leaders or zebra rows (`rgba(255,255,255,0.03)`).

---

## POLISH, ranked

1. **Keep brazier is a black bowl.** In `settlement-closeup` (x640–740,y20–75) and `ui-1920` (x825–880,y275–310), the bowl renders as a solid black hemisphere. Fix: iron material `#3a3632`, roughness 0.6, metalness 0.7, plus an ember emissive inner rim (`#ffb35c`, intensity 1.5).
2. **Quest "!" markers are oversized in world space.** In `night-overview` (x1130–1185,y950–1010), a marker is larger than a farm plot. Fix: screen-space size clamp of 22–28 px, rendered as a sprite with `sizeAttenuation: false`.
3. **Minimap is blurry.** In `ui-1920` (x20–215,y865–1060), the minimap is a soft blob with a heavy inner vignette, and terrain features barely read. Fix: render it at 256² with nearest filtering for icons, draw roads and the river as crisp vector strokes, remove the inner vignette, and add a brass 1 px frame.
4. **UI at 1280 does not scale.** In `ui-1280`, the selection card is 560 px wide and the command grid 290 px. Fix: `clamp()`-based widths such as `width: clamp(420px, 34vw, 560px)`, command buttons at 52 → 44 px below 1400 px width, and objective text at 12 px with a collapse toggle.
5. **Resource ribbon icons are tiny and low contrast.** In `ui-1920` (x30–360,y20–45), the icons are about 14 px and grey-brown on slate. Fix: 20 px icons tinted brass `#c9a45c`, and a tooltip on hover.
6. **Tree variety.** In `midday-overview` all conifers share one scale and hue. Fix: per-instance scale 0.75–1.35, hue jitter ±8°, value ±10%, and 10% dead or bare birch variants near the rock.
7. **Hero ability VFX.** In `hero-ability` (x1270–1590,y380–600), the effect is a thin arc plus overexposed white-yellow blobs. Fix: an expanding ground ring decal in additive `#ffb35c` with radial falloff, 0.6 s. Clamp the light-sprite intensity so the core stays below 1.0 after AgX. Add 30–60 ember particles that rise and fade.
8. **Territory ring dashes** (pale blue, e.g. `combat-overview` x1060–1230,y660–990) cut across roads and look like UI debris in world space. Fix: project them as a terrain decal with 40% alpha and a soft edge, and hide them unless placing a building or hovering the keep.
9. **Wall textures.** The keep and barracks stonework in `settlement-closeup` use a uniform brick tile with very even mortar. Fix: per-block value jitter ±8% and edge AO darkening, plus mortar colour `#6b6760`.
10. **Rock outcrops** (`production-closeup` x190–380,y270–420) are smooth grey blobs. Fix: flat-shaded faceting with a strata normal and 2–3 smaller satellite rocks.
11. **Smoke** from chimneys is almost invisible in daylight. Raise particle opacity and size, and tint it `#b8b0a4`.

---

## Summary

The procedural style is coherent, and the close-ups of the keep, cottages and slate roofs are the strongest work. The game is held back by five things: unreadable units, time-of-day lighting that hides the scene, a flat off-palette lime ground, a flat ribbon river, and buildings that are indistinguishable at the zoom players actually use. Round 2 changed very little visually compared with round 1. Reaching 8.5 needs B1–B6 at least. B1 (unit readability) and B2 (lighting) are the highest-leverage fixes.
