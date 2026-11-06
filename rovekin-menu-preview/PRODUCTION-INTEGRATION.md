# Rovekin → Live Android app: integration and no-regression gate

**Integration target:** the **latest verified live Realm AI phone source** from the parallel gameplay/pack-testing conversation at integration time. Do not blindly merge the November 5 checkpoint, which may be behind newer connection fixes.

**This is a UI-shell upgrade, not an app migration.** Existing `com.veilforge.realmagent.live`, Android signing certificate, stored Microsoft session, saved Realm/home data, bot package, owner list, Node runtime, Gophertunnel/transport, pack handshake, updater and local controller must remain unchanged.

## Production modules ready for transplant

1. `integration/src/main/java/com/veilforge/realmagent/RovekinFeatureContract.java` — public/owner/developer capability list; dynamic live command catalog; truthful available/waiting/unsupported state.
2. `integration/src/main/java/com/veilforge/realmagent/RovekinActionRouter.java` — one route per UI action; existing MainActivity handlers only; no shadow bot/plan engine.
3. `integration/android/RovekinMainActivityHost.java` — Android MainActivity adapter, account-only owner settings, existing developer field console only for verified developer.
4. `integration/android/RovekinCatalogAdapter.java` — converts the unfiltered existing bundled/live `JSONArray` command catalog to native feature tiles.
5. `integration/android/RovekinChatPanel.java` — actual native working chat surface that reparents the existing transcript `scroll`, keeps `MainActivity.bubble()` and delegates actions to the original controller. No printed fake buttons.
6. `integration/tests/` — pure Java action parity and privilege tests.
7. `integration/verify_integration.py` — requires original Android methods, service, app ID, Microsoft code, command and plan/status endpoints to remain available.

**Do NOT copy** `rovekin-menu-preview/app/` as a second application into production; it is an intentionally independent demo APK package with no Realm service. **Do NOT import** its fake design-preview mode or inert Chat buttons. Move/upgrade the approved green theme and full-body robot-skinned player art as actual Android resources, keeping controls as native click targets.

## Current shipped app paths confirmed

- Android app: `realm-ai-phone-build/realm-ai-live-v021-overlay/android-app/`
- Existing activity: `app/src/main/java/com/veilforge/realmagent/MainActivity.java`
- Existing in-phone service: `app/src/main/java/com/veilforge/realmagent/BotService.java`
- Embedded command catalog and plan execution are owned by the existing `bedrock-agent/`.
- Live API methods verified in current protected snapshot: `send`, `showJobs`, `showPlans`, `activateQueuedPlans`, `stopNow`, `retryBlocked`, `showAuth`, `showLearning`, `startBot`, `stopServiceNow`, `showSettings`, `exportBugReport`, `update`, `saveAccountSettings`.

## Exact one-way integration boundary

```text
Native Android UI (Rovekin branding, animation, chat-first)
    |
    |  verified audience + real controller status + server skill catalog
    v
RovekinFeatureContract (availability and access presentation)
    |
    v
RovekinActionRouter (action to EXISTING handler)
    |
    v
RovekinMainActivityHost -> current MainActivity / CommandDeck / AppUpdater
    |
    v
EXISTING on-device BotService -> local authenticated 127.0.0.1 API
    |
    v
EXISTING Bedrock connection, Microsoft login, resource packs, world/plan execution
```

No second backend, no duplicated Microsoft client, no replacement game logic, no separate command parser. The original API remains authoritative. Newly added backend command IDs must remain browsable in the unfiltered live catalog even when the tile grouping has no keyword match.

## Roles (protect *actions*, not just buttons)

**Public member:** main Chat, browse current commands, plan queue, activate, STOP, retry, progress/status, sign-in and updates. Only enabled real skills are executable; unsupported skills show their status, not a fake response.

**Verified owner:** public features + account/Realm configuration and future explicit grant/revoke of permanent assistant use to another player. The owner and assigned player are *not* the same field; assignments are Realm-scoped and revocable. Changing the bot account while live requires stopping the bot first.

**Verified developer:** owner privileges + existing full field console, diagnostics ZIP, runtime logs and research/emulator/pack tools once actually integrated. New developer-only controls must not be reachable through the owner account screen. Do not claim reserved runtime-log/emulator/pack controls work when they lack handlers.

**CRITICAL RELEASE BLOCKER:** the present live backend does not yet provide a trusted owner/developer entitlement to this new UI. Until verification using authenticated account identity and a signed developer entitlement, no public build should expose owner/developer methods. A username in setup, hidden tap gesture, local flag or front-end-only gate is NOT authority. The backend must enforce authorization again at its own privileged endpoints. Public testers should not receive privileged diagnostics tokens through the UI.

## First-run and reconnect

