# First PC milestone — honest release gates
1. Only on the owner-approved PC workspace root, check existing repo and directory; no overwrite.
2. Use Godot 4.3+ **installed already**, do not download dependencies on shared PC without owner approval.
3. Open project.godot with Godot editor; import and check script parser warnings.
4. Run `godot --headless --editor --path . --quit` (if installed) and `godot --headless --path . --quit-after 120`.
5. Launch Windows viewport and verify 3D environment, 5 moving Grims, selectable dialogue, Character Studio appearance/name persistence, Catch the Stars coin awards, ocean shader animation, gift coin deduction, gather, build bench, Save Slot 1, Continue Slot 1, and slot isolation.
6. QA targets: 60 FPS PC or stable 30 FPS budget Android with battery/balanced/cinematic profiles; legible UI on 1280×720 and phone landscape, no crashes, consistent saves, no residents off island, no invisible buttons.
7. Run standalone `python tools/verify_source.py`. If successful, note only **static contract pass**, not game launch.
8. Optional VQ bridge adapter only after verifying local VEILFORGE/VQ source paths, mesh export formats, and license/provenance.
9. For Android: verify SDK/export templates and key storage in owner-approved secure environment; package signed APK **without touching existing Realm AI/Peks signing keys**. Test real install and in-game controls before describing as Android-ready.
10. Publish test status as explicit PASS/FAIL/NOT RUN in private repository; never claim success from a queued task.

Quality roadmap: preview and crash-free first, then expressive face/hair/outfits, proper stylized town models, 8-direction locomotion and interaction rigs, animated water and trees, contextual menus, crafting, resident memories, dynamic events, swim-rescue, minigames, audio, day/night sky, localization, platform optimization, optional multiplayer.
