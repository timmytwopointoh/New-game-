# Aetherkin Nexus Android v0.2.0 — staged source for PC build and emulator QA
**This is an isolated GitHub transport branch, not the new PRIVATE target repository.** The user corrected the platform requirement: final game must be a standalone **Android phone APK**. The Windows PC and VEILFORGE listener are only development/emulator/build workers.

Immutable v0.2 source ZIP: `aetherkin-nexus/android-v0.2/Aetherkin-Nexus-Android-source-v0.2.zip`
SHA256: `3234e5e10515cbeb2d7898675698b2c4d8f64411f69c9b17977d15250f5a5fd9`
Bytes: `74960`  |  catalog: `360`  |  archive entries: `21`  |  static QA: `10/10`.
Source archive contains Android landscape touch controls, scrollable Codex, GL Compatibility renderer, dedicated Android export presets (phone ARM64 & emulator x86_64), new icon, performance limits, and isolated PC QA script.
**No executable APK, Godot parse-run, PC emulator or Android installation has yet been verified.**
User's existing VEILFORGE/VQ/Realm/Peks/Sector projects and signing materials must be left untouched. PC parent must reconcile earlier VF-0024 setup request first. Android build request to follow as VF-0026, only after independent private repo/workspace established and parent idle.
