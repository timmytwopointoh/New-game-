package com.peckscove.capers

import android.app.Activity
import android.os.Bundle
import android.graphics.Color
import android.view.View
import android.webkit.WebView
import android.webkit.WebViewClient
import android.content.pm.ActivityInfo

/** No internet/network permission required: all original assets are bundled locally. */
class MainActivity : Activity() {
    private lateinit var gameView: WebView
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
        window.decorView.systemUiVisibility = (View.SYSTEM_UI_FLAG_FULLSCREEN or
                View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or
                View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN)
        gameView = WebView(this)
        gameView.setBackgroundColor(Color.rgb(14, 48, 59))
        gameView.webViewClient = WebViewClient()
        gameView.settings.javaScriptEnabled = true
        gameView.settings.domStorageEnabled = true
        gameView.settings.allowFileAccess = true
        gameView.settings.mediaPlaybackRequiresUserGesture = false
        gameView.loadUrl("file:///android_asset/index.html")
        setContentView(gameView)
    }
    @Suppress("DEPRECATION")
    override fun onBackPressed() {
        gameView.evaluateJavascript("document.getElementById('menuBtn').click()", null)
    }
    override fun onDestroy() {
        gameView.destroy()
        super.onDestroy()
    }
}
