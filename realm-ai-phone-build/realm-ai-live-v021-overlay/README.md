# Realm AI Live v0.37 — survival workflows test build

Current package `com.veilforge.realmagent.live`, versionCode **200018**. This historical v021 directory is the canonical Live source; the top-level legacy app is different.

Read [build status, implemented behavior, testing and unfinished work](UPDATE-NOTES-v0.37.md) before continuing. This snapshot is experimental and needs live Realm testing. The source ZIP includes a plain-text copy, the original owner handoff, source/tests and public reconstruction helpers.

Run Node tests with `node --test tests/*.test.js` in bedrock-agent. Use JDK17, Gradle8.9 and SDK35 for Android. The test APK was compiled locally and published as already-signed public bytes; private keys never enter GitHub Actions. Preserve the existing Live key, Switch authentication, saved sessions and Stop/gravity behavior.

Earlier releases and their notes remain as history. Current validation: **357 Node / 47 Android tests**, source/runtime parity, package/version, permanent certificate and alignment. No phone/Realm acceptance is claimed.
