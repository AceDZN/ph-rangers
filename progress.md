# progress

Original prompt (the user's instruction to every builder, verbatim):

```
Don't forget to build it as real 3d fun games.
Before starting development - generate 'game screenshots' images (real gameplay images using gpt-image through the chatgpt webapp  https://chatgpt.com/ on my chrome browser ) - then use tripo 3d to generate models, create the game, then review it in front of the 'screenshots' to really build the same gameplay ui/ux as it is in the planning and  mockups.

use my chrome browser tripo.ai to create the 3d models ([https://studio.tripo3d.ai/workspace/generate/](https://studio.tripo3d.ai/workspace/generate/) ).
if the 3d model needs animation (like characters) - make sure to rig them in tripo (simple mixamo rigs for full body animation, more complicated rigs for stuff like rigging face animations - Tripo has many rigging options and pre-defined animation but also "ai animations" for custom stuff).

btw,create it as a new public repo on my github (AceDZN). I think that I'll deploy it to one of our vercel servers soon because its pretty fun.. you can use my chrome browser for that as well . don't forget to commit your changes from time to time all to the same main branch for now (or open prs for side-tracks)
```

Brief: [docs/handoff/BUILD_HANDOFF.md](docs/handoff/BUILD_HANDOFF.md), [docs/handoff/COMMON.md](docs/handoff/COMMON.md).

## Log (2026-10-25)

1. Wrote `GAME_IDENTITY.md`; visual helper generated 4 ChatGPT gameplay mockups (`docs/visual-targets/`) and 6 Tripo models (ranger image-to-3D + Auto Rig Mixamo, idle + run presets; truck, beehive, wagon, olive, house). See `ASSETS.md`.
2. Authoritative pH model in `src/sim/` (chem, valley layouts, grid sim, six missions, game state) with a scripted bot that plays through the same inputs; tuned until every intended solution wins and each advertised wrong approach fails (`tests/`).
3. Three.js game: terrain with a live indicator wash from the grid, creek/pond water, Tripo props, rigged ranger with procedural spray pose and wand, spray jet + droplets, steam, gadgets with arcs and bursts, litmus markers, blooms, fish/bees reacting to pH, night valley with glow and fireflies, Hebrew RTL HUD following the mockups, WebAudio, touch controls, pause/restart/results, `render_game_to_text` + `advanceTime`.
4. Real-input captures in `docs/captures/` via `scripts/capture.mjs`; comparison in `docs/VISUAL_REVIEW.md`.
5. Independent science review: `docs/SCIENCE_REVIEW.md` (fixes listed in PLAYTEST.md).

## Notes for whoever continues

- Session was interrupted once mid-build; the lost `src/sim/game.ts` was rewritten and the visual helper resumed. No work was lost from git.
- The Tripo budget was 6 models + 2 rig/animation jobs: used 6 models + 1 paid rig + 2 free preset animation retargets (counted literally that is 3 rig/animation operations). Credits: 245 by this crew (shared account).
- No spray clip: the spray pose is procedural (`aimBone` in `src/main.ts`).
- The Tripo house has two lavender fin artefacts on the roof (visible from some angles).

## TODO / ideas

- Celebrate/slip animations, a proper animated farmer NPC.
- Optional: wider spray (fan nozzle) for big patches.
