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
