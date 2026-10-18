# ECHOFORM: Fractured Realms — 3D campaign (review build)

Godot 4.3 / offline-first Android. This expands the earlier ECHOFORM **3D foundation** with a separate scene, while preserving res://scenes/world.tscn and its original time-echo movement sample.

## Playable source design

- Original title menu, help screen, pause/retry, five saved stages and victory screen.
- Ten-second in-engine cinematic opening: moving real 3D camera, two letterbox bars and changing captions; any touch/key skips.
- Five deterministic and visually distinguished realm recipes: Ember Causeway, Hollowglass Forest, Drowned Archive, Iron Basilica and Crown of Hours.
- Third-person warrior with mesh-built limbs, helm, sword and armor, mobile/keyboard movement, health and strike animation.
- Stalker, Warden, Caster and Guardian combat silhouettes with chase/strike/cooldown behavior; themed by realm materials; a guardian in each realm.
- Gather three memory crystals, defeat guardian and reach a portal to progress. Progress saves offline at user://fractured_realms_save.cfg.
- Cast ECHO to replay a short recorded movement path and draw nearby enemies away.
- Deterministic procedural geometry, roughness/metallic/emission materials, patterned causeway, columns/ruins, trees, water, machinery, crystals, floating portals and optional shadows.

## What is not verified or production-ready

These are **authored procedural placeholder meshes**, not scans, imported VQ-approved GLBs, professional skeletal animation, a final cinematic movie, sophisticated AI/navmesh, or proven AAA visuals. The five maps reuse a corridor layout with scene-specific props; performance, Android orientation, collisions, all UI states and artwork require on-device review.

### VQ engine import boundary

Engine source of truth: timmytwopointoh/Engine-build (VEYLQUORIN/VQ). Runtime uses analogous deterministic scene/asset construction primitives and a **fail-closed offline GLB replacement adapter**. Place a reviewed Godot-importable GLB at res://assets/approved/<kind>.glb and explicitly add a manifest entry with review_status=approved, 64-character source_sha256 and a reconstruction recipe; only then the runtime attempts that GLB. This build deliberately has **no approved binaries**. Preserve source recipe, measured geometry evidence, licensing, QA and human review before altering the manifest. No automatic approval or cross-repo GitHub dependency.

## Build and test

Open game/project.godot in Godot 4.3, run main scene. Desktop: WASD/arrow keys to move, J to strike, Space for echo, Esc to pause. Android: drag left half to move, right-hand STRIKE / ECHO buttons. Stand near crystals to collect.

Cheap deterministic check: python3 game/tests/verify_campaign.py.
Real acceptance: Godot --headless --editor --quit -> Android APK export -> single Android emulator install/launch/menu-to-game screenshot/log -> physical phone FPS, visual comparison, controls and manual approval. CI APK and screenshots are short-retention review artifacts, not permanently approved assets.

Original independent Android 2D prototype in app/ is unchanged. Project-hail/VEILBOUND and the VQ Engine-build repository are unchanged by this branch.
