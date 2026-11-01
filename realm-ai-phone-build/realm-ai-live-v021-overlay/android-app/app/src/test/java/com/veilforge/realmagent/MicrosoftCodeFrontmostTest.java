package com.veilforge.realmagent;

import android.app.AlertDialog;
import android.content.ClipboardManager;
import android.content.Intent;
import android.os.Looper;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;
import org.json.JSONObject;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.Config;
import org.robolectric.shadows.ShadowAlertDialog;
import static org.junit.Assert.*;

/** Regression: Microsoft code must never be hidden by Settings. */
@RunWith(RobolectricTestRunner.class)
@Config(sdk=28,qualifiers="w360dp-h640dp-mdpi")
public class MicrosoftCodeFrontmostTest {
  public static class LoginActivity extends ButtonActionsTest.TestActivity {
    @Override protected JSONObject request(String method,String path,JSONObject body)throws Exception {
      if(path.startsWith("/updates")){
        calls.add(new ButtonActionsTest.Call(method,path,body));latch.countDown();
        return new JSONObject("{\"authState\":\"sign-in-required\",\"lastError\":\"\",\"authChallenge\":{\"userCode\":\"NEW123\"},\"updates\":[]}");
      }
      return super.request(method,path,body);
    }
  }
  LoginActivity a;
  @Before public void setup(){a=Robolectric.buildActivity(LoginActivity.class).setup().get();a.onPause();a.token="a".repeat(64);a.serviceStarted=true;}
  @After public void cleanup(){if(a.settingsDialog!=null)a.settingsDialog.dismiss();a.onDestroy();}
  View find(View view,String label){
    if(view instanceof TextView && label.equals(((TextView)view).getText().toString()))return view;
    if(view instanceof ViewGroup){ViewGroup g=(ViewGroup)view;for(int i=0;i<g.getChildCount();i++){View result=find(g.getChildAt(i),label);if(result!=null)return result;}}
    return null;
  }
  @Test public void automaticCodeDismissesSettingsAndOpensCodeAboveHome()throws Exception {
    a.showSettings();
    AlertDialog settings=ShadowAlertDialog.getLatestAlertDialog();
    assertTrue(settings.isShowing());
    a.expect();a.update();a.await();
    AlertDialog code=ShadowAlertDialog.getLatestAlertDialog();
    assertNotSame(settings,code);
    assertFalse("Settings must not hide the Microsoft code",settings.isShowing());
    assertTrue(code.isShowing());
    assertTrue(code.getMessage().toString().contains("NEW123"));
    assertEquals("NEW123",a.displayedAuthCode);
    assertEquals(View.VISIBLE,a.authCodeLabel.getVisibility());
    assertEquals(View.VISIBLE,a.copyAuthCode.getVisibility());
    code.getButton(AlertDialog.BUTTON_NEUTRAL).performClick();
    ClipboardManager clipboard=(ClipboardManager)a.getSystemService(android.content.Context.CLIPBOARD_SERVICE);
    assertEquals("NEW123",clipboard.getPrimaryClip().getItemAt(0).getText().toString());
    a.showAuth(new JSONObject("{\"authChallenge\":{\"userCode\":\"NEW123\"}}"));
    ShadowAlertDialog.getLatestAlertDialog().getButton(AlertDialog.BUTTON_POSITIVE).performClick();
    assertEquals(Intent.ACTION_VIEW,a.opened.get(0).getAction());
    assertEquals("https://www.microsoft.com/link",a.opened.get(0).getData().toString());
  }
  @Test public void settingsButtonOpensCodeDialogInFrontAndCanCopy()throws Exception{
    a.showSettings();
    AlertDialog settings=ShadowAlertDialog.getLatestAlertDialog();
    a.expect();
    find(settings.getWindow().getDecorView(),"Microsoft sign-in code").performClick();
    a.await();
    AlertDialog code=ShadowAlertDialog.getLatestAlertDialog();
    assertFalse(settings.isShowing());
    assertTrue(code.isShowing());
    assertEquals("ABC123",a.displayedAuthCode);
    code.getButton(AlertDialog.BUTTON_NEUTRAL).performClick();
    ClipboardManager clipboard=(ClipboardManager)a.getSystemService(android.content.Context.CLIPBOARD_SERVICE);
    assertEquals("ABC123",clipboard.getPrimaryClip().getItemAt(0).getText().toString());
  }
  @Test public void noCodeShowsVisibleExplanationInsteadOfHiddenChatBubble()throws Exception{
    a.showSettings();
    a.showAuth(new JSONObject("{}"));
    AlertDialog notice=ShadowAlertDialog.getLatestAlertDialog();
    assertTrue(notice.isShowing());
    assertTrue(notice.getMessage().toString().contains("No Microsoft sign-in code"));
    assertTrue(a.settingsDialog.isShowing());
  }
}
