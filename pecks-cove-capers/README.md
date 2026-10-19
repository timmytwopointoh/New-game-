# Pek's Plunder · The Ghost Shift (v0.6)

An original, offline-first pixel-art game **unofficially inspired** by the waterfront atmosphere of Peck's Old Port Cove, Florida. Not affiliated with or endorsed by the restaurant. *Pek's Plunder* is a provisional title awaiting appropriate trademark clearance before any release.

## Play

Open `web/standalone.html` in a browser or build the Android app. Ten selectable crew members have job-specific manual tasks and restaurant dialogue. D-pad/arrow keys and WORK replace tap-to-walk. Furniture has enlarged collision; the camera follows the active worker.

A full shift lasts **12 minutes of active play**: easy sunrise, busier lunch, intense sunset/dinner. The task-board shows progress toward eight job tasks and six served customers. Players can keep working past these goals until closing time. Guests arrive and wait until served; ghosts make messes that persist until repaired. Completing tasks grants coins, world effects and a visible confetti burst.

The Dish Runner's sink opens a **scrub minigame**, clearing seven stains with taps or swipes. The Cook's second workstation opens a **fryer minigame**, cleaning by wiggling the pole back and forth ten times. Neither minigame completes automatically, and both pause the shift clock. Cancellation returns without task credit. Game/menu/minigame transitions use short fades and the app starts with a 3.8-second animated sunrise over the restaurant before crew selection; it can be skipped.

Android icon is the previously approved original crab-chef illustration. Existing package `com.peckscove.capers` remains to allow updates. There are no network permissions or external runtime asset downloads.

## Validation / limitations

- `node --check web/game.js`
- `node test_logic.cjs`
- `python3 test_v06.py` (local only, needs Playwright and Chromium): intro, UI, HUD, checklist, both gesture minigames, timer phases, and timeout
- `gradle :app:assembleDebug --no-daemon` from `android/` (requires Android SDK/Java 17)
- The CI workflow builds a debug APK and performs one Android emulator smoke run. A successful compilation is not equivalent to an emulator graphics pass; inspect the screenshots/logcat and keep the existing v0.5 APK until tested.

This version is developed on an isolated feature branch. It leaves ECHOFORM, Project-hail, Trion, and VQ model engine sources unchanged.
