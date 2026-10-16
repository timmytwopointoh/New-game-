#!/usr/bin/env bash
# Run the complete smoke test in ONE shell. The emulator runner executes plain
# multi-line script inputs as independent shell commands, losing shell variables.
set -euo pipefail
PACKAGE="com.echoform.game"
capture_diagnostics() {
  adb logcat -d -v threadtime > echoform-logcat.txt 2>&1 || true
  adb shell dumpsys activity activities > echoform-activity.txt 2>&1 || true
}
trap capture_diagnostics EXIT

adb install -r apk/echoform-debug.apk
adb logcat -c || true
adb shell settings put secure immersive_mode_confirmations confirmed || true
adb shell monkey -p "$PACKAGE" -c android.intent.category.LAUNCHER 1
sleep 12
start_pid="$(adb shell pidof "$PACKAGE" | tr -d '\r' || true)"
if [[ -z "$start_pid" ]]; then
  echo "ECHOFORM did not remain running after launch."
  exit 1
fi
adb shell screencap -p /sdcard/echoform-start.png
adb pull /sdcard/echoform-start.png echoform-start.png
adb shell input swipe 220 500 420 600 550
sleep 4
end_pid="$(adb shell pidof "$PACKAGE" | tr -d '\r' || true)"
adb shell screencap -p /sdcard/echoform-move.png
adb pull /sdcard/echoform-move.png echoform-move.png
capture_diagnostics
if [[ -z "$end_pid" || "$start_pid" != "$end_pid" ]]; then
  echo "ECHOFORM process exited or restarted after touch input."
  exit 1
fi
if grep -E 'Fatal signal.*(echoform.game|m.echoform.game)|ANR in com.echoform.game|Process: com.echoform.game' echoform-logcat.txt; then
  echo "ECHOFORM crash or ANR detected."
  exit 1
fi
echo "ECHOFORM installed, launched, survived touch and captured screenshots."
