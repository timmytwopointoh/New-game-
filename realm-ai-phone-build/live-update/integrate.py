#!/usr/bin/env python3
"""Add independent Realm Live identity and native updater to materialized v019 source."""
from pathlib import Path
import shutil,sys
here=Path(__file__).resolve().parent
root=Path(sys.argv[1]).resolve();app=root/'android-app/app';java=app/'src/main/java/com/veilforge/realmagent'
for p in (here/'android').glob('*.java'):shutil.copy2(p,java/p.name)
def replace(path,old,new):
 s=path.read_text();assert s.count(old)==1,(path,old);path.write_text(s.replace(old,new))
replace(app/'build.gradle',"applicationId 'com.veilforge.realmagent'","applicationId 'com.veilforge.realmagent.live'")
replace(app/'build.gradle','versionCode 100016','versionCode 200001')
replace(app/'build.gradle',"versionName '0.19-language-chat'","versionName '0.20-secure-updates'")
manifest=app/'src/main/AndroidManifest.xml'
replace(manifest,'<application android:label="VEILFORGE Realm AI"','<uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES"/>\n    <application android:label="Realm AI Live"')
replace(manifest,'    </application>','        <receiver android:name="com.veilforge.realmagent.UpdateInstallerReceiver" android:exported="false"/>\n    </application>')
# Full component class names preserve JNI/Java identity while applicationId stays separate.
replace(manifest,'android:name=".MainActivity"','android:name="com.veilforge.realmagent.MainActivity"')
replace(manifest,'android:name=".BotService"','android:name="com.veilforge.realmagent.BotService"')
activity=java/'MainActivity.java'
replace(activity,'        View headerSpacer=new View(this);','        Button updates=button("Updates",()->AppUpdater.show(this));updates.setContentDescription("Check companion updates");header.addView(updates,new LinearLayout.LayoutParams(d(94),d(44)));\n        View headerSpacer=new View(this);')
replace(activity,'    @Override protected void onResume(){super.onResume();','    @Override protected void onResume(){super.onResume();if(getIntent().getBooleanExtra("showUpdates",false)){getIntent().removeExtra("showUpdates");AppUpdater.show(this);}')
service=java/'BotService.java'
replace(service,'        NotificationManager nm = getSystemService(NotificationManager.class);','        AppUpdater.startMonitor(this);\n        NotificationManager nm = getSystemService(NotificationManager.class);')
replace(service,'            stopForeground(true); stopSelf();','            AppUpdater.stopMonitor(); stopForeground(true); stopSelf();')
replace(service,'    private void writeState(String message) {','    @Override public void onDestroy(){AppUpdater.stopMonitor();super.onDestroy();}\n    private void writeState(String message) {')
# Unit tests cover the release authorization and the live-update controls.
tests=app/'src/test/java/com/veilforge/realmagent'
for p in (here/'tests').glob('*.java'):shutil.copy2(p,tests/p.name)
print('Integrated independent Realm AI Live updater; no other app identity/key changed')
