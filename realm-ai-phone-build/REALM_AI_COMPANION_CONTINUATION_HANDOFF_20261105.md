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
## November 5 follow-up: phone-only owner field trial and compass-style locator detours

**Current work branch:** `feat/realm-ai-companion-world-understanding-20261105`. Never reset it to the older v0.43.7 signed release; that release remains the safe installable baseline. The standalone Android APK still requires the existing owner-local signing key and real build/toolchain, not a source ZIP or an EXE.

### Newly integrated changes
- `src/survival/companion-field-trial.js`: the shared chat instruction `start home field test`, `find me and start building`, or equivalent starts a named-owner Follow. It observes the player's REAL entity name and fresh server-position packets, requires verified movement and within 10 blocks, checks scope/dimension, stops follow once, then invokes `this is your new home spot`. A stale locator coordinate, other player's icon, missing entity ID, unobserved path, or stopped job never grants land.
- `src/survival/player-locator.js`: uses the Bedrock **Locator Bar/player-location packets** as a compass-style directional hint matched to a name, never random marker color. New `routeSearchCandidates` looks ahead in short confirmed 14-block segments and sweeps lateral offsets left/right plus nearer goals.
- `src/survival/navigation.js`: when a direct bearing segment fails because of trees, hills, holes, terrain, water or collision, checks up to 18 candidate local waypoints with its normal ground-verified, dry routeTo pathfinder. It can wait for new chunks if none is safe instead of claiming travel occurred.
- Tests `tests/companion-field-trial.test.js`, `tests/compass-bearing-obstacle-detour.test.js`: cover name matching, no fake home on an old packet, moving within 10 blocks only, one-shot trigger, missing terrain refusal, and lateral routes. Additional tests `tests/adaptive-companion-language-memory.test.js` cover private on-phone expandable concept memory, name-directed chat and tone adjustments.
- Prior source features are preserved: `src/name-intent.js`, `src/survival/resource-recall.js`, `src/survival/knowledge-memory.js`, `src/survival/companion-mind.js`, `src/survival/companion-voice.js`, `src/definition-comprehension.js`, `src/automatic-google-research.js`, `src/survival/home-instinct.js` and home project/construction guard, Android release chat-first UI.
- Focused source-level simulations **passed** the one-shot 10-block gate and compass bearing candidate checks. **Full Node/Android unit suites, emulator run, actual Realm spawn/walking/placing, and new signed APK are NOT verified**.

### Required real PC/emulator acceptance sequence
1. On the trusted owner PC, pull this **exact current feature branch** and run `npm ci`, `npm test`, `npm run check` in `bedrock-agent/`. Run Android `testDebugUnitTest`. Repair compilation/test failures with narrow commits only; preserve original client handshake and addon-pack work.
2. Compile a real ARM64 APK with embedded Node runtime and dependencies using the local Android SDK, Java, Gradle and private native runtime; sign with the **existing** permanent owner keystore. Never commit/upload keystore, app tokens, Microsoft auth, private Realm ID, chat messages or device pairing secrets. Preserve `com.veilforge.realmagent.live` and ensure `versionCode` exceeds the *installed* app and signature/certificate equals current working release.
3. Install on Android emulator or a real device and confirm the bot account (tirionomni) joins the selected Realm. Verify source is updated in the APK, not just the desktop harness. DO NOT substitute a Windows EXE as the controller.
4. In **phone-app chat**, send `start home field test` or `find me and start building`. The user must be logged into the Realm and standing in their uneven field near trees and sheep. Observe named owner locator updates. The bot follows safely toward the owner, with detours around obstacles.
5. When bot server position and owner entity have **fresh position packets and are within 10 blocks**, the one-shot gate should issue `this is your new home spot` internally. Verify one global thank-you, a unique world-observed wood/dirt design, and an actual home stage beginning; do not count printed text as block placement.
6. Record exact server-authoritative distance, target/own ages, waypoint errors, home stage, block update/inventory evidence and time-of-day. If no movement, permission, supply, or block update, patch just that behavior and retry. Avoid world destruction; unknown blocks remain protected.
7. Deliver installable same-key **.apk** only after verification; debug developer picker should be hidden in release, chat remains primary. If the PC test runner is unavailable, report this as blocked rather than claiming emulator success.

**Tool access note:** This ChatGPT session can read/write the connected GitHub source but has no live PC emulator/ADB or local Android SDK/Gradle and no private owner signing key. It has not built or installed the new APK. Ask for connection to the existing PC test runner only through an authenticated, approved bridge; avoid creating public control endpoints.
