# Rift World Genesis — acceptance gate

- [ ] Pinned source copied into an isolated, never-overwrite Windows workspace by approved parent PC runner.
- [ ] Node gameplay/render-loop simulation passes (`scripts/test-game.cjs`).
- [ ] Gradle compiles Android project with installed SDK API 35 and existing JDK 17/21.
- [ ] APK package `com.veilforge.riftworld`, versionCode 1, versionName `0.1.0-genesis-alpha` verified by `aapt`.
- [ ] `apksigner verify` and `zipalign` checks pass. Preserve one project-local signing identity so users can update rather than uninstall.
- [ ] APK contains `index.html`, `game.css`, `game.js`, actual code/renderer assets.
- [ ] Dedicated emulator AVD or available isolated test emulator installed/launched without interrupting others; screenshots verify title screen *and* live combat.
- [ ] Input test: Move, Strike, Dash, Pulse, Shift, enter rift, enemy attacks, wave/boss victory.
- [ ] Save test: pause/save, process kill/relaunch, progress retained.
- [ ] Record SHA256, exact APK size, package/signing fingerprint, real private release link.
- [ ] No proof of production art quality, phone stability or successful gameplay without device/visual QA.
