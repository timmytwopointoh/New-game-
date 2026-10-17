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
