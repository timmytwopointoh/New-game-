"""Recover the persistent Pek's Plunder TEST signing key from one Actions secret.
Fails safely if the key is missing or the certificate identity changes.
NEVER use this development key for a production release.
"""
import base64
import json
import os
from pathlib import Path
import re
import subprocess
import sys

EXPECTED_CERT_SHA256 = "50e1a5bdab57ed7fb87ed7d1d8714cdc7ad8804fbeaedcba8c80ce3d50baddd7"

def restore():
    secret = os.environ.get("PEKS_TEST_SIGNING_BUNDLE", "").strip()
    if not secret:
        sys.exit("ERROR: Add GitHub Actions repository secret PEKS_TEST_SIGNING_BUNDLE before building. Refusing to sign with a new temporary key.")
    try:
        bundle = json.loads(base64.b64decode(secret, validate=True))
        assert bundle["version"] == 1 and bundle["alias"] == "peks_test"
        keyfile = base64.b64decode(bundle["keystore_base64"], validate=True)
        pwd = bundle["store_password"]
        assert isinstance(pwd, str) and len(pwd) >= 16 and bundle["key_password"] == pwd
    except Exception as e:
        sys.exit("Invalid signing bundle: " + type(e).__name__)
    location = Path(os.environ.get("RUNNER_TEMP", "/tmp")) / "peks-test-signing.p12"
    location.write_bytes(keyfile)
    location.chmod(0o600)
    details = subprocess.run(["keytool", "-list", "-v", "-keystore", str(location), "-storepass", pwd], check=True, capture_output=True, text=True).stdout
    match = re.search(r"SHA256: ([0-9A-Fa-f:]+)", details)
    fingerprint = match.group(1).replace(":", "").lower() if match else None
    if fingerprint != EXPECTED_CERT_SHA256:
        sys.exit("ERROR: Test signing certificate changed; build stopped to protect Android update compatibility.")
    with Path(os.environ["GITHUB_ENV"]).open("a") as out:
        out.write("PEKS_TEST_KEYSTORE_PATH=" + str(location) + "\n")
        out.write("PEKS_TEST_STORE_PASSWORD=" + pwd + "\n")
        out.write("PEKS_TEST_KEY_PASSWORD=" + pwd + "\n")
    print("Persistent TEST signing verified. Certificate SHA-256:", fingerprint)

if __name__ == "__main__":
    restore()
