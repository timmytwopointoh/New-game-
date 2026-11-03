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
  Map<String,String> files=export();assertEquals(new HashSet<>(Arrays.asList("README.txt","summary.json","manifest.json","app.json","app-events.json","startup.json","connection.json","runtime.json","live-snapshot.json","pack-loading.json","pack-handshake.json","work-learning.json")),files.keySet());String all=files.toString();assertFalse(all.contains("PRIVATE-"));assertTrue(all.contains("server_stuck"));assertTrue(all.contains("coordinates"));assertFalse(new JSONObject(files.get("app.json")).getBoolean("remoteAccess"));assertTrue(new File(a.getFilesDir(),"nodejs-project/private/auth/switch/login.json").isFile());
 }
 @Test public void handshakeTimelineRetainsPacketOrderButNeverExportsSecrets()throws Exception{
  write("nodejs-project/private/diagnostics/pack-handshake.json",
    "{\"schema\":1,\"accessToken\":\"PRIVATE-AUTH\",\"sessions\":[{\"state\":\"closed\",\"rawAddress\":\"PRIVATE-IP\",\"events\":[{\"kind\":\"received\",\"packet\":\"resource_packs_info\",\"ms\":150,\"packCount\":9,\"rawUrl\":\"PRIVATE-URL\"},{\"kind\":\"write-attempt\",\"packet\":\"resource_pack_client_response\",\"status\":\"Downloading\",\"ms\":170,\"packCount\":9,\"rawId\":\"PRIVATE-ID\"},{\"kind\":\"client-closed\",\"ms\":310,\"reason\":\"PRIVATE-CLOSE\"}]}]}");
  Map<String,String> files=export();
  assertTrue(files.containsKey("pack-handshake.json"));
  JSONObject record=new JSONObject(files.get("pack-handshake.json"));
  JSONArray events=record.getJSONArray("sessions").getJSONObject(0).getJSONArray("events");
  assertEquals(3,events.length());
  assertEquals("resource_packs_info",events.getJSONObject(0).getString("packet"));
  assertEquals("Downloading",events.getJSONObject(1).getString("status"));
  assertEquals("client-closed",events.getJSONObject(2).getString("kind"));
  assertFalse(files.toString().contains("PRIVATE-"));
 }
 @Test public void malformedOrMissingRuntimeStillExportsReadableAppReport()throws Exception{write("nodejs-project/private/diagnostics/runtime.json","broken");Map<String,String> f=export();assertEquals(0,new JSONObject(f.get("runtime.json")).getJSONArray("events").length());assertEquals(a.getPackageName(),new JSONObject(f.get("app.json")).getString("package"));}
 @Test public void oneTapDiagnosticShareCreatesOneCompletePrivateZipWithoutStoppingService()throws Exception{
  a.showBugReports();
  a.supportIo.submit(()->{}).get(10,java.util.concurrent.TimeUnit.SECONDS);
  Shadows.shadowOf(android.os.Looper.getMainLooper()).idle();
  File[] reports=ReportContentProvider.reportDirectory(a).listFiles((dir,name)->name.endsWith(".zip"));
  assertNotNull(reports);assertTrue(reports.length>=1);
  File report=reports[reports.length-1];
  android.net.Uri uri=ReportContentProvider.uri(a,report);
  assertEquals("content",uri.getScheme());
  assertEquals(a.getPackageName()+".reports",uri.getAuthority());
  assertFalse(a.serviceStarted);
  try(InputStream in=new FileInputStream(report);ZipInputStream zip=new ZipInputStream(in)){
    Set<String> entries=new HashSet<>();ZipEntry entry;
    while((entry=zip.getNextEntry())!=null)entries.add(entry.getName());
    assertEquals(12,entries.size());assertTrue(entries.contains("pack-handshake.json"));assertTrue(entries.contains("pack-loading.json"));
  }
 }
 @Test public void updaterUsesTheSameAllInOneReportAction()throws Exception{
  AppUpdater.show(a);AlertDialog dialog=ShadowAlertDialog.getLatestAlertDialog();
  assertEquals("Bug reports",dialog.getButton(AlertDialog.BUTTON_NEUTRAL).getText().toString());
  dialog.getButton(AlertDialog.BUTTON_NEUTRAL).performClick();
  a.supportIo.submit(()->{}).get(10,java.util.concurrent.TimeUnit.SECONDS);
  File[] reports=ReportContentProvider.reportDirectory(a).listFiles((dir,name)->name.endsWith(".zip"));
  assertNotNull(reports);assertTrue(reports.length>=1);
 }
 @Test public void appLogAcceptsOnlyEventCodesAndKeepsABoundedHistory()throws Exception{
  for(int i=0;i<210;i++)SupportLog.record(a,i%2==0?"update_check":"update_current");SupportLog.record(a,"PRIVATE-TOKEN");JSONObject saved=SupportBundle.read(SupportLog.file(a),131072);assertEquals(200,saved.getJSONArray("events").length());assertFalse(saved.toString().contains("PRIVATE"));
 }
 @Test public void inventoryAndPlacementEvidenceIsAvailableInExportWithoutRawItems()throws Exception{JSONObject raw=new JSONObject("{\"events\":[{\"kind\":\"sample\",\"state\":{\"inventoryRevision\":12,\"selectedHotbar\":2,\"heldCount\":8,\"placementConfirmed\":1,\"placementTotal\":4,\"held_item\":{\"token\":\"PRIVATE\"}}}],\"packets\":{\"inventory_content\":2}}");JSONObject t=SupportBundle.trace(raw);JSONObject state=t.getJSONArray("events").getJSONObject(0).getJSONObject("state");assertEquals(12,state.getInt("inventoryRevision"));assertEquals(1,state.getInt("placementConfirmed"));assertEquals(2,t.getJSONObject("packets").getInt("inventory_content"));assertFalse(t.toString().contains("PRIVATE"));}

 @Test public void completeSingleZipIncludesLiveStateWhileDroppingUnknownFields()throws Exception{
  JSONObject raw=new JSONObject();
  raw.put("source","live");raw.put("capturedAt",12345);raw.put("unwantedData","DO_NOT_EXPORT");
  raw.put("pack",new JSONObject().put("stage","pack-request").put("advertised",5).put("optionalSkipped",2).put("rawLink","DO_NOT_EXPORT"));
  raw.put("loading",new JSONObject().put("stage","pack-request").put("noProgressSeconds",900).put("repeatedSignals",30));
  raw.put("task",new JSONObject().put("navigation","blocked").put("queuePending",2).put("rawInstruction","DO_NOT_EXPORT"));
  raw.put("learning",new JSONObject().put("confirmed",3).put("learnedMappings",17).put("rawDefinitions","DO_NOT_EXPORT"));
  ByteArrayOutputStream bytes=new ByteArrayOutputStream();
  SupportBundle.export(a,bytes,raw);
  Map<String,String> files=new HashMap<>();
  try(ZipInputStream z=new ZipInputStream(new ByteArrayInputStream(bytes.toByteArray()))){
   ZipEntry e;while((e=z.getNextEntry())!=null){
    ByteArrayOutputStream out=new ByteArrayOutputStream();byte[] b=new byte[1024];int n;
    while((n=z.read(b))!=-1)out.write(b,0,n);
    files.put(e.getName(),out.toString("UTF-8"));
   }
  }
  assertEquals(12,files.size());
  JSONObject manifest=new JSONObject(files.get("manifest.json"));
  assertTrue(manifest.getBoolean("liveSnapshotCaptured"));
  assertEquals("one-zip",new JSONObject(files.get("summary.json")).getString("reportFormat"));
  JSONObject live=new JSONObject(files.get("live-snapshot.json"));
  assertEquals("live",live.getString("source"));
  assertEquals(2,live.getJSONObject("pack").getInt("optionalSkipped"));
  assertEquals(30,live.getJSONObject("loading").getInt("repeatedSignals"));
  assertEquals(17,new JSONObject(files.get("work-learning.json")).getJSONObject("learning").getInt("learnedMappings"));
  assertFalse(files.toString().contains("DO_NOT_EXPORT"));
 }
 @Test public void offlineSingleZipClearlyMarksLiveSnapshotMissingAndKeepsPreviousFailures()throws Exception{
  write("nodejs-project/private/diagnostics/connection.json","{\"phase\":\"pack-error\",\"packReason\":\"server-no-pack-data\",\"packHeaders\":0,\"packChunks\":0,\"lastFailure\":{\"phase\":\"pack-error\",\"httpStatus\":null}}");
  Map<String,String> files=export();
  JSONObject manifest=new JSONObject(files.get("manifest.json"));
  assertFalse(manifest.getBoolean("liveSnapshotCaptured"));
  assertTrue(manifest.getBoolean("connectionReportFilePresent"));
  assertEquals("server-no-pack-data",new JSONObject(files.get("summary.json")).getString("resourcePackReason"));
  assertEquals("offline",new JSONObject(files.get("live-snapshot.json")).getString("source"));
 }

}
