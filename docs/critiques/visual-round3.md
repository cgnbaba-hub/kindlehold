# Kindlehold — Visual Critique, Round 3

- **Critic:** visual-critic (read-only)
- **Date:** 2026-09-24
- **Inputs:** `docs/screenshots/round3/*.png` (12 presets), `docs/screenshots/round2/*.png` for comparison, `src/ui/assets/menu-backdrop.jpg`, `docs/screenshots/e2e-20260924-122709/{main-menu,victory-screen}.png` (captured before the menu change), `ART_DIRECTION.md`, and the commits `dc91a52` and `8358b92`.
- **Caveats:**
  - The screenshots were rendered with SwiftShader, so I judged the art and not the FPS.
  - Round 3 was captured **before** commit `8358b92`, which replaced the water normal map. The crosshatch/grid in the water that appears in every round-3 frame should be gone in the next capture. I still scored what the images show, and I say below which water findings that commit may resolve.
  - No capture shows the new menu or victory layout. The e2e shots predate the change. I judged the backdrop JPG on its own and treat the victory fix as **unverified** (it is CSS only).

## Scores

| Area | R2 | R3 | One-line verdict (R3) |
|---|---|---|---|
| Terrain & ground | 5.5 | **6.0** | The corner void is gone thanks to the scenery ring. The ground is a touch more olive, but it is still a bright, flat, lime-leaning plane with no relief, and the rock is unchanged. |
| Water | 5.0 | **4.5** | This is a regression in this capture. A visible grid/crosshatch or diagonal streak covers the whole river (worst in `combat-overview` and `enemy-raid`). There is still no depth gradient or foam, and the ford is still a pale slab. |
| Vegetation | 6.5 | **6.5** | Unchanged. The trees are coherent, but scale and hue are uniform and too saturated for the sage brief. |
| Buildings | 6.0 | **6.5** | Per-type roofs help a lot at overview (red-ochre barns, mossy-green lodge, slate barracks). The plots still read as slatted pallets, the build site has a broken footprint decal, and the brazier is still a black bowl by day. |
| Characters & readability | 4.5 | **5.5** | Outlines, zoom scaling and a real bow-aim pose are clear wins, and the night hero now reads. Melee is still a stacked blob with a ladder of health bars. |
| Lighting & time of day | 5.5 | **6.5** | Night is now playable. Dawn and sunset are brighter with shorter shadows, but they are still olive and brown instead of pink-gold and orange. At 20:06 (`ui-1280`) the scene looks identical to midday. |
| Effects | 5.0 | **5.0** | The stray line is fixed and an arrow projectile is now visible. The Beacon Flare is still an arc plus a blown-out glow blob, and smoke is still barely visible. |
| UI/HUD 1920 | 7.0 | **7.0** | Command labels are present but "Kindle the" is truncated. The minimap is still soft and vignetted, and the resource icons are still tiny. |
| UI/HUD 1280 | 6.5 | **7.0** | The selection card shrank from about 560 to 440 px and the minimap to 140 px, so the play area breathes more. The command grid is unchanged and the label truncation persists. |
| Menus | 5.5 | **6.0** (provisional) | The engine-rendered backdrop beats three black rectangles, but it is a gameplay frame: HUD debris, a murky dusk and a cut-off roof. The victory fix is not verified by any capture. |
| Overall cohesion | 6.0 | **6.5** | The roof colour language and the fixed map edge make the world feel more authored. The water grid and lime ground still pull toward "prototype". |
| **Overall visual score** | **5.7** | **6.2 / 10** | Real progress on B1, B2, B4, B6, B7 and B8, but most of those are only partly fixed. Still far from 8.5. |

**Delta, R2 → R3.** This is the first round with clearly visible change: a new roof palette, outlined figures, the aim pose, a brighter night, the map-edge void filled, quest markers removed and a string outline at the build site. The two largest surfaces on screen, the ground and the water, are still the weakest. In this capture the water is worse than before.

---

## Round-2 blocker verification

