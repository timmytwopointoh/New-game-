extends Node3D
## ECHOFORM: FRACTURED REALMS — offline five-stage 3D campaign.
## Procedural candidate art; never an automatically approved VQ asset.

const FORGE = preload("res://scripts/realm_forge.gd")
const SHARD_GOAL := 3
const INTRO_DURATION := 10.5
const MOVE_SPEED := 6.1

var forge: Node3D
var hero: CharacterBody3D
var hero_art: Node3D
var camera: Camera3D
var echo_art: Node3D
var portal: Node3D
var enemies: Array[Dictionary] = []
var shards: Array[Dictionary] = []
var history: Array[Vector3] = []
var echo_path: Array[Vector3] = []
var echo_cursor := 0
var echo_timer := 0.0
var game_time := 0.0
var attack_timer := 0.0
var damage_flash := 0.0
var intro_time := 0.0
var level := 0
var max_unlocked := 0
var health := 100
var collected := 0
var guardian_down := false
var mode := "menu"
var touch_id := -1
var touch_origin := Vector2.ZERO
var touch_vector := Vector2.ZERO

var canvas: CanvasLayer
var hud: Control
var status_label: Label
var objective_label: Label
var tip_label: Label
var health_bar: ProgressBar
var overlay: ColorRect
var overlay_box: VBoxContainer
var subtitle: Label
var letter_top: ColorRect
var letter_bottom: ColorRect

func _ready() -> void:
    var config := ConfigFile.new()
    if config.load("user://fractured_realms_save.cfg") == OK:
        max_unlocked = clampi(int(config.get_value("campaign", "unlocked", 0)), 0, 4)
    camera = Camera3D.new()
    camera.current = true
    camera.fov = 65.0
    camera.near = 0.08
    camera.far = 190.0
    add_child(camera)
    _create_ui()
    _load_level(0)
    _open_menu()

func _create_ui() -> void:
    canvas = CanvasLayer.new()
    add_child(canvas)
    hud = Control.new()
    canvas.add_child(hud)
    hud.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
    hud.mouse_filter = Control.MOUSE_FILTER_IGNORE

    status_label = _label(hud, 23, Color("#e9dcc5"))
    status_label.position = Vector2(25, 20)
    status_label.size = Vector2(680, 40)
    objective_label = _label(hud, 17, Color("#a9e9ef"))
    objective_label.position = Vector2(25, 66)
    objective_label.size = Vector2(760, 48)
    tip_label = _label(hud, 15, Color("#c4d0da"))
    tip_label.anchor_top = 1
    tip_label.anchor_bottom = 1
    tip_label.offset_left = 25
    tip_label.offset_top = -48
    tip_label.offset_right = 600
    tip_label.offset_bottom = -12

    health_bar = ProgressBar.new()
    hud.add_child(health_bar)
    health_bar.position = Vector2(26, 122)
    health_bar.custom_minimum_size = Vector2(240, 15)
    health_bar.show_percentage = false
    health_bar.max_value = 100
    health_bar.value = 100
    var fill := StyleBoxFlat.new()
    fill.bg_color = Color("#de8269")
    fill.set_corner_radius_all(6)
    health_bar.add_theme_stylebox_override("fill", fill)

    var pause_button := _button(hud, "Ⅱ  PAUSE")
    pause_button.anchor_left = 1
    pause_button.anchor_right = 1
    pause_button.offset_left = -142
    pause_button.offset_right = -20
    pause_button.offset_top = 20
    pause_button.offset_bottom = 68
    pause_button.pressed.connect(_pause_game)

    var strike := _button(hud, "STRIKE")
    strike.anchor_left = 1
    strike.anchor_right = 1
    strike.anchor_top = 1
    strike.anchor_bottom = 1
    strike.offset_left = -182
    strike.offset_right = -23
    strike.offset_top = -154
    strike.offset_bottom = -81
    strike.pressed.connect(_attack)

    var echo_button := _button(hud, "ECHO")
    echo_button.anchor_left = 1
    echo_button.anchor_right = 1
    echo_button.anchor_top = 1
    echo_button.anchor_bottom = 1
    echo_button.offset_left = -342
    echo_button.offset_right = -192
    echo_button.offset_top = -111
    echo_button.offset_bottom = -42
    echo_button.pressed.connect(_cast_echo)

    overlay = ColorRect.new()
    canvas.add_child(overlay)
    overlay.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
    overlay.color = Color(0.015, 0.028, 0.044, 0.87)
    var center := CenterContainer.new()
    overlay.add_child(center)
    center.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
    overlay_box = VBoxContainer.new()
    overlay_box.custom_minimum_size = Vector2(480, 100)
    overlay_box.add_theme_constant_override("separation", 12)
    center.add_child(overlay_box)

    letter_top = ColorRect.new()
    canvas.add_child(letter_top)
    letter_top.color = Color("#070d17")
    letter_top.set_anchors_and_offsets_preset(Control.PRESET_TOP_WIDE)
    letter_top.offset_bottom = 64
    letter_bottom = ColorRect.new()
    canvas.add_child(letter_bottom)
    letter_bottom.color = Color("#070d17")
    letter_bottom.anchor_left = 0
    letter_bottom.anchor_right = 1
    letter_bottom.anchor_top = 1
    letter_bottom.anchor_bottom = 1
    letter_bottom.offset_top = -112
    letter_bottom.offset_bottom = 0
    subtitle = _label(letter_bottom, 22, Color("#e4e1d8"))
    subtitle.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
    subtitle.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
    subtitle.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
    letter_top.hide()
    letter_bottom.hide()

