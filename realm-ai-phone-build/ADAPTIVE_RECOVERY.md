# v0.13 Adaptive follow and recovery

Owner request: detect when forward input does not produce movement; choose jumping, detouring or mining based on current job. Owner clarification: **avoid player builds; go around**. Keep the same permanent signing key and application ID; versionCode 100003 updates v0.12 (100002) and v0.9.11 (100001).

Source: v013-adaptive-overlay.tar.xz.b64 is a portable xz tar with 16 source/dependency/test files. Apply in the same place as the previous survival overlay. It retains the already verified join/pack wire fixes and app-private login cache.

## Behavior

- Server position feedback is tracked separately from client-predicted movement. Three or more server samples spanning at least 800ms, with at least 0.6 blocks of requested movement but under 0.15 blocks of observed horizontal displacement, indicate a stall. No server feedback means unconfirmed, not stuck.
- `follow me` follows the configured owner; `follow <name>` follows a player actually observed through add/move player packets. It stops nearby and waits if the player leaves view. It never mines. One-block up/down routes require supported, known landing cells and overhead clearance. Jumping uses ordinary auth input with jump flags, gravity and collision checks, not teleport packets.
- `walk to X Y Z` is solo travel: prefer another route, then pause if none is available. It never mines by default.
- `clear path to X Y Z` is an explicit clearing job: detour first; only if no route exists may it try a reachable, natural-looking block that the actual held tool can harvest within a five-second estimated break-time budget. Both start and destination must be observed, clear standing cells.
- Crafted/build-looking blocks, containers, interactive/protected blocks, and blocks adjacent to construction are excluded from clearing. Placement origin is not available from normal Bedrock packets. This is conservative material/context inference, NOT proof of who placed a block; plain player-placed dirt/stone may be indistinguishable from terrain. Normal walking and following remain non-destructive.
- `select slot 1` through `select slot 9` selects an actually received hotbar stack. `dig X Y Z` starts one explicit nearby block-mining job with the same protection/tool/reach checks.
- Mining uses normal start/crack/predict break actions and a held-item use-item transaction, waits for a server block update to air, and never writes air into the local world to fake success. Block removal does not prove item collection. A rejection, timeout, changed tool, changed target, unknown terrain, fluid exposure, airborne position or low health cancels the action.
- Recovery is limited to three attempts without observed progress; repeated blind jumping/mining is not allowed. `stop`, `stop following`, disconnect, dimension changes and large corrections cancel work. `movement status` explains the current reason and server-feedback evidence.

## Validation

140 Node tests pass locally, including all existing regression tests and 20 new recovery cases. Real 1.26.60 packet serializers validate jump, mining and equipment input. Tests cover physical jump/drop trajectories, moving-player tracking, repeated stationary corrections, job-specific decision order, construction/containers, held-tool eligibility, mining confirmation/timeouts/abort, invalid destinations, head-height obstacles, airborne jump refusal and cancellation.

Android build and signature verification do not prove live Realm movement or mining. This preview needs device testing. Earlier v0.9.11 was reported to join successfully; do not claim v0.12 walking was confirmed by the owner. No behavior pack/add-on is required. Crafting, construction execution, combat, multi-block harvesting jobs and general autonomous survival remain outside this change.
