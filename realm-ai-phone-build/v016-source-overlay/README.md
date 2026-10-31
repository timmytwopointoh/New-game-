# VEILFORGE Realm AI v0.19 source overlay

This source-only overlay reconstructs the v0.19 conversation and command-vocabulary test APK (versionCode 100016). It contains first-party Android and Bedrock agent source plus regression tests. It excludes Android SDK/NDK files, libnode binaries, node_modules, Microsoft session data, Realm plans, signing keys, and passwords.

Chat is kept separate from action requests. Greetings, jokes, teasing, ordinary questions, and local Minecraft material/recipe questions receive conversational or read-only replies; only text beginning with `command` can prepare a plan. A likely typo triggers a confirmation. Ambiguous Minecraft material names offer choices. Explicitly corrected words are stored privately per Realm and expand only to supported action/material names. Learned terms never bypass plan activation.

Unknown action words prompt for the intended supported action, and an owner correction can be remembered with `command teach action <word> = <action>`. Material aliases can be explicitly taught with `command teach material <word> = <Minecraft material>`. Use `command vocabulary` to inspect saved mappings. Unprefixed text remains chat or a read-only question.

The action batch remains sequential and server-confirmed. It waits two seconds after each confirmed command, and Stop cancels the remaining queue. This build does not add general Internet search or treat web pages as executable instructions.

The test APK is patched from public v0.18 APK bytes, aligned, and signed locally with the owner-supplied permanent key. The publication recipe contains public APK bytes only. This overlay contains no private signing material.
