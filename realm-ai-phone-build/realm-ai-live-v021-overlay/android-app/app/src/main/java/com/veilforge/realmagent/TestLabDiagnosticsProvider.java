package com.veilforge.realmagent;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.Binder;
import org.json.JSONObject;
import java.io.File;

/**
 * Opt-in, read-only PC test lab telemetry.
 *
 * Android's DUMP protected permission plus the shell-UID gate restrict queries
 * to the user's local ADB shell (or this app itself). No passwords, device
 * codes, config.json, packet payloads, account names, or signing material.
 * The data are the same allowlisted connection observations the app already
 * exports via SupportBundle; never return private file contents directly.
 *
 * ADB: adb shell content query --uri
 * content://com.veilforge.realmagent.live.testlab/connection
 */
public final class TestLabDiagnosticsProvider extends ContentProvider {
    private static final String AUTH = "com.veilforge.realmagent.live.testlab";
    private static final int ADB_SHELL_UID = 2000;
    private static final int ROOT_UID = 0;
    private static final String[] COLUMNS = {"sanitized_json"};
    @Override public boolean onCreate() { return true; }
    private void checkCaller() {
        int uid = Binder.getCallingUid();
        if (uid != ADB_SHELL_UID && uid != ROOT_UID &&
            (getContext() == null || uid != getContext().getApplicationInfo().uid)) {
            throw new SecurityException("Realm AI Test Lab: local ADB only");
        }
    }
    @Override public Cursor query(Uri uri, String[] projection, String selection,
                                 String[] selectionArgs, String sortOrder) {
        checkCaller();
        if (uri == null || !AUTH.equals(uri.getAuthority())) {
            throw new IllegalArgumentException("Unsupported test lab URI");
        }
        String path = uri.getPath();
        JSONObject value = new JSONObject();
        try {
            File root = getContext().getFilesDir();
            File diag = new File(root, "nodejs-project/private/diagnostics");
            if ("/connection".equals(path)) {
                JSONObject saved = ConnectionDiagnostics.read(new File(diag, "connection.json"));
                value = saved != null ? saved : ConnectionDiagnostics.sanitize(null);
            } else if ("/handshake".equals(path)) {
                value = HandshakeDiagnostics.read(new File(diag, "pack-handshake.json"));
            } else if ("/startup".equals(path)) {
                value = SupportBundle.startup(getContext());
            } else {
                throw new IllegalArgumentException("Only connection, handshake, startup");
            }
        } catch (Exception ignored) {
            // Return only a fixed error code, never the exception message.
            value = new JSONObject();
            try { value.put("schema", 1).put("status", "diagnostics-unavailable"); }
            catch (Exception ignored2) {}
        }
        MatrixCursor cursor = new MatrixCursor(COLUMNS, 1);
        // connection and handshake passed through their existing privacy
        // allowlists. Prevent accidental oversize shell results.
        String safe = value.toString();
        if (safe.length() > 16000) safe = "{\"schema\":1,\"status\":\"report-too-large\"}";
        cursor.addRow(new Object[]{safe});
        return cursor;
    }
    @Override public String getType(Uri uri) {
        return "vnd.android.cursor.item/vnd.veilforge.realmtestlab.safe";
    }
    @Override public Uri insert(Uri uri, ContentValues values) {
        throw new UnsupportedOperationException("Test Lab is read only");
    }
    @Override public int update(Uri uri, ContentValues values, String selection, String[] args) {
        throw new UnsupportedOperationException("Test Lab is read only");
    }
    @Override public int delete(Uri uri, String selection, String[] args) {
        throw new UnsupportedOperationException("Test Lab is read only");
    }
}
