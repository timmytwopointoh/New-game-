# VEILFORGE Realm AI v0.21 — Microsoft sign-in link TEST

The pending Microsoft device-code panel now shows a visibly linked `https://www.microsoft.com/link` address. Tapping it opens the official Microsoft page; the one-time code and Copy control remain available on the home screen.

This update keeps the v0.20 offline glossary and command behavior. It uses versionCode 100018 and the same permanent Android signing certificate.

The Android interaction regression verifies the link URL and its `ACTION_VIEW` intent. Node regressions are unchanged from v0.20 (189 passed). The Android Gradle/Robolectric suite and a live Realm sign-in test were not run in this environment.
