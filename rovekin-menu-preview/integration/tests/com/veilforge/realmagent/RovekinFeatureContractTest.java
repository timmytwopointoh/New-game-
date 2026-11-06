package com.veilforge.realmagent;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;

/**
 * Run without Android or GitHub Actions:
 *
 * javac -d build integration/src/main/java/com/veilforge/realmagent/*.java \
 *   integration/tests/com/veilforge/realmagent/RovekinFeatureContractTest.java
 * java -cp build com.veilforge.realmagent.RovekinFeatureContractTest
 */
public final class RovekinFeatureContractTest {
    static int checks = 0;
    static void check(boolean ok, String message) {
        checks++;
        if (!ok) throw new AssertionError(message);
    }
    static final class Identity implements RovekinFeatureContract.Authorization {
        private final boolean owner, developer;
        Identity(boolean o, boolean d) { owner=o; developer=d; }
        public boolean hasVerifiedOwner() { return owner; }
        public boolean hasVerifiedDeveloperEntitlement() { return developer; }
    }
    static final class Host implements RovekinActionRouter.Host {
        String last = "";
        public void sendChat(String message) { last = "chat:" + message; }
        public void openCommandCatalog() { last = "commands"; }
        public void openSavedPlans() { last = "plans"; }
        public void activateQueue() { last = "activate"; }
        public void stopCurrentJob() { last = "stop"; }
        public void retryBlockedJob() { last = "retry"; }
        public void openSignIn() { last = "auth"; }
        public void openAppUpdates() { last = "updates"; }
        public void openLearning() { last = "learning"; }
        public void openSettings() { last = "settings"; }
        public void stopBotService() { last = "service_stop"; }
        public void exportDiagnostics() { last = "diagnostics"; }
        public void showStatus() { last = "status"; }
    }
    static List<RovekinFeatureContract.Skill> catalog() {
        return Arrays.asList(
            new RovekinFeatureContract.Skill("follow", "Follow player", "navigation", true),
            new RovekinFeatureContract.Skill("dig", "Mine block", "mining", true),
            new RovekinFeatureContract.Skill("craft", "Craft an item", "crafting", true),
            new RovekinFeatureContract.Skill("future-feature-xyz", "Use teleporter", "future", false));
    }
    static RovekinFeatureContract.Runtime runtime(boolean connected, boolean spawned) {
        return new RovekinFeatureContract.Runtime(connected, connected, spawned, false);
    }
    static RovekinActionRouter.Result action(RovekinActionRouter router,
                   RovekinFeatureContract.Feature feature,
                   RovekinFeatureContract.Authorization who,
                   RovekinFeatureContract.Runtime runtime,
                   String message) {
        return router.dispatch(feature, who, runtime, catalog(), message);
    }
    public static void main(String[] args) {
        Host host = new Host();
        RovekinActionRouter router = new RovekinActionRouter(host);
        RovekinFeatureContract.Authorization publicUser = new Identity(false,false);
        RovekinFeatureContract.Authorization forgedDeveloper = new Identity(false,true);
        RovekinFeatureContract.Authorization owner = new Identity(true,false);
        RovekinFeatureContract.Authorization developer = new Identity(true,true);

        check(RovekinFeatureContract.publicFeatures(runtime(true,true),catalog()).size()==19,
            "all 19 public features displayed; others remain in owner/dev console");
        check(RovekinFeatureContract.allDiscoveredSkills(catalog()).size()==4,
            "unrecognized future catalog skills never disappear");
        check(action(router,RovekinFeatureContract.Feature.CHAT,publicUser,runtime(true,true),"find me")
            == RovekinActionRouter.Result.HANDLED, "public chat sends real command");
        check(host.last.equals("chat:find me"), "chat delegates to existing MainActivity.send");
        check(action(router,RovekinFeatureContract.Feature.BUILD,publicUser,runtime(true,true),"")
            == RovekinActionRouter.Result.NOT_SUPPORTED, "nonexistent build catalog descriptor stays disabled");
        check(action(router,RovekinFeatureContract.Feature.MINE,publicUser,runtime(true,true),"")
            == RovekinActionRouter.Result.HANDLED, "live dig maps to original command catalog");
        check(host.last.equals("commands"), "only old catalog performs mining");
        check(action(router,RovekinFeatureContract.Feature.CRAFT,publicUser,runtime(true,true),"")
            == RovekinActionRouter.Result.HANDLED, "future skill automatically appears when catalog reports it");
        check(action(router,RovekinFeatureContract.Feature.FOLLOW,publicUser,runtime(true,false),"")
            == RovekinActionRouter.Result.NOT_READY, "movement blocked pending spawn");
        check(action(router,RovekinFeatureContract.Feature.EMERGENCY_STOP,publicUser,runtime(false,false),"")
            == RovekinActionRouter.Result.HANDLED, "STOP always reachable");
        check(host.last.equals("stop"), "STOP uses existing urgent API");
        check(action(router,RovekinFeatureContract.Feature.ACCOUNT_SETTINGS,publicUser,runtime(true,true),"")
            == RovekinActionRouter.Result.ACCESS_DENIED, "public cannot open owner console");
        check(action(router,RovekinFeatureContract.Feature.DIAGNOSTIC_EXPORT,owner,runtime(true,true),"")
            == RovekinActionRouter.Result.ACCESS_DENIED, "owner is not automatically developer");
        check(action(router,RovekinFeatureContract.Feature.DIAGNOSTIC_EXPORT,forgedDeveloper,runtime(true,true),"")
            == RovekinActionRouter.Result.ACCESS_DENIED, "developer bit without owner proof rejected");
        check(action(router,RovekinFeatureContract.Feature.ACCOUNT_SETTINGS,owner,runtime(true,true),"")
            == RovekinActionRouter.Result.HANDLED, "owner gets real account screen");
        check(host.last.equals("settings"), "owner uses existing settings");
        check(action(router,RovekinFeatureContract.Feature.DIAGNOSTIC_EXPORT,developer,runtime(false,false),"")
            == RovekinActionRouter.Result.HANDLED, "verified developer may export offline diagnostics");
        check(host.last.equals("diagnostics"), "reuses original ZIP exporter");
        check(action(router,RovekinFeatureContract.Feature.EMULATOR_TESTS,developer,runtime(true,true),"")
            == RovekinActionRouter.Result.NOT_SUPPORTED, "never fake unimplemented emulator console");
        check(action(router,RovekinFeatureContract.Feature.ASSIGN_PLAYER,owner,runtime(true,true),"")
            == RovekinActionRouter.Result.NOT_SUPPORTED, "player reassignment must wait for backend permission enforcement");
        check(action(router,RovekinFeatureContract.Feature.COMMAND_CATALOG,publicUser,runtime(false,false),"")
            == RovekinActionRouter.Result.HANDLED, "offline command discovery remains");
        check(RovekinFeatureContract.status(RovekinFeatureContract.Feature.MICROSOFT_SIGN_IN,
            publicUser, runtime(false,false), catalog()).enabled(), "existing Microsoft dialog remains reachable");

        System.out.println("RovekinFeatureContract: " + checks + " checks passed");
    }
}
