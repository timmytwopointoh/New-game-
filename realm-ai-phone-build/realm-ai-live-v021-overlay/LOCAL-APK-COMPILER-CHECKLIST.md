# Compile Realm AI Live v0.28 — controlled local-only process

This source ZIP deliberately omits signing secrets, the verified APK, native ARM64 libraries and third-party `node_modules`. A source ZIP cannot install as an Android app. **Build only after these dependencies are present.**

1. On a trusted computer with JDK 17, Android SDK platform 35/build-tools 35.0.0 and Gradle 8.9, open this directory. Read `tools/prepare_android_node.py`, `tools/fetch_native_runtime.py` and the pinned native provenance before acquiring the ARM64 runtime. Do not use unpinned replacements for the released native patches.
2. `cd bedrock-agent && npm ci` with network access, then `node --test tests/*.test.js`. Do not compile until the full suite can load.
3. Prepare `android-app/app/src/main/jniLibs/arm64-v8a/libnode.so` and `libveilforge_bridge.so` and all required Node assets as documented in the project. Ensure the compiled runtime uses the same patched dependencies as the verified Live baseline.
4. From `android-app`, run `gradle :app:testDebugUnitTest` and `gradle :app:assembleRelease`; inspect compile outputs, manifest, native libraries and bundled Node source. A successful Gradle command alone is not game-test proof.
5. Sign ONLY with the existing permanent Live keystore in private offline storage. Use Android build-tools `zipalign` and `apksigner`. Verify package `com.veilforge.realmagent.live`, versionCode `200009`, signature certificate SHA256 `77694D4F0068469CB6F7FD951F84946A4BBB833AE2702DC2F87B9E0C2ADABF22` and native `arm64-v8a` libs. Never put the signing key/password in a command checked into source control, any logs, or GitHub Secrets without a separate reviewed secure process.
6. Install with Android's standard same-key update flow without uninstalling v0.26. Confirm saved Nintendo Switch authentication, saved plans and Google key privacy. Test a sacrificial Survival Realm before world editing, then export bug reports when a server transaction fails.

In this isolated run, `gradle`, the Android SDK, D8 and native ARM64 runtime are unavailable. The base APK download is not reachable. Thus no v0.28 `.apk` can be produced or verified here, and the old published v0.26 APK must not be relabeled as this version.
