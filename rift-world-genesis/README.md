# RIFT WORLD — SHATTERED ATLAS

An original **offline Android action-RPG** and its isolated native Android/Gradle build project. Code name: **RIFTCORE**. This is a new game, not a reskin or import of any earlier Rift World project. This first release is the **Genesis playable prototype**, not the finished content-heavy game.

## Actually implemented in Genesis

- Real, continuous touch-controlled overworld with original procedural landscape art and distinct environmental palettes: Lumen Reach, Verdant Hollow, Emberfall, Mirror Tides, Nightglass.
- Five spatially located rift gateways; deterministic map; dynamic animated Rift sanctums, encounter waves and the Hollow Sentinel boss.
- Original Wayfinder hero with authored geometric illustration, lighting, shadows and movement animation; Glimmerfang, Fracture Wisp, Shardback, Hollow Sentinel, individual behavior/cooldowns/hit effects.
- Real-time strikes/combo, phase-based Riftshift, AoE Pulse, movement Dash, HP/energy bars, particles, knockback, XP/levels, star-shard economy, repeatable permanent Anchor upgrades.
- Offline local saves, continue/new game, pause/resume, death/respawn, map screen, mobile action buttons and joystick, keyboard/gamepad-adjacent fallback, synthetic combat sound.
- Dedicated Android application ID `com.veilforge.riftworld` and separate project signing identity (DEBUG for first build). No Internet permission, analytics, ads, remote code or external assets.

## Build

Use owner PC's existing Android SDK/Gradle from the verified independent Windows `emulator-tester` runner. In the `android` directory:

```powershell
gradle --no-daemon :app:assembleDebug
```

`app/build/outputs/apk/debug/app-debug.apk` is the real debug-signed Android APK. Do not claim success before actual SDK compilation, `aapt`, alignment, `apksigner`, install/launch and emulator evidence.

Static/integration simulation without Android tooling:

```sh
node scripts/test-game.cjs
```

## Content expansion / size budget

This is the **engine/gameplay foundation**, not a fake large APK. Production target is approximately **600–1000 MB of genuinely authored content** (characters/creatures, animation, 3D props and texture atlases, environmental audio, voiced cinematic sequences, bosses, level-specific music). Ship Android-compatible compressed formats, mipmaps and quality settings; do **not** bulk up the APK with filler or unneeded archives. Future content can be installed via integrity-checked optional packs if the final APK exceeds the distribution channel limit. Mobile FPS, RAM, storage and thermal limits take priority over arbitrary file size.

Production stages: Genesis (playable loop) → Atlas (expanded biomes/abilities/narrative) → Bestiary (creature/quest variety) → Eclipse (bosses/cinematics/content packs) → Android release QA.

## Preserve other work

All source lives in `rift-world-genesis/` on an isolated branch in `New-game-` until the parent PC can safely move the *whole subdirectory only* into its own private `Rift-World` repository. Do not alter VEILFORGE Studio/VQ, Realm AI, Peks, Chibi, Sector, their emulator sessions or signing identities.
