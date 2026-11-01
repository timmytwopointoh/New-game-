# Realm AI Live v0.27 candidate: Google AI research handoff + supported-action queue

**SOURCE ONLY. NOT AN APK, NOT SIGNED, NOT RELEASED, AND NOT PHONE TESTED.**

This update uses the user's Realm AI Live v0.26 source and the experimental autonomy/dictionary/defense additions. The unchanged Android app ID is `com.veilforge.realmagent.live`. Candidate `versionCode` is `200008`, above published v0.26 (`200007`). The installed v0.26 Live signing certificate must be reused; no private signing files are included.

## How the research bridge works

1. On the phone, open **Settings -> Google AI research / Internet lookup**.
2. Type an owner task (e.g., `Look around for oak logs`). Tap **Google AI Mode**. The app copies a bounded Minecraft-specific research question to the clipboard, and opens Google's interactive AI Mode in your browser. Paste the question and ask Google AI. This is owner-operated browsing: no Chrome automation/scraping or secret cookie access.
3. Copy the AI response in the browser and return to the app. Tap **Use copied answer**.
4. The app previews only `COMMAND:` lines exactly matching a small set of supported in-game actions. It rejects web instructions, permissions, shell commands, made-up coordinates, unavailable commands, and unrequested world edits.
5. Tap **Run supported steps** to start that *specific* validated queue, without the old green Activate button. The normal server-verification checks and two-second spacing still apply. STOP interrupts unfinished steps. Older waiting saved cards are never accidentally launched with this batch.

The previous **Internet word lookup** function still provides free dictionary definitions without a Google AI key.

## Capability and testing limits

- Google Search AI Mode is an interactive website, not an app-readable API. **This is not full unattended online AI research.** Automated Google grounding is only possible with a separately configured supported API/backend and credentials. No private Google key is included.
- Google explanations have no special authority over world edits. The user still reviews steps once before using this research handoff. Already recognized owner tasks can run directly without the Activate button in the autonomous-intent path.
- A plan cannot perform absent gameplay capabilities such as general combat, crafting, item pickup, or unverified block placement. Live mining and building remain unfinished until tested with server feedback.
- 9 focused Node tests pass for research parsing, HTTPS dictionary and threat detection. The full legacy Node suite was attempted but 12 test files could not load due missing `prismarine-registry`, `minecraft-data`, `prismarine-nbt` and other dependencies not bundled in the source ZIP. No Android Java tests, emulator installation, live Realm test or signing were performed in this environment.
- This execution environment does not have the Android SDK, Gradle, D8, the verified compiled v0.26 APK, or download access to acquire those artifacts. It is **not possible to provide a functional new APK from this source here**. It must be compiled with JDK 17 + Android SDK 35/build-tools 35.0.0, and with the pinned ARM64 runtime/native compatibility patches; then signed with the existing Live keystore and the user-installed certificate fingerprint, verified against `77694D4F0068469CB6F7FD951F84946A4BBB833AE2702DC2F87B9E0C2ADABF22`.
- Keep all signing material, passwords and Xbox account data PRIVATE. Do not commit to GitHub or include in a source ZIP. Do not uninstall the working v0.26 app to try a candidate source ZIP.
