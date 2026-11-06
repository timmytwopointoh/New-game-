package com.veilforge.realmagent;

import java.util.List;

/**
 * Single adapter into the existing Android/MainActivity controller. No new
 * networking, OAuth client, Realm handshake, plan engine or game logic.
 *
 * The present production app owns every method in this interface already,
 * or the method opens the existing full command catalog for newer skills.
 * The upcoming UI must call this router, never fork command execution.
 */
public final class RovekinActionRouter {
    public interface Host {
        void sendChat(String text);            // MainActivity.send(String)
        void openCommandCatalog();             // MainActivity.showJobs()
        void openSavedPlans();                 // MainActivity.showPlans()
        void activateQueue();                  // MainActivity.activateQueuedPlans()
        void stopCurrentJob();                 // MainActivity.stopNow()
        void retryBlockedJob();                // MainActivity.retryBlocked()
        void openSignIn();                     // MainActivity.showAuth()
        void openAppUpdates();                 // AppUpdater.show(activity)
        void openLearning();                   // MainActivity.showLearning()
        void openSafeOwnerSettings();          // New limited account/Realm dialog, NO developer tools
        void openDeveloperConsole();           // Existing MainActivity.showSettings(), ONLY dev role
        void stopBotService();                 // MainActivity.stopServiceNow()
        void exportDiagnostics();              // MainActivity.exportBugReport()
        void showStatus();                     // Real MainActivity.connection text
    }

    public enum Result { HANDLED, ACCESS_DENIED, NOT_READY, NOT_SUPPORTED }

    private final Host host;
    public RovekinActionRouter(Host host) {
        if (host == null) throw new IllegalArgumentException("host");
        this.host = host;
    }

    /**
     * Always evaluate against fresh VERIFIED identity and actual bot status,
     * not data from setup fields. The backend independently authorizes actions.
     */
    public Result dispatch(RovekinFeatureContract.Feature action,
                           RovekinFeatureContract.Authorization who,
                           RovekinFeatureContract.Runtime live,
                           List<RovekinFeatureContract.Skill> catalog,
                           String chatText) {
        RovekinFeatureContract.FeatureStatus status =
            RovekinFeatureContract.status(action, who, live, catalog);
        switch (status.state) {
            case REQUIRES_OWNER:
            case REQUIRES_DEVELOPER: return Result.ACCESS_DENIED;
            case NOT_SUPPORTED: return Result.NOT_SUPPORTED;
            case WAITING_FOR_REALM: return Result.NOT_READY;
            default: break;
        }
        switch (action) {
            case CHAT:
                if (chatText == null || chatText.trim().isEmpty()) return Result.NOT_READY;
                host.sendChat(chatText);
                return Result.HANDLED;
            case COMMAND_CATALOG:
            case FOLLOW:
            case GO_HOME:
            case EXPLORE:
            case BUILD:
            case MINE:
            case FARM:
            case CRAFT:
            case INVENTORY:
            case RESEARCH:
                // The real command catalog contains current/future descriptors.
                // The UI can filter them, but cannot independently execute them.
                host.openCommandCatalog();
                return Result.HANDLED;
            case SAVED_PLANS: host.openSavedPlans(); return Result.HANDLED;
            case ACTIVATE_QUEUE: host.activateQueue(); return Result.HANDLED;
            case EMERGENCY_STOP: host.stopCurrentJob(); return Result.HANDLED;
            case RETRY_BLOCKED: host.retryBlockedJob(); return Result.HANDLED;
            case CONNECTION_STATUS: host.showStatus(); return Result.HANDLED;
            case MICROSOFT_SIGN_IN: host.openSignIn(); return Result.HANDLED;
            case APP_UPDATES: host.openAppUpdates(); return Result.HANDLED;
            case LEARNING: host.openLearning(); return Result.HANDLED;
            case ACCOUNT_SETTINGS:
            case REALM_SELECTION:
            case GAMEMODE:
                host.openSafeOwnerSettings(); return Result.HANDLED;
            case DEV_CONSOLE:
                host.openDeveloperConsole(); return Result.HANDLED;
            case STOP_SERVICE: host.stopBotService(); return Result.HANDLED;
            case DIAGNOSTIC_EXPORT: host.exportDiagnostics(); return Result.HANDLED;
            // Deferred features are deliberately NOT routed to placebo actions.
            case ASSIGN_PLAYER:
            case REVOKE_PLAYER:
            case RUNTIME_LOGS:
            case PACK_INSPECTOR:
            case EMULATOR_TESTS:
                return Result.NOT_SUPPORTED;
            default:
                return Result.NOT_SUPPORTED;
        }
    }
}
