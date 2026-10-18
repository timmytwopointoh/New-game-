# VOID BASTION 3D — offline tactical skirmish

A playable, original **3D** grimdark science-fiction defense game for two players sharing one Android device. Inspired by gothic sci-fi aesthetics, but not an official Warhammer 40,000 game. The armies, models, game rules, and meshes are original and built in code.

## What is actually 3D

The battlefield uses **WebGL 1** with a perspective camera, GPU depth testing, per-fragment lighting, fog and materials. All unit geometry is procedural and local: angular infantry with separate boots, pauldrons, helmets, chest plates and guns; large armored heavy troops, scout units, multi-barrel turrets, stronghold cores, rocky terrain and ruined obstacles. There is a small animated 3D menu diorama. No external 3D library, CDN, downloaded assets or internet is necessary.

These are early low-poly 3D game meshes, **not** fully sculpted AAA characters, not licensed 40K models, and not yet skeletal animation/physically based textures. The rendering foundation allows later VQ/Veilforge mesh upgrades.

## How to play

Open `index.html` (or the single HTML demo file) in a WebGL-capable browser. Select Local Skirmish. Player 1 places at least two units in the blue deployment zone. End deployment, pass device, and Player 2 places at least two in the orange zone. Then alternate turns: tap a friendly unit, tap a tile or enemy to queue a move/attack, and hit End Turn. Queued orders then animate before the secure handoff. Destroy the opposing fortress core (26 HP) to win.

Move camera: **drag** to orbit, **pinch** to zoom, or use the + / − / ↺ buttons. A brief tap selects a tile and never rotates the camera. Troops move only when End Turn is pressed. Different 3D models correspond to different gameplay archetypes.

## Rules and economy

- Two armies: Iron Wardens (blue) and Ash Reavers (orange).
- Four unit types: Legionary 2R, Pathfinder 2R, Iron Guard 4R, Defense Turret 4R.
- Each faction gets 14R initial placement, +3R per full round.
- Reinforcements can be ordered in the home zone during planning; they materialize on End Turn.
- Movement and attacks resolve sequentially, and defensive turrets auto-target enemy units.
- Offline one-phone hotseat skirmish (not online multiplayer or AI).

## Android APK build

Requires JDK 17, Android SDK 35 and Gradle 8.9. Run from `android/`:

```bash
gradle :app:assembleDebug --no-daemon
```

Install `android/app/build/outputs/apk/debug/app-debug.apk`. Android host WebView uses hardware acceleration, locked landscape orientation and no internet permission. The game assets are bundled under `android/app/src/main/assets/`. Keep assets synced when editing frontend files. The CI workflow builds debug APKs with one-day artifact retention, and runs the emulator only when manually dispatched with `emulator=true`.

## Test

```bash
node --test tests/*.test.js
```

Tests cover 43 gameplay assertions, user-interface event wiring and full hotseat deployment, and actual 3D mesh/scenario WebGL method calls with a mocked GL context. **GPU shader execution, real browser visual output, and actual Android installation still require device/emulator verification.**

## Project boundaries

Source is isolated in `void-bastion/` in `timmytwopointoh/New-game-` on its dedicated feature branch. ECHOFORM and Project-hail/Engine-build remain unchanged. No third-party game code/assets are imported.
