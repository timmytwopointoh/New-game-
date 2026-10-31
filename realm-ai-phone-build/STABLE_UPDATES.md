# VEILFORGE Realm AI — Permanent Android Updates

This is the **isolated stable-signing branch** for the phone-only Realm bot. No Peks Plunder game source or existing releases are changed.

## Why the old APK won't update

Android will replace an installed APK without clearing its private app data only when the **application ID, signing certificate, and versionCode** are compatible. Our earlier v0.9.x APKs were debug-signed separately by GitHub runners; their private signing key was not retained. Nobody can derive that private key from the APK. **The first permanently signed build may need one more uninstall/re-login** if the existing debug certificate differs. After that, all future packages signed with the **same permanent key** can install over the app and retain its login cache.

## One-time setup on your own Windows PC

Prerequisites: GitHub CLI `gh`, Java JDK 17 or later (`keytool`), access to private `timmytwopointoh/New-game-`.

1. On GitHub switch to branch `sandbox/realm-ai-stable-signing-20261030`, choose **Code → Download ZIP**, extract it to your Windows PC. Or clone it locally using GitHub Desktop.
2. Open PowerShell in `realm-ai-phone-build` and sign into GitHub locally if needed: `gh auth login`.
3. Run: `powershell -ExecutionPolicy Bypass -File .\setup-stable-signing.ps1`
4. Choose a strong signing password **locally** and store it in your password manager. NEVER share it in a chat or commit it to GitHub.
5. The script creates a local PKCS12 key under your Windows profile, uploads only the encrypted keystore and Base64-encoded password into GitHub Actions **secrets**, stores the public certificate fingerprint as a GitHub Actions **variable**, and requests the first signed APK build.
6. Back up `%USERPROFILE%\VEILFORGE-Android-Signing\realm-ai-update.p12` in a secure offline/encrypted location. Keep the password in a password manager. **Never regenerate the key** after installing the first stable APK.

The GitHub Actions configuration expects:
- Secret `VF_ANDROID_KEYSTORE_B64` — PKCS12 keystore, base64
- Secret `VF_ANDROID_PASSWORD_B64` — UTF-8 password, base64 (still secret)
- Variable `VF_ANDROID_CERT_SHA256` — public pinned signing-certificate SHA-256 fingerprint

No secrets means **no APK will be published**. A changed signing certificate also blocks publication.

## Every future signed update

From that same folder run: `powershell -ExecutionPolicy Bypass -File .\request-stable-build.ps1`

This commits a harmless timestamped request into `stable-build-requests/`, triggers `.github/workflows/realm-ai-stable-android.yml`, rebuilds the phone-hosted AI, verifies the permanent certificate, increments `versionCode`, and publishes a signed APK to the repository's GitHub Releases.

You can also request a future update directly from your phone: open this branch on GitHub, choose **Add file → Create new file**, give it a unique name such as `realm-ai-phone-build/stable-build-requests/next-build-2.txt`, type `build`, and commit to the stable-signing branch. The same signed release workflow will run. Use a different filename each time.

The user downloads the APK and installs it **over the existing stable-signed app**. Do not uninstall it: doing so erases the saved Microsoft sign-in data.

## Important limits

- This solves *future signing consistency and data-preserving installs*. It does **not** sign an update with the lost debug private key. Initial migration may require a one-time re-login.
- The current v0.9.3 Realm pack handler is experimental. Only simulated packet tests have passed, not real Minecraft Realm joins.
- Never upload Microsoft credentials or Xbox session tokens to GitHub. The phone's login tokens stay on the phone.
- The stable branch is intentionally separate from Peks Plunder and from the original Android preview build workflow.
- You must keep the PKCS12 private key and password backed up. If they are lost, future APKs cannot update the stable app with the same certificate.
- Avoid publishing a repo- or organization-wide secret to untrusted workflows. Review GitHub repository collaborators and Actions settings.

Build status: **pipeline and setup scripts are committed; a stable-signed APK is not yet generated until the user securely installs the signing key into GitHub secrets and requests a build**.
