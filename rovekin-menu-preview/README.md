# Rovekin — exclusive native Android menu preview

**Status:** Isolated, unmerged design implementation. It does NOT modify the live VEILFORGE Realm AI app, its signing certificate, package identity, connection engine, stored Microsoft credentials, or update feed.

**Source branch:** `design/rovekin-exclusive-menu-v1-20261106`, created from the protected `checkpoint/realm-ai-v0440-companion-field-20261105` snapshot. The other conversation's live app can evolve independently.

## Branding
- Proposed one-word product identity: **Rovekin** (not a trademark clearance).
- Original neon-green rounded block surfaces; dark forest-green backgrounds; violet/purple Nether-inspired motes; original floating companion head, not Mojang/Microsoft artwork.
- Splash: gentle vertical bob on logo, purple particles, animated "Tap anywhere to begin" prompt.
- Android adaptive foreground/background icon can be produced from the same original geometric robot motif at integration time. Never show an official Minecraft or Microsoft logo as Rovekin's product identity.
- Independent companion disclaimer for public releases: "NOT AN OFFICIAL MINECRAFT PRODUCT. NOT APPROVED BY OR ASSOCIATED WITH MOJANG OR MICROSOFT."

## Actual app to preserve
- Existing app: `realm-ai-phone-build/realm-ai-live-v021-overlay/android-app`
- Current protected baseline package ID: `com.veilforge.realmagent.live` (do NOT change this in a production update).
- MainActivity.java already reads `botTag`, `ownerTag`, `realmName`, `token`, `serviceStarted` from private preferences.
- `startBot()` already sets `minecraft.botPlayerName`, `ownerPlayerNames` and starts the Android BotService.
- `showAuth()` / status polling already display the real Microsoft user code. **Do not substitute mock codes, forge a verified session, or alter sign-in identity.**
- DO NOT touch app updater, signing key, Node/Gophertunnel handshake, Realm resource-pack flow or world automation on this branch.

## Required sequence
1. Launch icon -> animated splash (tap anywhere).
2. First launch: AI player's *own separate Minecraft/Xbox gamertag* -> Continue. Stored as `botTag`.
3. Realm invite sender / owner gamertag -> Continue. Stored as `ownerTag`. Must differ from the bot's own account. Ownership and permission assignment are NOT the bot's Microsoft account credentials.
4. Launch *real* BotService after both fields are validated; display the authentication state while it checks saved session. If and only if the service requests Microsoft device-code sign-in, show the actual user code and verification URL, with Copy code and Open sign-in page. Never invent a code or show an empty code as actionable.
5. Authenticated -> joined realm -> terrain/spawn confirmation -> chat dashboard. Keep waiting if joined but not spawned.
6. On future opens, skip completed setup and reuse valid saved Microsoft session. Never erase auth data because of menu updates. If reauthentication is requested, return to sign-in.
7. Chat dashboard keeps **Power, Updates, STOP, Activate queue, Commands and Send**; does not put the old gear/settings button in the header. Administrative functions can be placed under a clearly labeled **Manage** sheet in a later integration, gated by owner approval.

## Identity and trust boundaries
- `botTag`: the separately authenticated AI account; does NOT grant player command authority.
- `ownerTag`: Realm inviter / assistant owner who may authorize reassignment; a string field alone is NOT proof of owner identity.
- `assignedPlayerTag` (separate, future): beneficiary of permanent assistant assignment. NEVER overwrite `ownerTag`, `botTag` or Microsoft session with this value.
- Ownership/assignment must be verified against authenticated in-Realm player identity and explicit owner approval; allow revocation. The current live backend enforces `ownerPlayerNames`, so granting an assignee permission requires a separate reviewed backend change, **not** a UI-only rename.
- Joining an invited Realm is distinct from an assigned player being the Realm owner. When bot is on a particular Realm, only execute assignments valid for that Realm.
- `home`: existing confirmed bot-world home position, scoped by Realm ID + dimension + bot account. Only schedule autonomous home work if the bot actually spawned, confirmed the same Realm ID, the stored home was server-confirmed, current permissions allow tasks, and STOP isn't active. Stay command-responsive. Never fabricate home coordinates or a ready state.

## Implementation in this folder
A standalone Android **menu preview** uses its own app ID and has no network, credentials, or Realm operations. It is not a production replacement APK. The native, independently testable Java `RovekinFlow` is the integration contract. Preview can show the chat layout without pretending to be connected. No live APK is built or released by this project.

## Acceptance checklist
- [ ] Fresh install shows splash, AI name then owner name, never skips the names.
- [ ] Existing saved setup opens splash then checks saved session; no forced Microsoft sign-in.
- [ ] Copy button only enables for an actual real device code; expired codes disable it.
- [ ] Owner, inviter and delegated player do not overwrite one another; transfer is explicit and revocable.
- [ ] Main chat omits gear but retains stop, power, updates, command queue, picker and send.
- [ ] Joining without spawn cannot claim "online" or start tasks.
- [ ] Home tasks cannot start until server-confirmed home is scoped to the active Realm and bot.
- [ ] Current signed APK, permanent key, Microsoft session, app identity and update path remain unchanged.
- [ ] Merge/integration only after independent tests and a reviewed small UI patch; test on Android emulator and phone.

## Sources
- Microsoft device code flow: https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-device-code
- Android adaptive icon layers: https://developer.android.com/develop/ui/compose/system/icon_design_adaptive
- Minecraft usage guidelines: https://www.minecraft.net/en-us/usage-guidelines
