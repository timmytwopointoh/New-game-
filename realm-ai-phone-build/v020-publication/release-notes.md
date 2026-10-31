# VEILFORGE Realm AI v0.20 — Language and sign-in TEST

This test release adds a fully offline glossary of 5,000 frequent English content words, with ranked dictionary senses, plus Realm/Minecraft context entries for words such as **troll**, **griefing**, **redstone**, and **strip mining**. Ordinary questions use dictionary/context replies; unrecognized terms prompt for context. Supported action synonyms such as *excavate*, *travel to*, and *search for* are understood only after the `command` prefix. A word definition can never queue or activate work by itself, and ambiguous intent still asks the user.

The Microsoft device sign-in code and Copy control are now attached to the home screen and remain visible while sign-in is pending. The Settings sign-in control still fetches fresh server status and opens Microsoft's official device-link page.

This is an offline dictionary, not an Internet search or a multi-source misinformation check. It does not verify current claims or reliably detect whether a person is joking, trolling, or serious; uncertain social context is treated conversationally and can be clarified.

The APK is versionCode 100017 (`0.20-language-chat`) and uses the existing permanent update certificate. The included source overlay records data attribution and a repeatable lexicon-generation script. Node regressions: 189 passed. APK package, alignment, ZIP integrity, and signing certificate were verified. The Android Gradle/Robolectric suite and a live Realm test were not run in this environment.
