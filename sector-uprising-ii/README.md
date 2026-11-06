# Sector Uprising II: Afterlight

**Status: v0.1 playable foundation, not yet device-verified.** Standalone sequel to Sector Uprising 1.6.53. Twenty years after the original Sector Uprising, a collapsed industrial metropolis has been taken by an autonomous defense grid. Bring back the lights.

## Play

Open `index.html` in a WebGL2-capable browser with `engine.js` and `style.css` beside it, or serve the folder over a local web server. Android: the `android/` subfolder is a minimal no-network Java WebView/Gradle wrapper with the identical offline assets copied to `android/app/src/main/assets/`. This is NOT an APK until assembled and signed on a machine with Android SDK/JDK/Gradle.

**Desktop:** WASD movement, mouse look (click to lock), left mouse or Space to fire, Shift dash, E overdrive, 1–4 select weapons, P/Escape pause. **Mobile:** left analog for movement, drag the right side to look, hold FIRE, DASH and OVERDRIVE buttons, tap weapon slots. Game is designed primarily for landscape Android phones.

## Features built in first playable foundation

- New WebGL2 renderer: actual 3D mesh geometry, per-fragment lighting, animated reactor, color-lit architecture, distance fog, atmospheric megacity silhouettes, modular bots, particle impacts, diegetic gun rig, multiple graphics levels. Distinct from original HTML canvas raycaster.
- Offline original content: four enemy archetypes (sentinel, charger/crusher, flying drone, Warden boss), AI chasing, wall collision and ranged attacks, four guns (VOLT, SHARD, LANCER, NOVA), hit reactions, damage, shields, recoveries, score and pickups.
- Survival waves and enemy scaling, four named sector regions, randomly offered upgrades, automated weapon unlocking, sector checkpoints, local saved settings/high score, radar and audio synthesizer.
- UI and platform: redesigned main menu, HUD, native full-screen WebView wrapper, Android touch controls, mouse and keyboard, adaptive render quality; no network permission or external content.

## What is not yet verified or complete

- No real Android APK is built or signed. PC build and emulator QA are **pending**. Keep other VEILFORGE/Rovekin tasks isolated.
- Mesh renderer requires WebGL2 and hardware acceleration. No 2D fallback currently; validate Android GPU compatibility, frame time and thermal load before release.
- Graphics are a stylized sci-fi procedural prototype, not AAA/photoreal production graphics. Mature sequel target: PBR assets, shadow maps, screen-space postprocessing, animations, ambient audio, authored missions and smarter tactical AI. Visual quality requires **real screenshots from device** for approval.
- Wave balance, ranged collision, pause/onResume, Android 15+ system UI behavior, memory, audio routing and signing still need physical testing.
- Current game content is local deterministic demo geometry; no VQ-generated GLB model has been incorporated, so do not claim VEILFORGE/VQ art output is live in this build.

## Build an Android APK on an authorized Windows PC

Copy whole `android` folder including `app/src/main/assets`. From `android/`, run `gradle --no-daemon assembleDebug` with Android SDK 35, AGP 8.7.3, Gradle 8.9, JDK 17 installed (or use a pre-installed compatible wrapper). Output: `android/app/build/outputs/apk/debug/app-debug.apk`. This is a DEBUG signing build, NOT permanent update-signed release. For a production APK create an independent private release keystore for `com.sectoruprising.afterlight`, sign on the PC and keep the keystore/password outside GitHub. Never reuse the original Sector Uprising's private signing credentials without a clear package/update decision.

**Distinct package:** `com.sectoruprising.afterlight` so this sequel installs beside the original instead of overwriting its data.

## QA contract

1. Check `node --check engine.js`; verify bundled assets match source by SHA256.
2. WebGL2-supported browser smoke test: launch, move, fire, kill, advance waves, choose upgrade, pause/resume, save/reload; capture actual render + console errors.
3. Compile and sign native APK on authorized PC; check applicationId, versionCode, certificate fingerprint, manifest permissions, and install/launch on real/emulated Android.
4. Performance measure: target smooth balanced mode on 2025 midrange phone. Fix and profile rather than claiming 60 fps based on source inspection.
5. Keep original Sector Uprising 1.6.53 and original signing artifacts intact. Never overwrite other game checkouts or queued PC jobs.