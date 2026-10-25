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
| 2 | חומצה במעלה הנחל (Upstream Acid) | ×10 rule through play: the same 3 s of base fixes the pH 3 puddle but moves the pH 2 creek < 0.5; ×10 concentrate at the wagon | "pH 3 is just a bit more acidic than pH 4"; "add water to neutralize"; "more base is always safer" (base flooding the pond kills the fish too) | mission 2 tests: ×1-only, water-only → `pond-acid`; base flood → `pond-base` |
| 3 | אבק המחצבה (Quarry Dust) | phenolphthalein finds hidden bases; neutralize lime with acid; leave neutral dust alone | "phenolphthalein shows acids" / "colourless means neutral"; "litmus gives a number" (litmus only ever says acid/base/unclear) | pink only on lime cells; acid on every pale patch makes clean ones acidic; base/water fail |
| 4 | האוכמניות של רינה (Rina's Blueberries) | different targets: blueberries 4.5–5.5, hives and school yard 6–8.5 | "neutral is always the goal" / "everything to 7" | everything-to-7 → `berries-base`; constant base/acid/water fail |
| 5 | חזית הסערה (Storm Front) | triage under spreading acid rain; weak-base canisters that cannot overshoot past ~8.5 | "more base is safer" (weak vs strong base) | doing nothing fails; intended plan wins |
| 6 | דליפה בלילה (Night Spill, transfer) | no hints; unknown spill types; pond already 8.3; blueberries limed to 7 | all of the above at once | always base / acid / water / to-7 all fail; intended wins |

## Model and its simplifications (said plainly)

- **Strong acid / strong base**, as in Workbook: each patch stores the net excess of H⁺ or OH⁻ (moles-like units) and its water volume; pH = −log₁₀ of the free H⁺ concentration (water's own ions included so 7 is exact when acid = base), clamped 0–14.
- **Dilution** adds water volume only: pH moves toward 7, never crosses it, and needs ~10× the volume per unit at strong values. Spraying water also floods: excess water runs downhill and carries acid to the neighbours.
- **Neutralization**: when acid meets base the smaller amount reacts completely; the ledger counts salt formed (and heat released) and is conserved in tests.
- **Soil / pond buffer (game simplification, not in Workbook):** real soil and pond water resist small pH changes near neutral. Each patch has a small buffer that only acts between pH 4 and 9. Without it, a strong acid / strong base patch jumps from ~4 to ~10 within a fraction of one spray puff, and no hand-held sprayer could ever land inside a 6–8 band. Effects a student can see: the last few puffs near 7 move the number gently; a pH 2 patch needs about 8–10× the base of a pH 3 patch instead of exactly 10× (tested: 8–10.5×). Blueberry beds (peaty soil) have a larger buffer. In‑game text says "about ten times".
- **Weak base** (antacid canister) dissolves slowly and stops releasing base at pH ~8.5 — Workbook's "doesn't overshoot" point, modelled as a cap, not an equilibrium constant.
- **Litmus thresholds**: < 4.5 red (acid), > 8.2 blue (base), in between "no clear change" — Workbook's 4.5–8.2 change range. It never shows a number.
- **Bands** (fish 6.5–8.5, blueberries 4.5–5.5, bees / school 6–8.5) are game targets inspired by common guidance, not Workbook content.
- Colour is never the only signal: every reading pairs a colour with a number or an icon (drop = acid, bubbles = base, leaf = neutral) and Hebrew text.

## Learning events

`Game.events` logs mission id, time, action (start, valve, strength, litmus/phenol/mist with reading, first-spray with target pH, overshoot, refill, hint, win/fail), hint-used flag and attempt number; the first spray of each attempt is tagged `first: true` so unaided first decisions can be told apart from hinted or repeated ones. Stored only in `localStorage` (`phr-events`), never sent anywhere.
