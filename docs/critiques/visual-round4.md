# Kindlehold — Visual Critique, Round 4

- **Critic:** visual-critic (read-only)
- **Date:** 2026-09-24
- **Inputs:** `docs/screenshots/round4/*.png` (12 presets), compared with `docs/screenshots/round3/*.png`; `src/ui/assets/menu-backdrop.jpg` (1600×900); `ART_DIRECTION.md`; commits `8358b92` (water normal map) and `09c415a` (visual iteration 2).
- **Caveats:**
  - Rendered with SwiftShader, so I judged the art and not the FPS.
  - `ui-1280` is now captured at 10:32 (day). In R3 it was captured at 20:06, so the round-3 "dusk looks like noon" finding **cannot be verified** this round.
  - No new capture of the main menu with its card or of the victory screen, so both stay unverified.

## Scores

| Area | R3 | R4 | Verdict (R4) |
|---|---|---|---|
| Terrain & ground | 6.0 | **6.3** | Slightly less saturated, with soft macro light/dark patches at overview. At close zoom the new bump reads as fine sandpaper noise, the ground is still lime-leaning and flat, and the rock is unchanged. |
| Water | 4.5 | **6.0** | The grid/crosshatch is gone in every frame and the ripple normal reads as water. The bank foam is subtle. There is still no depth gradient, both fords are still pale slabs, and dawn and sunset show red dash glints. |
| Vegetation | 6.5 | **6.5** | Unchanged: uniform scale and hue. |
| Buildings | 6.5 | **6.7** | Metals fixed (the brazier is iron and lit, not a black bowl). Plots are soil quads instead of pallets. But the plots float or shear with sawtooth edges, the build footprint became a half-disc wedge, and "warm slate" merged the keep-hall and barracks roofs into the same grey-brown. |
| Characters & readability | 5.5 | **6.0** | The health-bar ladder is gone from `combat-overview`, the archers stand spaced in a line, and helmets read as steel. Melee is still one clump, `hero-ability` still stacks 5 bars, and settlers still pile up at the keep door. |
| Lighting & time of day | 6.5 | **7.0** | Dawn now has a real rose-gold cast and sunset is amber-orange. Night is still green-lit, not moonlit blue, and the dawn shadow streaks remain. |
| Effects | 5.0 | **5.5** | The Flare is now a clean gold arc with no blown-out blob, but it is still a flat, thin, 2-D band with no ground glow or embers. Smoke is still barely visible. |
| UI/HUD 1920 | 7.0 | **7.3** | Command labels fit ("Flare", "Kindle") and the ribbon icons are slightly larger. The minimap is still soft and vignetted. |
| UI/HUD 1280 | 7.0 | **7.3** | Same label fix, and the layout breathes. |
| Menus | 6.0 | **6.2** (provisional) | Overlays are hidden and the keep has moved to the left third. The frame is now dominated by a giant black keep shadow over empty grass. There is still no sky or horizon, and objects are still cut at the edges. The victory screen is still unverified. |
| Overall cohesion | 6.5 | **6.8** | With water fixed and warmer times of day, the world is more believable. Farm plots and the site decal now look like the most "broken" objects in view. |
| **Overall visual score** | **6.2** | **6.6 / 10** | A real step, driven mainly by water, time-of-day colour and fewer bars. Still well short of 8.5. |

---

## Verified fixes (with evidence)

