# Science review and sim playtest: pH Rangers / סיירת ה-pH

Reviewer: independent science reviewer and playtester. Date: 2026-10-25. Scope: `src/sim/*` (authoritative model), the Hebrew strings in `src/sim/missions.ts`, `src/sim/game.ts`, `src/main.ts`, `src/render/hud.ts`, `index.html`, and the feedback paths in `src/render/world.ts` / `fx.ts` that can leak the true pH. I checked against `docs/handoff/BUILD_HANDOFF.md` and the saved Workbook snapshots in `docs/curriculum/`. I edited nothing under `src/` or `tests/`.

Every number below comes from the sim, through the same `Bot` inputs a player uses (stick, aim, spray button, valve keys, gadget throws). Automated runs cannot tell whether the game is fun or whether students learn from it, and this review does not claim either.

Scratch scripts (not part of the repo):
`/private/tmp/claude-501/-Users-acedzn-dev-AceDZN-exp-ph-rangers/e0a94e5b-bd16-4904-bfbd-e566ba99ccfe/scratchpad/review/numbers.ts` (chemistry and tap windows),
`.../review/bypass.ts` (degenerate strategies), `.../review/honest.ts` (a less omniscient player), `.../review/checkpoint.ts`, `.../review/berrytoast.ts`. Raw output: `.../review/bypass-all.txt`.

`npm test`: 39/39 pass (about 20 s). `npx tsx scripts/tune.ts` matches what the tests assert.

---

## 0. Summary

The core chemistry is sound and matches the Workbook: log10 pH from the net H⁺/OH⁻ excess, ×10 per unit outside the buffered band, dilution that never crosses 7, salt plus heat on every reaction, a mass ledger, and indicator functions that match the Workbook tables. The buffer is a defensible simplification. It needs to be explained, and nothing in the game should claim ×10 for comparisons inside pH 4–9.

There are three problems:

1. **Measurement can be skipped.** The HUD reveals the true pH on ground nobody has measured. The grey wash and the "pH ?" badges are keyed to `inBand`, the "בטווח! ✓" chime and the "too much" toast fire on the true pH, and the objective counter shows how many cells are out of band. A scripted ranger that never throws an indicator **wins m6-night (2★, 181.6 s), m5-storm (3★), m3-quarry (3★) and m1**. The transfer mission therefore does not require measuring anything.
2. **A few Hebrew strings are scientifically wrong.** The most serious: Mg(OH)₂ "doesn't raise pH above ~8.5" (real Mg(OH)₂ slurry is about pH 10.4); pH 7.4 called "נייטרלי" (the Workbook calls 7.4 "מעט בסיסי"); "חומצה חלשה יותר" used for a more dilute strong acid; "שקוף = לא בסיסי" (wrong for pH 7–8.2); and a toast that says "יותר מדי חומצה!" when base pushes blueberries above 5.5.
3. **Some missions look tight for a 13-year-old.** A non-omniscient kid model lost m2, m4 and m6 even when following the hints. Part of this is the cell-level tolerance disagreeing with the asset bands.

---

## 1. Science correctness

### 1.1 Model core: correct

| Rule (handoff / Workbook) | Where | Verdict |
|---|---|---|
| pH from net excess, log10, clamped 0–14, water's own ions included | `chem.ts:30-55` (closed form `chem.ts:43-45`) | Correct. Unbuffered: pH 2 needs 0.200 mol per 20 L to reach 7, pH 3 needs 0.020, pH 4 needs 0.002, so exactly ×10 per unit. |
| ×10 per unit | `chem.ts:58-60`, sprayer ×1 = 0.01 M (pH 2/12), ×10 = 0.1 M (pH 1/13) `chem.ts:153-156` | Correct. The tank gauge moving 12 → 13 when you switch to ×10 is a nice, true cue. |
| Dilution moves toward 7 and never crosses it | `netForPH` sign: net > 0 always gives pH < 7 | Correct. pH 6.9 + 10⁶ L → 7.000; pH 7.2 + 10⁶ L → 7.001. pH 2 needs +180 L for one unit and +2000 L for two. That is the ×10 volume rule. |
| Acid + base → salt + water + heat | `world.ts:248-260`, `world.ts:399-412` (salt `S`, `heat`, `ledger.salt`) | Correct, and conserved. The water produced is not added to `V`; at 0.01 M that volume is negligible, which is fine. |
| Litmus: 2-state, change range 4.5–8.2, never a number | `chem.ts:81-85`, labels `game.ts:629`, `hud.ts:231`, 3D strips `fx.ts` ("blue → red in acid, red → blue in base") | Correct. It matches the Workbook exactly, including "no change" in the middle (indicators page: blue stays blue in neutral, red stays red in neutral). |
| Phenolphthalein: colourless < 8.2, pale pink 8.2–10, pink > 10 | `chem.ts:90-94` | The thresholds are correct. The **label** is wrong; see 1.3 (P0-4). |
| Universal colour table | `chem.ts:99-108`, `UNIVERSAL_RGB` `chem.ts:111-127` | Matches the Workbook table exactly (0–3 red, 4–5 orange, 6 yellow, 7 green, 8 blue-green, 9–10 blue, 11–14 purple). The colour is always paired with a number (`hud.ts:216`, readout), as the handoff requires. |
| Weak base capped about 8.5 | `world.ts:82-83`, `world.ts:326-338` | The cap works (pH 4 soil plus a canister settles at 8.50; neutral soil plus 0.5 mol settles at 8.50). The "works slowly" claim is false; see 1.4. |
| Neutralization is not always exactly 7 | A weak-base canister ends near 8.5, not 7 | Consistent with the Workbook neutralization page ("מתקרב ל-7 אבל לא תמיד בדיוק 7"). Worth saying aloud in CURRICULUM.md. |

