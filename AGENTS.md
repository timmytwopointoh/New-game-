**Owner superseding directive, October 29 2026:** Keep **Peks Plunder v0.43 source** on `keeper/peks-plunder-v043-source-20261029` and verified earlier fallbacks. The ECHOFORM `main` branch is legacy and should not receive new feature work. Preserve its content temporarily until all branches are backed up and the latest Peks build has passed local tests. The VQ/VEILFORGE engine is separate from game sources; the GitHub Codex bridge in `Trion-Assistant-Lab/veilforge-link` requires **no GitHub Actions**. Do not launch any automatic hosted builds. Prior ECHOFORM-specific instructions below are historical, not active priorities.

# Worker Coordination — ECHOFORM / Android Game

Read https://github.com/timmytwopointoh/New-game-/issues/4 for verified storage remediation, active workflows and instructions shared with other development chats. Shared VQ / VEILFORGE / VEILBOUND workers are documented at https://github.com/timmytwopointoh/Project-hail/issues/29.

## Guardrails
- Preserve game and Android source, model references, backup files, and latest successful playable APK. Avoid changing the separate Project-hail repository during ECHOFORM development.
- Run expensive Godot export and Android emulator jobs only on game/runtime changes, meaningful integration milestones, or CI regression verification — not on repetitive documentation or metadata changes.
- Keep automatic tests on the active feature/aaa-3d-foundation branch. PR #2 preserved feature-branch push testing with path filters. PR #3 reuses the same compiled Gradle APK in the emulator and replaces a broken legacy SDK-tools install with hosted SDK packages.
- Archive short-lived APKs for about 7 days and smoke screenshots for about 14 days; do not make these expiry rules apply to source or long-term recovery assets.
- A safe, bounded artifact cleanup ran on maintenance/storage-reclaim-20261017; prefer auditing first and protect the newest two per artifact type/branch plus last successful output. Never broaden deletion to source, backups, or unverified unique art.
- Verify source/test run links and real conclusions before calling anything passed. The handoff issue tracks the four fresh CI regressions.

Other chats do not receive this file as a direct notification. If a worker is asked to coordinate, read the linked issues and AGENTS files first.

## Repeatable storage relief
Use the **Storage recovery - safeguarded audit and reclaim** GitHub Actions workflow on `main`. It is manual only and defaults to `apply=false`, which inventories candidates without deleting anything. Review the candidate count and estimated bytes in the job summary. Select `apply=true` manually to remove at most 125 superseded allowlisted artifacts per invocation. Never add protected backups, source, latest emulator-tested APKs, or repair tasks to this delete allowlist.

## Shared VQ ecosystem contract — 2026-10-17-storage-and-nonregression-v1

Before any further changes read `ecosystem/vq_shared_rules_v1.json`, `docs/VQ_CROSS_REPO_HANDOFF.md`, and `ecosystem/repository_role.json`. The Generate Human work, Human 03 clean-room procedural geometry, and VQShape/1 universal language are existing achievements, not throwaway templates. Preserve their independent branches and QA; do not claim unimported GLB files exist in this repository. No generated mesh or game candidate gets user approval automatically. Keep procedural rebuild recipes, exact hashes, proven techniques, tests, and local offline portability. Only Engine-build may evolve the experimental emulator runtime settings on isolated branches. The other repos use manual/review-gated emulator testing. Never delete approved assets, knowledge, source, references, recovery files, or working game builds to save Actions space.

## Realm AI Live — active Android app, 2026-10-31

The owner clarified that the Realm companion work must be integrated into **Realm AI Live**, package `com.veilforge.realmagent.live`. Its current complete source is `realm-ai-phone-build/realm-ai-live-v021-overlay/`, with versionCode 200005 (Live v0.24). The separate `com.veilforge.realmagent` v0.22 APK is a different installation and is not the current Live update target. Preserve the Live updater and saved-session logic.

The owner explicitly authorized ONE new permanent signing baseline after loss of the previous Live key. Current public certificate SHA256: `77694D4F0068469CB6F7FD951F84946A4BBB833AE2702DC2F87B9E0C2ADABF22`; alias `realm-live-update`. Use this exact key for all future Live APKs and update notices. Never generate another key without explicit owner authorization. Private material and the verified backup are outside the repository at `/workspace/private-realm-live-signing-v021/`; never commit or publish them. The old F268 certificate is historical. Installing the new baseline requires replacing the previous Live app once, losing its app-local data; subsequent higher-version updates using the new key preserve data.

Pending Microsoft code/Copy controls and clickable official URL are tested, as is the one-file share action. The reported HTTP 403 is not proven fixed by these UI changes. File sharing gives access only to files the user selects; it does not grant the assistant live phone filesystem access.

Live v0.22 merges the separate app’s 5,000-word glossary and all existing source features into the canonical Live tree. It adds Realm-scoped correction/task-outcome memory, Settings Learning and credential-free Connection diagnostics. There is no neural model or autonomous code training. The reproduced OAuth access-token expiry unit bug is corrected in connection-diagnostics.js; live 403 resolution remains unverified. Current validation: 205 Node and 28 Android tests. Use live-v022-publication for the signed update manifest; all future builds retain the 77694D4F certificate.

Live v0.23 fixes the local API availability flag and makes sanitized connection diagnostics available offline, persisted in nodejs-project/private/diagnostics/connection.json plus Activity private preferences. The latest screenshot showed xbox-title-token HTTP 403. A bounded one-time Sisu title recovery reuses the Android identity and a valid cached MSA token without requesting a new login. Phone acceptance remains unverified. Validation: 210 Node / 34 Android tests. Current signed release/notice is live-v023-publication. Preserve the same 77694D4F signing key.

Owner directive for Live v0.24: RESTORE Nintendo Switch authentication, authTitle 00000000441cc96b, deviceType Nintendo, DeviceOS 12, flow live. Keep this identity; do not infer an Xbox-console identity from Xbox account-service error labels or automatically switch the phone client back to Android. Use private/auth/switch for persistent Switch tokens; retain the old auth cache. Microsoft may request one code for this profile. The Android-only Sisu recovery is disabled for Switch. Keep touch movement, all merged features and offline diagnostics. Current validation: 211 Node / 35 Android tests; current publication is live-v024-publication. Same permanent 77694D4F signing certificate. Phone Realm acceptance remains unverified.
