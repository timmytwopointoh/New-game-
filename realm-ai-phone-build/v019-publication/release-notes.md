## VEILFORGE Realm AI v0.19 — Conversation and Language TEST

This test build separates ordinary chat from action requests. Greetings, jokes, teasing, Realm status, and local Minecraft material/recipe questions receive replies without starting plans. Only messages prefixed with `command` can prepare an action.

When an action word looks like a typo, the bot asks “Did you mean?” before saving anything. An unknown action asks which supported action was intended; a confirmed correction can be remembered privately for that Realm. Ambiguous material spellings offer choices instead of guessing. Remembered words still map only to supported actions or catalog materials, and commands remain waiting for the green Activate control.

The action queue remains server-confirmed and serial, with a two-second delay between completed commands and immediate Stop. General Internet lookup is not included in this build.

The APK is versionCode 100016 and is signed with the existing permanent update key. Its SHA-256 is in `VEILFORGE-Realm-AI-v0.19-SHA256.txt`; the source overlay and public-only reconstruction recipe are attached. Automated agent regression tests passed: 186. No live Realm movement test was performed.
