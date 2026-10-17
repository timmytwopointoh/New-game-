# VEYLQUORIN shared cross-repository contract (2026-10-17)

This file is intentionally the **same on all four repositories**, paired with `ecosystem/vq_shared_rules_v1.json`. Use that JSON, then read `ecosystem/repository_role.json`, before modifying workflows, assets or app interfaces. The original agents' instructions remain in force.

## Preserve progress from Generate Human Model Template

The clean-room Human 03 procedure and 3D human improvements are isolated in Project-hail (`feature/vq-human03-cleanroom-technique-library-20261017`). The separate universal `VQShape/1` semantic language already has **chat-reported** actual GLB geometry/test results for a tree, chair, quad-rotor, crystal and bridge; do not recreate those as flat screenshots or a tree-only DSL. These are not yet certified as merged into all repository mains. The offline ForgeSpec M2 construction grammar and M1 Android runtime also exist as separate Engine-build feature work: preserve both, do not substitute an M1 starter template for them.

The rule for every new model: explain semantics with a portable construction recipe; reuse tested operations; improve base shapes and smooth surfaces before allocating extra triangles; inspect real geometry and rig/UV validity; keep the candidate in scratch until a person explicitly accepts it. **Never represent a generated picture as a GLB or an untested emulator as gameplay proof.**

## One shared storage and approval policy

Store scripts, procedure vocabulary, parametric recipes/seeds, compact measurements, defect findings, and exact hashes. Unapproved GLB/OBJ/APK files, screenshots and emulator build products are temporary; daily artifact cleanup protects two newest copies, latest successful, recent outputs and approved-name archives. Deletions only affect GitHub Actions artifacts, not Git source or local phone data. The existing storage recovery and VQ knowledge journal retain provenance. User-approved models should be pinned via explicit review and a durable release/asset location, not accidental build logs.

## Repository-specific responsibilities

`Project-hail` maintains VEILBOUND/old engine compatibility, human/Kaiyu references and game QA. `Trion-Assistant-Lab` makes the offline assistant and model-app interaction portable. `New-game-` is an independent game consumer. **`Engine-build` alone is the experimental emulator/runtime development exception**: emulator workflow source and device configurations can evolve on isolated feature branches, with bounded QA and no auto-promotion. The other three retain their established game testing but should not run unbounded automated emulator loops or save every APK.

Use the same recipe/format version, measured limitations, model hash and review state when handing assets between repositories; never copy generated models into every repo. Changes to one repo do not automatically synchronize others; propagate this shared contract version intentionally and review feature-branch overlays before merging.

## Validate

`python3 tools/verify_vq_ecosystem.py` is a fast, offline, standard-library check. It does not generate models, download assets, run Android or access GitHub APIs. It checks shared policy, local role exception, manual approval, and retained daily artifact policy. Match the exact content of this document and the shared JSON across repositories before claiming a complete handoff.
