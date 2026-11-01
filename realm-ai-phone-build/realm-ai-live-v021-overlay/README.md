# Realm AI Live v0.36 — adaptive following

Current source: package `com.veilforge.realmagent.live`, versionCode **200017**. See [adaptive follow behavior and test instructions](UPDATE-NOTES-v0.36.md), [placement update and test instructions](UPDATE-NOTES-v0.35.md), [review and remaining work](REVIEW-v0.34.md) and [release notes](UPDATE-NOTES-v0.34.md). The historical v021 directory is the canonical Live app.

# Historical v0.26 background

Current complete source for package `com.veilforge.realmagent.live`, versionCode 200007 (`0.26-climb-recovery`). The directory name retains v021 for the permanent baseline; this is the canonical source for future Live work. Source from the separate `com.veilforge.realmagent` app has been merged here. Keep Live’s updater, identity and permanent key.

## Included

- Existing join/resource-pack handling, saved Microsoft login, continuous gravity, snow/partial-block collision, real movement inputs, bounded navigation, held mining input and server-confirmed building.
- Five saved plans, command forms, reusable cards, selected-first activation of waiting work, two-second sequencing and immediate Stop.
- The other app’s 5,000-word offline glossary, attribution, Minecraft context, chat categories and supported action synonyms.
- Private per-Realm confirmed word corrections (up to 200), review/forget controls, and automatic memory of server-confirmed task results, failures and interruptions. Outcome reminders help recheck a previously failed task; they never grant new abilities or auto-activate work.
- Live updater, Microsoft code/copy/clickable link, one-file sharing, Learning panel and copyable connection diagnostics.
- Corrects the bundled authentication library’s seconds/milliseconds access-token-expiry bug while preserving existing cached credentials. Error stages now distinguish Microsoft, Xbox token steps and Realm discovery/join.

This is a glossary/rule-based assistant, not an embedded neural language model. It does not train model weights, rewrite code, search the internet, or verify current claims against multiple web sources. Private data from a separate Android app is not automatically migrated.

## Build and tests

Use JDK 17+, Gradle 8.9 and Android SDK 35/build-tools 35.0.0. Run `python3 tools/fetch_native_runtime.py`, `npm ci --omit=dev --ignore-scripts --no-audit --no-fund` in bedrock-agent, then `gradle -p android-app :app:assembleDebug :app:testDebugUnitTest`. Node tests: `node --test tests/*.test.js` in bedrock-agent. All dependencies and native files are excluded from this source archive.

235 Node tests and 40 Android tests passed. APK/source parity, native/runtime preservation, package/version, signing certificate and alignment verified. Real phone connection remains unverified; the cache fix is not proof that every 403 is resolved.

## Permanent update key

Use alias `realm-live-update` and certificate SHA256 `77694D4F0068469CB6F7FD951F84946A4BBB833AE2702DC2F87B9E0C2ADABF22` for all future Live APKs and release notices. The owner authorized that replacement baseline in v0.21; do not generate another key. Install this version over that Live v0.21 to keep app data. Private signing backup stays outside this repository.

The v0.23 diagnostics can be opened without a running service and retain a sanitized last failure privately. Successful API replies now mark the local controller available. A title-token 403 may try one same-Android-identity Sisu exchange using an existing valid Microsoft session. See UPDATE-NOTES-v0.23.md for exact scope and phone-test limitations.

The owner requested restoring Nintendo Switch login in v0.24. Current identity is Nintendo / DeviceOS 12 / MinecraftNintendoSwitch title / live flow. Xbox service labels are not an Xbox-console identity. Switch uses private/auth/switch, retains the previous cache, and may ask for one device-code login. The Android-only Sisu recovery is disabled for this identity. Do not automatically change this profile back to Android.

Live v0.25 completes the Bedrock loading screen after terrain arrives, retries explicit flight-off requests until server confirmation, keeps mode changes pending until effective abilities agree, and distinguishes ground contact from flight permissions/server locks. See UPDATE-NOTES-v0.25.md. The owner reports that v0.24 joins and mode commands work; actual v0.25 landing/walking still needs a phone test.

Live v0.26 adds ordinary jump/drop routes, bounded server-confirmed dirt staircases, normal automatic respawn without task resume, and Settings → Bug reports → Export ZIP. Logs are private, bounded and sanitized, with no automatic upload or remote phone connection. See UPDATE-NOTES-v0.26.md for behavior, limits and testing. The owner verified v0.25 no longer floats; v0.26 traversal/respawn still need phone testing.
