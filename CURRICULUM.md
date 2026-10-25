# pH Rangers — curriculum map

Source of truth: Workbook, grade 8 science, chapter 10 (חומצות, בסיסים ותמיסות). Saved snapshots: [`docs/curriculum/`](docs/curriculum/). The authoritative rules live in [`src/sim/chem.ts`](src/sim/chem.ts) and [`src/sim/world.ts`](src/sim/world.ts); every mission is proven solvable, and its wrong approaches proven to fail, in [`tests/`](tests/).

## Modules used

| Workbook module | What the game uses |
|---|---|
| [ph-scale](https://science.workbook.co.il/grade-8/chapter-10/ph-scale) | pH 0–14, < 7 acidic, 7 neutral, > 7 basic; **each unit is ×10 in H⁺** |
| [indicators](https://science.workbook.co.il/grade-8/chapter-10/indicators) | litmus (acid / base only, change range 4.5–8.2), phenolphthalein (colourless < 8.2, pale pink 8.2–10, pink > 10; never shows acids), universal indicator colour table (0–3 red, 4–5 orange, 6 yellow, 7 green, 8 blue-green, 9–10 blue, 11–14 purple) |
| [neutralization](https://science.workbook.co.il/grade-8/chapter-10/neutralization) | acid + base → salt + water, releases heat (steam), salt crust stays behind |
| [acids-intro](https://science.workbook.co.il/grade-8/chapter-10/acids-intro), [bases-intro](https://science.workbook.co.il/grade-8/chapter-10/bases-intro) | H⁺ vs OH⁻ excess; strong acid spill, lime (calcium-hydroxide-like) dust |
| [acids-bases-daily-life](https://science.workbook.co.il/grade-8/chapter-10/acids-bases-daily-life) | lemon juice, cleaning products, antacid (Mg(OH)₂-style weak base) |
| [concentration-solubility](https://science.workbook.co.il/grade-8/chapter-10/concentration-solubility), [solutions-intro](https://science.workbook.co.il/grade-8/chapter-10/solutions-intro) | ×1 vs ×10 concentrate; dilution with water changes concentration but not the amount of acid |
| [safety-handling](https://science.workbook.co.il/grade-8/chapter-10/safety-handling) | context only (ranger gear); not assessed |

## Missions → skill → misconception

| # | Mission | Skill practised | Misconception it checks | Proof in tests |
|---|---|---|---|---|
| 1 | שלולית הלימון (Lemon Spill) | litmus → acid; universal → number; spray base until green; overshoot to purple and fix with acid | "neutralization makes it disappear" (salt crust + steam remain); colour ↔ number pairing | `missions.test.ts` mission 1: water barely moves pH 3 and floods the path; overshoot > 9.5 then fixable |
| 2 | חומצה במעלה הנחל (Upstream Acid) | ×10 rule through play: the same 3 s of base fixes the pH 3 puddle but removes under 10 % of the flowing pH 2 wave; ×10 concentrate at the wagon | "pH 3 is just a bit more acidic than pH 4"; "add water to neutralize"; "more base is always safer" (base flooding the pond kills the fish too) | mission 2 tests: ×1-only, water-only → `pond-acid`; base flood → `pond-base` |
| 3 | אבק המחצבה (Quarry Dust) | phenolphthalein finds hidden bases; neutralize lime with acid; leave neutral dust alone; a torn sack of acidic fertilizer (pH 3.8) stays colourless in phenolphthalein and must be found with litmus or universal indicator | "phenolphthalein shows acids" / "colourless means neutral"; "litmus gives a number" | pink only on lime cells and the fertilizer stays colourless; acid on every pale patch makes clean ones acidic; base kills the olives; water only spreads the lime |
| 4 | האוכמניות של רינה (Rina's Blueberries) | different targets: blueberries 4.5–5.5, hives and school yard 6–8.5 | "neutral is always the goal" / "everything to 7" | everything-to-7 → `berries-base`; constant base/acid/water fail |
| 5 | חזית הסערה (Storm Front) | triage under a 56 s front of strong (industrial) acid rain; slow weak-base canisters (CaCO₃, limestone) that cannot overshoot past ~8.5; graded on the quarry leak and the protected places, not every raindrop | "more base is safer" (weak vs strong base) | doing nothing fails; intended plan wins |
| 6 | דליפה בלילה (Night Spill, transfer) | no hints; unknown spill types; pond already 8.3; blueberries limed to 7 | all of the above at once | always base / acid / water / to-7 all fail; intended wins |

## Model and its simplifications (said plainly)

- **Strong acid / strong base**, as in Workbook: each patch stores the net excess of H⁺ or OH⁻ (moles-like units) and its water volume; pH = −log₁₀ of the free H⁺ concentration (water's own ions included so 7 is exact when acid = base), clamped 0–14.
- **Dilution** adds water volume only: pH moves toward 7, never crosses it, and needs ~10× the volume per unit at strong values. Spraying water also floods: excess water runs downhill and carries acid to the neighbours.
- **Neutralization**: when acid meets base the smaller amount reacts completely; the ledger counts salt formed (and heat released) and is conserved in tests.
- **Soil / pond buffer (חוצץ — game simplification):** like the buffers that keep blood at pH 7.4 (Workbook, ph-scale), real soil and pond water resist small pH changes near neutral. Student box used in hints: "בקרקע ובבריכה יש חומרים 'חוצצים' שבולמים שינויים קטנים ליד 7, כמו בדם. רחוק מ-7 הם כבר לא עוזרים, ושם כל יחידת pH היא פי 10." Different ground buffers differently (orchard terra rossa more, school-yard sand less, blueberry peat most). Each patch has a small buffer that only acts between pH 4 and 9. Without it, a strong acid / strong base patch jumps from ~4 to ~10 within a fraction of one spray puff, and no hand-held sprayer could ever land inside a 6–8 band. Effects a student can see: the last few puffs near 7 move the number gently; a pH 2 patch needs about 8–10× the base of a pH 3 patch instead of exactly 10× (tested: 8–10.5×). Blueberry beds (peaty soil) have a larger buffer. In‑game text says "about ten times".
- **Weak base** (antacid canister, calcium carbonate CaCO₃ / limestone — a Workbook antacid and liming agent) dissolves slowly and stops releasing base at pH ~8.5 — modelled as a cap, not an equilibrium constant. (Mg(OH)₂ was dropped: its slurry sits near pH 10.4.) This also shows that neutralization does not always end exactly at 7.
- **Heat as a signal:** neutralization releases heat. The game shows steam (no gas bubbles — acid + base does not make gas) only while a lot of acid or base is reacting (pH below 4 or above 10); near neutral the heat is too small to notice, so only an indicator can tell you that you are in the band.
- **Water:** in the game water dilutes, floods and spreads a spill; it soaks into the ground but the acid stays. This is about a field spill. On skin, Workbook's first aid is still "rinse with lots of water, don't neutralize" (safety-handling) — worth saying so students don't over-generalize "water is always wrong".
- **Litmus thresholds**: < 4.5 red (acid), > 8.2 blue (base), in between "no clear change" — Workbook's 4.5–8.2 change range. It never shows a number.
- **Bands** (fish 6.5–8.5, blueberries 4.5–5.5, bees / school 6–8.5) are game targets inspired by common guidance, not Workbook content.
- **Sign-off needs measurement:** a mission ends only when every suspect patch has been measured with universal indicator and is in its band — heat and guesses are not enough.
- **What the HUD shows is only what the ranger could know:** the grey "unknown" wash and "pH ?" markers cover reported/sprayed ground, not the true out-of-band cells; the "in band" chime and "too much" toast only fire on ground measured with universal indicator; the objective counts measured cells and unmeasured suspect ground. Asset health bars (and fish, bees, yellowing blueberries) are the visible consequences.
- **The pH ruler** shows, for the aimed ground, the target band and exactly what the indicators used there tell you: litmus shades 0–4.5, 4.5–8.2 or 8.2–14; phenolphthalein shades below 8.2, 8.2–10 or above 10 (both are intersected when both were used); universal indicator puts a marker at the number (Workbook: accurate to about one unit). A dashed tick shows where one more puff would put the pH — near neutral students can see one puff move it a lot, far from neutral (pH 2) barely at all: the ×10 rule as a live preview.
- Colour is never the only signal: every reading pairs a colour with a number or an icon (drop = acid, bubbles = base, leaf = neutral) and Hebrew text.

## Learning events

`Game.events` logs mission id, time, action (start, valve, strength, litmus/phenol/mist with reading, first-spray with target pH, overshoot, refill, hint, win/fail), hint-used flag and attempt number; the first spray of each attempt is tagged `first: true` so unaided first decisions can be told apart from hinted or repeated ones. Stored only in `localStorage` (`phr-events`), never sent anywhere.
