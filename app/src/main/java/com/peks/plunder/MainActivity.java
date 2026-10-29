package com.peks.plunder;

import android.app.Activity;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.graphics.Color;
import android.util.Log;
import android.view.View;
import android.webkit.ConsoleMessage;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public final class MainActivity extends Activity {
 private static final String TAG="PEKS_AUDIT";
 private WebView game;
 private final Handler handler = new Handler(Looper.getMainLooper());

 @Override public void onCreate(Bundle state) {
  super.onCreate(state);
  getWindow().getDecorView().setSystemUiVisibility(
     View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION |
     View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION |
     View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
  game=new WebView(this);
  game.setBackgroundColor(Color.rgb(14,48,59));
  game.setOverScrollMode(View.OVER_SCROLL_NEVER);
  game.setLongClickable(false);
  game.setOnLongClickListener(v -> true);
  game.setHapticFeedbackEnabled(false);
  WebSettings s=game.getSettings();
  s.setJavaScriptEnabled(true);
  s.setDomStorageEnabled(true);
  s.setAllowFileAccess(true);
  s.setAllowContentAccess(false);
  s.setAllowFileAccessFromFileURLs(false);
  s.setAllowUniversalAccessFromFileURLs(false);
  s.setMediaPlaybackRequiresUserGesture(false);
  game.setWebChromeClient(new WebChromeClient() {
   @Override public boolean onConsoleMessage(ConsoleMessage m) {
    if(m.messageLevel()==ConsoleMessage.MessageLevel.ERROR)
      Log.e(TAG,"JS_ERROR="+m.message()+" line "+m.lineNumber());
    return true;
   }
  });
  game.setWebViewClient(new WebViewClient() {
   @Override public void onPageFinished(WebView v,String url) {
    Log.i(TAG,"HTML_LOADED="+url);
    checkReady(0);checkReady(4000);checkReady(16000);checkReady(35000);
   }
   @Override public void onReceivedError(WebView v,WebResourceRequest req,WebResourceError err) {
    if(req.isForMainFrame())Log.e(TAG,"LOAD_ERROR="+err.getDescription());
   }
  });
  setContentView(game);
  game.loadUrl("file:///android_asset/index.html");
 }
 private void checkReady(long delay) {
  handler.postDelayed(()->{
   if(game==null)return;
   game.evaluateJavascript("(function(){var t=window.__coveTest;return t?JSON.stringify({ready:true,roles:t.roles.length,first:t.roles[0].id,last:t.roles[t.roles.length-1].id}):'NOT_READY'})()",
    v->Log.i(TAG,"UI_READY="+v));
  },delay);
 }
 @SuppressWarnings("deprecation")
 @Override public void onBackPressed() {
  if(game!=null)game.evaluateJavascript("(function(){if(window.__coveTest&&window.__coveTest.game){document.getElementById('menuBtn').click()}else if(window.__coveTest){window.__coveTest.openFront()}})()",null);
  else super.onBackPressed();
 }
 @Override protected void onPause() {
  if(game!=null){
   game.evaluateJavascript("(function(){var t=window.__coveTest;if(t&&t.game&&t.state==='playing'){t.saveShift();if(!t.game.paused)document.getElementById('pauseBtn').click()}})()",null);
   game.onPause();
  }
  super.onPause();
 }
 @Override protected void onResume() {super.onResume();if(game!=null)game.onResume();}
 @Override protected void onDestroy() {handler.removeCallbacksAndMessages(null);if(game!=null){game.destroy();game=null;}super.onDestroy();}
}