| Claim in `09c415a` / `8358b92` | Verdict | Evidence |
|---|---|---|
| Water grid removed | **FIXED** | R3 `combat-overview` had a diamond weave at x600–1900,y0–240. R4 shows fine irregular ripples. R3 `midday-overview` had bands at x380–900,y20–260. R4 shows a clean surface. The same holds in `enemy-raid` and `dawn-overview`. |
| Stronger shore foam | **PARTIAL** | `midday-overview` has a thin pale bank line at x780–1900,y170–960, but it is barely visible. At the fords (x470–540,y60–160 and x1240–1360,y540–680) it is still a soft pale slab, not foam over stones. |
| Metals no longer black | **FIXED** | The brazier is now a dark iron bowl with a lit rim and flame (`settlement-closeup` x640–740,y20–75; `ui-1920` x825–880,y260–310). Soldier helmets read as silver steel (`hero-ability` x1030–1290,y555–650). In R3 they were brown/black. |
| Pink-gold dawn / orange dusk | **MOSTLY FIXED** | R4 `dawn-overview` has rose-tinted rock (x0–300,y0–340) and warm gold grass. R4 `sunset-overview` is clearly amber-orange with a brighter brazier glow. Remaining: the long streaks are still there (`dawn-overview` x500–1500,y650–1080), and the river is dark slate with red dash glints instead of reflecting the sky. |
| Terrain bump and sage desaturation | **PARTIAL** | The overview grass is a touch more olive with visible soft macro patches (`midday-overview` x800–1300,y650–1000). At close zoom (`hero-ability`, `construction-closeup`) the bump shows up as a high-frequency grain across the whole ground. It reads as noise, not relief. |
| Flat tilled fields | **PARTIAL** | The slatted pallets are gone (compare R3/R4 `production-closeup` x600–780,y595–735). New defect: the plots are rigid planes that do not follow the terrain. They look sheared or lifted, with sawtooth furrow silhouettes on the edges (`settlement-closeup` x650–1050,y830–1080; `production-closeup` x400–670,y880–1010 and x1460–1690,y770–890; `construction-closeup` x0–180,y540–730, which looks like corrugated sheet; `ui-1920` x280–460,y780–910). |
| Visible site footprint | **NOT FIXED (changed shape)** | The R3 crescent sliver is now a **half-disc wedge** with a hard straight chord (`construction-closeup` x950–1310,y440–730). That fits a flat disc half-buried in the sloped ground. The left half is still missing. |
| Health bars only when selected or badly hurt | **MOSTLY FIXED** | In `combat-overview` a single bar is left (x805–865,y633–642), where R3 had a 6–7-row ladder. In `hero-ability` 4–5 bars still stack at x1400–1680,y415–515. Those units are badly hurt, but the bars still overlap and have no border. |
| Wider melee spacing | **PARTIAL** | The archers now form a spaced line (`combat-overview` x750–900,y510–610). The melee core is still a single overlapping blob (x920–1080,y470–620). Settlers at the keep door still form a blob (`enemy-raid` x260–380,y650–940). |
| Calmer flare | **FIXED (as a defect)** | There is no blown-out glow any more (`hero-ability` x1290–1620,y480–750). It is still weak as an effect (see Polish). |
| Calmer border | **PARTIAL** | The dashes are thinner and fainter by day. At night they are still bright white-blue strokes over the whole frame (`night-overview` x40–1820). |
| Warm slate roofs | **REGRESSION (readability)** | The keep hall and barracks are now both the same warm grey-brown (`settlement-closeup`, `production-closeup` x1290–1590,y10–200). The slate-blue `#4f5a66` from the palette has disappeared, and the barracks no longer stands out from the keep. |
| Command short labels | **FIXED** | `ui-1920` x1665–1800,y1037 reads "Flare" / "Kindle". The same fix shows in `ui-1280`. |
| Larger ribbon icons | **MARGINAL** | The icons are about 20 px on screen and still grey on slate (`ui-1920` x30–480,y20–45). |
| Crisp minimap | **NOT VISIBLY FIXED** | It is still soft, with a heavy inner vignette (`ui-1920` x20–215,y865–1060). The change was `image-rendering: auto`, which is smoothing, not crisp. |
| Photo-mode key art | **PARTIAL** | See Blocker 6. |

---

## BLOCKERS (keeping the score under 8.5), ranked

