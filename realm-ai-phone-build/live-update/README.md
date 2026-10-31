# Realm AI Live: independent signing and running-app update delivery

This is a separate installation of the Realm companion requested by its owner on
2026-10-31. It does not use the other app's key or change its package.

* Application ID: `com.veilforge.realmagent.live`.
* First version: `200001` / `0.20-secure-updates`.
* Key alias: `realm-live-update`; public certificate fingerprint is recorded in
  `certificate-sha256.txt`. All future releases must use this exact key.
* Baseline: released v0.19 source overlay and native libraries, with independently
  verified SHA256 values in `prepare.py`. Its 186 Node tests passed locally.
  Earlier branch tests are not mixed into this release's complete source overlay.
* No private signing material belongs in this repository or public release assets.

## Running updates

The Updates button works independently of the bot's command executor. It checks
an HTTPS release feed, authenticates the exact notice bytes with the installed
application's signing certificate, and offers the signed version and notes.
Downloading uses a separate thread and private cache, with timeout and byte
bounds. The actual APK must match the signed SHA256/size, this installation's
package, the release version and its signing certificate. Android verifies the
APK again during installation. Redirects are restricted to GitHub's release hosts.

While the bot service is running it checks after 30 seconds, then every 15 minutes,
and can post an update notification. This can be disabled in Updates without
stopping the bot. Offline failures do not modify the app, queue or login.

**Checks and downloads work while the bot runs. APK installation restarts the app
and disconnects the bot. This is not uninterrupted executable-code hot swapping.**
The UI explicitly warns about this before installing. The user must permit this
app as an install source and confirm Android's installer. Login/configuration and
saved plans remain in the same app sandbox; the bot is not restarted automatically.
The independent package has fresh data on its first installation; it does not
import the other companion's private login. Only run one Realm companion at a time
because the existing loopback bot server uses port 8765.

## Source and compiler

Prepare a fresh build with `python3 realm-ai-phone-build/live-update/prepare.py OUTPUT`.
Run the resulting `bedrock-agent` npm tests and build `android-app` with JDK 21,
Gradle 8.9 and Android SDK 35. `:app:assembleDebug :app:testDebugUnitTest` produces
an unsigned APK and runs the UI/policy tests. Native libraries are reused byte for
byte from the pinned v0.19 APK; Java and Android resources are compiled from the
retained source. No stub runtime, native rebuild or emulator is substituted.
`sign_release.py --help` describes the signing command; it rejects a wrong package
or signing certificate and produces both the APK and signed release.json.

`realm-live-updates.yml` is a **manual-only** compiler/release workflow. No source
push launches it. It requires dedicated `REALM_LIVE_KEYSTORE_B64` and
`REALM_LIVE_KEYSTORE_PASSWORD` repository secrets. Do not point it at `VF_ANDROID_*`.
The current integration was denied access to the Actions secrets public-key API
(403), so these secrets could not be configured here. Their setup is the remaining
requirement for hosted signing. GitHub may require the manual workflow definition
on the default branch before workflow_dispatch is exposed; review/promote that
workflow separately without promoting unrelated legacy game source. Local signing
and release publishing do not depend on those hosted secrets.

Publish `Realm-AI-Live.apk` to a unique GitHub prerelease tag, then run
`publish_channel.py OUTPUT/release.json`. It advances only the dedicated
`realm-live-update-channel` branch. The phone never holds a GitHub write token.
The manifest expires after seven days; a new release requires fresh signed metadata.
Expired/offline feeds cannot authorize downloads. A phone clock is assumed valid.

The owner-requested private signing backup includes the PKCS12 key and its password.
Keep that backup private and durable; losing it prevents same-key updates. Do not
upload it as a public GitHub asset. It is separate from the public application APK.

## Validation limits

The bot regression suite, Android compilation, unit/UI checks, APK signing,
package identity, ZIP integrity and 16 KB alignment are separate checks. A successful
build does not establish phone installation, saved-data migration or live Realm
connectivity. This environment has no attached phone; those require a device test.
A second higher-version APK is still needed to demonstrate a complete phone upgrade.
No general phone-storage access, remote shell, accessibility service or device
administrator permission is added. Full application rollback is not automatic;
ship a corrected higher-version signed APK if needed.

Official references:
https://developer.android.com/studio/publish/app-signing
https://developer.android.com/reference/android/content/pm/PackageInstaller
https://developer.android.com/privacy-and-security/risks/dynamic-code-loading

## Observed local validation

JDK 21 / Gradle 8.9 build passed. The 186 retained Node tests and 24 Android
unit/UI tests passed (4 phone layout, 11 button actions, 7 release-policy and
2 update-screen tests). The signed APK passed apksigner verification, 16 KB
zip alignment, ZIP integrity, and exact packaged Node-source/native-library
comparison to the pinned baseline. OpenSSL independently verified the release
notice signature using the new public certificate. No real device test ran.