| # | Blocker | Status | Evidence |
|---|---|---|---|
| B1 | Units unreadable, combat blob | **PARTIAL** | Fixed: `combat-overview` / `hero-ability` figures now have dark outlines and about 1.25× scale. Archers hold the bow forward with the draw arm bent (`hero-ability` x1060–1300,y420–700), so the T-pose is gone. Still broken: melee is still a single overlapping cluster (`combat-overview` x760–1000,y430–600). Health bars still stack into a 6–7-row ladder (`hero-ability` x1300–1560,y375–480; `combat-overview` x780–900,y430–470). Bars are still unbordered and shown for undamaged units. |
| B2 | Dawn, sunset and night hide the scene | **MOSTLY FIXED** | `night-overview`: the forest, roads, plots and figures all read, the hero is visible without her ring, and the brazier bowl now shows a lit rim. `dawn-overview` and `sunset-overview`: luminance is up and there are no black bands. `hero-ability`: the off-screen building shadow is now dark olive, not black. Remaining: the dawn tree shadows still streak about 4× tree height (bottom half, x500–1500,y700–1080). Dawn is olive-khaki and sunset is brown-khaki, not the pink-gold / orange the art direction calls for. Night grass is saturated green, not moonlit blue. |
| B3 | Lime ground, off palette | **NOT FIXED (marginal)** | `midday-overview` grass is a little more yellow-olive, but it still reads about `#8aa638`–`#7fa032`, well above sage `#6f8a4a`. There is no macro value variation, no relief and no dry patches. The rock (top-left) is the same flat grey plane with a crack decal. |
| B4 | Map edge and sky void | **FIXED** | The white triangle in `midday-overview` (x330–420,y0–40) and the black one in `sunset-overview` are gone. The rock and grass continue to the frame corner in all three overviews. |
| B5 | Water is a flat ribbon | **NOT FIXED, regressed in this capture** | All 12 frames show a regular grid/crosshatch. In `midday-overview` there are horizontal bands at x380–900,y20–260. `combat-overview` has a diamond crosshatch at x600–1900,y0–240. `enemy-raid` has diagonal glints at x300–1700,y0–330. `dawn-overview` has a checker at x1200–1400,y560–700. There is still no depth tint and no shore foam, and both fords are still pale slabs with hard ends (`midday-overview` x470–540,y60–160 and x1230–1360,y540–680). Commit `8358b92` should remove the grid, and needs re-capture. |
| B6 | Buildings undifferentiated at overview | **PARTIAL** | `midday-overview` now separates red-ochre barns (x20–120,y770–890; x300–430,y825–890), mossy-green lodges (x455–530,y400–455; x320–400,y455–510), slate barracks and keep hall, and honey thatch cottages. Plots now have soil and crops. Signature props (log stack, quarry crane, smoke) are still invisible at overview. Plots still read as slatted pallets: `production-closeup` x600–780,y600–720 and `settlement-closeup` x650–1050,y860–1080, where loose diagonal planks look broken. |
| B7 | Sparse construction, stray line | **PARTIAL** | The stray vertical line is gone, and a string ring now connects the stakes (`construction-closeup`). New defect: the dirt footprint shows only as a **crescent sliver** on the right edge of the ring (x1160–1310,y490–720) instead of filling it, which looks like an offset or clipped decal. The material piles are still small (two stone blocks at x870–1040,y440–610), and the progress bar is still unframed (x965–1135,y425–438). |
| B8 | Menu backdrop programmer art | **PARTIAL / unverified** | `menu-backdrop.jpg` is a real engine render of the keep at 17:4. It is a big step up from the rectangles, but it is a gameplay screenshot, not key art. It includes the territory-ring dashes (x280–340,y120–150; x1460–1530,y395–460; x1580,y540), a floating build-progress bar (x45–125,y207), a scaffold cut by the left edge, and a red roof cut by the bottom edge (x0–500,y785–900). The keep and hero sit exactly where the centred menu card will cover them. The overall tone is murky olive. |
| B9 | Victory layout | **UNVERIFIED** | The CSS in `styles.css` looks right: the card is centred, `h2` is centred, and the stats have `max-width: 420px`. The only capture (`e2e-20260924-122709/victory-screen.png`) predates it and still shows the collision. Needs a new capture. |

---

## BLOCKERS (keeping the visual score under 8.5), ranked

### 1. Water surface (grid artifact, no depth, slab fords). This was B5.
- **Evidence:** See the B5 row above. The grid is on screen in every preset and in the menu backdrop (top-right, x1250–1600,y0–130). In `combat-overview` the river reads as woven fabric.
- **Fix:**
  - First, re-capture after `8358b92` and confirm there is no tiling seam at 8 m or 23 m repeats.
  - Colour from depth: `depth = waterY − terrainHeight(x,z)`, then `mix(#4f8a86, #1f4f5c, smoothstep(0.0, 2.0, depth))` and alpha 0.75 → 0.95.
  - Draw a foam band as `1 − smoothstep(0, 0.25, depth)` × scrolling noise.
  - Remove the separate ford plane and let the shallow depth make the ford, then add 6–10 instanced stepping stones.
  - Add a wet-edge darkening of −25% albedo within 1.5 m of the waterline.
  - Keep the normal strength ≤ 0.25 and add Schlick Fresnel with F0 0.02 so the river reflects the sky colour of each time of day.

