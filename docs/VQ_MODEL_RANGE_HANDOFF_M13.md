# VQ M13 — Model Range downstream handoff

The current test-range prototype lives in the **private Engine-build** repository on the isolated `feature/vq-model-range-android-m13-20261018` branch. It is **not** a replacement for this repository's working application or game.

The separately installable APK is named **VQ Model Test Range** (`game.vq.modelrange`). It supports walk, run, jump, touch-camera orbit, a small pickup/drop proxy object, and three physical viewing stands: near (**main character**), mid (**common enemy**), far (**prop/background**). It accepts manually selected local glTF GLB (rest-pose triangle geometry), OBJ and VQFORGE 1. It does not fetch network assets and does not automatically save or approve imported meshes.

Use the matching `ecosystem/model_range_handoff_v1.json` contract for exact limits, roles and acceptance scope. **The imported GLB does not yet display its PBR textures, alpha fur shading or skeletal animation inside the Android renderer**; this initial range is for genuine 3D scale/silhouette/distance and player-movement review. Never claim device PBR/fps or animated model quality from its basic triangles.

For the real M11 Vesperwing, first transfer the actual mobile GLB from the original user's review bundle onto a test phone, then choose **IMPORT GLB / OBJ** in the Range app. This branch contains no duplicate generated model binaries or archived game APKs.

Do not change existing gameplay or assistant code automatically. Preserve Project-hail knight, New-game- progress and Trion app behavior; only explicitly user-approved assets can be promoted. GitHub Actions artifact storage has been exhausted previously; a **single replaceable private review prerelease** is the delivery fallback, not unlimited artifact uploads or deletion of historical assets.

This file records a **reviewable integration contract only**. Additional cross-repository code integration requires the respective consumer's own tests and review. The source of truth is Engine-build, not a claim that all apps now share a live file-watcher or on-device GLB PBR renderer.
