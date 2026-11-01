# Realm AI Live v0.34 — console review test build

Update for `com.veilforge.realmagent.live`, versionCode 200015, retaining the permanent Live signing certificate and Nintendo Switch authentication profile. Install over the existing same-key Live app to preserve saved login and plans.

## Changes
- Thumb-operated command rail with searchable cards, six categories, haptics, keyboard and accessibility controls. Browsing never executes work. Commands can be browsed while offline.
- Dark teal field console, grouped settings, bottom command forms and reusable saved cards; immediate Stop remains visible. Microsoft code, Copy and official link remain available.
- Corrected resource-job server-position timestamp checks, retained approach targets and bounded interrupted approaches.
- Removed invalid client pickup notification. Automatic proximity pickup uses authoritative server position and matching inventory evidence; unrelated item gains do not count.
- Own-slot revision evidence and isolated container snapshots. Block placement requires a matching, newer item-consumption observation; stack replies never fabricate inventory.
- Trunks and unconfirmed chest checkpoints are described honestly rather than reported as finished forestry.
- Sanitized bug reports include inventory revision, held count, selected slot and placement progress, without raw inventory payloads or credentials.

## Verification and limits
312 Node tests and 47 Android tests passed. Native-rendered 360×640 and keyboard-height menu checks passed. APK source parity, unchanged native libraries/dependencies, package/version, signature and 16-KiB alignment verified. This is not proof of live Realm movement, mining, pickup or placement; test on the phone.

The supplied v0.34 source was an unreleased candidate with v0.33 metadata. This review preserves its language/context tools, task queue, gravity, modes, jumping/climbing, respawn, login and updater. It is a glossary/rule-based assistant, not a neural language model. Full crafting, chest placement/transfers and autonomous forestry logistics remain unfinished. Placement requires server confirmation and remains experimental. There is no automatic remote access to phone files; exported sanitized reports are shared by the user.

## Source provenance and future work
Imported original source archive SHA256: 05ef866fe83c532e1f770cb7a772715aba6c6de27f967384f707021cde13ecc8. Original owner handoff is retained as REALM_AI_CODEX_HANDOFF_v034.txt. Canonical directory keeps its historical v021 name; use this source rather than the unrelated top-level app.

Next: phone verification of join/login code+link, grounded walking/jumping, death/respawn, held mining with/without a suitable tool, resource pickup matching and placement receipts. Implement real server-acknowledged crafting/container transfers before claiming chest logistics; implement complete tree felling before counting trees. Preserve explicit activation and immediate Stop. No live Realm test occurred in this build session.

Build: JDK17 + Gradle8.9 + SDK35, local Java compilation and D8. Reuse published v0.26 native/dependency bytes, replace the freshly compiled manifest/resources, classes2.dex and complete current runtime source/tools/pack template, align and sign locally with the permanent Live key. Public reconstruction recipe contains signed APK bytes only; publishing workflow never receives private keys or compiles code.
