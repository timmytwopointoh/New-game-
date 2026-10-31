# Realm AI Live v0.21 permanent baseline

Package: `com.veilforge.realmagent.live`; versionCode 200002; versionName `0.21-signin-sharing`.

On 2026-10-31 the owner explicitly authorized creating a new permanent key after the old Live private key could not be recovered. This is a one-time replacement install: the old F268-signed installation must be removed and its app data cannot carry over. Future updates MUST use the new certificate `77694D4F0068469CB6F7FD951F84946A4BBB833AE2702DC2F87B9E0C2ADABF22` and alias `realm-live-update`. Never generate another replacement without explicit owner authorization. The private backup remains outside this repository.

Restores visible pending Microsoft code and Copy controls on home, clickable https://www.microsoft.com/link, and one-file sharing in Settings. The updater verifies release notices against the installed APK certificate. No login cache is cleared by the source changes.

13 Android button tests and the compact phone layout test passed. APK compiled from these Java sources, combined with the verified Live v0.20 native/runtime/assets, and signature/package/alignment/archive verified. No physical phone or live Realm connection test has been performed; this does not establish a fix for the reported 403.