### 1.2 The soil "buffer" (`chem.ts:15-24`, `world.ts:40-51`)

`bufferTerm = beta·(7 − clamp(pH, 4, 9))` is added to the free-ion term. For a 20 L soil cell (`beta` = 0.0015), the cost of each pH unit going up toward 7 is:

| Step | Buffered (game) | Unbuffered | Ratio to the next step (game) |
|---|---|---|---|
| 2 → 3 | 450 puffs | 450 | ×10 |
| 3 → 4 | 45 puffs | 45 | ×5.5 |
| 4 → 5 | 8.3 puffs | 4.5 | ×2.0 |
| 5 → 6 | 4.2 puffs | 0.45 | ×1.1 |
| 6 → 7 | 3.8 puffs | 0.05 | n/a |

(One ×1 puff = 0.05 s = 0.0004 mol.) Totals to reach 7: pH 2 / pH 3 = **8.3×**, pH 3 / pH 4 = **3.8×**, pH 4 / pH 5 = **2.0×**; on the basic side pH 11 / pH 10 = 4.6×, pH 10 / pH 9 = 1.6×.

**Is it defensible?** Yes. Without it, the window for landing a pH-3 soil cell inside 6–8 is **0.099 puffs**: no hand sprayer could ever hit the band. With it the window is 7.6 puffs. Real soils and ponds do buffer near neutral (carbonates, clays, organic matter). The Workbook itself introduces buffers ("מערכת חוצצים") in the blood-pH box on the ph-scale page. Keeping the buffer out of pH < 4 and pH > 9 means the strong-acid / strong-base ×10 rule holds where the game actually teaches it.

**Where a student could notice it:**
- **m2 (the ×10 mission):** pH 2 versus pH 3 needs 0.2045 versus 0.0245 mol, about 8.3×. That is close enough to "about ×10", and the hint says "בערך". Safe.
- **Any comparison inside pH 4–9** looks almost linear. No mission frames such a comparison as ×10 today. Keep it that way.
- **Watching the counter during a long hold from pH 3:** it crawls from 3 to 4 and then runs from 4 to 7. That also happens in real unbuffered water, more sharply, so the m1 hint "המספר קופץ מהר ליד 7" (`missions.ts:116`) stays true.
- **Dilution inside the buffered range barely moves pH** (pH 5 + 180 L of water gives 5.40 here; unbuffered it would give 6.00). Real buffers behave the same way, and it supports the "water doesn't fix it" lesson.

**Suggested CURRICULUM.md wording** (teacher-facing, Hebrew for the student box):
> In the game, soil and pond water contain a "buffer" (חוצץ), like the buffers that keep blood at pH 7.4 (Workbook, ph-scale). Near neutral (pH 4–9) the buffer soaks up a little acid or base, so the number changes gently and a sprayer can land in the band. Far from neutral (below 4, above 9) the buffer is used up and only the ×10 rule acts: pH 2 needs about 10 times the base that pH 3 needs. The ×10 rule is about concentration of H⁺ in plain solution; buffered soil is an exception students will meet again in grade 9.
>
> Student box: "בקרקע ובבריכה יש חומרים 'חוצצים' שבולמים שינויים קטנים ליד 7, כמו בדם. רחוק מ-7 הם כבר לא עוזרים, ושם כל יחידת pH היא פי 10."

Also recommended: rename `beta` in the in-game hint (`missions.ts:289`) from "בולמת" to the Workbook term "חוצצת (buffer)".

### 1.3 Hebrew strings: scientific errors (P0)

