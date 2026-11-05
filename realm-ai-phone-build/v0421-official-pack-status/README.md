# Realm AI v0.42.1 — Bedrock 1.26.60 resource-pack response candidate

## Reference evidence (2026-11-04, owner-authorized Realm)

Official Minecraft Bedrock 1.26.60, signed in as the invited account, opened the PetalWind Valley - Copy Realm and reached "Modified World". Resource-pack transfer progressed from pack 0/8 through pack 2/8, with approximately 156.8 MiB total advertised. The owner later exited after download progress stalled. This does not confirm an official world spawn or explain the timeout.

## Controlled candidate

- Base: fix/realm-ai-live-v0420-stable-pack-wire-20261104 at 7cb99bf337149a6a15caec667bfe6c8e80165e9e.
- New branch: fix/realm-ai-live-v0421-official-response-text-20261104.
- Modded-only response status names match Mojang's protocol 2225 documented strings: Cancel, Downloading, DownloadingFinished, ResourcePackStackFinished.
- Preserve the oneOf selector indices 0..3; those are separate from the ResourcePackResponse enum 1..4 in Mojang's release notes.
- Preserve the original unmodded-world handler, credentials, Realm selection, transport, and signing identity.
- Android application ID unchanged; candidate versionCode 200054, versionName 0.40.21-official-pack-status-test.

## Test evidence

- 14/14 isolated protocol, no-pack, and eight-pack simulation tests passed in GitHub Actions run 41956347335.
- Full Windows Node test suite: candidate 488/495 passed; 7 failures.
- Full Windows Node suite of unchanged v0.42.0: **the identical seven** tests failed (run 41957323300). Thus no *additional* Windows test regressions from this candidate were found.
- Tests are simulated; neither direct Realm pack headers nor successful modded spawn has been confirmed for v0.42.1.

## Installation / security gate

The persistent bot emulator currently reports com.veilforge.realmagent.live versionCode 200053, with its app data retained. The original JavaScript file could not be verified in app-private storage, so no in-place file edit was attempted. The Windows PC has Node and Gradle installed, plus Android SDK 35, but the approved private signing backup/vault was **not found** in the local locations checked.

Do not install an APK signed with a new key or uninstall the original app. To produce a test APK, build from this candidate branch using the original permanent signing certificate and a monotonic versionCode, then install using `adb install -r` without clearing data. No private signing material, passwords, device codes, or Microsoft tokens should be uploaded to a GitHub repository or Actions log.

## Live acceptance criteria

1. Original signed app updates in-place and retains the user's saved login.
2. No-pack Realm joins as before.
3. Modded Realm receives resource_packs_info, sends Downloading response, **receives at least one server header or valid CDN URL**, verifies the complete pack stack, and spawns.
4. Only after confirming a genuinely successful transfer consider this candidate a fix.
