package com.veilforge.realmagent;

import android.net.Uri;
import android.os.ParcelFileDescriptor;
import java.io.*;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.Config;
import static org.junit.Assert.*;

/** Strict one-file share permission checks; never exposes account/cache paths. */
@RunWith(RobolectricTestRunner.class)
@Config(sdk=28)
public class ReportContentProviderTest {
 MainActivity activity;
 @Before public void setup(){activity=Robolectric.buildActivity(MainActivity.class).setup().get();activity.onPause();}
 @After public void cleanup(){activity.onDestroy();}
 @Test public void onlyGeneratedAllInOneZipIsShareableAndProviderIsReadOnly()throws Exception{
   File file=new File(ReportContentProvider.reportDirectory(activity),"Realm-AI-Live-ALL-DIAGNOSTICS-1793688391819.zip");
   try(FileOutputStream stream=new FileOutputStream(file)){stream.write(new byte[]{80,75,3,4});}
   Uri uri=ReportContentProvider.uri(activity,file);
   assertEquals("content",uri.getScheme());
   assertEquals("application/zip",activity.getContentResolver().getType(uri));
   try(ParcelFileDescriptor descriptor=activity.getContentResolver().openFileDescriptor(uri,"r")){
     assertNotNull(descriptor);
   }
   try{activity.getContentResolver().openFileDescriptor(uri,"w");fail("Writable provider");}
   catch(FileNotFoundException|SecurityException expected){}
   try{ReportContentProvider.uri(activity,new File(activity.getFilesDir(),"private/auth/switch/account.zip"));fail("Exposed auth path");}
   catch(SecurityException expected){}
   Uri invalid=uri.buildUpon().appendPath("private-auth").build();
   try{activity.getContentResolver().openFileDescriptor(invalid,"r");fail("Exposed traversal");}
   catch(FileNotFoundException|SecurityException expected){}
 }
}
