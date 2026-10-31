# Permanent updates after v0.9.11

The owner received a privately backed-up PKCS12 signing key for the locally signed v0.9.11 APK. Never generate a replacement key for updates. Public SHA256 certificate: B5D275706B574EEA53D6497A3A65542542B5DB0E0E57F4E307E8ED17CF24F995. Alias: realm-ai-update. Application ID: com.veilforge.realmagent. Initial permanent APK versionCode: 100001.

The old debug signing key was not retained; migrating from the old installation requires uninstall/re-login. After migration, preserve app data by installing only higher-versionCode updates signed with the SAME permanent key. No permanent signing private material is committed here.

The GitHub integration cannot manage repository secrets (403). The owner must configure VF_ANDROID_KEYSTORE_B64 and VF_ANDROID_PASSWORD_B64 secrets plus VF_ANDROID_CERT_SHA256 variable from the private backup. Phone and PowerShell setup instructions are in that backup. Until this is done, future hosted builds intentionally fail rather than generate another debug key.

Once configured, request a build on this branch by creating a uniquely named text file under realm-ai-phone-build/stable-build-requests/. Source/workflow edits alone do not launch an APK build. The workflow signs with sign_permanent_apk.py, verifies the pinned certificate, increments versionCode, and publishes the signed APK. Local signing with the same key and simulated GitHub-secrets signing both passed, and a wrong pinned certificate was rejected. End-to-end hosted permanent signing remains untested until secrets are configured.

Pack repair changes variant tags from the historical patched 1..4 mapping back to 0..3 and uses lowercase wire response strings, matching Sandertv/gophertunnel's ResourcePackClientResponse implementation. Four independent byte fixtures and 104 Node tests passed; actual real-device Realm joining remains unverified. Do not claim the connection is fixed solely from a green build.
