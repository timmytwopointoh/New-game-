extends Node3D
## VQ-inspired semantic construction recipes: original, deterministic mobile geometry.
## Candidate game art only; not a certified imported VEYLQUORIN GLB/rig.

const LEVELS = [
    {"name": "EMBER CAUSEWAY", "realm": "ash", "sky": "#2b1f30", "fog": "#56434c", "stone": "#594a53", "accent": "#e39a64", "ground": "#3b3943", "seed": 1401},
    {"name": "HOLLOWGLASS FOREST", "realm": "forest", "sky": "#102b32", "fog": "#315f60", "stone": "#3a5b59", "accent": "#6be9d1", "ground": "#244941", "seed": 2512},
    {"name": "DROWNED ARCHIVE", "realm": "archive", "sky": "#172f45", "fog": "#46778b", "stone": "#536e7c", "accent": "#9fe4f5", "ground": "#314b5b", "seed": 3623},
    {"name": "IRON BASILICA", "realm": "iron", "sky": "#30232d", "fog": "#70535a", "stone": "#535259", "accent": "#f2b96d", "ground": "#33343f", "seed": 4734},
    {"name": "CROWN OF HOURS", "realm": "crown", "sky": "#191b37", "fog": "#4c4a86", "stone": "#55577e", "accent": "#c5a7ff", "ground": "#31314e", "seed": 5845}
]

var portal: Node3D
var palette: Dictionary
var rng := RandomNumberGenerator.new()
var material_cache: Dictionary = {}
var ring_a: MeshInstance3D
var ring_b: MeshInstance3D
var gate_core: MeshInstance3D
var rotation_phase := 0.0

func build_realm(index: int) -> void:
    palette = LEVELS[index]
    rng.seed = int(palette["seed"])
    var env_node := WorldEnvironment.new()
    var env := Environment.new()
    env.background_mode = Environment.BG_COLOR
    env.background_color = Color(str(palette["sky"]))
    env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
    env.ambient_light_color = Color(str(palette["fog"]))
    env.ambient_light_energy = 0.85
    env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
    env_node.environment = env
    add_child(env_node)
    var sun := DirectionalLight3D.new()
    sun.rotation_degrees = Vector3(-48, -35, -8)
    sun.light_color = Color("#ffe5d1")
    sun.light_energy = 0.95
    sun.shadow_enabled = true
    add_child(sun)
    _box(self, Vector3(0, -0.25, -18), Vector3(70, 0.45, 104), _mat(str(palette["ground"]), 0.05, 1.0), true)
    _make_path()
    _make_roadside(index)
    _make_signature(index)
    _make_portal()

func _mat(hex: String, metallic: float = 0.0, roughness: float = 0.85, glow: bool = false) -> StandardMaterial3D:
    var key := "%s|%.2f|%.2f|%s" % [hex, metallic, roughness, str(glow)]
    if material_cache.has(key):
        return material_cache[key]
    var m := StandardMaterial3D.new()
    m.albedo_color = Color(hex)
    m.metallic = metallic
    m.roughness = roughness
    if glow:
        m.emission_enabled = true
        m.emission = Color(hex)
        m.emission_energy_multiplier = 2.3
    material_cache[key] = m
    return m

func _mesh(parent: Node3D, mesh: Mesh, position: Vector3, mat: Material) -> MeshInstance3D:
    var node := MeshInstance3D.new()
    node.mesh = mesh
    node.material_override = mat
    node.position = position
    parent.add_child(node)
    return node

func _box(parent: Node3D, position: Vector3, size: Vector3, mat: Material, solid: bool = false) -> MeshInstance3D:
    var box := BoxMesh.new()
    box.size = size
    var obj := _mesh(parent, box, position, mat)
    if solid:
        var wall := StaticBody3D.new()
        var collision := CollisionShape3D.new()
        var shape := BoxShape3D.new()
        shape.size = size
        collision.shape = shape
        wall.position = position
        parent.add_child(wall)
        wall.add_child(collision)
    return obj

func _cylinder(parent: Node3D, position: Vector3, radius: float, height: float, mat: Material, top_radius: float = -1.0) -> MeshInstance3D:
    var cylinder := CylinderMesh.new()
    cylinder.top_radius = top_radius if top_radius >= 0 else radius
    cylinder.bottom_radius = radius
    cylinder.height = height
    cylinder.radial_segments = 10
    return _mesh(parent, cylinder, position, mat)

