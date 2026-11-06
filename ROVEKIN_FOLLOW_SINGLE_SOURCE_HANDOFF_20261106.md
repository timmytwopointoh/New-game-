# Rovekin + persistent Follow: current integration target (Nov 6, 2026)

**Owner direction:** Stop separately evolving the old interface or the prior standalone Follow candidate. Continue the combined Rovekin + Follow work from the integration branch specified below. This instruction applies to the project workflow when a developer reads this handoff; it does **not** remotely stop another active chat, Android emulator or GitHub worker.

## Canonical integration source

- **Branch:** `feature/rovekin-clean-follow-v0445-20261106`
- **Root:** `realm-ai-phone-build/realm-ai-live-v021-overlay/`
- **Follow foundation:** `fix/realm-ai-follow-persist-no-disconnect-20261106`, immutable base commit `95b671ea2a8be61b6a257c634ccf0a9882179dcb`, v0.44.5 / code 200077.
- **Additional follow fix:** validated one-shot navigation reattachment (`Navigation.recoverFromLiveSpawn`) from `feat/realm-ai-companion-world-understanding-20261105`, merged into this branch's navigation and controller; matching `follow-live-spawn-recovery.test.js` transferred.
- **Current integrated variant:** `versionCode 200078`, `0.44.5-rovekin-clean-follow-preview`.
- **Android package:** `com.veilforge.realmagent.live` (unchanged).
- **Original certificate:** SHA-256 `77694D4F0068469CB6F7FD951F84946A4BBB833AE2702DC2F87B9E0C2ADABF22`; original key stays off GitHub and is essential for an in-place update.
- **Actual release state:** integration **source exists, not yet compiled/phone-tested**. Do not label this as a signed, proven APK.

## What was carried over from the Follow Navigation work

1. Persistent Follow pending readiness/grounding; not a silent cancellation when terrain is not known
2. Never intentionally disconnect merely to patch navigation
3. Preserve live Follow route, detours, home anchor, held follow retry and recovery logic
4. Signed data-only Follow tuning feed from `realm-ai-follow-live-patches-20261106/follow.json` (no code execution over the network; signed data)
5. Controller, Android follow status, navigation APIs, existing tests, source tree, user session logic
6. Bounded one-shot movement-loop reattachment from the parallel live-spawn repair branch, only when actual Realm spawn, observed abilities and safe terrain checks pass
7. No changes to another chat's working branch, PC emulator, golden release, signed update channel or installed app.

## Refined Rovekin interface implemented here

- Native Android animated splash; green original full-body blocky robot, **112 purple particles** on splash/connecting screens
- Modern dark emerald/violet native main chat with **118 additional floating purple particles**
- A flowing purple drip accent and glossy, press-animated controls
- **Exactly three main chat buttons:** **CUTOFF**, **START**, **SEND**. Single chat input remains at bottom; no main-surface Plans/Queue/Commands/Updates/Sign In/Retry buttons or build/version text
- Main transcript displays the bubble contents only, not `VEILFORGE`, `Progress` or `YOU` sender prefixes. Preserve text/log events internally
- Tiny original pixel companion bottom-right in chat: idle, follow/walk, mining/pickaxe, crafting, and building/carpentry workbench. The controller's **real** survival/navigation state selects the animation; no invented work.
- First-time onboarding retains distinct bot and owner gamertags and a real Microsoft device code. Returning configured users skip the welcome/setup sequence and proceed to live connection; chat opens after **actual** server-confirmed spawn.
- Owner and developer functionality remains in the original controller and action router. Release entitlement defaults closed; hidden controls must never become public bypasses.

## Next steps only (do not separately rework older UI or navigation source)

1. Use *this* branch as the sole joint integration starting point for ongoing Follow + Rovekin development; if any newer Follow branch appears, compare and selectively port its verified changes into a **fresh** integration branch or this one after review. Do not cherry-pick an older MainActivity over newer gameplay.
2. Run current Node tests, including `live-follow-home-anchor.test.js`, `live-follow-patches.test.js`, `follow-live-spawn-recovery.test.js`; run Android `testDebugUnitTest` and `assembleRelease`. Fix actual errors, no disabling tests to fake a green result.
3. Build a signed Android APK with the owner’s original permanent key on the approved PC; preserve installed session, same package identity, and all handlers. An optional separate-package GitHub preview needs its own login and is **not** a true in-place update.
4. Test login, real Microsoft code, existing session, spawn-to-chat, START, CUTOFF, SEND, Follow pathfinding, home anchor, unfinished tasks, pixel work animations, screen fit at 360dp x 440dp and 360dp x 640dp.
5. Never auto-trigger hosted GitHub Actions except with a fresh explicit request; original owner preference is to use PC build resources. Preserve all mainline work.

## Coordination requirement

A different ChatGPT thread **cannot be remotely paused or instructed by this file alone**. Share this GitHub path/issue with the "Fix Follow Navigation" thread before its next edit. That thread should treat this branch as the single joint integration candidate and avoid continuing unrelated improvements to its earlier frozen Follow source.

User-visible handoff phrase:
> Continue from `feature/rovekin-clean-follow-v0445-20261106` in `timmytwopointoh/New-game-`. The latest live Follow work and new clean Rovekin UI are integrated there. Do not work on older UI or Follow branches or run competing tests; read `ROVEKIN_FOLLOW_SINGLE_SOURCE_HANDOFF_20261106.md` first.
