Publication request for the owner-authorized v0.19 test APK.

The workflow reconstructs the exact locally signed APK from the public v0.18 base APK and a recipe containing public APK bytes only. It verifies the existing permanent certificate, package version, ZIP alignment, embedded source and source archive checksum before publishing the prerelease. No signing key or password is stored in GitHub Actions.
