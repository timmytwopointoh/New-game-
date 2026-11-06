# VQ/VEILFORGE reuse — no destructive merging
The owner's VEILFORGE Studio and VQ (VEYLQUORIN) are existing production tools. This game has its own runtime; it may request exports from them but must not copy an unknown engine tree, change installed Studio, or overwrite source.

Asset handoff contract:
```json
{"schema":1,"asset_id":"grim_001","kind":"chibi_resident","source_tool":"VEILFORGE/VQ","source_revision":"PINNED_COMMIT","format":"glb","mesh_path":"generated/grim_001.glb","license":"OWNER_ORIGINAL","validated":false,"target_budget":{"triangles":12000,"materials":8,"textures_max":1024}}
```
PC worker must verify geometry, UV/texture/material correctness, rig/animation tracks, mobile polygon budgets, GLB importability and visual screenshots through local VQ/Workbench before changing validated to true. No placeholder or generated file path is proof of a working model. Import only validated, licensed assets and retain original recipe + hashes for rebuild. Keep this isolated from older games and experiments.
