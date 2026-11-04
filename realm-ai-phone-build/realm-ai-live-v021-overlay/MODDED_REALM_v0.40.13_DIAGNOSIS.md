# Realm AI Live v0.40.13 — modded pack handshake ordering candidate

## Live evidence (v0.40.12, Nov 3, 2026)

The same signed APK joins the unmodded Realm. On the modded Realm:
- Nine resource/add-on packs were advertised; all nine were requested.
- No CDN URLs were advertised; the server is responsible for pack headers/chunks.
- Required remaining size was about 179 MB, with about 27,876 MB free.
- The request used packet 8 with selector 2 (Downloading) and nine pack IDs, as expected for Minecraft Bedrock stable 1.26.60/protocol 2225.
- No ResourcePackDataInfo or ResourcePackChunkData arrived.
- Two recent traces closed roughly 600–640 ms after ResourcePacksInfo, with no explicit Minecraft disconnect packet.
- One-app binary is not inherently incompatible with Bedrock Realms: its existing unmodded join confirms authentication, encryption and basic transport work.

## Identified ordering mismatch

The bundled bedrock-protocol createClient.js queues ClientCacheStatus only after its resource_packs_info event listener runs. The custom modded handler instead immediately calls sendBuffer() with ResourcePackClientResponse/Downloading before the queued cache status gets on the wire.

This is an actionable protocol-ordering hypothesis, not a confirmed root cause. Mojang describes ClientCacheStatus as a once-at-login capability message. The previous v0.40.12 trace shows ClientCacheStatus *queued after* the direct download response.

## v0.40.13 targeted change

Only in a Realm advertising one or more packs and only in original-working mode:
1. Send client_cache_status(enabled:false) synchronously before requesting packs.
2. Suppress the native queued duplicate to keep it one-per-login.
3. Retain the Bedrock 1.26.60 Downloading selector 2 and all advertised IDs.
4. Preserve pack integrity checks, response completion order, and the early chunk-radius guard.

If the Realm advertises zero packs, use the exact prior queue/write path without any new status or serializer mutation. Auth, Microsoft saved tokens, Nintendo identity, gameplay, movement, UI, and update signing remain untouched.

## Checks

Three focused Node tests pass: modded cache-first ordering, byte-identical native no-mod path, and the nine-pack scenario without a duplicate cache status or an early radius request.

**Live modded-Realm success has NOT been verified.** The next signed update must use the original permanent Android keystore; its build.gradle package ID remains com.veilforge.realmagent.live and versionCode is 200042 (0.40.13). Do not uninstall v0.40.12 or clear account data.

A definitive next phone test should confirm packCacheStatusIssued=true, packWireCode=2, packWireIds=9, and either packHeaders>0 or an explicit disconnect reason. If it still closes before a header, capture the unified diagnostics and inspect the on-wire pack ID payload and whether a server-side entitlement/platform rule applies. Do not change unrelated systems.
