package com.veilforge.realmagent;
import android.app.AlertDialog;
import android.graphics.*;
import android.os.*;
import android.view.*;
import android.view.accessibility.AccessibilityNodeInfo;
import android.widget.*;
import java.io.*;
import java.util.*;
import org.json.*;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.Config;
import org.robolectric.annotation.GraphicsMode;
import org.robolectric.shadows.ShadowAlertDialog;
import static org.junit.Assert.*;
@RunWith(RobolectricTestRunner.class) @Config(sdk=28,qualifiers="w360dp-h640dp-mdpi") @GraphicsMode(GraphicsMode.Mode.NATIVE)
public class ConsoleMenuTest {
 ButtonActionsTest.TestActivity a;
 @Before public void create(){a=Robolectric.buildActivity(ButtonActionsTest.TestActivity.class).setup().get();a.onPause();a.token="";a.calls.clear();}
 @After public void destroy(){if(a.commandDeck!=null)a.commandDeck.dialog.dismiss();a.onDestroy();}
 View find(View v,String label){if(v instanceof TextView&&label.equals(((TextView)v).getText().toString()))return v;if(v instanceof ViewGroup)for(int i=0;i<((ViewGroup)v).getChildCount();i++){View r=find(((ViewGroup)v).getChildAt(i),label);if(r!=null)return r;}return null;}
 @Test public void fullCatalogCanBeBrowsedOfflineAndEveryCategoryRetainsItsCommands(){
  a.showJobs();assertTrue(a.commandDeck.dialog.isShowing());assertTrue(a.catalog.length()>=28);assertTrue(a.commandDeck.shown.size()<a.catalog.length());assertTrue(a.commandDeck.shown.size()>=5);Set<String> all=new HashSet<>();for(int category=1;category<=4;category++){a.commandDeck.rail.select(category);for(JSONObject d:a.commandDeck.shown){all.add(d.optString("id"));assertEquals(category,CommandDeck.category(d));}}a.commandDeck.rail.select(5);assertEquals(a.catalog.length(),a.commandDeck.shown.size());for(JSONObject d:a.commandDeck.shown)all.add(d.optString("id"));
  assertEquals(a.catalog.length(),all.size());assertTrue(a.calls.isEmpty());
 }
 @Test public void touchKeyboardAndAccessibilityOnlyBrowseNeverSaveOrActivate(){
  a.showJobs();CommandRail rail=a.commandDeck.rail;rail.layout(0,0,92,300);
  rail.dispatchTouchEvent(MotionEvent.obtain(0,0,MotionEvent.ACTION_DOWN,40,100,0));rail.dispatchTouchEvent(MotionEvent.obtain(0,1,MotionEvent.ACTION_MOVE,40,250,0));rail.dispatchTouchEvent(MotionEvent.obtain(0,2,MotionEvent.ACTION_UP,40,250,0));assertEquals(5,rail.index);
  rail.performAccessibilityAction(AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD,null);assertEquals(4,rail.index);rail.onKeyDown(KeyEvent.KEYCODE_DPAD_UP,new KeyEvent(KeyEvent.ACTION_DOWN,KeyEvent.KEYCODE_DPAD_UP));assertEquals(3,rail.index);
  assertTrue(rail.getContentDescription().toString().contains("Build"));assertTrue(a.calls.isEmpty());
 }
 @Test public void searchFiltersTheCompleteCatalogAndLabelsPreviewsAndUnfinishedPlacement(){
  a.showJobs();a.commandDeck.search.setText("wall");assertFalse(a.commandDeck.shown.isEmpty());Set<String> badges=new HashSet<>();for(JSONObject d:a.commandDeck.shown)badges.add(CommandDeck.badge(d));assertTrue(badges.contains("PREVIEW"));assertTrue(badges.contains("PLACEMENT · TEST"));assertTrue(a.calls.isEmpty());a.commandDeck.search.setText("ZZ_NO_COMMAND");assertTrue(a.commandDeck.shown.isEmpty());
 }
 @Test public void commandCardOpensValidatedFormAndStopStillUsesUrgentPath()throws Exception{
  a.showJobs();int at=-1;for(int i=0;i<a.commandDeck.shown.size();i++)if(a.commandDeck.shown.get(i).optString("id").equals("walk"))at=i;assertTrue(at>=0);a.commandDeck.list.performItemClick(null,at,at);Shadows.shadowOf(Looper.getMainLooper()).idle();AlertDialog form=ShadowAlertDialog.getLatestAlertDialog();assertTrue(form.isShowing());assertEquals("Save plan",form.getButton(AlertDialog.BUTTON_POSITIVE).getText().toString());assertTrue(a.calls.isEmpty());form.getButton(AlertDialog.BUTTON_POSITIVE).performClick();Shadows.shadowOf(Looper.getMainLooper()).idle();assertTrue(form.isShowing());assertTrue(a.calls.isEmpty());long epoch=a.commandEpoch;a.expect();form.getButton(AlertDialog.BUTTON_NEUTRAL).performClick();Shadows.shadowOf(Looper.getMainLooper()).idle();a.await();assertTrue(a.commandEpoch>epoch);assertTrue(a.last().path.startsWith("/stop?epoch="));
 }
 @Test public void settingsKeepsAccountControlsAndReportsWithoutAPaidKnowledgeMenu(){
  a.showSettings();AlertDialog settings=ShadowAlertDialog.getLatestAlertDialog();View v=settings.getWindow().getDecorView();for(String s:new String[]{"Start bot","Microsoft sign-in code","Survival","Creative","Saved plans","Export ALL diagnostics — ONE ZIP","Updates","STOP"})assertNotNull(s,find(v,s));assertNull(find(v,"Google AI research / Internet lookup"));settings.dismiss();
 }
 @Test public void renderMainCommandRailAndSettingsAtPhoneSize()throws Exception{
  View root=((ViewGroup)a.findViewById(android.R.id.content)).getChildAt(0);a.bubble("Progress","Open Commands to prepare your next task.",false);render(root,360,640,"main");a.showJobs();View deck=a.commandDeck.dialog.getWindow().getDecorView();render(deck,360,525,"command-rail");assertTrue(a.commandDeck.rail.getHeight()>0);render(deck,360,360,"command-rail-keyboard");assertTrue(a.commandDeck.list.getHeight()>0);assertNotNull(find(deck,"STOP"));a.commandDeck.dialog.dismiss();a.showSettings();Shadows.shadowOf(Looper.getMainLooper()).idle();render(ShadowAlertDialog.getLatestAlertDialog().getWindow().getDecorView(),360,565,"settings");
 }
 void render(View v,int width,int height,String name)throws Exception{v.measure(View.MeasureSpec.makeMeasureSpec(width,View.MeasureSpec.EXACTLY),View.MeasureSpec.makeMeasureSpec(height,View.MeasureSpec.EXACTLY));v.layout(0,0,width,height);Bitmap bitmap=Bitmap.createBitmap(width,height,Bitmap.Config.ARGB_8888);v.draw(new Canvas(bitmap));File dir=new File(System.getProperty("java.io.tmpdir"),"realm-ai-ui-preview");assertTrue(dir.isDirectory()||dir.mkdirs());try(FileOutputStream out=new FileOutputStream(new File(dir,name+".png"))){assertTrue(bitmap.compress(Bitmap.CompressFormat.PNG,100,out));}bitmap.recycle();}
}
