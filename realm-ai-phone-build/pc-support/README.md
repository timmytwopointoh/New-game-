# Realm AI: parent-side PC workspace preparation

This helper fixes the **source staging** prerequisite identified by live PC result
VF-0016 on November 4, 2026. It is not an engine upgrade, APK build, listener
installer, verifier bypass, toolchain installer, or completed modded Realm fix.
The existing PC listener is responsive but its offline child receives only the
VQ engine checkout, with no Realm refs or remote. Repeating app-build jobs there
cannot work.

Run this through the **existing approved PC-side parent Codex/listener setup
mechanism**, outside its offline engine worker. Select a dedicated approved
empty directory outside all existing Git workspaces. Do not place this application
in Engine-build, the installed Studio, or another game directory.

Inspect only (creates nothing):

```text
python prepare_realm_workspace.py --workspace "<approved-empty-Realm-workspace>"
```

Explicitly stage original source with the parent's existing Git authentication:

```text
python prepare_realm_workspace.py --workspace "<approved-empty-Realm-workspace>" --stage-source
```

No execution policy changes, credential searches, global PATH changes, tool
installation, key downloads, world operations, or phone installation occur.
Existing unrelated content, a wrong remote, dirty checkout or wrong commit is
refused; the helper never resets or cleans an existing project. Authentication
must already work noninteractively; failed Git output is not copied into reports.

The sparse source checkouts are pinned to:

- `baseline-v0412`: `bd28ffed188ebf2115b64817a5e61f019b4787f0`
- `diagnostics-v0419`: `384199be7c6b9a1b00acbff857eb5718ef69a31f`

The actual earlier PC runtime must still be located and identified; staging these
refs does not prove they are the same PC installation that previously joined.
It also does not supply npm modules, the verified native Node runtime, Gradle/SDK,
permanent signing access, ADB pairing, or an approved Realm-specific worker.

## Parent's remaining one-time work

1. Read the local AGENTS/approval configuration. Inspect installed tools through
   existing approved project/tool roots, including off-PATH tools. Do not infer
   that a missing PATH entry means a missing installation.
2. Stage the pinned app's dependencies and original verified native runtime via
   the approved parent mechanism. Use a genuine source Gradle build, not APK ZIP
   repacking. Do not copy the app into the reusable VQ engine.
3. Prepare a separate Realm-only worker/verifier profile. Resolve the stale
   `results/VF-0011.json` verification baseline mismatch without deleting another
   task's results, hiding it with an ignore rule, or disabling checks. Apply any
   local approval requirement through its normal mechanism.
4. Reuse the existing permanent key only through the original local signing
   interface. Public fingerprint:
   `77694D4F0068469CB6F7FD951F84946A4BBB833AE2702DC2F87B9E0C2ADABF22`.
   Report missing access; never generate a new key or publish private material.
5. Return a sanitized readiness result through the bridge before another build
   task. Only after setup is verified run the known unmodded baseline, one modded
   diagnostic trial, and one minimal source change at a time. Preserve Switch
   identity and login. Do not auto-select an unknown Realm or edit world blocks.

For an already owner-authorized ADB device with v0.40.19 installed, the existing
read-only provider supports:

```text
adb shell content query --uri content://com.veilforge.realmagent.live.testlab/connection
adb shell content query --uri content://com.veilforge.realmagent.live.testlab/handshake
adb shell content query --uri content://com.veilforge.realmagent.live.testlab/startup
```

Do not grant debugging/pairing, root, `run-as`, private-file export or app data
clearing to obtain those observations. This helper does not access the phone.

## Validation

Six Python safety tests passed in the current cloud environment. An actual
source-staging smoke run fetched both exact commits and verified the canonical
`package-lock.json` paths in fresh sparse checkouts. This is **not a Windows PC
execution, Android build, signature verification, phone test, or live Realm join**.
No hosted Actions are needed or authorized for this preparation.
