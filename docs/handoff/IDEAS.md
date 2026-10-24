# Grade-8 science 3D games — ten ideas, six handoffs, three builds

25 October 2026 (second science request of the day). The user, an edtech founder who owns Workbook, asked for fun-first educational **3D web games** for Hebrew-speaking grade-8 students, taught to the Israeli Ministry of Education curriculum as published in Workbook ([science/grade-8](https://science.workbook.co.il/grade-8)). Most important subject: **מיון חומרים** (pure substance — element/compound — vs homogeneous/heterogeneous mixture), and a **שיטות הפרדה** game. Other subjects from the whole grade-8 curriculum. Use Idea Plotter's map to find blends, real Steam mechanics, "REAL FUN GAMES, not stupid edtech sims". Ten ideas → best three built now, each by its own builder thread.

## Context: what else is already running

- **Earlier today (another Claude session):** Matter Customs (classification inspection desk), Clumpus (Katamari, material properties), Storm Proof (Teardown, material choice) — builders active in `/Users/acedzn/dev/AceDZN-exp/{matter-customs,clumpus,storm-proof}`. Matter Customs is a dedicated **מיון חומרים** game.
- **Codex (ChatGPT app)** is running a parallel science round in this repo (`reports/science-web-round-2026-10-25/`, curriculum files in `reports/science-games-2026-10-25/`). This round keeps its own paths (`science-claude-*`) and ports 5195–5200 to avoid collisions.
- **Math games (24 Oct):** Scale Shift, Percent Pulse, Hypotenuse Rush, Ringwarden, Equal & Opposite.

So this round must (a) still give the user a strong classification + separation game, (b) spread to other grade-8 science, and (c) not converge with the eight games above in loop, camera or look.

## Curriculum used (saved snapshots: [`curriculum/`](curriculum/))

| Chapter | Modules used | Core idea a game can act on |
|---|---|---|
| 3 — תרכובות, תערובות ושינויים | classify-matter, pure-substances-intro, mixtures-intro, compounds-vs-mixtures, separation-intro, filtration-evaporation, distillation-chromatography, separation-lab | Workbook's own decision chain: **identify components → homogeneous or heterogeneous? → which property differs → which method**. Heterogeneous: solid+liquid → filter; solid+solid → magnet/sieve; liquid+liquid → separating funnel. Homogeneous: dissolved solid → evaporation/crystallization; liquid+liquid → distillation; pigments → chromatography. **Compounds can't be separated physically.** Salt+sand+iron needs magnet → dissolve+filter → evaporate, in that order. |
| 4 — חשמל ומגנטיות | electricity-intro, electric-circuits, current-voltage-resistance, ohms-law, series-parallel, electrical-safety, energy-power-consumption | Open/closed circuit, conductors/insulators, V = I·R, series (same current, one break kills all, voltages add) vs parallel (same voltage, independent branches), short circuit → huge current → fuse melts, wet skin lowers resistance. |
| 10 — חומצות, בסיסים ותמיסות | ph-scale, indicators, neutralization, acids-intro, bases-intro, acids-bases-daily-life, solutions-intro, concentration-solubility | pH 0–14, each unit ×10 in H⁺; litmus = only acid/base, phenolphthalein colourless → pink above ~8.2, universal indicator red→green→purple; acid + base → salt + water, exothermic; neutralization need not land exactly on 7; dilution vs neutralization. |
| 1 + 9 — אטום, קשר כימי | atom-structure, electron-shells, ions, atomic-number, chemical-bonding-intro, ionic-bonding, covalent-bonding, noble-gases | 2-8-8 shells, octet stability, ions by losing/gaining electrons, ionic transfer vs covalent sharing. |
| 5 + 11 — כוחות, אנרגיה | friction, gravity-weight, newtons-laws, energy-intro, energy-transformations, force-vs-energy | Potential ↔ kinetic, conservation with friction losses to heat, work adds energy. |
| 7 — מערכות גוף | homeostasis (+ respiratory, circulatory in the hub) | Feedback loops: temperature, water balance, O₂/CO₂. |

## What the map showed

Explorer at http://127.0.0.1:3000 (built-in browser), full **73,466-game** export. Seed originality percentiles read from the inspector: **Osmos 90.1%**, **Superliminal 85.0%**, **Gunpoint 83.9%**, Opus Magnum 63.2%, Viewfinder 62.0%, Infinifactory 61.4%, Beasts of Maravilla Island 42.6%, TOEM 23.1%, Sokobond 22.3%, Mini Metro 20.2%, Monaco 17.9%, Mini Motorways 14.9% (closest twin Hexarium 0.808).

25 blends measured with the map's own blend code ([`measure-pairs.py`](measure-pairs.py), same metrics as earlier rounds). Full table: [`pair-evidence.csv`](pair-evidence.csv) / [`pair-evidence.json`](pair-evidence.json). Lower **density** (mean similarity of the 50 nearest games to the blend point) = emptier region.

| Blend (seeds) | Related | Density ↓ | Idea |
|---|:-:|---:|---|
| **de Blob × Opus Magnum** | ✓ | **0.640** | #3 pH Rangers |
| Session: Skate Sim × Kerbal Space Program | ✓ | 0.644 | #5 Halfpipe Joule |
| **Gunpoint × Monaco** | ✓ | **0.657** | #2 Short Circuit |
| Katamari × Sokobond | ✓ | 0.662 | (Octet alt. — dropped: Clumpus is already Katamari) |
| Niche × Plague Inc: Evolved | ✓ | 0.668 | #9 Wild Balance |
| Inertial Drift × Kerbal | ✓ | 0.671 | #8 Newton Kart |
| **Mini Metro × Infinifactory** | ✓ | **0.675** | #1 Clean Flow |
| Mini Motorways × Opus Magnum | ✓ | 0.680 | #1 Clean Flow (alt.) |
| TOEM × Superliminal | ✓ | 0.698 | #7 Nano Snap |
| Osmos × Sokobond | ✓ | 0.699 | #4 Octet |
| FTL × Plague Inc: Evolved | ✓ | 0.718 | #6 Body Crew |
| Contraption Maker × Opus Magnum | ✓ | 0.735 | #10 Energy Chain |
| Teardown × Opus Magnum | ✓ | 0.751 | (alkali-metal demolition — dropped, Teardown already used by Storm Proof) |
| de Blob × PowerWash, Descenders × Kerbal, OlliOlli × Contraption Maker, TOEM × Papers Please | ✗ | — | failed relatedness |

Measured evidence only: G1 is still pending, no optimizer ran, no store page was embedded, nothing here certifies originality. Science chemistry/physics shelves on Steam are thin; no seed neighborhood makes pH, circuit laws or separation order the deciding action of a mainstream-feeling game.

## The ten ideas

Scores 1–5. **Fun**: proven moment-to-moment loop. **Learn**: remove the science and the decisions break. **3D**: space matters. **Build**: a polished 6–10 minute browser slice is realistic. **Gap**: from density. **Distinct**: differs from the eight games already running.

| # | Idea | Workbook | Fun | Learn | 3D | Build | Gap | Distinct | Total |
|---|---|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| 1 | **Clean Flow — זרם נקי** | ch3 classification + separation | 5 | 5 | 4 | 4 | 3 | 4 | **25** |
| 2 | **Short Circuit — קצר** | ch4 circuits, Ohm, safety | 5 | 5 | 4 | 4 | 4 | 5 | **27** |
| 3 | **pH Rangers — סיירת ה-pH** | ch10 pH, indicators, neutralization | 5 | 5 | 5 | 4 | 5 | 4 | **28** |
| 4 | Octet — אוקטט | ch1+9 shells, ions, bonds | 4 | 5 | 4 | 4 | 3 | 4 | 24 |
| 5 | Halfpipe Joule — ג'ול ברמפה | ch11+5 energy conservation, friction | 5 | 4 | 5 | 3 | 5 | 2 | 24 |
| 6 | Body Crew — צוות הגוף | ch7 homeostasis, systems | 5 | 4 | 3 | 3 | 2 | 5 | 22 |
| 7 | Nano Snap — צילום ננו | ch3 classification | 4 | 5 | 5 | 4 | 3 | 2 | 23 |
| 8 | Newton Kart | ch5 friction, F=ma | 5 | 3 | 5 | 3 | 4 | 3 | 23 |
| 9 | Wild Balance | ch8 food webs, 10% rule | 3 | 5 | 3 | 3 | 4 | 4 | 22 |
| 10 | Energy Chain | ch11 transformations | 3 | 4 | 4 | 4 | 2 | 3 | 20 |

### 1. Clean Flow — זרם נקי (build)
Mini Metro × Infinifactory (Mini Motorways × Opus Magnum as alt.). A real-time flow-routing puzzle on a 3D terraced valley. Springs, mines, the sea and factory drains pump **mixture streams** through glass pipes where you can literally see the particles riding along. Towns and workshops demand pure products: the bakery wants salt, the foundry wants iron, the clinic wants distilled water, the print shop wants one pigment. You lay pipes and drop separation stations — magnet drum, filter, dissolving tank, separating funnel, evaporation pan, still, chromatography tower — and the order is the puzzle. Salt water through a filter comes out still salty (dissolved salt passes) and the town's order bubbles angrily; iron filings in a filter clog it; a "pure water" spring is a compound and needs no station at all. Demand rises Mini-Motorways-style until a backlog overflows. **Classification is the first move of every stream:** a particle lens shows whether it's one substance or several, and if several, whether they're evenly spread — exactly Workbook's step 1 for choosing a method. Covers both of the user's chemistry subjects in one loop, distinct from Matter Customs (desk inspection) and Reclaim Reef (stopped workshop).

### 2. Short Circuit — קצר (build)
Gunpoint × Monaco. Isometric 3D night heist through a tech museum. Your crew's gadget shows the wiring inside the walls; every camera, laser, lock and light is a load on a real circuit. Rewire panels to sneak through: a series alarm loop screams the instant any element opens, so you first bridge it in parallel and then cut; a branch of lights in parallel can be killed without touching the guard-room; a motor door needs enough current, so pick the battery and resistor (I = V/R); short the right line to pop a fuse and black out a corridor — but the blackout sends a guard to the fuse box. Found objects become conductors or insulators (coin, graphite pencil, rubber band, wet sponge). Learning is the lockpick.

### 3. pH Rangers — סיירת ה-pH (build)
de Blob × Opus Magnum (emptiest measured blend). Third-person sprayer game in a Galilee valley — orchards, beehives, a fish pond, a village. A chemical truck has spilled acid upstream and a lime quarry leaks dust downstream; contamination spreads with the rain and the slopes like fire. You carry a backpack tank with three valves (acid concentrate, base concentrate, water) and a universal-indicator mist that paints the world in its true colours. Spray to contain and neutralize: because pH is logarithmic, a pH-3 puddle needs ten times the base of a pH-4 one; overshoot and the meadow turns purple (now too basic); plain water only dilutes, slowly, and floods things. Phenolphthalein flares find hidden bases, litmus strips are quick but only say acid/base. Neutralization fizzes with heat and leaves salt. Fun of PowerWash-style spraying + firefighting pressure + a world that changes colour.

### 4. Octet — אוקטט (handoff, not started)
Osmos × Sokobond. You're an atom drifting in a 3D soup. Grab and shed electrons to complete your outer shell (2-8-8), become an ion, then bond: steal an electron from a sodium (ionic, you lock into a lattice) or share pairs with other non-metals (covalent, you form a molecule and steer together). Arena challenges ask for specific molecules or ions; noble gases ignore you. Momentum physics make it a skill game.

### 5. Halfpipe Joule — ג'ול ברמפה (handoff, not started)
Session: Skate Sim × Kerbal. Third-person skate park on a Tel Aviv promenade. An energy ring around your skater shows potential, kinetic and heat. You can't reach a ledge higher than your drop-in without pumping (doing work); rough concrete and sand bleed energy into heat. Lines and tricks are energy budgets. Convergence risk with Hypotenuse Rush (athletic traversal) — keep it a skate park with momentum, never grappling.

### 6. Body Crew — צוות הגוף (handoff, not started)
FTL × Plague Inc. Real-time-with-pause body management. The "ship" is a teenager on a desert hike drawn as a 3D cut-away of organ systems; you route blood flow, breathing rate, sweat and fuel while crises hit (heat, a sprint, dehydration, a big meal). Every action has a feedback cost — sweating cools but drains water. Homeostasis as an FTL crisis loop.

### 7. Nano Snap — צילום ננו
TOEM × Superliminal. On-rails photo safari through a kitchen at particle scale; a photo scores only if its framing proves the class (two kinds of units → mixture; a bonded unit → compound; uniform vs clumpy across the frame). Beautiful, but its central decision duplicates Matter Customs, which is already being built.

### 8. Newton Kart
Inertial Drift × Kerbal. Kart racing where mass, engine force and surface friction decide acceleration and grip. Fun, but racing feel is hard to nail in the browser and the curriculum depth is thinner.

### 9. Wild Balance
Niche × Plague Inc. Shape a Negev oasis food web; energy pyramid 10%, population dynamics, invasive species. Strong biology, slower fun.

### 10. Energy Chain
Contraption Maker × Opus Magnum. Rube-Goldberg energy-transformation puzzles with losses. Solid, but crowded and close to Storm Proof's build-then-test loop.

## The three builds — why these

| | Clean Flow | Short Circuit | pH Rangers |
|---|---|---|---|
| Core verbs (no theme) | route, place, reorder, inspect flow, triage | sneak, inspect hidden layer, rewire, time | aim, spray, mix, survey, contain |
| Time / input | real-time with pause, mouse/touch drag | real-time stealth with planning pauses, keyboard/touch | real-time third-person action, WASD + aim / touch |
| Central decision | which kind of mixture is this and in which order to separate it? | which circuit change does what I need without tripping anything? | how much of what, and where, before it spreads? |
| Science | classification + separation methods (ch3) | circuits, Ohm's law, series/parallel, safety (ch4) | pH, indicators, neutralization, dilution (ch10) |
| Camera / art | tilted strategic diorama, glass pipes, dusk desert-teal | isometric cut-away museum at night, neon wiring X-ray | chase camera in a sunny Galilee valley, indicator-colour washes |

They differ from each other and from the eight running games in loop, input, camera and look. None is a courier/retrieval loop. Convergence watch: Clean Flow vs Ringwarden (both strategic camera) — Clean Flow has no enemies or coverage circles, only flow; pH Rangers vs Percent Pulse (both real-time action) — pH Rangers has no combat or damage numbers, only spreading terrain state; Short Circuit vs Equal & Opposite (both deliberate) — Short Circuit is spatial stealth, never cards.

Ideas 4–6 have full handoffs too, ready to start as a second wave. Builder handoffs: [`handoffs/science-claude-2026-10-25/`](../../handoffs/science-claude-2026-10-25/COMMON.md). Fun and learning are hypotheses until students play.
