# VEILFORGE Realm AI — Gophertunnel reference comparison (2026-11-05)

## Why this investigation replaces speculative APK patches

The bot has **not joined the eight-pack modded Realm**. Do not claim that tests against synthetic event emitters demonstrate real acceptance by the Realm.

Sanitized user diagnostics from v0.42.8, versionCode 200061:
- Authenticated and received `resource_packs_info` containing **8 packs** (~156 MiB).
- Packet 8 `resource_pack_client_response`, **outer oneOf 1**, lowercase `downloading`, **8 `UUID_version` IDs**, **364 bytes**.
- Sender recorded NetherNet reliable transport **open** and no local send exception.
- No `resource_pack_data_info` (packet 0x52); no `resource_pack_chunk_data` (packet 0x53); zero CDN URLs.
- Server `disconnect` at ~269 seconds after request. **Remote receipt/ACK is not observable**.
- No pack stack, world entry, or spawn.

### What we actually learned from independent code

Gophertunnel mainline:
- `minecraft/protocol/packet/resource_pack_client_response.go` emits a **Varuint32 enum 0..3**, a **lowercase name string**, and pack ID list only for `PackResponseSendPacks=1`.
- `minecraft/conn.go`, `handleResourcePacksInfo`: it appends `UUID_version`, sends a single `PackResponseSendPacks` response with every needed pack, then waits for `ResourcePackDataInfo`.
- `minecraft/conn.go`, `handlePlayStatus`: it sends `ClientCacheStatus` after successful login; this is a blob-cache announcement, not a pack URL/download request.
- `minecraft/dial.go`: independently handles authenticated packets, pack cache, chunks, and resources; `Dialer.PacketFunc` provides decrypted packet capture.

Gophertunnel PR #537 (OPEN / **not merged**):
- Author reports some servers hang when client requests just one chunk at a time; their tested solution requests up to 100 chunks **per pack**, advances request window as chunks arrive, and reconstructs chunks by offset allowing out-of-order/duplicates.
- That improvement only helps **after** the first `ResourcePackDataInfo` header, so it is **not the current zero-header root cause**.
- Gophertunnel itself is not proof that its latest code joins this specific NetherNet/JSON-RPC Realm. Confirm the signaling transport and account/device authentication independently before treating it as a side-by-side control.

Other relevant issue: PrismarineJS/bedrock-protocol #844 reports a 1.26.60 relay error using our exact bedrock-protocol 3.61.0/minecraft-data 3.119.0 versions, but is not proof that the issue causes our Realm failure.

## Implementation already present

`bedrock-agent/src/modded-pack-response.js`: proper outer 0..3 oneOf selector, response spelling and list, transmitted with `sendBuffer(frame,true)` through Bedrock reliable transport.

`bedrock-agent/src/realm-packs.js`: responds for advertised packs, on receiving pack headers requests chunks and validates the assembled file; on modded realms suppresses the bundled library's premature `completed` ack; v0.42.9 delays optional cache status.

`bedrock-agent/tests/stable-pack-2225-vectors.test.js`, `modded-pack-response-only.test.js`, `eight-pack-complete-download-wire-v0417.test.js`: serializer and simulated pack event tests. **These are not network acceptance tests.**

## Required concrete next steps before another APK

1. **Independent controlled server:** Set up a local Gophertunnel listener with one real .mcpack, then eight, using `ListenConfig.ResourcePacks`, `AuthenticationDisabled` on loopback only, and `PacketFunc` to record packet ID/response type/pack count *without tokens or pack UUIDs*. No public server exposure.
2. **Full protocol, not just an EventEmitter:** Make the bundled Bedrock client connect through its real `Client.write` / `sendBuffer`, framing, compression/encryption and transport. Require the independent listener to log receipt of packet 8 with correct `UUID_version` list and to send at least one packet 0x52. Assert the bot sees that first header.
3. **Control client:** Gophertunnel Dialer connects to the identical test listener, downloads the packs, and observes packet 0x52/0x53. Compare actual server-received packet boundaries, serialized bytes, transport framing and timing between this control and our bot.
4. **Realm transport isolation:** Repeat with compatible NetherNet and authenticated Realms JSON-RPC signaling if supported. The official Minecraft client joining this Realm and an unauthenticated RakNet local test are **not** sufficient evidence. A separate Go reference client needs its own authorized Microsoft sign-in; don't copy or log Android auth tokens.
5. **Only if headers arrive:** Port and test PR #537's bounded per-pack pipelining, out-of-order assembly, duplicate handling and final integrity/size checks, preserving per-pack disk bounds and no auto-execution of add-on scripts. Use independent server tests with delayed, out-of-order and duplicate chunks.
6. **Release gate:** No more one-flag experimental APKs. Produce a signed update only after the independent Gophertunnel comparison identifies a reproducible mismatch or a control test proves the fix. Keep original signing key, application ID, in-place updates, and saved Microsoft sessions unchanged.

## Repro and success criteria

- **Pre-header failure:** server does not acknowledge/parse packet 8, or listener never sends 0x52; capture receipt at independent server before changing transfer code.
- **Transport failure:** local `send-mcpe` log exists but independent server receives no corresponding packet 8; investigate NetherNet encrypted framing/reliability.
- **Successful pack initiation:** independent listener confirms correct request, sends 0x52, and bot emits `resource_pack_data_info`.
- **Successful transfer:** all advertised packs are verified against server hashes, `DownloadingFinished` sent, server stack received, `ResourcePackStackFinished` sent.
- **Successful Realm:** live modded Realm connection reaches the player's actual `start_game` and `spawn` events, not just `joined`/pack-ready.

Reference links:
- https://github.com/Sandertv/gophertunnel/blob/master/minecraft/protocol/packet/resource_pack_client_response.go
- https://github.com/Sandertv/gophertunnel/blob/master/minecraft/conn.go
- https://github.com/Sandertv/gophertunnel/blob/master/minecraft/dial.go
- https://github.com/Sandertv/gophertunnel/pull/537
- https://github.com/PrismarineJS/bedrock-protocol/issues/844