### 2. Ground is still lime, flat and uniform. This was B3.
- **Evidence:** `midday-overview`, `combat-overview`, `enemy-raid` and `hero-ability`: large areas of uniform bright yellow-green with no value variation beyond grass tufts. Top-left rock in `midday-overview` (x0–330,y0–330) is a flat grey decal with trees sitting on it.
- **Fix:**
  - Clamp the grass albedo in `terrain/textures.js` to base `#6a8646`, lerped to `#56703a` by 2-octave noise at 60 m and 15 m (±12% value, ±6° hue).
  - Add dry patches `#8f8a55` where noise > 0.7.
  - Add 0.6–1.2 m rolling height noise at 40 m wavelength outside building footprints and road corridors.
  - Blend rock by slope (> 30°), use albedo `#7d7f80` with curvature AO, and add a 4–6 m scree band.
  - Tint the grass tufts with the same noise and cut their density by about 30%.
  - Target: the average grass pixel in `midday-overview` should sample within ±10 of `#6f8a4a`.

### 3. Melee readability and health-bar ladder. This is the remaining half of B1.
- **Evidence:** `combat-overview` centre shows about 14 figures overlapping inside roughly 200×170 px. In `hero-ability` (x1300–1560,y375–480), 7 health bars stack vertically, and the bars are unbordered dark slabs, some shown at full HP.
- **Fix:**
  - Show bars only for damaged or selected units, with a 1 px `#efe6d2` border, green→amber→red fill, and 70% width above 30 m camera height.
  - Collapse overlapping bars when more than 4 overlap within 24 px screen space into one group bar per faction, or offset them by `(id % 3) * 0.12` m.
  - Add separation steering at 0.9 m radius and melee ring slots (the gameplay commit mentions ring slots, but they are not visible here), so lines form.
  - Enemy outline tint `#3a1410` vs own `#1b1f24`. In `combat-overview` both outlines read black, so the faction is carried only by the cloth colour.

### 4. Time-of-day colour: dawn and sunset still khaki, dusk looks like noon. This is the remaining half of B2.
- **Evidence:**
  - `dawn-overview` is olive-khaki overall with no pink in the sky fill. The bottom half still has long streaks (x500–1500,y700–1080).
  - `sunset-overview` is brown-khaki, and the river is dark slate, not reflecting orange.
  - `ui-1280` shows the moon icon and 20:06, yet the frame is lit like `ui-1920` at 10:32: warm, bright, hard shadows. The new keys (19.6 h: sun 0.8, hemi 1.10, exposure 1.1) flatten dusk and night into day.
- **Fix:**
  - Dawn key at 5.6–7 h: sun `#ffc9a8`, hemisphere sky `#e8b8c8` and ground `#5a5040`, fog `#d8b8b0`.
  - Sunset key at 17.2–18.6 h: sun `#ffb070`, hemisphere sky `#f2a36b`, fog `#c98a66`.
  - Drive `u.sunPosition` from the clamped `sunDir`, so the Sky dome glows where the light comes from.
  - Night (19.6 h+): drop the sun to about 0.45, set the hemisphere sky to `#2a3a5c` at about 0.7 and exposure to 1.0, and add a blue colour-grade by multiplying the grass albedo response by the hemi. Keep the outlines and ember lights for readability. Night should look blue and dim yet readable, not green-lit day.
  - Raise the minimum sun elevation to 0.40 in the morning to shorten the dawn streaks.

### 5. Farm plots and building sites still look unfinished. This is the remaining part of B6 and B7.
- **Evidence:**
  - `production-closeup` (x600–780,y600–720; x880–1010,y610–770) and `settlement-closeup` (x650–1050,y860–1080) show plots as slatted planks with gaps and diagonal loose boards.
  - `construction-closeup` shows the footprint crescent (x1160–1310,y490–720) and tiny piles.
