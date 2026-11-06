package com.veilforge.rovekin.preview;

/**
 * Standalone no-dependency test runner:
 *   javac RovekinFlow.java RovekinFlowTest.java
 *   java com.veilforge.rovekin.preview.RovekinFlowTest
 *
 * Execute from the folder's parent with javac -d build ... and java -cp build ...
 * Do not rely on GitHub Actions (currently reserved/disabled).
 */
public final class RovekinFlowTest {
    static int checks = 0;
    private static void yes(boolean condition, String why) {
        checks++;
        if (!condition) throw new AssertionError(why);
    }
    private static RovekinFlow ready() {
        RovekinFlow f = new RovekinFlow("", "");
        yes(f.screen() == RovekinFlow.Screen.SPLASH, "splash initially");
        f.tapAnywhere();
        yes(f.screen() == RovekinFlow.Screen.AI_NAME, "fresh install AI step");
        yes(f.continueBot("RovekinAgent").isEmpty(), "bot name accepted");
        yes(f.screen() == RovekinFlow.Screen.INVITER_NAME, "inviter step");
        yes(!f.continueInviter("RovekinAgent").isEmpty(), "cannot share bot identity");
        yes(f.continueInviter("RealmInviter").isEmpty(), "inviter name accepted");
        yes(f.screen() == RovekinFlow.Screen.MICROSOFT, "auth waiting");
        return f;
    }
    public static void main(String[] args) {
        RovekinFlow f = ready();
        yes(!f.hasActualDeviceCode(), "no invented code");
        f.onDeviceCode("ABCD-1234", "https://www.microsoft.com/link");
        yes(f.hasActualDeviceCode(), "actual code enables copy");
        f.onCodeExpired();
        yes(!f.hasActualDeviceCode(), "expired code disabled");
        f.onAuthApproved();
        yes(f.screen() == RovekinFlow.Screen.JOINING, "auth does not equal spawn");
        f.onRealmStatus(true,false,"realm-a","RovekinAgent");
        yes(f.screen() == RovekinFlow.Screen.JOINING, "joined is not spawned");
        f.onRealmStatus(true,true,"realm-a","WrongBot");
        yes(f.screen() == RovekinFlow.Screen.JOINING, "wrong authenticated bot blocked");
        f.onRealmStatus(true,true,"realm-a","RovekinAgent");
        yes(f.screen() == RovekinFlow.Screen.CHAT, "real confirmed spawn opens chat");
        yes(!f.canBeginHomeProjects("overworld"), "no home yet");
        f.onHomeConfirmed("realm-a","overworld","RovekinAgent",true);
        f.setTasksAllowed(true);
        yes(f.canBeginHomeProjects("overworld"), "trusted home is eligible");
        yes(!f.canBeginHomeProjects("nether"), "dimension mismatch");
        f.setStop(true);
        yes(!f.canBeginHomeProjects("overworld"), "stop blocks home tasks");
        f.setStop(false);
        f.setVerifiedDelegation("OtherPlayer", false);
        yes(f.assignedPlayerTag().isEmpty(), "unapproved delegation blocked");
        f.setVerifiedDelegation("OtherPlayer", true);
        yes(f.assignedPlayerTag().equals("OtherPlayer"), "approved assignment stored separately");
        yes(f.ownerTag().equals("RealmInviter"), "assignment never rewrites owner");
        yes(f.botTag().equals("RovekinAgent"), "assignment never rewrites AI identity");
        f.revokeDelegation(false);
        yes(f.assignedPlayerTag().equals("OtherPlayer"), "unapproved revoke blocked");
        f.revokeDelegation(true);
        yes(f.assignedPlayerTag().isEmpty(), "owner can revoke");
        f.onRealmStatus(true,true,"realm-b","RovekinAgent");
        yes(!f.canBeginHomeProjects("overworld"), "home is Realm scoped");
        RovekinFlow saved = new RovekinFlow("BotAlready","RealmOwner");
        saved.tapAnywhere();
        yes(saved.screen()==RovekinFlow.Screen.MICROSOFT, "saved profile skips name prompts");
        yes(saved.auth()==RovekinFlow.Auth.CHECKING_SAVED_SESSION, "existing profile checks session");
        RovekinFlow invalid = new RovekinFlow("", "");
        invalid.tapAnywhere();
        yes(!invalid.continueBot(" ").isEmpty(), "blank name blocked");
        RovekinFlow demo = ready();
        demo.showDesignPreviewChat();
        yes(!demo.canBeginHomeProjects("overworld"), "design preview never starts live work");
        System.out.println("RovekinFlow: " + checks + " checks passed");
    }
}
