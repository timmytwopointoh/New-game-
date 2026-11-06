extends RefCounted
## Runtime visual budgets, manually selectable and future platform-adaptive.
const PROFILES = ["battery", "balanced", "cinematic"]
static func apply_level(viewport: Viewport, sun: DirectionalLight3D, level: String) -> void:
	match level:
		"battery":
			viewport.msaa_3d = Viewport.MSAA_DISABLED
			sun.shadow_enabled = false
		"cinematic":
			viewport.msaa_3d = Viewport.MSAA_4X
			sun.shadow_enabled = true
		_:
			viewport.msaa_3d = Viewport.MSAA_2X
			sun.shadow_enabled = true
