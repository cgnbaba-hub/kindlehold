# Kindlehold — Visual Critique, Final Round

- **Critic:** visual-critic (read-only, final allowed round)
- **Date:** 2026-09-24
- **Inputs:** `docs/screenshots/final/*.png` (12 presets), compared with `docs/screenshots/round4/*.png`; `src/ui/assets/menu-backdrop.jpg`; `ART_DIRECTION.md`; commit `058744f` (visual iteration 3).
- **Caveats:** Rendered with SwiftShader, so I judged the art and not the FPS. There is still no capture of the main menu with its card, of the victory screen, or of a 20:00 dusk frame. Menus are judged from the backdrop alone.

## 8.5 gate: **FAILED** (overall 7.0 / 10)

## Scores

| Area | R4 | Final | Verdict |
|---|---|---|---|
| Terrain & ground | 6.3 | **6.8** | The high-frequency grain is gone: compare the road and grass in `hero-ability` between R4 and final. Soft macro light/dark relief now reads at overview. At close zoom the grass is still a saturated yellow-lime, and the rock is still a flat grey decal with cracks and trees standing on it (`midday-overview` x0–330,y0–330). |
| Water | 6.0 | **6.3** | Slightly deeper blue by day. There is still no visible deep-channel/shallow-edge gradient. Both fords are still pale blurred slabs (`midday-overview` x470–540,y60–160 and x1230–1360,y540–690; `enemy-raid` x1700–1920,y330–500). Dawn and sunset still show red dash glints across the whole river (`sunset-overview` x520–1250,y90–560). |
| Vegetation | 6.5 | **6.7** | There is a small tint spread between deciduous clumps. Scale is still uniform, and the pines are identical cones. |
| Buildings | 6.7 | **7.3** | Slate-blue roofs are back, so keep and barracks read apart from the thatch and terracotta. The plot edges are clean rectangles with no sawtooth. The site footprint is a staked rope ring instead of the half-disc. The masonry is still uniform, and empty plots read as brown decking. |
| Characters & readability | 6.0 | **6.2** | Idle settlers are spread in `midday-overview`. The melee core is still one blob (`combat-overview` x920–1070,y465–615). `hero-ability` still stacks 4–5 unbordered bars (x1400–1680,y415–500). In `enemy-raid` a 10+ settler queue still hugs the keep (x260–380,y650–960). |
| Lighting & time of day | 7.0 | **7.4** | Night is now blue-leaning: roofs, rock and paths read moonlit, ember pools read warm, and the border is dimmed (`night-overview`). The grass is still fairly saturated green at night. The dawn shadow streaks are unchanged (`dawn-overview` x500–1500,y650–1080). |
| Effects | 5.5 | **6.0** | The Flare now has a ground glow, but the glow is a clipped teardrop with a hard straight edge (`hero-ability` x1180–1760,y420–850). It also washes the enemies in orange so they lose their faction read. Smoke is still barely visible. |
| UI/HUD 1920 | 7.3 | **7.4** | A clean slate-and-brass look: objectives with hint boxes, a clear selection card, fitting command labels. The minimap is still soft with a grey inner vignette (x20–215,y865–1060), and the ribbon icons are still small and grey. |
| UI/HUD 1280 | 7.3 | **7.4** | Everything fits with no overlap, and the objectives hint text wraps well. It has the same minimap and icon issues. |
| Menus | 6.2 | **6.3** (provisional) | The new key art is still a gameplay frame. There is no sky or horizon. A scaffolded barracks sits dead centre under the card. The keep-hall roof is over-saturated royal blue. Objects are cut at every edge (tavern x0–210,y250–470, forge x40–400,y820–1080, trees x550–1250,y810–1080). |
| Overall cohesion | 6.8 | **7.1** | The palette now matches the art direction far better (slate, thatch, terracotta, sage). The remaining weak spots are the effects, the clumps and the water. |
| **Overall visual score** | **6.6** | **7.0 / 10** | A competent, coherent indie prototype. It is not strong commercial quality: 1.5 points short of the gate. |

---

## Verified fixes (commit `058744f`)

| Claim | Verdict | Evidence |
|---|---|---|
| No ground grain; low-frequency relief | **FIXED** | The R4 `hero-ability` road and grass were a pixel-noise carpet. In the final frame they are smooth, with soft macro shading (`midday-overview` x800–1300,y650–1000). |
| Calmer sage ground | **PARTIAL** | The overview is a touch more olive. Close-ups (`settlement-closeup`, `construction-closeup`, `ui-1920`) are still bright yellow-lime, well above `#6f8a4a`. |
| Terrain-following fields | **MOSTLY FIXED** | There are no sawtooth silhouettes any more (`settlement-closeup` x200–530,y740–960; `production-closeup` x940–1150,y430–550). The plots are still flat boards with no border, and empty ones read as timber decking. |
| Visible site footprint | **FIXED** | `construction-closeup` x780–1320,y410–740 shows a stake-and-rope ring with log and stone piles, in line with the art direction. The progress bar has no brass frame, and the piles are small. |
| Water depth gradient | **NOT VISIBLY FIXED** | The river is one value across its width in every frame. The fords are unchanged slabs, and the red sunset glints are unchanged. |
| Bluer moonlit nights | **FIXED (mostly)** | `night-overview`: rock and roofs are blue, paths are violet-brown, and ember light pools are warm. The grass is still quite green. |
| Border dims at night | **FIXED** | The night dashes are faint (x1700–1800,y500–900). By day they are still visible cyan strokes (`hero-ability` x1200–1500,y350–1030; `construction-closeup` x1720–1790,y500–900). |
| Beacon Flare ground glow + light flash | **PARTIAL / new defect** | The glow exists, but its shape is truncated by a straight chord, like a cone or clipped quad. It overexposes the enemy cluster. |
| Idle settlers spread around hearth | **PARTIAL** | Spread in `midday-overview` and `ui-1920`. Still a queue blob in `enemy-raid`. |
| Tree tint variety | **MARGINAL** | Slight hue spread. No scale variety. |
| Slate blue restored | **FIXED** | `midday-overview` x400–640,y560–720 and `settlement-closeup`. In `construction-closeup` and the key art the roof drifts to saturated navy or royal blue. |
| New key art | **NOT FIXED** | See Blocker 4. |

