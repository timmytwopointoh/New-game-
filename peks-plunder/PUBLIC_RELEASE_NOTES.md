# Peks Plunder v0.42 — Android compatibility test

Universal APK distribution for Android 6.0+.
- Same 19-character Peks Plunder v0.41 game content, same real crab launcher icon, full restaurant and arcade functionality.
- Important fix: TypeScript ES2017 transpilation removes optional chaining, nullish coalescing and Array.prototype.at from the game bundle. Old Android 10 emulator previously failed with SyntaxError at line 270 of v0.41 and a blank screen.
- Fixed HTML source SHA-256: c3b12530dabc0be87c4d5e74f8104e62dba72269037d4ca1a18834c158f5536a
- GitHub Actions validates browser/game source SHA256 against what is actually in the APK. Main menu and 19-roster WebView launch tested separately in emulator.
- Test-only debug-signed APK. This is NOT the permanent release key, so reinstall may be needed when upgrading from separately signed builds. Save backups first.
- No native libraries; same APK supports ARM and x86 devices, subject to Android/WebView support.
