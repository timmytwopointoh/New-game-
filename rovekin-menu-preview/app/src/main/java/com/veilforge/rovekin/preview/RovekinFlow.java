package com.veilforge.rovekin.preview;

import java.util.Locale;
import java.util.Objects;

/**
 * No Android dependencies and no network/credential handling.
 * Live app integration adapts real BotService events into this UI-only state machine.
 */
public final class RovekinFlow {
    public enum Screen { SPLASH, AI_NAME, INVITER_NAME, MICROSOFT, JOINING, CHAT }
    public enum Auth { UNKNOWN, CHECKING_SAVED_SESSION, DEVICE_CODE_REQUIRED, AUTHENTICATED, ERROR }
    public enum Connection { DISCONNECTED, DISCOVERING_REALM, JOINING_REALM, JOINED_NOT_SPAWNED, SPAWNED }

    private Screen screen = Screen.SPLASH;
    private Auth auth = Auth.UNKNOWN;
    private Connection connection = Connection.DISCONNECTED;
    private String botTag = "", ownerTag = "", assignedPlayerTag = "";
    private String deviceCode = "", verificationUrl = "", activeRealmId = "", connectedBotTag = "";
    private String homeRealmId = "", homeDimensionId = "", homeBotTag = "";
    private boolean homeConfirmed = false, tasksAllowed = false, stopped = false, designPreview = false;

    public RovekinFlow(String savedBot, String savedOwner) {
        botTag = normalized(savedBot);
        ownerTag = normalized(savedOwner);
    }

    private static String normalized(String input) {
        return input == null ? "" : input.trim();
    }
    public static String checkGamertag(String name) {
        String text = normalized(name);
        if (text.length() < 2 || text.length() > 60) return "Enter a player name (2–60 characters).";
        if (text.indexOf('\n') >= 0 || text.indexOf('\r') >= 0
                || text.indexOf('/') >= 0 || text.indexOf('\\') >= 0) {
            return "Use a normal Minecraft/Xbox player name.";
        }
        return "";
    }

    public Screen screen() { return screen; }
    public Auth auth() { return auth; }
    public Connection connection() { return connection; }
    public String botTag() { return botTag; }
    public String ownerTag() { return ownerTag; }
    public String assignedPlayerTag() { return assignedPlayerTag; }
    public String deviceCode() { return deviceCode; }
    public String verificationUrl() { return verificationUrl; }
    public boolean isDesignPreview() { return designPreview; }
    public boolean hasActualDeviceCode() {
        return auth == Auth.DEVICE_CODE_REQUIRED && !deviceCode.isEmpty()
                && verificationUrl.startsWith("https://");
    }

    /** Called only after the user taps the splash. On every app open, splash is shown first. */
    public void tapAnywhere() {
        if (screen != Screen.SPLASH) return;
        if (checkGamertag(botTag).isEmpty() && checkGamertag(ownerTag).isEmpty()
                && !botTag.equalsIgnoreCase(ownerTag)) {
            auth = Auth.CHECKING_SAVED_SESSION;
            screen = Screen.MICROSOFT; // Backend checks saved session; never force re-login.
        } else {
            screen = Screen.AI_NAME;
        }
    }

    public String continueBot(String proposed) {
        String problem = checkGamertag(proposed);
        if (!problem.isEmpty()) return problem;
        botTag = normalized(proposed);
        if (ownerTag.equalsIgnoreCase(botTag)) ownerTag = "";
        screen = Screen.INVITER_NAME;
        return "";
    }

    public String continueInviter(String proposed) {
        String problem = checkGamertag(proposed);
        if (!problem.isEmpty()) return problem;
        if (botTag.equalsIgnoreCase(normalized(proposed))) {
            return "The AI needs its own account, separate from its Realm inviter.";
        }
        ownerTag = normalized(proposed);
        auth = Auth.CHECKING_SAVED_SESSION;
        screen = Screen.MICROSOFT;
        return "";
    }

    /** Real client reports that an unexpired Microsoft user code is available. */
    public void onDeviceCode(String actualUserCode, String actualVerificationUrl) {
        if (auth == Auth.AUTHENTICATED) return;
        deviceCode = normalized(actualUserCode);
        verificationUrl = normalized(actualVerificationUrl);
        auth = Auth.DEVICE_CODE_REQUIRED;
        screen = Screen.MICROSOFT;
    }

