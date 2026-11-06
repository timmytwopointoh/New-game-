extends Node3D
## Chibi Island Reborn playable vertical slice: residents, island, camera, gifts, buildings and saves.
const GrimScript = preload("res://engine/Grim.gd")
const WorldScript = preload("res://engine/ChibiWorld.gd")
const MindScript = preload("res://engine/IslandMind.gd")
const SaveScript = preload("res://engine/SaveSystem.gd")
const SKINS := ["#f6d2b8", "#b87955", "#eab18b", "#8b5a43", "#f3d5bb", "#d7a282"]
const HAIRS := ["#70432e", "#c98a51", "#372d48", "#ef91a9", "#8f7acc", "#f7d48a", "#31313c"]
const OUTFITS := ["#f68da3", "#78b9e3", "#a18ee7", "#e9bd68", "#7bd1ac", "#d681b6"]
const NAMES := ["Mia", "Ollie", "Nora", "Jules", "Pip", "Aria", "Leo", "Suki", "Toby", "Ivy", "Milo", "Zara", "Kai", "Remy", "Ada", "Finn"]
const PERSONALITIES := ["Curious", "Creative", "Playful", "Thoughtful", "Outgoing"]
var world
var mind
var grims: Array = []
var props: Array = []
var selected: Node3D
var active_slot: int = 1
var started: bool = false
var camera: Camera3D
var sun: DirectionalLight3D
var focus := Vector3(0, 0.7, 0)
var yaw: float = -0.30
var zoom: float = 28.0
var panel: PanelContainer
var status_label: Label
var details_label: Label
var start_layer: PanelContainer
var toast_label: Label
var rng := RandomNumberGenerator.new()
var auto_save_clock: float = 0.0
var toast_clock: float = 0.0

func _ready() -> void:
	rng.randomize()
	world = WorldScript.new()
	mind = MindScript.new()
	var sites: Dictionary = world.populate(self)
	mind.initialize(sites)
	_setup_light()
	_setup_camera()
	_setup_hud()
	_show_menu()
	set_process(true)

func _setup_light() -> void:
	sun = DirectionalLight3D.new()
	sun.light_color = Color("#fff1d4")
	sun.light_energy = 1.25
	sun.shadow_enabled = true
	sun.rotation_degrees = Vector3(-56, -28, 0)
	add_child(sun)
	var env := WorldEnvironment.new()
	var e := Environment.new()
	e.background_mode = Environment.BG_COLOR
	e.background_color = Color("#b4e8f7")
	e.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	e.ambient_light_color = Color("#e9f3ff")
	e.ambient_light_energy = 0.60
	e.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	env.environment = e
	add_child(env)

func _setup_camera() -> void:
	camera = Camera3D.new()
	camera.fov = 48.0
	camera.far = 170
	camera.current = true
	add_child(camera)
	_update_camera(1.0)

func _update_camera(weight: float) -> void:
	if not is_instance_valid(camera):
		return
	var target := focus + Vector3(sin(yaw) * zoom * 0.52, zoom * 0.77, cos(yaw) * zoom * 0.52)
	camera.global_position = camera.global_position.lerp(target, weight)
	camera.look_at(focus, Vector3.UP)

func _make_button(parent: Node, title: String, callback: Callable) -> Button:
	var button := Button.new()
	button.text = title
	button.custom_minimum_size = Vector2(178, 40)
	button.pressed.connect(callback)
	parent.add_child(button)
	return button

