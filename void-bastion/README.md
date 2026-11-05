# VOID BASTION — first playable local skirmish

Original grimdark science-fiction fortress-defense strategy game for **two players on one Android device**. No internet service, login, external graphics, downloaded packages at runtime, or proprietary game assets required. The title and factions are original, with a broad gothic military science-fiction influence. **Not an official Warhammer 40,000 product.**

## Play right now

Open `index.html` in a modern desktop/mobile browser. The same static assets are bundled in the Android WebView project. In-game instructions are available from the menu.

## Rules

- Player 1 controls Iron Wardens (blue left); Player 2 controls Ash Reavers (orange right).
- Deployment: Each side starts with 14 requisition and must deploy at least two units in their starting 3-column zone.
- Unit roster: Legionary (2R), Pathfinder (2R), Iron Guard (4R), Defense Turret (4R).
- Planning: tap friendly unit, then destination or enemy in range. Orders are queued and can be cancelled by tapping the selected unit again. No action occurs while planning.
- End Turn: actions resolve sequentially and turret auto-fire triggers; only then is the device handed to the other player via private transition.
- Victory: destroy the opposing fortress core (26 HP). Each full round awards both players +3 requisition. During planning, tap a unit card to queue reinforcements in your home zone. They spawn only when you end the turn; tapping a queued build tile cancels and refunds it.

## Android build (requires Android SDK 35, JDK 17 and Gradle 8.9)

1. From the standalone `android` folder, run `gradle :app:assembleDebug --no-daemon`.
2. Install `android/app/build/outputs/apk/debug/app-debug.apk` on an Android phone.
3. The app uses no network permission; all files are packed in `android/app/src/main/assets/`.

When modifying any web file, copy `index.html`, `style.css`, `game-core.js`, and `app.js` into the Android assets folder before building. The GitHub CI workflow does this automatically and retains APK/screenshots for **one day** to minimize Actions storage.

## Testing

Run `node tests/rules.test.js` to check turn sequencing, deployment, legality, delayed execution, victory and turn handoff. This is a first functional 2D tactical rendering, not a finished 3D/AAA game. Its rules engine is separate from rendering so VQ/VEILFORGE 3D units can replace the procedural visuals later without replacing the tactical gameplay.

## Isolation

Created in an isolated folder/branch of `timmytwopointoh/New-game-`. Does **not** modify ECHOFORM's existing app/main source, or `Project-hail` or `Engine-build`. Reuses only general development techniques.
