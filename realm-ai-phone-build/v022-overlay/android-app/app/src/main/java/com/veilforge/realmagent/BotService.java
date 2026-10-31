package com.veilforge.realmagent;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.res.AssetManager;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.os.Process;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.IOException;

/** Runs the Minecraft bot ON the phone, in an isolated app process. Not a PC bridge. */
public final class BotService extends Service {
    public static final String CHANNEL = "veilforge_realm_player";
    private volatile boolean launched = false;
    private native int startNodeWithArguments(String[] args);
    @Override public IBinder onBind(Intent intent) { return null; }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && "STOP".equals(intent.getAction())) {
            // node::Start is not safe to start twice in one process: stop the *isolated* :agent process.
            stopForeground(true); stopSelf(); Process.killProcess(Process.myPid());
            return START_NOT_STICKY;
        }
        NotificationManager nm = getSystemService(NotificationManager.class);
        nm.createNotificationChannel(new NotificationChannel(CHANNEL, "VEILFORGE Realm Player", NotificationManager.IMPORTANCE_LOW));
        Intent stop = new Intent(this, BotService.class).setAction("STOP");
        PendingIntent stopIntent = PendingIntent.getService(this, 2, stop, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Notification note = new Notification.Builder(this, CHANNEL)
            .setContentTitle("VEILFORGE Minecraft AI")
            .setContentText("On-device Bedrock Realm companion is starting")
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setOngoing(true).addAction(android.R.drawable.ic_menu_close_clear_cancel, "Stop bot", stopIntent)
            .build();
        if (Build.VERSION.SDK_INT >= 34) startForeground(42, note, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        else startForeground(42, note);
        if (!launched) {
            launched = true;
            new Thread(() -> {
                try {
                    File root = new File(getFilesDir(), "nodejs-project");
                    // Refresh bundled code once per installed APK version.
                    // Config, Xbox session and Realm packs are not part of the bundled asset tree.
                    int code = getPackageManager().getPackageInfo(getPackageName(),0).versionCode;
                    android.content.SharedPreferences prefs = getSharedPreferences("veilforge-runtime",MODE_PRIVATE);
                    boolean refresh = prefs.getInt("asset_bundle_version",-1) != code;
                    copyAssetTree(getAssets(), "nodejs-project", root, refresh);
                    if(refresh) prefs.edit().putInt("asset_bundle_version",code).commit();
                    File entry = new File(root, "src/mobile.js");
                    if (!entry.isFile()) throw new IOException("Embedded bot entry is missing");
                    // This function blocks on Node's event loop. Never run on Android's UI thread.
                    System.loadLibrary("node");
                    System.loadLibrary("veilforge_bridge");
                    int exit = startNodeWithArguments(new String[]{"node", entry.getAbsolutePath()});
                    writeState("Node stopped (code " + exit + ")");
                } catch (Throwable error) {
                    writeState("On-device bot could not start: " + error.getClass().getSimpleName() + " (check runtime and dependencies)");
                } finally { stopSelf(); }
            }, "veilforge-node-thread").start();
        }
        return START_NOT_STICKY;
    }
    private void writeState(String message) {
        try (FileOutputStream out = new FileOutputStream(new File(getFilesDir(), "boot-status.txt"))) {
            out.write(message.getBytes(java.nio.charset.StandardCharsets.UTF_8));
        } catch (Exception ignored) {}
    }
    private static void copyAssetTree(AssetManager assets, String assetPath, File dest, boolean refresh) throws IOException {
        String[] entries = assets.list(assetPath);
        if (entries == null) throw new IOException("Assets unavailable");
        if (entries.length == 0) {
            // Asset paths with no entries may be files; do not overwrite cached Xbox auth or local config.
            if (dest.exists() && !refresh) return;
            File parent = dest.getParentFile();
            if (parent == null || (!parent.exists() && !parent.mkdirs())) throw new IOException("Cannot create app storage");
            try (InputStream in = assets.open(assetPath); FileOutputStream out = new FileOutputStream(dest)) {
                byte[] buffer = new byte[8192]; int n;
                while ((n = in.read(buffer)) != -1) out.write(buffer, 0, n);
            }
        } else {
            if (!dest.exists() && !dest.mkdirs()) throw new IOException("Cannot create app storage");
            for (String name: entries) copyAssetTree(assets, assetPath + "/" + name, new File(dest, name), refresh);
        }
    }
}
