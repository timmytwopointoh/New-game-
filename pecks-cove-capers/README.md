# Peck's Cove Capers · The Ghost Shift

A self-contained, offline-first pixel-art restaurant game, lovingly inspired by the waterfront setting and fresh-seafood character of the real Peck's Old Port Cove restaurant in Crystal River, Florida. This is an **unofficial fan-inspired prototype**, not restaurant-sponsored or affiliated.

## Play
Open `web/index.html` in a desktop or mobile browser, or compile the native Android wrapper. It needs no server, internet connection, third-party packages, textures, or copyrighted asset downloads. The character illustrations and entire world are drawn using original procedural canvas geometry.

Select one of ten crew members, complete six interactive work actions before the shift clock runs out, and respond to random ghost-caused messes before they vanish. Each character has three unique work stations, which cycle twice across a shift. Stars, ghost cleanups, and chain bonuses affect the score; the local best score is saved on device.

### Ten jobs
- **Dizzy Dishes — Dish Runner:** collect dishes, wash at dish pit, stack plates.
- **Crispin Skillet — Seafood Cook:** collect fish, simmer chowder, serve a plate.
- **Tilly Tray — Waiter:** collect an order, deliver it, collect tips.
- **Captain Cleo — Boss:** inventory, team morale, registers.
- **Hattie Hello — Greeter:** greet guests, guide them to seats, distribute menus.
- **Mina Mixer — Tiki Bartender:** pick fruit, mix tropical nonalcoholic drinks, serve.
- **Benny Bus — Busser:** clear tables, sweep crumbs, reset seating.
- **Finn Fillet — Fish Prep:** retrieve fresh catch, ice cooler, prep fish.
- **Dottie Decor — Decorator:** flowers, bunting, polish picture spot.
- **Wrenchy Wade — Maintenance:** fix lights, fans, and electric panels.

### Controls
Keyboard WASD or arrow keys to move; hold E/Space to work by the glowing station. On touch devices, tap a station to path directly to it and work automatically; tap elsewhere on the floor to walk; hold onscreen arrow pad for movement and **WORK** to interact. Use CREW to return to selection and Ⅱ to pause.

## Android
The Android project is *nested* under `android/`; it is intentionally isolated from any existing games in this GitHub repository. Build with:

```bash
cd android
gradle :app:assembleDebug --no-daemon
```

Requirements: JDK 17, Android SDK platform 35 / build-tools 35, Gradle 8.9. Debug APK: `android/app/build/outputs/apk/debug/app-debug.apk`.

The APK is a hardware-accelerated WebView shell around bundled HTML Canvas game assets, not an integration with the VQ geometry runtime. The VQ Engine-build workflow was reviewed but not modified: it builds and audits 3D models, whereas this specific game is intentionally procedurally pixel-based. A future explicit VQ export could replace individual sprites with rendered models while maintaining offline runtime and provenance.

## Boundaries
- Preserve ECHOFORM and the VQ engine: this implementation lives in a new feature branch/subdirectory and has no writes to their app code.
- Restaurant name and visual inspiration come from public-facing reference photos; no restaurant photography, trademark graphics, or menu images are embedded in the game.
- Sound is generated with the Web Audio API, not sourced from copyrighted clips.
- Not claimed to have passed Android emulator checks unless a CI workflow run verifies it.
