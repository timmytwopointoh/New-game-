# Realm AI Live v0.30 — respawn and error-diagnostics repair candidate

This update keeps the v0.29 owner-only chat fixes, experimental autonomy, Switch authentication, saved data, and normal Live signing identity.

- Accepts numeric and named ReadyToSpawn states. Keeps a bounded respawn handshake; still requires server authority, does not fabricate health.
- Resolves blocked respawn state when the server subsequently reports positive health; does not require a previously observed client-ready packet to trust a later positive server health update.
- Requests terrain while respawning without sending gameplay movement, and resets terrain timeout only after actual recovery.
- Captures source-frame stack traces from command, movement-loop, and terrain-event errors in the sanitized on-device Bug report ZIP. The `null.index` exception cannot be pinpointed from the screenshot alone.
- No auto-resume of old actions after death. No new global Realm permissions, add-ons, teleports, public remote endpoints, or new signing key.

All behavioral claims are source-level until a physical phone confirms.
