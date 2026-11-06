# Peks Plunder — The Ghost Shift | Peks Engine pre-alpha
A new standalone offline WebGL2 restaurant game. The previous v0.43 code is preserved unchanged at New-game- commit 5a96ba7ab2c8da7e96217703e07f33739fbe3431.

## New source
- game/engine.js: purpose-built 3D isometric WebGL2 renderer, custom daylight shader, dimensional floor/room props, waves, crab tanks, dolphin, palm trees and original procedural crew shapes.
- game/game.js: menu, crew selection, touch joystick and keyboard movement, workstation tasks, basic minigame loop, money, day, local saves and events.
- game/data.js: 19 staff/bonus characters. 13 available at start; six locked: Tim 50, Tera 100, The Man with the Plan 150, Eddie 200, Jimothy 300, Spooderman 400. Eddie 2x; Jimothy and Spooderman each 3x. The final two costs are initial tuning defaults, not user-set prices.
- Jimothy is a short rounded raccoon with waddling/scurrying stance, black facial mask, striped tail and compact legs, inspired by the viral Seattle raccoon (https://knowyourmeme.com/memes/jimothy-the-raccoon). No copied photo, drawing or third-party art is bundled.
- android/: separate com.peks.plunder.rebuilt debug package to protect old app installs and saves. Installed existing JDK/Gradle/SDK required; no Gradle wrapper included. Build only on approved owner PC.

## Local testing
In a modern desktop browser with WebGL2, open game/index.html. If your browser blocks local-file scripts, serve the game/ folder from a local static server. No internet calls. For Android, use the existing PC Gradle to run assembleDebug from android/; preBuild automatically syncs the game scripts to APK assets. This code has not yet been verified on a device, emulator or GPU. It is source work, not a tested APK.

## Dedicated repository & PC
The new engine is staged under peks-reborn/ on an isolated source branch while the PC parent creates a private Peks-Plunder repo and isolated PC workspace using script/setup-peks-workspace.ps1. Use pinned source SHA, idle workers, approved workroot. This repo must not replace or interrupt VEILFORGE Studio, Realm AI or Sector II. GitHub Actions must not be used.

## Major-overhaul art standard
Target a high-quality 3D seafood waterfront with textured materials, shadows, animated modeled crew, interactive facilities and professional gamefeel. The current geometric characters and repetitive minigame buttons are placeholders, NOT AAA or complete parity. VEILFORGE/VQ is a read-only upstream asset generator with required provenance/texture/rig/LOD QA; AFTERLIGHT is a techniques reference, not a copied runtime. See docs/FEATURE_LEDGER.md for requirements and honest status.
