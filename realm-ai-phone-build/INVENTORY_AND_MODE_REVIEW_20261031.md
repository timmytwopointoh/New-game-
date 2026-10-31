# Realm AI: missing shovel and apparent god-mode diagnostic candidate

This isolated review branch starts from the published v0.14 source. It does NOT replace or merge the Codex v0.15 mining/building workspace or secure APK updater.

## Changes
- Surface the bot's OWN game mode and active server-reported invulnerability/flying abilities in **Combat / invulnerability diagnostic**. This is evidence, not proof that PvP is enabled or disabled.
- Record short, bounded server-sent inventory snapshots and slot updates in **Inventory receipts / missing shovel**. Unknown network item IDs stay visible as `unmapped_item_<id>`, rather than being hidden. A dropped item is not counted as owned until server inventory receipt.
- Select hotbar equipment through one protocol request using only a known server-reported item descriptor; do not also send a PlayerHotbar request, modify the inventory map, or mark the selected slot confirmed until a matching server equipment/hotbar event arrives.
- Expose both diagnostics through the shared mobile Commands catalog. No auto-equip, fake /give, creative override, or forced Realm settings.

## Owner smoke test after proper APK integration
1. Ask for **Combat status**. Confirm `Own mode: survival`, `invulnerability: disabled` if actually reported, and no active special abilities. If the bot is Creative, the Realm owner must set its actual player to Survival (when authorized). If mode is Survival but you still cannot hit it, inspect Realm PvP and protection settings; hitting it is not a reliable mode probe.
2. Ask for **Inventory receipts** before handing the bot a shovel. Give/drop a single shovel. Repeat the command and check for a server-reported `iron_shovel` or other shovel stack and slot change. If there is no receipt, do not claim it was picked up; inspect item entity pickup handling and whether the item is still in the world.
3. If a shovel appears in a hotbar slot, use **Select hotbar slot**. Confirm that the server reports the held slot before any tool-dependent mining. If the server never sends the echo, report the pending selection; do not invent success.
4. Verify no duplicate packet, no item loss on changing selection, no Creative/flight grant, and no regression to Stop or Survival verification.

## Validation and limits
- Five dependency-free Node v22 helper tests passed locally.
- Source syntax was checked for both edited application modules and both new tests.
- New integrated server-packet tests were committed but are NOT executed here. Full 156+ regressions, Android APK compilation, permanent-key signing, emulator/phone installation and live Realm testing remain **not performed** for this branch.
- This is **not an APK**. No GitHub Actions workflow, signer, published release or update was started.
- Reconstruct source with `python3 realm-ai-phone-build/prepare_v014.py /absolute/new-build-directory`, then run Node and Android tests with the already approved local toolchain. For a real install, merge/rebase onto the current Codex v0.15 source, preserve package ID `com.veilforge.realmagent`, use the SAME permanent signing key, increase versionCode, and only publish after APK verification.
