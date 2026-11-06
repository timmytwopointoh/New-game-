extends RefCounted
## Resident simulation: needs, personality, schedules, memories, relationships.
var elapsed: float = 0.0
var day: int = 1
var hour: float = 9.0
var speed: float = 1.0
var coins: int = 80
var supplies: Dictionary = {"wood": 14, "stone": 9, "flowers": 12, "cloth": 3, "crystals": 1}
var memories: Array = []
var relationships: Dictionary = {}
var decision_cooldowns: Dictionary = {}
var rng := RandomNumberGenerator.new()
var sites: Dictionary = {}

func _init() -> void:
	rng.randomize()

func initialize(world_sites: Dictionary) -> void:
	sites = world_sites.duplicate(true)

func note(line: String) -> void:
	memories.push_front("Day %d, %02d:%02d — %s" % [day, int(hour), int((hour - floorf(hour)) * 60), line])
	if memories.size() > 120:
		memories.resize(120)

func affinity(a: int, b: int) -> int:
	return int(relationships.get(str(mini(a, b)) + ":" + str(maxi(a, b)), 0))

func bond(a: int, b: int, change: int) -> void:
	if a == b:
		return
	var key := str(mini(a, b)) + ":" + str(maxi(a, b))
	relationships[key] = clampi(int(relationships.get(key, 0)) + change, -100, 100)

func tick(delta: float, grims: Array) -> void:
	var dt := delta * speed
	elapsed += dt
	hour += dt / 48.0
	if hour >= 24.0:
		hour -= 24.0
		day += 1
		note("The island wakes up for a new day.")
	for grim in grims:
		grim.hunger = clampf(grim.hunger + dt * 0.072, 0, 100)
		grim.energy = clampf(grim.energy - dt * 0.04, 0, 100)
		grim.social = clampf(grim.social - dt * 0.035, 0, 100)
		var key := str(grim.resident_id)
		var cd := float(decision_cooldowns.get(key, 0.0)) - dt
		if cd > 0 or grim.walking:
			decision_cooldowns[key] = maxf(0.0, cd)
			continue
		decide(grim, grims)
		decision_cooldowns[key] = rng.randf_range(8.0, 20.0)

func decide(grim: Node3D, grims: Array) -> void:
	var action := "wander"
	var site := "park"
	if grim.energy < 28 or hour > 22.5 or hour < 6:
		action = "sleep"
		site = "homes"
		grim.energy = minf(100, grim.energy + 24)
	elif grim.hunger > 59:
		action = "eat"
		site = "cafe"
		grim.hunger = maxf(0, grim.hunger - 40)
	elif grim.social < 40 and grims.size() > 1:
		var candidate = grims[rng.randi_range(0, grims.size() - 1)]
		if candidate != grim:
			grim.set_goal(candidate.position, "socialize")
			bond(grim.resident_id, candidate.resident_id, 2)
			grim.social = minf(100, grim.social + 26)
			note("%s went to spend time with %s." % [grim.display_name, candidate.display_name])
			return
	elif grim.personality == "Creative" and rng.randf() > 0.4:
		action = "create"
		site = "garden"
	elif grim.personality == "Playful":
		action = "play"
		site = "arcade"
	elif grim.personality == "Thoughtful":
		action = "read"
		site = "library"
	elif grim.personality == "Outgoing":
		action = "socialize"
		site = "market"
	else:
		site = ["park", "market", "beach", "garden", "library"][rng.randi_range(0, 4)]
	if sites.has(site):
		var point: Vector3 = sites[site]
		var scatter := Vector3(rng.randf_range(-2, 2), 0, rng.randf_range(-2, 2))
		grim.set_goal(point + scatter, action)

func arrival(grim: Node3D, grims: Array) -> void:
	if grim.activity == "eat":
		note("%s enjoyed a meal at the café." % grim.display_name)
	elif grim.activity == "create":
		supplies["flowers"] = int(supplies.get("flowers", 0)) + 1
		note("%s gathered a flower in the garden." % grim.display_name)
	elif grim.activity == "sleep":
		grim.energy = 100
	elif grim.activity == "play":
		coins += 2
	elif grim.activity == "socialize":
		for other in grims:
			if other != grim and other.position.distance_to(grim.position) < 3:
				bond(grim.resident_id, other.resident_id, 3)
				note("%s and %s shared a happy moment." % [grim.display_name, other.display_name])
				break

func give_gift(grim: Node3D) -> bool:
	if coins < 10:
		return false
	coins -= 10
	grim.social = minf(100, grim.social + 24)
	grim.mood = "excited"
	note("You gave %s a thoughtful present." % grim.display_name)
	return true

func gather() -> void:
	supplies["wood"] = int(supplies.get("wood", 0)) + 3
	supplies["stone"] = int(supplies.get("stone", 0)) + 2
	supplies["flowers"] = int(supplies.get("flowers", 0)) + 2
	note("The island gathered sustainable building materials.")

func can_build(recipe: Dictionary) -> bool:
	for item in recipe:
		if int(supplies.get(item, 0)) < int(recipe[item]):
			return false
	return true

func pay(recipe: Dictionary) -> bool:
	if not can_build(recipe):
		return false
	for item in recipe:
		supplies[item] = int(supplies[item]) - int(recipe[item])
	return true

func to_data() -> Dictionary:
	return {"day": day, "hour": hour, "coins": coins, "supplies": supplies,
	"memories": memories, "relationships": relationships, "speed": speed}

func from_data(data: Dictionary) -> void:
	day = maxi(1, int(data.get("day", 1)))
	hour = clampf(float(data.get("hour", 9)), 0, 23.99)
	coins = maxi(0, int(data.get("coins", 80)))
	supplies = data.get("supplies", supplies)
	memories = data.get("memories", [])
	relationships = data.get("relationships", {})
	speed = clampf(float(data.get("speed", 1)), 0.25, 4.0)
