extends Node3D

# Vertical-slice foundation: third-person camera, 3D avatar and replaying echo.
# Temporary procedural geometry is intentionally NOT final character art.
var player: CharacterBody3D
var camera: Camera3D
var recorded: Array[Vector3] = []
var echo: MeshInstance3D
var replay: Array[Vector3] = []
var replay_index := 0
var tick := 0.0
var touch_direction := Vector2.ZERO

func _ready() -> void:
    player = CharacterBody3D.new()
    player.position = Vector3(0, 1, 0)
    add_child(player)
    var collision := CollisionShape3D.new()
    var capsule := CapsuleShape3D.new()
    capsule.radius = 0.35
    capsule.height = 1.8
    collision.shape = capsule
    player.add_child(collision)
    var body := MeshInstance3D.new()
    var mesh := CapsuleMesh.new()
    mesh.radius = 0.35
    mesh.height = 1.8
    body.mesh = mesh
    player.add_child(body)
    camera = Camera3D.new()
    camera.current = true
    add_child(camera)
    echo = MeshInstance3D.new()
    var echo_mesh := CapsuleMesh.new()
    echo_mesh.radius = 0.35
    echo_mesh.height = 1.8
    echo.mesh = echo_mesh
    echo.visible = false
    add_child(echo)

func _physics_process(delta: float) -> void:
    var direction := Input.get_vector("ui_left", "ui_right", "ui_up", "ui_down")
    if touch_direction.length() > 0.1:
        direction = touch_direction
    player.velocity = Vector3(direction.x * 5.0, 0.0, direction.y * 5.0)
    player.move_and_slide()
    tick += delta
    if tick >= 0.05:
        tick = 0.0
        recorded.append(player.global_position)
        if recorded.size() > 200:
            recorded.pop_front()
        if replay.size() > 0:
            echo.visible = true
            echo.global_position = replay[replay_index]
            replay_index = (replay_index + 1) % replay.size()
    camera.global_position = camera.global_position.lerp(player.global_position + Vector3(0, 4, 8), min(1.0, delta * 6.0))
    camera.look_at(player.global_position + Vector3.UP)

func _input(event: InputEvent) -> void:
    if event is InputEventScreenTouch and event.pressed:
        if event.position.x > get_viewport().get_visible_rect().size.x * 0.75:
            replay = recorded.duplicate()
            replay_index = 0
        else:
            touch_direction = Vector2.ZERO
    elif event is InputEventScreenDrag:
        var center := get_viewport().get_visible_rect().size * 0.5
        touch_direction = (event.position - center).normalized()
    elif event is InputEventScreenTouch and not event.pressed:
        touch_direction = Vector2.ZERO
    elif event.is_action_pressed("ui_accept"):
        replay = recorded.duplicate()
        replay_index = 0
