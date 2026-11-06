package com.peks.plunder.rebuilt;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.graphics.Color;
import android.util.Log;
import android.view.View;
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

public final class MainActivity extends Activity {
  private static final String TAG="PEKS_ENGINE";
  private static final int EXPORT_DIAGNOSTICS=4129;
  private WebView game;
  private String pendingReport;
  private final Handler main=new Handler(Looper.getMainLooper());

  @Override public void onCreate(Bundle state) {
    super.onCreate(state);
    getWindow().getDecorView().setSystemUiVisibility(
       View.SYSTEM_UI_FLAG_FULLSCREEN|View.SYSTEM_UI_FLAG_HIDE_NAVIGATION|
       View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY|View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
    game=new WebView(this);
    game.setBackgroundColor(Color.rgb(7,30,40));
    game.setOverScrollMode(View.OVER_SCROLL_NEVER);
    game.setLongClickable(false);
    game.setOnLongClickListener(v -> true);
    WebSettings settings=game.getSettings();
    settings.setJavaScriptEnabled(true);
    settings.setDomStorageEnabled(true);
    settings.setAllowFileAccess(true);
    settings.setAllowContentAccess(false);
    settings.setAllowFileAccessFromFileURLs(false);
    settings.setAllowUniversalAccessFromFileURLs(false);
    settings.setMediaPlaybackRequiresUserGesture(true);
    game.setWebChromeClient(new WebChromeClient(){
      @Override public boolean onConsoleMessage(ConsoleMessage m){
        if(m.messageLevel()==ConsoleMessage.MessageLevel.ERROR) Log.e(TAG,m.message()+" @"+m.lineNumber());
        return true;
      }
    });
    game.setWebViewClient(new WebViewClient(){
      @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest req) {
        Uri uri=req.getUrl();
        return !("file".equals(uri.getScheme()) && uri.getPath()!=null && uri.getPath().startsWith("/android_asset/"));
      }
    });
    // The only exposed native feature is a user-initiated sanitized JSON export. External
    // URLs are blocked above; no networking or arbitrary filesystem access is enabled.
    game.addJavascriptInterface(new Object(){
      @JavascriptInterface public void exportDiagnostics(String json){
        if(json==null || json.length()>131072)return;
        main.post(()->beginReportExport(json));
      }
    },"PeksNative");
    setContentView(game);
    game.loadUrl("file:///android_asset/index.html");
  }
  private void beginReportExport(String json){
    pendingReport=json;
    try{
      Intent save=new Intent(Intent.ACTION_CREATE_DOCUMENT);
      save.addCategory(Intent.CATEGORY_OPENABLE);
      save.setType("application/json");
      save.putExtra(Intent.EXTRA_TITLE,"Peks-Plunder-DIAGNOSTICS.json");
      startActivityForResult(save,EXPORT_DIAGNOSTICS);
    }catch(Exception err){
      Log.e(TAG,"Report picker unavailable",err);
      Toast.makeText(this,"Could not open diagnostics save picker",Toast.LENGTH_SHORT).show();
    }
  }
  @Override protected void onActivityResult(int req,int result,Intent data){
    super.onActivityResult(req,result,data);
    if(req!=EXPORT_DIAGNOSTICS)return;
    if(result==RESULT_OK&&data!=null&&data.getData()!=null&&pendingReport!=null){
      try(OutputStream out=getContentResolver().openOutputStream(data.getData())){
        if(out==null)throw new IllegalStateException("No destination stream");
        out.write(pendingReport.getBytes(StandardCharsets.UTF_8));
        Toast.makeText(this,"Peks diagnostics saved",Toast.LENGTH_SHORT).show();
      }catch(Exception ex){
        Log.e(TAG,"Failed to write diagnostics",ex);
        Toast.makeText(this,"Could not save Peks diagnostics",Toast.LENGTH_SHORT).show();
      }
    }
    pendingReport=null;
  }
  @SuppressWarnings("deprecation")
  @Override public void onBackPressed(){
    if(game!=null)game.evaluateJavascript("window.PeksApp && window.PeksApp.pause()",null);
    else super.onBackPressed();
  }
  @Override protected void onPause(){
    if(game!=null){
      game.evaluateJavascript("window.PeksApp && window.PeksApp.save()",null);
      game.onPause();
    }
    super.onPause();
  }
  @Override protected void onResume(){super.onResume();if(game!=null)game.onResume();}
  @Override protected void onDestroy(){
    main.removeCallbacksAndMessages(null);
    if(game!=null){game.destroy();game=null;}
    super.onDestroy();
  }
}
