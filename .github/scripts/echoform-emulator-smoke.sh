#!/usr/bin/env bash
# Manual/review-bound smoke test of real Godot Android APK (one emulator).
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
  echo "ECHOFORM did not stay running after launch."
  exit 1
fi
adb shell screencap -p /sdcard/echoform-start.png
adb pull /sdcard/echoform-start.png echoform-start.png
read -r W H < <(python3 - <<'PY'
import struct
with open('echoform-start.png','rb') as f:
    f.seek(16)
    print(*struct.unpack('>II',f.read(8)))
PY
)
# Menu centered on screen; first interactive button is near vertical midpoint.
adb shell input tap "$((W / 2))" "$((H / 2 + 45))"
sleep 2
# Skip the cinematic and then attempt an actual in-world drag.
adb shell input tap "$((W / 3))" "$((H / 3))"
sleep 2
adb shell input swipe "$((W / 4))" "$((H * 3 / 4))" "$((W / 3))" "$((H * 3 / 5))" 750
sleep 3
end_pid="$(adb shell pidof "$PACKAGE" | tr -d '\r' || true)"
adb shell screencap -p /sdcard/echoform-move.png
adb pull /sdcard/echoform-move.png echoform-move.png
capture_diagnostics
if [[ -z "$end_pid" || "$start_pid" != "$end_pid" ]]; then
  echo "ECHOFORM process exited or restarted after input."
  exit 1
fi
if cmp -s echoform-start.png echoform-move.png; then
  echo "Visual smoke failed: menu and post-input screenshots are identical."
  exit 1
fi
if grep -E 'Fragment shader active uniforms exceed|SceneShaderGLES3: Program linking failed|CanvasShaderGLES3: Program linking failed|SCRIPT ERROR|Parse Error' echoform-logcat.txt; then
  echo "Godot shader or script errors in emulator logcat."
  exit 1
fi
if grep -E 'Fatal signal.*(echoform.game|m.echoform.game)|ANR in com.echoform.game|Process: com.echoform.game' echoform-logcat.txt; then
  echo "ECHOFORM crash or ANR."
  exit 1
fi
echo "ECHOFORM launched with surviving PID and visually differing menu/post-input screenshots. Manual screenshot review is still required."
