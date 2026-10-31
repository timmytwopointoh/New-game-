#!/usr/bin/env python3
"""Configure reproducible, permanently signed VEILFORGE Realm AI updates.

The signing key and passwords ONLY come from GitHub Actions secrets at build time.
Never add keystores, passwords, Microsoft tokens, or private data to this repository.
"""
from pathlib import Path
import os
import re
import sys

if len(sys.argv) != 3:
    raise SystemExit("usage: configure_stable_signing.py <android app build.gradle> <versionCode>")
path = Path(sys.argv[1])
code = int(sys.argv[2])
if not (13 <= code < 2100000000):
    raise SystemExit("versionCode must exceed the earlier Realm AI v0.9.3 code (12)")
source = path.read_text(encoding="utf-8")
if source.count("    compileSdk 35") != 1:
    raise SystemExit("Unsupported Android Gradle source; refusing to modify")
if source.count("versionCode 12") != 1:
    raise SystemExit("Expected v0.9.3 versionCode 12; refusing to modify")
if source.count("versionName '0.9.3-pack-support'") != 1:
    raise SystemExit("Expected v0.9.3 versionName; refusing to modify")
required_env = ("VF_ANDROID_KEYSTORE_FILE", "VF_ANDROID_STORE_PASSWORD", "VF_ANDROID_KEY_PASSWORD", "VF_ANDROID_KEY_ALIAS")
if any(not os.environ.get(k) for k in required_env):
    raise SystemExit("Missing required signing environment; refusing to create an unsigned or ephemeral-key APK")
if not Path(os.environ["VF_ANDROID_KEYSTORE_FILE"]).is_file():
    raise SystemExit("Signing keystore file missing")
signing = """    // Stable signing: CI supplies secrets at runtime. Never commit a keystore.
    signingConfigs {
        stableUpdate {
            storeFile file(System.getenv('VF_ANDROID_KEYSTORE_FILE'))
            storePassword System.getenv('VF_ANDROID_STORE_PASSWORD')
            keyAlias System.getenv('VF_ANDROID_KEY_ALIAS')
            keyPassword System.getenv('VF_ANDROID_KEY_PASSWORD')
        }
    }
    buildTypes {
        release {
            minifyEnabled false
            signingConfig signingConfigs.stableUpdate
        }
    }
"""
source = source.replace("    compileSdk 35\n", "    compileSdk 35\n" + signing, 1)
source = source.replace("versionCode 12", "versionCode " + str(code), 1)
source = source.replace("versionName '0.9.3-pack-support'", "versionName '0.9.3-stable." + str(code) + "'", 1)
if "applicationId 'com.veilforge.realmagent'" not in source:
    raise SystemExit("Unexpected application ID: cannot preserve future updates")
path.write_text(source, encoding="utf-8")
print("Stable APK signing configured; package com.veilforge.realmagent, versionCode",code)
