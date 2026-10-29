#!/usr/bin/env python3
"""Offline VQ ecosystem contract validation; no network and no emulator."""
from pathlib import Path
import json
import sys
import re

def verify(root: Path) -> None:
    shared=json.loads((root/"ecosystem/vq_shared_rules_v1.json").read_text(encoding="utf-8"))
    role=json.loads((root/"ecosystem/repository_role.json").read_text(encoding="utf-8"))
    assert shared["schema_version"]=="vq-ecosystem-contract/1"
    assert shared["retention"]["model_promotion"].startswith("explicit human/artist")
    assert shared["construction_knowledge"]["no_auto_approval"] is True
    assert shared["safeguards"]["retain_human03_work"] is True
    assert shared["safeguards"]["retain_universal_vqshape1_work"] is True
    assert shared["architecture"]["target"]=="offline phone app"
    assert len(shared["repo_roles"])==4
    repo=role["repository"]
    assert repo in shared["repo_roles"]
    assert role["responsibility"]==shared["repo_roles"][repo]
    assert role["emulator_lab_exception"] == (repo==shared["emulator_exception_repository"])
    assert role["allow_automatic_model_approval"] is False
    assert role["retention_contract_version"]==shared["revision"]
    instructions=(root/"AGENTS.md").read_text(encoding="utf-8")
    assert "ecosystem/vq_shared_rules_v1.json" in instructions
    assert "Generate Human" in instructions
    assert "user approval" in instructions.lower()
    assert "VQShape/1" in (root/"docs/VQ_CROSS_REPO_HANDOFF.md").read_text(encoding="utf-8")
    workflow=(root/".github/workflows/artifact-lifecycle.yml").read_text(encoding="utf-8")
    # GitHub hosted Actions must not start automatically; local Codex runs the tests.
    assert "on:\n  workflow_dispatch:" in workflow
    assert re.search(r"(?m)^  (?:push|pull_request|schedule|workflow_run|repository_dispatch):", workflow) is None
    assert "deleteArtifact" in workflow
    assert "protectedName" in workflow and "newest" in workflow
    assert "if(e.status===404)" in workflow
    assert role["emulator_lab_exception"] or role["emulator_policy"]=="manual_or_review_gated"
    print("VQ_ECOSYSTEM_CONTRACT_PASS",repo,shared["revision"],
          "emulator_exception="+str(role["emulator_lab_exception"]).lower())

if __name__=="__main__":
    try:verify(Path(__file__).resolve().parents[1])
    except (AssertionError,KeyError,FileNotFoundError,ValueError) as exc:
        print("VQ_ECOSYSTEM_CONTRACT_FAIL",repr(exc),file=sys.stderr)
        raise SystemExit(1)
