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
