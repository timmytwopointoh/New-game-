# VEILFORGE Realm AI v0.22 — selected file sharing TEST

Settings now offers “Share one file…” using Android's built-in file picker and Share sheet. The user chooses one file and the receiving app. The app gets temporary read access to that selected URI only; it requests no broad storage permission, keeps no file access, and scans no device files. The v0.21 Microsoft link fix and Copy control remain.

This update keeps the v0.21 offline glossary and command behavior. It uses versionCode 100019 and the same permanent Android signing certificate.

Android interaction regressions cover the picker, cancellation, read-only URI share grant and absence of broad storage permissions. Node regressions are unchanged from v0.20 (189 passed). The Android Gradle/Robolectric suite and a live Realm sign-in test were not run in this environment.
