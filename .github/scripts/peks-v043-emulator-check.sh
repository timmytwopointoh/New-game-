#!/usr/bin/env bash
set -euo pipefail
adb shell wm size 960x540
adb shell wm density 200
adb shell settings put system accelerometer_rotation 0
adb shell settings put system user_rotation 1
adb install -r apk/Peks-Plunder-v043.apk
adb logcat -c
adb shell am start -n com.peks.plunder/.MainActivity
for n in $(seq 1 15); do
  sleep 4
  adb logcat -d -s PEKS_AUDIT:I > peks-v043-log.txt || true
  if grep -q 'UI_READY=.*roles' peks-v043-log.txt; then break; fi
done
adb shell pidof com.peks.plunder
adb shell screencap -p /sdcard/peks-v043.png
adb pull /sdcard/peks-v043.png Peks-Plunder-v043-emulator.png
echo '=== WebView diagnostic ==='
cat peks-v043-log.txt || true
test -s Peks-Plunder-v043-emulator.png
 test "$(stat -c%s Peks-Plunder-v043-emulator.png)" -gt 6000
if grep -Eq 'JS_ERROR=|LOAD_ERROR=' peks-v043-log.txt; then exit 1; fi
grep -Eq 'UI_READY=.*roles.*19' peks-v043-log.txt