func _label(parent: Node, font_size: int, tint: Color) -> Label:
    var label := Label.new()
    parent.add_child(label)
    label.add_theme_color_override("font_color", tint)
    label.add_theme_font_size_override("font_size", font_size)
    label.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.8))
    label.add_theme_constant_override("shadow_offset_x", 2)
    label.add_theme_constant_override("shadow_offset_y", 3)
    return label

func _button(parent: Node, caption: String) -> Button:
    var button := Button.new()
    button.text = caption
    button.focus_mode = Control.FOCUS_NONE
    button.add_theme_font_size_override("font_size", 18)
    var normal := StyleBoxFlat.new()
    normal.bg_color = Color("#15313e")
    normal.border_color = Color("#5cbac2")
    normal.set_border_width_all(1)
    normal.set_corner_radius_all(10)
    normal.set_content_margin_all(8)
    button.add_theme_stylebox_override("normal", normal)
    var hover := normal.duplicate() as StyleBoxFlat
    hover.bg_color = Color("#236071")
    button.add_theme_stylebox_override("hover", hover)
    var pressed := normal.duplicate() as StyleBoxFlat
    pressed.bg_color = Color("#386f7b")
    button.add_theme_stylebox_override("pressed", pressed)
    parent.add_child(button)
    return button

func _show_overlay(heading: String, description: String, choices: Array) -> void:
    overlay.show()
    for child in overlay_box.get_children():
        child.queue_free()
    var brand := _label(overlay_box, 15, Color("#67dbdc"))
    brand.text = "V Q   /   E C H O F O R M"
    brand.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
    var title := _label(overlay_box, 37, Color("#f2e7cd"))
    title.text = heading
    title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
    var body := _label(overlay_box, 17, Color("#c1ced2"))
    body.text = description
    body.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
    body.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
    body.custom_minimum_size = Vector2(450, 88)
    for option in choices:
        var b := _button(overlay_box, str(option[0]))
        b.custom_minimum_size = Vector2(420, 50)
        b.pressed.connect(_choose.bind(str(option[1])))

func _open_menu() -> void:
    mode = "menu"
    hud.hide()
    hero.hide()
    letter_top.hide()
    letter_bottom.hide()
    _show_overlay("FRACTURED REALMS",
        "Five broken realms. One memory to restore.\nA third-person, offline 3D adventure.",
        [["BEGIN JOURNEY", "begin"], ["CONTINUE — REALM %d" % (max_unlocked + 1), "continue"], ["HOW TO PLAY", "help"]])

