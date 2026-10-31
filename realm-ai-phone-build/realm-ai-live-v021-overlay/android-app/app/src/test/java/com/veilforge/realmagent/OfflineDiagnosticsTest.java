package com.veilforge.realmagent;
import android.app.AlertDialog;
import android.content.*;
import android.os.Looper;
import java.io.*;
import java.nio.charset.StandardCharsets;
import org.json.*;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.Config;
import org.robolectric.shadows.ShadowAlertDialog;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class) @Config(sdk=28,qualifiers="w360dp-h640dp-mdpi")
public class OfflineDiagnosticsTest {
 ButtonActionsTest.TestActivity a;
 @Before public void create(){a=Robolectric.buildActivity(ButtonActionsTest.TestActivity.class).setup().get();a.onPause();a.token="";a.apiConnected=false;a.serviceStarted=false;}
 @After public void destroy(){a.onDestroy();}
 String copyLatest(){AlertDialog d=ShadowAlertDialog.getLatestAlertDialog();assertNotNull(d);assertTrue(d.isShowing());d.getButton(AlertDialog.BUTTON_POSITIVE).performClick();Shadows.shadowOf(Looper.getMainLooper()).idle();return ((ClipboardManager)a.getSystemService(Context.CLIPBOARD_SERVICE)).getPrimaryClip().getItemAt(0).getText().toString();}
 JSONObject failure()throws Exception{return new JSONObject("{\"phase\":\"xbox-title-token\",\"authState\":\"error\",\"failure\":{\"phase\":\"xbox-title-token\",\"httpStatus\":403},\"authChallenge\":{\"userCode\":\"PRIVATE-CODE\"},\"token\":\"PRIVATE-TOKEN\",\"lastError\":\"PRIVATE-RAW-ERROR\"}");}
 @Test public void diagnosticsOpenAndCopyWithoutEverStartingTheBot()throws Exception{
  a.showDiagnostics();JSONObject report=new JSONObject(copyLatest());assertFalse(report.getBoolean("localApiReachable"));assertEquals("app-only",report.getString("reportSource"));assertEquals(a.getPackageName(),report.getString("applicationId"));assertTrue(a.calls.isEmpty());assertTrue(a.starts.isEmpty());
 }
 @Test public void successfulErrorStatusMarksControllerConnectedAndRemembersFailure()throws Exception{
  a.token="private-local-token";a.serviceStarted=true;a.serviceStateSince=System.currentTimeMillis()-60000;a.expect();a.update();a.await();
  assertTrue("A running local API is independent of Realm login",a.apiConnected);assertTrue(a.serviceStarted);assertTrue(a.lastApiSuccessAt>0);assertTrue(a.connection.getText().toString().contains("xbox-title-token"));
  a.failRequests=true;a.expect();a.update();a.await();assertFalse(a.apiConnected);assertTrue("One failed poll must not treat a recently responding service as dead",a.serviceStarted);
  a.token="";a.serviceStarted=false;a.showDiagnostics();String text=copyLatest();assertTrue(text.contains("403"));assertTrue(text.contains("xbox-title-token"));assertFalse(text.contains("private-local-token"));
 }
 @Test public void sanitizedFailureSurvivesActivityRestartAndStoppedService()throws Exception{
  a.rememberDiagnostics(failure());a.onDestroy();a=Robolectric.buildActivity(ButtonActionsTest.TestActivity.class).setup().get();a.onPause();a.token="";a.apiConnected=false;a.serviceStarted=false;
  a.showDiagnostics();String text=copyLatest();JSONObject report=new JSONObject(text);assertEquals("saved",report.getString("reportSource"));assertEquals(403,report.getJSONObject("lastFailure").getInt("httpStatus"));
  for(String secret:new String[]{"PRIVATE-CODE","PRIVATE-TOKEN","PRIVATE-RAW-ERROR"})assertFalse(text.contains(secret));assertTrue(a.calls.isEmpty());
 }
 @Test public void childProcessFileCanBeReadWithNoTokenAndNoReachableApi()throws Exception{
  File file=new File(a.getFilesDir(),"nodejs-project/private/diagnostics/connection.json");assertTrue(file.getParentFile().mkdirs()||file.getParentFile().isDirectory());JSONObject source=failure();source.put("recordedAt",System.currentTimeMillis());
  try(FileOutputStream out=new FileOutputStream(file)){out.write(source.toString().getBytes(StandardCharsets.UTF_8));}
  a.showDiagnostics();String text=copyLatest();assertTrue(text.contains("403"));assertFalse(text.contains("PRIVATE-TOKEN"));assertFalse(text.contains("PRIVATE-CODE"));assertTrue(a.calls.isEmpty());
 }
 @Test public void failedLiveDiagnosticRequestFallsBackToSavedReportInsteadOfBlocking()throws Exception{
  a.rememberDiagnostics(failure());a.token="private-token";a.serviceStarted=true;a.failRequests=true;a.expect();a.showDiagnostics();a.await();String text=copyLatest();assertTrue(text.contains("403"));assertFalse(new JSONObject(text).getBoolean("localApiReachable"));assertTrue(a.starts.isEmpty());
 }
 @Test public void newAttemptKeepsLastFailureAndMalformedCacheStillAllowsCopy()throws Exception{
  a.rememberDiagnostics(failure());a.rememberDiagnostics(new JSONObject("{\"phase\":\"starting\"}"));a.showDiagnostics();JSONObject report=new JSONObject(copyLatest());assertEquals("starting",report.getString("phase"));assertEquals(403,report.getJSONObject("lastFailure").getInt("httpStatus"));
  a.getPreferences(Context.MODE_PRIVATE).edit().putString("lastConnectionDiagnostics","{broken").apply();a.showDiagnostics();assertNotNull(new JSONObject(copyLatest()));
 }
 @Test public void switchPlatformIsClearEvenWhenViewingAnOlderSavedReport()throws Exception{
  JSONObject report=failure();report.put("clientIdentity",new JSONObject().put("platform","Nintendo").put("deviceOS",12).put("flow","live"));a.rememberDiagnostics(report);a.showDiagnostics();JSONObject copied=new JSONObject(copyLatest());assertEquals("Nintendo Switch",copied.getString("configuredLoginPlatform"));assertEquals("Nintendo",copied.getJSONObject("clientIdentity").getString("platform"));assertEquals(12,copied.getJSONObject("clientIdentity").getInt("deviceOS"));
 }
}
