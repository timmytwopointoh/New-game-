# 🌴 Chibi Island Reborn
**Every Grim has a story.** An original standalone cozy 3D island life-sim, rebuilt from the owner's Chibi Island/Living Island design; not a repackaging of the earlier HTML preview.

This is a **new source baseline**, not a completed tested release. The dedicated ChibiWorld engine layer combines procedural environment generation, resident animation and needs/schedule AI, relationships and memories, building economy and native save slots. It uses Godot 4.3+ for rendering/export rather than embedding a WebView.

## What's playable in the current source (pending native PC verification)
- 3D tropical island, colorful cottages, palms, flowers, water, park benches and a central fountain.
- Five original customizable-profile Grims, with body-part animation, blinking and expressive moods.
- Autonomous eating, sleeping, exploring, socializing, creating and arcade routines.
- Talking, gifts, island stories, resource gathering and bench-building actions.
- Camera pan, touch selection, zoom, simulation speed and three independent saved islands.
- Local-only play; no account, telemetry, network permission or external engine dependency at runtime.

## Run on an authorized PC
Open `project.godot` with an existing Godot 4.3+ installation, select the main scene and Play. See `docs/BUILD_AND_QA.md` for exact static, runtime, screenshot, save and Android export acceptance gates. Run `python tools/verify_source.py` for structural checks only.

## Repository separation
Target private repository: `timmytwopointoh/Chibi-Island-Reborn`; this source is staged in an isolated transport branch until the owner-authorized PC parent creates the new repository. Never use GitHub Actions or edit any installed VEILFORGE Studio, VQ, Peks, Minecraft or Sector project for this task. No historical 1MB HTML assets or private material are included in the public stage. Optional VQ model maker integration has its own manifest and quality gate.

## Status
Source created; PC Godot build, QA, screenshot test, native EXE, and APK **not yet verified**. Full Character Studio, animations/audio, swim/rescue and minigames are tracked in `docs/GAME_DESIGN.md` as milestones, not falsely marked finished.
