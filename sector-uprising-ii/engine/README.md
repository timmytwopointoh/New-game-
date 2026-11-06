# AFTERLIGHT Engine · dedicated Sector II game runtime

A sequel-specific, offline WebGL2 game engine. **Different from the existing VEILFORGE/VQ production engine**: we keep VQ as an optional upstream source of validated procedural models/recipes, never fork or alter its live Windows Studio installation.

This repository begins with a genuinely running game engine, not a folder of placeholders:

- `engine/runtime.js`: existing real WebGL2 rendering, world building, enemy logic, inputs, combat and progression (v0.1 has not yet been modularized internally).
- `engine/style.css`: independent mobile HUD/menu presentation.
- `index.html`: local modular browser entry point.
- `scripts/sync-game-assets.py`: deterministic build step that embeds these same files into the single-file browser playtest and Android offline WebView asset.
- `android/`: dedicated independent Android APK wrapper, app ID `com.sectoruprising.afterlight`.

**Quality gate:** source inspections/mock gameplay passed; real WebGL driver, Android emulator, performance on low/medium devices, gamefeel, visuals, and original stable release-signing identity remain unverified. Prototype != AAA. Do not publish as a finished APK until separately approved by the owner.

**Engine next steps:** split renderer/scene graph/entity systems/AI/nav/gameplay/UI into modules with deterministic seeds and tests; introduce asynchronous model/texture asset streaming with frame budgets; add VQ-compatible model imports using a versioned, read-only asset manifest; benchmark real Android GPU performance and add level-of-detail/occlusion/fallbacks. Preserve working v0.1 as a golden baseline.
