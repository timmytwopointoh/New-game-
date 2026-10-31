# Realm AI Live v0.23 — offline diagnostics and title-token recovery

Install over Live v0.21 or v0.22 from this branch. Same package `com.veilforge.realmagent.live`, same permanent certificate `77694D4F0068469CB6F7FD951F84946A4BBB833AE2702DC2F87B9E0C2ADABF22`, versionCode 200004. Do not uninstall or clear storage to update this baseline.

## Diagnostics work even when the bot fails

Settings → Connection diagnostics now opens immediately with no running bot, local API connection or Microsoft token required. It always allows copying an app-state report. Once a connection has been attempted, the sanitized last connection/failure is retained in private storage and can be read after service failure or an app restart. The report labels live versus saved observations and records the app version and local API reachability. Raw errors, Microsoft codes, tokens, account names and URLs are excluded from the copy/export path.

A separate Android UI bug never marked successful local API replies as connected, which disabled diagnostic/sign-in controls despite a visible Realm error. Successful responses now update the local-controller flag and last-response time independently of Realm login/spawn. A transient failed poll does not incorrectly treat a recently responsive controller as dead.

## Xbox title-token 403

The phone screenshot identifies `xbox-title-token`: Xbox rejects this before the bot connects to a Realm. For this precise 403 only, the existing auth library now gets ONE supported Sisu recovery attempt using the same Android title/device identity and an already-valid cached Microsoft token. A fresh device proof is bound to this session’s key. It does not clear the login cache, change platform, start a new device-code login, or add a general retry loop. Other failures and expired cached Microsoft tokens do not trigger this recovery. A denied recovery remains an error with its own recorded stage.

All merged vocabulary, learning, Minecraft controls, signed updater and Microsoft code/copy/link controls remain. This is still an offline glossary/rules assistant rather than a neural language model.

Validation: 210 Node tests and 34 Android tests passed, including offline copying, process-file fallback, activity restart persistence, successful error-response connection tracking, redaction, exact-403 recovery, healthy login/no-fallback, expired cache/no-fallback and denial/no-loop. All 32 shipped runtime source files were checked against the source tree; native libraries and Node dependency bytes are preserved. APK signature, alignment, package and version verified. Xbox/Realm acceptance of the recovery still requires a phone test.
