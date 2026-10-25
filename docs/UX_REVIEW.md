# pH Rangers: game-feel and UX review

Reviewer: independent critic pass, 2026-10-25, build at `0782b80` (plus whatever other crews hot-reloaded during the session).

**How it was played:** headed Chromium via Playwright at 1440×810 (`?autopause=0&all`), with real keyboard and mouse input stepped by `advanceTime`. A scripted "careful player" bot (`bot.mjs`) ran every mission: walk, mist, then short taps of the correct valve, refilling at the wagon. Extra scripts covered phenolphthalein, ×10, the creek, close-ups of the spray, and phone layouts at 390×844 and 844×390.

**Screenshots:** all are in
`/private/tmp/claude-501/-Users-acedzn-dev-AceDZN-exp-ph-rangers/e0a94e5b-bd16-4904-bfbd-e566ba99ccfe/scratchpad/ux/`
and are referred to below by file name (for example `09-m1-mostly-green.png`).

**Bot results** (the bot reads the true pH, so it is a strong but sloppy player):

| Mission | Result | Notes |
|---|---|---|
| M1 | won in 34–49 s | 27 puffs, 3 stars |
| M2 | failed at 141 s | 9 refills, pond acid |
| M3 | won in 68 s | 3 stars |
| M5 | not won after 200 s | 57 s spent walking, 5 refills, score 35,000 |
| M6 | not won after 220 s | berries at 5 health, pond at 11 health |

---

## What already works
- **Misting is the best moment in the game.** The red wash rolling over the grey ground, the number badge and the ruler jumping to 3.1 are immediately readable (`06-m1-mist.png`).
- **Juice is in place.** `+400 ×4` floaters, the combo chip and the toast on overshoot all fire (`09`, `10`). The win card (stars, before→after pH chips, salt explanation) is clean (`b1-result.png`).
- **Tripo props are a big step up.** The ranger, wagon, berry bushes and houses look good (`b2-wagon-unlock.png`, `b4-t40.png`), and the night palette has mood (`b6-t0.png`).
- **Synthesized audio covers the basic verbs:** spray hiss filtered per valve, fizz, chime, boing, refill, hurt, win/fail, and darbuka music.

---

## P0: broken or confusing

**1. The storm in "Storm Front" cannot be seen.**
- **Seen:** `b5-t35.png` and `b5-t50.png` were taken mid-storm, and the sky is sunny with no rain anywhere. `mission.rain()` exists only in the sim (`src/sim/world.ts` step). Searching `src/render/*` for rain or storm finds nothing.
- **Why it hurts:** the title threat of M5 is invisible. The only cue is a bare countdown.
- **Fix:**
  - In `fx.ts`/`world.ts`, read `game.mission.rain(game.t)` each frame. Draw a rain curtain (instanced streaks) between `x0` and `x1`, a dark cloud band overhead, a darker sky and wet ground in the band.
  - Add rain-loop and thunder sounds.
  - Add a HUD line: "החזית מגיעה לכוורות בעוד 12 שנ׳".

**2. Nothing points to patches that were measured but are still out of range.**
- **Seen:** `09-m1-mostly-green.png` and `11-m1-overshoot-after.png`. All 4 spill cells are green and the score says "+400 ×4", yet the objective reads "נמדדו מחוץ לטווח: 3" and the mission doesn't end. The leftover cells are neighbours the acid spread into.
- **Cause:** `hud.ts findTargets()` only returns endangered assets, unmeasured suspect cells and the wagon.
- **Why it hurts:** a 13-year-old will likely think they finished and the game is stuck.
- **Fix:**
  - Add the nearest out-of-band known cell as a target (red or purple arrow), and pulse its badge.
  - Draw a ring on the ground around each one.
  - Make the objective say "עוד 3 כתמים מחוץ לטווח – החץ מראה".

**3. The ruler's pH tag covers the ruler's instruction text.**
- **Seen:** `06`, `07`, `09`, `10`, `11`, `b2-t40`, `20`. The value bubble (`#rmark b`) sits on the `#rulerlabel` line, so "…חומצי מדי – רססו בסיס" is unreadable exactly while you are aiming. In phenolphthalein mode the label also wraps to two lines (`20-m3-phenol.png`).
- **Fix:**
  - Hang the value tag *below* the bar, or give the title its own row with padding.
  - Keep the label to one short line ("3.1 · חומצי · רססו בסיס").