1. Splash with real animated robot-skinned voxel humanoid, purple particles and tappable *native* text.
2. First-launch AI account name -> persists existing `botTag`.
3. Separate owner/invite sender name -> persists existing `ownerTag`.
4. Call existing `startBot`; if a saved Microsoft session exists, reuse it. No forced sign-in and no generated fake code.
5. Only when an actual `authChallenge.userCode` is received: show sign-in URL + usable code/copy control.
6. Connection, pack download, Realm join and spawn progress must come from existing `update()` status; never use fixed-timer success.
7. On actual server-confirmed spawn, show live chat. Unknown/unsupported/recovering states remain truthful.
8. Start eligible autonomous home tasks only after server-confirmed home coordinates match Realm, dimension and bot account and the player permitted autonomous work; STOP and newer commands take precedence.
9. Public releases never show an Android settings gear containing developer functions; use a limited authorized owner screen and full separate developer console.

## Feature preservation matrix

| UI feature or action | Existing authoritative route | Shipping rule |
| --- | --- | --- |
| Chat and text tasks | `MainActivity.send` → `POST /message` | Mandatory |
| All old/new command descriptors | `MainActivity.showJobs` → `GET /catalog` | Mandatory, dynamic/unfiltered discoverability |
| Plan queue/save/reuse | `showPlans`, `/plans` | Mandatory |
| Activate queued commands | `activateQueuedPlans` | Mandatory |
| Emergency STOP | `stopNow` → urgent `/stop` | Always available |
| Blocked movement retry | `retryBlocked` | Mandatory |
| Follow/explore/home/build/mine/farm/craft/inventory | Live command catalog, not new UI code | Expose only actual supported actions |
| Automatic research/learning | Existing chat/research/learning routes | Preserve current capabilities and limitations |
| Microsoft device login | Existing `showAuth`, real `authChallenge` | Mandatory |
| Realm and pack progress | Existing `update` / `GET /updates` | Mandatory |
| Existing saved session and identities | Existing private preferences + BotService files | Never clear/replace |
| Updater | `AppUpdater.show` | Mandatory |
| Account/Realm name edits | Owner-safe adapter → `saveAccountSettings` | Only verified owner; stopped bot for edits |
| Mode selection | Existing `modeAction` | Only verified owner, server authoritative |
| Delegated player | Separate identity + authoritative signed grant | NOT READY until backend authorization exists |
| Support ZIP | Existing `exportBugReport` | Developer only in new UI |
| Full developer field console | Existing `showSettings` | Developer only, verified authorization |
| Runtime log/pack/emulator inspector | Future real services; not fake UI | Keep marked NOT SUPPORTED until implemented |

## Copy paths for a future final integration

All five production-bound Java classes already declare `package com.veilforge.realmagent;`. Once rebased onto the **latest** good source, copy those exact five files into its existing `app/src/main/java/com/veilforge/realmagent/` package. Do **not** replace `MainActivity.java` wholesale. Wire a small reviewed patch to construct `RovekinMainActivityHost`, `RovekinActionRouter` and `RovekinChatPanel`; display the new chat panel after real sign-in/spawn and pass the original `scroll` to `create(scroll)` to retain all log bubbles. Feed `refresh(..., RovekinCatalogAdapter.fromLiveCatalog(catalog), connection.getText().toString())` from the existing status response. Move only the approved branding resources, not the independent preview application's manifest or package ID. Preserve current in-progress features from the other chat.

**Missing before live integration:** build and wire the production animated splash/AI-name/inviter/MS-auth/onboarding flow; extract verified real owner and developer entitlement from trusted authentication rather than local gamertags; and validate multi-Realm/home/assignment permission enforcement. These are release blockers, not optional future polish. The menu's preview-only `RovekinFlow` is a design state machine in a separate package; it must not be copied into production without real status integration.

## Pre-merge procedure

- Rebase/cherry-pick ONLY needed UI/integration sources onto the latest live build. Never merge older Android auth/transport files from the protected checkpoint over fresh parallel-work changes.
- Run `python3 rovekin-menu-preview/integration/verify_integration.py` and fix **all** failures. Build full Android app in the real toolchain; pure Java tests alone are insufficient.
- Review `git diff`: expected files are new UI classes, approved drawable resources and small view/status hooks in MainActivity, **not** Node connection changes.
- Exercise fresh setup, saved sign-in, Microsoft code, unmodded Realm, large/modded packs, join/spawn, command chat, queue, STOP, navigation, home tasks, updates, report ZIP and owner/developer access on emulator.
- Confirm old APK is replace-updatable with original package ID, signed by **exact** permanent certificate, increasing versionCode and no uninstall/re-login.
- Test that owner UI cannot invoke developer operations via altered intents, direct local routes, debug gestures or malformed input; retain real backend authorization. Do NOT ship sensitive signing keys or entitlement secrets in UI resources.
- Make sure every visible control actually calls its handler; no background artwork may contain printed fake buttons. Any unsupported feature is disabled with a useful reason and still accessible through live catalog when eventually implemented.
- Do not ship until runtime and emulator tests pass. The current branch is an isolated design/integration candidate, **not** a verified production APK.

**Static verification completed during authoring:** 13/13 inspected method/package/path predicates matched the protected source, and all 30 enum features were found in router case coverage. This is not a Java compiler run, Android build, role-security audit or Realm test.
