package com.veilforge.realmagent;

import android.app.AlertDialog;
import android.view.View;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;

/**
 * Android-only drop-in adapter for the original MainActivity. No duplicated
 * controller, HTTP endpoints, Microsoft auth, Realm logic, or plan execution.
 * Copy into the ORIGINAL app package during a reviewed integration.
 *
 * Caller must supply identity proof obtained from a trusted authorization
 * service. Never construct proof from text typed into ownerTag or botTag.
 */
public final class RovekinMainActivityHost implements RovekinActionRouter.Host {
    private final MainActivity activity;
    private final RovekinFeatureContract.Authorization identity;

    public RovekinMainActivityHost(MainActivity activity,
                                   RovekinFeatureContract.Authorization verifiedIdentity) {
        if (activity == null) throw new IllegalArgumentException("activity");
        this.activity = activity;
        this.identity = verifiedIdentity;
    }

    private boolean isOwner() {
        return identity != null && identity.hasVerifiedOwner();
    }
    private boolean isDeveloper() {
        return isOwner() && identity.hasVerifiedDeveloperEntitlement();
    }

    @Override public void sendChat(String text) { activity.send(text); }
    @Override public void openCommandCatalog() { activity.showJobs(); }
    @Override public void openSavedPlans() { activity.showPlans(); }
    @Override public void activateQueue() { activity.activateQueuedPlans(); }
    @Override public void stopCurrentJob() { activity.stopNow(); }
    @Override public void startBotService() { activity.startOrRejoinBot(); }
    @Override public void reconnectWithDiagnostics() { activity.saveDiagnosticsAndReconnect(); }
    @Override public void retryBlockedJob() { activity.retryBlocked(); }
    @Override public void openSignIn() { activity.showAuth(); }
    @Override public void openAppUpdates() { AppUpdater.show(activity); }
    @Override public void openLearning() { activity.showLearning(); }
    @Override public void openResearchPrompt() {
        EditText query = activity.edit("What should the AI research?");
        LinearLayout panel = activity.vertical();
        panel.setPadding(activity.d(16),activity.d(12),activity.d(16),activity.d(8));
        panel.addView(query,activity.space(4));
        new AlertDialog.Builder(activity).setTitle("Ask Rovekin to research")
            .setView(panel)
            .setPositiveButton("Ask",(dialog,which)->{
                String text=query.getText().toString().trim();
                if(!text.isEmpty()) activity.send("Research "+text);
            }).setNegativeButton("Cancel",null).show();
    }
    @Override public void stopBotService() {
        if (isOwner()) activity.stopServiceNow();
    }
    @Override public void exportDiagnostics() {
        if (isDeveloper()) activity.exportBugReport();
    }
    @Override public void showStatus() {
        String status = activity.connection == null ? "Status pending"
            : activity.connection.getText().toString();
        new AlertDialog.Builder(activity)
            .setTitle("Rovekin status")
            .setMessage(status)
            .setPositiveButton("OK", null).show();
    }

    /**
     * This deliberately does NOT call the old showSettings(), which combines
     * normal account fields with developer diagnostics and tools.
     */
    @Override public void openSafeOwnerSettings() {
        if (!isOwner()) return;
        if (activity.serviceStarted) {
            new AlertDialog.Builder(activity).setTitle("Companion account")
                .setMessage("Stop the bot service before changing the AI identity, Realm or owner. " +
                    "Your current Microsoft login and saved data will be kept.")
                .setPositiveButton("OK", null).show();
            return;
        }
        LinearLayout panel = activity.vertical();
        panel.setPadding(activity.d(16),activity.d(14),activity.d(16),activity.d(10));
        panel.setBackground(activity.shape(activity.BASE));
        TextView intro = activity.txt(
            "Account and Realm configuration only. Developer diagnostics are not part of this screen.",
            14, activity.WHITE);
        panel.addView(intro,activity.space(4));
        EditText bot = activity.edit("AI account gamertag");
        EditText inviter = activity.edit("Owner/inviter gamertag");
        EditText realm = activity.edit("Invited Realm name (optional)");
        bot.setText(activity.botField.getText());
        inviter.setText(activity.ownerField.getText());
        realm.setText(activity.realmField.getText());
        panel.addView(bot,activity.space(13));
        panel.addView(inviter,activity.space(9));
        panel.addView(realm,activity.space(9));
        TextView error = activity.txt("",13,0xffffa6ab);
        panel.addView(error,activity.space(8));
        LinearLayout modes = new LinearLayout(activity);
        modes.addView(activity.button("Survival", ()->activity.modeAction("survival")),
            new LinearLayout.LayoutParams(0,activity.d(48),1));
        modes.addView(activity.button("Creative", ()->activity.modeAction("creative")),
            new LinearLayout.LayoutParams(0,activity.d(48),1));
        panel.addView(modes,activity.space(11));
        AlertDialog dialog = new AlertDialog.Builder(activity)
            .setTitle("Owner controls")
            .setView(panel)
            .setPositiveButton("Save",null)
            .setNegativeButton("Close",null)
            .create();
        dialog.setOnShowListener(unused ->
            dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v -> {
                if (!isOwner() || activity.serviceStarted) {
                    error.setText("Owner verification or stopped-service requirement not met.");
                    return;
                }
                String b=bot.getText().toString().trim();
                String o=inviter.getText().toString().trim();
                String r=realm.getText().toString().trim();
                if (b.length()<2 || b.length()>60 || o.length()<2 || o.length()>60 ||
                    b.equalsIgnoreCase(o) || r.length()>100) {
                    error.setText("Enter two distinct valid gamertags (2–60 chars), and a Realm name under 100 chars.");
                    return;
                }
                activity.botField.setText(b);
                activity.ownerField.setText(o);
                activity.realmField.setText(r);
                activity.saveAccountSettings();
                dialog.dismiss();
            }));
        dialog.show();
    }

    @Override public void openDeveloperConsole() {
        // Never expose the legacy mixed settings dialog to ordinary users.
        if (isDeveloper()) activity.showSettings();
    }
}