func _choose(option: String) -> void:
    match option:
        "begin":
            _load_level(0)
            _begin_intro()
        "continue":
            _load_level(max_unlocked)
            _begin_intro()
        "help":
            _show_overlay("HOW TO PLAY",
                "Move: WASD / arrows / drag on the left.\nStrike: J or STRIKE. Time echo: Space or ECHO.\nCollect 3 memory shards and defeat each guardian.\nReach the illuminated gate to advance.",
                [["RETURN", "menu"]])
        "menu":
            _open_menu()
        "resume":
            mode = "play"
            overlay.hide()
            hud.show()
        "retry":
            _load_level(level)
            _start_play()
        "next":
            _load_level(mini(level + 1, 4))
            _begin_intro()
    if option == "menu":
        hero.hide()

func _load_level(index: int) -> void:
    level = index
    if is_instance_valid(forge):
        forge.queue_free()
    forge = FORGE.new()
    add_child(forge)
    forge.build_realm(level)
    hero = CharacterBody3D.new()
    hero.name = "Traveler"
    forge.add_child(hero)
    hero.position = Vector3(0, 1.12, 12)
    var collision := CollisionShape3D.new()
    var shape := CapsuleShape3D.new()
    shape.radius = 0.38
    shape.height = 1.95
    collision.shape = shape
    hero.add_child(collision)
    hero_art = forge.make_actor("hero")
    hero.add_child(hero_art)
    hero_art.position.y = -0.1
    hero.hide()
    echo_art = forge.make_actor("echo")
    forge.add_child(echo_art)
    echo_art.hide()
    enemies.clear()
    shards.clear()
    history.clear()
    echo_path.clear()
    collected = 0
    guardian_down = false
    health = 100
    attack_timer = 0
    damage_flash = 0
    for i in range(3):
        var locations := [Vector3(-6, 0.95, -6), Vector3(7, 0.95, -19), Vector3(-4, 0.95, -31)]
        var crystal := forge.make_shard()
        crystal.position = locations[i]
        forge.add_child(crystal)
        shards.append({"node": crystal, "collected": false, "y": crystal.position.y})
    var foe_types := ["stalker", "warden", "caster", "stalker", "warden", "caster"]
    var spawn := [
        Vector3(-5, 1.0, -9), Vector3(6, 1.0, -14),
        Vector3(0, 1.0, -22), Vector3(-7, 1.0, -27),
        Vector3(7, 1.0, -32), Vector3(-3, 1.0, -37)]
    for i in range(spawn.size()):
        _spawn_enemy(foe_types[(i + level) % foe_types.size()], spawn[i], false)
    _spawn_enemy("guardian", Vector3(0, 1.0, -40), true)
    portal = forge.portal
    camera.position = Vector3(18, 12, 25)
    camera.look_at(Vector3(0, 1, -21))
    _refresh_hud()

func _spawn_enemy(kind: String, place: Vector3, boss: bool) -> void:
    var actor := forge.make_actor(kind)
    forge.add_child(actor)
    actor.position = place
    enemies.append({
        "node": actor, "origin": place, "hp": 150 if boss else (66 if kind == "warden" else 45),
        "max_hp": 150 if boss else (66 if kind == "warden" else 45),
        "speed": 1.9 if boss else (3.1 if kind == "stalker" else 2.2),
        "cooldown": 0.0, "dead": false, "boss": boss, "kind": kind, "time": float(enemies.size()) * 0.7
    })

func _begin_intro() -> void:
    mode = "intro"
    intro_time = 0
    overlay.hide()
    hud.hide()
    hero.hide()
    letter_top.show()
    letter_bottom.show()
    subtitle.text = "Long ago, the world fractured into echoes..."

func _start_play() -> void:
    mode = "play"
    letter_top.hide()
    letter_bottom.hide()
    overlay.hide()
    hud.show()
    hero.show()
    _refresh_hud()

func _process(delta: float) -> void:
    game_time += delta
    if mode == "menu":
        camera.position = Vector3(sin(game_time * 0.13) * 21.0, 12.5, 20)
        camera.look_at(Vector3(0, 2.7, -22))
    elif mode == "intro":
        intro_time += delta
        var t := minf(intro_time / INTRO_DURATION, 1.0)
        camera.position = Vector3(18.0 * (1.0-t), 12.0 - 7.0*t, 23.0 - 30.0*t)
        camera.look_at(Vector3(0, 2.1, -25 - t * 10))
        if intro_time < 3.3:
            subtitle.text = "Long ago, the world fractured into echoes..."
        elif intro_time < 7.0:
            subtitle.text = "Five realms guard the memories of a vanished civilization."
        else:
            subtitle.text = "Gather their fragments. Defeat the keepers. Restore time."
        if intro_time >= INTRO_DURATION:
            _start_play()
    elif mode == "play":
        for piece in shards:
            if not piece["collected"]:
                var n: Node3D = piece["node"]
                n.rotate_y(delta * 1.35)
                n.position.y = float(piece["y"]) + sin(game_time * 2.4 + n.position.z) * 0.20
        forge.animate_portal(delta, collected == SHARD_GOAL and guardian_down)

