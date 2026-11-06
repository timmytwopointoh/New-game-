extends Node3D
## A truly animated resident with separate rig pieces, mood, state and appearance.
signal arrived(resident)
var resident_id: int = 0
var display_name: String = "Grim"
var personality: String = "Curious"
var skin_color: Color = Color("#f8cfb7")
var hair_color: Color = Color("#a45e40")
var outfit_color: Color = Color("#f58aaa")
var mood: String = "happy"
var energy: float = 100.0
var hunger: float = 20.0
var social: float = 70.0
var destination: Vector3 = Vector3.ZERO
var activity: String = "explore"
var walking: bool = false
var speed: float = 2.4
var age: float = 0.0
var head: Node3D
var left_arm: Node3D
var right_arm: Node3D
var left_leg: Node3D
var right_leg: Node3D
var left_eye: MeshInstance3D
var right_eye: MeshInstance3D
var hair_shape: int = 0
var accessory: int = 0

func configure(data: Dictionary) -> void:
	resident_id = int(data.get("id", 0))
	display_name = str(data.get("name", "Grim"))
	personality = str(data.get("personality", "Curious"))
	skin_color = Color(str(data.get("skin", "#f8cfb7")))
	hair_color = Color(str(data.get("hair", "#a45e40")))
	outfit_color = Color(str(data.get("outfit", "#f58aaa")))
	hair_shape = int(data.get("hair_shape", 0))
	accessory = int(data.get("accessory", 0))
	position = Vector3(float(data.get("x", 0)), 0.4, float(data.get("z", 0)))
	energy = float(data.get("energy", 100))
	hunger = float(data.get("hunger", 20))
	social = float(data.get("social", 70))
	mood = str(data.get("mood", "happy"))

func make_material(c: Color, roughness: float = 0.65) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	m.roughness = roughness
	return m

func ball(parent: Node3D, radius: float, c: Color, pos: Vector3, scale_vec: Vector3 = Vector3.ONE) -> MeshInstance3D:
	var n := MeshInstance3D.new()
	var mesh := SphereMesh.new()
	mesh.radius = radius
	mesh.height = radius * 2.0
	n.mesh = mesh
	n.material_override = make_material(c)
	n.position = pos
	n.scale = scale_vec
	parent.add_child(n)
	return n

