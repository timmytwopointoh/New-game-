# Realm AI Live — preserved continuation handoff (2026-11-05, America/New_York)

## Preserve these exact code points

**Signed, user-confirmed multiplayer connection baseline:** Android v0.43.7, versionCode 200070, release tag `realm-ai-live-v0437-headless-phone-20261105`; source commit `0e64e97e44a885625d81b68c2a53cd04881a6eda`. Same app ID `com.veilforge.realmagent.live`, original permanent signing certificate, phone-hosted bot. Release: https://github.com/timmytwopointoh/New-game-/releases/tag/realm-ai-live-v0437-headless-phone-20261105. Do not replace this release or remove its APK.

**Companion gameplay development branch:** `feat/realm-ai-companion-world-understanding-20261105`, audited at commit `ef03df08019a23b99d6bac7cb53e3b5feee33f1d`. It is **46 commits ahead** of the v0.43.7 baseline and contains new tests and modules. Android gradle identifies experimental `0.44.0-companion-field-trial`, versionCode `200071`, same applicationId. This is SOURCE ONLY until a signed APK is built and tested.

**Frozen safety snapshot:** `checkpoint/realm-ai-v0440-companion-field-20261105` points to the above 0.44.0 source commit. Do not force-push, delete, or silently overwrite this backup.

Canonical Android source root: `realm-ai-phone-build/realm-ai-live-v021-overlay/`.
Canonical Node/Bedrock source root: `realm-ai-phone-build/realm-ai-live-v021-overlay/bedrock-agent/`.

## Verified observations vs unfinished work

- v0.43.7 PC emulator spawned in a **one-pack** Realm without downloading the resource pack. Release notes explicitly say full multi-pack was unverified at publication.
- After publication, **owner reported actually entering the fully modded multi-pack Realm** with v0.43.7. Preserve this as a user observation, not as a comprehensive performance test or evidence of downloaded pack textures. Resource-pack headless handshake does **not** install resource/behavior files locally.
- There is no GitHub Actions run or combined status check for latest v0.44.0 development commit, so **do not claim current branch passed CI, compiled into a signed APK, or passed live follow/home tests**. Earlier preflight/regression activity was reported, but later commits require retesting.
- Follow across uneven terrain, distant owner acquisition, named player locator, actual home-plot capture and autonomy, mining, wood-gathering, sheep/wool/bed, real build stages, sleep, and automatic recovery all require live owner-facing verification.

## What the companion branch actually implements

- `src/survival/player-locator.js`: owner name matched to Bedrock player_list/player_location/nearby updates; no guessing from locator marker colors. Stale data expires. `routeSearchWaypoint` limits search to observed, verified-safe short segments (~14 blocks).
- `src/survival/navigation.js`, `pathfinder.js`, `world.js`: follow/route safety, stepping/jumping, short waypoint recovery, and avoid-water behavior; world-structure traversal allowed if safe but block edits guarded separately.
- `src/survival/vanilla-block-behavior.js`: bundled canonical block classification and conservative handling of unknown/add-on blocks, fluids, fire, traps and portals.
- `src/survival/construction-guard.js`: 15-block nearby construction protection for **editing**; unknown blocks cannot be assumed safe or natural. Original ownership cannot actually be proven from world blocks. Protected changes require precise owner-scoped permission and verification.
- `src/survival/companion-plot.js`: **50 × 50 × 50** planning plot centered on *observed configured owner player* position, not invented chat text, with valid bounds and blueprint preview.
- `src/survival/home-architecture.js`, `home-clearance.js`, `home-project.js`, `home-supply.js`: bounded house design, staged material acquisition, obstruction checks/confirmation, verified placements and pause/resume. A blueprint is NOT a house. Structural shell does not count as furnished/usable home.
- `src/survival/home-routine.js`: Overworld day/night, inventory- and recipe-confirmed bed supply, placement, sleeping/spawn report; no fabricated wool, bed, sleep success or spawn.
- `src/survival/companion-commands.js`: authenticated command router for plot and home operations, gated by confirmation. Relevant phone/authorized chat commands: `follow me`, `look around`, `this is your land` / `claim my plot here`, `design your home`, `preview home build`, `build your home` then exact `confirm home <code>`, `home status`, `pause home`, `resume home`, `bed supplies`, `craft home bed`, `place home bed`, `use home bed`, `stop`. Do not assume each stage can complete autonomously without prerequisite data or permissions.
- Tests added: `companion-world-policy.test.js`, `built-area-travel.test.js`, `home-architecture-field.test.js`, `home-clearance-field.test.js`, `player-locator-safe-route.test.js`; earlier existing `follow-terrain.test.js`, resource and pack tests remain relevant.

## Exact next user test

Owner is standing in an **uneven, open dirt field with sheep and mixed tree types** in the Minecraft Realm. Goal: spawn separate phone-hosted bot, have it find/follow owner's player over uneven ground and around trees/animals, identify owner's current standing spot as the home plot center, propose a unique house, gather materials and complete tested tasks with owner approvals where mandated. Do not use water shortcuts, break player builds, fabricate successful actions or change owner Realm permissions. User wants iterative diagnostics-driven fixes based on actual in-game observation.

1. **First** run current branch Node syntax/unit tests; fix regressions without changing v0.43.7 release. Then build experimental `200071` as a **real signed Android .apk**, not .aab/.apks, using the owner's existing **local private signing key** (do not upload key/credentials). Verify package name, versionCode, signer certificate and install-over v0.43.7, preserving Microsoft login/session, phone UI, update feed and settings. Publish separately; do not silently replace proven release.
2. Before movement, confirm real multi-pack spawn on the signed trial build, own Bedrock gamertag and owner-player locator. Track explicit server acknowledgments for `spawn`, positioning, chunk/terrain and inventory.
3. Execute **follow me**; observe progress, one-block jumps, uneven dirt, collisions, sheep, multiple trees, 15-block edit protection; record server-confirmed displacement, goal distance, stuck recovery and safety pauses. Don't infer success from a queued command.
4. At user's actual current location command **this is your land**, inspect authoritative plot coordinates, dimension, uniqueness, and bounds. `design your home` and `preview home build` are read-only.
5. If the owner explicitly authorizes the exact blueprint, test **one reversible small build stage at a time**. Check supplies, accepted packets, authoritative blocks/inventory, clearance permission, and stop/resume. Bed, storage, sleep, night survival and full house are separate acceptance criteria.
6. On any failure, collect **one sanitized diagnostics ZIP**, compare actual server packets, error/reason, position, dimension, player locator, path, inventory, and step outcomes; patch only the failing subsystem and rerun tests. Preserve login cache, update signing, stable pack handshake and UI.
7. Only call a feature VERIFIED when seen live, not from source code or synthetic tests. Maintain an acceptance matrix with PASS/BLOCKED/UNTESTED and resulting APK SHA256.

## Non-negotiable constraints

Standalone phone-operated Android APK is final. PC/Windows executable/emulator may be a **test harness only**, never required for gameplay. Keep original Android app ID/signing for in-place upgrades; do not uninstall to update. Keep the known-working multi-pack join logic and saved Microsoft authorization. Never publish private signing key, tokens, secrets, or unsanitized user Realm logs. Keep native Minecraft client and its resource packs untouched; no private pack copying. User-approved owner/Realm commands only. Do not treat a successful pack handshake as proof of downloaded mods or all behavior running.

## Current stop point

As of handoff, experimental 0.44.0 source is preserved, v0.43.7 APK is the latest publicly verified signed baseline. **No new 0.44.0 live test result or signed APK is claimed.** Resume from the companion branch, not the older baseline, after obtaining a reproducible regression pass.