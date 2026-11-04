# Realm AI Live — arbitrary Realm pack support: v0.40.13 diagnosis

Based on owner's real-phone export on November 3, 2026:
`Realm-AI-Live-ALL-DIAGNOSTICS-1793765521283.zip` (this file and private Realm identifiers are NOT checked into GitHub).

## Confirmed from the v0.40.13 installed app (versionCode 200042)

- `resource_packs_info` parsed successfully and advertised **8 packs** totaling ~156 MB, matching the official Minecraft Android client's recorded 8-pack/~156 MB join.
- The client selected all 8 server-advertised packs dynamically; none were hardcoded.
- Classified 1 resource and 7 addon packs; 0 legacy separate behavior packs.
- All 8 were missing from Realm AI's app-private verified cache; sufficient free phone space.
- The client sent `client_cache_status` once, then produced a verified response frame for `Downloading` with status selector 2 and 8 pack IDs. Both writes reached the local open reliable-send boundary. This does NOT prove the server accepted or acknowledged the packet.
- In three attempts, transport closed 0.779, 0.618, and 0.638 seconds after `resource_packs_info`, before any `resource_pack_data_info`, any `resource_pack_chunk_data`, or `resource_pack_stack` packet.
- No CDN URLs were advertised in this particular Realm; all eight were expected to transfer directly from the server.
- The preceding v0.40.12 build also stopped before pack data. v0.40.13's changed cache-status order therefore did not solve the early close.
- The empty-pack path previously worked and must remain byte-for-byte behavior compatible.

## Actual blocker and requirements

This is an **outbound pack-transfer handshake/client compatibility problem**, not a fixed-list lookup or Android file-layout problem. Fixing the cache filesystem cannot make a server send nonexistent transfer headers. Mojang's 1.26.60 protocol uses ResourcePackClientResponse ID 8 with the modern Downloading enum selector 2. Our outgoing frame is *locally* encoded and verified; server receipt/acceptance is not established.

The application must query `resource_packs_info` on **each** Realm connection and select exactly that Realm's announced content (including add-on and legacy behavior packs). The existing implementation already does this within bounded limits; added seven regression tests for 0, 1, 8, and 9 arbitrary packs, separate resource/behavior, CDN metadata, and malformed lists. Do not introduce a hardcoded pack catalog.

Before any new change to on-wire behavior:
1. Independently decode and compare the complete 1.26.60 ID-8 client response packet against an authoritative protocol schema or a known-working Bedrock client, not merely a local roundtrip through the same stale serializer.
2. Establish whether the RakNet reliable packet is **ACKed by the server** and obtain sanitized close/kick details. Current sendReliable counts are local send observations, not acknowledgements.
3. Validate pack identifier/version strings, optional content keys, packet ordering and client capabilities; distinguish a server rejection from a transport-level failure.
4. Run controlled tests against a Realm with one small pack and then the original eight, preserving the exact same client identity and auth.
5. Only after the server begins sending headers, validate streaming, per-pack hashes, chunk requests, resume/cache, content decryption/metadata and correct pack-stack ordering. Make the bot recognize custom blocks/items/entities without executing untrusted add-on scripts.

## Limits and non-regression

"Any Realm" means Realm-supported packs compatible with the bot's negotiated Bedrock version and the bot's storage/size limits; proprietary assets, entitlement-gated packs, unsupported script execution or future protocol versions may require additional compatibility handling. Do not claim arbitrary marketplace entitlements or that the bot runs all mod scripts.

This investigation branch changes **tests and documentation only**. It does NOT alter the installed v0.40.13 APK, sign a new APK, touch Microsoft sessions, change the Nintendo identity, affect unmodded joins, or trigger a GitHub Actions release build.
