# Realm AI Live v0.33 — Roam / Explore and observed-location memory

A source-level and signed APK test candidate on the existing Live application ID and permanent signing certificate.

## Automatic Realm chat commands
- `!ai roam` or `!ai explore`: travel up to 30 blocks in the current facing cardinal direction (short safe physical walking segments; server feedback required); perform an actual 360° turn at the end.
- `!ai explore north`, `!ai roam west`, etc.: choose the cardinal direction. `!ai stop` immediately cancels the job. No UI knowledge button, Google service or Activate tap required.
- Each segment also records useful exposed blocks visible from that position, including logs and ores; the final turning scan adds more observations.
- `!ai go get wood`, `!ai chop down trees` reuse saved tree coordinates when none are currently nearby. The bot must re-observe the tree and find a safe physical route before attempting to mine. Remembered coordinates are not proof the tree still exists.

## Safeguards and known limits
- Only pathfind through terrain actually received from the Realm. No teleport, no mining through unknown obstacles and no unbounded exploration. If a section is unknown or blocked, stop and report partial progress.
- A sent movement input is not completion; confirmed progress uses newer server positions. The 360° view uses line-of-sight tests, not hidden blocks behind terrain.
- Saved observations are private and scoped to the Realm ID and dimension, bounded to 384 named landmarks plus 128 checkpoint summaries; they survive ordinary updates and reconnects. No personal account details are retained in landmarks.
- Memory can become stale when a tree is removed or hidden, so a future gathering job must check the actual observed block. Terrain may be unavailable after a restart until new chunks arrive.
- Existing unfinished mining, crafting, storage, building, and pickup behavior is not silently treated as fixed.

## Verification
- 287 Node regression tests pass locally, including 5 new exploration-memory tests.
- Java/DEX and Android resource build, APK alignment, same-certificate signing, source parity and native-runtime retention were checked in the local APK build. Live Realm tests are still required.
