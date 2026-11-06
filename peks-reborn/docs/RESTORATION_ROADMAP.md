# Peks Plunder — Core game restoration decisions (v0.3)
**Decision: retain the functioning standalone 3D engine and the working PC APK/emulator pipeline, but do not treat the simplified 3D prototype as gameplay feature complete.**

## Evidence used
- User phone video 1817.mp4 (2026-11-06): the 3D world is visible, the joystick moves the player around, and a station objective is displayed, but the camera is pulled back far enough that furniture and crew are tiny and distinct interiors are difficult to read.
- Original source: \`timmytwopointoh/New-game-\` commit \`5a96ba7ab2c8da7e96217703e07f33739fbe3431\` under \`peks-plunder/app/src/main/assets/index.html\`. Preserve this entire source unchanged at its original commit.
- New 3D foundation: feature/peks-plunder-rebuild-engine-20261106. It has genuinely separate source renderer, game logic, character roster, minigame controls and Android wrapper, but not full legacy behavior.

## v0.3 bridge step: faithful gameplay preserved while rebuild proceeds
- Bundle a labeled **ORIGINAL CLASSIC SHIFT** from the old self-contained HTML source as \`game/classic.html\`. It keeps its original progression, minigames, old historical character appearance/multiplier rules, and internal save keys. This is NOT a 3D rendering mode or claim that v0.3 has 3D parity.
- The 3D menu offers both game modes. Original Classic menu has a route to return to 3D, while the original gameplay mechanics and Android package of the original v0.43 remain untouched.
- Improve the new 3D camera from whole-island tabletop to character-follow focus with in-game zoom in/out, without changing level coordinates, achievement economics or original assets.
- Both modes are offline; do not merge save formats silently. Classic within the new Android package starts its own legacy save; an older installed Android app's private save is NOT automatically imported.
- New v0.3 versionCode 2 within \`com.peks.plunder.rebuilt\` preserves same-package debug updates *only if signed with the same PC debug certificate*. This is a testing build, not a production signed or Play Store release.

## Feature parity backlog, in strict implementation order
1. **World/room architecture (P0):** map actual original spatial zones, door openings, hallway, pickup window, tiki-to-pier and chowder-to-kitchen connections, granite kitchen, pantry/freezer, prep, brown plank dining, collision solids and interactable stations. Test reachable paths not just total station count; customers have independent path checks. Signage only Chowder Room/Kitchen/Prep Room.
2. **Active restaurant loop (P0):** customer orders, waitlist, table seating, meal preparation, actual held service interaction, satisfaction timer, departed customers, penalties and reward combos. 3D gameplay should not be only a six-station coin circuit.
3. **Crew systems (P0):** named employees, per-role stats, costumes and realistic work behaviors, conversations, randomized activities, relationships and pathfinding. Keep Jimothy as a round raccoon, not an original human meme placeholder; Jimothy and Spooderman new 3x bonuses after Eddie as user-specified.
4. **Genuine minigames (P1):** port semantics not bitmaps of the original dishwasher scrub/rinse/rack; fryer and grill; fresh salad; tiki mixing; crab catching; truck-Tetris rotations; trash removal/sorting; customer service and quest board. Give them role-specific success/failure, feedback, animations, progression and fair rewards.
5. **Set-piece events (P1):** owners Dan/Diane VIP visits and meaningful happiness impact, dramatic lemonade explosion cleanup, Eddie's wandering underwear coin knockdown, ghost prank chains, aquarium crab escape, dolphins and gators in the water; keep events rare rather than constantly interrupting.
6. **Visual rebuild (P1):** dedicated authored VEILFORGE/VQ meshes and character rigs with fabric/skin/metal textures, expressive face animation, hand/leg IK where practical, trim, glass and reflections, street-to-pier water, coherent warm lighting, contact shadowing and mobile LOD. Profile actual Android GPU before increasing shader complexity. Avoid generic random meshes as the final look.
7. **Progression/campaign (P2):** meaningful shift success/failure, stars, unlock journeys, optional restaurant decorations and upgrades, day/night arc, offline persist/resume and import old save **only** with user consent/backup.

## One release gate per meaningful milestone
- Use owner PC \`timmytwopointoh/emulator-tester\` self-hosted Windows \`realm-persistent\` runner, explicitly isolated from Realm AI/Sector II and sharing their emulator concurrency lock.
- On every build: pinned commit, Node syntax/static tests, Android Gradle assembleDebug, APK manifest/asset validation, zipalign, apksigner SHA256, isolated emulator install/launch, screenshot, release link.
- Watch **camera size, movement, exterior/room distinction** on actual rendered image; smoke install alone is not visual acceptance. User phone feedback outranks mock screenshot.
- QA must measure both original Classic and new 3D launch, not just open the Android MainActivity. Do not assert Classic gameplay is live-verified unless explicitly tested.
- No automatic GitHub Actions sprawl per tiny feature; one isolated PC workflow per milestone, old release/source retained.

## What is not done
3D original-parity, detailed VQ assets, complete NPC service simulation, full sound/effects, multiplayer, phone performance, visual acceptance, migration from old package and production signing. These must not be implied by a debug Android test APK.
