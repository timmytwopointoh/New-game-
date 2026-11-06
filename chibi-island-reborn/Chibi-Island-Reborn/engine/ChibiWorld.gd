extends RefCounted
## Procedural stylized island factory. Every piece is original geometry.
var sites: Dictionary = {}
var root: Node3D
var rng := RandomNumberGenerator.new()
const COLORS = {
	"grass": "#7bd4a0", "sand": "#ffe4a5", "sea": "#5bc6e8",
	"roof": "#ed788a", "wood": "#b98562", "wall": "#fff7e9"
}

func mat(hex: String, rough: float = 0.7) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = Color(hex)
	m.roughness = rough
	return m

func water_material() -> ShaderMaterial:
	var shader := Shader.new()
	shader.code = """
shader_type spatial;
render_mode cull_disabled;
void vertex() {
	VERTEX.y += sin(VERTEX.x * 0.23 + TIME * 1.3) * 0.08;
	VERTEX.y += cos(VERTEX.z * 0.28 + TIME * 1.1) * 0.07;
}
void fragment() {
	float ripples = sin((UV.x + UV.y) * 38.0 + TIME * 1.6) * 0.07;
	ALBEDO = mix(vec3(0.13, 0.50, 0.75), vec3(0.30, 0.85, 0.89), 0.63 + ripples);
	ROUGHNESS = 0.28;
	METALLIC = 0.05;
}
"""
	var material := ShaderMaterial.new()
	material.shader = shader
	return material

func put_mesh(parent: Node3D, shape: PrimitiveMesh, at: Vector3, color_hex: String, rotation_y: float = 0.0) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.mesh = shape
	mi.material_override = mat(color_hex)
	mi.position = at
	mi.rotation.y = rotation_y
	parent.add_child(mi)
	return mi

func box(parent: Node3D, size: Vector3, at: Vector3, color_hex: String) -> MeshInstance3D:
	var m := BoxMesh.new()
	m.size = size
	return put_mesh(parent, m, at, color_hex)

func ball(parent: Node3D, scale_vec: Vector3, at: Vector3, color_hex: String) -> MeshInstance3D:
	var m := SphereMesh.new()
	m.radius = 0.5
	m.height = 1
	var mi := put_mesh(parent, m, at, color_hex)
	mi.scale = scale_vec
	return mi

func cylinder(parent: Node3D, radius: float, height: float, at: Vector3, color_hex: String) -> MeshInstance3D:
	var m := CylinderMesh.new()
	m.top_radius = radius
	m.bottom_radius = radius
	m.height = height
	return put_mesh(parent, m, at, color_hex)

func populate(target: Node3D) -> Dictionary:
	root = target
	rng.seed = 142724
	var ocean := PlaneMesh.new()
	ocean.size = Vector2(140, 140)
	ocean.subdivide_width = 80
	ocean.subdivide_depth = 80
	var water := put_mesh(root, ocean, Vector3(0, -0.12, 0), COLORS.sea)
	water.material_override = water_material()
	var sand := CylinderMesh.new()
	sand.top_radius = 21.0
	sand.bottom_radius = 21.7
	sand.height = 1.2
	put_mesh(root, sand, Vector3(0, -0.6, 0), COLORS.sand)
	var grass := CylinderMesh.new()
	grass.top_radius = 17.9
	grass.bottom_radius = 18.3
	grass.height = 0.42
	put_mesh(root, grass, Vector3(0, -0.05, 0), COLORS.grass)
	sites = {
		"homes": Vector3(-10, 0, -7), "cafe": Vector3(-3, 0, -10),
		"arcade": Vector3(7, 0, -8), "park": Vector3(0, 0, 0),
		"market": Vector3(10, 0, 3), "library": Vector3(-10, 0, 7),
		"garden": Vector3(2, 0, 10), "beach": Vector3(14, 0, 10)
	}
	for key in ["homes", "cafe", "arcade", "market", "library"]:
		cottage(sites[key], key)
	for i in 12:
		var theta := TAU * i / 12.0
		var pos := Vector3(cos(theta) * 15.5, 0, sin(theta) * 15.5)
		palm(pos)
	for i in 26:
		var theta := rng.randf() * TAU
		var radius := rng.randf_range(3, 13)
		var p := Vector3(cos(theta) * radius, 0, sin(theta) * radius)
		flower(p, ["#fa95b8", "#f8d76e", "#ad9ceb", "#ffffff"][i % 4])
	for i in 9:
		var x := -3.0 + float(i % 3) * 2
		var z := 8.0 + float(i / 3) * 1.5
		flower(Vector3(x, 0, z), "#fba4c6")
	for i in 6:
		var a := TAU * float(i) / 6.0
		bench(Vector3(cos(a) * 6, 0, sin(a) * 6))
	coastal_dock()
	lighthouse()
	cylinder(root, 2.0, 0.2, Vector3(0, 0.22, 0), "#f3deca")
	cylinder(root, 1.4, 0.32, Vector3(0, 0.42, 0), "#ffffff")
	ball(root, Vector3(1.5, 1.3, 1.5), Vector3(0, 0.75, 0), "#8bdef1")
	return sites

