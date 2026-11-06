package com.veilforge.realmagent;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Integration-ready, Java-only menu/permission contract for the existing live
 * MainActivity. This file intentionally has NO Activity, storage, network or
 * authentication implementation. UI layers bind to the existing controller.
 *
 * Important: public/owner/developer UI gating is NOT backend authorization.
 * Controller routes and delegated Realm commands must enforce their own privileges.
 */
public final class RovekinFeatureContract {
    private RovekinFeatureContract() {}

    public enum Access { PUBLIC, OWNER, DEVELOPER }
    public enum State { READY, WAITING_FOR_REALM, NOT_SUPPORTED, REQUIRES_OWNER, REQUIRES_DEVELOPER }
    public enum Feature {
        CHAT("Chat", Access.PUBLIC),
        COMMAND_CATALOG("Commands", Access.PUBLIC),
        SAVED_PLANS("Saved plans", Access.PUBLIC),
        ACTIVATE_QUEUE("Run queued plans", Access.PUBLIC),
        EMERGENCY_STOP("STOP", Access.PUBLIC),
        START_SERVICE("Connect bot", Access.PUBLIC),
        RECONNECT_WITH_DIAGNOSTICS("Reconnect and save diagnostics", Access.PUBLIC),
        RETRY_BLOCKED("Retry blocked task", Access.PUBLIC),
        CONNECTION_STATUS("Connection", Access.PUBLIC),
        MICROSOFT_SIGN_IN("Microsoft sign-in", Access.PUBLIC),
        APP_UPDATES("Updates", Access.PUBLIC),
        // The following browse the server-supplied command catalog. They do not
        // invent fake independent command implementations.
        FOLLOW("Follow", Access.PUBLIC),
        GO_HOME("Home", Access.PUBLIC),
        EXPLORE("Explore", Access.PUBLIC),
        BUILD("Build", Access.PUBLIC),
        MINE("Mine", Access.PUBLIC),
        FARM("Farm", Access.PUBLIC),
        CRAFT("Craft", Access.PUBLIC),
        INVENTORY("Inventory", Access.PUBLIC),
        RESEARCH("Research", Access.PUBLIC),
        LEARNING("Learning", Access.PUBLIC),
        // Administrative features; a developer menu is never exposed to public users.
        ACCOUNT_SETTINGS("Account", Access.OWNER),
        REALM_SELECTION("Choose Realm", Access.OWNER),
        ASSIGN_PLAYER("Assign assistant", Access.OWNER),
        REVOKE_PLAYER("Revoke assistant", Access.OWNER),
        GAMEMODE("Game mode", Access.OWNER),
        STOP_SERVICE("Stop service", Access.OWNER),
        DIAGNOSTIC_EXPORT("Export diagnostics", Access.DEVELOPER),
        RUNTIME_LOGS("Runtime logs", Access.DEVELOPER),
        PACK_INSPECTOR("Pack inspector", Access.DEVELOPER),
        EMULATOR_TESTS("Emulator tests", Access.DEVELOPER),
        DEV_CONSOLE("Developer console", Access.DEVELOPER);

        public final String label;
        public final Access minimumAccess;
        Feature(String label, Access minimumAccess) {
            this.label = label;
            this.minimumAccess = minimumAccess;
        }
    }

    /** Always separate account names from authenticated authorization. */
    public interface Authorization {
        /** Verified against actual logged-in owner identity, not typed display name. */
        boolean hasVerifiedOwner();
        /** Signed entitlement / approved development build, not a hidden tap pattern. */
        boolean hasVerifiedDeveloperEntitlement();
    }

    /** Data from actual BotService/Realm status. Defaults must be conservative. */
    public static final class Runtime {
        public final boolean controllerConnected, signedIn, spawned, stopped;
        public Runtime(boolean controllerConnected, boolean signedIn,
                       boolean spawned, boolean stopped) {
            this.controllerConnected = controllerConnected;
            this.signedIn = signedIn;
            this.spawned = spawned;
            this.stopped = stopped;
        }
    }

