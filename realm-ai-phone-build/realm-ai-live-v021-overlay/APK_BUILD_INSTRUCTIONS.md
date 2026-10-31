# Build a real phone-only Bedrock Realm AI APK using GitHub Actions

The project includes the source and a **manual-only** workflow at
`.github/workflows/realm-ai-standalone-apk.yml`. No workflow is scheduled and
no live game or repository is modified by executing the source tests.

## Requirements

- A GitHub repository whose Actions billing/runner eligibility is functional. The
  previous Trion-Assistant-Lab Actions run failed before any job step logs; account
  runner/billing policy needs attention if that repeats.
- Upload the *contents* of this directory to an isolated private repository or
  dedicated build branch; keep the relative paths `android-app/`, `bedrock-agent/`,
  `tools/`, `.github/workflows/` at the repository root. Do not place this
  game-specific project inside Engine-build/VQ.
- Open GitHub → Actions → "VEILFORGE Realm AI v0.9 - on-phone APK" → Run workflow.
  The job downloads Android SDK/NDK and Node runtime, compiles a debug APK, and
  verifies that the runtime and Bedrock dependencies are actually inside it.
  If the run succeeds, get the APK from its artifact ZIP (expires after 2 days).
- On Android, install the debug APK, launch, enter the bot and owner gamertags,
  complete Microsoft device-code sign-in with the *bot's* already-invited account.
  Do not enter your password in VEILFORGE. Test on a safe Realm before editing worlds.

## Expected artifact

`VEILFORGE-Realm-AI-v0.9-Standalone-Android-debug-APK` → `app-debug.apk`.
This workflow has NOT been executed successfully; no APK is supplied by this
source ZIP. If it fails, use exact Gradle logs for fixes rather than renaming
source ZIPs or placeholders to APK.

The embedded bot's script-level unit tests pass but do not prove that an
Android build, Xbox login, Realm connection, background service or world
editing will work on your device. Android 16 and Bedrock protocol updates may
require additional changes. World edits remain disabled unless the Realm
owner intentionally installs and enables the optional behavior pack.

A newer Node-for-Mobile release advertises 16 KB compatibility; this workflow
pins `fogtape/nodejs-mobile` v24.22.1-0 and validates the upstream SHA256SUMS.
Third-party library licensing should be reviewed before public distribution.

## Simplest upload-only GitHub route (recommended)

An isolated workflow is installed in `Trion-Assistant-Lab`'s branch
`sandbox/realm-ai-apk-v06-20261030`. In GitHub's browser, switch to that branch,
open or create the `realm-ai-phone-build/` directory and **upload the single ZIP**
`VEILFORGE_Realm_AI_v0.9_GITHUB_APK_BUILD_KIT.zip` at that exact path. Pushing
that ZIP will trigger one scoped `realm-ai-phone-v09-apk` run (if GitHub Actions
billing/runners permit). It will check SHA-256 before extracting. Find the run
under Actions and download the verified debug APK artifact if successful.
Do not upload Minecraft account secrets or bot auth cache.