func _physics_process(delta: float) -> void:
    if mode != "play":
        return
    attack_timer = maxf(0.0, attack_timer - delta)
    damage_flash = maxf(0.0, damage_flash - delta)
    var axis := Input.get_vector("ui_left", "ui_right", "ui_up", "ui_down")
    if touch_id != -1:
        axis = touch_vector
    var direction := Vector3(axis.x, 0, axis.y)
    if direction.length() > 1:
        direction = direction.normalized()
    hero.velocity.x = direction.x * MOVE_SPEED
    hero.velocity.z = direction.z * MOVE_SPEED
    hero.velocity.y = -4.0 if hero.is_on_floor() else hero.velocity.y - 15.0 * delta
    hero.move_and_slide()
    hero.position.x = clampf(hero.position.x, -24, 24)
    hero.position.z = clampf(hero.position.z, -45, 16)
    if direction.length() > 0.05:
        hero_art.rotation.y = lerp_angle(hero_art.rotation.y, atan2(direction.x, direction.z), delta * 13)
    hero_art.position.y = -0.1 + (sin(game_time * 12.0) * 0.05 if direction.length() > 0.05 else 0.0)
    camera.position = camera.position.lerp(hero.global_position + Vector3(0, 5.7, 9.8), minf(1.0, delta * 5.4))
    camera.look_at(hero.global_position + Vector3(0, 1.1, -1.2), Vector3.UP)

    history.append(hero.position)
    if history.size() > 165:
        history.pop_front()
    if not echo_path.is_empty():
        echo_timer += delta
        if echo_timer >= 0.05:
            echo_timer = 0
            echo_art.position = echo_path[echo_cursor]
            echo_cursor += 1
            if echo_cursor >= echo_path.size():
                echo_path.clear()
                echo_art.hide()

    _update_enemies(delta)
    for shard in shards:
        if not shard["collected"]:
            var crystal: Node3D = shard["node"]
            if hero.global_position.distance_to(crystal.global_position) < 1.8:
                shard["collected"] = true
                crystal.queue_free()
                collected += 1
                _refresh_hud()
    if collected >= SHARD_GOAL and guardian_down and hero.global_position.distance_to(portal.global_position + Vector3(0, 1, 0)) < 4.0:
        _finish_level()

func _update_enemies(delta: float) -> void:
    for enemy in enemies:
        if enemy["dead"]:
            continue
        var actor: Node3D = enemy["node"]
        enemy["time"] = float(enemy["time"]) + delta
        enemy["cooldown"] = maxf(0, float(enemy["cooldown"]) - delta)
        var target := hero.position
        if echo_art.visible and actor.position.distance_to(echo_art.position) < 9:
            target = echo_art.position
        var toward := target - actor.position
        toward.y = 0
        var distance := toward.length()
        if distance < 15 and distance > 1.4:
            actor.position += toward.normalized() * float(enemy["speed"]) * delta
            actor.rotation.y = lerp_angle(actor.rotation.y, atan2(toward.x, toward.z), delta * 7.0)
        elif distance >= 15:
            actor.position.x = float(enemy["origin"].x) + sin(float(enemy["time"]) * 0.7) * 1.4
        var bob := sin(float(enemy["time"]) * (4.0 if enemy["kind"] == "stalker" else 2.1)) * 0.08
        actor.position.y = float(enemy["origin"].y) + bob
        if actor.position.distance_to(hero.position) < 1.9 and float(enemy["cooldown"]) <= 0:
            enemy["cooldown"] = 1.4 if enemy["boss"] else 2.0
            health = maxi(0, health - (20 if enemy["boss"] else 11))
            damage_flash = 0.22
            _refresh_hud()
            if health == 0:
                _game_over()
                return

