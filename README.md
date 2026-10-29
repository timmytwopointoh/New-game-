# Peks Plunder — retained game source

**Owner instruction (October 29, 2026):** The only game under active preservation is **Peks Plunder**, not ECHOFORM. This repository's default `main` branch still contains the older **ECHOFORM** prototype. It is retained temporarily for safe provenance and backup, **not** because ECHOFORM is the current game.

## Canonical Peks source

- Exact last identified Peks source snapshot: commit `5a96ba7ab2c8da7e96217703e07f33739fbe3431` on `keeper/peks-plunder-v043-source-20261029`.
- Code path in that branch: `peks-plunder/` (Android launcher, HTML/JS game logic and crab icon).
- Original release branch: `release/peks-plunder-v043-compat-20261028` (now with GitHub Actions automatic pushes disabled).
- **Build status:** the last v0.43 GitHub Android workflow FAILED. Do not claim that a working current APK exists from that run. Test with the local approved Android toolchain when PC resumes. Preserve v0.42/v0.41 fallbacks until v0.43 is locally verified.

## Boundaries

VEILFORGE Studio and VQ engine development live in their own local workspace and `timmytwopointoh/Engine-build`. The ChatGPT↔Codex task/result channel is `timmytwopointoh/Trion-Assistant-Lab/veilforge-link`. Game-specific assets and minigame logic must **not** be copied into the reusable VQ engine; reusable techniques should be extracted with tests and licensed provenance.

No hosted Actions runner is required. Before permanently removing ECHOFORM from default main or pruning branches, verify Git bundles/backups and Peks v0.43 build, then promote a reviewed game-only branch without losing unique source.
