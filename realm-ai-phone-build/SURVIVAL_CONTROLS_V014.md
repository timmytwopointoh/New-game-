# v0.14 Survival controls test build

Application ID `com.veilforge.realmagent`; versionCode **100004**. Install over v0.13 without uninstalling. The APK must be signed with the existing `realm-ai-update` key and certificate SHA256 `B5D275706B574EEA53D6497A3A65542542B5DB0E0E57F4E307E8ED17CF24F995`. Never generate a replacement. Private backup/key/password files stay outside the repository and release assets.

## Preparing and activating commands

Start the bot and identify the Realm. **Commands** loads the shared JSON catalog through authenticated `/catalog`. Forms cover observed/configured-owner following, feet-level coordinates for route/walk/clear-path, explicit visible-block digging with tool assessment, known hotbar contents, searchable materials/recipes, quantity 1–256 supply previews, dimensions 1–12 wall/floor previews, and the fixed 5×5 shelter preview. Parameterless commands save a card directly. Manual chat uses the same catalog/validation and also saves cards; it does not immediately execute them. Unsupported text, including `move forward 3 blocks`, is rejected.

There are at most **five cards per identified Realm**. Select a card in **Plans**, then **Activate Plan**. Only that selected card starts. One job can run at a time; repeated activation taps cannot start another. Completed cards remain available until deleted; select a card again to reuse it. Activation revalidates descriptor, live choices, navigation and mining safety. Supply/crafting/building remain previews, not executable crafting or placement.

**STOP NOW** immediately cancels movement intent, mining, flight jobs and planner work, without cancelling gravity. Its request bypasses normal phone polling/command queues. Older in-flight phone requests carry an epoch and are rejected if delivered after Stop. Owner-only Realm chat Stop bypasses chat cooldown. **Stop bot service** and the existing notification action terminate the isolated bot process. Authentication and private plans remain saved. Nothing automatically resumes after restart, disconnect, dimension change or interruption.

Descriptors are stored atomically under app-private `private/command-plans/<SHA256 of Realm ID>.json`. Only whitelisted command IDs and typed values are persisted, never credentials or running state. Selection is not restored. Plans cannot be saved until the Realm identity is known. Authenticated localhost endpoints: `GET /catalog?q=...`, `GET /plans`, `POST /plans/prepare` (`descriptor`), `/plans/select`, `/plans/activate`, `/plans/delete` (`id`), and `/stop?epoch=...`. Status/update polling includes cards and Survival verification.

## Physics and Survival evidence

Collision uses received block shapes in both layers. Zero-shape thin snow is traversable; thicker snow and slab support use their actual heights. Full obstacles still need a valid jump route. Unknown terrain remains unknown. Continuous swept gravity runs after spawn, while idle, and after cancellation, with collision landing and authoritative server reconciliation. Missing terrain around the physical body is requested; after five seconds without verifiable terrain the bot disconnects with an explanation, retaining login.

Verification tracks **this player's** `player_gamemode`, own game-type updates and own ability layers, not the Realm default or another player's mode. Unused `may_fly` permission is not active flying. Temporary loading abilities pause work without being described as cheating. Active flying, invulnerability, instant build, noclip or builder abilities keep autonomous work paused. Active flying is stopped with ordinary player input.

Join and mode/ability changes trigger checks. **Ensure Survival** is also available as a command card. Only explicit server command permission permits one `/gamemode survival @s` request; the bot waits for mode and effective-ability confirmation. Denial or timeout keeps work paused and explains the reason. No Creative/flight/cheat/operator grant or global Realm-setting command is sent. An inability to hit a player alone does not establish game mode or invulnerability; PvP and spawn protection may matter.

Follow reports waiting for a player, waiting for unknown terrain, or blocked status accurately. Predicted coordinates and completed input sequences do not establish server-confirmed movement. Following/ordinary walking never mine. Existing explicit mining, detours, construction heuristics, pack/join fixes and saved-login rejoin are retained. Plain player-placed dirt/stone cannot reliably be distinguished from natural terrain.

## Rebuild locally

```sh
python3 realm-ai-phone-build/prepare_v014.py /absolute/new-build-directory
cd /absolute/new-build-directory/veilforge_realm_v09_apk_ready
(cd bedrock-agent && npm test)
# Requires Android SDK 35, build tools, NDK 28.2.13676358, CMake 3.22.1, JDK 17, Gradle 8.9.
python3 tools/prepare_android_node.py
# Supply ANDROID_HOME / ANDROID_NDK_HOME and the environment's proxy/CA trust as required.
gradle -p android-app :app:assembleDebug :app:testDebugUnitTest --no-daemon --max-workers=2
```

The build intentionally produces an **unsigned** intermediate. Sign using the existing private backup and `sign_permanent_apk.py`, verify the pinned certificate, ZIP integrity, 16 KB alignment, application ID, versionCode and bundled runtime/source, then publish only the signed APK and public checksums/reports. No private signing files belong in Git or public reconstruction recipes. No automatic hosted build is introduced.

Node tests simulate protocol/physics/plans and exercise real 1.26.60 serializers. Android layout tests use Robolectric at 360×640 and keyboard-reduced height, exercise every parameterized catalog form and invalid-input handling. These checks do not prove live Realm walking, jumping, mining, PvP behavior or physical-device installation.
