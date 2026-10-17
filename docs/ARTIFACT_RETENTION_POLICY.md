# VQ ecosystem: save construction knowledge, not disposable models

**Permanent**: source code, construction languages, deterministic seeds and recipes, sculpting/rigger/material procedures, verified regression tests, topology/quality bounds, compact model manifests and user-approved assets. Never delete any of these as a side effect of CI.

**Ephemeral**: unapproved OBJ/GLB renders, emulated screenshots, debug APKs, temporary visual comparisons and intermediate tests. Build into the GitHub runner workspace or the future app's local cache; do not commit generated meshes to Git or upload them automatically. Write compact metrics + reconstruction instructions to source, not the full mesh.

**Promotion**: only after user review explicitly marks an asset approved/validated, preserve it in a separate versioned release or dedicated approved-assets location with hash, attribution, rigging/material metadata and reproduction recipe. Names containing `APPROVED`, `VALIDATED`, `GOLDEN`, or `KEEPER` are protected from the Actions artifact lifecycle, but explicit Git/release retention is preferred.

**CI**: cheap unit/geometry tests may run per push. Android emulators and large paired-app acceptance runs should be manual or gated to infrequent milestones. No default archival of giant APK/model bundles; diagnostics retain one day where necessary. Users can opt in to 2-day APK review output.

**Automated artifact lifecycle**: daily cleanup considers explicitly disposable artifact names only; keeps latest two copies per artifact name across branches and most recent successful build, never touches anything younger than 24h or containing known retention markers. New or unknown artifact types are retained until reviewed; account artifact usage may take time to update.

The policy applies to **GitHub Actions artifacts only**, not repository source, release attachments, caches, billing minutes or user device files. Do not treat structural/model tests as evidence of visual fidelity or gameplay success.
