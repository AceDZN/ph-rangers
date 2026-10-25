# pH Rangers — סיירת ה-pH — game identity

**One line:** de Blob meets a firefighting game with chemistry in the tank. You're a ranger with a backpack sprayer who runs through a sunny Galilee valley, reads spills with indicator gadgets and sprays just enough acid or base to bring the land back to life before the spill spreads.

## Core action without the school topic

Run, aim, spray a stream, watch the ground change colour, manage a limited tank, triage spreading patches under a timer. Closest feels: de Blob (colour washing over the world), firefighting/PowerWash (satisfying stream on a target), a light triage pressure (spills creep downhill toward things you care about).

## The decision that makes it chemistry

How much of what, and where, before it spreads. The tank has three valves (acid / base / water). Every squirt delivers a fixed amount. pH is logarithmic, so a pH-2 patch needs ten times the base of a pH-3 patch; water only dilutes (floods, barely moves strong acid, never crosses 7); too much base overshoots and turns the meadow purple. Indicators decide what you know: litmus = acid or base only, phenolphthalein = pink only for bases, universal mist = colour + number.

## Camera, input, feel

- Third-person chase camera behind and above the ranger's right shoulder, ~35° down, slight lead in the aim direction. The world is mostly visible ground: the ground is the canvas.
- Desktop: WASD/arrows move, mouse aims (ground reticle), hold left mouse / Space to spray, Q/E or 1-3 switch valve, R/F/G throw litmus / phenolphthalein / universal mist, Shift sprint. Touch: left stick, aim by dragging on the right half, big spray button, valve and gadget buttons.
- Spray is a chunky arcing particle stream with splats; neutralization fizzes, steams and leaves a faint white salt crust; overshoot flashes the zone purple with a "uh-oh" boing.

## Look

- Sunny Galilee valley: terraced olive/citrus orchard rows, a small fish pond, wooden beehive boxes, dry-stone walls, a few stone village houses, a pale lime quarry cut, a creek. Warm late-morning light, soft long shadows, saturated but natural colours (sage greens, ochre soil, limestone white, sky blue).
- Unknown zones are grey-washed and desaturated, plants drooping. Surveyed zones show the universal-indicator palette as a translucent wash on the ground with a floating number badge. Restored zones bloom: grass, flowers, bees, fish jumping.
- Not neon combat, not a toy-industrial diorama, not a robot. A teen ranger in an olive-green field uniform, orange cap, yellow backpack tank with three coloured valve knobs (red acid, blue base, clear/cyan water).

## HUD (Hebrew RTL, Rubik font)

- Top-right: mission title + objective line in Hebrew.
- Top-left: spread timer / storm front bar and assets-at-risk icons (fish, bees, blueberries, school) each with its pH band.
- Bottom-right: the tank — vertical capsule gauge showing fill and the tank's own pH number, three valve buttons (acid / base / water) with icons, current selection highlighted.
- Bottom-left: gadget belt — litmus (count), phenolphthalein flares (count), universal mist (charge ring).
- Over each surveyed zone in the world: a small badge with the pH number in LTR plus an icon (drop for acid, soap bubble for base, leaf for neutral) — colour is never the only signal.
- Centre: ground reticle that shows the spray landing point.

## Universal-indicator palette (Workbook table)

0–3 red · 4–5 orange · 6 yellow · 7 green · 8 blue-green · 9–10 blue · 11–14 purple. Always paired with the number.

## Sound

Pressurised hiss for spray, fizz + pop for neutralization, soft chime as a zone hits its band, comic boing for overshoot, bees and birds return when land recovers. All synthesized (WebAudio) after the first gesture.

## What it is not

Not a courier loop, not combat, no enemies or damage numbers, no quiz popups, no typed answers.
