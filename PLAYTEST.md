# Playtest and verification log

2026-10-25. What was checked, how, and what was not. Automation can prove rules, solvability and that wrong strategies fail; it cannot show the game is fun or that students learn. No students have played it yet.

## Automated (`npm test`, 41 tests, ~50 s)

- **pH model** (`tests/chem.test.ts`): 7 at equal acid/base; 0.001 mol/L → pH 3 / 11; ×10 per unit; round-trip with the soil buffer; clamp 0–14; dilution approaches 7 and never crosses it, ~10× volume per unit; pH 2 needs 8–10.5× the base of pH 3 with the buffer; reaction amounts; litmus / phenolphthalein / universal tables per Workbook; sprayer liquids pH 2/12 (×1) and 1/13 (×10).
- **Grid** (`tests/world.test.ts`): creek chains connect and drain into the pond in both valleys; the acid/base/salt ledger is conserved through spreading, flooding, creek flow and reactions; water floods acid onto neighbours instead of neutralizing it; the weak-base canister is slow and never pushes pH above 8.5; a tap is exactly one puff; tank gauge pH; ×10 locked until the wagon in mission 2; phenolphthalein never reveals an acid's number; text state and learning events exist.
- **Missions** (`tests/missions.test.ts`, won only after every suspect cell is measured, played by a bot through the same inputs a player uses — stick, aim point, spray button, valve/strength keys, gadget throws — and that **only reads pH on ground it has measured with universal indicator**):
  - every mission is won by its intended approach with ≥ 2★ (m1 21 s, m2 150 s, m3 60 s, m4 138 s, m5 160 s, m6 203 s game time);
  - m1: water only barely moves the lemon puddle and spreads it; overshoot to > 9.5 is shown and fixable with acid;
  - m2: the same 3 s of ×1 base fixes the pH 3 puddle but moves the pH 2 creek < 0.5; ×1-only and water-only never win and let acid into the pond; flooding the creek with ×10 base kills the fish;
  - m3: phenolphthalein turns pink only on the lime, the acidic fertilizer stays colourless; acid on every pale patch acidifies the clean ones; base kills the olives; water only spreads the lime;
  - m4: everything-to-7 fails the blueberries; constant base/acid/water fail;
  - m5: doing nothing loses an asset to the acid rain;
  - m6 (transfer): no hints; always base / acid / water / to-7 all fail; an **indicator-free "blind" ranger** (heat probing + rule of thumb, five blueberry doses) does not win; neither does it win m1 or m3.

## Independent science review

[`docs/SCIENCE_REVIEW.md`](docs/SCIENCE_REVIEW.md) (separate agent, edited no code). It confirmed the chemistry and found 5 science/Hebrew errors and an important bypass: the HUD leaked the true pH on unmeasured ground (grey wash, "pH ?" markers, chime/overshoot toasts, objective counter), so an indicator-free bot won the transfer. Fixed in `dba41af`:

- Mg(OH)₂ → CaCO₃ (limestone) canister; overshoot toast now judged against the cell's band ("too basic here" for blueberries pushed above 5.5 by base); pH 7.4 = "close to neutral (slightly basic)"; m2 brief no longer calls a dilute strong acid "weaker" and no longer gives the numbers away; colourless phenolphthalein = "pH below 8.2", not "not basic".
- HUD shows only what the ranger could know: suspect/sprayed ground instead of out-of-band cells; chime and overshoot feedback only on measured ground; heat (steam) only while lots of acid/base reacts; objective counts measured cells and unmeasured suspect ground; blueberry bushes show the asset's health, not each cell's pH.
- Fizz bubbles removed (acid + base makes no gas); the result card says the acid and base became salt + water that stays on the ground.
- m3 gained an acidic fertilizer patch so "colourless ≠ fine" is learned by consequence; win text no longer says colourless dust needed no care.
- Balance: m4 blueberry decay halved, pond buffer raised (a careful "hold the line" plan in m2 can win), canister really slow, soils buffer differently (orchard more, school yard less), m6 blueberries start at 6.2 so a dose memorized in m4 overshoots, blueberry beds default to pH 5.
- Wording: מדללים, "פי 10 בריכוז יוני H⁺", חוצץ (buffer), band colours, typo in the controls line.

The reviewer's re-check (section at the end of the review) confirmed all five P0 fixes and the HUD changes, but found that heat probing plus a fixed blueberry dose could still win m6 without any indicator. Fixed after it: **a mission is won only once every suspect cell has been measured with universal indicator** (a ranger signs off only after measuring; the objective shows "לא נמדדו: N" and the grey wash marks them). Tests now try the blind strategy with five different blueberry doses on m6 and blind on m1/m3 — none wins. More mist charges were given (m3 3, m4 5, m6 5). Kid-model results from the re-check (before this last change): m2 won 164 s (pond 6.51), m4 won 130 s (berry health dipped to 9), m6 won 212 s — m2 and m4 were razor-thin, so the m4 blueberry decay was lowered again (0.3) and the pond buffer raised a little (0.055).

