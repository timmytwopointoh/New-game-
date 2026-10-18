#!/usr/bin/env python3
"""Lightweight static design contract; this is not a render or import validation."""
from pathlib import Path
import re
import json
root = Path(__file__).resolve().parents[1]
campaign = (root/"scripts/campaign.gd").read_text()
forge = (root/"scripts/forge.gd").read_text()
scene = (root/"scenes/main.tscn").read_text()
project = (root/"project.godot").read_text()
export = (root/"export_presets.cfg").read_text()
models = json.loads((root/"assets/approved/manifest.json").read_text())
assert len(re.findall(r'\{"name": ', forge)) == 5
assert "com.fracturedrealms.game" in export
assert "ECHOFORM" not in project
assert 'res://scenes/main.tscn' in project
assert 'res://scripts/campaign.gd' in scene
assert 'res://scripts/forge.gd' in campaign
assert not any(term in campaign + forge + scene for term in ("res://game/", "res://veilbound/", "res://echoform/", "res://project-hail/"))
assert models["approved_assets"] == {}, "No unapproved VQ geometry can auto-enter release."
for name in ("_begin_intro", "_cast_echo", "_attack", "_finish_level", "_update_enemies", "_refresh_hud"):
    assert "func " + name in campaign, name
for realm in ("_ember_realm", "_forest_realm", "_archive_realm", "_iron_realm", "_crown_realm"):
    assert "func " + realm in forge
print("FRACTURED_REALMS_STANDALONE_SOURCE_CONTRACT_OK (not a Godot/runtime/visual approval)")