### 1. Ground still reads as a lime, noisy flat plane (terrain, cohesion)
- **Evidence:**
  - `combat-overview`, `enemy-raid` and `hero-ability` are mostly uniform yellow-green.
  - At close zoom the new bump adds pixel-level grain (`hero-ability` bottom half; `construction-closeup` x0–1900,y750–1080) and no relief.
  - The rock (`midday-overview` x0–330,y0–330) is a flat grey decal with trees standing on it.
- **Fix:**
  - Lower the bump frequency to one octave at 2–4 m with strength ≤ 0.3. Fade it to 0 beyond 60 m camera distance so it never aliases.
  - Clamp the grass base to `#6a8646` and lerp to `#56703a` using 60 m and 15 m noise. Add dry patches `#8f8a55` where noise > 0.7.
  - Add 0.6–1.2 m of height noise at a 40 m wavelength outside footprints and roads.
  - Blend rock by slope (> 30°), use `#7d7f80`, and give it a scree band.
  - Target: the average midday grass pixel within ±10 of `#6f8a4a`.

### 2. Farm plots and the build footprint do not sit on the terrain (buildings)
- **Evidence:** see the "Flat tilled fields" and "Visible site footprint" rows above. The half-disc chord at `construction-closeup` x950–1130,y440–720 and the sawtooth plot edges are now the most artificial-looking things in close-up frames.
- **Fix:**
  - Build each plot and footprint as a grid mesh of about 1 m cells, not a single quad or disc. Sample `terrainHeight(x,z)` per vertex and add +0.04 m.
  - Draw the furrows with a normal and albedo texture, not geometry, so the silhouette stays a clean rectangle.
  - Add a 0.1 m timber or turf border mesh that also follows the terrain.
  - Use `polygonOffset(-1,-1)` so the footprint wins over the road without being lifted.
  - Scale the material piles 2–3× by cost and frame the progress bar in brass (`#c9a45c` 1 px).

### 3. Water still lacks depth, and the fords are slabs (water)
- **Evidence:**
  - The whole river is one teal value (`midday-overview`), with no dark channel and no shallow edge.
  - The fords (x470–540,y60–160; x1240–1360,y540–680) are pale, blurry rectangles with hard ends.
  - Dawn and sunset show red dash glints (`sunset-overview` x520–1000,y100–320) instead of a sky reflection.
- **Fix:**
  - Set the colour from `depth = waterY − terrainHeight` as `mix(#4f8a86, #1f4f5c, smoothstep(0, 2, depth))`.
  - Add foam `1 − smoothstep(0, 0.25, depth)` × scrolling noise.
  - Remove the ford plane and let the shallow depth make the ford, with 6–10 instanced stepping stones.
  - Use Schlick Fresnel (F0 0.02) against the current fog and sky colour so sunset water turns orange.
  - Clamp the specular so that sun glints do not turn into red dashes.

### 4. Melee clump and residual bar stacking (characters)
- **Evidence:**
  - `combat-overview` shows the melee core as one overlapping blob (x920–1080,y470–620).
  - `hero-ability` stacks 4–5 unbordered bars (x1400–1680,y415–515).
  - `enemy-raid` shows a settler blob at the keep door (x260–380,y650–940).
  - Enemy and ally outlines are both black, so faction reads only from cloth colour.
- **Fix:**
  - Assign melee ring slots around each target (6 slots at 1.1 m) and apply separation of 0.9 m for workers queuing at drop-off points. Spread the drop-off across 3–4 door slots.
  - Give the bars a 1 px `#efe6d2` border and a green→amber→red fill. When more than 3 overlap within 24 px, offset them vertically by `(i % 3) * 6 px`, or merge them into one faction bar.
  - Use enemy outline `#3a1410` and own `#1b1f24`.

### 5. Night is green day and the border is loud (lighting)
- **Evidence:**
  - `night-overview` grass is saturated green `~#2f5a20`, with no blue.
  - The territory dashes are the brightest things in the frame after the brazier (x40–1820).
  - The dusk frame was not recaptured, so the R3 20:06 issue is unverified.
