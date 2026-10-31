# No-addon survival preview v0.12

The user confirmed v0.9.11 joins their Realm. Their Realm has no behavior pack, and they report subsequent disconnects. Preserve v0.9.11 as the known join baseline and keep the permanent signing certificate B5D275706B574EEA53D6497A3A65542542B5DB0E0E57F4E307E8ED17CF24F995. Do not generate another key. The private key stays outside GitHub source.

New source is in v012-survival-overlay.tar.xz.b64, a portable xz tar overlay with 13 source/dependency/test files. Apply after the original v0.9.9 source/UI patches and before npm ci. It retains the exact prior join and pack wire fixes. The APK versionCode is 100002, above the permanent v0.9.11 baseline (100001).

## Try

- Rejoin Realm button, or `rejoin realm`: closes stale transport and starts one new connection with the existing private auth cache; no automatic login loop or forced refresh.
- `look around`: request nearby uncached terrain; report line-of-sight block samples and decoding errors.
- `inventory`, `survival status`, `view off`.
- `find oak logs`: locate nearby observed, visible matching blocks; no mining.
- `route to X Y Z`: preview A* route. Y is feet/block level, not camera height.
- `walk to X Y Z`: send normal player input along the route. Level ground only; no teleport, digging, jumping, swimming or climbing.
- `stop`: immediately cancel walking.
- `materials copper`, `about cobblestone`, `recipe stone pickaxe`.
- `plan get 8 torches`, `plan craft 1 diamond sword`: supply dependencies, inventory subtraction and batch rounding. Generic unambiguous recipes use version data; ambiguous metadata recipes remain reference-only.
- `plan build a small shelter with cobblestone`: 5x5 floor and roof, three-block walls, two-block doorway, 96-block estimate. `plan build a wall 3 by 2 with cobblestone` also works.

## Validation and limits

120 Node tests pass locally, including real 1.26.60 movement/subchunk packet serialization, signed-hash and mixed-palette terrain decoding, route detours and unknown/hazard rejection, server correction/low-health stops, inventory packets, saved-session manual rejoin, recipe recursion/batch accounting and refusal to send behavior-pack actions.

This is an initial survival foundation. Phone movement, terrain formats encountered in the live Realm, and whether regular auth-input ticks address the reported disconnect still require device testing. Do not claim walking or reconnection has been verified on a live Realm merely because tests/builds pass.

The registry contains 1,480 blocks, 2,080 items and 2,434 version-data recipes. Recognition is not execution capability. Crafting, mining, smelting, placement, combat, autonomous exploration and general job execution are NOT implemented. Supply/build plans are previews; `start plan` explains this and sends no fake world actions. The existing pack-only teleport/mining bridge is not used by the no-addon message controller.

Navigation refuses unobserved terrain, fluids, hazard-adjacent cells and nearby known hostiles. Routes are bounded and cancelled on terrain changes, significant server corrections, low health, disconnect or dimension changes. World perception consumes ordinary client packets and is not camera/screenshot vision.

Future work: verify live flat-ground walking first; then implement individually acknowledged survival inventory transactions, tools/durability and harvesting before promising complete autonomous jobs. Do not bypass server survival rules using Script API edits or teleporting.
