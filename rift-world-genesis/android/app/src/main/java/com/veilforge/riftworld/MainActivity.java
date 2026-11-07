package com.veilforge.riftworld;

import android.app.Activity;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public final class MainActivity extends Activity {
    private WebView world;
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_FULLSCREEN |
            View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN |
            View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
        world = new WebView(this);
        world.setBackgroundColor(0xff050b1b);
        world.setOverScrollMode(View.OVER_SCROLL_NEVER);
        WebSettings s = world.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(false);
        s.setDatabaseEnabled(false);
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);
        s.setMediaPlaybackRequiresUserGesture(false);
        world.setWebChromeClient(new WebChromeClient());
        world.setWebViewClient(new WebViewClient());
        setContentView(world);
        world.loadUrl("file:///android_asset/index.html");
    }
    @Override protected void onPause() { if (world != null) world.onPause(); super.onPause(); }
    @Override protected void onResume() { super.onResume(); if (world != null) world.onResume(); }
    @Override public void onBackPressed() { if(world!=null) world.evaluateJavascript("window.RiftGame&&RiftGame.back()",null); }
    @Override protected void onDestroy() { if(world!=null){world.destroy();world=null;} super.onDestroy(); }
}
