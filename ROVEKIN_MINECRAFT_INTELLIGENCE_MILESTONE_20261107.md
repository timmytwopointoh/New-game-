# RoveKin — offline Minecraft intelligence and recoverable movement milestone

Development branch: `feature/rovekin-minecraft-goal-intelligence-20261107`

App identity unchanged: `com.rovekin.companion`, versionCode `200081`, versionName `1.0.3-rovekin-permanent-home`. The currently installed older v1.0.2 has no first-home memory. This branch is **source and Android QA only** until signed with the existing private RoveKin key. Do not install an unsigned or debug-keyed APK over the user's working installation.

## Completed source improvements

- Offline goal breakdown in `src/survival/minecraft-goal-knowledge.js`: fifteen representative Minecraft domains (starter shelter, wheat, livestock, iron, diamond, Nether, enchantments, potions, storage, smelting, redstone, End, village, fishing, exploration). Uses versioned bundled Bedrock recipe/material data to plan specific items; separates known inventory from unknown. No fabricated action completion.
- Offline mob guidance in `src/survival/minecraft-mob-knowledge.js`: twenty-two common vanilla creatures/bosses, behavior and safety cautions. Nearby-mob distance is included only when the server supplied current entity positions. This is not a combat executor.
- Per-selected-Realm Keep Inventory expectation in `src/survival/realm-rules.js`. User can say `keep inventory on` once to save an **owner-reported expectation** without issuing any operator command. Server-provided game rules override claims within a session. After actual death, inventory must still be verified. A Realm that has not been identified must not inherit another Realm's rule.
- Remembered chest loss in `src/survival/storage-incidents.js`. Inspects only RoveKin's prior recorded chests; ignores unloaded/unknown cells; separates a positive server block update from newly observed missing blocks. Inspects nearby dropped-item entities but never assumes their origin or original contents, never autoloots, and never accuses a player. Persists bounded incident evidence per Realm. Query `chest status`, `where are the chest items`, or `what happened to my chest items`.
- Safe saved-home navigation from v1.0.3 earlier work, plus owner `go home`, confirmed first-home lock and explicit owner STOP semantics.
- Stair climbing: `construction-guard.js` no longer rejects unknown terrain exactly at three-block safety-boundary distance; `Climbing` tracks exclusively its own *server-confirmed* dirt supports and `Building` excludes only those confirmed supports from near-construction checks. All other owned/player/modded structures remain protected. No fake dirt placements or inventory consumption.
- Chest observation is rate-limited to one pass per second, avoiding a full structure scan on every 50ms movement tick.

## Automated evidence (not a live Realm proof)

- 55/55 knowledge, stored home, language, chest/rules, mob and existing session tests passed: https://github.com/timmytwopointoh/New-game-/actions/runs/42348223379
- 22/22 traversal, dirt staircase (Survival + Creative), construction protection and respawn tests passed: https://github.com/timmytwopointoh/New-game-/actions/runs/42348029931
- Native Android unsigned-package preflight: `.github/workflows/rovekin-minecraft-knowledge-android-preflight.yml`. Requires Android unit tests, all movement regressions and presence of bundled new code. Native build/signing evidence must be checked independently.

## Real-World acceptance sequence

1. Install only a **signed**, matching-certificate `com.rovekin.companion` update preserving app data and account tokens; never uninstall first.
2. In selected Realm give exactly one verified new home. Ask `home status`, reconnect, confirm original coordinates are unchanged, and confirm `go home` does not resume manual STOP.
3. Say `keep inventory on`; ask `realm rules`. This is a saved user report, **not** evidence that the server setting has been inspected. When RoveKin actually dies and respawns, compare server-sent inventory before and after. Never create a death-inventory recovery job solely from default assumptions.
4. Observe a three-block dirt ledge with known hotbar dirt; verify each placed block, Survival inventory decrement, ascent, and no break near player constructions. Test a wall beside owner signs or chest; automatic editing must refuse.
5. Have RoveKin create an empty test chest, observe its block and open-container contents. Break that test chest from the user account. `chest status` should distinguish server block update vs missing after rejoin; show only genuinely observed item entities, never invent lost materials or source. Reinspect near the site without stepping into water, lava or a void.
6. Ask goal planning prompts: `prepare for the Nether`, `how to farm wheat`, `plan to make a diamond pickaxe`, `what is a creeper`. Compare knowledge with server-received inventory and recipes. The plans should NOT execute unsupported crafting, boss combat or dimension travel.
7. Test Follow over uneven ground, trees, safe cliff, drops, known water boundaries. Record a sanitized all-in-one ZIP if server/position differs from expectation.

## Open gates

RoveKin is **NOT** yet capable of arbitrary Minecraft tasks. Recipe knowledge is not crafting execution; goal breakdown is not a general autonomous long-horizon executor. Live modded/vanilla Realm movement, chest recovery, crop planting, animal interaction, End/Nether traversal and every new interaction still need observation and dedicated protocol handlers. Rejoin reliability and signing remain separate acceptance gates. Do not automatically run unbounded jobs or start a second home.