func _setup_hud() -> void:
	var layer := CanvasLayer.new()
	layer.name = "GameHUD"
	add_child(layer)
	var top := PanelContainer.new()
	top.set_anchors_preset(Control.PRESET_TOP_WIDE)
	top.offset_bottom = 53
	layer.add_child(top)
	var title_bar := HBoxContainer.new()
	title_bar.alignment = BoxContainer.ALIGNMENT_CENTER
	top.add_child(title_bar)
	status_label = Label.new()
	status_label.add_theme_font_size_override("font_size", 21)
	title_bar.add_child(status_label)
	panel = PanelContainer.new()
	panel.set_anchors_preset(Control.PRESET_BOTTOM_LEFT)
	panel.offset_left = 12
	panel.offset_right = 224
	panel.offset_top = -347
	panel.offset_bottom = -12
	layer.add_child(panel)
	var actions := VBoxContainer.new()
	actions.add_theme_constant_override("separation", 5)
	panel.add_child(actions)
	var lbl := Label.new()
	lbl.text = "🌸 YOUR ISLAND"
	lbl.add_theme_font_size_override("font_size", 19)
	actions.add_child(lbl)
	details_label = Label.new()
	details_label.custom_minimum_size = Vector2(190, 47)
	actions.add_child(details_label)
	_make_button(actions, "💬 Talk", func(): _talk())
	_make_button(actions, "🎁 Gift · 10 coins", func(): _gift())
	_make_button(actions, "🌷 Gather materials", func(): _gather())
	_make_button(actions, "🪑 Build bench", func(): _build())
	_make_button(actions, "✨ New Grim", func(): _add_grim())
	_make_button(actions, "💾 Save island", func(): _save())
	_make_button(actions, "☰ Menu", func(): _show_menu())
	var right := VBoxContainer.new()
	right.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	right.offset_left = -210
	right.offset_right = -8
	right.offset_top = 64
	right.offset_bottom = 250
	layer.add_child(right)
	_make_button(right, "📍 Center on Grim", func(): _center_grim())
	_make_button(right, "⏩ Simulation ×", func(): _change_speed())
	_make_button(right, "📖 Island stories", func(): _stories())
	toast_label = Label.new()
	toast_label.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	toast_label.offset_top = -56
	toast_label.offset_bottom = -30
	toast_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	toast_label.add_theme_font_size_override("font_size", 21)
	layer.add_child(toast_label)
	start_layer = PanelContainer.new()
	start_layer.set_anchors_preset(Control.PRESET_CENTER)
	start_layer.custom_minimum_size = Vector2(395, 365)
	start_layer.position = Vector2(-195, -182)
	layer.add_child(start_layer)
	var choices := VBoxContainer.new()
	choices.add_theme_constant_override("separation", 10)
	start_layer.add_child(choices)
	var header := Label.new()
	header.text = "🌴 CHIBI ISLAND"
	header.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	header.add_theme_font_size_override("font_size", 33)
	choices.add_child(header)
	var tagline := Label.new()
	tagline.text = "Every Grim has a story. Every day brings a surprise."
	tagline.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	tagline.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	choices.add_child(tagline)
	_make_button(choices, "🌸 New Island · Slot 1", func(): _new_island(1))
	_make_button(choices, "🌊 Continue · Slot 1", func(): _load(1))
	_make_button(choices, "🏝️ New Island · Slot 2", func(): _new_island(2))
	_make_button(choices, "💗 Continue · Slot 2", func(): _load(2))
	_make_button(choices, "🌼 New Island · Slot 3", func(): _new_island(3))
	_make_button(choices, "📦 Continue · Slot 3", func(): _load(3))

func _show_menu() -> void:
	start_layer.visible = true
	panel.visible = false
	started = false

func _begin() -> void:
	start_layer.visible = false
	panel.visible = true
	started = true
	_update_labels()

func _profile(index: int) -> Dictionary:
	return {"id": index + 1, "name": NAMES[index % NAMES.size()],
	"personality": PERSONALITIES[index % PERSONALITIES.size()],
	"skin": SKINS[index % SKINS.size()], "hair": HAIRS[index % HAIRS.size()],
	"outfit": OUTFITS[index % OUTFITS.size()], "hair_shape": index % 3,
	"accessory": index % 3,
	"x": rng.randf_range(-4.0, 4.0), "z": rng.randf_range(-3.0, 3.0)}