**4. The tutorial gets stuck if the player skips a step.**
- **Seen:** `b1-t30.png` and `b1-end.png`. A player who mists first (the strongest choice) sees "זרקו נייר לקמוס…" for the whole mission, even on the win frame.
- **Cause:** `game.ts tutorial()` only checks the current step.
- **Fix:** each tick, advance to the furthest step whose condition (or any later step's) is already true.

**5. Phone layouts have overlaps and buttons hidden below the fold.**
- **Portrait (`31-mobile-portrait-m4.png`):**
  - The three-asset panel slides under the ruler.
  - The objective wraps mid-count ("לא נמדדו: / 12", `30`).
  - Off-screen arrows and badges are cut off at the right edge.
- **Landscape (`34-mobile-landscape-m5.png`):**
  - The ruler sits over the ranger in the middle of the screen.
  - The tank card overlaps the end of the ruler ("14" is cut).
  - The score floats mid-screen and an arrow sits on the asset panel.
  - The HUD covers about half the screen.
- **Brief on phone (`33`):** the "יוצאים לדרך" button is below the fold of the card.
- **Title in landscape (`35`):** the mission list is below the fold.
- **Not checked:** touch controls, which appear only after a real touch.
- **Fix:**
  - Landscape: thin ruler at the top-centre under the objective; gadgets and valves as two side columns; score inside the objective panel.
  - Portrait: collapse assets to icons with coloured dots.
  - Make brief and title cards scroll with a sticky CTA.

**6. The creek in "Upstream Acid" doesn't look like water.**
- **Seen:** `46-m2-creek-misted.png`, `24-m2-look-slug.png`, `43-m2-x10-spray.png`. The acid "wave" is a red stripe on grass. No water, flow or banks are visible from the chase camera, so "it flows down to the pond" isn't readable.
- **Fix:**
  - Widen and raise the creek ribbon (`world.ts` ~L367).
  - Use a scrolling normal or foam texture and line it with stones.
  - Show flow chevrons in the indicator wash on creek cells, and add a water ambience loop.
  - The mockup (`docs/visual-targets/02`) shows a clear stream with a small waterfall.

**7. Props block the view of what the player is aiming at.**
- **Seen:**
  - The wagon fills the frame while spraying next to it (`b2-t15`, `b2-t40`).
  - Olive canopies hide the pink phenolphthalein ground in M3; the pink shows up on the leaves instead (`20-m3-phenol.png`).
  - The M3 win camera is inside an olive tree (`b3-result.png`).
  - Brief cameras clip into a house (`01-brief-m1.png`) and the ranger's cap (`b2-brief.png`).
- **Fix:**
  - Dither or fade any mesh between the camera and both the ranger and the aim point.
  - Raise the pitch automatically under canopies.
  - Use authored, collision-checked camera points for each mission's brief and result shots.

---

## P1: big wins for fun and clarity

**8. Spraying doesn't feel like a firehose yet.**
- **Seen:**
  - The ×1 stream is barely visible (`07-m1-spraying.png`).
  - Close up it is a string of blue marbles that starts in mid-air, not at the nozzle (`41-spray-closeup-1s.png`).
  - A big opaque white steam blob covers the target and badge every time (`07`, `41`, `b3-t10`).
  - ×10 is better (it has a tube, `43`).
- **Fix:**
  - A continuous ribbon or tube from `ranger.nozzle` for both strengths, plus small droplet sprites.
  - Splat decals tinted by the indicator colour.
  - Low, translucent steam that rises from the ground.
  - Slight recoil on the arm and camera.

**9. Overshooting happens too fast.**
- **Seen:**
  - 0.7 s of ×10 base took a pH 2 creek cell to 10.3 (`spray.mjs` log, `44`).
  - 1.5 s of ×1 base on an in-band M1 cell took it to 10.6 (`10-m1-overshoot.png`).
- **Why it hurts:** kids hold buttons, so most will likely overshoot and feel punished rather than clever.
- **Fix:**
  - Ramp up flow over the first 0.3 s.
  - Show a "ghost" tick on the ruler for where the next puff will land.
  - Auto-throttle within ±1 of the band, with a visible "מצב עדין" ring.

**10. Toasts appear in the middle of the screen, over the target.**
- **Seen:**
  - "ערפל אוניברסלי נטען +1" covers the aim point (`b4-t40`).
  - Overshoot and refill toasts cover the spray area (`10`, `b2-t40`).
  - The BOING floater collides with the badge and renders as "!BOING" because of RTL (`10`).
- **Fix:**
  - Move toasts to a band under the objective panel.
  - Show routine ones (mist recharged, refill) as small chips near the gadget belt.
  - Wrap the floater text in `<bdi dir="ltr">`.

**11. The objective line is a counter, not a goal.**
- **Seen:** "נמדדו מחוץ לטווח: 0 · לא נמדדו: 12" in every mission. The mockup reads "בדקו את הכתם".
- **Fix:** generate a verb-first line from game state ("מדדו את השלולית" → "נטרלו: 3 כתמים חומציים" → "הגנו על הבריכה – הגל בדרך"), and keep the counts as small chips under it.

**12. The timer and its bar are misleading.**
- **Seen:**
  - In M1 the clock counts up next to a full green bar, which is actually the weakest asset's health (`02`).
  - In M3 and M5 it counts down to `minTime` and shows **0:00** on the win card and while still playing (`b3-result`, `b5-end`). Players will likely read that as "out of time".
- **Fix:** label it ("⏳ הסערה עוברת בעוד" / "❤ בריאות"), hide it in M1, and freeze or hide it at the end.

**13. M5 and M6 end in long, unrewarding clean-up.**
- **Seen:**
  - M5: after 200 s and 5 refills the bot still had 2 out-of-band and 5 unmeasured cells, 57 s of it spent walking (`b5-end`).
  - M6 starts with 46 unmeasured cells and 5 mists (`b6-t0`). The bot wasn't done at 220 s, with 18–24 m walks back to the wagon.
  - The cause is `area` = the whole 96×96 map.
- **Fix:**
  - Limit the area to asset neighbourhoods plus the actual spill.
  - Give mist a bigger radius, or chain-reveal connected suspect cells.
  - Add a second wagon in M6.
  - Add an end-phase "sweep" helper that pings the remaining cells.

**14. The score doesn't track how well you played.**
- **Seen:**
  - M5 scored 35,000 while a careful M1 scored 2,250.
  - The combo kept growing after an overshoot (`10`, `11`).
- **Fix:**
  - An overshoot breaks the combo.
  - Cap the points per cell.
  - The result card shows a breakdown (precision, chemical saved, assets kept).

**15. Several props still look cheap.**
- **Lemons:** yellow spheres floating ~1 m above the puddle with shadows below (`04`, `05`).
- **Puddle:** a flat beige polygon (`04`).
- **Crate / overturned cart:** an untextured brown cube (`04`, `b1-end`).
- **Restoration "flowers":** flat hexagon discs on sticks that read as mushrooms or road signs, and in the result shot giant discs fill the foreground (`09`, `b1-result`).
- **Salt crust:** white paper squares (`09`).
- **Quarry dust:** flat white polygons (`20`).
- **Hillside bushes:** low-poly dark-green blobs floating like shards on the hills and in the night sky (`b2-wagon-unlock`, `b5-t50`, `b6-t120`, `33`).
- **Fix:**
  - A Tripo lemon and a crate or tipped cart, snapped to the ground.
  - Puddle and dust as alpha decals with soft edges.
  - Instanced red anemones (כלניות) and poppies plus grass clumps for bloom.
  - Salt as a speckled decal.
  - Snap the bush instances to terrain height, or drop them.

**16. The tank card is big but doesn't show what's left.**
- **Seen:** the big "pH 12" card shows the tank's pH, but the fill level is hard to see and there is no warning before it runs empty (`02`, `b5-end`).
- **Fix:**
  - A slimmer capsule as in the mockup, with a visible liquid level and a "נותרו 20%" pulse.
  - A beep at 15%.
  - The wagon arrow appearing at that point.

**17. Asset rows show "pH ?" while their health drains.**
- **Seen:** `b2-result`, `b5-t35`, `b6-t60`. The bar drops with no reason shown.
- **Fix:** while an asset is being hurt, show its zone pH (or a trend arrow ↓ acid / ↑ base), and point an arrow at the incoming wave.

---

## P2: polish

- **Result card:**
  - The HUD stays visible and dimmed behind it (`b2-result`, `b3-result`); hide it.
  - The fail card shows success-looking "pH 2.0 → 7.0" chips. On a fail, show the asset that was lost and its pH instead, and add a "נסו שוב עם רמז" option.
- **Night (`b6-t60`, `b6-t120`):**
  - In-band ground glows a saturated neon lime that floods the screen. Dim the emissive for in-band cells and keep the glow for problems.
  - The far wash looks pixel-blocky (`b6-t0`, top right).
- **Arrows:**
  - The wagon pin sits on the ranger's body (`b5-end`).
  - A danger arrow hides behind the tank card (`b6-t120`).
  - The `ey ≥ -0.5` clamp needs to avoid the HUD rects and the ranger's screen box.
- **Pause** (`12-pause.png`) has no controls reference. Add a key legend, including "Esc / H / X / T".
- **Audio gaps:**
  - No rain or thunder, and no creek or pond ambience.
  - No low-tank warning.
  - No "wave approaching the pond" alarm.
  - Birds are random rather than tied to recovery. Have bees and birds return on restore, as `GAME_IDENTITY.md` promises.
- **The ×10 unlock toast is good** (`b2-wagon-unlock`), but players are never told why they should go to the wagon first. Add a step to the M2 objective: "אספו תרכיז ×10 בעגלה".
- **Hint box** (`22-m3-hint.png`) covers the ranger. Dock it under the objective panel.

---

## Screenshot index

| Area | Files |
|---|---|
| Title, brief, start | `00-title`, `01-brief-m1`, `02-m1-start`, `03-…`, `b2-brief`, `33`, `35` |
| M1 first 30 s | `04`–`11`, `40`–`42`, `b1-t10`, `b1-t30`, `b1-end`, `b1-result` (win card) |
| M2 | `b2-*`, `23`, `24`, `43`–`46`; `b2-result` (fail card) |
| M3 | `b3-*`, `20`–`22` |
| M4 | `b4-t0`, `b4-t10`, `b4-t40` |
| M5 | `b5-*` (mid-storm: `b5-t35`, `b5-t50`) |
| M6 | `b6-*` |
| Pause | `12-pause` |
| Phone | `30`–`35` |