- **Fix:**
  - Plots: one dark tilled-soil quad (`#5a4430`) with a furrow normal map aligned to the plot's long axis, a thin 0.1 m timber edge only on the border, and crops at 3× density. Delete the individual plank meshes.
  - Build footprint: check the decal's projection and centre. It looks shifted by about half a footprint along +X, or clipped by the road-depth sort, so render it with `polygonOffset` over the road.
  - Scale the material piles to 3× and size them by building cost.
  - Frame the progress bar in brass and anchor it to site height.

### 6. Menu backdrop is a gameplay screenshot, not key art. This is the remaining part of B8.
- **Evidence:** See the B8 row: HUD dashes, a floating bar, scaffolds and roofs cut at the edges, and the keep centred under the card. The dusk frame is dim, and the CSS stacks `brightness(0.9)` plus a 70% vignette on top, so the final menu will be very dark.
- **Fix:** In `render-menu-art.mjs`:
  - Hide the territory ring, progress bars and selection rings before rendering (add a `g.hideOverlays()` hook).
  - Frame the keep on the left third (`jumpTo` with the target offset about 25 m to +X) so the card sits over open meadow and sky.
  - Use a lower camera pitch (about 25°) so the horizon, sky dome and distant scenery ring appear.
  - Render at 17.8 h once the sunset key is fixed (Blocker 4), at 2560×1440 for crisp `cover` scaling.
  - Drop `brightness(0.9)` and lighten the vignette edge to 0.55.
  - Re-capture `main-menu` and `victory-screen`.

---

## POLISH, ranked

1. **Keep brazier is still a black bowl in daylight.** It is lit at night, but in `settlement-closeup` (x640–740,y20–75) and `ui-1920` (x825–880,y275–310) it is solid black. Use iron `#3a3632` at roughness 0.6 and metalness 0.7, plus an always-on inner-rim emissive `#ffb35c` at 1.5.
2. **Command-button labels truncated.** In `ui-1920` (x1760–1800,y1037) and `ui-1280` (x1140–1170,y683) the label reads "Kindle the". Either use a short label ("Kindle") with the full name in the tooltip, or allow 2-line labels at `font-size: 10px; line-height: 1.1`.
3. **Minimap still soft with a heavy inner vignette.** See `ui-1920` (x20–215,y865–1060). Render at 256² with crisp vector roads and river, remove the vignette and add a 1 px brass frame.
4. **Resource ribbon icons are about 14 px, grey on slate.** See `ui-1920` (x30–360,y20–45). Make them 20 px and tinted brass `#c9a45c`.
5. **Beacon Flare VFX unchanged.** See `hero-ability` (x1350–1660,y330–660): an arc plus blown-out yellow blobs. Use an additive ground ring decal `#ffb35c` with radial falloff over 0.6 s, clamp the sprite core to under 1.0 after AgX, and add 30–60 rising embers.
6. **Territory ring dashes** in pale blue cut across roads in every frame, and in the menu backdrop. Project them as a soft 40% alpha terrain decal and show them only while placing a building or hovering the keep.
7. **Tree variety.** Every conifer and broadleaf has the same scale and hue (`midday-overview` bottom half). Use per-instance scale 0.75–1.35, hue ±8°, value ±10%, and a few bare or dead trees near the rock.
8. **Chimney smoke** is still hard to see in daylight (`production-closeup`). Double the size, set opacity to 0.6 and tint it `#b8b0a4`.
9. **Rock outcrops** are smooth grey blobs (`production-closeup` x185–380,y265–420). Use flat-shaded faceting, a strata normal and 2–3 satellite rocks.
10. **Wall textures**: the keep and barracks use a uniform brick tile (`settlement-closeup`). Add ±8% per-block value jitter, edge AO and mortar `#6b6760`.
11. **Settlers clumping on the keep door** in `enemy-raid` (x260–380,y660–900): about 12 overlapping figures that read as a blob. This is the same separation fix as Blocker 3.

---

## Summary

Round 3 is the first iteration with real visual progress, from 5.7 to **6.2**. The best gains are the per-type roof colours, outlined and scaled figures with a correct archer pose, a playable night, and a fixed map edge. What keeps the game below 8.5 is mostly large surfaces and systemic issues:

- the water, which regressed in this capture and should improve once `8358b92` is re-captured;
- the lime, featureless ground;
- stacked melee and health bars;
- time-of-day colour that is brighter but not yet pink, orange or blue;
- pallet plots and a broken build-site footprint;
- a menu backdrop that is a gameplay screenshot.

Fixing blockers 1–4 would plausibly lift the score to about 7.3. Reaching 8.5 also needs blockers 5 and 6 plus most of the polish list.
