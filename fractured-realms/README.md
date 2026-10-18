# FRACTURED REALMS — standalone Android 3D game

This is a **new self-contained Godot 4.3 game**, independent of the existing ECHOFORM Android game in \`app/\`, earlier ECHOFORM 3D foundation in \`game/\`, Project-hail, VEILBOUND and other apps.

**Code isolation:** Only broadly reusable VQ/VEILFORGE *construction techniques* are shared: deterministic object descriptions, geometry primitives, material recipes, candidate model validation, a reviewed GLB-import protocol, and bounded Android emulator QA. New scene source, player combat, enemy behaviors, UI, levels, and authored models are specific to this game and live entirely under \`fractured-realms/\`. No other game's scenes, character models, source files, level maps or APKs are imported. An empty assets/approved/manifest.json means source procedural stand-ins are used until specifically reviewed GLBs are accepted.

**Gameplay:** Five 3D realms; cinematic 3D fly-through and caption sequence; single-player offline third-person character; three enemy archetypes plus level guardian; melee strikes and time-echo decoy; 3 memory shards per realm; guardian defeat + portal activation; five-level progression; menu, pause, retry, win; offline save.

**Controls:** Left swipe (Android) / WASD or arrows (desktop) to walk, on-screen STRIKE (or J) to attack, ECHO (or Space) to cast a decoy; escape to pause. Tap to skip cinematic.

**Build:** Open \`fractured-realms/project.godot\` in Godot 4.3. Android package ID \`com.fracturedrealms.game\` is separate from \`com.echoform.game\`; installing will not overwrite the old prototype. The CI workflow builds the APK with arm64 and x86_64 architectures, installs it on one Android emulator and checks a non-blank, input-responsive screenshot; shader/script errors fail the run. Only claim actual success when the GitHub run concludes successfully.

**Quality status:** procedural game vertical slice and original scripted systems, not AAA finished art or a completed campaign QA run. Fine mesh details, professional skeletal deformation, narrative voice, authored music, physical phone profiling, production textures and end-to-end balance require further refinements.