func _spawn(data: Dictionary) -> Node3D:
	var grim = GrimScript.new()
	grim.configure(data)
	add_child(grim)
	grims.append(grim)
	grim.arrived.connect(func(r): mind.arrival(r, grims))
	return grim

func _clear_state() -> void:
	for r in grims:
		r.queue_free()
	grims.clear()
	for p in props:
		p.queue_free()
	props.clear()
	selected = null
	auto_save_clock = 0
	focus = Vector3.ZERO

func _new_island(slot: int) -> void:
	active_slot = slot
	_clear_state()
	mind = MindScript.new()
	mind.initialize(world.sites)
	mind.note("Welcome to your own little living island.")
	for i in 5:
		_spawn(_profile(i))
	selected = grims[0]
	_begin()
	_save()

func _load(slot: int) -> void:
	active_slot = slot
	var state: Dictionary = SaveScript.restore(slot)
	if state.is_empty():
		_toast("Slot %d is empty. Start a new island!" % slot)
		return
	_clear_state()
	mind = MindScript.new()
	mind.initialize(world.sites)
	mind.from_data(state.get("mind", {}))
	var saved_grims: Array = state.get("residents", [])
	for item in saved_grims:
		if typeof(item) == TYPE_DICTIONARY:
			_spawn(item)
	if grims.is_empty():
		_spawn(_profile(0))
	for p in state.get("props", []):
		if typeof(p) == TYPE_DICTIONARY and str(p.get("kind", "")) == "bench":
			_place_bench(Vector3(float(p.get("x", 0)), 0, float(p.get("z", 0))), false)
	selected = grims[0]
	_begin()
	_toast("Island restored · Day %d" % mind.day)

func _save() -> void:
	if grims.is_empty():
		return
	var characters: Array = []
	for r in grims:
		characters.append(r.to_data())
	var state := {"mind": mind.to_data(), "residents": characters, "props": []}
	for prop in props:
		state["props"].append({"kind": "bench", "x": prop.position.x, "z": prop.position.z})
	if SaveScript.store(active_slot, state):
		_toast("Island saved to slot %d" % active_slot)
	else:
		_toast("Save failed — device storage unavailable")

func _process(delta: float) -> void:
	_update_camera(minf(1.0, delta * 4.0))
	if toast_clock > 0:
		toast_clock -= delta
		if toast_clock <= 0:
			toast_label.text = ""
	if not started:
		return
	mind.tick(delta, grims)
	auto_save_clock += delta
	if auto_save_clock >= 24.0:
		auto_save_clock = 0
		_save_silent()
	if Engine.get_process_frames() % 20 == 0:
		_update_labels()
	var light_amount := clampf(sin(mind.hour / 24.0 * TAU) * 0.32 + 0.78, 0.28, 1.0)
	sun.light_energy = lerpf(sun.light_energy, light_amount * 1.5, minf(1, delta * 0.6))

func _save_silent() -> void:
	if not started:
		return
	var characters: Array = []
	for r in grims:
		characters.append(r.to_data())
	var built: Array = []
	for prop in props:
		built.append({"kind": "bench", "x": prop.position.x, "z": prop.position.z})
	SaveScript.store(active_slot, {"mind": mind.to_data(), "residents": characters, "props": built})

func _update_labels() -> void:
	status_label.text = "🌴 CHIBI ISLAND   ·   Day %d   ·   %02d:00   ·   🪙 %d   ·   🌷 %d Grims" % [mind.day, int(mind.hour), mind.coins, grims.size()]
	if is_instance_valid(selected):
		details_label.text = "%s · %s\nMood: %s  ·  Energy: %d" % [selected.display_name, selected.personality, selected.mood, int(selected.energy)]
	else:
		details_label.text = "Tap a Grim to meet them"

func _toast(msg: String) -> void:
	if is_instance_valid(toast_label):
		toast_label.text = msg
	toast_clock = 4.0

