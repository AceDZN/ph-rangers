# ASSETS — pH Rangers

All 3D models were generated on **2026-10-25** with **Tripo Studio** (https://studio.tripo3d.ai/workspace/generate/) in the user's own signed-in Chrome session (user's Tripo account, existing credits only; no purchase, upgrade, API or other generator). Gameplay mockups are in `docs/visual-targets/` (see `docs/visual-targets/PROMPTS.md`).

**Licence / provenance:** generated with the user's Tripo account; use is subject to that account's Tripo terms. Privacy setting in Tripo was the account default ("Sharing Only"). Generated meshes are visual dressing only: never colliders, never scientific surfaces. Spray, colour washes, gauges and badges stay procedural and driven by the authoritative pH model.

## Budget used (this crew)

| # | Task | Kind | Credits shown on the button | Notes |
|---|------|------|----------------------------|-------|
| 1 | truck | text-to-3D (HD Model, H3.1) | 45 | |
| 2 | beehive | text-to-3D | 45 | balance 735 → 690 |
| 3 | wagon | text-to-3D | 45 | balance 690 → 645 |
| 4 | olive | text-to-3D | 30 (button read 30 right after submitting) | another crew had changed the account-wide saved settings to Ultra Mesh off / polycount 20 000 just before; olive and later tasks used those settings |
| 5 | ranger | image-to-3D | 30 | balance 305 → 275 |
| 6 | house | text-to-3D | 30 | balance 255 → 225 |
| R1 | ranger rig | Auto Rig, Humanoid, Mixamo preset | 20 | balance 275 → 255 |
| — | ranger idle + run | preset retargets ("Preset" tab) | 0 (balance unchanged at 225 before and after each) | |

Total spent by this crew: **245 credits** (6 model generations + 1 rig job; the two preset animation retargets showed no credit charge). The account is shared with other crews, so the balance also fell for reasons unrelated to this work (815 at start → 225 at the end). No AI-animation (20 credits) job was used.

Tripo saves Geometry & Texture settings per account. At the start this crew set Polycount to 30 000 (truck, beehive and wagon were generated with Ultra Mesh on, 2K texture, PBR, triangles, 30 000 target). Another crew later changed it to Ultra Mesh off / 20 000.

## Processing (all models)

Each GLB was exported from the Tripo UI (Export → GLB, texture resolution 1k), saved to a scratch folder as `phr-<name>-original.glb`, then:

```sh
# props
npx -y @gltf-transform/cli@4 optimize phr-<name>-original.glb public/models/<name>.glb \
  --texture-compress webp --texture-size 1024
# ranger (skinned + animated): no quantization/meshopt and no simplify
npx -y @gltf-transform/cli@4 optimize phr-ranger-original.glb public/models/ranger.glb \
  --compress false --simplify false --texture-compress webp --texture-size 1024
```

**Loader requirements:** the five props use `EXT_meshopt_compression` + `KHR_mesh_quantization` + `EXT_texture_webp` (all *required*), so three.js needs `gltfLoader.setMeshoptDecoder(MeshoptDecoder)` from `three/examples/jsm/libs/meshopt_decoder.module.js` (bundled locally, no CDN). `ranger.glb` only requires `EXT_texture_webp`.

Why the ranger is different: the default `optimize` (meshopt + quantization) produced a 512 KB ranger whose clips and skin survived, but quantization moved the skinned mesh's positions into the -1..1 range (`inspect` bbox became -0.60..0.60 × -1..1), with a node scale compensating for it. That is valid glTF but risky for bounds and picking on a SkinnedMesh, so the shipped ranger is unquantized (1.18 MB).

All models are normalized by Tripo: **Y up, base at y ≈ 0, largest dimension ≈ 1.0 unit**. Scale them in code.

## Models

### ranger.glb (hero, rigged and animated)

- Input: image-to-3D from an 820 × 941 portrait crop of `docs/visual-targets/ranger-reference-front.png` (ChatGPT front-view A-pose reference, prompt in PROMPTS.md). Crop: `sips -c 941 820 --cropOffset 0 426`.
- Tripo task: https://studio.tripo3d.ai/workspace/generate/57902099-654e-4f7a-b623-3ec65edf7c9b (rig: `/workspace/rigging/57902099-…`, animate: `/workspace/animate/57902099-…`)
- Mesh: 19 018 triangles, 12 095 vertices, 1 material (baseColor, normal, metallicRoughness; 1024² webp).
- Rig: Rigging Type **Humanoid**, Skeleton Preset **Mixamo**. 1 skin, 66 joints named `mixamorig:Hips`, `mixamorig:LeftUpLeg`, … (standard Mixamo names); root node `Armature`.
- Animations: Tripo **Preset** tab, presets `idle` and `run`. Exported with "Export Skeleton" on, "Number of Animations" 2 (both selected), "Animation stay in Place" **on** (no root motion: move the character in code).
- **Clips inside the GLB:** `run` (1.250 s, loop), `idle` (15.333 s). No spray/aim clip (would need another job; pose the spray arm procedurally, e.g. rotate `mixamorig:RightArm` / `RightForeArm`).
- Bounds (inspect, bind pose): min (-0.300, 0.000, -0.177), max (0.300, 1.000, 0.177). **Height 1.0 unit**, so scale ×~1.6–1.7 for a teen in metre units.
- Facing: **+Z** (glTF forward). Checked from geometry: the boot toes (lowest 4 % of height) sit at mean z = +0.072, ahead of the shins (z = +0.034); the tank is on the back (-Z). Arms in A-pose.
- The nozzle wand is modelled clipped at the right hip (attached to the mesh), not held. For the spray pose, add a small procedural nozzle at the right hand (`mixamorig:RightHand`) and drive the stream from there.
- Sizes: original 1 873 596 B → optimized 1 177 916 B.
- sha256 `8075d0e14807e6a760c62c5904c9c459dd84e51aec9da314a5b1cb9f27be958c`

### truck.glb (spill source)

- Prompt: "Stylized low-poly-friendly game prop: a small white and orange chemical tanker truck lying overturned on its side, cylindrical steel tank with hazard diamond sign and a dented valve, cab with rounded friendly shapes, chunky readable silhouette, clean hand-painted textures, Pixar-like stylized look for a kid-friendly 3D adventure game, single object, no ground, no puddle"
- Task: https://studio.tripo3d.ai/workspace/generate/6be97b62-2c4c-4a2d-ad25-4d66c31b729d
- Result: **upright, not overturned.** Tip it over in code (rotate ~90° about its long X axis and drop it to the ground).
- 27 054 triangles in Tripo; the optimizer's simplify brought it to 26 630.
- Bounds: (-0.489, 0, -0.240) → (0.489, 0.540, 0.240); long axis = X.
- Sizes: 1 332 656 B → 342 208 B. sha256 `9e2882868cb93957c0b5b74cc5eb1bfc81b212a8631bbd57032e0012b6194035`

### beehive.glb (hive cluster on a pallet)

- Prompt: "Stylized game prop: a cluster of three wooden beehive boxes (Langstroth style) standing on a low wooden pallet, painted in faded pastel colours (sky blue, butter yellow, white), stacked boxes with lids and small entrance slots, a few cartoon bees, chunky readable shapes, clean hand-painted textures, Pixar-like stylized look for a kid-friendly 3D adventure game, single object, no ground"
- Task: https://studio.tripo3d.ai/workspace/generate/0057d5a4-8521-4806-b3ae-8df9e398ad72
- 26 908 triangles in Tripo. The result is a pallet holding two stacks (blue/white and blue/yellow/white). Bees are tiny bumps, so add particle bees in code.
- Bounds: (-0.399, 0, -0.319) → (0.399, 0.978, 0.319).
- Sizes: 1 352 252 B → 346 256 B. sha256 `04b86e01ca111ace13a199ddad7730fb7e839374dc247c5cb6259e1a3224da02`

### wagon.glb (refill station)

- Prompt: "Stylized game prop: a small wooden two-wheeled supply wagon / refill cart carrying three upright pressurized canisters with coloured caps (red, blue, cyan) and a coiled hose with a refill nozzle, a little canvas awning, a crate of litmus paper rolls, chunky readable silhouette, clean hand-painted textures, Pixar-like stylized look for a kid-friendly 3D adventure game, single object, no ground, no horse"
- Task: https://studio.tripo3d.ai/workspace/generate/06151178-5adc-4641-aa9d-859c1fb5872b
- 27 704 triangles in Tripo. It came out as a wooden cart with large spoked wheels, red/blue/cyan canisters, a hose and a canvas awning.
- Bounds: (-0.490, 0, -0.265) → (0.490, 0.953, 0.266); long axis = X.
- Sizes: 1 473 808 B → 394 824 B. sha256 `8436bad364dfeb556f009d2480c489157ceac966312652435224d802391a095f`

### olive.glb (orchard tree)

- Prompt: "Stylized game-ready olive tree for a sunny Mediterranean (Galilee) valley: short gnarled twisted grey-brown trunk splitting into a few branches, a rounded clumpy canopy of sage-green / silver-green leaf clusters with a few small dark olives, chunky low-poly-ish stylized shapes, hand-painted textures, Pixar-like stylized look for a kid-friendly 3D adventure game, single tree, no ground, no pot"
- Task: https://studio.tripo3d.ai/workspace/generate/cf63a88e-5fc4-4735-90da-d2e7712d043d
- 19 391 triangles in Tripo. Use instancing for orchard rows.
- Bounds: (-0.5, 0, -0.391) → (0.5, 0.961, 0.391).
- Sizes: 1 326 120 B → 350 388 B. sha256 `41214f212ecdc3a603fe7eb277d3c4bb9b6510a3bd27239545b438f63ef3099f`

### house.glb (Galilee village stone house)

- Prompt: "Stylized game prop: a small old Galilee village stone house, one storey, built from pale cream and honey limestone blocks, flat roof with a low parapet and a small rooftop water tank, an arched turquoise wooden door, two small arched windows with blue shutters, a potted geranium and a little grapevine over the door, chunky readable silhouette, clean hand-painted textures, Pixar-like stylized look for a kid-friendly 3D adventure game, single building, no ground"
- Task: https://studio.tripo3d.ai/workspace/generate/4775b95d-3e47-4e4d-a8f4-fe5c6dffcdef
- 19 369 triangles in Tripo. It is roughly a cube. Two lavender cloth/flag-like fins stick up at the roof corners (generation artefact); hide them with distance/camera or accept them.
- Bounds: (-0.497, 0, -0.5) → (0.497, 0.905, 0.5).
- Sizes: 1 054 740 B → 262 152 B. sha256 `cf93abc5cebad4bd49958f7b6c1c2541a1e90a0085c82ee4b187bfe886e5dd00`

## Not made

- Spray/aim, celebrate and slip clips for the ranger were skipped to stay within the job limit. Pose them procedurally.
- No separate backpack-sprayer model (it is part of the ranger mesh), no pond-rock edge, no farmer NPC.

---

## Round 2 (2026-10-25, afternoon): more models, Rina, more ranger clips

Same rules and tooling as round 1: Tripo Studio in the user's signed-in Chrome, existing credits only, no purchase/upgrade/API/other generator. All tasks are text-to-3D, **HD Model, H3.1, 2K texture, PBR, triangles, Ultra Mesh off**. Polycount was set per batch (account-wide setting): **5 000** for instanced props (wall-high, rocks, bush, cypress), **6 000** for the long wall, **15 000** for school / fish / house, **20 000** for Rina. Every generation showed **30 credits** on the button, the rig **20**, preset animation retargets **0** (balance unchanged before/after each).

### Budget (this crew, round 2)

| Item | Task | Credits |
|---|---|---|
| farmer (Rina) | https://studio.tripo3d.ai/workspace/generate/45ea12b1-5c01-4f53-8afe-65183a19bbab | 30 |
| Rina rig (Humanoid, Mixamo) | https://studio.tripo3d.ai/workspace/rigging/45ea12b1-5c01-4f53-8afe-65183a19bbab | 20 |
| Rina presets idle, wave_goodbye_01, greet_04, wave_goodbye_02 | /workspace/animate/45ea12b1-… | 0 |
| ranger presets walk, cheer, shoot, fire (on the round-1 rig) | /workspace/animate/57902099-654e-4f7a-b623-3ec65edf7c9b | 0 |
| wall-high (square panel) | https://studio.tripo3d.ai/workspace/generate/00a27101-c612-48d7-8e20-2603dfe560ad | 30 |
| wall (long, shipped as wall.glb) | https://studio.tripo3d.ai/workspace/generate/0ea89e74-d2cf-4a7b-b1d5-31137315a24b | 30 |
| rocks | https://studio.tripo3d.ai/workspace/generate/a72bffe2-e082-4542-8e78-81e2437963f3 | 30 |
| bush | https://studio.tripo3d.ai/workspace/generate/59ec3978-801a-4b00-8fa6-6081e53857cd | 30 |
| cypress | https://studio.tripo3d.ai/workspace/generate/0758e7c2-13d5-490b-9a2f-fcd318dac973 | 30 |
| school | https://studio.tripo3d.ai/workspace/generate/a8878565-a61f-4102-b680-cc21be6a71bf | 30 |
| fish | https://studio.tripo3d.ai/workspace/generate/9f7e3fba-ddfd-44cb-8094-a3bda080f071 | 30 |
| house (regenerated) | https://studio.tripo3d.ai/workspace/generate/36e90e5a-1cd3-44df-a308-74347b1890ab | 30 |

**Round 2 total: 290 credits** (9 generations × 30 + 1 rig × 20). Account balance was 9 105 when this round started and 8 365 when it ended; other crews were generating on the same account at the same time, so the difference (740) is not all ours.

### Processing (round 2)

Originals (Tripo Export → GLB, texture 1k) are kept in the session scratchpad `originals2/phr2-<name>-original.glb`.

```sh
# instanced props: 512 textures
npx -y @gltf-transform/cli@4 optimize phr2-<wall-long|rocks|bush|cypress|wall>-original.glb public/models/<name>.glb \
  --texture-compress webp --texture-size 512
# school, fish, house: 1024 textures
npx -y @gltf-transform/cli@4 optimize phr2-<name>-original.glb public/models/<name>.glb \
  --texture-compress webp --texture-size 1024
# characters: no quantization / meshopt / simplify, skin kept
npx -y @gltf-transform/cli@4 optimize phr2-ranger6-renamed.glb public/models/ranger.glb \
  --compress false --simplify false --texture-compress webp --texture-size 1024
npx -y @gltf-transform/cli@4 optimize phr2-farmer-original.glb public/models/farmer.glb \
  --compress false --simplify false --texture-compress webp --texture-size 1024
```

Props need `EXT_meshopt_compression` + `KHR_mesh_quantization` + `EXT_texture_webp` (same as round 1, MeshoptDecoder already set in `src/render/models.ts`). `ranger.glb` and `farmer.glb` need only `EXT_texture_webp`.

All models: **Y up, base at y ≈ 0, largest dimension = 1.0**. Bounds below are from `gltf-transform inspect` of the shipped files.

### ranger.glb (replaced; round-1 file backed up as scratchpad `originals2/ranger-round1-backup.glb`)

- Same mesh and rig as round 1 (19 018 tris, 1 skin, 66 `mixamorig:*` joints, root `Armature`). Exported with Export Skeleton on, 6 animations, **Animation stay in Place on**.
- Clip renames were done with a small `@gltf-transform/core` script before optimizing, so the existing name matching in `models.ts` picks them up correctly:
  - Tripo preset **`fire` → `spray`**: a static two-hand hold at chest height, hands pushed forward (+Z). Use it as the spray/aim pose (looped, or as an upper-body layer).
  - Tripo preset **`shoot` → `kneel`**: despite the name it is a crouch (hips drop 0.47 → 0.20) with hands forward at chest; good for "kneel and test the soil". Renamed so the loader does **not** map it to `spray`.
- **Clips inside the GLB:** `run` 1.250 s, `walk` 2.333 s, `spray` 1.500 s, `idle` 15.333 s, `cheer` 12.083 s, `kneel` 9.042 s. (`cheer` maps to `celebrate` in the loader.)
- Known quirk (also in round 1): the `run` clip carries a constant root offset. Hips sit at z ≈ +0.58 (vs +0.05 in idle) and y ≈ 0.48. Scaled ×1.7 that pushes the running body ~0.9 m forward of the object origin. Counter-offset the model in code while running, or zero the Hips z translation track on load.
- Bounds (bind pose): (-0.300, 0, -0.177) → (0.300, 1.0, 0.177). Facing **+Z**.
- Sizes: original 2 429 556 B → 1 740 524 B. sha256 `d37881bc498899fb8a106bab3690d2f3673a1b0da94320748fe29cff3d3bae98`

### farmer.glb (Rina, new)

- Prompt: "Stylized 3D game character, full body: Rina, a friendly middle-aged woman farmer from a Galilee village, warm smile, sun-tanned skin, dark hair in a low bun under a wide woven straw hat, purple short-sleeved work shirt, khaki work trousers with pockets, brown leather work boots, small canvas apron, standing in T-pose, Pixar-like stylized proportions, clean hand-painted textures, kid-friendly adventure game, single character, no ground, no props in hands" (Tripo "T-Pose" toggle on).
- Result: straw hat, purple shirt under a tan vest, canvas apron, khaki trousers, brown boots, T-pose. 19 032 tris, 11 538 verts.
- Rig: Humanoid, Mixamo preset. 1 skin, **65 joints** (`mixamorig:*`).
- **Clips inside the GLB:** `wave_goodbye_02` 5.875 s (standing; right hand rises to wave in the last ~1.5 s), `idle` 15.333 s, `greet_04` 2.792 s (hand-to-brow / salute-style greeting). Animation stay in Place on. `wave_goodbye_01` was also retargeted but left out: it is a seated wave.
- `models.ts` `farmer()` plays the first clip containing "wave", so `wave_goodbye_02` loops by default. Consider idle with wave/greet as one-shots.
- Bounds (bind pose, T-pose arms): (-0.465, 0, -0.161) → (0.465, 1.0, 0.161). Height = 1.0, so `normalize(…, 1.65)` is right. Facing **+Z** (Mixamo convention; the greet reach goes to +Z).
- Sizes: original 1 921 624 B → 1 257 868 B. sha256 `473d577de433cdfb0688f6c3b38e3786d1554673c259d2e43030abdee5def936`

### wall.glb (long dry-stone field wall)

- Prompt: "Stylized game prop: a long low straight section of an old Galilee dry-stone field wall, very wide and short, about four meters long and only knee-to-hip high, three to four uneven courses of stacked rounded pale cream and warm grey limestone stones without mortar, irregular bumpy top edge with a few capstones, small tufts of dry grass in the gaps, seen from the side, chunky readable shapes, clean hand-painted textures, Pixar-like stylized look for a kid-friendly 3D adventure game, single object, no ground"
- 5 891 tris in Tripo (5 861 shipped). Five courses of rounded blocks, cream to honey-yellow (slightly yellower than the mockup; tint toward grey-cream if needed).
- Bounds: (-0.5, 0, -0.098) → (0.5, 0.325, 0.098). **Long axis X**, about 3 : 1 length : height. Scale ×3 for a ~3 m × 1 m wall, or use `meshOf('wall', 0.8)` (length ≈ 2.46 m) and tile along X.
- Sizes: 847 792 B → 124 124 B. sha256 `c144d08752d33aa25cf4b6f93a41e90dab144e9960f473086f987e4296fb764f`

### wall-high.glb (square terrace-wall panel, extra)

- Prompt: "Stylized game prop: a straight segment of a traditional Galilee dry-stone terrace wall, about four times longer than it is tall, built from stacked rounded pale cream and warm grey limestone blocks of varied sizes without mortar, a few small tufts of grass and moss in the gaps, flat-ish top, chunky readable shapes, clean hand-painted textures, Pixar-like stylized look for a kid-friendly 3D adventure game, single object, no ground". Tripo ignored the proportion and made a nearly square panel. The stone colours are nicer and more limestone-like than the long wall.
- 4 616 tris. Bounds (-0.5, 0, -0.246) → (0.5, 0.911, 0.246). Good for a tall terrace retaining wall, or squash in Y to about 0.5.
- Sizes: 795 444 B → 110 336 B. sha256 `f4a70222dfb08915d98443d32c20aca3360752480d9915ce12499d91a7d12fff`

### rocks.glb (limestone boulder cluster)

- Prompt: "Stylized game prop: a small cluster of three pale cream limestone boulders of different sizes huddled together, one large rounded rock, one medium and one small, soft weathered edges with subtle cracks and pits, a little moss and dry grass at the base, chunky readable shapes, clean hand-painted textures, warm sunny Mediterranean Galilee look, Pixar-like stylized look for a kid-friendly 3D adventure game, single object, no ground"
- Result: four cream boulders (big, medium, two small) with dry-grass tufts. 4 714 tris (4 666 shipped).
- Bounds: (-0.5, 0, -0.413) → (0.5, 0.603, 0.413). Rotate randomly about Y when instancing.
- Sizes: 676 536 B → 96 452 B. sha256 `90e3db7896bcdd1a6995b405eba78463b2ddf3831b5900d768af38c1068a2e00`

### bush.glb (blueberry bush)

- Prompt: "Stylized game prop: a knee-high round blueberry bush, dense clumps of small glossy green leaves on thin woody stems, many clusters of plump dusty-blue blueberries clearly visible all over the outside, a few leaves turning red, chunky readable silhouette, clean hand-painted textures, Pixar-like stylized look for a kid-friendly 3D adventure game, single plant, no pot, no ground"
- Result: a round leafy crown packed with big blue berries on a short brown trunk (a little "lollipop"; sink the base ~15 % into the ground or let the grass hide the trunk). 4 784 tris (4 766 shipped).
- Bounds: (-0.5, 0, -0.327) → (0.5, 0.991, 0.327).
- Sizes: 1 096 632 B → 172 344 B. sha256 `d8e3ab9ad2ced9b7db635e599287a173cf368ee202dd90dedd583a065ede147a`

### cypress.glb (Mediterranean cypress)

- Prompt: "Stylized game-ready Mediterranean cypress tree (Cupressus sempervirens) for a sunny Galilee valley: very tall and narrow columnar flame-shaped evergreen, dense dark green foliage in soft stylized clumps tapering to a pointed top, a short brown trunk visible at the base, chunky readable silhouette, clean hand-painted textures, Pixar-like stylized look for a kid-friendly 3D adventure game, single tree, no pot, no ground"
- 4 795 tris (4 783 shipped). Narrow flame shape, short visible trunk.
- Bounds: (-0.138, 0, -0.134) → (0.138, 1.0, 0.134). Height is the largest dimension. Scale to 6–9 m.
- Sizes: 909 836 B → 138 176 B. sha256 `3e26bcea23fa496a8636bc54fe50622a2a8a676f8a573bdafbba086f76282ef2`

### school.glb (village school)

- Prompt: "Stylized game prop: a small village primary school building in the Galilee, one storey, built from warm cream and honey limestone blocks, red clay tile roof, a row of three tall arched windows with white frames, an arched double front door in turquoise wood with two steps, a small bell or clock above the door, a white flag pole with a blue and white flag at the corner, a few potted plants by the door, chunky readable silhouette, clean hand-painted textures, Pixar-like stylized look for a kid-friendly 3D adventure game, single building, no ground, no text"
- Result: honey-limestone gable house with red tile roof, school bell in the gable, two arched windows, turquoise arched door, two potted plants, and a flag pole with a plain blue flag on the roof ridge. 14 064 tris (13 920 shipped).
- Bounds: (-0.5, 0, -0.412) → (0.5, 0.892, 0.412). Front (door) faces **+Z**.
- Sizes: 973 672 B → 245 212 B. sha256 `e59c207792df1bc35e1b512a7ac67f8b29059db8fe844afd088fffe2598b0edb`

### fish.glb (tilapia / St. Peter's fish)

- Prompt: "Stylized cartoon fish for a kid-friendly 3D adventure game: a cute plump freshwater tilapia (St. Peter's fish from the Sea of Galilee), side view swimming pose, silver-grey body with soft blue-green sheen and faint vertical stripes, big friendly round eyes, rounded fins and a fan tail, simple clean shapes, clean hand-painted textures, Pixar-like stylized look, single fish, no water, no ground, no stand"
- Result: chubby blue-silver fish with big eyes and a spiky dorsal fin. 14 954 tris (14 678 shipped).
- Bounds: (-0.5, 0, -0.272) → (0.5, 0.639, 0.272). **Head points +X** (tail at −X: the thin, flat end in the geometry slab check). Rotate −90° about Y to face +Z. Origin is at the belly (y = 0), not the centre.
- Sizes: 914 080 B → 221 876 B. sha256 `5fe09a64058393a80482594e021c19e48695867beeac2b3bea6981714a8d0441`

### house.glb (replaced; round-1 file backed up as scratchpad `originals2/house-round1-backup.glb`)

- Prompt: the round-1 house prompt plus "… a grapevine on a wooden pergola over the door …, no flags, no cloth, nothing sticking up from the roof corners".
- Result: limestone-block house with a parapet roof, a domed rooftop water tank, a turquoise arched door, a blue-shuttered window, a red geranium pot, and a vine-covered pergola beam. **No lavender roof fins.** 14 142 tris (13 956 shipped).
- Bounds: (-0.5, 0, -0.444) → (0.5, 0.808, 0.444). Front faces **+Z**.
- Sizes: 954 800 B → 241 364 B. sha256 `30f579f196f2a743719f9c2ad8016b17ecbbccfdf3e15f22e027bdff1e9dd644`

### Verified vs not verified (round 2)

- Verified: every shipped file reads with gltf-transform (bounds, triangle counts, required extensions and texture sizes from `inspect`). Clip names and durations come from the shipped GLBs. Joint counts were checked, and hand/hips world positions were sampled with forward kinematics at 0/25/50/75 % of each clip. Each prop was checked by eye in the Tripo viewer before export.
- Not verified: rendering inside the game (three.js loading and the look under the game's lighting). Facing for the buildings and fish was inferred from geometry (where the detail and the thin tail are); for the characters it comes from the Mixamo convention plus the forward reach in the clips.
