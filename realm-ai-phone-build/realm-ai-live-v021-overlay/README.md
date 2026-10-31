# Realm AI Live v0.21 source candidate

This is the complete source candidate based on the owner-provided Realm AI Live v0.20
archive, including its native Android updater, Java UI, embedded Node bot, tests and
C++ bridge. Application ID: com.veilforge.realmagent.live. Candidate versionCode:
200002. See `UPDATE-NOTES-v0.21.md` for the current UI fixes and signing requirement.

Generated build files, Node dependencies, machine-specific SDK/proxy settings,
compiled native libraries, signing private keys and passwords are excluded.

## Build

Use JDK 21, Gradle 8.9 and Android SDK platform 35/build-tools 35.0.0.
1. Run `python3 tools/fetch_native_runtime.py` to obtain the hash-verified ARM64
   native libraries from the published first release. No signing key is downloaded.
2. In bedrock-agent run `npm ci --omit=dev --ignore-scripts --no-audit --no-fund`.
3. Run `npm test` in bedrock-agent.
4. Configure ANDROID_HOME or android-app/local.properties for your SDK.
5. Run `gradle -p android-app :app:assembleDebug :app:testDebugUnitTest`.

The APK output is unsigned. For an update, increment versionCode and sign with the
same dedicated Realm Live private key from your PRIVATE signing backup.
Release-tooling/sign_release.py signs APKs and release notices; see --help.
Never commit the private key or password. Public certificate fingerprint is included.

Checks/downloads can run alongside the bot. Full APK installation requires Android
approval and restarts the application. This is not uninterrupted code hot swapping.
Validation of the delivered build: 186 Node tests and 24 Android tests passed;
APK/package/signature/alignment verified. No physical phone upgrade test was run.

Repository changes: https://github.com/timmytwopointoh/New-game-/pull/10
Original reconstruction tooling remains on feature/realm-running-updates-20261031.
