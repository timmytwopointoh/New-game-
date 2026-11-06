package com.peks.plunder.rebuilt;
import android.app.Activity;
import android.os.Bundle;
import android.view.View;
import android.graphics.Color;
import android.util.Log;
import android.webkit.*;
public final class MainActivity extends Activity {
 private WebView view;
 @Override public void onCreate(Bundle state){ super.onCreate(state);
 getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN|View.SYSTEM_UI_FLAG_HIDE_NAVIGATION|View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
 view=new WebView(this); view.setBackgroundColor(Color.rgb(7,30,40)); view.setOverScrollMode(View.OVER_SCROLL_NEVER);
 WebSettings s=view.getSettings(); s.setJavaScriptEnabled(true); s.setDomStorageEnabled(true); s.setAllowFileAccess(true); s.setAllowContentAccess(false); s.setAllowFileAccessFromFileURLs(false); s.setAllowUniversalAccessFromFileURLs(false);
 view.setWebChromeClient(new WebChromeClient(){ @Override public boolean onConsoleMessage(ConsoleMessage m){if(m.messageLevel()==ConsoleMessage.MessageLevel.ERROR)Log.e("PEKS_ENGINE",m.message()+" @"+m.lineNumber());return true;}});
 view.setWebViewClient(new WebViewClient());setContentView(view);view.loadUrl("file:///android_asset/index.html"); }
 @Override public void onBackPressed(){ if(view!=null)view.evaluateJavascript("window.PeksApp&&window.PeksApp.pause()",null);else super.onBackPressed(); }
 @Override public void onPause(){if(view!=null){view.evaluateJavascript("window.PeksApp&&window.PeksApp.save()",null);view.onPause();}super.onPause();}
 @Override public void onResume(){super.onResume();if(view!=null)view.onResume();}
 @Override public void onDestroy(){if(view!=null){view.destroy();view=null;}super.onDestroy();}
}