func _talk() -> void:
	if not is_instance_valid(selected):
		return
	var lines := ["What a beautiful day!", "I wonder who I will meet today.", "Let's make this island extraordinary.", "The little things matter.", "This is our home!"]
	var speech: String = lines[(selected.resident_id + mind.day) % lines.size()]
	selected.social = minf(100, selected.social + 14)
	selected.mood = "happy"
	mind.note("You talked with %s: “%s”" % [selected.display_name, speech])
	_toast("%s: %s" % [selected.display_name, speech])

func _gift() -> void:
	if is_instance_valid(selected) and mind.give_gift(selected):
		_toast("🎁 %s loved the gift!" % selected.display_name)
	else:
		_toast("You need 10 coins to buy a gift.")

func _gather() -> void:
	mind.gather()
	_toast("🪵 +3 wood   🪨 +2 stone   🌷 +2 flowers")

func _build() -> void:
	if not mind.pay({"wood": 5, "stone": 2}):
		_toast("Need 5 wood and 2 stone. Gather first!")
		return
	var pos := Vector3(rng.randf_range(-7, 7), 0.0, rng.randf_range(3, 7))
	_place_bench(pos, true)
	_toast("🪑 A new garden bench has been built!")

func _place_bench(pos: Vector3, record: bool) -> void:
	var group := Node3D.new()
	group.position = pos
	add_child(group)
	world.bench(Vector3(pos.x, 0, pos.z))
	props.append(group)
	if record:
		mind.note("A cozy wooden bench appeared near the park.")

func _add_grim() -> void:
	if grims.size() >= 16:
		_toast("The island currently supports 16 Grims.")
		return
	var r = _spawn(_profile(grims.size()))
	selected = r
	mind.note("%s moved to the island!" % r.display_name)
	_toast("✨ Welcome, %s!" % r.display_name)

func _center_grim() -> void:
	if is_instance_valid(selected):
		focus = selected.position

func _change_speed() -> void:
	mind.speed = 1.0 if mind.speed >= 4.0 else mind.speed * 2.0
	_toast("Simulation speed ×%.0f" % mind.speed)

func _stories() -> void:
	if mind.memories.is_empty():
		_toast("The first stories are being written.")
		return
	var summary: String = str(mind.memories[0])
	if mind.memories.size() > 1:
		summary += "  |  " + str(mind.memories[1])
	_toast(summary)

func _unhandled_input(event: InputEvent) -> void:
	if not started:
		return
	if event is InputEventMouseButton:
		if event.button_index == MOUSE_BUTTON_WHEEL_UP and event.pressed:
			zoom = clampf(zoom - 2, 14, 48)
		elif event.button_index == MOUSE_BUTTON_WHEEL_DOWN and event.pressed:
			zoom = clampf(zoom + 2, 14, 48)
		elif event.button_index == MOUSE_BUTTON_LEFT and event.pressed:
			_select_screen(event.position)
	if event is InputEventMouseMotion and Input.is_mouse_button_pressed(MOUSE_BUTTON_RIGHT):
		_pan(event.relative)
	if event is InputEventScreenDrag:
		_pan(event.relative)

func _pan(delta: Vector2) -> void:
	focus.x = clampf(focus.x - delta.x * 0.032, -15, 15)
	focus.z = clampf(focus.z - delta.y * 0.032, -15, 15)

func _select_screen(pos: Vector2) -> void:
	var best := 62.0
	for r in grims:
		if camera.is_position_behind(r.global_position):
			continue
		var pixel := camera.unproject_position(r.global_position + Vector3(0, 1.6, 0))
		var d := pos.distance_to(pixel)
		if d < best:
			best = d
			selected = r
	if is_instance_valid(selected) and best < 62.0:
		selected.mood = "happy"
		_toast("💗 Meet %s · %s" % [selected.display_name, selected.personality])

func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_CLOSE_REQUEST:
		_save_silent()
