# Realm AI Live v0.38 — Follow clearance

Current package `com.veilforge.realmagent.live`, versionCode **200019**. The historical v021 directory remains the canonical Live source.

Read [Follow fix and test instructions](UPDATE-NOTES-v0.38.md), then [v0.37 workflows and remaining work](UPDATE-NOTES-v0.37.md). Source ZIP includes current and previous build notes, a manifest and public APK reconstruction helpers. Preserve the permanent Live key, Switch login and saved sessions. The unrelated top-level app is different.

Validation: **360 Node / 47 Android tests**, source/runtime parity, exact permanent certificate, package/version and alignment. New behavior still needs owner phone/Realm testing. Node tests: `node --test tests/*.test.js` in bedrock-agent. Android uses JDK17, Gradle8.9 and SDK35. See previous build notes for the frozen native-runtime packaging procedure.
