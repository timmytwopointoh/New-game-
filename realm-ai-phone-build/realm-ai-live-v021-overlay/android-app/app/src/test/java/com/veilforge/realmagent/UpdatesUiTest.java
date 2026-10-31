package com.veilforge.realmagent;
import android.app.AlertDialog;
import android.view.*;
import android.widget.*;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.Config;
import org.robolectric.shadows.ShadowAlertDialog;
import static org.junit.Assert.*;
@RunWith(RobolectricTestRunner.class) @Config(sdk=28,qualifiers="w360dp-h640dp-mdpi")
public class UpdatesUiTest {
 MainActivity a;
 @Before public void create(){a=Robolectric.buildActivity(MainActivity.class).setup().get();}
 @After public void destroy(){a.onDestroy();}
 View find(View v,String text){if(v instanceof TextView&&((TextView)v).getText().toString().equals(text))return v;if(v instanceof ViewGroup){ViewGroup g=(ViewGroup)v;for(int i=0;i<g.getChildCount();i++){View r=find(g.getChildAt(i),text);if(r!=null)return r;}}return null;}
 @Test public void updateControlOpensWithoutStartingOrStoppingBot(){View root=a.findViewById(android.R.id.content);View b=find(root,"Updates");assertNotNull(b);assertTrue(b.performClick());AlertDialog d=ShadowAlertDialog.getLatestAlertDialog();assertTrue(d.isShowing());assertEquals("Check now",d.getButton(AlertDialog.BUTTON_POSITIVE).getText().toString());assertNotNull(find(d.getWindow().getDecorView(),"Notify about updates while the bot runs"));assertEquals("com.veilforge.realmagent.live",a.getPackageName());d.dismiss();}
 @Test public void updaterStagesInsideAppSandbox(){assertEquals(a.getFilesDir(),AppUpdater.disabled(a).getParentFile());}
}