Bot completion times with the survey rule (measured-only bot, not optimal routing): m1 21 s, m2 150 s, m3 60 s, m4 138 s, m5 160 s, m6 203 s ≈ 12 min total, above the 6–10 minute target; a human who knows the missions may be faster, a new player slower. Not measured with people.

## In the browser (built-in browser pane, dev server, 1280×720, DPR 2)

Played through real keyboard events and mouse aim (`__phr.aimWorld` moves the free-mouse cursor; `advanceTime` steps the sim):

- Mission 1 start to win: walk to the puddle, litmus (marker turns red, "לקמוס: חומצי"), universal mist (badge 3.0, red/orange wash), base spray (steam, number climbing), overshoot to 11.4 (purple badge, litmus flips to "בסיסי"), finished with taps → **won, 3★**, result card with salt explanation.
- Mission 2: ×10 locked at start (toast), walk to the wagon, refill ring → "תרכיז ×10 נטען", tank switches to pH 13 ×10.
- Mission 3: two phenolphthalein flares → pink "בסיסי (מעל 8.2)" badges on lime, fertilizer reads "שקוף (pH מתחת ל-8.2)".
- Mission 6 at night: glow wash, fireflies, head-lamp, 4 assets in the HUD, hint button hidden.
- Pause (Esc) stops the sim, restart → brief → Enter → mission at t = 0 with the tank reset; hint (H) shows the box and logs a `hint` event.
- Tripo models visible in gameplay: rigged ranger (idle/run + procedural spray pose), hives, wagon, olive trees, houses, tanker.
- Console: no errors (one three.js warning about the shadow-map type was fixed).
- FPS (in-game counter, real time, mission 2 while running and spraying): 120 fps on this Mac at DPR 2. Not measured on low-end hardware.
- Production build: JS 773 KB (207 KB gzip), CSS 25 KB, models 3.2 MB, `dist/` 5.4 MB; works from `npm run preview`.

Captures through real input at the mockups' viewport: `docs/captures/` (see [docs/VISUAL_REVIEW.md](docs/VISUAL_REVIEW.md)); phone width 390×844 in `06-mobile.png`.

## Not verified / known limits

- No human playtest; fun and learning are untested hypotheses.
- Touch controls were not exercised on a real touch device (the stick, look-drag and spray button exist; the layout was checked at 390×844).
- Pointer-lock mouse look cannot be driven by automation; the free-mouse mode (cursor aims, edge turns the camera) was used for tests.
- Sound is synthesized WebAudio and was not listened to by a person.
- The kid-like model in the review lost m2, m4 and m6 before the balance fixes; see the re-check for results after them. Missions 2 and 6 may still feel hard for some 13-year-olds.
- The Tripo house has two lavender fin artefacts on its roof.
- Hebrew copy was written by the build agent and checked by the science reviewer, not by a native-speaking teacher.


## Round 2 — "make it perfect" (2026-10-25, afternoon)

The user asked for good 3D models and for the loop/UI/UX to be really fun. What changed and how it was checked:

- **Models:** two more Tripo rounds (round 2: farmer + 9 props + new ranger clips; round 3: lemon crate, lemon, anemone, daisy). 410 credits from the existing balance; nothing bought. All 20 models load in the game (`render_game_to_text().tripoModels`, no console errors).
- **Independent UX/fun critic** ([docs/UX_REVIEW.md](docs/UX_REVIEW.md)) played every mission through Playwright and ranked 17 issues. Fixed: invisible storm (rain curtain, veil, dimming, thunder), no pointer to measured-but-wrong patches (arrows + goal-first objective), ruler tag covering its own advice (tag under the bar, one-line label, next-puff tick), tutorial stuck if a step was skipped (skip-ahead), phone portrait/landscape overlaps and below-the-fold buttons, creek not reading as water (raised flowing ribbon, foam edges, stone banks, water ambience), props blocking the view (fade + clear-view menu shots), weak spray (solid jet, splash, lighter steam), too-fast overshoot (nozzle ramp, next-puff tick), toasts over the aim point, misleading timer, combo surviving overshoots, cheap props (Tripo crate/lemons/flowers, soft decals, finer salt), low-tank warning, asset rows with no reason, fail card showing success chips (now shows the lost asset + retry with hint), night glow flooding the screen, pause key legend, birds returning on restore.
- **Not fixed / partial:** missions 2, 5 and 6 still take the bot 2.5–3.5 minutes each (≈13 min for all six with an unhurried bot that never sprints); the mission-6 blueberries start out of band, so their health falls from the first second; the score scale differs a lot between missions.
- **Verified in the browser pane** (1440×810 and 375×812): mission 1 won in 23.5 s with blooms, combo ×6 and the result card; storm visuals mid-rain in mission 5; creek and ×10 unlock in mission 2; night mission with the new glow rule; title, brief and result camera shots; portrait layout. Captures re-taken (`docs/captures/`). 42/42 tests pass; production build OK.
- **Not verified:** pointer-lock mouse look by a human (automation runs in test mode with the cursor aiming), touch on a real device, the music and new sounds by ear, frame rate on low-end hardware (bloom turns itself off below ~38 fps), and whether any of this is fun for 13-year-olds.
