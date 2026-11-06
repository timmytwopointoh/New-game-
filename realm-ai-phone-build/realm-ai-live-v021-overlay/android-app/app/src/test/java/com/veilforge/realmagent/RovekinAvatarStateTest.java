package com.veilforge.realmagent;

import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;
import static org.junit.Assert.assertEquals;

/**
 * The compact pixel mascot must show ONLY work that the live controller
 * actually reports. These tests use stored-like STATUS shapes, not timers.
 */
@RunWith(RobolectricTestRunner.class)
@Config(sdk=28)
public final class RovekinAvatarStateTest {
    private JSONObject status(boolean spawned,String navigation) throws Exception {
        return new JSONObject("{\"spawned\":"+spawned+",\"survival\":{\"navigation\":"+navigation+"}}");
    }
    @Test public void notSpawnedNeverPretendsToBeWalking() throws Exception {
        assertEquals("wait",RovekinPixelCompanion.taskForStatus(
            status(false,"{\"mode\":\"follow\",\"state\":\"walking\"}")));
    }
    @Test public void realFollowWalkingAnimatesSteps() throws Exception {
        assertEquals("walk",RovekinPixelCompanion.taskForStatus(
            status(true,"{\"mode\":\"follow\",\"state\":\"walking\"}")));
    }
    @Test public void blockedFollowIsWaitingNotWalking() throws Exception {
        assertEquals("wait",RovekinPixelCompanion.taskForStatus(
            status(true,"{\"mode\":\"follow\",\"state\":\"waiting-for-terrain\"}")));
    }
    @Test public void activeBuildingAnimatesSawBench() throws Exception {
        assertEquals("build",RovekinPixelCompanion.taskForStatus(
            status(true,"{\"building\":{\"state\":\"building\"},\"mode\":\"idle\",\"state\":\"working\"}")));
    }
    @Test public void idleBuildingDoesNotPretendToWork() throws Exception {
        assertEquals("idle",RovekinPixelCompanion.taskForStatus(
            status(true,"{\"building\":{\"state\":\"idle\"},\"mode\":\"idle\",\"state\":\"idle\"}")));
    }
    @Test public void activeMiningSwingsPickaxe() throws Exception {
        assertEquals("mine",RovekinPixelCompanion.taskForStatus(
            status(true,"{\"mining\":{\"state\":\"mining\"},\"mode\":\"idle\",\"state\":\"working\"}")));
    }
    @Test public void normalIdleHasNoUnverifiedJob() throws Exception {
        assertEquals("idle",RovekinPixelCompanion.taskForStatus(
            status(true,"{\"mode\":\"idle\",\"state\":\"idle\"}")));
    }
}
