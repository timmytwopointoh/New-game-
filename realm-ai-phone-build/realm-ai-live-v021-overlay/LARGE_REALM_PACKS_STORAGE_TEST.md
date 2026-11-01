# VEILFORGE Realm AI Live — Large Realm Pack Storage & Recovery

## Source baseline

This feature branch starts from Live v0.39.5 on `sandbox/realm-ai-live-v034-menu-review-20261101`. It preserves the original Nintendo Switch Microsoft authentication flow, Android Live package identity in source, required-pack policy, the cache-status/radius ordering gate, and at most **two simultaneous CDN downloads**.

## Changes in the pack handler

- Downloads both server-listed texture and behavior packs when required by Realm pack policy.
- Allows up to **64 listed packs**, maximum **512 MiB per individual pack**, and **1,536 MiB combined**. These are safety bounds, not an estimate of phone storage or evidence that a particular Realm will join.
- Before sending a request for packs, checks actual free bytes in app-private filesystem using Node `statfsSync`. Requires the estimated not-yet-downloaded pack bytes plus **256 MiB free reserve**. Valid-sized, previously downloaded cache candidates and saved CDN fragments reduce the estimated new space requirement; their integrity is still checked separately.
- Never asks for all-files storage permission, clears Xbox authentication, or modifies Minecraft world files.
- Keeps incomplete HTTPS CDN `.download` fragments across clean disconnects or transient errors; up to **3 bounded attempts** per CDN pack with small retry delays.
- Uses `Range: bytes=N-` for partial downloads. Accepts HTTP 206 only when Content-Range correctly declares starting offset and total size. A full HTTP 200 response restarts safely; invalid ranges are refused, never silently concatenated.
- Raises an idle network timeout to **90 seconds**; this is an inactivity timeout, not a maximum for the entire pack.
- Streams cached SHA-256 checks to avoid reading a large CDN archive into memory. CDN SHA-256 is local cache-integrity evidence, *not* an authenticated Mojang-supplied hash. Existing server-chunk SHA-256 validation remains.
- Keeps optional cosmetics skipped on optional-pack Realms and defers gameplay terrain-radius requests until the v0.39.5 pack handshake and start-game stage allow them.

## Failure categories shown in UI / bug reports

`storage-low`: phone does not have enough free app-private space plus reserve. Free space and use manual rejoin.

`storage-unknown`: the phone did not report disk capacity.

`pack-size-limit`: server pack list exceeds bounded per-pack, total or count limits.

`network-interrupted`: CDN idle timeout, reset, DNS/connection failure, or incomplete transfer; downloaded CDN fragments are kept for resuming on reconnect.

`cdn-unavailable`: CDN HTTP 429 or 5xx; retry is bounded and a manual rejoin may help.

`cdn-access-denied`: CDN 401/403 or expired signed download URL; rejoin to obtain new metadata. Never write signed URLs to diagnostics.

`cdn-missing`: CDN 404/410.

`pack-integrity`: invalid size, mismatched range, mismatched hash or chunk offsets; corrupted fragments are never accepted as completed packs.

`pack-transfer-failed`: another error; export the sanitized bug report.

Saved diagnostics include only whitelisted failure reason, safe rounded MiB figures, and retryable status; never pack URLs, account names, tokens, Microsoft device codes or private signing material.

## Phone test checklist

1. **Do not uninstall Live v0.38/v0.39.5**; the separate test APK will use `com.veilforge.realmagent.live.largepacks` and a throwaway signing key.
2. Stop any existing Realm AI bot before launching a different test instance, since only one bot account may join at a time.
3. In the test app, configure the invited separate Xbox account (saved login is not shared with Live); join a Realm requiring large downloads.
4. Observe the progress text for MB downloaded and retry attempts. Interrupt network briefly, then manually rejoin, and check whether a partially downloaded HTTPS CDN pack resumes.
5. If join fails, export **Settings → Bug reports → Export ZIP** and share the ZIP. Check `connection.json` for `packStage`, `packReason`, `packFreeMB`, and `packNeededMB`.
6. **Do not claim confirmed live success from unit tests**. Required packs must finish and be checked before `have_all_packs` / `completed` messages are sent.

## Current limitations

- Server-streamed chunks (non-CDN) still restart from the beginning after a disconnect; they are SHA-256 verified before acceptance.
- A new temporary test signing key cannot update the installed Live APK. Production install-over updates still require the existing permanent Live keystore.
- The implementation reserves space and reports usage but cannot manufacture phone storage or change Android's actual storage quota.
