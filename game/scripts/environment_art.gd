extends Node3D
## ECHOFORM's first art-directed 3D arena.
## Procedural meshes are affordable mobile placeholders, not final VEILFORGE assets.
## Deterministic layout makes emulator screenshots comparable between builds.

var stone: StandardMaterial3D
var dark_stone: StandardMaterial3D
var path_stone: StandardMaterial3D
var metal: StandardMaterial3D
var energy: StandardMaterial3D
var grass: StandardMaterial3D

func _ready() -> void:
    stone = _material(Color("#586976"), 0.08, 0.9)
    dark_stone = _material(Color("#283641"), 0.18, 0.87)
    path_stone = _material(Color("#394f53"), 0.14, 0.76)
    metal = _material(Color("#718791"), 0.66, 0.32)
    energy = _material(Color("#42c7d5"), 0.24, 0.25, Color("#39e9f5"))
    grass = _material(Color("#294a42"), 0.02, 0.98)
    var ground := get_parent().get_node("Ground") as MeshInstance3D
    ground.material_override = grass
    var world_environment := get_parent().get_node("WorldEnvironment") as WorldEnvironment
    var atmosphere := Environment.new()
    atmosphere.background_mode = Environment.BG_COLOR
    atmosphere.background_color = Color("#101e2a")
    atmosphere.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
    atmosphere.ambient_light_color = Color("#788c9a")
    atmosphere.ambient_light_energy = 0.7
    world_environment.environment = atmosphere
    var sun := get_parent().get_node("Sun") as DirectionalLight3D
    sun.light_color = Color("#f6dbb3")
    sun.light_energy = 1.05
    _build_causeway()
    _build_ruins()
    _build_gateway()
    _scatter_stones()

func _material(color: Color, metallic_level: float, roughness_level: float, glow_color: Color = Color.BLACK) -> StandardMaterial3D:
    var result := StandardMaterial3D.new()
    result.albedo_color = color
    result.metallic = metallic_level
    result.roughness = roughness_level
    if glow_color != Color.BLACK:
        result.emission_enabled = true
        result.emission = glow_color
        result.emission_energy_multiplier = 1.8
    return result

func _box(label: String, position_3d: Vector3, dimensions: Vector3, mat: Material, collision: bool = false) -> MeshInstance3D:
    var item := MeshInstance3D.new()
    item.name = label
    var geometry := BoxMesh.new()
    geometry.size = dimensions
    item.mesh = geometry
    item.material_override = mat
    item.position = position_3d
    add_child(item)
    if collision:
        var body := StaticBody3D.new()
        body.name = label + "Collider"
        body.position = position_3d
        add_child(body)
        var shape := CollisionShape3D.new()
        var box_shape := BoxShape3D.new()
        box_shape.size = dimensions
        shape.shape = box_shape
        body.add_child(shape)
    return item

func _build_causeway() -> void:
    for step in range(24):
        var z := 3.0 - float(step) * 2.6
        for lane in range(2):
            var x := -1.05 if lane == 0 else 1.05
            _box("CausewayTile", Vector3(x, 0.15, z), Vector3(1.94, 0.08, 2.42), path_stone)
            if step % 3 == 0:
                _box("InlaidMetal", Vector3(x, 0.201, z), Vector3(1.65, 0.012, 0.09), metal)
    _box("CenterDais", Vector3(0, 0.13, -23), Vector3(7.5, 0.25, 8), stone)

func _build_ruins() -> void:
    var heights := [4.5, 6.8, 8.2, 6.2, 7.7, 5.3]
    for side in [-1.0, 1.0]:
        for index in range(6):
            var height: float = heights[index]
            var x: float = side * (6.3 + float(index % 2) * 1.4)
            var z: float = -5.0 - float(index) * 10.0
            _box("RuinedPillar", Vector3(x, height / 2.0 + 0.1, z), Vector3(2.1, height, 2.1), dark_stone, true)
            _box("PillarCap", Vector3(x, height + 0.1, z), Vector3(2.8, 0.34, 2.8), stone)
            _box("SignalInset", Vector3(x - side * 0.02, height * 0.56, z + 1.067), Vector3(0.10, 1.25, 0.02), energy)
            _box("SideBlock", Vector3(x + side * 1.8, 0.55, z - 3.2), Vector3(2.25, 1.0, 3.1), stone, true)

func _build_gateway() -> void:
    _box("GateLeft", Vector3(-3.45, 3.5, -25), Vector3(1.2, 6.8, 1.5), dark_stone, true)
    _box("GateRight", Vector3(3.45, 3.5, -25), Vector3(1.2, 6.8, 1.5), dark_stone, true)
    _box("GateLintel", Vector3(0, 7.0, -25), Vector3(8.1, 1.4, 1.75), stone)
    _box("GateLightLeft", Vector3(-2.76, 4.15, -24.2), Vector3(0.05, 4.9, 0.04), energy)
    _box("GateLightRight", Vector3(2.76, 4.15, -24.2), Vector3(0.05, 4.9, 0.04), energy)
    _box("GateLightTop", Vector3(0, 6.22, -24.2), Vector3(5.54, 0.05, 0.04), energy)
    for side in [-1.0, 1.0]:
        var orb := MeshInstance3D.new()
        var orb_mesh := SphereMesh.new()
        orb_mesh.radius = 0.3
        orb_mesh.height = 0.6
        orb.mesh = orb_mesh
        orb.material_override = energy
        orb.position = Vector3(side * 3.0, 3.2, -24.0)
        add_child(orb)
    var glow := OmniLight3D.new()
    glow.name = "GatewayIllumination"
    glow.light_color = Color("#4fd9ea")
    glow.light_energy = 0.55
    glow.omni_range = 9.0
    glow.position = Vector3(0, 5.0, -23.0)
    add_child(glow)

func _scatter_stones() -> void:
    var randomizer := RandomNumberGenerator.new()
    randomizer.seed = 6819
    for index in range(38):
        var side := -1.0 if index % 2 == 0 else 1.0
        var x := side * randomizer.randf_range(10.0, 23.0)
        var z := randomizer.randf_range(-58.0, 9.0)
        var rubble := _box("FallenMasonry", Vector3(x, 0.38, z), Vector3(randomizer.randf_range(0.6, 2.2), randomizer.randf_range(0.25, 0.72), randomizer.randf_range(0.8, 2.6)), stone)
        rubble.rotation.y = randomizer.randf_range(-1.1, 1.1)