    /**
     * Maps feature IDs reported by the real command catalog to native UI tiles.
     * Unknown/new skills remain discoverable in COMMAND_CATALOG; don't discard them.
     */
    public static final class Skill {
        public final String id, label, category;
        public final boolean currentlyAvailable;
        public Skill(String id, String label, String category, boolean currentlyAvailable) {
            this.id = id == null ? "" : id.trim();
            this.label = label == null ? this.id : label.trim();
            this.category = category == null ? "" : category.trim();
            this.currentlyAvailable = currentlyAvailable;
        }
    }

    public static final class FeatureStatus {
        public final Feature feature;
        public final State state;
        public final String explanation;
        public FeatureStatus(Feature feature, State state, String explanation) {
            this.feature = feature;
            this.state = state;
            this.explanation = explanation;
        }
        public boolean enabled() { return state == State.READY; }
    }

    private static final Map<Feature,String[]> CATALOG_HINTS = new LinkedHashMap<>();
    static {
        CATALOG_HINTS.put(Feature.FOLLOW, new String[] { "follow", "navigate", "movement" });
        CATALOG_HINTS.put(Feature.GO_HOME, new String[] { "home", "return" });
        CATALOG_HINTS.put(Feature.EXPLORE, new String[] { "explor", "scout", "navigate" });
        CATALOG_HINTS.put(Feature.BUILD, new String[] { "build", "place", "wall", "floor", "shelter" });
        CATALOG_HINTS.put(Feature.MINE, new String[] { "mine", "dig", "break" });
        CATALOG_HINTS.put(Feature.FARM, new String[] { "farm", "harvest", "plant", "crop" });
        CATALOG_HINTS.put(Feature.CRAFT, new String[] { "craft", "recipe", "smelt" });
        CATALOG_HINTS.put(Feature.INVENTORY, new String[] { "inventory", "hotbar", "item", "chest" });
        CATALOG_HINTS.put(Feature.RESEARCH, new String[] { "research", "lookup", "learn" });
    }

    /**
     * Hint matching is only for navigation/visibility; never used for granting
     * permission or proving the skill works. The catalog's real descriptor is
     * still passed into the existing /plans/prepare route by CommandDeck.
     */
    public static boolean catalogMatches(Feature f, Skill skill) {
        String[] hints = CATALOG_HINTS.get(f);
        if (hints == null || skill == null) return false;
        String haystack = (skill.id + " " + skill.label + " " + skill.category)
            .toLowerCase(Locale.ROOT);
        for (String hint : hints) if (haystack.contains(hint)) return true;
        return false;
    }

    private static Access accessLevel(Authorization auth) {
        if (auth == null) return Access.PUBLIC;
        if (auth.hasVerifiedDeveloperEntitlement() && auth.hasVerifiedOwner()) {
            return Access.DEVELOPER;
        }
        return auth.hasVerifiedOwner() ? Access.OWNER : Access.PUBLIC;
    }

