VEILFORGE Realm AI v0.16 — Creative movement and compact controls test

This test build keeps the main screen to the bot power control, Commands, Activate, STOP, chat/progress, and the prompt. Connection, account, mode, sign-in, plan management, and bot-service controls are in Settings. Plans remain preparation-only until one selected plan is activated; Stop remains immediate and preserves gravity.

Settings includes explicit Survival and Creative choices. The bot requests only `/gamemode survival @s` or `/gamemode creative @s`, only when its own server-reported command permission permits it. It waits for the server to confirm its own mode and abilities. No Realm-wide mode or permission is changed. Creative supports verified grounded walking with normal movement input only; it does not enable flight, noclip, teleport, mining, or building. Survival mining and placement retain their Survival and server-feedback checks.

The build includes the mining hold-until-server-block-update behavior, tool-aware mining-time estimates, collision shapes for snow and partial blocks, and gravity independent of active jobs. The app preserves the saved Microsoft session; saved work does not auto-resume.

Verification: 174 Node tests and 4 Android phone-size/popup tests passed locally. The APK was built locally, aligned for 16 KB pages and signed with the owner's supplied 2026 permanent key (certificate SHA-256 8E902E783E7B4BD45FFE2F99B45C53B0E15D4B8E36092532CC6E969A956815C5). No private signing material is included.

Live Realm behavior remains unverified until the owner installs and tests this APK. In particular, a Creative mode request succeeds only if the Realm server reports sufficient command permission; otherwise the app leaves autonomous work paused and reports the denial.
