package com.sectoruprising.afterlight;

import android.app.Activity;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/** Offline-only game container: no network access or permissions. */
public final class MainActivity extends Activity {
    private WebView game;
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        immersive();
        game = new WebView(this);
        game.setBackgroundColor(0xFF04050A);
        game.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        game.setWebChromeClient(new WebChromeClient());
        game.setWebViewClient(new WebViewClient());
        WebSettings settings = game.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(false);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        setContentView(game);
        game.loadUrl("file:///android_asset/index.html");
    }
    private void immersive() {
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION |
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_LAYOUT_STABLE |
            View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
    }
    @Override public void onWindowFocusChanged(boolean focus) { super.onWindowFocusChanged(focus); if(focus) immersive(); }
    @Override public void onBackPressed() {
        if(game != null) game.evaluateJavascript("window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))",null);
        else super.onBackPressed();
    }
    @Override protected void onPause() {
        if(game!=null){game.evaluateJavascript("window.dispatchEvent(new KeyboardEvent('keydown',{key:'p'}))",null);game.onPause();}
        super.onPause();
    }
    @Override protected void onResume() { super.onResume(); if(game!=null)game.onResume(); immersive(); }
    @Override protected void onDestroy() { if(game!=null){game.destroy();game=null;} super.onDestroy(); }
}
