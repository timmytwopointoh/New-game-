#!/usr/bin/env python3
"""
Rovekin integration safety gate. No Android toolchain, network, GitHub Actions,
Microsoft credentials or signing secret is needed.

Run at repository checkout:
    python3 rovekin-menu-preview/integration/verify_integration.py

The live build is the source of truth. This checks route parity, package identity,
presence of retained feature handlers and pure Java integration tests.
"""
from __future__ import annotations

import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

PROJECT = Path(__file__).resolve().parents[1] # rovekin-menu-preview
REPO = PROJECT.parent
APP = REPO / "realm-ai-phone-build/realm-ai-live-v021-overlay/android-app/app"
MAIN = APP / "src/main/java/com/veilforge/realmagent/MainActivity.java"
SERVICE = APP / "src/main/java/com/veilforge/realmagent/BotService.java"
MANIFEST = APP / "src/main/AndroidManifest.xml"
GRADLE = APP / "build.gradle"
NATIVE = PROJECT / "integration/src/main/java/com/veilforge/realmagent"
TESTS = PROJECT / "integration/tests/com/veilforge/realmagent"
FAIL = []

def require(condition: bool, label: str) -> None:
    print(("PASS" if condition else "FAIL") + " " + label)
    if not condition: FAIL.append(label)

def content(path: Path) -> str:
    if not path.is_file():
        FAIL.append(f"Missing source file: {path}")
        return ""
    return path.read_text(encoding="utf-8")

main = content(MAIN)
service = content(SERVICE)
manifest = content(MANIFEST)
gradle = content(GRADLE)
features = content(NATIVE / "RovekinFeatureContract.java")
router = content(NATIVE / "RovekinActionRouter.java")

# Original app identity, visible update history, auth, local service and program entry.
require("applicationId 'com.veilforge.realmagent.live'" in gradle, "same production Android package")
require('android:name="com.veilforge.realmagent.MainActivity"' in manifest, "original launcher activity")
require('android:name="com.veilforge.realmagent.BotService"' in manifest, "original on-phone BotService")
require("com.veilforge.realmagent" in main, "original MainActivity class package")
require("getPreferences(MODE_PRIVATE)" in main, "existing saved setup/session preferences")
require('getString("token"' in main and 'putString("token"' in main, "existing controller auth token preserved")
require('getString("botTag"' in main and 'getString("ownerTag"' in main, "existing bot + owner fields preserved")
require('put("ownerPlayerNames"' in main and 'put("botPlayerName"' in main,
        "separate owner and bot identity still configured")
require('getAssets()' in service and 'nodejs-project' in service, "original embedded bot runtime retained")
require('START_NOT_STICKY' in service and 'startNodeWithArguments' in service, "original on-device Node engine retained")

# Check every action delegate against a real existing MainActivity method.
# The menu never replaces these with a second implementation.
required_methods = {
    "send": r"\bvoid\s+send\s*\(\s*String\s+raw\s*\)",
    "showJobs": r"\bvoid\s+showJobs\s*\(",
    "showPlans": r"\bvoid\s+showPlans\s*\(",
    "activateQueuedPlans": r"\bvoid\s+activateQueuedPlans\s*\(",
    "stopNow": r"\bvoid\s+stopNow\s*\(",
    "retryBlocked": r"\bvoid\s+retryBlocked\s*\(",
    "showAuth": r"\bvoid\s+showAuth\s*\(",
    "showLearning": r"\bvoid\s+showLearning\s*\(",
    "showSettings": r"\bvoid\s+showSettings\s*\(",
    "stopServiceNow": r"\bvoid\s+stopServiceNow\s*\(",
    "exportBugReport": r"\bvoid\s+exportBugReport\s*\(",
    "startBot": r"\bvoid\s+startBot\s*\(",
    "update": r"\bvoid\s+update\s*\(",
    "saveAccountSettings": r"\bvoid\s+saveAccountSettings\s*\(",
}
for name, pattern in required_methods.items():
    require(bool(re.search(pattern, main)), f"existing handler: {name}")

# Integrating a new interface must not hide real status or invent sign-in codes.
require('"/message"' in main and '"/catalog"' in main, "existing chat + catalog backend routes")
require('"/plans/"' in main and '"/stop?epoch="' in main, "existing queue + emergency STOP routes")
require('"/updates?after="' in main, "existing status update channel")
require('"authChallenge"' in main and '"userCode"' in main, "real Microsoft user-code display path")
require('"spawned"' in main and '"joined"' in main, "joined vs spawned distinction retained")
require('AppUpdater.show(this)' in main, "existing updater still reachable")
require('new CommandDeck(this,catalog)' in main, "existing detailed command UI still reachable")

# All future commands remain available via the live catalog, including unknown IDs.
require("allDiscoveredSkills" in features and "unmodifiableList" in features,
        "unrecognized future skills are never filtered out")
require("case COMMAND_CATALOG:" in router and "host.openCommandCatalog()" in router,
        "public UI browses the live command catalog")
require("case EMERGENCY_STOP:" in router and "host.stopCurrentJob()" in router,
        "STOP always delegates to existing urgent handler")
require("case DIAGNOSTIC_EXPORT:" in router and "host.exportDiagnostics()" in router,
        "developer diagnostics reuse existing ZIP exporter")
require("hasVerifiedDeveloperEntitlement" in features and "hasVerifiedOwner" in features,
        "developer role needs both verified owner and signed entitlement")

# Pure Java checks also cover public access, role separation, new skill discovery.
java = shutil.which("java")
javac = shutil.which("javac")
require(bool(java and javac), "local Java compiler/runtime available")
if java and javac:
    with tempfile.TemporaryDirectory(prefix="rovekin-parity-") as td:
        sources = [
            NATIVE / "RovekinFeatureContract.java",
            NATIVE / "RovekinActionRouter.java",
            TESTS / "RovekinFeatureContractTest.java",
        ]
        try:
            build = subprocess.run([javac,"-d",td,*map(str,sources)],
                                   capture_output=True,text=True,timeout=40)
            require(build.returncode == 0, "integration Java sources compile")
            if build.returncode == 0:
                run = subprocess.run([java,"-cp",td,
                    "com.veilforge.realmagent.RovekinFeatureContractTest"],
                    capture_output=True,text=True,timeout=40)
                require(run.returncode == 0, "integration contract tests pass")
                print(run.stdout.strip() or run.stderr.strip())
            else:
                print(build.stderr.strip()[-1600:])
        except (OSError, subprocess.TimeoutExpired) as err:
            FAIL.append(f"Java test could not run: {err}")

if FAIL:
    print(f"\nFAILED {len(FAIL)} check(s). Integration blocked until resolved.")
    sys.exit(1)
print("\nPASS: production compatibility contract checks completed.")
print("NOTE: Android UI build, device/emulator, owner authentication, Realm join,")
print("resource packs and APK signing still require separate real-world tests.")
