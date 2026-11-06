"""Static contract checks, not a substitute for a Godot native launch."""
from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parents[1]
required = [
    "project.godot", "scenes/main.tscn", "game/Main.gd",
    "engine/Grim.gd", "engine/ChibiWorld.gd",
    "engine/IslandMind.gd", "engine/SaveSystem.gd",
    "docs/GAME_DESIGN.md", "docs/BUILD_AND_QA.md",
]
for name in required:
    path = ROOT / name
    assert path.is_file() and path.stat().st_size > 100, f"missing/empty: {name}"
config = (ROOT / "project.godot").read_text(encoding="utf8")
assert 'run/main_scene="res://scenes/main.tscn"' in config
main = (ROOT / "game/Main.gd").read_text(encoding="utf8")
for feature in ("_spawn", "_new_island", "_save_silent", "_load", "_build", "_gift", "_talk", "_unhandled_input"):
    assert re.search(r"func " + feature + r"\(", main), feature
mind = (ROOT / "engine/IslandMind.gd").read_text(encoding="utf8")
for feature in ("affinity", "bond", "tick", "give_gift", "gather", "pay"):
    assert re.search(r"func " + feature + r"\(", mind), feature
print("PASS: Chibi Island source structure, scene, behaviors and save contract")
print("NOT RUN: Godot parser, native viewport, APK/export, performance, visual QA")
