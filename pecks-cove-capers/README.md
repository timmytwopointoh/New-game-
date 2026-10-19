# Cove Clatter: The Ghost Shift (v0.5)

Working title for a bright offline pixel-art restaurant mini-game inspired by the waterfront feel of Peck's Old Port Cove in Crystal River, Florida. This is an **unofficial, unaffiliated prototype**; no restaurant logos, photos, or third-party game assets are embedded. Working title subject to trademark and distribution clearance.

## Playable features

- 10 selectable staff roles, each with distinct work routes, tools, dialogue, and task results.
- Spacious room/deck map with table collisions and a following camera.
- Manual D-pad/keyboard movement and manual !-marker interactions; no tap-to-move or automated tasks.
- Customers arrive, order, remain seated until served, eat, and leave.
- Random ghost pranks to clean up; score, effects, and game progression.
- **Animated main menu attract mode** uses the *actual world render functions and staff sprite shapes*, simulating a looping busy dinner rush (staff walking, carrying meals, steam, diners entering/eating/leaving, occasional ghost). Menu simulation is independent of the player's game save or score.
- **Crab-chef launcher icon** generated specifically for this game, bundled locally in Android `res/drawable-nodpi/ic_launcher.png`; Android app display name and HTML title are Cove Clatter.

Open `web/standalone.html` offline in a browser. Android debug APK: `cd android && gradle :app:assembleDebug --no-daemon` (Java 17, Gradle 8.9, Android SDK 35). No internet or dynamic asset service required by the installed app. Updating retains package ID `com.peckscove.capers` for upgrade compatibility.

## Review / provenance

- Keep ECHOFORM and shared VQ source untouched. This is a separate game subdirectory and isolated feature branch.
- Visual smoke checked with Chromium on mobile portrait and landscape; source logic checks cover manual actions and customer persistence.
- CI artifact is a debug APK, not a signed release. Emulator outcomes must be checked independently.
- Generic terms such as *Crab Rush* have existing gaming uses. *Cove Clatter* is a candidate name, not a legal determination or registered mark. Complete formal clearance before public launch.