---

## Remaining issues, ranked

### BLOCKERS for 8.5

1. **Water: no depth, slab fords, red glints.**
   - **Evidence:** the `midday-overview` river is uniform; the fords at x470–540,y60–160 and x1230–1360,y540–690 are pale rectangles with hard ends; `sunset-overview` and `dawn-overview` show red dashes over the whole river.
   - **Fix:**
     - Set the colour from `depth = waterY − terrainHeight` as `mix(#4f8a86, #1f4f5c, smoothstep(0, 2, depth))`.
     - Add edge foam `1 − smoothstep(0, 0.25, depth)`.
     - Delete the ford plane in favour of shallow depth plus 6–10 instanced stepping stones.
     - Use Schlick Fresnel against the fog and sky colour, and clamp the specular so glints stay under 1.0 luminance.
2. **Combat readability: melee blob and stacked bars.**
   - **Evidence:** `combat-overview` x920–1070,y465–615; `hero-ability` x1400–1680,y415–500 (4–5 overlapping unbordered bars); `enemy-raid` settler queue at x260–380,y650–960.
   - **Fix:**
     - Use 6 ring slots at 1.1 m per melee target.
     - Spread the drop-off across 3–4 door slots.
     - Give bars a 1 px `#efe6d2` border, stagger them `(i % 3) * 6 px` when they overlap within 24 px, or merge them per squad.
     - Use enemy outline `#3a1410`.
3. **Beacon Flare glow is a clipped teardrop and washes out the targets.**
   - **Evidence:** `hero-ability` x1180–1760,y420–850 has a straight chord edge on the lower left, and the enemies inside turn uniform orange.
   - **Fix:**
     - Use a full circular `RingGeometry`/`CircleGeometry` disc with radial falloff in the fragment shader (alpha ≤ 0.35 at the centre, 0 at the edge).
     - Draw it with `depthWrite: false` and `polygonOffset`, so terrain does not cut it.
     - Fade it over 0.6 s.
     - Add 30–60 rising ember sprites.
     - Keep the units' own materials out of the additive light: pulse the intensity at ≤ 1.5 and give it a short range.
4. **Menu key art is still a gameplay frame.**
   - **Evidence:** in `menu-backdrop.jpg` there is no sky or horizon, a scaffolded barracks sits centre (x850–1210,y180–540), the roof is royal blue, and objects are cut at every edge.
   - **Fix:**
     - Pitch 20–25° so sky and far terrain fill the top 30%.
     - Render around 17.6 h with the sun behind the camera.
     - Put the keep in the left third and the river and meadow under the card, with no construction sites.
     - Output at 2560×1440.
     - Capture `main-menu` and `victory-screen` in e2e.
5. **Ground still lime at close zoom, and rock is a decal.**
   - **Evidence:** the `settlement-closeup`, `construction-closeup` and `ui-1920` grass is saturated yellow-green; the `midday-overview` rock at x0–330,y0–330 is flat grey with trees on it.
   - **Fix:**
     - Clamp the albedo to `#6a8646`→`#56703a` and add dry patches `#8f8a55`.
     - Reduce the yellow in the grass-tuft cards by about 30%.
     - Blend rock by slope (> 30°) with a scree band.
     - Keep trees off rock with a slope/rock mask.

### POLISH

1. **Minimap:** remove the grey inner vignette, add a 1 px brass frame, and draw roads and the river as vectors (`ui-1920` x20–215,y865–1060).
2. **Dawn shadow streaks:** set the minimum sun elevation to about 0.40 before 7 h (`dawn-overview` x500–1500,y650–1080).
3. **Territory border by day:** fade the cyan dashes to 25% alpha, or show them only while placing buildings (`hero-ability`, `construction-closeup`).
4. **Empty plots read as decking:** add a turf or timber lip, a lighter soil colour `#7a5a3c`, and seedling dots.
5. **Tree scale variety:** scale 0.75–1.35 per instance, plus a few bare or dead trees near rock.
6. **Roof blue drifts to navy or royal in close-ups and key art:** clamp the saturation to about `#4f5a66`.
7. **Masonry uniformity:** ±8% per-block value jitter and edge AO on the keep and barracks (`settlement-closeup`).
8. **Chimney smoke** is invisible by day. **Ribbon icons** are still small and grey: tint them brass at 24 px or more.
9. **Construction progress bar:** add a 1 px brass frame and scale the piles by cost (`construction-closeup` x965–1140,y425–440).

---

## Verdict

The final build rises from 6.6 to **7.0**. Iteration 3 fixed the things it targeted most directly:

- the noisy ground grain is gone;
- farm plots and the build footprint no longer look broken;
- slate-blue roofs restore building readability;
- night is finally moonlit rather than green day.

The result is a coherent, pleasant, competent-indie look that follows its art direction. It is **not** at 8.5. The water still has no depth and shows red glints at golden hour. Combat is still a single blob with stacked bars. The signature hero effect now has a visibly clipped glow. The menu key art is still a cropped gameplay screenshot with a scaffold in the middle. The close-up ground is still lime. Closing the gate would need all five blockers plus most of the polish list. **The 8.5 visual gate is failed.**
