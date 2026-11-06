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
 @Test public void compactMainControlsFitPhoneAndLiveStatusIsVisible(){
   ViewGroup content=activity.findViewById(android.R.id.content);
   View root=content.getChildAt(0);
   for(int height:new int[]{640,440}){
     root.measure(View.MeasureSpec.makeMeasureSpec(360,View.MeasureSpec.EXACTLY),View.MeasureSpec.makeMeasureSpec(height,View.MeasureSpec.EXACTLY));
     root.layout(0,0,360,height);
     assertNotNull("Branded native splash displayed",find(root,"ROVEKIN"));
     assertNotNull("Real tap-anywhere onboarding prompt displayed",find(root,"TAP ANYWHERE TO BEGIN"));
     assertNull("The retired VEILFORGE title is not displayed",find(root,"VEILFORGE · REALM AI"));
   }
   activity.botField.setText("RealmBot");
   activity.ownerField.setText("RealmOwner");
   activity.serviceStarted=true;
   assertTrue("Tap on native splash starts real setup/connection",root.performClick());
   assertNotNull("Real retry action present on connection screen",find(root,"CONNECT / RETRY"));
   assertNotNull("Account can still be edited",find(root,"EDIT ACCOUNT"));
   assertNotNull("Real status text remains wired to existing controller",activity.connection);
   activity.showSettings();
   AlertDialog dialog=ShadowAlertDialog.getLatestAlertDialog();
   Shadows.shadowOf(android.os.Looper.getMainLooper()).idle();
   for(String label:new String[]{"Start bot","Microsoft sign-in code","Survival","Creative","Saved plans","Stop bot service"})
     assertNotNull("Legacy controller operation preserved: "+label,find(dialog.getWindow().getDecorView(),label));
   dialog.dismiss();
 }
 @Test public void nativeChatHasOnlyCutoffStartSendAndNoLegacyLabels()throws Exception{
   ViewGroup content=activity.findViewById(android.R.id.content);
   ViewGroup stage=(ViewGroup)content.getChildAt(0);
   activity.botField.setText("CompanionBot");
   activity.ownerField.setText("RealmOwner");
   activity.serviceStarted=true;
   assertTrue("Entering past the welcome prompt is a real native tap",stage.performClick());
   activity.apiConnected=true;
   activity.rovekin.onStatus(new JSONObject().put("spawned",true).put("authenticated",true).put("survival",new JSONObject().put("navigation",new JSONObject().put("mode","idle").put("state","idle"))),"In Realm");
   // The chat replaces splash and connecting children: there is ONE new chat root.
   assertEquals(1,stage.getChildCount());
   View chat=stage.getChildAt(0);
   assertNotNull(find(chat,"STOP"));
   View reconnect=find(chat,"↻");
   assertNotNull("Reconnect remains embedded in the top border",reconnect);
   assertTrue("Reconnect has a phone-accessible 48dp+ touch target",
      reconnect.getLayoutParams().width>=48);
   assertFalse("The chat page has no permanent purple particle overlay",
      hasDescendantOfType(chat,RovekinParticleVeil.class));
   assertNotNull(find(chat,"START"));
   assertNotNull(find(chat,"SEND"));
   assertNull(find(chat,"ALL COMMANDS"));
   assertNull(find(chat,"PLANS"));
   assertNull(find(chat,"UPDATES"));
   assertNull(find(chat,"DEVELOPER CONSOLE"));
   assertNull(find(chat,"0.44.5-rovekin-clean-follow-preview"));
   activity.bubble("VEILFORGE","I am following the trail.",false);
   assertNotNull(find(chat,"I am following the trail."));
   assertTrue("A new AI reply uses the animated, self-contained Nether halo",
       hasDescendantOfType(chat,RovekinNetherBubble.class));
   assertNull("Messages display content only, never VEILFORGE sender tags",find(chat,"VEILFORGE"));
 }
 boolean hasDescendantOfType(View parent,Class<?> clazz){
   if(clazz.isInstance(parent))return true;
   if(parent instanceof ViewGroup){ViewGroup g=(ViewGroup)parent;
     for(int i=0;i<g.getChildCount();i++)
       if(hasDescendantOfType(g.getChildAt(i),clazz))return true;}
   return false;
 }
 @Test public void popupValidationKeepsInvalidPlanOpen()throws Exception{JSONObject def=new JSONObject("{\"id\":\"walk\",\"label\":\"Walk\",\"fields\":[{\"id\":\"x\",\"label\":\"X\",\"type\":\"integer\",\"min\":-30000000,\"max\":30000000},{\"id\":\"y\",\"label\":\"Feet-level Y\",\"type\":\"integer\",\"min\":-64,\"max\":320},{\"id\":\"z\",\"label\":\"Z\",\"type\":\"integer\",\"min\":-30000000,\"max\":30000000}]}");activity.showCommandForm(def);AlertDialog dialog=ShadowAlertDialog.getLatestAlertDialog();Shadows.shadowOf(android.os.Looper.getMainLooper()).idle();assertTrue(dialog.isShowing());assertEquals("Save plan",dialog.getButton(AlertDialog.BUTTON_POSITIVE).getText());dialog.getButton(AlertDialog.BUTTON_POSITIVE).performClick();Shadows.shadowOf(android.os.Looper.getMainLooper()).idle();assertTrue("Invalid coordinates must not dismiss/save",dialog.isShowing());assertNotNull(find(dialog.getWindow().getDecorView(),"Enter X"));dialog.dismiss();}
 @Test public void everySharedCatalogFormOpensOnPhone()throws Exception{java.io.InputStream in=activity.getAssets().open("nodejs-project/src/survival/command-catalog.json");java.io.ByteArrayOutputStream out=new java.io.ByteArrayOutputStream();byte[] b=new byte[4096];int n;while((n=in.read(b))!=-1)out.write(b,0,n);in.close();JSONArray catalog=new JSONArray(out.toString("UTF-8"));activity.options=new JSONObject("{\"owners\":[\"Owner\"],\"players\":[\"Player\"],\"hotbar\":[{\"slot\":1,\"known\":true,\"name\":\"stone_pickaxe\",\"count\":1}],\"visible\":[]}");int forms=0;for(int i=0;i<catalog.length();i++){JSONObject def=catalog.getJSONObject(i);if(def.getJSONArray("fields").length()==0)continue;activity.showCommandForm(def);AlertDialog dialog=ShadowAlertDialog.getLatestAlertDialog();Shadows.shadowOf(android.os.Looper.getMainLooper()).idle();assertTrue(def.getString("id"),dialog.isShowing());assertNotNull(dialog.getButton(AlertDialog.BUTTON_POSITIVE));dialog.dismiss();forms++;}assertTrue(forms>=10);}
 void edits(View view,java.util.List<EditText> result){if(view instanceof EditText)result.add((EditText)view);if(view instanceof ViewGroup){ViewGroup g=(ViewGroup)view;for(int i=0;i<g.getChildCount();i++)edits(g.getChildAt(i),result);}}
 @Test public void executableWallFormRejectsOversizedHeightBeforeSending()throws Exception{java.io.InputStream in=activity.getAssets().open("nodejs-project/src/survival/command-catalog.json");java.io.ByteArrayOutputStream out=new java.io.ByteArrayOutputStream();byte[] data=new byte[4096];int n;while((n=in.read(data))!=-1)out.write(data,0,n);in.close();JSONArray all=new JSONArray(out.toString("UTF-8"));JSONObject wall=null;for(int i=0;i<all.length();i++)if(all.getJSONObject(i).getString("id").equals("build_wall"))wall=all.getJSONObject(i);assertNotNull(wall);activity.showCommandForm(wall);AlertDialog dialog=ShadowAlertDialog.getLatestAlertDialog();Shadows.shadowOf(android.os.Looper.getMainLooper()).idle();java.util.ArrayList<EditText> fields=new java.util.ArrayList<>();edits(dialog.getWindow().getDecorView(),fields);assertEquals(6,fields.size());String[] values={"dirt","2","33","2","64","0"};for(int i=0;i<values.length;i++)fields.get(i).setText(values[i]);dialog.getButton(AlertDialog.BUTTON_POSITIVE).performClick();Shadows.shadowOf(android.os.Looper.getMainLooper()).idle();assertTrue(dialog.isShowing());assertNotNull(find(dialog.getWindow().getDecorView(),"Height is outside the allowed range."));dialog.dismiss();}
}
