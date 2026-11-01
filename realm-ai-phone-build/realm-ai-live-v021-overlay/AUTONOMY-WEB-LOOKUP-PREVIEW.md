# Realm AI Live — EXPERIMENTAL SOURCE UPDATE (derived from owner v0.26 ZIP)

This source package is **not an APK**, **not a published update**, and **not phone/Realm verified**. Its original app identity, existing versionCode (200007), and signing/release scaffolding have not been replaced. Build and release only after Android/Realm testing, with a higher versionCode and the existing authorized Live signing certificate. No private credentials or keystore are included.

## Changes in the experimental development tree
- Plain recognized imperative requests can invoke supported existing survival commands directly, without a second Activate tap. Saved-card queues retain their previous selection/Activate behavior. Server-authoritative checks remain in the survival controller; a successful parse is not a successful block placement.
- Bounded relative movement intent: `move forward 3 blocks` and similar directions produce a world-coordinate **walk** request from observed position/facing. Not a teleport.
- Look around initiates a timed 360-degree turning survey of known, line-of-sight blocks; unknown or hidden terrain is not reported as visible. The physical phone must verify turning and results.
- Hostile entity proximity filtering and conservative escape-route selection. Escape uses physical navigation and requires received terrain; it does **not** attack, fight or make the bot invulnerable. Live survivability is unverified.
- **Free, keyless internet word lookup** via read-only HTTPS to `api.dictionaryapi.dev`. `look up WORD`, `research WORD`, `define WORD`, and `learn word WORD` are supported lookup requests. Retrieved text is not executable code or commands. A new alias is learned only when dictionary definitions and supported synonyms identify one unambiguous, already implemented action. It does not create missing crafting, item collection or combat skills. Unknown direct action words followed by explicit XYZ coordinates can request a lookup.
- Android Settings -> **Internet word lookup** opens a separate minimal Google-search WebView for human inspection; HTTPS reference sites only, with no JavaScript bridge to game commands or access to personal Chrome sessions. The bot uses the fixed dictionary endpoint independently rather than scraping Google results or invoking Google AI.
- Stop invalidates outstanding dictionary lookup results and cancels active jobs; private Realm-scoped word memory is retained.

## Verification in this environment
- `node --check` succeeded for changed JavaScript modules and related survival modules.
- 5 **new focused** Node tests passed (`web-dictionary.test.js`, `threat-defense-live-preview.test.js`). They use mocked network and simulated world data, not an actual Realm.
- The full 235-test Node baseline could **not** be rerun here because bundled runtime dependencies were intentionally absent from the source ZIP and dependency installation was not completed.
- Android Java unit tests and APK installation were **not** executed here; this environment does not have the required Android SDK/Gradle build toolchain or current permanent Live signing keystore.
- Existing v0.26 owner-reported **block placement is unfinished**, and mining collection, jump confirmation, respawn and defense remain subject to physical-phone/live Realm testing.

## Safety and compatibility
Do not embed Google/Microsoft/Android tokens in source, the APK or diagnostic exports. Do not load external pages into a WebView with `addJavascriptInterface`. The browser is an optional reference viewer; HTTPS dictionary answers are parsed only as definitions. No source files modify the account profile (`Nintendo Switch`), login caches, package identity, release signatures or saved plan format. Preserve the current Live signing baseline to make a normal update; this preview is not signed.