func _ready() -> void:
	var root := Node3D.new()
	root.name = "AnimatedRig"
	add_child(root)
	ball(root, 0.32, outfit_color, Vector3(0, 0.54, 0), Vector3(1.0, 1.13, 0.75))
	ball(root, 0.31, Color("#ffffff"), Vector3(0, 0.26, 0), Vector3(0.95, 0.25, 0.82))
	head = Node3D.new()
	head.position = Vector3(0, 1.23, 0)
	root.add_child(head)
	ball(head, 0.59, skin_color, Vector3.ZERO, Vector3(1.05, 0.97, 0.9))
	ball(head, 0.60, hair_color, Vector3(0, 0.28, -0.08), Vector3(1.05, 0.55, 0.93))
	for k in range(3 + hair_shape):
		var x := (float(k) - float(2 + hair_shape) * 0.5) * 0.22
		ball(head, 0.2, hair_color, Vector3(x, 0.4, -0.45), Vector3(0.68, 0.7, 0.5))
	for side in [-1, 1]:
		ball(head, 0.115, Color("#ffe0dd"), Vector3(float(side) * 0.47, -0.13, -0.23), Vector3(1, 0.60, 0.30))
	left_eye = ball(head, 0.11, Color("#29203d"), Vector3(-0.22, 0.02, -0.515), Vector3(0.8, 1.32, 0.43))
	right_eye = ball(head, 0.11, Color("#29203d"), Vector3(0.22, 0.02, -0.515), Vector3(0.8, 1.32, 0.43))
	for x in [-0.22, 0.22]:
		ball(head, 0.034, Color.WHITE, Vector3(x - 0.026, 0.072, -0.564))
	ball(head, 0.05, Color("#b55c68"), Vector3(0, -0.22, -0.532), Vector3(1.2, 0.50, 0.6))
	left_arm = Node3D.new()
	right_arm = Node3D.new()
	left_leg = Node3D.new()
	right_leg = Node3D.new()
	for part in [left_arm, right_arm, left_leg, right_leg]:
		root.add_child(part)
	left_arm.position = Vector3(-0.37, 0.74, 0)
	right_arm.position = Vector3(0.37, 0.74, 0)
	left_leg.position = Vector3(-0.17, 0.36, 0)
	right_leg.position = Vector3(0.17, 0.36, 0)
	ball(left_arm, 0.16, skin_color, Vector3(-0.07, -0.23, 0), Vector3(0.8, 1.5, 0.8))
	ball(right_arm, 0.16, skin_color, Vector3(0.07, -0.23, 0), Vector3(0.8, 1.5, 0.8))
	ball(left_leg, 0.15, Color("#ffffff"), Vector3(0, -0.1, 0), Vector3(1, 1.5, 1))
	ball(right_leg, 0.15, Color("#ffffff"), Vector3(0, -0.1, 0), Vector3(1, 1.5, 1))
	ball(left_leg, 0.16, Color("#6c647e"), Vector3(0, -0.31, -0.05), Vector3(1.1, 0.5, 1.4))
	ball(right_leg, 0.16, Color("#6c647e"), Vector3(0, -0.31, -0.05), Vector3(1.1, 0.5, 1.4))
	if accessory == 1:
		ball(head, 0.18, Color("#ffedd5"), Vector3(0.35, 0.54, 0), Vector3(1.4, 0.4, 0.7))
	if accessory == 2:
		ball(head, 0.16, Color("#9cdbed"), Vector3(-0.40, 0.48, 0), Vector3(1.3, 0.45, 0.8))
	var shadow := MeshInstance3D.new()
	var disc := CylinderMesh.new()
	disc.top_radius = 0.47
	disc.bottom_radius = 0.47
	disc.height = 0.012
	shadow.mesh = disc
	shadow.material_override = make_material(Color(0.20, 0.27, 0.33, 0.23))
	shadow.position.y = -0.37
	add_child(shadow)

func set_goal(point: Vector3, new_activity: String) -> void:
	destination = Vector3(point.x, 0.4, point.z)
	activity = new_activity
	walking = true

func _process(delta: float) -> void:
	age += delta
	var stride := 0.0
	if walking:
		var diff := destination - position
		diff.y = 0
		if diff.length() <= 0.19:
			walking = false
			arrived.emit(self)
		else:
			var step_size := minf(diff.length(), speed * delta)
			position += diff.normalized() * step_size
			rotation.y = lerp_angle(rotation.y, atan2(-diff.x, -diff.z), minf(1.0, delta * 7.0))
			stride = sin(age * 11.0) * 0.52
	if is_instance_valid(head):
		head.position.y = 1.23 + sin(age * (9.0 if walking else 2.8)) * (0.06 if walking else 0.025)
		head.rotation.z = sin(age * 1.4 + resident_id) * 0.035
		left_arm.rotation.x = stride
		right_arm.rotation.x = -stride
		left_leg.rotation.x = -stride
		right_leg.rotation.x = stride
		if is_instance_valid(left_eye):
			var blink := 0.12 if sin(age * 1.73 + resident_id * 2.1) > 0.995 else 1.0
			left_eye.scale.y = blink * 1.32
			right_eye.scale.y = blink * 1.32

func to_data() -> Dictionary:
	return {"id": resident_id, "name": display_name, "personality": personality,
	"skin": skin_color.to_html(), "hair": hair_color.to_html(), "outfit": outfit_color.to_html(),
	"hair_shape": hair_shape, "accessory": accessory, "x": position.x, "z": position.z,
	"energy": energy, "hunger": hunger, "social": social, "mood": mood}
