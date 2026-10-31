Test APK for VEILFORGE Realm AI v0.14. Install over the permanent-key v0.13 app; **do not uninstall**. Same application ID and permanent signing certificate, higher versionCode **100004**.

- Continuous idle/spawn/cancellation gravity; snow-layer and slab collision/support heights; server position reconciliation. Unknown physical terrain is requested, with disconnect after five seconds if still unverifiable, retaining saved login.
- Own server game mode and effective-ability checks. Automatic checks and Ensure Survival pause autonomous work until verified. `/gamemode survival @s` is requested only with server-reported command permission; no cheat/operator grants or global Realm changes.
- Complete shared command catalog and input popups. Commands and manual chat prepare up to five private, Realm-scoped cards. Select, then Activate Plan starts only that card. Completed cards are reusable; no automatic resume. Crafting/building/supply actions remain previews.
- Immediate Stop cancels intent/mining while gravity continues, bypasses queued phone work and rejects stale requests. Accessible Stop bot service control retained. Follow accurately reports waiting/unknown terrain/blocked states; ordinary walking/following never mine.
- Existing saved-session rejoin, pack fixes, explicit tool/protection-aware mining and server-feedback recovery retained. Plain player-placed dirt/stone cannot reliably be distinguished from terrain.

Validation: **156 Node tests**, **3 Android phone-size layout/form tests** (360×640 and keyboard-reduced height), real 1.26.60 serializers/pack-wire fixtures, APK ZIP/native runtime/source checks, 16 KB alignment and pinned-certificate signature verification passed. Wrong certificate backup is rejected before signing.

**Live Realm walking, jumping, mining, PvP behavior and physical-device installation remain unverified.** Do not infer game mode from being unable to hit the bot; PvP/spawn protection may matter. `move forward 3 blocks` remains unsupported.

Source: commit bf62b84a2a2daeda543b924bab4e897bd3cfd36c on `sandbox/realm-ai-v013-adaptive-recovery-20261031`. See `realm-ai-phone-build/SURVIVAL_CONTROLS_V014.md` for controls, limitations and local rebuild instructions. The local APK build used the existing permanent key; no hosted build or replacement key was generated. Only public APK/checksum/certificate/verification assets are included.
