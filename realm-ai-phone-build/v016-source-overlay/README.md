# VEILFORGE Realm AI v0.18 source overlay

This source-only overlay reconstructs the v0.18 command-batch test APK (versionCode 100015). It contains the first-party Android and Bedrock agent source plus regression tests. It excludes Android SDK/NDK files, libnode binaries, node_modules, Microsoft session data, Realm plans, signing keys and passwords.

This revision requires action phrases to start with `command`, treats unprefixed messages as questions/chat, exposes the full command picker when the user types `command`, removes the separate home Queue button, and activates all waiting cards with one green-button tap. The plan runner serializes commands, waits for server-confirmed work completion, then resumes after two seconds. Saved cards remain private and do not auto-resume after restart. The language parser distinguishes a height from a stack quantity and asks for clarification about slab-built structures; slab placement remains unsupported.

Inspect `bedrock-agent/src/survival/command-plans.js`, `bedrock-agent/src/api.js`, `android-app/app/src/main/java/com/veilforge/realmagent/MainActivity.java`, and the Android/Node regressions. Apply these paths over the reconstructed v0.9 build tree; production Node dependencies and the Android ARM64 Node runtime are required to build.

The test APK was built locally and signed with the owner-supplied permanent 2026 key. This overlay contains no private signing material.