- **Fix:**
  - Night hemisphere sky `#2a3a5c` at about 0.7, a blue sun/moon at 0.45 and exposure 1.0.
  - Multiply the terrain albedo response by a cool grade (0.85, 0.9, 1.1) after 19.6 h.
  - Keep the ember lights and outlines as they are.
  - Draw the territory ring at 25% alpha at night, or only while placing buildings.
  - Re-add a 20:00 capture preset.

### 6. Menu backdrop is still a gameplay frame (menus)
- **Evidence:**
  - `menu-backdrop.jpg`: the keep's huge black shadow covers the centre-right (x600–1500,y430–760) over empty grass, which is where the centred card sits.
  - There is no sky or horizon because the pitch is too high.
  - Objects are cut at the edges: the scaffold at x0–220,y130–260, the blue roof at x40–340,y690–900, and the trees at x470–1040,y680–900.
  - The CSS still applies `brightness(0.9)`.
  - It is 1600×900 and will upscale soft on 1440p screens.
- **Fix:**
  - In `render-menu-art.mjs`, render at about 17.6 h with the sun behind the camera (shadows falling away from the view).
  - Pitch 20–25° so the sky and the distant scenery ring fill the top 30%.
  - Place the keep in the left third, with the river and meadow under the card.
  - Hide scaffolds and construction sites for the shot.
  - Output 2560×1440, drop `brightness(0.9)`, and lighten the vignette edge to 0.55.
  - Capture `main-menu` and `victory-screen` in the e2e run.

---

## POLISH, ranked

1. **Restore slate-blue roofs** on the keep hall and barracks (`#4f5a66`, warm only by ±5° hue). Right now they merge with each other and with the stone.
2. **Beacon Flare still thin.** `hero-ability` x1290–1620,y480–750 is a flat gold arc. Add an additive ground disc `#ffb35c` with radial falloff over 0.6 s, 30–60 rising embers and a brief light pulse.
3. **Minimap soft and vignetted.** Render at 256² with vector roads and river, `image-rendering: pixelated` only for the terrain layer, no inner vignette, and a 1 px brass frame.
4. **Tree variety.** Per-instance scale 0.75–1.35, hue ±8°, value ±10%, and a few dead or bare trees near rock (`midday-overview` bottom half).
5. **Dawn shadow streaks.** Set the minimum sun elevation to about 0.40 before 7 h (`dawn-overview` x500–1500,y650–1080).
6. **Chimney smoke invisible in day.** Double the size, opacity 0.6, tint `#b8b0a4`.
7. **Rock outcrops are smooth blobs** (`production-closeup` x185–380,y265–420). Use flat-shaded facets, a strata normal and satellite rocks.
8. **Uniform brick walls** on the keep and barracks (`settlement-closeup`). Add ±8% per-block value jitter, edge AO and mortar `#6b6760`.
9. **Ribbon icons** are still grey. Tint them brass `#c9a45c` and confirm they render at 24 px or more.
10. **Road texture** is a dithered pebble noise at close zoom (`hero-ability` x0–1900,y520–760). Soften it to low-frequency ruts, and add wheel tracks along the road direction.

---

## Summary

Round 4 goes from 6.2 to **6.6**. The verified gains:

- the water grid is gone;
- dawn and sunset now have their intended colour;
- metals are no longer black;
- the health-bar ladder is gone from normal combat;
- the command labels fit.

The biggest remaining problems:

- the ground: lime, and now noisy up close;
- objects that do not conform to the terrain (plots, the site footprint);
- water with no depth and slab fords;
- the melee and settler clumps;
- a green night;
- a menu backdrop still framed like gameplay.

Fixing blockers 1–4 would plausibly reach about 7.3–7.5. Reaching 8.5 needs all six blockers plus most of the polish list.
