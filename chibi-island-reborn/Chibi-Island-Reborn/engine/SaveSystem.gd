extends RefCounted
## Standalone versioned local saves; never touches another game's user:// data.
const VERSION := 1
const SLOT_COUNT := 3
const PREFIX := "user://chibi-island-reborn-slot-"

static func path_for(slot: int) -> String:
	return PREFIX + str(clampi(slot, 1, SLOT_COUNT)) + ".json"

static func store(slot: int, state: Dictionary) -> bool:
	var payload := {"schema": VERSION, "game": "Chibi Island Reborn", "state": state}
	var output := JSON.stringify(payload, "\t")
	var file := FileAccess.open(path_for(slot), FileAccess.WRITE)
	if file == null:
		return false
	file.store_string(output)
	file.close()
	return true

static func restore(slot: int) -> Dictionary:
	var path := path_for(slot)
	if not FileAccess.file_exists(path):
		return {}
	var raw := FileAccess.get_file_as_string(path)
	var result = JSON.parse_string(raw)
	if typeof(result) != TYPE_DICTIONARY:
		return {}
	if int(result.get("schema", -1)) != VERSION:
		return {}
	if str(result.get("game", "")) != "Chibi Island Reborn":
		return {}
	if typeof(result.get("state", null)) != TYPE_DICTIONARY:
		return {}
	return result["state"]
