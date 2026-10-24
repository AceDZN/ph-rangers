# pH Rangers — סיירת ה-pH — build handoff

Read `../COMMON.md` first. Repo `/Users/acedzn/dev/AceDZN-exp/ph-rangers` → public `AceDZN/ph-rangers`, port 5197 (preview 4197).

## Promise

de Blob meets a firefighting game, with chemistry in the tank. A chemical truck spilled acid upstream of a Galilee valley and a lime quarry leaks alkaline dust downstream. The contamination spreads with rain and slopes. You're a ranger with a backpack sprayer and three valves — acid, base, water — plus indicator gadgets that paint the world in its true pH colours. Run, aim, spray, contain, neutralize, and watch dead-grey land bloom back into orchards and bees. The fun is satisfying spraying, colour washing over the world and the pressure of a spreading threat. You learn pH because guessing wastes tank and overshoots turn the meadow purple.

Map evidence: de Blob × Opus Magnum — related ✓, density **0.640**, the emptiest measured blend this round. Not a certified gap. See IDEAS.md.

## Curriculum (Workbook grade 8, chapter 10)

[ph-scale](https://science.workbook.co.il/grade-8/chapter-10/ph-scale), [indicators](https://science.workbook.co.il/grade-8/chapter-10/indicators), [neutralization](https://science.workbook.co.il/grade-8/chapter-10/neutralization), [acids-intro](https://science.workbook.co.il/grade-8/chapter-10/acids-intro), [bases-intro](https://science.workbook.co.il/grade-8/chapter-10/bases-intro), [acids-bases-daily-life](https://science.workbook.co.il/grade-8/chapter-10/acids-bases-daily-life), [safety-handling](https://science.workbook.co.il/grade-8/chapter-10/safety-handling); supporting [solutions-intro](https://science.workbook.co.il/grade-8/chapter-10/solutions-intro), [concentration-solubility](https://science.workbook.co.il/grade-8/chapter-10/concentration-solubility).

Rules from Workbook: pH 0–14; < 7 acidic (H⁺), 7 neutral, > 7 basic (OH⁻); **each pH unit is ×10** in ion concentration; **litmus** says only acid (red) or base (blue); **phenolphthalein** is colourless below ~8.2 and pink above (shows bases only); **universal indicator** gives a colour for each pH (red → orange → yellow → green 7 → blue → purple); **acid + base → salt + water**, exothermic (heat); neutralization moves pH toward 7 but not always exactly 7 (weak/strong pairs); everyday acids/bases (lemon, vinegar, soap, baking soda, stomach acid, antacid); safety equipment.

Scientific qualifications: model each zone with H⁺/OH⁻ amounts (moles-like units) and volume; compute pH from the excess with the log rule, clamped to 0–14. Dilution with water moves pH toward 7 but never crosses it and needs ~10× volume per unit at strong values. Keep everything in Workbook's simplified strong-acid/strong-base model except where a level explicitly uses a weak base (e.g. Mg(OH)₂-style antacid) to show "doesn't overshoot past ~8–9". Indicator colours follow Workbook's table; always pair colour with the number/icon.

Misconceptions to catch: "pH 3 is just a bit more acidic than 4" (it's ×10); "add water to neutralize" (dilution ≠ neutralization; it floods and barely moves strong acid); "more base is always safer" (overshoot to basic is also harmful); "litmus tells you the pH number"; "phenolphthalein shows acids"; "neutralization makes the stuff disappear" (salt + water remain).

## Core loop

1. **Survey:** run through the valley (third-person, WASD + mouse aim / touch stick + aim). Grey-washed zones mean unknown. Throw an indicator: litmus strip (instant, acid/base only), phenolphthalein flare (reveals hidden bases in pink, nothing else), universal-indicator mist (slow, costs charge, paints exact colours + numbers over a radius).
2. **Mix:** your tank has three valves; turning them sets what you spray (acid, base, water or a blend). The tank gauge shows its own pH.
3. **Spray:** aim and spray zones; each squirt delivers a known amount. Neutralization hisses, steams (heat) and leaves a faint salt crust. Overshoot flips the zone's colour past green.
4. **Spread:** untreated zones spread downhill and with rain fronts on a visible timer; the valley's assets (beehives, fish pond, orchard rows, a school yard) suffer if their zone leaves their safe pH band (fish need ~6.5–8.5; blueberry bushes prefer acidic soil, so "everything to 7" isn't always the goal).
5. **Refill** at a few supply wagons (short, not a courier loop — stations are on your path). Win a level when every protected asset is in band and the spill is contained; star rating by tank efficiency and assets saved.

## Five missions + transfer (vertical slice)

1. **Lemon Spill.** A small lemon-juice puddle (pH ~3) on the path. Litmus shows acid; spray base until green. Overshoot to purple is shown and fixable. Teaches the scale and the colours.
2. **Upstream Acid.** A stronger acid (pH 2) spreading down a stream toward the fish pond; one at pH 3 nearby. The ×10 rule matters: same squirts fix the pH-3 zone and barely move the pH-2 one. Water-only attempt floods the path and stays acidic.
3. **Quarry Dust.** Hidden basic zones (lime dust, pH 11) in the orchard; phenolphthalein reveals them in pink; litmus would only say "base". Neutralize with acid.
4. **The Blueberry Farmer.** Target bands differ: blueberry rows need acidic soil (~4.5–5.5), the beehives near neutral, the school yard neutral. Spraying everything to 7 fails the farmer.
5. **Storm Front.** Acid rain front moving across the valley while the quarry leaks; triage under spreading pressure. Antacid-style weak base canisters can't overshoot past ~8.5 but work slowly.
6. **Transfer: Night Spill.** No hints, a new valley at night (indicator glow is the only light), unknown spill types, a pond that's already slightly basic. A constant strategy (always base, always water, always to 7) must fail.

## Rules to keep authoritative (pure TS + tests)

- Zones on a grid with volume, acid amount, base amount; pH computed from the net excess and volume (log10), neutral when equal. Spray adds known amounts; spreading moves amounts to neighbours by slope/rain; mass/amount ledger is conserved (salt and water produced are tracked).
- Indicator functions map pH → reading exactly per Workbook (litmus 2-state, phenolphthalein threshold ~8.2, universal colour table).
- Every mission has a test for an intended solution, the advertised wrong approach (water-only, everything to 7, overshoot), and constant-strategy failure.

## 3D, camera, art

- Third-person chase camera, responsive movement and aiming; spray as a particle stream with splats that blend into terrain colour (terrain vertex colours or a pH texture driven by the grid).
- Visual thesis: a sunny Galilee valley — terraced orchards, a fish pond, beehive boxes, stone walls, a small village and a quarry. Grey-washed when unknown; the universal-indicator palette washes over the world as you survey; restored zones bloom with grass, flowers and bees. Bright, saturated, kid-friendly; not neon combat, not toy-industrial.
- Tripo candidates (≤ 6): the ranger (rigged, Mixamo preset: idle, run, spray/aim, celebrate, slip), the backpack sprayer, the overturned chemical truck, a beehive cluster, the supply wagon, an orchard tree. Optional AI animation for a waving farmer NPC. Terrain, spray, colour washes and gauges are procedural.

## Acceptance

First 30 seconds: run, throw litmus, see red, spray base, watch the zone fizz and turn green with a satisfying sound and the number counting to 7. Overshoot is visible and fixable. Mission 2 proves ×10 through play, not text. The transfer mission is solvable without hints and fails a constant strategy.
