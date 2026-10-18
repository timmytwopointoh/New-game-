#!/usr/bin/env bash
set -euo pipefail
PKG="com.fracturedrealms.game"
capture_diagnostics() {
  adb logcat -d -v threadtime > realm-logcat.txt 2>&1 || true
  adb shell dumpsys activity activities > realm-activity.txt 2>&1 || true
}
trap capture_diagnostics EXIT
adb install -r apk/fractured-realms-debug.apk
adb shell pm list packages | grep -q "package:$PKG"
adb logcat -c || true
adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1
sleep 12
PID="$(adb shell pidof "$PKG" | tr -d '\r' || true)"
test -n "$PID" || { echo "GAME_PROCESS_NOT_RUNNING"; exit 1; }
adb shell screencap -p /sdcard/realm-menu.png
adb pull /sdcard/realm-menu.png realm-menu.png
read -r W H < <(python3 - <<'PY'
import struct
with open('realm-menu.png','rb') as f:
    f.seek(16)
    print(*struct.unpack('>II',f.read(8)))
PY
)
adb shell input tap "$((W / 2))" "$((H / 2 + H / 24))"
sleep 3
adb shell input tap "$((W / 3))" "$((H / 3))"
sleep 2
adb shell input swipe "$((W / 4))" "$((H * 3 / 4))" "$((W / 3))" "$((H * 3 / 5))" 750
sleep 4
adb shell screencap -p /sdcard/realm-play.png
adb pull /sdcard/realm-play.png realm-play.png
capture_diagnostics
test "$(adb shell pidof "$PKG" | tr -d '\r')" = "$PID" || { echo "GAME_RESTARTED_OR_CRASHED"; exit 1; }
if cmp -s realm-menu.png realm-play.png; then
  echo "NO_VISUAL_CHANGE_AFTER_MENU_AND_INPUT"
  exit 1
fi
if grep -iE 'USER SCRIPT ERROR|SCRIPT ERROR|Parse Error|Failed to load script|Invalid call|Invalid set index|Invalid get index|FATAL EXCEPTION|ANR in com.fracturedrealms.game' realm-logcat.txt; then
  echo "GAME_LOG_REPORTED_RUNTIME_ERROR"
  exit 1
fi
echo "ANDROID_STANDALONE_GAME_SMOKE_PASSED"
