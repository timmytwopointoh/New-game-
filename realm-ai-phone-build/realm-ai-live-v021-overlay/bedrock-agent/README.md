# VEILFORGE Realm AI — v0.8 separate-player companion

Run this Node.js service on a PC you control (or another always-on machine). **The phone APK is only a chat controller**, not a second Bedrock client inside your phone. The separate bot account must be invited into your paid Realm and sign in through Microsoft/Xbox authentication. Do not share the Realm invitation, Microsoft account password, device code, local pairing token, or authentication cache in ChatGPT/GitHub.

## Installation and first join
1. Install Node.js 22+ on Windows, extract this source archive, and run `Install-Dependencies.bat`. This installs Bedrock protocol dependencies and creates a local `config.json` containing a new random pairing secret.
2. Edit `config.json`: set Minecraft `realmInvite` **or** `realmId`, exact bot Xbox gamertag (`botPlayerName`), and your own approved gamertag (`ownerPlayerNames`). Keep `offline: false` and `allowWorldEdits: false`. Invite the bot's separate Microsoft/Xbox account to the Realm. Do not try using your already-playing phone account as the bot.
3. Run `npm run doctor` to check prerequisites without a live connection. Run `Start-Bedrock-Agent.bat` to connect. If Xbox login requests a device code, use **the code shown in the local terminal** with the bot's account. Do not post the code.
4. Wait for `Spawn event received` on the console, and verify that the new gamertag is visibly a separate player inside Minecraft. First test harmless chat with `!ai hello` or `!ai are you connected` from **your** gamertag. Other players cannot send the bot commands.
5. For the optional Android app, connect to the PC API with a **private HTTPS URL** (for example, a Tailscale Serve address), not public port forwarding. The API listens only on `127.0.0.1:8765` and requires the secret token. Do not use Tailscale Funnel.
6. Back up the Realm and test in a disposable world before enabling the optional Script API behavior pack. With world edits OFF, the bot can connect and chat but it **cannot mine/build/follow automatically** merely because the planner understands the command. Use `Generate-Server-Pack.bat` after installing dependencies, install the resulting world behavior pack from the owner account using a supported Bedrock/Realms pack workflow, and verify real game events before enabling edits.

## Commands
From the APK, type normally: `follow me`, `come here`, `inventory`, `where are you`, `find iron ore`, `survey nearby`, `mark this spot`, `build a wall 3 by 2 of cobblestone`.
For multi-step tasks: `plan find iron ore then gather 2 iron ore` → read preview → `start plan` → `plan status` or `cancel plan`.
In Minecraft, use the separate prefix `!ai` or `@veilforge`: e.g. `!ai hello`, `!ai plan gather 2 oak logs`, `!ai start plan`. This prefix is **not** `!vf` because `!vf` is reserved for the optional world behavior pack.

## What is real, and what is not
- Realms connection is implemented using `bedrock-protocol`, **but cannot be verified until the bot account logs in to an actual Realm**.
- In-game messages are routed from the owner to the same planner as phone messages, with 900ms cooldown. Chat replies are reports of commands being sent, **not proof that the action finished**.
- Follow/come/go commands rely on a server-side behavior pack for bounded short teleports, *not true movement/pathfinding*. Mine is a limited scripted block edit and optional nearby item drop, *not authentic survival digging* or guaranteed inventory collection.
- Crafting, farming, combat, large shelters/castles, distant exploration, offline self-learning, and general language-model planning are **not implemented**.
- Phone build and Android install are still unverified. GitHub hosted build run 41038239346 failed before the job exposed steps/logs; do not confuse the ZIP with an installable APK.
- Never test destructive world changes on an unbacked-up Realm.

## Source tests
`npm run check && npm test` checks syntax and 86 source-level tests (v0.8). The Android-independent Java helper can be checked with the `javac` command described in the top-level README. Local tests do not prove Bedrock compatibility for your exact Realm version.
