# VEILFORGE Realm AI v0.16 source overlay

This source-only overlay matches the v0.16 Creative/compact-controls test APK (versionCode 100009). It contains the reconstructed first-party Android and Bedrock agent source plus regression tests. It excludes Android SDK/NDK files, libnode binaries, node_modules, Microsoft session data, Realm plans, signing keys and passwords.

Inspect the candidate implementation in `bedrock-agent/src/survival`, `bedrock-agent/src/api.js`, `android-app/app/src/main/java/com/veilforge/realmagent/MainActivity.java`, and `android-app/app/src/test/.../PhoneLayoutTest.java`. Apply these paths over the v0.15.1 reconstructed build tree; production Node dependencies and the Android ARM64 Node runtime are required to build.

The test APK was built locally and signed with the owner-supplied permanent 2026 key. This overlay contains no private signing material.
