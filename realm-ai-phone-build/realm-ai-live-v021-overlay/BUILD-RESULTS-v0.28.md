# Realm AI Live v0.28 — test APK build results

Build date: 2026-10-31 / 2026-11-01 UTC

- Built using verified Live v0.26 APK as unchanged native/dependency baseline, repository-supplied Android 35 build tools, local JDK 21 targeting Java 17, and D8.
- Android source compilation fix: combined the duplicate onActivityResult handlers while retaining bug report export, sharing, and Google research return handling.
- Same package: `com.veilforge.realmagent.live`.
- VersionCode: `200009`; versionName `0.28-autonomy-candidate`.
- Existing permanent Live certificate: `77694D4F0068469CB6F7FD951F84946A4BBB833AE2702DC2F87B9E0C2ADABF22`.
- Signed APK SHA-256: `d3ff787db40fc77dad6ecc0da95c1bfd15d4a281ee0f8867be5fe43302e67163`.
- APK bytes: `91516110`.
- GitHub temporary compiler inputs run: https://github.com/timmytwopointoh/New-game-/actions/runs/41255032430
- Android Java compile, D8 conversion, AAPT2 resource link, alignment, APK signing and certificate check: passed.
- 17 focused Node tests: passed.
- Runtime integrity: all 11,764 native library and dependency asset files are byte-identical after extraction to the verified v0.26 APK. All v0.28 `bedrock-agent/src/` files were verified embedded in APK.
- Verified private signing material and auth caches were excluded from APK.
- NOT YET TESTED: Android installation on owner's device, Microsoft session retention, real Bedrock movement, combat, placement, pickup, Gemini API responses, offline recovery and actual successful update install. These require device/Realm testing.
- The APK is a test update, not a proven autonomous survival release. Do not uninstall v0.26 as part of this update.

The private signing backup, keystore, passwords, and tokens are NOT included here.
