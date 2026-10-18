#!/usr/bin/env python3
"""Cheap static smoke check, NOT Godot parser or emulator evidence."""
from pathlib import Path
import json
import re
root = Path(__file__).resolve().parents[1]
world = (root/"scripts/realm_campaign.gd").read_text()
forge = (root/"scripts/realm_forge.gd").read_text()
project = (root/"project.godot").read_text()
scene = (root/"scenes/campaign.tscn").read_text()
manifest = json.loads((root/"assets/approved/manifest.json").read_text())
assert len(re.findall(r'\{"name": ', forge)) == 5, "There must be exactly five level recipes"
for term in ("ember", "forest", "archive", "iron", "crown", "stalker", "warden", "caster", "guardian"):
    assert term in forge
for behavior in ("_begin_intro", "_cast_echo", "_attack", "_finish_level", "_update_enemies", "_refresh_hud"):
    assert ("func " + behavior) in world
assert 'res://scenes/campaign.tscn' in project
assert 'res://scripts/realm_campaign.gd' in scene
assert manifest["approved_assets"] == {}
assert "ResourceLoader.exists(path)" in forge
assert "queue_free()" in world
print("STATIC_CAMPAIGN_CONTRACT_OK; render, collision, FPS, APK and cinematic remain unverified until Godot/emulator QA")
