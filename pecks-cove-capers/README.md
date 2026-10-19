# Peck's Cove Capers · The Ghost Shift

A self-contained, offline-first pixel-art restaurant game, lovingly inspired by the waterfront setting and fresh-seafood character of the real Peck's Old Port Cove restaurant in Crystal River, Florida. This is an **unofficial fan-inspired prototype**, not restaurant-sponsored or affiliated.

## Play
Open `web/index.html` in a desktop or mobile browser, or compile the native Android wrapper. It needs no server, internet connection, third-party packages, textures, or copyrighted asset downloads. The character illustrations and entire world are drawn using original procedural canvas geometry.

Select one of ten crew members, complete six manual work actions and serve at least three customers to finish a shift. Customers arrive, sit, order food, eat, and only leave after you serve them. Ghost pranks persist until cleaned. Each character has three unique work stations, which cycle twice across a shift. Stars, ghost cleanups, and chain bonuses affect the score; the local best score is saved on device.

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
Keyboard WASD or arrow keys to move; hold E/Space to work near an exclamation marker. On touch devices use the arrow pad only for movement and hold **WORK** to interact. Tap-to-move, autopilot, and auto-work have been removed. The zoomed camera follows the character. Work near the service hatch to pick up a guest’s food and take it to the waiting diner. Use CREW to return to selection and Ⅱ to pause.

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

## v0.3 manual-service update
- Fixed 1.68× following camera and manual arrow-pad/keyboard movement; no canvas tap controls.
- All active workstation tasks use floating ! signs, not route trails or auto-work.
- Customer state machine: entrance → table → order → served/eating → exit; pending orders do not time out.
- 10 role-specific dialogue pools, crew speech bubbles, food pickups, table delivery and persistent ghost cleanup.
