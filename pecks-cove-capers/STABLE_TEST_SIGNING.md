# Stable Android test updates for Pek's Plunder

Android upgrades require identical package IDs **and identical signing certificates**. APK v0.8 and v0.9 have different signatures because each GitHub runner generated a different debug key. They cannot upgrade each other in place.

This branch uses a **persistent, test-only signing key**, kept in a GitHub Actions repository secret, NOT in the public repository. It is not a production/Play Store key. The build fails rather than generating yet another incompatible debug signature.

## One-time setup
1. Download the private `PEKS_TEST_SIGNING_BUNDLE_SECRET.txt` file supplied in this ChatGPT conversation. Keep it secret and back it up.
2. In GitHub go to **timmytwopointoh/New-game- → Settings → Secrets and variables → Actions → New repository secret**.
3. Set the secret name to **PEKS_TEST_SIGNING_BUNDLE** and paste the *entire one-line text* from that private file as its value.
4. In the Actions tab re-run the job **Pek's Plunder stable Android updates (TEST signing)**, or trigger a fresh push to the dedicated branch. The workflow checks the certificate before building.
5. Download and install the new v0.9.1 test APK. You must first uninstall earlier temporary-key versions once (back up saves first); Android cannot upgrade them. From v0.9.1 onwards, subsequent APKs built with this same secret and higher versionCodes can upgrade normally.

Expected TEST signing certificate fingerprint (public SHA-256):
`50e1a5bdab57ed7fb87ed7d1d8714cdc7ad8804fbeaedcba8c80ce3d50baddd7`

Do **not** commit, post, or log the base64 bundle, private keystore, or password. Never reuse this debug/test key for production. Keep a safe private backup; losing this key breaks future in-place upgrades.
