package com.veilforge.realmagent;

import android.content.pm.ApplicationInfo;

/**
 * Local/internal QA access only. NEVER deploy a debuggable APK to public users.
 * A verified owner/developer account proof is still required for the eventual
 * non-debug production entitlement. This class deliberately fails closed for
 * all release (non-debuggable) builds.
 *
 * Android's debug flag is a TEST BUILD distinction, not account authentication.
 * The PC test process must not publish a signed debug package as public release.
 */
public final class RovekinInternalAccess {
    private RovekinInternalAccess() {}
    public static RovekinFeatureContract.Authorization internalDebugBuildOnly(MainActivity a) {
        if(a==null || (a.getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE)==0)
            return null;
        return new RovekinFeatureContract.Authorization() {
            @Override public boolean hasVerifiedOwner() {return true;}
            @Override public boolean hasVerifiedDeveloperEntitlement() {return true;}
        };
    }
}
