#!/usr/bin/env bash
set -euo pipefail
PKG="com.fracturedrealms.game"
capture_diagnostics() {
  adb logcat -d -v threadtime > realm-logcat.txt 2>&1 || true
  adb shell dumpsys activity activities > realm-activity.txt 2>&1 || true
}
trap capture_diagnostics EXIT
wait_for() {
  local marker="$1"
  local max_attempts="$2"
  for attempt in $(seq 1 "$max_attempts"); do
    if adb logcat -d -v brief 2>/dev/null | grep -q "$marker"; then
      echo "Detected game state: $marker"
      return 0
    fi
    sleep 2
  done
  echo "TIMEOUT_WAITING_FOR_$marker"
  return 1
}
adb install -r apk/fractured-realms-debug.apk
adb shell pm list packages | grep -q "package:$PKG"
adb shell settings put secure immersive_mode_confirmations confirmed || true
adb logcat -c || true
adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1
wait_for "FR_MENU_READY" 55
# Godot may print the ready marker before Android has presented its first frame.
# A boot splash on this fixed emulator is far smaller than the textured menu.
for frame in $(seq 1 40); do
  adb shell screencap -p /sdcard/realm-menu.png
  adb pull /sdcard/realm-menu.png realm-menu.png >/dev/null
  BYTES="$(wc -c < realm-menu.png)"
  if [ "$BYTES" -gt 65000 ]; then
    echo "FR_MENU_PIXELS_READY bytes=$BYTES"
    break
  fi
  sleep 2
done
test "$(wc -c < realm-menu.png)" -gt 65000 || { echo "MENU_STILL_LOADING_OR_BLANK"; exit 1; }
sleep 2
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
adb shell input tap "$((W / 2))" "$((H * 47 / 100))"
wait_for "FR_INTRO_READY" 18
adb shell input keyevent 62
wait_for "FR_PLAY_READY" 18
sleep 5
adb shell input swipe "$((W / 4))" "$((H * 3 / 4))" "$((W / 3))" "$((H * 3 / 5))" 750
sleep 3
adb shell screencap -p /sdcard/realm-play.png
adb pull /sdcard/realm-play.png realm-play.png
capture_diagnostics
test "$(adb shell pidof "$PKG" | tr -d '\r')" = "$PID" || { echo "GAME_RESTARTED_OR_CRASHED"; exit 1; }
if cmp -s realm-menu.png realm-play.png; then
  echo "NO_VISUAL_CHANGE_AFTER_GAMEPLAY"
  exit 1
fi
if grep -iE 'USER SCRIPT ERROR|SCRIPT ERROR|Parse Error|Failed to load script|SceneShaderGLES3: Program linking failed|Fragment shader active uniforms exceed|_compile_specialization|Invalid call|Invalid set index|Invalid get index|FATAL EXCEPTION|ANR in com.fracturedrealms.game' realm-logcat.txt; then
  echo "GAME_LOG_REPORTED_RUNTIME_ERROR"
  exit 1
fi
echo "ANDROID_FRACTURED_REALMS_INSTALL_MENU_INTRO_PLAY_SMOKE_PASSED"
