# Realm AI Live v0.29 — chat reception diagnostics candidate

- Resolves casing differences between the configured owner gamertag and the server-reported Xbox display name. Uses trim plus case-insensitive exact matching. It does not accept near-name lookalikes or other players.
- Adds in-app **Settings → Realm chat diagnostics**. Use `!ai ping` in Minecraft then open diagnostics. Counts distinguish no text packets, received but unauthorized commands, accepted commands and replies queued/failed.
- Counters exclude raw chat contents, passwords and account names. They reset when the bot service restarts. A queued reply is **not** proof the server delivered it.
- Retains the Live package, Switch authentication, private sessions and signing certificate; update versionCode 200010.
- Does not claim to repair all Realm-level chat delivery restrictions without a physical phone report.