func coastal_dock() -> void:
	for i in 16:
		var z := 13.5 + float(i) * 0.53
		box(root, Vector3(3.5, 0.18, 0.46), Vector3(10.0, 0.31, z), "#c99569")
	for z in [14.0, 17.0, 20.0]:
		for x in [8.3, 11.7]:
			cylinder(root, 0.16, 1.7, Vector3(x, 0.42, z), "#92634a")
	for i in 4:
		ball(root, Vector3(0.65, 0.35, 0.70), Vector3(9.0 + float(i) * 0.75, 0.85, 21.0), "#f1e9d2")

func lighthouse() -> void:
	var at := Vector3(-14.1, 0.0, 11.2)
	cylinder(root, 1.25, 0.42, at + Vector3(0, 0.25, 0), "#eee9d9")
	for i in 4:
		cylinder(root, 0.83 - float(i) * 0.07, 0.74, at + Vector3(0, 0.77 + float(i) * 0.70, 0), "#ffffff" if i % 2 == 0 else "#ea8295")
	cylinder(root, 0.79, 0.25, at + Vector3(0, 3.74, 0), "#9bddeb")
	var top := CylinderMesh.new()
	top.top_radius = 0.13
	top.bottom_radius = 0.98
	top.height = 0.90
	put_mesh(root, top, at + Vector3(0, 4.30, 0), "#e75d8a")

func cottage(at: Vector3, kind: String) -> void:
	var house := Node3D.new()
	house.name = kind.capitalize()
	root.add_child(house)
	house.position = at
	box(house, Vector3(4.2, 2.9, 3.3), Vector3(0, 1.45, 0), "#fff1d9")
	box(house, Vector3(4.9, 0.38, 3.95), Vector3(0, 3.03, 0), {
		"homes":"#f48caa", "cafe":"#f3b15e", "arcade":"#b4a3e9",
		"market":"#e598a2", "library":"#78a8db"}.get(kind, "#f48caa"))
	box(house, Vector3(0.9, 1.55, 0.12), Vector3(0, 0.85, -1.72), "#96644a")
	for x in [-1.35, 1.35]:
		box(house, Vector3(0.7, 0.7, 0.12), Vector3(x, 1.8, -1.73), "#9eddf0")
		box(house, Vector3(0.78, 0.14, 0.16), Vector3(x, 1.43, -1.76), "#ffffff")
	ball(house, Vector3(1.8, 0.9, 0.7), Vector3(-2.1, 0.43, -1.75), "#73c987")
	ball(house, Vector3(1.8, 0.9, 0.7), Vector3(2.1, 0.43, -1.75), "#73c987")
	box(house, Vector3(2.3, 0.22, 0.1), Vector3(0, 2.49, -1.89), "#ffffff")

func palm(at: Vector3) -> void:
	cylinder(root, 0.20, 3.1, at + Vector3(0, 1.55, 0), "#b98a63")
	for i in 6:
		var t := i * TAU / 6
		ball(root, Vector3(2.3, 0.3, 0.83), at + Vector3(cos(t) * 0.85, 3.20, sin(t) * 0.85), "#54bd82").rotation.y = t
	ball(root, Vector3(0.95, 0.6, 0.95), at + Vector3(0, 3.2, 0), "#70d68a")

func flower(at: Vector3, color_hex: String) -> void:
	cylinder(root, 0.04, 0.26, at + Vector3(0, 0.17, 0), "#439b67")
	for i in 5:
		var t := TAU * i / 5.0
		ball(root, Vector3(0.18, 0.17, 0.18), at + Vector3(cos(t) * 0.13, 0.33, sin(t) * 0.13), color_hex)
	ball(root, Vector3(0.15, 0.15, 0.15), at + Vector3(0, 0.34, 0), "#ffe08b")

func bench(at: Vector3) -> Node3D:
	var group := Node3D.new()
	group.name = "IslandBench"
	group.position = at
	root.add_child(group)
	box(group, Vector3(1.6, 0.18, 0.55), Vector3(0, 0.65, 0), "#ba825b")
	box(group, Vector3(1.6, 0.75, 0.13), Vector3(0, 1.10, 0.25), "#d49b70")
	for x in [-0.55, 0.55]:
		box(group, Vector3(0.12, 0.60, 0.12), Vector3(x, 0.32, 0), "#8c6a55")
	return group