func _sphere(parent: Node3D, position: Vector3, radius: float, mat: Material) -> MeshInstance3D:
    var sphere := SphereMesh.new()
    sphere.radius = radius
    sphere.height = radius * 2
    sphere.radial_segments = 12
    sphere.rings = 6
    return _mesh(parent, sphere, position, mat)

func _make_path() -> void:
    var road := _mat(str(palette["stone"]), 0.1, 0.86)
    var trim := _mat("#8c8587", 0.52, 0.51)
    for i in range(27):
        var z := 14.0 - float(i) * 2.2
        for lane in range(3):
            var x := (float(lane) - 1.0) * 2.6
            var slab := _box(self, Vector3(x, 0.034, z), Vector3(2.45, 0.13, 2.05), road)
            slab.rotation.y = rng.randf_range(-0.025, 0.025)
            if i % 4 == 0:
                _box(self, Vector3(x, 0.111, z), Vector3(1.95, 0.02, 0.09), trim)
        if i % 6 == 0:
            _box(self, Vector3(0, 0.135, z), Vector3(0.12, 0.035, 1.45), _mat(str(palette["accent"]), 0.3, 0.3, true))
    for side in [-1.0, 1.0]:
        for i in range(20):
            var z := 12.0 - float(i) * 3.0
            _box(self, Vector3(side * 5.1, 0.25, z), Vector3(0.32, 0.55, 2.3), road)

func _pillar(x: float, z: float, height: float, broken: bool) -> void:
    var stone := _mat(str(palette["stone"]), 0.05, 0.89)
    var trim := _mat("#999096", 0.42, 0.55)
    _box(self, Vector3(x, 0.2, z), Vector3(1.9, 0.4, 1.9), trim)
    _cylinder(self, Vector3(x, height * 0.5, z), 0.62, height, stone, 0.58)
    _cylinder(self, Vector3(x, height + 0.18, z), 0.9, 0.3, trim)
    for angle in range(6):
        var a := TAU * float(angle) / 6.0
        _cylinder(self, Vector3(x + cos(a)*0.66, height*0.49, z + sin(a)*0.66), 0.055, height*0.84, trim)
    if broken:
        _box(self, Vector3(x + 0.4, height + 0.7, z + 0.12), Vector3(1.2, 0.24, 1.0), stone).rotation.z = 0.22

func _make_roadside(index: int) -> void:
    for side in [-1.0, 1.0]:
        for i in range(7):
            var z := 7.0 - float(i) * 8.0
            _pillar(side * (10.0 + float(i % 2)*1.5), z, rng.randf_range(3.0, 7.3), i % 2 == 0)
            _cylinder(self, Vector3(side * 8.6, 0.18, z+2), 0.8, 0.36, _mat(str(palette["ground"])))
    for i in range(38):
        var side := -1.0 if i % 2 == 0 else 1.0
        var x := side * rng.randf_range(13, 31)
        var z := rng.randf_range(-61, 18)
        var block := _box(self, Vector3(x, 0.23, z),
            Vector3(rng.randf_range(0.6,2.4), rng.randf_range(0.22,0.8), rng.randf_range(0.9,3.0)),
            _mat(str(palette["stone"])))
        block.rotation.y = rng.randf_range(-1.5, 1.5)

func _make_signature(index: int) -> void:
    match index:
        0:
            _ember_realm()
        1:
            _forest_realm()
        2:
            _archive_realm()
        3:
            _iron_realm()
        4:
            _crown_realm()

func _ember_realm() -> void:
    var dark := _mat("#302931")
    var amber := _mat("#e27745", 0.24, 0.3, true)
    for side in [-1.0,1.0]:
        for i in range(9):
            var z := 14 - i * 7.1
            _cylinder(self, Vector3(side * 17, 0.9, z), 3.5, 1.7, dark, 0.7)
            _cylinder(self, Vector3(side * 17, 2.1, z), 1.2, 2.0, amber, 0.12)
            for j in range(4):
                var a := TAU * j / 4.0
                _cylinder(self, Vector3(side*17 + cos(a)*2, 0.6, z+sin(a)*2), 0.4, 1.2, dark, 0.04)
    _arch(Vector3(0, 0, -16), 7.8, 8.6, _mat("#69555c"))

