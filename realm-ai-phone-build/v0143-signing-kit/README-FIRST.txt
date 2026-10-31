VEILFORGE Realm AI v0.14.3 — original-package permanent signing kit

This kit is ONLY for users who already have the exact original signing key.
It does NOT contain the secret private key or password.

WHY: The current installed v0.14 app was signed with certificate
B5D275706B574EEA53D6497A3A65542542B5DB0E0E57F4E307E8ED17CF24F995.
A new debug key or different package name CANNOT update it.

HOW TO FINISH ON THE WINDOWS PC WHERE YOU SAVED YOUR KEY:
1. Extract the entire ZIP to one folder (not just the APK).
2. Confirm you have %USERPROFILE%\VEILFORGE-Android-Signing\realm-ai-update.p12
   from the earlier permanent signing setup. Don't make a replacement.
3. Install JDK 17 if Java/keytool aren't installed.
4. Double click START-HERE.cmd and enter the EXISTING signing password.
5. The script verifies the original fingerprint, unsigned APK SHA256 and final APK signature.
6. Copy VEILFORGE-Realm-AI-v0.14.3-Permanent-Update.apk to Android.
7. Install directly over the installed v0.14 app. DO NOT uninstall; saved login remains.

This source uses the original application ID com.veilforge.realmagent, versionCode 100005,
and the existing v0.14 engine with the new inventory/Survival diagnostics, first-person-
aligned aim at block, and control input/server evidence. It does not include unsaved Codex
v0.15 mining/building changes. Live Realm behavior still needs testing.

If the original .p12 backup or password is unavailable, there is no secure way to produce a
same-certificate APK update. This script deliberately refuses to substitute a new key.

Optional easier updates later: configure *this same verified existing key* in repository
GitHub Actions secrets VF_ANDROID_KEYSTORE_B64, VF_ANDROID_PASSWORD_B64 and variable
VF_ANDROID_CERT_SHA256. Never send the private key or password into ChatGPT or git.
