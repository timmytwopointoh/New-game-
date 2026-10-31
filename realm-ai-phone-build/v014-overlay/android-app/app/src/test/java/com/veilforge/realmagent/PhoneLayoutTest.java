package com.veilforge.realmagent;
import android.app.AlertDialog;
import android.view.*;
import android.widget.*;
import org.json.*;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.Config;
import org.robolectric.shadows.ShadowAlertDialog;
import static org.junit.Assert.*;
@RunWith(RobolectricTestRunner.class)
@Config(sdk=28,qualifiers="w360dp-h640dp-mdpi")
public class PhoneLayoutTest {
 MainActivity activity;
 @Before public void create(){activity=Robolectric.buildActivity(MainActivity.class).setup().get();}
 @After public void destroy(){activity.onDestroy();}
 View find(View v,String text){if(v instanceof TextView&&((TextView)v).getText().toString().equals(text))return v;if(v instanceof ViewGroup){ViewGroup g=(ViewGroup)v;for(int i=0;i<g.getChildCount();i++){View found=find(g.getChildAt(i),text);if(found!=null)return found;}}return null;}
 @Test public void controlsFitSmallPhoneAndKeyboardResize(){ViewGroup content=activity.findViewById(android.R.id.content);View root=content.getChildAt(0);for(int height:new int[]{640,440}){root.measure(View.MeasureSpec.makeMeasureSpec(360,View.MeasureSpec.EXACTLY),View.MeasureSpec.makeMeasureSpec(height,View.MeasureSpec.EXACTLY));root.layout(0,0,360,height);for(String label:new String[]{"Commands","Plans (5)","STOP NOW","Stop bot service","Save"}){View button=find(root,label);assertNotNull(label,button);assertTrue(label,button.isShown());assertTrue(label+" must fit horizontally",button.getWidth()>0&&button.getWidth()<=360);assertTrue(label+" must be touchable",button.getHeight()>=48);}assertTrue(activity.input.getBottom()<=height);}}
 @Test public void popupValidationKeepsInvalidPlanOpen()throws Exception{JSONObject def=new JSONObject("{\"id\":\"walk\",\"label\":\"Walk\",\"fields\":[{\"id\":\"x\",\"label\":\"X\",\"type\":\"integer\",\"min\":-30000000,\"max\":30000000},{\"id\":\"y\",\"label\":\"Feet-level Y\",\"type\":\"integer\",\"min\":-64,\"max\":320},{\"id\":\"z\",\"label\":\"Z\",\"type\":\"integer\",\"min\":-30000000,\"max\":30000000}]}");activity.showCommandForm(def);AlertDialog dialog=ShadowAlertDialog.getLatestAlertDialog();Shadows.shadowOf(android.os.Looper.getMainLooper()).idle();assertTrue(dialog.isShowing());assertEquals("Save plan",dialog.getButton(AlertDialog.BUTTON_POSITIVE).getText());dialog.getButton(AlertDialog.BUTTON_POSITIVE).performClick();Shadows.shadowOf(android.os.Looper.getMainLooper()).idle();assertTrue("Invalid coordinates must not dismiss/save",dialog.isShowing());assertNotNull(find(dialog.getWindow().getDecorView(),"Enter X"));dialog.dismiss();}
 @Test public void everySharedCatalogFormOpensOnPhone()throws Exception{java.io.InputStream in=activity.getAssets().open("nodejs-project/src/survival/command-catalog.json");java.io.ByteArrayOutputStream out=new java.io.ByteArrayOutputStream();byte[] b=new byte[4096];int n;while((n=in.read(b))!=-1)out.write(b,0,n);in.close();JSONArray catalog=new JSONArray(out.toString("UTF-8"));activity.options=new JSONObject("{\"owners\":[\"Owner\"],\"players\":[\"Player\"],\"hotbar\":[{\"slot\":1,\"known\":true,\"name\":\"stone_pickaxe\",\"count\":1}],\"visible\":[]}");int forms=0;for(int i=0;i<catalog.length();i++){JSONObject def=catalog.getJSONObject(i);if(def.getJSONArray("fields").length()==0)continue;activity.showCommandForm(def);AlertDialog dialog=ShadowAlertDialog.getLatestAlertDialog();Shadows.shadowOf(android.os.Looper.getMainLooper()).idle();assertTrue(def.getString("id"),dialog.isShowing());assertNotNull(dialog.getButton(AlertDialog.BUTTON_POSITIVE));dialog.dismiss();forms++;}assertTrue(forms>=10);}
}
