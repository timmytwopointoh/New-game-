# VEILFORGE Realm AI v0.22 source overlay

This is the app source overlay for the `0.22-file-share-v0` test package (versionCode 100019). It contains the Android app source, the embedded Bedrock Node controller, the shared command plan and private vocabulary code, the tests, and the offline English glossary. `bedrock-agent/pack-template` and `bedrock-agent/tools` are included so the controller source imports resolve without relying on an installed APK.

The glossary contains 5,000 high-frequency content words with up to two ranked definitions from Open English WordNet. The selected words come from the top 7,568 entries of the wordfreq English frequency data after filtering function words and entries without lexical definitions. `src/lexicon/minecraft-context.json` adds concise, app-specific explanations for Minecraft and online-play terms. Data attribution is in `bedrock-agent/src/lexicon/ATTRIBUTION.txt`; the pinned-source generator is `../build_english_lexicon.py`.

Natural chat and questions stay separate from actions. Only a message starting with `command` can prepare a supported plan, and saved work still waits for the user to activate it. Common action synonyms only normalize to commands the app already supports. Unknown words or unclear social context prompt for clarification. This build does not perform Internet searches, multi-source fact checks, or general-purpose intent inference.

The sign-in code view and Copy button are mounted on the home screen while a Microsoft device-code challenge is pending. `https://www.microsoft.com/link` is visibly auto-linked and opens the official Microsoft device-link page when tapped. The code remains one-time and is never placed in a saved plan.

Settings includes “Share one file…” which launches Android's Storage Access Framework picker and then the system Share sheet. It grants read access only to the URI the user selected, requests no broad storage permission, and does not retain the URI or scan device files. The user chooses the receiving app explicitly.