func _attack() -> void:
    if mode != "play" or attack_timer > 0:
        return
    attack_timer = 0.46
    var tw := create_tween()
    tw.tween_property(hero_art, "rotation:z", -0.20, 0.12)
    tw.tween_property(hero_art, "rotation:z", 0.0, 0.20)
    for foe in enemies:
        if foe["dead"]:
            continue
        var enemy_node: Node3D = foe["node"]
        if hero.position.distance_to(enemy_node.position) <= 3.3:
            foe["hp"] = int(foe["hp"]) - 25
            var hit := create_tween()
            hit.tween_property(enemy_node, "scale", Vector3(1.13, 0.86, 1.13), 0.08)
            hit.tween_property(enemy_node, "scale", Vector3.ONE, 0.15)
            if int(foe["hp"]) <= 0:
                foe["dead"] = true
                if foe["boss"]:
                    guardian_down = true
                enemy_node.queue_free()
                _refresh_hud()

func _cast_echo() -> void:
    if mode != "play" or history.size() < 15 or not echo_path.is_empty():
        return
    echo_path = history.duplicate()
    echo_cursor = 0
    echo_timer = 0
    echo_art.show()
    echo_art.position = echo_path[0]

func _refresh_hud() -> void:
    status_label.text = "%02d  /  %s" % [level + 1, str(FORGE.LEVELS[level]["name"])]
    objective_label.text = "MEMORIES  %d / 3     GUARDIAN  %s" % [collected, "FALLEN" if guardian_down else "ALIVE"]
    tip_label.text = "Find the gate" if collected == SHARD_GOAL and guardian_down else "Gather memories • Defeat the guardian"
    health_bar.value = health

func _finish_level() -> void:
    if level == 4:
        mode = "victory"
        hud.hide()
        _show_overlay("TIME RESTORED", "All five fractured realms are reunited.\nThe echoes remember your journey.", [["NEW JOURNEY", "begin"], ["MAIN MENU", "menu"]])
    else:
        max_unlocked = maxi(max_unlocked, level + 1)
        var config := ConfigFile.new()
        config.set_value("campaign", "unlocked", max_unlocked)
        config.save("user://fractured_realms_save.cfg")
        mode = "clear"
        hud.hide()
        _show_overlay("REALM RESTORED", "All three memories recovered. The guardian has fallen.\nThe passage ahead is now open.", [["ENTER NEXT REALM", "next"], ["REPLAY", "retry"], ["MAIN MENU", "menu"]])

func _game_over() -> void:
    mode = "dead"
    hud.hide()
    _show_overlay("AN ECHO FADES", "Your memories are not lost.\nRise and try the realm again.", [["RETRY REALM", "retry"], ["MAIN MENU", "menu"]])

func _pause_game() -> void:
    if mode != "play":
        return
    mode = "paused"
    hud.hide()
    _show_overlay("PAUSED", "The world can wait for a moment.", [["RESUME", "resume"], ["RESTART REALM", "retry"], ["MAIN MENU", "menu"]])

func _input(event: InputEvent) -> void:
    if mode == "intro" and (event is InputEventScreenTouch and event.pressed or event is InputEventKey and event.pressed):
        intro_time = INTRO_DURATION
        return
    if mode != "play":
        return
    if event is InputEventKey and event.pressed and not event.echo:
        if event.keycode == KEY_J:
            _attack()
        elif event.keycode == KEY_SPACE:
            _cast_echo()
        elif event.keycode == KEY_ESCAPE:
            _pause_game()
    elif event is InputEventScreenTouch:
        var rect := get_viewport().get_visible_rect()
        if event.pressed and event.position.x < rect.size.x * 0.48 and event.position.y > rect.size.y * 0.36:
            touch_id = event.index
            touch_origin = event.position
            touch_vector = Vector2.ZERO
        elif not event.pressed and event.index == touch_id:
            touch_id = -1
            touch_vector = Vector2.ZERO
    elif event is InputEventScreenDrag and event.index == touch_id:
        touch_vector = ((event.position - touch_origin) / 85.0).limit_length(1.0)