    /**
     * Public interaction survives loading and errors: chat, STOP and catalog
     * remain reachable; sending a chat command is separately gated on controller
     * health by the host's existing request handler.
     */
    public static FeatureStatus status(Feature feature, Authorization auth,
                                       Runtime runtime, List<Skill> skills) {
        if (feature == null) throw new IllegalArgumentException("feature");
        Access level = accessLevel(auth);
        if (level.ordinal() < feature.minimumAccess.ordinal()) {
            State required = feature.minimumAccess == Access.DEVELOPER
                ? State.REQUIRES_DEVELOPER : State.REQUIRES_OWNER;
            return new FeatureStatus(feature, required, "Restricted to an authorized "
                + (required == State.REQUIRES_DEVELOPER ? "developer." : "owner."));
        }
        if (feature == Feature.EMERGENCY_STOP || feature == Feature.START_SERVICE
            || feature == Feature.RECONNECT_WITH_DIAGNOSTICS
            || feature == Feature.CONNECTION_STATUS
            || feature == Feature.APP_UPDATES || feature == Feature.COMMAND_CATALOG
            || feature == Feature.MICROSOFT_SIGN_IN) {
            return new FeatureStatus(feature, State.READY, "");
        }
        // Keep planned advanced features visible in the developer feature matrix,
        // but NEVER present unfinished controls as functional. New backend
        // capability + UI host binding must be verified before enabling them.
        if (feature == Feature.RUNTIME_LOGS || feature == Feature.PACK_INSPECTOR
            || feature == Feature.EMULATOR_TESTS) {
            return new FeatureStatus(feature, State.NOT_SUPPORTED,
                "This developer control is reserved until its live handler is integrated.");
        }
        if (runtime == null || !runtime.controllerConnected) {
            // Local administrative help such as diagnostics may still be present
            // in the host, but the backend-facing features are marked unavailable.
            if (feature == Feature.ACCOUNT_SETTINGS || feature == Feature.DEV_CONSOLE
                || feature == Feature.DIAGNOSTIC_EXPORT || feature == Feature.RUNTIME_LOGS
                || feature == Feature.PACK_INSPECTOR || feature == Feature.EMULATOR_TESTS
                || feature == Feature.STOP_SERVICE) {
                return new FeatureStatus(feature, State.READY, "");
            }
            return new FeatureStatus(feature, State.WAITING_FOR_REALM,
                "Waiting for the on-device controller.");
        }
        if (feature == Feature.SAVED_PLANS || feature == Feature.ACTIVATE_QUEUE
            || feature == Feature.RETRY_BLOCKED || feature == Feature.CHAT
            || feature == Feature.LEARNING || feature == Feature.STOP_SERVICE
            || feature == Feature.ACCOUNT_SETTINGS || feature == Feature.REALM_SELECTION
            || feature == Feature.GAMEMODE || feature == Feature.DIAGNOSTIC_EXPORT
            || feature == Feature.DEV_CONSOLE || feature == Feature.RUNTIME_LOGS
            || feature == Feature.PACK_INSPECTOR || feature == Feature.EMULATOR_TESTS) {
            return new FeatureStatus(feature, State.READY, "");
        }
        if (feature == Feature.ASSIGN_PLAYER || feature == Feature.REVOKE_PLAYER) {
            return new FeatureStatus(feature, State.NOT_SUPPORTED,
                "Permission delegation requires verified backend enforcement before release.");
        }
        if (feature == Feature.RESEARCH && runtime.controllerConnected) {
            return new FeatureStatus(feature, State.READY,
                "Research executes only server-confirmed supported steps.");
        }
        if (!runtime.spawned || runtime.stopped) {
            return new FeatureStatus(feature, State.WAITING_FOR_REALM,
                runtime.stopped ? "STOP is active." : "Waiting for confirmed Realm spawn.");
        }
        if (skills != null) {
            for (Skill skill : skills) if (catalogMatches(feature, skill)) {
                if (skill.currentlyAvailable) return new FeatureStatus(feature, State.READY, "");
            }
        }
        return new FeatureStatus(feature, State.NOT_SUPPORTED,
            "No currently available matching command in the live catalog.");
    }

    /** Public feature bar: normal users can browse all actual server skills. */
    public static List<FeatureStatus> publicFeatures(Runtime runtime, List<Skill> skills) {
        List<FeatureStatus> list = new ArrayList<>();
        for (Feature f : Feature.values()) {
            if (f.minimumAccess == Access.PUBLIC)
                list.add(status(f, null, runtime, skills));
        }
        return Collections.unmodifiableList(list);
    }

    /**
     * All actual backend catalog entries are returned unchanged and in order.
     * This is the forward-compatibility mechanism for future gameplay features.
     */
    public static List<Skill> allDiscoveredSkills(List<Skill> skills) {
        if (skills == null) return Collections.emptyList();
        return Collections.unmodifiableList(new ArrayList<>(skills));
    }

    /** Full owner/developer menu is generated from one manifest, no forgotten tabs. */
    public static List<FeatureStatus> authorizedFeatures(Authorization auth,
                                                          Runtime runtime,
                                                          List<Skill> skills) {
        List<FeatureStatus> all = new ArrayList<>();
        Access access = accessLevel(auth);
        for (Feature f : Feature.values()) {
            if (access.ordinal() >= f.minimumAccess.ordinal())
                all.add(status(f, auth, runtime, skills));
        }
        return Collections.unmodifiableList(all);
    }
}
