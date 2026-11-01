# Realm AI Live v0.35 — single-block placement controls

Package com.veilforge.realmagent.live, versionCode 200016. Uses the same permanent Live key; install over the existing Live app to retain saved login and plans. Switch authentication and the v0.34 command rail remain unchanged.

## Try placing one block
1. Put dirt or another supported full solid block in the bot's hotbar.
2. Open Commands → Build → Place one block. Enter the material and an empty target cell beside the bot on known natural ground. Y is the target block cell, just above the ground, not eye height. Keep it within four blocks of a visible support face and outside the bot's body.
3. Save, then press the green Activate control. The bot selects a matching hotbar stack, aims at the support face and sends the use-item click. The progress message identifies the target and hotbar slot.
4. Success requires a server block update. Survival also requires an actual newer inventory receipt showing one block consumed; Creative does not require consumption. If rejected or unconfirmed, placement stops with an explanation. Stop remains immediate.

## What changed
- Read the server's inventory-authority flag separately from the mining-authority flag.
- Send modern placement clicks inside player_auth_input with item_interact; use a standalone inventory transaction only for explicitly legacy inventory. A click is sent once per target, never on both paths.
- Include the real old/new hotbar stack prediction in Survival, including the last-item empty-slot transition. This is a wire prediction only: local inventory and terrain are never changed to pretend it worked.
- Creative uses the actual known held block without manufacturing an item or predicting consumption.
- Keep correct-slot equipment delay, face/reach/collision/protection checks, server confirmation, timeouts and cancellation.
- Expose pending target, clicked anchor, selected slot and input protocol in building status for debugging.

## Verification and limits
316 Node tests and 47 Android tests passed; targeted placement/climbing regressions passed again after progress-report changes. Tests serialize actual Bedrock packets and simulate independent server receipts. APK package/version, exact permanent signing certificate, alignment, runtime-source parity and unchanged native dependencies were checked. These checks are not a live Realm placement test.

Full crafting, chest/container logistics and complete autonomous forestry remain unfinished. Placement still supports simple full solid blocks, preserves existing blocks, and requires observed clear space/support. This update does not add interactive chests, slabs or arbitrary Creative inventory creation. Please test a single dirt block first and export Bug reports if the server refuses it.

## Rebuilding
Compile Android Java/resources with JDK17, Gradle8.9 and SDK35. Use package_live_v034_apk.py with the pinned public v0.26 base, current DEX, canonical overlay and freshly compiled resource archive. Align and sign locally with the existing Live key. The v0.35 publish workflow reconstructs only the already-signed public bytes from the published v0.34 APK; private signing material is never uploaded.
