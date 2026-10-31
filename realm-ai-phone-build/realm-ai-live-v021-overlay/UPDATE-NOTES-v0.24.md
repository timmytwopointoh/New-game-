# Realm AI Live v0.24 — Nintendo Switch sign-in restored

Update the existing Live app normally. Package `com.veilforge.realmagent.live`, versionCode 200005 (`0.24-switch-sign-in`), same permanent certificate `77694D4F0068469CB6F7FD951F84946A4BBB833AE2702DC2F87B9E0C2ADABF22`. No uninstall, app-data reset or signing-key change.

Restores the owner-requested original Nintendo Switch authentication profile: authTitle `00000000441cc96b` (library `Titles.MinecraftNintendoSwitch`), device type `Nintendo`, DeviceOS 12 and the normal `live` flow. The Android-only Sisu recovery never runs for Switch. Microsoft/Xbox services are used by all Bedrock platforms; an Xbox-named authentication stage does not mean an Xbox console identity.

Switch authentication uses the stable private `auth/switch` subfolder to avoid sending cached Android title tokens as Nintendo. All existing Android login files remain intact. Microsoft may request one device-code sign-in for the new Switch cache; the code, Copy control and official clickable link remain available in Live. Future Switch updates reuse this cache without forced refreshes.

Movement remains touch-input walking rather than teleporting. Gravity, collision, mining/building, learning, glossary, saved plans, offline connection diagnostics and Live’s signed updater are retained. Settings and diagnostic copies explicitly identify the current configuration as Nintendo Switch while historical reports remain labeled as saved observations.

Validation: 211 Node tests and 35 Android tests passed. They check the library Switch title/device/OS, a persistent separate cache, preservation of existing login files, no Android recovery for Switch, Nintendo diagnostic identity, touch movement, code copying, offline diagnostics and other merged behavior. Every shipped runtime source file is checked against source; native libraries and Node dependency bytes are preserved. Signature/alignment/package/version verified. Phone sign-in and Realm acceptance still require a live test.
