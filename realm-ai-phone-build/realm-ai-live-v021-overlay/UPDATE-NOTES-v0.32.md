# Realm AI Live v0.32 — internal offline Minecraft resource skills (test build)

- No extra user-facing Minecraft knowledge button. Existing Minecraft data and glossary are used by the bot. Google AI API key is not required for on-device materials, mining rules and resource goals.
- An owner instruction such as `!ai find and mine oak log`, `!ai go get wood` or `!ai chop down trees` can initiate a bounded observed-world resource pass without Activate. Searches examine visible blocks, never unknown/occluded terrain.
- Explicit mining is allowed with bare hands or unsuitable tools for finite-hardness blocks when safety checks pass. A bad tool can break a block but fail to harvest its drop. Unlike passive clearing (5-second budget), explicitly authorized mining gets a bounded 120-second per-block work budget. This is a request, not a proven break.
- Breaks are counted only after server block updates; pickup successes are counted separately after server inventory evidence. Stop, death, low health, hostile threats, permission changes and unknown terrain remain safety gates. No teleport or automatic mining through player builds.
- The internal tree plan knows first-tree log collection, crafting table, wooden axe, and second-tree chest/storage workflow. Crafting, chest placement, chest inventory transactions, automatic item discarding, and general forest exploration are NOT complete. The bot must report these missing executors and keep existing inventory instead of pretending storage succeeded.
- Source uses Android package com.veilforge.realmagent.live, Nintendo Switch sign-in profile and same permanent Live signing identity. VersionCode 200013.
- Real phone and Realm acceptance of new behavior is pending.
