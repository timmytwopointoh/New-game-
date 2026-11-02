# Realm AI Live v0.40.1 — full advertised modded Realm pack stack

Source branch: `fix/realm-ai-modpack-fullstack-v0401-20261102`.
Canonical Android identity in source: `com.veilforge.realmagent.live`, versionCode 200030, versionName `0.40.1-full-realm-pack-stack`.

## Diagnosis (2026-11-02 owner all-in-one ZIP)
- Working flat and vanilla Realms; new add-on Realm remains at pack-request.
- Snapshot: 9 packs advertised, only 8 requested, 1 skipped, zero server pack headers/chunks, zero received bytes after 31 seconds.
- Previous lastFailure is from a prior connection attempt, not proof the most recent 31-second attempt was rejected.
- Stored phone space ~23044 MiB vs needed 120 MiB, so storage shortage is not the primary suspect.
- The old required-only selection skipped an unmarked texture pack whenever addon_pack/has_scripts distinguished the others. Those flags do **not** establish that the other pack is safe to skip.

## Focused fix
- Select **every server-advertised** texture/resource pack and legacy behavior-pack entry, in the server's announced order, including entries with no add-on flags.
- Preserve advertised UUID/version IDs exactly in one Downloading packet. Never download a pack not advertised by the current Realm.
- Stop labeling ignored items as optional; expose `packSelectionPolicy=all-advertised`, counts and existing transfer progress in diagnostics.
- Preserve cache status ordering, early radius guard, modern response serialization, per-pack SHA256 verification, 512MiB per-pack and 1536MiB total limits, 256MiB free-space reserve, CDN resume, bounded retries, and 17-minute liveness window.
- Preserve Nintendo Switch authTitle and deviceOS, Microsoft token cache, live package ID, original signing certificate requirement, Android services, owner chat and gameplay.
- Do not run any downloaded pack scripts or grant server permissions not already configured.

## Verification & field test
- New test reproduces exactly 9 advertised, 8 tagged, 1 unmarked; verifies all 9 IDs in one Downloading response.
- Other selection and pack tests were rewritten for all-advertised behavior. Existing handshakes, CDN, Android and unit tests must pass in CI before release.
- A separate APK `Realm AI MOD PACK TEST` uses a distinct package and disposable signer, so it cannot overwrite the owner's original Live app or reuse its saved login.
- The main-ID build output remains **UNSIGNED** until it is signed privately with the unchanged original certificate. Do not call this an install-over update or upload the private key to a public repository.
- Live compatibility and successful Realm join remain unverified until tested on the owner's modded Realm.
- If 9/9 requested and still zero headers, investigate exact outbound packet sequence, server policy and transport rather than lengthening timers blindly.

Test steps: install side-by-side test APK, authenticate the invited second account, target only the test Realm, try joining the modded map, export Settings -> Bug reports -> all-in-one ZIP. Confirm `packAdvertisedCount=9`, `packServerCount=9`, `packSkippedOptional=0`, and whether headers/chunks become nonzero.
