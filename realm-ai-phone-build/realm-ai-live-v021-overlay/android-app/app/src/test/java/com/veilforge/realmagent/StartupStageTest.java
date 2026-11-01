package com.veilforge.realmagent;

import android.content.Context;
import android.os.Looper;
import org.json.JSONObject;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.Config;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.zip.*;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class)
@Config(sdk=28,qualifiers="w360dp-h640dp-mdpi")
public class StartupStageTest {
  @Test public void slowBundledAssetExtractionDoesNotMakeAppForgetRequestedService()throws Exception{
    ButtonActionsTest.TestActivity a=Robolectric.buildActivity(ButtonActionsTest.TestActivity.class).setup().get();
    try {
      a.onPause();
      a.serviceStarted=true;
      a.apiConnected=false;
      a.token="c".repeat(64);
      a.serviceStateSince=System.currentTimeMillis()-31_000L;
      a.failRequests=true;
      a.expect();
      a.update();
      a.await();
      assertTrue("31-second extraction must not reset service state",a.serviceStarted);
      assertTrue(a.connection.getText().toString().contains("Preparing embedded bot"));
    }finally{a.onDestroy();}
  }
  @Test public void startupReportKeepsOnlyStageAndTimestamp()throws Exception {
    Context app=RuntimeEnvironment.getApplication();
    File file=new File(app.getFilesDir(),"startup-status.json");
    try(FileOutputStream out=new FileOutputStream(file)){
      out.write("{\"schema\":1,\"stage\":\"copying-assets\",\"at\":123,\"password\":\"do-not-export\",\"username\":\"secret\"}".getBytes(StandardCharsets.UTF_8));
    }
    JSONObject status=SupportBundle.startup(app);
    assertEquals("copying-assets",status.getString("stage"));
    assertEquals(123L,status.getLong("at"));
    assertFalse(status.toString().contains("do-not-export"));
    assertFalse(status.has("username"));
    ByteArrayOutputStream bytes=new ByteArrayOutputStream();
    SupportBundle.export(app,bytes);
    try(ZipInputStream zip=new ZipInputStream(new ByteArrayInputStream(bytes.toByteArray()))){
      ZipEntry entry;boolean found=false;
      while((entry=zip.getNextEntry())!=null){
        if("startup.json".equals(entry.getName())){
          found=true;
          ByteArrayOutputStream data=new ByteArrayOutputStream();byte[] b=new byte[512];int n;
          while((n=zip.read(b))!=-1)data.write(b,0,n);
          JSONObject exported=new JSONObject(data.toString(StandardCharsets.UTF_8));
          assertEquals("copying-assets",exported.getString("stage"));
          assertFalse(exported.toString().contains("do-not-export"));
        }
      }
      assertTrue("Startup report must be included in bug report ZIP",found);
    }
    try(FileOutputStream out=new FileOutputStream(file)){
      out.write("{\"stage\":\"token=must-not-leak\",\"at\":999}".getBytes(StandardCharsets.UTF_8));
    }
    assertEquals("unknown",SupportBundle.startup(app).getString("stage"));
  }
}
