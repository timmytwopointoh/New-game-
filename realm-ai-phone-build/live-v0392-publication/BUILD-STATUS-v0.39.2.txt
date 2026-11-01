Realm AI Live v0.39.2 — focused startup fix

Package com.veilforge.realmagent.live; versionCode 200021. Same permanent 77694D4F signing certificate and Switch authentication. Install over the original Realm AI Live app; the standalone STARTUP TEST app has separate data and is not this update target. Do not uninstall the original Live app.

Reproduced the reported startup failure using the exact released STARTUP TEST APK. Android AAPT expands english-5000.json.gz into english-5000.json, but lookup.js unconditionally opened the missing .gz file while importing connection.js, before the API or Microsoft login could start. The loader now accepts both layouts, preserving all 5,000 words and failing normally if neither valid dictionary exists. No authentication/cache resets or replacement keys.

Preserves the newer source from commit 3f09fe3542e9acbe9306377db43e09e721bdfa57: Try Again, tool/mining knowledge, shallow-water navigation, jump recovery, Microsoft foreground code controls and startup-stage reporting. No further gameplay changes in this fix.

Verification: original APK dependency import reproduced ENOENT; with only the loader fix, identical extracted app/dependencies imported successfully in 201 ms. 367 Node tests, 4 isolated jump tests and 53 Android tests passed, including both dictionary layouts. Signed APK source/native/dependency verification passed. Android hardware startup and live Realm acceptance still require owner testing.

Phone test: install this over Realm AI Live, stop/start the bot, and complete Microsoft login only if requested. If startup still fails, export a fresh bug report from this Live version (not STARTUP TEST).
