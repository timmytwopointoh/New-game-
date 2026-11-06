# Peks Engine — PC Android test candidate acceptance gates

## Non-negotiable release boundary
This branch is a playable-source **TEST** iteration and not a production-complete game. A source commit, simulation mock or green Gradle build cannot demonstrate polished animations or reliable Android GPU runtime. Do not label AAA, production, finished or fully tested without screenshots and objective checks.

## Source QA (must pass)
1. Pin immutable New-game- SHA. From the pinned checkout run: `node peks-reborn/script/check-production.cjs` and `node --check peks-reborn/game/{data,engine,minigames,game}.js` individually on Windows.
2. Check 19 unique playable IDs, 13 free + 6 locked, order Tim/Tera/Plan/Eddie/Jimothy/Spooderman; 2x Eddie; 3x each Jimothy and Spooderman; Tim zero, Arayell 1.5x; distinct animal model.
3. All stations located in zones, accessible to joystick/collision checks; target marker never obscures player; save/restart preserves money/day/role/task/unlocks.
4. No external domains, login, secrets, analytics or internet permission. JavaScript file URLs can't access other file URLs; WebView external navigation blocked. Test diagnostics user-triggered only, no auto-upload.

## Android test build (NO GitHub Actions)
1. Only on owner-approved Windows PC parent when other jobs idle. Use existing JDK17+, Android SDK API35 / build tools and compatible Gradle with cached AGP 8.6.1. Don't interfere with Realm AI, Sector II or the legacy Peks.
2. Run script/build-peks-test.ps1 with exactly the pinned New-game- source commit. It validates source and attempts **offline** assembleDebug.
3. Verify SHA256 and length, aapt package `com.peks.plunder.rebuilt`, versionCode 1, proper launcher vector icon and application label `Peks Plunder`. Verify APK ZIP contents include all JS, CSS and HTML, WebView Java class, and all Android resources.
4. Install on a fresh emulator, capture front menu, crew menu, 3D world/day-night, 3x legends locked and unlocked, each minigame and Pause->Save Test Diagnostics. Read logcat for errors.
5. On real Android phone, measure game FPS at pier/tiki/kitchen, phone rotation, task reachability, menu touch targets, sound absence, frame drops and crash frequency. Save diagnostics using system picker and attach to regression.
6. Only after verifying a usable download, publish through an already owner-approved PC artifact transport or approved GitHub release. Never paste signing secrets or install onto a linked personal phone.

## Current known limitations / quality backlog
- The first 3D meshes are geometric prototypes; still require VEILFORGE VQ original sculpting, material bake, rigging, high-quality animation, custom lighting/contact shadows, environment occlusion and LOD.
- The new challenge systems implement input distinctness, but need real gesture/feedback balancing and full photo/audio/art polish.
- Data-driven zone collision is coarse; requires precise geometry collisions for kitchen tables, doors, connected corridors and NPC paths.
- Debug builds do not necessarily share release signing identity: debug APK updates must be signed with the same certificate, so keep PC debug keystore stable for later test increments.
- No current live APK proof or measured device performance. Do not claim otherwise.
