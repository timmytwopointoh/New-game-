# VEILFORGE Realm AI — Natural language, real in-game chat and ordered command queue

Development branch: `sandbox/realm-ai-v0145-chat-ordered-queue-20261031`

## Delivered in the v0.14.5 candidate
- Owner may type `!ai come here`, `!ai follow me`, `!ai walk to 3 64 -4`, `!ai break the block at 2 64 1`, `!ai are you okay`, `!ai run queue`, `!ai stop`, or address `@veilforge` / the actual bot gamertag. The client responds in normal Realm chat.
- The offline interpreter converts **supported** natural phrases to typed existing game commands. It never silently treats unfamiliar instructions as successful Minecraft actions.
- Commands saved on phone are a **single ordered list** (up to 5 retained cards), not selected independent plans. One Run Queue action runs cards first to last. No automatic restart after relaunch or Realm switch.
- First card can start immediately; the next starts 2 seconds **after the previous card finishes**, rather than interrupting active movement/mining. A persistent Follow job intentionally holds the queue until stopped; STOP NOW cancels immediately.
- Queue steps can be reordered, deleted, or inspected before running. Read-only supply/build recipes remain labelled preview-only, not executed.
- All separate diagnostic menu choices have been consolidated into one **Diagnostics — all status checks** item at the very bottom of the Commands picker; old diagnostic chat commands remain aliases.
- Top-left **Stop Bot** button asks for confirmation before terminating the service. Separate **STOP NOW** remains immediate for safety.
- Owner-only commands, cooldown, self-echo rejection, local API bearer token, maximum command lengths and Survival action checks stay enforced.
- No keys/passwords, Microsoft tokens or unsigned APKs committed to repository.

## Phase 2 — Improve real language comprehension (next development pass)
1. **Intent extraction**: expand verbs, casual phrasing, synonyms, unit/coordinate parsing, and multi-instruction phrases into a typed list of existing supported actions. Use strict confidence, ambiguity and length limits; ask one short clarifying question when needed.
2. **Ground references**: resolve `that block`, `this tree`, `over here`, `the shovel` only against server-observed player names, block positions, reach, inventory, equipment and survival status. Never invent position, pickup, game mode or success.
3. **Action/response feedback**: distinguish `I heard you`, `queued`, `executing`, `server-confirmed`, `interrupted` and `not supported`; send short in-game chat updates with rate limits instead of repeating long technical status.
4. **Multi-step tasks**: keep a bounded per-Realms queue; material/tool requirements, prerequisites and stop conditions. All high-impact actions and building placement wait for the tested Codex v0.15 Minecraft interaction implementation; do not claim those exist in v0.14.5.
5. **Optional local language model**: test only an offline lightweight intent interpreter on supported Android hardware. A model proposes a structured intent; the deterministic validator and permission guard decide whether it can be executed. Never execute unvalidated model-generated commands.
6. **Experience**: one chat textbox, ordered queue with progress, reusable commands, detailed single Diagnostics view, explicit Stop Bot confirmation and emergency Stop. No accidental immediate actions from typing in the phone.
7. **Feedback/QA**: measure intent precision, false execution rate, server-confirmed motion/mining, chat spam, packet errors, stop latency, Android battery and memory, and installation/update compatibility.

## Acceptance tests / release gate
- An in-game message from the configured owner executes one allowed action and sends a concise chat reply. A guest, an impersonating near-name, normal unaddressed chatter, or the bot's own echo never executes commands.
- Five cards run in insertion order with >=2000ms gap between completions and subsequent activations. Long-running navigation waits for finish. Stop and disconnect cancel timers and leave saved cards idle on next launch.
- Invalid or unsupported commands are rejected; mining respects Survival, confirmed held items, reach, and server confirmation.
- Android small-phone and keyboard-height tests confirm **Stop Bot** is accessible top-left, asks for confirmation, and **STOP NOW** remains accessible and immediate.
- All Node/Android regression tests pass; new APK is only published with correct original package ID, increasing versionCode, and the user's current permanent signing certificate (do not invent a signing key).
- Live Realm acceptance remains separate from successful unit tests; record what the bot actually does in Minecraft before claiming full capabilities.

## Limitations
This phase adds a **local phrase interpreter** rather than a general-purpose assistant. Unsupported movement shortcuts, arbitrary building, crafting and dialogue cannot be considered implemented. Permanent signing and release delivery require verification against the active installed APK certificate. This branch does not overwrite Codex's incomplete v0.15 work.
