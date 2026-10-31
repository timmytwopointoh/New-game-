package com.veilforge.realmagent;
import android.app.AlertDialog;
import android.content.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.zip.*;
import org.json.*;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.Config;
import org.robolectric.shadows.ShadowAlertDialog;
import static org.junit.Assert.*;
@RunWith(RobolectricTestRunner.class) @Config(sdk=28,qualifiers="w360dp-h640dp-mdpi")
public class SupportBundleTest {
 MainActivity a;
 @Before public void create(){a=Robolectric.buildActivity(MainActivity.class).setup().get();a.onPause();a.token="";a.serviceStarted=false;}
 @After public void destroy(){a.onDestroy();}
 void write(String name,String data)throws Exception{File f=new File(a.getFilesDir(),name);f.getParentFile().mkdirs();try(FileOutputStream o=new FileOutputStream(f)){o.write(data.getBytes(StandardCharsets.UTF_8));}}
 Map<String,String> export()throws Exception{ByteArrayOutputStream bytes=new ByteArrayOutputStream();SupportBundle.export(a,bytes);Map<String,String> result=new HashMap<>();try(ZipInputStream z=new ZipInputStream(new ByteArrayInputStream(bytes.toByteArray()))){ZipEntry e;while((e=z.getNextEntry())!=null){ByteArrayOutputStream b=new ByteArrayOutputStream();byte[] buf=new byte[4096];int n;while((n=z.read(buf))!=-1)b.write(buf,0,n);result.put(e.getName(),b.toString("UTF-8"));}}return result;}
 @Test public void offlineReportUsesOnlyFixedSanitizedFilesAndExcludesCredentialsChatAndRawErrors()throws Exception{
  write("nodejs-project/config.json","{\"token\":\"PRIVATE-CONFIG\"}");write("nodejs-project/private/auth/switch/login.json","{\"refresh_token\":\"PRIVATE-LOGIN\"}");
  write("nodejs-project/private/diagnostics/connection.json","{\"phase\":\"spawned\",\"token\":\"PRIVATE-TOKEN\",\"authChallenge\":{\"userCode\":\"PRIVATE-CODE\"}}");
  write("nodejs-project/private/diagnostics/runtime.json","{\"events\":[{\"kind\":\"sample\",\"at\":1,\"state\":{\"mode\":\"survival\",\"position\":{\"x\":1,\"y\":64,\"z\":2},\"chat\":\"PRIVATE-CHAT\",\"lastError\":\"PRIVATE-ERROR\"}}],\"issues\":[{\"code\":\"server_stuck\",\"count\":2,\"token\":\"PRIVATE-ISSUE\"}],\"password\":\"PRIVATE-PASSWORD\"}");
  Map<String,String> files=export();assertEquals(new HashSet<>(Arrays.asList("README.txt","app.json","app-events.json","connection.json","runtime.json")),files.keySet());String all=files.toString();assertFalse(all.contains("PRIVATE-"));assertTrue(all.contains("server_stuck"));assertTrue(all.contains("coordinates"));assertFalse(new JSONObject(files.get("app.json")).getBoolean("remoteAccess"));assertTrue(new File(a.getFilesDir(),"nodejs-project/private/auth/switch/login.json").isFile());
 }
 @Test public void malformedOrMissingRuntimeStillExportsReadableAppReport()throws Exception{write("nodejs-project/private/diagnostics/runtime.json","broken");Map<String,String> f=export();assertEquals(0,new JSONObject(f.get("runtime.json")).getJSONArray("events").length());assertEquals(a.getPackageName(),new JSONObject(f.get("app.json")).getString("package"));}
 @Test public void bugReportDialogAndDocumentSaveWorkWithoutStartingBot()throws Exception{
  a.showBugReports();AlertDialog d=ShadowAlertDialog.getLatestAlertDialog();assertTrue(d.isShowing());assertTrue(d.getButton(AlertDialog.BUTTON_POSITIVE).getText().toString().contains("Export"));d.getButton(AlertDialog.BUTTON_POSITIVE).performClick();Shadows.shadowOf(android.os.Looper.getMainLooper()).idle();Intent i=Shadows.shadowOf(a).getNextStartedActivityForResult().intent;assertEquals(Intent.ACTION_CREATE_DOCUMENT,i.getAction());assertEquals("application/zip",i.getType());assertFalse(a.serviceStarted);
 }
 @Test public void updaterIncludesDirectAccessToBugReports(){AppUpdater.show(a);AlertDialog d=ShadowAlertDialog.getLatestAlertDialog();assertEquals("Bug reports",d.getButton(AlertDialog.BUTTON_NEUTRAL).getText().toString());d.getButton(AlertDialog.BUTTON_NEUTRAL).performClick();Shadows.shadowOf(android.os.Looper.getMainLooper()).idle();assertEquals("Export ZIP",ShadowAlertDialog.getLatestAlertDialog().getButton(AlertDialog.BUTTON_POSITIVE).getText().toString());}
 @Test public void appLogAcceptsOnlyEventCodesAndKeepsABoundedHistory()throws Exception{
  for(int i=0;i<210;i++)SupportLog.record(a,i%2==0?"update_check":"update_current");SupportLog.record(a,"PRIVATE-TOKEN");JSONObject saved=SupportBundle.read(SupportLog.file(a),131072);assertEquals(200,saved.getJSONArray("events").length());assertFalse(saved.toString().contains("PRIVATE"));
 }
}
