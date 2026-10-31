# Realm AI Live v0.22 — merged language, learning and login diagnostics

Install over the new Live v0.21 baseline. Same package and same permanent signing key; no uninstall or data reset is needed for that update.

All implemented features from the separate app are now included in Live: the existing Minecraft controls, queued plans and previews plus the missing 5,000-word glossary, word definitions, Minecraft context and supported action synonyms. Live’s signed updater and sign-in/file-sharing controls remain intact.

New learning remembers owner-confirmed vocabulary and actual task outcomes privately for each Realm. It distinguishes server confirmation from prediction or interruption. Review it in Settings → Learning, or ask “what have you learned?” Teach with “command teach action dredge = dig”; review with “command vocabulary”; remove with “command forget action dredge”. All tasks still wait for Activate.

A reproduced bug in the shipped auth library treated OAuth token lifetimes in seconds as milliseconds. The correction retains cached login rather than unnecessarily refreshing a valid token. If a 403 remains, open Settings → Connection diagnostics → Copy diagnostics and send that report. It excludes authentication codes, tokens and account identifiers. It reports the precise observed Microsoft/Xbox/Realm failure stage without claiming that the cause is known.

This app uses an offline glossary and rules, not a neural language model. Internet lookup, multi-source fact checking, model training and autonomous code changes are not implemented.

Validation: 205 Node tests and 28 Android tests passed; exact source-to-APK check includes all 31 runtime source files. Native libraries and installed Node dependencies are unchanged from Live v0.21 and match the separate app. Signature, alignment, package com.veilforge.realmagent.live, versionCode 200003, and signed update metadata verified. Phone Realm connectivity is still unverified.
