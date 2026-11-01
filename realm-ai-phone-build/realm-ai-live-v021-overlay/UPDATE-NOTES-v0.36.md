# Realm AI Live v0.36 — adaptive following test APK

Package com.veilforge.realmagent.live; versionCode 200017. Same permanent Live signing key and Switch login identity. Install over the existing Live app to retain saved sessions and plans.

## Follow behavior
The owner explicitly authorized terrain edits during follow, superseding the earlier follow-never-mines rule. Activate Follow player as usual. It tries observed walking routes, detours and one-block jumps first. If these fail, it can use existing dirt from the hotbar for bounded stairs or a straight short bridge, then consider mining reachable natural-looking obstructions with the real held item. Ordinary non-clearing walk jobs do not gain mining permission.

- Planned drops are at most five blocks, measured from actual collision support heights. A six-block fall is refused. Five-block falls can still hurt: Survival requires known health with a margin above the work-stop threshold, plus an observed clear, non-hazardous landing column. Unknown terrain is never treated as air or support.
- Existing short stairs support local rises up to four blocks. New bridges support straight spans of up to six missing floor cells at a fixed level. This is bounded local recovery, not arbitrary construction over every chasm or vertical cliff.
- Dirt must already exist in known hotbar stacks. Creative still requires a real known dirt item but does not consume it. The bot does not invent supplies or mine underfoot to obtain them.
- For bridging, normal sneak/walk input approaches the bank edge while collision support remains. Each support block requires server confirmation (and Survival inventory consumption) before crossing. Server-position disagreement pauses placement. Stop cancels construction and releases sneak immediately; gravity continues.
- Follow can clear reachable natural-looking foot/head obstructions only after no jump/detour/dirt route succeeds. It keeps mining held until a server block update confirms the break, then replans and continues following. It uses the actual held item, hardness, reach and finite recovery limits. Replanning cannot interrupt an active block break or overwrite a pending bridge placement.
- Likely player builds, containers, protected blocks, hazardous/unknown terrain and unsuitable tools remain blocked. Plain player-placed dirt/stone still cannot reliably be distinguished from natural terrain. No teleports, flight, setblock or automatic permission grants are used.

## Try it
Put dirt in the bot's hotbar, select a suitable real tool when testing mining, then save and activate Follow player. First test a one-block rise, a short empty-ground trench, and an easy natural obstruction. Watch placement/break confirmations and use Stop to interrupt. If blocked, export Settings → Bug reports and share the ZIP; the app does not grant remote phone-file access.

## Validation and remaining limits
326 Node tests and 47 Android tests passed. Added regressions cover five-versus-six-block drops, low/unknown health, missing/hazardous landing columns, bridge planning capacity, unknown/overlong spans, Creative supplies, real serialized sneak/use-item controls, independent block/inventory receipts, Stop and pending-placement isolation, natural-obstacle mining and protected builds. Existing jump, climbing, mining, inventory, login, queue and respawn tests still pass.

APK runtime/source parity, unchanged native libraries/dependencies, compiled package/version, exact permanent certificate and 16-KiB alignment verified. Public recipe reconstructs the exact locally signed APK from the public v0.35 release. No private key is sent to publishing Actions. No live Realm test occurred; bridges, falls and following still need owner phone testing. Full crafting, chest logistics and complete autonomous forestry remain unfinished.
