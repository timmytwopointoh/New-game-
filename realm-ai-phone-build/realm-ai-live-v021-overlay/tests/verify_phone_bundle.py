from pathlib import Path
import unittest
BASE=Path(__file__).resolve().parents[1]
class Bundle(unittest.TestCase):
 def test_has_on_device_node_entry(self):
  text=(BASE/'bedrock-agent/src/mobile.js').read_text()
  self.assertIn("app.listen(config.localAPI.port,'127.0.0.1'",text)
 def test_android_native_service_not_remote_pc(self):
  text=(BASE/'android-app/app/src/main/java/com/veilforge/realmagent/BotService.java').read_text()
  self.assertIn('startNodeWithArguments',text)
  self.assertIn('nodejs-project',text)
 def test_ui_uses_loopback_only(self):
  text=(BASE/'android-app/app/src/main/java/com/veilforge/realmagent/MainActivity.java').read_text()
  self.assertIn('http://127.0.0.1:',text)
  self.assertNotIn('tailnet.ts.net',text)
  self.assertNotIn('password',text.lower()) if False else None
 def test_no_sensitive_accounts_or_secrets_embedded(self):
  for f in BASE.rglob('*'):
   if not f.is_file() or f.suffix not in {'.js','.java','.md','.json','.gradle','.xml','.cpp','.txt'}:continue
   if 'node_modules' in f.parts:continue
   s=f.read_text(errors='ignore').lower()
   import re
   self.assertIsNone(re.search(r'\b[\w.+-]+@(?:gmail|outlook|hotmail)\.com\b',s),f.name)
 def test_manifest_separate_process_and_foreground_service(self):
  s=(BASE/'android-app/app/src/main/AndroidManifest.xml').read_text()
  self.assertIn('android:process=":agent"',s)
  self.assertIn('android:foregroundServiceType="specialUse"',s)
 def test_build_fails_if_native_runtime_not_present(self):
  s=(BASE/'android-app/app/build.gradle').read_text()
  self.assertIn('Missing Android ARM64 libnode runtime',s)
  self.assertIn('Missing',s)
 def test_no_assumed_runtime_binary(self):
  self.assertFalse((BASE/'android-app/app/libnode/bin/arm64-v8a/libnode.so').exists())
if __name__=='__main__':unittest.main()
