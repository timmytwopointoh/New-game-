# Realm AI Live v0.38 — Follow clearance fix

Package com.veilforge.realmagent.live, code200019, 0.38-follow-clearance. Same permanent Live signing key and Nintendo Switch login. Install over the existing Live app to retain saved data.

The owner reported Follow repeatedly saying “Player clearance is blocked or unknown” while standing near cobblestone walls, uneven ground and magma. Two reproducible code defects were found; the photo alone is not proof that every route in that location is safe.

- Follow now aligns its lateral position before leaving a cell. An off-center starting pose no longer cuts diagonally into the corner of a neighboring cobblestone wall on an otherwise clear cardinal route.
- Walking assesses the actual player body and received support footprint. It no longer demands that every touched cell also fit an imaginary player standing at that cell's center. Missing terrain, solid collision, hazardous floor contact and unsupported movement remain failures.
- One-block jumps are checked against actual support heights and the minimum required collision clearance. A three-block-high passage can allow a one-block jump. A known ceiling can clip the upward motion while the bot continues toward a valid landing; unknown ceiling data never receives that treatment.
- Clearance reports identify a solid/hazard name and block coordinates, or explicitly identify missing support/collision data. Follow recovery also exposes the front block and mining refusal reason.
- Magma avoidance, likely-build/container protection, ordinary input movement, no flight/teleport, Stop/gravity, saved login, v0.37 workflows and existing menu behavior are preserved.

## Verify on the phone
Install over Live, tap Stop, and start Follow once in the same area. An active continuous Follow occupies its queue; pressing Activate again does not restart it. If still blocked, share the new message with its block name/coordinates and, if possible, a Bug reports ZIP. A real wall, magma, missing terrain or protected construction can still legitimately prevent movement.

360 Node tests and 47 Android tests passed. Regressions cover an off-center cobblestone corner, a valid one-block jump below a three-block ceiling, and distinct unknown-support/magma/solid failures. Truly insufficient headroom still rejects jumps. Existing physics, mode, respawn, mining, crafting/storage and portal tests pass. APK/source parity, unchanged native dependencies, package/version, permanent certificate and alignment verified. No live Realm acceptance or phone installation was performed here.

Read UPDATE-NOTES-v0.37.md and BUILD-STATUS-v0.37.txt for the larger experimental workflow snapshot and unfinished features. In particular, arbitrary loot/trade/enchanting, autonomous dragon combat, End-city retrieval and full-tree forestry remain incomplete. This release fixes Follow clearance; it does not make every material quest executable.

Canonical source remains realm-ai-phone-build/realm-ai-live-v021-overlay on sandbox/realm-ai-live-v034-menu-review-20261101. Source ZIP includes code/tests, a per-file manifest, previous/current notes and public reconstruction helpers. It excludes credentials, private signing files, dependencies and native binaries. The public recipe reconstructs this exact signed APK from public v0.37 bytes; modified builds still require the existing permanent Live key. Never generate a replacement key.
