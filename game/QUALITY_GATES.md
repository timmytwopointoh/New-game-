# Development loop quality gates

1. Validate GDScript and scene imports headlessly.
2. Export an Android APK using Godot 4.3 templates.
3. Install on an Android emulator and confirm first frame.
4. Record FPS, frame time, memory and crash logs on target Moto G 2025.
5. Review screenshots for composition, realistic assets, materials, animation and lighting.
6. Only then merge tested work into main.

The existing GitHub Actions workflow performs steps 1-2; steps 3-5 remain unimplemented for the 3D build. Do not represent placeholder geometry as finished assets. Parallel worker orchestration is planned, not yet running.