func _forest_tree(pos: Vector3, height: float) -> void:
    var bark := _mat("#34413c", 0.0, 1.0)
    var leaf := _mat("#326862", 0.0, 0.88)
    var lit := _mat("#61c7ac", 0.05, 0.45, true)
    _cylinder(self, pos + Vector3(0, height*0.5,0), 0.40, height, bark, 0.17)
    for i in range(3):
        _sphere(self, pos + Vector3(sin(i*2.2)*0.8, height + i*0.65, cos(i*2.2)*0.6), 1.45 - i * 0.14, leaf)
    for i in range(4):
        _sphere(self, pos + Vector3(sin(i*4.1)*1.1, height+0.5+i*0.35, cos(i*4.1)*1.2), 0.16, lit)

func _forest_realm() -> void:
    for i in range(28):
        var side := -1.0 if i % 2 == 0 else 1.0
        _forest_tree(Vector3(side*rng.randf_range(12,30),0,rng.randf_range(-59,18)), rng.randf_range(2.4,6.2))
    for i in range(20):
        var x := rng.randf_range(-27,27)
        var z := rng.randf_range(-58,15)
        if abs(x) > 9:
            _crystal(self, Vector3(x,0.8,z), 1.8, _mat("#66d6c3",0.0,0.18,true))

func _archive_realm() -> void:
    var sea := _mat("#3c8295", 0.25, 0.15)
    sea.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
    var water_color := sea.albedo_color
    water_color.a = 0.58
    sea.albedo_color = water_color
    for side in [-1.0,1.0]:
        _box(self, Vector3(side*19,0.05,-20), Vector3(18,0.10,83), sea)
        for i in range(12):
            var z := 12 - i * 6
            _box(self, Vector3(side*13,2.4,z), Vector3(2.0,4.8,3.2), _mat("#556677"))
            for k in range(3):
                _box(self, Vector3(side*(13.0+k*0.43),1.2+k*0.76,z+1.69),
                    Vector3(0.12,0.12,3.0),_mat("#9ac2c6",0.45,0.36))
    _arch(Vector3(0,0,-17),8.0,6.9,_mat("#738e96"))

func _iron_realm() -> void:
    var iron := _mat("#49505a", 0.85, 0.37)
    var ember := _mat("#f1a959",0.5,0.2,true)
    for side in [-1.0,1.0]:
        for i in range(9):
            var z := 11-i*7.4
            _box(self, Vector3(side*15,3.0,z), Vector3(4.0,6.0,4.5), iron)
            _box(self, Vector3(side*12.8,3.4,z), Vector3(0.12,3.0,1.2),ember)
            _cylinder(self, Vector3(side*15,6.7,z),1.6,1.2, iron, 0.45)
    _arch(Vector3(0,0,-24), 10,10,iron)

func _crown_realm() -> void:
    var purple := _mat("#a99de4",0.58,0.26,true)
    var slate := _mat("#414666",0.3,0.7)
    for side in [-1.0,1.0]:
        for i in range(9):
            var z := 12-i*7.0
            var column := _cylinder(self, Vector3(side*15, 3.0,z),1.5,6,slate,1.2)
            column.rotation.z = side*0.07
            for j in range(4):
                var x: float = side * (14.0 + float(j) * 0.7)
                _crystal(self, Vector3(x,6.2+j*0.35,z),1.7,purple)
    for i in range(6):
        var angle := TAU*float(i)/6
        _cylinder(self, Vector3(cos(angle)*9,1,-35+sin(angle)*9),1.2,2.0,slate,0.5)
    _arch(Vector3(0,0,-25), 9,10,slate)

func _arch(pos: Vector3, span: float, height: float, mat: Material) -> void:
    for side in [-1.0,1.0]:
        _box(self, pos + Vector3(side*span*0.5,height*0.5,0),Vector3(1.5,height,2.1),mat)
        _box(self, pos + Vector3(side*span*0.5,height*0.15,1.13),Vector3(0.12,height*0.7,0.06),_mat(str(palette["accent"]),0.2,0.4,true))
    _box(self, pos + Vector3(0,height,0),Vector3(span+2,1.35,2.1),mat)
    _box(self, pos + Vector3(0,height+0.73,0),Vector3(span+2.7,0.19,2.5),_mat("#b1a7a0",0.3,0.5))
    for j in range(7):
        _box(self,pos+Vector3((float(j)-3)*span/8,height,1.10),Vector3(0.13,0.75,0.08),_mat(str(palette["accent"]),0.5,0.3,true))

