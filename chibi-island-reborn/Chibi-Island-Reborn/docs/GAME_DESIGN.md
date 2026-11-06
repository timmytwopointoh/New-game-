# Chibi Island Reborn — recovered vision and new design
Original project recovered from the owner's Chibi_Island_v9_7_preview.html (977,653 bytes) and original menu/character reference art. No old private files or embedded artworks are copied to the public transport.

## Identity
- Official game title: Chibi Island. Code project: Chibi Island Reborn.
- Residents: customizable Grims, big expressive heads, little animated bodies, unique personalities, social stories.
- Genre: cozy living-island simulation rather than a static menu or a one-character demonstration.
- Original inspiration: tropical port with beach, docks, cottages, café, arcade, park, library, market, garden and whimsical landmarks.
- Key promise: **Every Grim has a story**.

## Recovered mechanics
- Independently scheduled NPC needs (eat/sleep/work/socialize/roam), emotion expressions and idle/walk animations.
- Relationships, daily journal, resident memory, contextual conversations and gifts.
- Character Studio: body, eyes, eyebrows, cheeks, mouth, hair, outfit, accessories, personality, voice, preview and animation actions.
- Drag, tap, follow, pan and zoom camera interactions; time acceleration.
- Gather resources (wood/stone/flowers/cloth/crystals), purchase supplies, build/decorate with recipes.
- Swimming and rescue mechanics, water avoidance for non-swimmers; long-term ocean gameplay.
- Coins earned through activities, including Catch the Stars, island achievements and saves.
- Three save slots and backup import/export in the old prototype (new schema must not assume compatible JSON).
- Original project had multiple late HTML previews, with v9.7 the latest retrieved reference. Treat them as evidence, not as a native game engine.

## Rebuild architecture
- Godot 4.3+ native project and engine game layer in engine/, with no WebView dependency.
- ChibiWorld: authored procedural scenery generator, geometry/material family and reusable asset recipes.
- Grim: rig nodes, distinct meshes per body part, emotion/expression animation and resident profile.
- IslandMind: schedule / needs / social bond / journal simulation, deterministic state serialization.
- SaveSystem: native game-specific JSON with schema version and three slots.
- ChibiAssetBridge: validated VQ mesh-import contract, subject to existing VEILFORGE QA approval.
- Mobile-first GL Compatibility renderer for initial Android testing, desktop builds for diagnostics.
- No runtime network dependencies; multiplayer is a future separate module.

## v0.1 scope implemented vs backlog
Implemented in source: 3D island generated geometry, simulated NPC scheduling, animated Grims, touch/camera navigation, selectable residents, chat, gifts, resource gathering, bench construction, JSON saves and 3 slots.
Not implemented/verified: full Character Studio UI and extensive mesh library, advanced per-object occupancy/collision, swimming/rescue, catch-the-stars mini-game, complete crafting catalog, port/boat gameplay, 3D asset imports from VQ, fully authored character animation, sound/music, offline native runtime verification, APK/EXE compilation, online multiplayer.
Never call those finished until a PC test with evidence demonstrates it.
