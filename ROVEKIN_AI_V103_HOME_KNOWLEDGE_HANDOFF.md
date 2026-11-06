# Rovekin v1.0.3 — on-device reasoning and home memory

**Canonical development branch:** `fix/rovekin-v103-persistent-home-decision-engine-20261106`

**Android:** `com.rovekin.companion` · `versionCode 200081` · `1.0.3-rovekin-permanent-home`.
**Status:** source implemented; targeted Node regression and Android preflight passed. **NOT a permanently signed installable APK yet.** Do not hand the unsigned APK to the phone user.

## Implemented changes

1. **Permanent first home.** New private per-Realm atomic record `src/survival/permanent-home.js`. Owner-verified original 50×50×50 plot + original design are saved once, hashed by selected Realm ID. Commands to gift land, start a new home field trial, redesign the original home, or make another home do not silently move it. An invalid/corrupted saved file is preserved rather than overwritten. Storage is **inside the Android bot app private files**, not GitHub or the public update feed.
2. **Resume safely, not by fiction.** Save only actually server-confirmed construction stage index; on reconnect/restart re-read actual blocks of all prior stages. If unknown, wait for terrain. If mismatch, pause without mining/replacing any historic construction. If prior work verified, resume only the next unfinished stage when in the same Realm/dimension with actual build permission. Manual STOP persists an explicit hold until the owner says "resume home"; socket interruptions do not erase the home.
3. **Improved material understanding.** Both `mine oak logs 200` and `mine 200 oak logs` now become the same bounded internal resource goal. Inventory, mining, pickup, and quantity-completion still require authoritative server observations. No promise that all 200 logs can yet be harvested autonomously.
4. **Ground-cover awareness.** Observed `leaf_litter` is removable as simple ground cover within the owner's assigned plot if not within three blocks of a protected structure. Real signs, tree canopy, custom blocks, hazards and solid building materials retain stricter permissions. No broad terrain demolition grant.
5. **Construction authorization.** Fixed the two-backslash regex that previously rejected real six-digit `confirm home proximity NNNNNN` commands.
6. **Reconnection diagnostics.** The recessed Android reconnect control now attempts to save the existing sanitized all-in-one ZIP into `Downloads/Rovekin` on Android 10+, then independently requests rejoin. Older Android versions use the system document save picker. Existing START remains a reconnect command, not a diagnostic trigger. Permanent signing identity unchanged.

## Verified source tests

- [Full Node + native Android preflight](https://github.com/timmytwopointoh/New-game-/actions/runs/42271599789): **success**, release APK compiled as an **unsigned** artifact from a previous v1.0.3 commit.
- [Final knowledge and home regression tests](https://github.com/timmytwopointoh/New-game-/actions/runs/42272142245): **60/60 pass**; includes latest ground-cover improvement, home lock, progress, resource-language, session-retention, Follow, respawn.
- No live Minecraft Realm/device session was tested for this v1.0.3 source through the PC emulator. CI cannot confirm real movement or mining success.

## Important caveats

- The installed **v1.0.2** app did **not** save a permanent home record. The new version cannot reconstruct its exact old home center safely from an obsolete session; the owner will need to give **one fresh verified home invitation after installing the eventual signed v1.0.3**, then that location locks. Do not infer the home center from screenshots of a nearby leaf_litter block.
- Known legacy dirt-staircase regression tests still fail; don't announce guaranteed climbing or full autonomous building.
- Rovekin has an on-device bounded command/experience learner, **not an unrestricted neural LLM**. Learning is gated by actual server-confirmed outcomes; planning or chat acceptance is not task completion.
- Use the original permanent private Rovekin key in `timmytwopointoh/Trion-Assistant-Lab` for any *install-over* update; never upload or copy the key/password into this public repository. Before publishing verify the APK certificate against v1.0.2 and keep `versionCode 200081`.
- The original Realm AI app, older Rovekin v1.0.2 installed app, live sessions, and other source branches are untouched.

## Next acceptance tests (on actual phone and Realm)

1. Grant exactly one new home while standing on the real owner location; restart Android and reconnect; `home status` must show exact same coordinates and not accept another plot.
2. Start a house stage, verify real block placement, disconnect, rejoin. The builder must inspect the existing blocks and resume at the next correct stage; if old stages are missing, it must pause.
3. `mine oak logs 200` starts a bounded observation-driven resource task instead of unsupported-action response. Confirm real first break and inventory pickup before any claimed progress.
4. Confirm leaf_litter removal within a safe plot and protected-building refusal close to a sign/house.
5. Tap top-left ↻ and verify one ZIP appears under `Downloads/Rovekin`; share ZIP if rejoin/respawn fails. Never include Microsoft auth tokens.
6. Observe full idle/task-complete session and unplanned transport disconnect behavior over multiple minutes; recorded ZIP should show whether close origin was network, server kick or local. No fake rejoin claims.

**Don't rebuild or sign an update until sources/tests are pinned, and never replace the owner’s existing installation with a debug-signed APK.**