    public void onCodeExpired() {
        deviceCode = "";
        verificationUrl = "";
        if (auth != Auth.AUTHENTICATED) {
            auth = Auth.CHECKING_SAVED_SESSION;
            screen = Screen.MICROSOFT;
        }
    }

    public void onAuthError() {
        deviceCode = "";
        verificationUrl = "";
        auth = Auth.ERROR;
        screen = Screen.MICROSOFT;
    }

    /** True only after the existing Microsoft/Xbox handshake reports success. */
    public void onAuthApproved() {
        auth = Auth.AUTHENTICATED;
        deviceCode = "";
        verificationUrl = "";
        connection = Connection.DISCOVERING_REALM;
        screen = Screen.JOINING;
    }

    public void onRealmJoining() {
        if (auth != Auth.AUTHENTICATED) return;
        connection = Connection.JOINING_REALM;
        screen = Screen.JOINING;
    }

    /** Joined is not proof of spawn. Player and Realm IDs must match before CHAT. */
    public void onRealmStatus(boolean joined, boolean spawned, String realmId, String authenticatedBotTag) {
        if (auth != Auth.AUTHENTICATED) return;
        activeRealmId = normalized(realmId);
        connectedBotTag = normalized(authenticatedBotTag);
        if (!joined) {
            connection = Connection.JOINING_REALM;
            screen = Screen.JOINING;
        } else if (!spawned || activeRealmId.isEmpty() || !connectedBotTag.equalsIgnoreCase(botTag)) {
            connection = Connection.JOINED_NOT_SPAWNED;
            screen = Screen.JOINING;
        } else {
            connection = Connection.SPAWNED;
            screen = Screen.CHAT;
        }
    }

    public void onDisconnected() {
        connection = Connection.DISCONNECTED;
        designPreview = false;
        if (checkGamertag(botTag).isEmpty() && checkGamertag(ownerTag).isEmpty()) {
            auth = Auth.CHECKING_SAVED_SESSION;
            screen = Screen.MICROSOFT;
        } else {
            screen = Screen.AI_NAME;
        }
    }

    /** Optional future delegation; NEVER changes ownerTag or authenticated botTag. */
    public void setVerifiedDelegation(String assignedTag, boolean ownerApproved) {
        if (!ownerApproved || !checkGamertag(assignedTag).isEmpty()) return;
        assignedPlayerTag = normalized(assignedTag);
    }
    public void revokeDelegation(boolean ownerApproved) {
        if (ownerApproved) assignedPlayerTag = "";
    }

    /** Call only after an authoritative in-game home confirmation and save Realm/dimension. */
    public void onHomeConfirmed(String realmId, String dimensionId, String botAccount, boolean confirmed) {
        homeRealmId = normalized(realmId);
        homeDimensionId = normalized(dimensionId);
        homeBotTag = normalized(botAccount);
        homeConfirmed = confirmed;
    }
    public void setTasksAllowed(boolean allowed) { tasksAllowed = allowed; }
    public void setStop(boolean stop) { stopped = stop; }

    /**
     * UI may request autonomous home planning only on this predicate.
     * Production worker still enforces permissions, terrain and task preconditions.
     */
    public boolean canBeginHomeProjects(String activeDimensionId) {
        return !designPreview
                && screen == Screen.CHAT
                && auth == Auth.AUTHENTICATED
                && connection == Connection.SPAWNED
                && homeConfirmed && tasksAllowed && !stopped
                && !activeRealmId.isEmpty() && activeRealmId.equals(homeRealmId)
                && !homeDimensionId.isEmpty() && homeDimensionId.equals(normalized(activeDimensionId))
                && botTag.equalsIgnoreCase(homeBotTag);
    }

    /**
     * Menu-only demo does not fabricate Microsoft authentication or a Realm join.
     * Its chat has a permanent "DESIGN PREVIEW • NOT CONNECTED" status.
     */
    public void showDesignPreviewChat() {
        designPreview = true;
        screen = Screen.CHAT;
    }
}
