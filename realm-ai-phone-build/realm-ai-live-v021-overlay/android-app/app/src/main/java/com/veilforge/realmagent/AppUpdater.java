package com.veilforge.realmagent;

import android.app.*;
import android.content.*;
import android.content.pm.*;
import android.os.*;
import android.provider.Settings;
import android.net.Uri;
import android.widget.*;
import java.io.*;
import java.net.*;
import java.security.*;
import java.util.Arrays;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;
import javax.net.ssl.HttpsURLConnection;

/** Downloads on a dedicated worker; never uses the bot's API/command executor. */
public final class AppUpdater {
    static final String FEED="https://raw.githubusercontent.com/timmytwopointoh/New-game-/realm-live-update-channel/release.json";
    private static final ExecutorService worker=Executors.newSingleThreadExecutor();
    private static final AtomicBoolean busy=new AtomicBoolean();
    private static ScheduledExecutorService monitor;
    static File disabled(Context c){return new File(c.getFilesDir(),"disable-update-checks");}
    static byte[] certificate(Context c) throws Exception {
        PackageInfo p=c.getPackageManager().getPackageInfo(c.getPackageName(),PackageManager.GET_SIGNING_CERTIFICATES);
        if(p.signingInfo==null || p.signingInfo.hasMultipleSigners())throw new SecurityException("One application signer required");
        return p.signingInfo.getApkContentsSigners()[0].toByteArray();
    }
    static ReleaseManifest check(Context c) throws Exception {
        SupportLog.record(c,"update_check");byte[] bytes=read(FEED,65536,null,null);
        return ReleaseManifest.verify(new String(bytes,java.nio.charset.StandardCharsets.UTF_8),certificate(c),c.getPackageName(),
            c.getPackageManager().getPackageInfo(c.getPackageName(),0).getLongVersionCode(),System.currentTimeMillis());
    }
    static synchronized void startMonitor(Context context){
        if(monitor!=null)return;final Context c=context.getApplicationContext();
        monitor=Executors.newSingleThreadScheduledExecutor();
        monitor.scheduleWithFixedDelay(()->{
            if(disabled(c).exists())return;
            try {
                ReleaseManifest r=check(c);SupportLog.record(c,"update_available");
                android.content.SharedPreferences p=c.getSharedPreferences("release-notifications",Context.MODE_PRIVATE);
                if(p.getLong("notified",0)>=r.version)return;
                NotificationManager nm=c.getSystemService(NotificationManager.class);
                nm.createNotificationChannel(new NotificationChannel("realm-updates","Companion updates",NotificationManager.IMPORTANCE_DEFAULT));
                Intent open=new Intent(c,MainActivity.class).putExtra("showUpdates",true);
                PendingIntent pi=PendingIntent.getActivity(c,91,open,PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
                if(Build.VERSION.SDK_INT<33 || c.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)==PackageManager.PERMISSION_GRANTED){
                    nm.notify(91,new Notification.Builder(c,"realm-updates").setSmallIcon(android.R.drawable.stat_sys_download_done)
                        .setContentTitle("Realm AI update available").setContentText("Tap to review. The bot can keep running while it downloads.")
                        .setContentIntent(pi).setAutoCancel(true).build());
                    p.edit().putLong("notified",r.version).apply();
                }
            }catch(ReleaseManifest.NoUpdateException current){SupportLog.record(c,"update_current");}catch(Exception ignored){SupportLog.record(c,"update_unavailable");}
        },30,900,TimeUnit.SECONDS);
    }
    static synchronized void stopMonitor(){if(monitor!=null){monitor.shutdownNow();monitor=null;}}
    static void message(Activity a,String title,String text){if(!a.isFinishing()&&!a.isDestroyed())new AlertDialog.Builder(a).setTitle(title).setMessage(text).setPositiveButton("Close",null).show();}
    public static void show(Activity a){
        LinearLayout box=new LinearLayout(a);box.setOrientation(LinearLayout.VERTICAL);box.setPadding(24,12,24,12);
        CheckBox automatic=new CheckBox(a);automatic.setText("Notify about updates while the bot runs");automatic.setChecked(!disabled(a).exists());box.addView(automatic);
        automatic.setOnCheckedChangeListener((v,on)->{try{if(on){if(disabled(a).exists()&&!disabled(a).delete())throw new IOException();}else try(FileOutputStream f=new FileOutputStream(disabled(a))){} }catch(Exception e){message(a,"Settings unavailable","Could not save update preference.");}});
        if(Build.VERSION.SDK_INT>=33 && a.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)
            a.requestPermissions(new String[]{android.Manifest.permission.POST_NOTIFICATIONS},91);
        new AlertDialog.Builder(a).setTitle("Companion updates").setView(box)
            .setMessage("Checks and downloads leave the bot running. Installing an APK restarts the app and disconnects the bot. Your saved login and commands stay on this installation.")
            .setNeutralButton("Bug reports",(d,w)->{if(a instanceof MainActivity)((MainActivity)a).showBugReports();}).setPositiveButton("Check now",(d,w)->checkNow(a)).setNegativeButton("Close",null).show();
    }
    static void checkNow(Activity a){
        if(!busy.compareAndSet(false,true)){message(a,"Updates","An update operation is already running.");return;}
        Toast.makeText(a,"Checking for a signed update…",Toast.LENGTH_SHORT).show();
        worker.submit(()->{try{ReleaseManifest r=check(a);SupportLog.record(a,"update_available");a.runOnUiThread(()->{
            if(a.isFinishing()||a.isDestroyed())return;
            new AlertDialog.Builder(a).setTitle("Update "+r.version).setMessage(r.notes+"\n\nDownload now while the bot continues running?")
                .setPositiveButton("Download",(d,w)->download(a,r)).setNegativeButton("Later",null).show();
        });}catch(ReleaseManifest.NoUpdateException e){SupportLog.record(a,"update_current");a.runOnUiThread(()->message(a,"Updates","You have the current release."));}
        catch(FileNotFoundException e){SupportLog.record(a,"update_unavailable");a.runOnUiThread(()->message(a,"Updates","No release has been published to this update channel yet."));}
        catch(Exception e){SupportLog.record(a,"update_unavailable");a.runOnUiThread(()->message(a,"Update unavailable","Could not obtain a trusted update. Check your connection and device date. The current app is unchanged."));}
        finally{busy.set(false);}});
    }
    static void download(Activity a,ReleaseManifest r){
        if(!busy.compareAndSet(false,true))return;
        SupportLog.record(a,"update_download");Toast.makeText(a,"Downloading update; bot stays running…",Toast.LENGTH_LONG).show();
        worker.submit(()->{
            File file;
            try{file=File.createTempFile("companion-update-",".apk",a.getCacheDir());}catch(IOException e){busy.set(false);a.runOnUiThread(()->message(a,"Download unavailable","Could not create private update staging."));return;}
            try{
                MessageDigest digest=MessageDigest.getInstance("SHA-256");read(r.url,r.size,file,digest);
                if(file.length()!=r.size || !hex(digest.digest()).equals(r.sha256))throw new SecurityException("Download integrity check failed");
                verifyApk(a,file,r);SupportLog.record(a,"update_verified");
                a.runOnUiThread(()->{
                    if(a.isFinishing()||a.isDestroyed()){file.delete();return;}
                    new AlertDialog.Builder(a).setTitle("Update verified")
                        .setMessage("The bot is still running. Installing now will restart the app and disconnect it. Saved login and commands will be kept. Start the bot again after installation.")
                        .setPositiveButton("Install update",(d,w)->install(a,file,r))
                        .setNegativeButton("Later",(d,w)->file.delete()).setOnCancelListener(d->file.delete()).show();
                });
            }catch(Exception e){SupportLog.record(a,"update_rejected");file.delete();a.runOnUiThread(()->message(a,"Download rejected","The update could not be verified. Your current app and bot are unchanged."));}
            finally{busy.set(false);}
        });
    }
    static void verifyApk(Context c,File file,ReleaseManifest r)throws Exception{
        PackageInfo p=c.getPackageManager().getPackageArchiveInfo(file.getAbsolutePath(),PackageManager.GET_SIGNING_CERTIFICATES);
        if(p==null || !c.getPackageName().equals(p.packageName) || p.getLongVersionCode()!=r.version || p.signingInfo==null ||
            p.signingInfo.hasMultipleSigners() || !Arrays.equals(certificate(c),p.signingInfo.getApkContentsSigners()[0].toByteArray()))
            throw new SecurityException("APK identity/signer mismatch");
    }
    static void install(Activity a,File file,ReleaseManifest r){
        if(!a.getPackageManager().canRequestPackageInstalls()){
            SupportLog.record(a,"update_permission");
            message(a,"Allow companion updates","Enable ‘Allow from this source’ for this companion, then return to Updates and download again. Android will still ask before installation.");
            a.startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,Uri.parse("package:"+a.getPackageName())));file.delete();return;
        }
        if(!busy.compareAndSet(false,true))return;
        worker.submit(()->{
            PackageInstaller installer=a.getPackageManager().getPackageInstaller();int id=-1;
            try{
                verifyApk(a,file,r);
                PackageInstaller.SessionParams params=new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
                params.setAppPackageName(a.getPackageName());params.setSize(file.length());
                if(Build.VERSION.SDK_INT>=31)params.setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_REQUIRED);
                id=installer.createSession(params);
                try(PackageInstaller.Session session=installer.openSession(id)){
                    try(InputStream in=new FileInputStream(file);OutputStream out=session.openWrite("base.apk",0,file.length())){
                        byte[] b=new byte[65536];int n;while((n=in.read(b))!=-1)out.write(b,0,n);session.fsync(out);
                    }
                    Intent result=new Intent(a,UpdateInstallerReceiver.class);
                    PendingIntent pi=PendingIntent.getBroadcast(a,id,result,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_MUTABLE);
                    SupportLog.record(a,"update_install");session.commit(pi.getIntentSender());
                }
            }catch(Exception e){SupportLog.record(a,"update_install_failed");if(id!=-1)try{installer.abandonSession(id);}catch(Exception ignored){} a.runOnUiThread(()->message(a,"Installation unavailable","Android could not start the update. The current app remains installed."));}
            finally{file.delete();busy.set(false);}
        });
    }
    static String hex(byte[] bytes){StringBuilder s=new StringBuilder();for(byte b:bytes)s.append(String.format(java.util.Locale.ROOT,"%02x",b&255));return s.toString();}
    static byte[] read(String value,long limit,File destination,MessageDigest digest)throws Exception{
        URL url=new URL(value);HttpsURLConnection con=null;long deadline=SystemClock.elapsedRealtime()+180000;
        try{
            for(int redirects=0;;redirects++){
                if(!url.getProtocol().equals("https")||url.getUserInfo()!=null)throw new SecurityException("HTTPS required");
                String host=url.getHost();boolean feed=value.equals(FEED);
                if(feed?!url.toString().equals(FEED):!(host.equals("github.com")||host.equals("release-assets.githubusercontent.com")))throw new SecurityException("Unexpected redirect host");
                con=(HttpsURLConnection)url.openConnection();con.setInstanceFollowRedirects(false);con.setConnectTimeout(15000);con.setReadTimeout(20000);con.setRequestProperty("Accept-Encoding","identity");
                int status=con.getResponseCode();
                if(status>=300&&status<=399){if(feed||redirects>=3)throw new SecurityException("Redirect rejected");String location=con.getHeaderField("Location");if(location==null)throw new IOException();URL next=new URL(url,location);con.disconnect();url=next;continue;}
                if(status==404)throw new FileNotFoundException();if(status!=200)throw new IOException("Release server unavailable");break;
            }
            if(con.getContentLengthLong()>limit)throw new IOException("Oversized release");
            ByteArrayOutputStream memory=destination==null?new ByteArrayOutputStream():null;
            try(InputStream in=con.getInputStream();OutputStream out=destination==null?memory:new FileOutputStream(destination)){
                byte[] b=new byte[65536];int n;long count=0;
                while((n=in.read(b))!=-1){if(Thread.currentThread().isInterrupted()||SystemClock.elapsedRealtime()>deadline)throw new IOException("Download interrupted");count+=n;if(count>limit)throw new IOException("Oversized release");out.write(b,0,n);if(digest!=null)digest.update(b,0,n);}
            }
            return memory==null?new byte[0]:memory.toByteArray();
        }finally{if(con!=null)con.disconnect();}
    }
}