func _crystal(parent: Node3D, pos: Vector3, height: float, mat: Material) -> void:
    var top := _cylinder(parent, pos+Vector3(0,height*0.25,0),0.42,height*0.5,mat,0.07)
    top.rotation.z = 0.11
    _cylinder(parent,pos+Vector3(0,height*0.72,0),0.25,height*0.45,mat,0.0)

func _make_portal() -> void:
    portal = Node3D.new()
    portal.name = "PassageGate"
    portal.position = Vector3(0,0,-45)
    add_child(portal)
    var base := _mat(str(palette["stone"]),0.24,0.75)
    var active := _mat(str(palette["accent"]),0.4,0.24,true)
    _cylinder(portal,Vector3(0,0.15,0),3.8,0.55,base)
    for side in [-1.0,1.0]:
        _box(portal,Vector3(side*2.7,2.1,0),Vector3(0.65,4.0,0.8),base)
        _sphere(portal,Vector3(side*2.7,4.25,0),0.36,active)
    var ring := TorusMesh.new()
    ring.inner_radius = 1.78
    ring.outer_radius = 2.08
    ring.rings = 12
    ring.ring_segments = 30
    ring_a = _mesh(portal,ring,Vector3(0,3,0),active)
    ring_a.name = "Ring1"
    ring_a.rotation_degrees.x = 90
    var ring_small := TorusMesh.new()
    ring_small.inner_radius = 1.46
    ring_small.outer_radius = 1.54
    ring_small.rings = 10
    ring_small.ring_segments = 28
    ring_b = _mesh(portal,ring_small,Vector3(0,3,0),_mat("#b9cad1",0.9,0.27))
    ring_b.rotation_degrees.x = 90
    var inside := CylinderMesh.new()
    inside.top_radius = 1.5
    inside.bottom_radius = 1.5
    inside.height = 0.06
    inside.radial_segments = 24
    gate_core = _mesh(portal,inside,Vector3(0,3,0),active)
    gate_core.name = "GateCore"
    gate_core.rotation_degrees.x = 90
    gate_core.hide()
    var beacon := OmniLight3D.new()
    beacon.light_color = Color(str(palette["accent"]))
    beacon.light_energy = 0.8
    beacon.omni_range = 10
    beacon.position = Vector3(0,4,0)
    portal.add_child(beacon)

func animate_portal(delta: float, ready: bool) -> void:
    rotation_phase += delta
    ring_a.rotation.z = sin(rotation_phase)*0.12
    ring_b.rotation.z = -rotation_phase * 0.21
    gate_core.visible = ready

func make_shard() -> Node3D:
    var root := Node3D.new()
    var glow := _mat(str(palette["accent"]),0.26,0.15,true)
    _crystal(root,Vector3.ZERO,1.25,glow)
    for side in [-1.0,1.0]:
        _sphere(root,Vector3(side*0.38,0.0,0),0.13,glow)
    return root

func _actor_part(root: Node3D, primitive: String, at: Vector3, size: Vector3, mat: Material) -> MeshInstance3D:
    if primitive == "ball":
        var sphere := SphereMesh.new()
        sphere.radius = 0.5
        sphere.height = 1
        sphere.radial_segments = 12
        sphere.rings = 6
        var part := _mesh(root,sphere,at,mat)
        part.scale = size
        return part
    var cube := BoxMesh.new()
    cube.size = Vector3.ONE
    var result := _mesh(root,cube,at,mat)
    result.scale = size
    return result

func _approved_vq_actor(kind: String) -> Node3D:
    # Only human-accepted, portable GLB models can replace the procedural fallback.
    const MANIFEST = "res://assets/approved/manifest.json"
    if not FileAccess.file_exists(MANIFEST):
        return null
    var parsed = JSON.parse_string(FileAccess.get_file_as_string(MANIFEST))
    if typeof(parsed) != TYPE_DICTIONARY:
        return null
    var registry: Dictionary = parsed.get("approved_assets", {})
    var entry: Dictionary = registry.get(kind, {})
    if entry.get("review_status", "") != "approved":
        return null
    if str(entry.get("source_sha256", "")).length() != 64:
        return null
    if str(entry.get("recipe", "")).is_empty():
        return null
    var path := "res://assets/approved/" + kind + ".glb"
    if not ResourceLoader.exists(path):
        return null
    var asset = ResourceLoader.load(path)
    if asset is PackedScene:
        var candidate = asset.instantiate()
        if candidate is Node3D:
            return candidate
        candidate.queue_free()
    return null

