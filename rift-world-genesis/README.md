# Rift World: Shattered Atlas — v0.2 Living Atlas production milestone

An offline touch-first Android action-RPG using RIFTCORE (original Canvas 2.5D simulation) in a native Android WebView wrapper. This is a **tested production-quality milestone prototype**, not a content-complete AAA title. The v0.1 Genesis release remains preserved.

### v0.2 systems
- Reworked layered landscape drawing and authored explorable Lumen Reach landmarks (Fallen Observatory, Mirrorwell, Phase Bridge, Moonveil Shrine).
- Deterministic collision with trees, boulders, water and lava, with movement sliding and Phase Bridge navigation.
- Directional 3-hit combo sword cone, damage on multiple colliding creatures only, arc VFX, Dash invulnerability and impact sounds.
- Rebuilt layered hero gear silhouette and enemy-specific illustrated animated creatures.
- Astral Warden boss: HP UI, 3 readable telegraphed patterns (radial volley, targeted blast, fan projectiles), fury phase under 57% HP.
- Persistent 3-branch skill tree (Blade Dancer, Storm Sentinel, Rift Weaver), level-up points, stronger rewards for boss kills.
- Four discoverable relic landmarks with shards and XP.
- Rift arena snapshot persisted while paused; existing Genesis save schema migrated in place.
- Gamepad A/B/X/Y + left stick, keyboard and touch; independent offline installation.
- Android package `com.veilforge.riftworld`, versionCode 2; existing project debug keystore unchanged.

### Technical limitations / priorities
This retains a Canvas/WebView engine for portable Android iteration; the illustrated geometric art is not a 3D mesh or skeletal animation. The first build must be tested on the owner's phone for touch ergonomics, FPS, battery, and long-session stability. Future progression includes meshes/rigs, handmade encounters, authored quests, soundtrack, and art content. Do not pad APK size artificially.

### QA
`node scripts/test-game.cjs` runs headless offline simulation. `node scripts/test-milestone.cjs` checks milestone features and state migration. Actual PC build/emulator is handled only by the established self-hosted runner with isolated AVD, persistent Rift World key, checksum/manifest checks and no other apps changed.
