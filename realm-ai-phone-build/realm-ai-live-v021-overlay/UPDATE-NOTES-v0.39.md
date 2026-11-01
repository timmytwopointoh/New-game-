# Realm AI Live v0.39 — blocked retry, Minecraft knowledge and practical water risk

## Implemented in the source branch

- Android Try Again appears when continuous Follow or a saved walking card is blocked, refreshes received terrain, and reuses the original job/card ID. Stop is immediate and distinct.
- Offline Bedrock 1.26.60 block/entity names, descriptions, categorized behaviors and mining estimates for recognized tools, tiers and status effects. The export-knowledge.js tool produces JSON and JSONL for every block, entity and baseline tool timing.
- Mob HP is filled from curated or registry values when available. Unverified attack damage is null rather than guessed. The data does not authorize combat or edits.
- Navigation can wade across up to 8 consecutive observed, one-block-deep water cells when this meaningfully shortens a route. Unknown cells, lava, magma and deep water remain restricted. Live server movement still needs confirmation.
- Isolated pathfinder tests exercise wet/dry routes, water exposure budget and missing terrain.

## APK scope

The GitHub workflow compiles a real Android *preview* app with its own package ID (com.veilforge.realmagent.live.preview) and debug signature. That preview installs independently and cannot replace the signed Live v0.38 app.

The branch's main package ID remains com.veilforge.realmagent.live and versionCode is 200020, ready for a future signed v0.39 update. Shipping an install-over APK requires the **original Live signing key**, which is not included in public source.

Test on a nonessential Realm before relying on water movement or block destruction. Compare actual timing, server movement confirmation and status effects against the pinned data.

Chat examples: mining time dirt with hand; mining table oak_log; mob stats warden; about creeper; try again.
