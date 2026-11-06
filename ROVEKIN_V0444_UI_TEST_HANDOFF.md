# Rovekin native Android interface — isolated v0.44.4 integration

**Purpose:** Build a real Android test APK with the refined Rovekin menu and the current live Realm AI v0.44.4 engine, without interrupting the separate Realm development/test thread.

## Source and protection

- Baseline: `feat/realm-ai-companion-world-understanding-20261105` at exact immutable commit `d1f65fb878c694c7f6bdcbfe6d80550bd21af8e1` (v0.44.4, 200075).
- Integration branch: `feature/rovekin-ui-v0444-integration-20261106`.
- Android source: `realm-ai-phone-build/realm-ai-live-v021-overlay/android-app/`.
- New package version **200076**, name `0.44.4-rovekin-private-ui-test`, app display name **Rovekin**, unchanged Android application ID **`com.veilforge.realmagent.live`**.
- Original bot code, package/data storage, authentic Microsoft code, permanent signing, current Android BotService, protocol/pack handlers, home logic and updater are preserved. **Do not overwrite or cherry-pick gameplay source from this branch back into the evolving gameplay branch.**
- Guaranteed rollback source: protected working v0.43.7 release. This branch is *not* a verified replacement release.
- No edits to existing live Realm connection scripts, Node agent, resource-pack code, ADB diagnostics provider, private credentials or public update channel.

## Features implemented in native source (not mockup artwork)

- New complete Android screen flow via `RovekinEntryOverlay`: animated splash, tap anywhere, bot account name, owner/Realm invite sender name, real Android Connect, real Microsoft code/COPY/verification URL, live join/spawn status and chat-on-confirmed-spawn.
- Original full-body voxel robot-skinned companion character in `RovekinVfxView`, shaded green suit, block-world/portal, moving purple drip fluid, subtle hover, randomized particles. All motion rendered by Android Canvas; no printed-on fake UI buttons.
- Original full-body robot launcher icon vector `res/drawable/ic_app.xml`.
- `RovekinChatPanel`: native tactile/ripple green interactive buttons, chat transcript preserving original `MainActivity.log` and `scroll`, real status/build number, flowing purple accent `RovekinDripBar`, Send, Connect, Microsoft, Updates, Commands, Plans, Queue, STOP, Retry, research/learning and catalog-driven gameplay shortcuts.
- `RovekinActionRouter`, `RovekinCatalogAdapter`, `RovekinFeatureContract` map **every** feature and any future command catalog item to the old controller instead of adding a parallel game engine.
- `RovekinMainActivityHost` calls **existing** MainActivity methods, including urgent STOP, saved plans, reports and Developer Field Console.
- `RovekinInternalAccess`: debug-only private tester access to full owner/developer controls. Release builds fail closed. This does *not* qualify as secure owner/developer authorization for the eventual public edition; backend-verified entitlement is still a release blocker.
- Existing `MainActivity` only gains a wrapper and status notification; existing commands, queue and login routines are not rewritten.
- `RovekinFeatureContractTest` provides JUnit/regression coverage for command route completeness and role fail-closed behavior.

## Immediate build requirements (PC)

1. **Idle/isolated workspace only.** Never reset another chat's active emulator, installed phone, local source, cache, or existing Realm AI builder.
2. Fetch the exact integration branch HEAD and check `app/build.gradle` for versionCode 200076.
3. Verify all new Java files compile; fix any issues *only* on the isolated interface branch.
4. Run existing Node and Android tests, plus `RovekinFeatureContractTest`; do not claim passing tests before actually running them.
5. Build the real app with original bundled ARM64 Node runtime / native bridge, JDK 17 / SDK 35, using Gradle. The source alone is not the APK.
6. For **internal** owner preview, use a debuggable build signed with the original **permanent** certificate (SHA-256 `77694D4F0068469CB6F7FD951F84946A4BBB833AE2702DC2F87B9E0C2ADABF22`), and NEVER distribute this debug-enabled build publicly.
7. Verify APK contains the original native Node runtime and uses unchanged application ID. Check installed APK metadata/signature, install-over on *spare/idle* emulator only, cold start, visual screen interactions, actual Microsoft sign-in, Realm join/spawn and natural chat commands. Never install or uninstall on phone without explicit selected-device authorization.
8. Publish a **separate** test APK link and SHA-256, not to the existing auto-update feed or v0.43.7 golden release. Only after checks pass.
9. If unavailable, return exact missing tool/PC-status/build failure, not a fabricated APK.

## Source parity checks performed in ChatGPT

- 15/15 static source checks: original app ID and bot endpoints, Microsoft code, all 31 feature IDs routed, all 16 host callbacks implemented, original existing service, native UI connected, public role closed in release, original robot icon and separate name fields present.
- This is **NOT** proof of a successful Java compilation, Gradle APK, cert signing, visual emulator pass, or live Realm join.
- Connection to remote PC was found via `timmytwopointoh/Trion-Assistant-Lab/veilforge-link/`; build-only `VF-0019` request submitted. A request file alone is not proof the PC listener is online.

## Existing workstream boundaries

All ongoing follow/navigation, mining/building, mod-pack/connection and testing changes stay in the separate active development branch and preserve their existing emulator. After the menu proof passes, transplant the UI module onto the then-latest confirmed good source, keeping only the UI changes, and rerun the full regression matrix.

## Public release blockers (separate from private internal test)

Permanent-assignee authorization, trustworthy owner/developer entitlement validation, Play Store/commercial/legal compliance and wider on-device QA are not implemented by this UI patch; do not present them as completed.
