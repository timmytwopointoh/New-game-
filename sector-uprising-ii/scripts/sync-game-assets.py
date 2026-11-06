#!/usr/bin/env python3
"""Bundle modular Sector II runtime into exact offline HTML assets, without network or dependencies."""
from pathlib import Path
import sys

root = Path(__file__).resolve().parents[1]
html = (root / "index.html").read_text(encoding="utf-8")
css = (root / "engine/style.css").read_text(encoding="utf-8")
js = (root / "engine/runtime.js").read_text(encoding="utf-8")
css_ref = '<link rel="stylesheet" href="engine/style.css">'
js_ref = '<script src="engine/runtime.js"></script>'
if html.count(css_ref) != 1 or html.count(js_ref) != 1:
    raise SystemExit("ERROR: expected single local stylesheet and engine script")
bundle = html.replace(css_ref, "<style>" + css + "</style>").replace(js_ref, "<script>" + js + "</script>")
targets = [
    root / "Afterlight-PLAY.html",
    root / "android/app/src/main/assets/index.html",
]
is_check = "--check" in sys.argv
mismatches = []
for target in targets:
    old = target.read_text(encoding="utf-8") if target.exists() else None
    if old != bundle:
        mismatches.append(str(target.relative_to(root)))
        if not is_check:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(bundle, encoding="utf-8")
if mismatches and is_check:
    raise SystemExit("FAIL: bundled files out of sync: " + ", ".join(mismatches))
print("PASS" if not mismatches else "UPDATED", "offline bundles", len(bundle.encode("utf-8")), "bytes")