| # | Where | Text (abridged) | Problem | Fix |
|---|---|---|---|---|
| P0-1 | `missions.ts:309`, also `:342`, `:347` | "קפסולות נוגד חומצה (בסיס חלש, כמו Mg(OH)₂) … לא מעלות את ה-pH מעל ~8.5" | A saturated Mg(OH)₂ suspension (milk of magnesia) sits at **pH ≈ 10.4**, not 8.5. The Workbook does list Mg(OH)₂ as a weak base and an antacid (bases-intro, neutralization), but the 8.5 cap is wrong for it. **CaCO₃** (סידן פחמתי / אבן גיר, also a Workbook antacid and the farmer's lime in acids-bases-daily-life) settles near pH 8.3 in air and dissolves slowly. That matches the mechanic and links to the limestone quarry. NaHCO₃ (pH ≈ 8.3) also works. | "קפסולות נוגד חומצה (בסיס חלש, כמו סידן פחמתי CaCO₃ – אבן גיר)". Keep "~8.5". |
| P0-2 | `missions.ts:287` | "האוכמניות ב-pH 7.4 – נייטרלי, אבל לא טוב להן" | The Workbook says < 7 acidic, 7 neutral, > 7 basic, and it calls blood at 7.35–7.45 "מעט בסיסי" (ph-scale). Calling 7.4 neutral contradicts the scale the game teaches. | "ב-pH 7.4 – קרוב לנייטרלי (מעט בסיסי), אבל לא טוב להן". |
| P0-3 | `missions.ts:136` | "שלולית חומצה חלשה יותר (pH 3)" | "חומצה חלשה" is a Workbook term for a partly dissociating acid (CH₃COOH on the neutralization page). The model treats this puddle as the *same* strong acid, ten times more dilute; the whole point of m2 is concentration. | "שלולית חומצית פחות (pH 3) – פי 10 פחות יוני H⁺". |
| P0-4 | `game.ts:625`, `hud.ts:222`, `missions.ts:216` ("אבק שקוף אינו בסיסי") | "פנולפתלאין: שקוף (לא בסיסי)" | Colourless only means pH < 8.2, which includes pH 7–8.2 (basic). m6's pond at 8.0 would read "not basic" while it is basic and near its limit. The Workbook: phenolphthalein "מגלה בסיסים" above 8.2 only. | "שקוף: pH מתחת ל-8.2 (אין בסיס חזק)". Same change for the badge and the m3 hint. |
| P0-5 | `src/main.ts:481` (and ring colour `fx.ts:182`) | Overshoot toast `e.pH > 7 ? 'יותר מדי בסיס!' : 'יותר מדי חומצה!'` | Wrong for blueberries. Verified: a base tap that lifts a blueberry cell from 5.2 to **5.54** fires overshoot, and the toast says **"יותר מדי חומצה!"** after the player added base (`berrytoast.ts`). This teaches the wrong direction. | Compare against the cell's band: `pH > band.hi` → "יותר מדי בסיס – בסיסי מדי למקום הזה", else "יותר מדי חומצה". Put the band (or valve) on the FX event. |

### 1.4 Hebrew strings: misleading or imprecise (P1/P2)

- `missions.ts:221` (m3 winText) "האבק השקוף לא היה צריך טיפול בכלל". It is true for this level, but it states as a rule the misconception that the m3 hint warns against at `:218` (colourless ≠ fine). Suggest: "האבק השקוף לא היה בסיסי – וכשבדקתם באוניברסלי, הוא היה נייטרלי." (P1)
- `missions.ts:309`, `:347` "הן עובדות לאט". The canister releases up to `WEAK_RATE` = 0.012 mol/s per cell (`world.ts:82`), **1.5× faster than the ×1 nozzle** (0.008 mol/s). A pH-4 cell reaches band in under 1 s. Either lower `WEAK_RATE` to about 0.002 or drop "לאט". (P2)
- `missions.ts:94` "לטווח הירוק (pH 6–8)" and the tutorial at `:123` "עברתם ל-סגול?". On the Workbook table only 7 is green (6 is yellow, 8 blue-green), and an overshoot just past 8 shows blue-green/blue, not purple (purple starts at 10.5 here). Suggest "לטווח 6–8 (צהוב-ירוק-כחלחל)" and "עברתם לכחול/סגול?". (P2)
- `missions.ts:169` "מים רק מהלים". The Workbook term is **מדללים / דילול** (concentration-solubility, safety-handling). The science in the sentence is right. (P2)
- `missions.ts:172` "פי 10 ביוני H⁺". The Workbook wording is "פי 10 בריכוז יוני H⁺". (P2)
- `missions.ts:224` failText `olives-acid` blames "אבק נייטרלי", but the same fail fires when a player over-acidifies the lime itself. (P2)
- Steam and bubbles: tutorial `missions.ts:122` "שימו לב לאדים – זה הנטרול" and result `main.ts:459` "השתחרר חום (האדים)". Neutralization is exothermic (correct, Workbook), but dilute neutralization does not boil, and the **fizz bubbles** in `fx.ts` (the "Fizz bubbles" block) look like gas release. The Workbook ties gas to acid + metal (H₂) and carbonates (CO₂), not to acid + base. Rising bubbles plus a vanishing puddle invite "it disappeared into gas". Prefer heat shimmer, a thermometer pop and a growing salt crust. (P1, misconception 6)
- m5 acid rain (`missions.ts:325-329`): 0.00016 mol/s in 0.25 L/s is **pH ≈ 3.2** rain. Typical acid rain is pH 4–5; the Workbook notes it is less of a problem in Israel. Either soften it (more water, same acid) or call it "גשם חומצי חזק במיוחד מזיהום תעשייתי" in the brief. (P2)
- `index.html:61` "לחיצה קצרה = פְּרִיץ קטן". "פָּרִיץ" means a bandit or hooligan. Probably "פרץ קטן" / "ריסוס קצר" was meant. (Not science; P2.)
- `phClass` (`chem.ts:141-145`) labels 6.75–7.25 "neutral" in the badge icon. That is acceptable because the number is always shown next to it. (Note only.)
- Bands: blueberries 4.5–5.5 sit inside the Workbook's "חומצי (pH 4–6): אוכמניות" and match common horticultural guidance. Fish 6.5–8.5 matches common water-quality guidance. Lime as "סיד" pH 11 is consistent with the Workbook ("סיד כבוי Ca(OH)₂, בסיס חזק") at a dilute dust level. Cleaning agent pH 9.8 is consistent (soap 8–10). Lemon pH 3 matches the Workbook's "לימונדה ~3". All OK.

### 1.5 Model quirks a teacher might spot (P2)

- **Infiltration leaves the acid behind** (`world.ts:387-388`): soaked water lowers `V` but not `E`, so sprayed water only dilutes until it soaks in and then the pH returns. Real seepage would carry dissolved acid down. The ledger stays consistent (water spreads the excess by runoff and never neutralizes it), and it supports the lesson, but CURRICULUM.md should state that the water's lasting effect in the game is spreading.
- **Safety-handling conflict:** the Workbook's first aid for acid on skin is "only water, don't neutralize" (safety-handling). The game's "water is useless" message (`missions.ts:169`) is about a field spill, not skin. Add one line to CURRICULUM.md so a teacher can head off "water is always wrong".

---

## 2. Misconceptions: does play surface them?

| Misconception | Surfaced by play? | Evidence | Strength |
|---|---|---|---|
| "pH 3 is a bit more acidic than 4" (×10) | Yes, m2 | Test: the same 3 s of ×1 base takes the pH-3 puddle above 5.5 but moves the pH-2 creek by < 0.5 (`missions.test.ts`). Constant ×1 base loses the fish. A pH-2 creek cell needs 25.6 s held at ×1 versus 2.6 s at ×10. | **Strong.** It is weakened only inside pH 4–9 (§1.2). The brief (`missions.ts:136`) already states both numbers, so the student is told rather than discovering it. |
| "Add water to neutralize" | Yes, m1 to m4 and m6 | Water-only fails every mission with assets (`tune.ts`). A whole 30 L tank on a pH-2 cell gives 2.4 at best, and then the water soaks away. | Strong. |
| "More base is always safer" | Yes, m1, m2, m6 | m1 overshoot test (> 9.5, fixable). m2 ×10 flood → `pond-base`. m6 pond starts at 8.3 (0.142 mol of base pushes it past 8.5). | Strong. |
| "Litmus tells you the number" | Partly | litmusOnly fails m2, m3, m4, m5, m6 (`bypass-all.txt`). Litmus reads "acid" for both pH 2 and pH 3 in m2. | **Weak.** Nothing ever makes the student act on a litmus reading and be wrong about *how much*. The m2 brief gives the numbers anyway. |
| "Phenolphthalein shows acids" | Told, not played | Hint `missions.ts:218`, label "לא בסיסי". There is **no acidic patch where a phenolphthalein survey is the natural first move**, and the m3 winText reinforces "colourless = fine". | **Missing.** |
| "Neutralization makes the stuff disappear" | Visual only | Salt crust (state texture `S`), win text "מלח + מים", result line `main.ts:459`. No gameplay consequence, and bubbles plus steam suggest gas. | **Weak.** |
| "Everything to 7" (m4 / m6) | Yes | everythingTo7 fails m4 (`berries-base`) and m6. | Strong. |

---

## 3. Bypass hunt (scripted strategies, all through player inputs)

Strategies in `bypass.ts`:
- **idle**: do nothing.
- **blindLenient** / **blindStrict**: **never throws an indicator.** It uses only what the HUD shows on unmeasured ground: the grey wash and "pH ?" badges (keyed to `!inBand`, `render/world.ts:795`, `hud.ts:177`), the fizz FX (did the puff react), the chime and overshoot toast (`game.ts:428-437`, fired on the true pH whether or not the cell is known), and the objective counter (`game.ts:595-601`). For blueberries it also uses the brief ("they need acidic soil") and the bushes' yellowing (`render/world.ts:835`). "Strict" only trusts a chime for the always-grey authored spill cells.
- **zblindCan**: blind, plus one canister on the hives and one on the school at the start.
- **canisterSpam**, **litmusOnly** (spray the opposite until litmus reads "unclear"), **tapBase** / **tapAcid** (three tiny puffs of one valve on every grey cell, repeated), **random1–3** (wander and spray random valves at random points at max range), **mistTo7**, **baseX10**.
- Plus `tune.ts`: constant base, acid and water, and everything-to-7.

Cutoff 420 s game time. ★ = stars. "ind" = indicators thrown.

| Mission | Wins without measuring | Fails (examples) |
|---|---|---|
| m1-lemon | blind (51 s, 3★, 0 ind), **tapBase (32 s, 3★, 0 ind)**, to7 (20 s) | idle, water, acid, random (still "play" at 420 s) |
| m2-creek | none | Every degenerate strategy loses the fish (`pond-acid` at 118–122 s). baseX10 stalls in play. |
| m3-quarry | **blindLenient (104 s, 3★, 0 ind), blindStrict (143 s, 3★, 0 ind), tapAcid (80 s, 3★, 0 ind)** | idle 57 s, base, water, litmusOnly, random (all `olives-base`) |
| m4-blueberry | none | All fail `berries-base` (idle at 49.3 s; blind reaches berries 5.93 at 65 s) |
| m5-storm | **zblindCan (131 s, 3★, 0 ind), zblindCanStrict (127 s, 3★, 0 ind)** | idle and every constant strategy `bees-acid` at 79.6 s; canisterSpam (23 canisters on the wrong cells) fails |
| **m6-night (transfer)** | **blindLenient (181.6 s, 2★, 0 indicators), zblindCan (192 s, 3★, 0 ind)**. blindStrict narrowly fails (`pond-base`, pond 8.51 at 320 s); zblindCanStrict fails (pond 8.53). | idle, base, acid, water, to7, tapBase, tapAcid, canisterSpam, litmusOnly, random1–3 (all fail, mostly `bees-acid` at 93.5 s or `berries-base`) |

**Conclusions:**
- **No constant strategy wins m6.** Every always-X or random strategy fails, which meets the handoff's literal acceptance test.
- **m6 can be won with zero measurement.** An adaptive but *indicator-free* loop wins it: tap base, fizz means acid so keep going, no fizz means switch to acid, stop at the chime, flip at the overshoot toast, go wherever the grey is. This is the important finding: the transfer mission is meant to show the student can choose and read indicators, and it currently does not test that. m3 (the phenolphthalein lesson) and m5 behave the same way.
- **Root cause is HUD leakage, not the chemistry:**
  1. The grey wash shows `!inBand(c)` (`render/world.ts:795`), so un-grey means in band.
  2. The "pH ?" badges cluster over `!inBand` cells (`hud.ts:177`).
  3. The chime and overshoot toast fire for unmeasured cells (`game.ts:428-437`).
  4. The objective counter "אזורים מחוץ לטווח: N" counts true out-of-band cells (`game.ts:598-600`).
  Fizz is legitimate chemistry ("it heated up when I added base, so it was acidic"). It is fine to keep, but it should not be enough on its own.
- The m3 tapAcid win relies on the counter and chime. Its lenient oracle is close to, but not exactly, what is visible, because spill and decoy cells both stay grey. blindStrict wins m3 anyway.

---

## 4. Playability numbers

### 4.1 Tap windows (×1 puff = 0.05 s = 0.0004 mol; ×10 puff = 0.004 mol)

| Case | Band | Window (×1 puffs) | Window (×10 puffs) | Hold needed |
|---|---|---|---|---|
| Soil pH 3 (m1) | 6–8 | **7.6** | 0.76 | 2.9–3.25 s ×1 |
| Soil pH 3, tol 0.5 | 5.5–8.5 | 11.6 | 1.2 | 2.8–3.35 s |
| Hive pH 2.6 (m6) | 6–8.5 | 9.6 | 0.96 | 6.7–7.1 s ×1 (0.7 s ×10) |
| Hive pH 4 (m4) | 6–8.5 | 9.6 | 0.96 | 0.6–1.1 s |
| School pH 9.8 (m4) | 6–8.5 | 9.6 | 0.96 | 0.24–0.72 s |
| Lime pH 11 (m3) | 6–8 | 7.6 | 0.76 | 2.7–3.1 s |
| Creek pH 2 (m2) | 6–8.5 | 9.6 | 0.96 | **25.4–25.9 s ×1 / 2.5 s ×10** |
| Creek pH 11.3 (m6) | 6–8.5 | 9.6 | 0.96 | 5.1–5.6 s ×1 |
| Blueberry 7.4 → 4.5–5.5 (m4) | | **13.9** | 1.4 | 1.2–1.9 s ×1 |
| Blueberry 7.0 (m6) | | 13.9 | 1.4 | 0.95–1.6 s |
| Unbuffered soil pH 3 (comparison) | 6–8 | **0.099** | — | impossible |

The ×1 windows are generous (about 8–14 taps). The ×10 window is always under about 1.4 puffs, so ×10 cannot finish a cell. That is the intended "×10 for bulk, ×1 to finish" lesson. Near 7, one ×1 puff moves a soil cell by 0.27 pH and one ×10 puff by 2.7 pH.

### 4.2 Time to solve

The test bot ("intended", `tests/strategies.ts`) is **omniscient**: it reads `g.pH` directly and computes exact moles with `netForPH`. Its throws are cosmetic, so the "intended solution" tests prove the missions can be solved, but not that they can be solved from indicator information. For comparison, `honest.ts` plays like a kid: it reads pH only after universal mist, sprays in 1 s / 0.25 s holds and then taps, shrinks its holds after every overshoot, and visits the wagon or throws canisters only when the brief or hint says to.

| Mission | Omniscient bot | Kid model | Asset clock |
|---|---|---|---|
| m1 | 21 s, 3★ | **27 s, 3★** | none |
| m2 | 167 s, 3★ (pond 6.79) | **lost**: `pond-acid` at 120–134 s in 4 variants. A downstream "checkpoint" plan survived once with pond 6.52 and never finished. | slug reaches the pond in about 100–120 s; the pond tolerates 0.33 mol of acid before 6.5 |
| m3 | 55 s, 3★ | **91 s, 3★** | olives about 57 s if idle |
| m4 | 73 s, 3★ | **lost**: `berries-base` at 67 s (zone 5.98) | **berries die at 49.3 s if idle**; 12 cells × 1.2–1.9 s of acid each |
| m5 | 100 s (minTime 78), 3★ | **137 s, 2★** (with the hinted canisters) | bees die at 79.6 s without pre-protection |
| m6 | 182 s, 2★ | **lost**: `berries-base` at 230 s with **0 cells out of band**; another run `bees-base` at 88 s after heavy ×10 | bees about 93 s if idle |

### 4.3 Fairness issues

- **Tolerance mismatch, m4/m5/m6 (P1):** `allContained()` uses `mission.tol` (`game.ts:553-555`, tol 0.25–0.5), but assets die on their strict band (`game.ts:520-533`). In m6 the kid model ended with **objective "0 out of band" ("מחזיקים יציב...") while the blueberry zone sat at 5.61 and died.** The HUD tells the student they are done while an asset is dying. Either compute contamination with tol 0 for asset cells, or give the asset bands the same tolerance.
- **m4 berry clock:** from t = 0 the berries lose about 2 health/s (`decay` 0.7 × (1 + 1.9)), so the student has about 50–60 s to mist and treat 12 bed cells. The minimum continuous ×1 spray is about 18 s, and every read-tap cycle costs about 1 s. It is doable for a sweeping expert and tight for a 13-year-old who reads the brief carefully. Suggest decay 0.35–0.4, or berries starting at 6.8.
- **m2 margin:** after the ×10 unlock, a single creek cell holds about 0.02–0.2 mol, and a 1 s ×10 hold (0.08 mol) flips a pH-4 creek cell to 11.4. The slug smears across about 10 cells at 22%/s (`world.ts:81`). It is winnable with exact sums, but two reasonable kid heuristics lost. Suggest a larger pond buffer (`beta` 0.03 → 0.05/cell) or `CREEK_FLOW` 0.22 → 0.15, so a "hold the line at one checkpoint" plan works. That plan is good containment play and should be rewarded.
- **m6 ×10:** ×10 is available from the start and the creek cells need only 0.043 mol each, so a natural 1 s ×10 hold overshoots one cell from 11.3 to about 2. That is educational once, but combined with the bees clock (about 93 s) and no hints it may feel punishing. Watch this in a human playtest.
- **m5:** without canisters nothing a kid can do beats the bees clock (all non-canister strategies fail at exactly 79.6 s). The canister is the only answer, and it is mentioned only in the brief and hint 1. That is acceptable for a scaffolded level, but say "השתמשו בקפסולות לפני הגשם" more prominently.
- **Tests:** the mission tests' "intended" path is omniscient. Gate its reads on `know[c] & KNOW_UNIVERSAL` (or `readingAt`) so CI proves the game is solvable from what the student can see, and add the blind-oracle strategy as a must-fail test for m3 and m6.

---

## 5. Prioritized fix list

### P0: science errors (small text and logic fixes)
1. **Mg(OH)₂ → CaCO₃** in the m5 brief and hints (`missions.ts:309`, `:342`, `:347`). Real Mg(OH)₂ slurry is about pH 10.4, so the 8.5 cap claim is false. CaCO₃ fits the cap, is a Workbook antacid and liming agent, and links to the limestone quarry.
2. **Overshoot toast direction** (`main.ts:481`, `fx.ts:182`): compare against the cell band, not 7. Today a base tap on blueberries says "יותר מדי חומצה!".
3. **"pH 7.4 – נייטרלי"** → "קרוב לנייטרלי (מעט בסיסי)" (`missions.ts:287`).
4. **"חומצה חלשה יותר (pH 3)"** → "חומצית פחות / פי 10 פחות יוני H⁺" (`missions.ts:136`). Do not use the weak-acid term for dilution.
5. **"שקוף: לא בסיסי"** → "שקוף: pH מתחת ל-8.2" (`game.ts:625`, `hud.ts:222`, `missions.ts:216`).

### P1: bypasses and misconception gaps
1. **Stop the HUD leaking the true pH on unmeasured ground.** This is the m6, m5 and m3 bypass.
   - Grey wash: key it to "suspect and not universally measured", not to `!inBand` (`render/world.ts:795`).
   - "pH ?" badges: key them to authored suspects or a decaying "reported contamination" mask, not `!inBand` (`hud.ts:177`).
   - Chime and overshoot toast: fire them only if the cell has `KNOW_UNIVERSAL`, or for `KNOW_PHENOL` only on the pink/colourless transition (`game.ts:428-437`).
   - Objective counter: show asset status and known cells only (`game.ts:595-601`).

   Then re-run `bypass.ts m6 blind`; it should fail. Add it as a test.
2. **Tolerance mismatch:** do not let the objective say "0 out of band" while an asset is out of its band (`game.ts:534`, `:553`).
3. **"Phenolphthalein shows acids":** add an acidic patch (for example a spilled vinegar or fertilizer drum, pH about 4.5) inside the m3 phenolphthalein survey area. It stays colourless and still hurts the olives, so "colourless ≠ fine" is learned by consequence. Change the m3 winText (`missions.ts:221`) so it no longer reinforces the misconception.
4. **"Neutralization makes stuff disappear":** replace the fizz bubbles with heat shimmer and a thermometer pop, make the salt crust persist and grow, and show "נוצרו X מול מלח + מים" from `ledger.salt` on the result screen. Optionally add a tiny consequence (for example, salt crust slows bloom) so salt is something students notice.
5. **"Litmus gives a number":** add one moment where litmus is the only cheap tool and two "red" patches need very different amounts (pH 2 and pH 4). Remove the explicit numbers from the m2 brief (`missions.ts:135-136`) so the universal mist discovers them.
6. **Tests:** make the intended bot read only measured cells, and add must-fail tests for an indicator-free strategy in m3 and m6.

### P2: balance and wording
1. m4: berry decay 0.7 → about 0.35–0.4, or start the bed at 6.8.
2. m2: pond `beta` 0.03 → about 0.05/cell, or `CREEK_FLOW` 0.22 → 0.15, so a careful kid holding a checkpoint wins.
3. Canister "works slowly": `WEAK_RATE` 0.012 → about 0.002, or drop "לאט".
4. Acid rain at pH 3.2: soften it, or label it "חזק במיוחד".
5. Wording: "מהלים" → "מדללים" (`:169`); "פי 10 ביוני" → "פי 10 בריכוז יוני" (`:172`); "הטווח הירוק" and "סגול" (`:94`, `:123`); "בולמת" → "חוצצת (buffer)" (`:289`); `olives-acid` fail attribution (`:224`); "פְּרִיץ" → "פרץ" (`index.html:61`).
6. Add the buffer explanation (§1.2), the water/first-aid note and "neutralization ≠ always 7 (weak base ends about 8.5)" to CURRICULUM.md.

---

## Appendix: reproduction

```
cd /Users/acedzn/dev/AceDZN-exp/ph-rangers
npx tsx <scratch>/review/numbers.ts            # chemistry, windows, dilution, grid facts
npx tsx <scratch>/review/bypass.ts m6 blind    # indicator-free strategies on the transfer mission
npx tsx <scratch>/review/bypass.ts m5 zblind
npx tsx <scratch>/review/honest.ts             # kid-model timings
npx tsx <scratch>/review/berrytoast.ts         # wrong-direction overshoot toast
```
`<scratch>` = `/private/tmp/claude-501/-Users-acedzn-dev-AceDZN-exp-ph-rangers/e0a94e5b-bd16-4904-bfbd-e566ba99ccfe/scratchpad`. The bypass scripts import the repo's `src/sim` and `tests/bot.ts` read-only. Each strategy has a 90 s wall-clock guard. Line numbers are from the working tree on 2026-10-25; `src/render/world.ts` was being edited during the review (the grey wash line moved from about 759 to 795).

---

## Re-check (after dba41af)

`npm test` passes: 41/41 (31 s). New scratch scripts sit in the same review folder: `bypass2.ts` uses only what the player can now see, `honest2.ts` is the kid model updated to the new visibility, and `verifypatch.ts` + `bypass2v.ts` / `honest2v.ts` prototype "measure to win" without touching `src/`.

### P0 items: all fixed
- **P0-1 (canister chemistry):** the m5 brief now reads "סידן פחמתי CaCO₃ – אבן גיר … מתמוססות לאט … לא מעלות את ה-pH מעל ~8.5" (`missions.ts:312`), and Mg(OH)₂ no longer appears anywhere. `WEAK_RATE` is now 0.003 mol/s, below the ×1 nozzle's 0.008, so "לאט" is true.
- **P0-2 (overshoot direction):** `FxEvent.overshoot.dir` is computed from the cell's band (`game.ts`, `after > b.hi`), and both `main.ts` handleFx and the `fx.ts` ring use it.
- **P0-3 (pH 7.4 wording):** now "קרוב לנייטרלי (מעט בסיסי)" (`missions.ts:290`).
- **P0-4 (m2 brief):** the brief no longer contains numbers or "חלשה", and the student is told to measure. The hints and winText still give pH 2 / pH 3, which is fine because they come after measuring.
- **P0-5 (phenolphthalein label):** "שקוף (pH מתחת ל-8.2)" in `game.ts:653`, and "שקוף: מתחת ל-8.2" on the `hud.ts:222` badge.
- **Wording items also fixed:** מדללים, בריכוז, חוצצת, the green-range and purple lines, the m3 winText, and the salt line on the result screen.
- **Remaining nit (P2):** the m6 `berries-base` fail text still says "…לא 7" (`missions.ts:406`), but the beds now start at 6.2. Suggest "לא קרוב ל-7".

### HUD leakage: fixed, but heat probing still beats m6 (P1)

What I confirmed in the code:
- The grey wash and the "pH ?" badges are now keyed to `grid.suspect`.
- The chime and overshoot FX fire only on cells measured with universal indicator.
- Fizz fires only when the pH before the spray is below 4 or above 10; steam only below 4.5 or above 9.5.
- The objective shows the measured, unmeasured and in-danger counts.
- The bushes now show the asset's health instead of each cell's pH.

The new blind oracle (`bypass2.ts`) uses only signals that are still visible:
- the suspect grey patches, plus the creek, which is visible water;
- fizz;
- the asset health bars;
- the rule "probe with one puff of base, then one of acid; keep spraying the one that fizzes until it stops, then N extra puffs";
- a fixed acid dose on the blueberry bed, because the brief says the berries need acidic soil.

| Mission | Strategy (0 indicators) | Result |
|---|---|---|
| **m6** | `tests/strategies.ts` `blind` (berry dose 1.2 s) | fails: `berries-acid` (bed ends at 3.07) |
| **m6** | blind2, N = 8 or 16, berry dose 0.5 or 0.8 s | **won, 3★, 166 s, 0 indicators** (all 4 combinations) |
| **m6** | blind2, N = 8–20, berry dose 1.2 s | fails: `berries-acid` (bed ends at 4.46) |
| m3 | `tests/strategies.ts` `blind` | **won, 3★, 164 s, 0 indicators**. The new fertilizer cell (pH 3.8, below 4) fizzes, so heat probing finds it too. |
| m3 | blind2 | stuck in "play" at 400 s |
| m5 | blind2 + one canister on the hives and one on the school | won, 3★, 276 s (m5 is a scaffolded level, so this is acceptable) |
| m5 | blind / blind2 without canisters | fails: `school-acid` at 61 s |

**The m6 test (`missions.test.ts:138`) passes only because `blind` uses a 1.2 s acid dose on the berries.** Any dose between about 0.45 and 1.15 s wins: the blueberry window is about 9–23 puffs from pH 6.2. So the guarantee depends on that one constant.

**Suggested fix: make measuring part of winning.** Require every `suspect` cell to carry `KNOW_UNIVERSAL` before the hold timer can start; the objective already shows "לא נמדדו: N". As a test, I patched `allContained` that way in scratch only (`verifypatch.ts`):
- blind2 never wins m6; it is still in "play" at 400 s.
- The kid model still wins m6 (211.7 s, 2★), m2 (163.8 s, 3★) and m4 (152.3 s, 2★).

Also strengthen the m6 test: loop over berry doses (for example 0.3–1.2 s) and N values (8, 16), not a single constant.

### Kid model after the balance changes (`honest2.ts`, visibility as above)

| Mission | Result |
|---|---|
| m2 | **won, 163.8 s, 3★** (pond ends at **6.51**; margin 0.01) |
| m4 | **won, 130 s, 2★** (berry health got down to **9**) |
| m6 | **won, 211.7 s, 2★** |

All three missions are now winnable by a measuring, non-omniscient player. m2 and m4 still finish very close to failure. If a human playtest confirms that, nudge them further: pond `beta` 0.06, or m4 berry decay 0.3.
