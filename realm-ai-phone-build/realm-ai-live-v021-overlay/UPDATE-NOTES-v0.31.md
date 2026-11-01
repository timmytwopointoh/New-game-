# Realm AI Live v0.31 — Bot-owned lookup and task research

This update retains the Live application ID, Nintendo Switch login profile, saved data/queue, updater, chat repair, v0.30 respawn protections and the established permanent signing certificate.

## Changed
- The bot can invoke its own fixed HTTPS dictionary for unfamiliar instruction verbs without opening the owner's lookup browser or requiring a Google key.
- Where a private Google AI Studio key has been configured, open-ended owner task instructions such as "go get wood" are routed to the existing grounded research planner automatically. This also works for valid owner-only Minecraft Realm chat commands prefixed `!ai`.
- The old command-parser rejection no longer prevents eligible, unfamiliar Minecraft task requests from reaching research.
- No separate green Activate tap or copy/paste through Chrome is needed for supported automatic research tasks.
- Settings → Internet word lookup explains this separation. Its browser buttons remain optional owner tools.
- The bot refuses to treat external explanations as scripts or permissions; all generated steps pass through existing observed-terrain, known-hotbar, game permissions and command-queue verification checks.
- Normal questions, STOP and unrelated chat cannot automatically initiate research.

## Limits
- Google AI Mode's browser button is not an API. Multi-step Google AI research requires an API key set ONCE in the app, and may incur Google charges. The key is stored in private app storage and not packaged, logged or committed.
- Without an API key, automatic online word definitions are available, but free-form AI task planning is NOT supported.
- Research proposals do not create missing game actions. Combat, server-verified placement, mining, collection and respawn still require live Realm testing.
- Test results are unit/simulation evidence, not phone/Realm confirmation.

## Packaging
- Android package com.veilforge.realmagent.live, versionCode 200012, versionName 0.31-bot-owned-lookup.
- Compiled against Android API 35 using Java 17 / D8; preserved previously verified ARM64 Node runtime and Bedrock dependencies.
- Signed using the existing permanent Live certificate (not a new signing key). The private key/password are NOT included in this source package.
