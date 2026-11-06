# Peks Plunder — Full feature restoration and upgrade ledger

## Historical references
Preserved source: New-game- keeper/peks-plunder-v043-source-20261029, immutable commit 5a96ba7ab2c8da7e96217703e07f33739fbe3431. The old public APK was not conclusively validated. Treat it as a behavior reference, not a working runtime or approved art baseline.

## Foundation source created (UNVERIFIED on Android)
Original title Peks Plunder · The Ghost Shift; restaurant Pek's Old Port Cove; New Game/Continue/Credits; landscape HUD and joystick; offline saved day/coin economy; data-driven 3D environment, staffing, NPC walkers, waves, crab tanks and events; workstation and minigame loop.
Character order: Bailey, Blain, Anthony, Adam, Keylan, Arayell, Shauna, Jerry, Brandon, Joey, Parker, Alisa, Zack, [Tim, Tera, The Man with the Plan, Eddie, Jimothy, Spooderman].
Last six locked at 50/100/150/200/300/400 coins; last two prices are adjustable proposals. Arayell 1.5x earnings; Eddie 2x; Jimothy 3x; Spooderman 3x. Tim zero stats, Tera special tiki abilities, Plan Hawaiian shirt, Eddie mask. Jimothy MUST be a rotund RACCOON inspired by the July 2026 Seattle meme, not the previous human-with-glasses design. Spooderman intentionally goofy mismatched comic costume.

## Major visual overhaul — incomplete features that MUST be built and QA-verified
High-detail bespoke character meshes and costumes, modeled faces and personality, believable skin/fabric/wood/metal/water surfaces; VQ gray -> sculpt/smooth -> UV/material bakes -> rig -> animation -> LOD; asset provenance, reliable import, Android visual comparison. Professional title art and crab icon. Actual contact shadows, puddles/reflections, true lighting, occlusion, atmospheric day/night with spectral ghost shift, animated wind and wildlife.
Correct room continuity: tiki bar doorway to pier; direct chowder-to-kitchen connection; correct right-side service hatch and hallway; prep doorway; remove dining arrow door, obstructive kitchen table and erroneous kitchen prop. Improve brown plank dining floor, window trim, kitchen granite, handrails, pier, dock and deck; blue wooden crab tanks with lids, animated crabs, raised large crab; only three area nameplates Chowder Room/Kitchen/Prep Room.
Rich, nonrepeating role-specific staff and guest schedules, Dan & Diane visit with meaningful reward/penalty, lemonade explosion, Eddie running joke 'I found my underwear guys' knocking coins, dolphin and extra gator sightings, ghosts, expressive conversations. Kid-friendly decluttered readability.
Full real minigame implementations: dishwashing scrub/rinse/rack, tiki shake/ingredients, salad prep timing, delivery truck Tetris placement, crab catching, trash dumping, hot line/grill, order serving. The current repeated button-step prototype is NOT final. Multi-stage task chains and unique unlock challenges.
A progression and performance economy that feels rewarding: stars, daily goals, individual stats/perks, bonus combos, interactive upgrades, shift/campaign arc. Persistent save/resume and separately consented old save import.
Android phone portrait guardrails, proper joystick and collision maps, real animation, audio/SFX, day/night visuals, deterministic QA, offline and smooth FPS. PC emulator screenshots, crash traces and physical phone acceptance.

## QA / external dependencies
- [x] Isolated new source tree written on protected branch.
- [ ] Static JS syntax and data tests proven.
- [ ] Browser/WebGL rendering verified visually, performance measured.
- [ ] PC parent establishes dedicated PRIVATE Peks-Plunder repo/workspace, publishes receipt.
- [ ] Import VQ finished assets and benchmark Android LOD.
- [ ] Full-feature parity and high-quality visual benchmark achieved.
- [ ] Signed APK compiled, emulator-tested, device-approved and released.
Never modify original Peks package, old signing keys, Realm AI, Sector II, Studio, or consume GitHub Actions for this initiative.
