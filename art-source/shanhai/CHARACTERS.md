# Original 山海都市岛 characters

These original procedural characters were generated specifically for this project. No third-party artwork, textures, or geometry were used. No separate third-party license is granted.

- **Coral courier:** warm coral cap and jacket, cream cuffs, gold mail badge, diagonal satchel strap, leather-tone mail satchel, rounded dark trousers and coral shoes.
- **Teal botanist:** asymmetrical hair bun and leaf clip, teal jacket, cream apron with pocket and trowel, backpack with seedling, teal shoes.

Both are fully three-dimensional geometry with readable modeled faces, ears, layered hair, articulated hands/limbs, shoe soles and laces. They use a small shared palette of rough PBR materials and require no external textures.

## Reproduce

From the project root run:

`blender -b --python scripts/art/create_shanhai_characters.py`

Built and tested with Blender 4.3.2. The script saves both GLBs, the manifest, a source `.blend`, and a studio render. Cycles denoising is disabled to support Blender builds without OpenImageDenoise. The source file presents both characters side-by-side; each exported character is centered independently.

## Runtime interface

Load `public/shanhai/models/character-courier.glb` or `character-botanist.glb` with Three.js GLTFLoader. Forward is +Z, up +Y, soles rest at Y=0. Courier height is 1.700 m; botanist is approximately 1.771 m. Retain the complete imported hierarchy when cloning.

Each GLB includes named clips `idle` (2.4s), `walk` (0.8s), `celebrate` (1.6s), and `disappointed` (1.8s). Play through Three.js AnimationMixer. These are actual object-transform animation tracks, not skinned animations or application-only placeholder motion. All clips return to their initial pose and are safe to loop; celebration and disappointment may also be played once.

Use the wrapper/scene root for world movement and facing; leave the named internal body and limb nodes controlled by the mixer. Nodes have character-specific prefixes and consistent suffixes: `root`, `body`, `head`, `arm_L`, `arm_R`, `leg_L`, `leg_R`.

## Verification

`public/shanhai/models/characters-manifest.json` reports geometry, bounds, and exact clip durations. `character-validation.json` records parsed GLB animation accessor checks: every clip has changing animation channels, and first/last keyframes match to floating-point precision. `characters-preview.png` was visually inspected for geometry, faces, palette, and silhouette.

Courier: 15,608 triangles; original source has 67 meshes.
Botanist: 16,992 triangles; original source has 75 meshes.

## Completed draw-call optimization

Run `python scripts/art/optimize_shanhai_characters.py` after the Blender generator. This requires NumPy and preserves source GLBs as `character-courier-unmerged.glb` and `character-botanist-unmerged.glb` under this art-source directory, outside public. Re-running optimization uses those original backups and is idempotent.

Static geometry is now merged by nearest animated ancestor and material. All node transforms and all four clips are preserved. Courier normal-pass calls decreased from 67 to 28; botanist from 75 to 27, a combined decrease of approximately 61%. Each runtime GLB contains six mesh islands; individual material primitives still require separate draw calls. Shadow passes can add calls. This is structural draw-call validation, not a GPU frame-time benchmark.

Every animation sampler was compared exactly with the original and is unchanged. Maximum world-space vertex difference from floating-point rebaking is under 3e-8 meters; triangle counts and material definitions are unchanged. `character-validation.json` records these checks. Both runtime GLBs were reimported into Blender and rendered for visual checking in `characters-optimized-preview.png`. Reproduce that render with `blender -b --python scripts/art/preview_optimized_characters.py`.

## 面部表情补充（2026-11-06）

基础建模/合并之后运行 `python3 scripts/art/create_shanhai_expressions.py`，再用 `blender -b --python scripts/art/render_shanhai_expressions.py` 更新九张表情头像。原中性几何与身体动画不变，三个面部形态存于运行GLB，可在Blender导入为形态键。源算法见 `scripts/art/shanhai_face_shapes.py`；验证见 `expression-validation.json`。全部来自项目原创基础角色，无外部素材。
