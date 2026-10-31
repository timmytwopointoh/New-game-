This request publishes the locally built v0.17 test APK after reconstructing its public signed APK bytes and verifying its package, version, alignment, embedded runtime, checksum, and existing permanent signer certificate. Private signing material is not present here or in the release assets.

Publication verification retry: the first run found the source archive checksum path was relative to the archive directory, while the workflow runs from the repository root. The manifest now uses the repository-relative asset path; the APK bytes and signer are unchanged.
