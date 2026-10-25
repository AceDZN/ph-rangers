# pH Rangers — סיירת ה-pH

A 3D browser game for Hebrew-speaking grade-8 science students (Israeli curriculum, per [Workbook](https://science.workbook.co.il/grade-8), chapter 10). de Blob meets firefighting, with chemistry in the tank: you're a ranger with a backpack sprayer (acid / base / water valves) and indicator gadgets, and you race spreading acid and alkaline spills across a Galilee valley. Guessing wastes tank, overshooting turns the meadow purple, and water only floods the problem downhill.

![Core spray gameplay](docs/captures/02-core-spray.png)

## Run

```bash
npm install
npm run dev        # http://127.0.0.1:5197 (strictPort)
npm test           # pH model, ledger, every mission solved by a bot, wrong strategies fail (~30 s)
npm run build      # static build in dist/ (relative base, works offline)
npm run preview    # http://127.0.0.1:4197
```

Add `?all` to the URL to unlock every mission, `?autopause=0` to stop auto-pausing when the tab is hidden (used by the capture script).

## Controls

| | Desktop | Touch |
|---|---|---|
| Move | WASD, Shift to sprint | left stick |
| Aim / look | click the game to capture the mouse, then the mouse turns the camera and the ground ring shows where the spray lands (Esc releases it and pauses). If the browser refuses mouse capture, the cursor aims and right-drag turns the camera. ←/→ turn, PgUp/PgDn tilt | drag on the right half |
| Spray | hold left click or Space; a quick tap = one small puff; the nozzle opens gradually for the first ⅓ s | spray button |
| Valve | 1 acid · 2 base · 3 water (or Q/E, mouse wheel, HUD buttons) | HUD buttons |
| Strength | X toggles ×1 / ×10 concentrate (when available) | tap the strength chip |
| Gadgets | R litmus · F phenolphthalein · G universal-indicator mist · T antacid canister | HUD buttons |
| Other | H hint · Esc pause · M mute · Enter continue/retry · music on/off on the title screen | pause button |

Refill by standing in the green ring at a supply wagon.

## What makes it play like a game

- **Spray feel:** a solid jet from the nozzle, droplets, a foamy splash where it lands, steam (heat) only while lots of acid/base reacts, wet ground when you flood it, footstep dust, FOV kick when sprinting.
- **Feedback:** every patch you bring back into its band pops with red anemones, sparkles, a rising chime, a floating `+points` and a combo counter (an overshoot breaks the combo, with a comic BOING). Score and best score per mission.
- **pH ruler** (bottom centre): the target band for the ground you aim at, what your indicators actually told you (litmus and phenolphthalein shade a *range*, universal indicator gives the number) and a dashed tick for where one more puff would land.
- **Guidance:** a goal-first objective line, off-screen arrows to endangered assets, to measured patches still out of band and to the nearest unmeasured grey ground, and to the wagon when the tank runs low; contamination left alone visibly wilts and spreads.
- **Pressure:** a visible acid-rain front with rain, a grey veil, dimming light and thunder; spreading creek water; assets whose fish, bees and bushes react.
- **Menus over the live valley:** title with mission cards and stars, mission briefs listing your tools, result cards with before→after pH chips (or the asset you lost, with a "retry with a hint" button), a start banner and jingle, darbuka music (day/night moods).

## What's implemented

- Six missions (see [CURRICULUM.md](CURRICULUM.md)): Lemon Spill (tutorial), Upstream Acid (×10 rule), Quarry Dust (phenolphthalein), Rina's Blueberries (different targets), Storm Front (acid rain + weak-base canisters), Night Spill (no-hint transfer in a different valley).
- Authoritative pure-TypeScript pH model ([src/sim](src/sim)): grid of zones with volume, signed H⁺/OH⁻ excess, salt, heat, weak base; creek flow, runoff, diffusion; conserved ledger; indicators per Workbook.
- Three.js scene: terrain with a live indicator wash driven by the grid, a flowing stone-lined creek and pond, rolling Galilee hills with villages and cypresses, clouds, soft bloom, and **20 Tripo models** (see [ASSETS.md](ASSETS.md)): the rigged ranger (idle, walk, run, spray, cheer, kneel), Rina the farmer (rigged: idle, wave, greet), tanker, hives, wagon, olive trees, houses, school, dry-stone walls, limestone rocks, blueberry bushes, cypresses, fish, lemon crate, lemons, anemones and daisies. Props that block the view fade out.
- Hebrew RTL HUD laid out after the ChatGPT gameplay mockups; synthesized WebAudio; reduced-motion and mute; pause on tab hide; lost-WebGL message; touch controls.
- Test hooks: `window.render_game_to_text()` and deterministic `window.advanceTime(ms)`.
- Learning events logged to `localStorage` only. No backend, accounts, analytics or runtime AI.

Not done: a slip animation, real playtests with students. See [progress.md](progress.md) and [PLAYTEST.md](PLAYTEST.md) for what was verified.

## Deploy to Vercel

Static site, no server code. In Vercel: import `AceDZN/ph-rangers`, framework preset **Vite**, build command `npm run build`, output directory `dist`. Or from a shell: `npx vercel --prod` in the repo root (choose the same settings). Not deployed yet.

## Docs

[GAME_IDENTITY.md](GAME_IDENTITY.md) · [CURRICULUM.md](CURRICULUM.md) · [ASSETS.md](ASSETS.md) · [docs/visual-targets/](docs/visual-targets/) · [docs/VISUAL_REVIEW.md](docs/VISUAL_REVIEW.md) · [PLAYTEST.md](PLAYTEST.md) · [progress.md](progress.md) · [docs/SCIENCE_REVIEW.md](docs/SCIENCE_REVIEW.md) · handoff: [docs/handoff/](docs/handoff/)