func make_actor(kind: String) -> Node3D:
    var imported := _approved_vq_actor(kind)
    if imported != null:
        return imported
    var root := Node3D.new()
    var is_hero := kind == "hero" or kind == "echo"
    var main_color := str(palette["stone"])
    if kind == "hero": main_color = "#899ba5"
    if kind == "echo": main_color = "#61dce8"
    if kind == "stalker": main_color = "#67505c"
    if kind == "warden": main_color = "#626875"
    if kind == "caster": main_color = "#625781"
    if kind == "guardian": main_color = "#9d8e91"
    var armor := _mat(main_color,0.54,0.44,kind == "echo")
    var shadow := _mat("#202633",0.18,0.8)
    var gold := _mat("#c8a36f",0.85,0.32)
    var eyes := _mat(str(palette["accent"]),0.16,0.18,true)
    var scale_factor := 1.45 if kind == "guardian" else 1.0
    if kind == "stalker":
        _actor_part(root,"ball",Vector3(0,0.85,0),Vector3(1.3,0.75,1.7),armor)
        _actor_part(root,"ball",Vector3(0,1.19,-0.77),Vector3(0.85,0.77,0.75),shadow)
        for x in [-0.45,0.45]:
            for z in [-0.55,0.55]:
                _actor_part(root,"box",Vector3(x,0.41,z),Vector3(0.26,0.82,0.27),armor)
        for side in [-1.0,1.0]:
            _actor_part(root,"ball",Vector3(side*0.28,1.35,-1.06),Vector3(0.14,0.14,0.14),eyes)
            var horn := _actor_part(root,"box",Vector3(side*0.32,1.67,-0.62),Vector3(0.18,0.75,0.15),gold)
            horn.rotation.z = side*0.40
    else:
        _actor_part(root,"ball",Vector3(0,1.18,0),Vector3(0.84,1.02,0.50),armor)
        _actor_part(root,"ball",Vector3(0,1.96,0.0),Vector3(0.53,0.56,0.51),shadow)
        _actor_part(root,"box",Vector3(0,1.93,-0.31),Vector3(0.45,0.10,0.12),eyes)
        _actor_part(root,"box",Vector3(0,1.15,-0.44),Vector3(0.36,0.55,0.08),gold)
        for side in [-1.0,1.0]:
            _actor_part(root,"ball",Vector3(side*0.53,1.63,0),Vector3(0.54,0.36,0.49),armor)
            _actor_part(root,"box",Vector3(side*0.55,1.03,0.0),Vector3(0.31,0.9,0.31),shadow)
            _actor_part(root,"box",Vector3(side*0.24,0.43,0.03),Vector3(0.35,0.86,0.43),armor)
            _actor_part(root,"box",Vector3(side*0.24,0.12,-0.16),Vector3(0.42,0.23,0.65),shadow)
        if is_hero:
            _actor_part(root,"box",Vector3(0.78,1.33,-0.2),Vector3(0.16,1.9,0.12),gold)
            _actor_part(root,"box",Vector3(0.78,0.58,-0.2),Vector3(0.55,0.13,0.21),shadow)
            _actor_part(root,"box",Vector3(-0.6,1.15,0.20),Vector3(0.15,0.8,0.58),gold)
        elif kind == "caster":
            _actor_part(root,"ball",Vector3(0,0.75,0.0),Vector3(1.20,1.25,0.80),armor)
            _sphere(root,Vector3(0,2.38,0),0.28,eyes)
        elif kind == "guardian":
            _actor_part(root,"box",Vector3(0,2.55,0),Vector3(1.0,0.32,0.76),gold)
            for side in [-1.0,1.0]:
                var horn := _actor_part(root,"box",Vector3(side*0.60,2.7,0),Vector3(0.18,0.9,0.18),gold)
                horn.rotation.z = side*0.48
        elif kind == "warden":
            _actor_part(root,"box",Vector3(0,1.28,0.29),Vector3(1.20,1.0,0.16),gold)
    root.scale = Vector3.ONE * scale_factor
    return root
