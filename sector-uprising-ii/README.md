# Sector Uprising II: Afterlight
**v0.1 playable prototype · source checked, GPU/device QA pending.**

Standalone sequel to Sector Uprising 1.6.53 (the original HTML raycast FPS). Set twenty years later in a futuristic industrial metropolis. A new original WebGL2 renderer replaces the old raycaster. Four guns, robot sentinels/crushers/drones, Warden bosses, wave upgrades, radar, shield, overdrive, scoring, mobile dual-touch controls, offline local saves, and fullscreen PC controls.

## Run the game
- Play the **self-contained** [Afterlight-PLAY.html](Afterlight-PLAY.html) in a WebGL2-enabled browser. This has embedded HTML, CSS and JavaScript, and works offline.
- For Windows PC Android Gradle build, use [android/](android/) subproject, which bundles the exact same one-file game in `app/src/main/assets/index.html`. With Android SDK 35, Java 17 and Gradle 8.9 installed, run `gradle --no-daemon :app:assembleDebug` **from the android folder**. The output will be `android/app/build/outputs/apk/debug/app-debug.apk`; this is not a finished release-signed APK.

Android package `com.sectoruprising.afterlight` is independent of the original app, versionCode 1, minSdk 26, targetSdk 35, landscape hardware-accelerated offline WebView. Do **not** copy personal signing keys, password files, Microsoft auth, game repositories, or emulator state into this branch. Never overwrite the existing sector release keystore; establish a separate stable release keystore for Part II on the owner-authorized PC.

## Controls
Desktop: WASD, mouse look after clicking play field, click/Space fire, Shift dash, E overdrive, 1–4 weapons, P/Escape pause. Android: left movement joystick, right swipe look, hold FIRE, DASH, OVERDRIVE, tap weapon slots.

## QA gate
Source parser and mocked browser gameplay checks passed locally: scene generation 143,892 static vertices, game start, wave spawn, pause/resume, interwave upgrade. This **does not** verify actual GPU rendering or Android runtime; WebGL was disabled in the isolated test browser. Before approval, run the true PC WebGL visual smoke, Android Gradle build, emulator/device first-run, performance, impact, AI, save/resume, system back, rotation and signing checks. No GitHub Actions were started. Keep all other local jobs untouched.
