package com.veilforge.realmagent;
import android.content.*;
import android.content.pm.PackageInstaller;
import android.widget.Toast;
/** Explicit, non-exported receiver; only the installer PendingIntent grants access. */
public final class UpdateInstallerReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context c,Intent result){
        int status=result.getIntExtra(PackageInstaller.EXTRA_STATUS,PackageInstaller.STATUS_FAILURE);
        if(status==PackageInstaller.STATUS_PENDING_USER_ACTION){
            Intent confirm=result.getParcelableExtra(Intent.EXTRA_INTENT);
            if(confirm!=null)try{confirm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);c.startActivity(confirm);}catch(Exception e){Toast.makeText(c,"Open Android's installer notification to continue.",Toast.LENGTH_LONG).show();}
        }else if(status==PackageInstaller.STATUS_SUCCESS){Toast.makeText(c,"Companion updated. Open it and start the bot when ready.",Toast.LENGTH_LONG).show();}
        else Toast.makeText(c,"Update was cancelled or could not be installed. Current app remains installed.",Toast.LENGTH_LONG).show();
    }
}
