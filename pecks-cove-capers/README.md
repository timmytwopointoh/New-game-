# Pek’s Plunder — The Ghost Shift v0.7 (review build)

Offline Android pixel-art restaurant game inspired by the setting of Peck’s Old Port Cove. Unofficial, not restaurant-endorsed. The working title still requires trademark clearance.

## Changes from v0.6

- A dedicated, animated **main menu** opens first. Press **Start New Shift** to choose one of ten crew members.
- Only after choosing a character and pressing **Start the Shift** does the ~3.8-second sunrise cutscene play (skippable). The 12-minute work clock begins **after** the sunrise.
- Only **one normal objective** is interactable or marked with `!` at a time: a role-specific workstation, meal pickup or meal delivery. Finish it to unlock the next. Every second completed staff job can unlock a guest-service pair when guests are waiting. Guests still stay until served.
- **Ghost pranks can interrupt** any active task and are the only allowed simultaneous extra `!` marker.
- All ten workers do a brief jump-and-wave celebration, with hearts, stars and confetti when a task is completed.
- At closing time, the results screen shows the chosen character celebrating, confetti and a warm sendoff, whether the performance target was met or not.
- Dish scrub and fryer wiggle minigames, camera zoom/follow, furniture collision, touch-hold controls, 12-minute day/night difficulty, persistent ghost cleanup, sounds and local score remain intact.

## Run and test

Open `web/standalone.html` in any compatible browser (offline). Android wrapper is under `android/`, using applicationId `com.peckscove.capers` and versionCode 7. No internet permission.

```sh
node --check web/game.js
node test_logic.cjs
python3 test_v07.py # requires Playwright & Chromium
cd android && gradle :app:assembleDebug --no-daemon
```

The JavaScript and browser tests validate gameplay state and UI. An Android compile alone does not prove device visuals or responsiveness; users should test the debug APK on their phones. Preserve v0.6 for rollback.