# Peks Plunder v0.43 — Verified old Android WebView compatibility fixes

The same 19-character game, original crab launcher icon, restaurant improvements and offline minigames as v0.41, without an alternate web-game source.
- JS target: ES2017. Fixes Android 10 WebView SyntaxError from v0.41.
- Additional compatibility fix: replace unsupported Element.replaceChildren with textContent='', and polyfill Object.fromEntries/Object.entries/Array.includes/String.padStart for older WebViews.
- Source SHA-256: eec375c59b6e063f15829a247c78b98c82dab818845348ad004afef78eeedb08
- Browser regression: 19 roster items, 15 normal character shift startups, viewport sizes 960x540 and 852x393, with legacy APIs disabled.
- No native libraries, target Android 6.0+.
- Debug-signed public test APK: stable production signing is not yet configured. Back up saves before uninstalling older differently signed builds. Certificate migration needs a one-time reinstall.
