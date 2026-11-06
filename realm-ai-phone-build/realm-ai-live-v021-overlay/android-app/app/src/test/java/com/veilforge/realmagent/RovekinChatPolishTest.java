package com.veilforge.realmagent;

import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;
import java.lang.reflect.Proxy;
import java.util.ArrayList;
import java.util.List;
import static org.junit.Assert.*;

/** Dedicated regression for AI-only bubble, keyboard clearance, STOP vs shutdown. */
@RunWith(RobolectricTestRunner.class)
@Config(sdk=28)
public final class RovekinChatPolishTest {
    @Test public void netherBouncesOnlyOnActualAiReplies(){
        assertTrue(RovekinNetherBubble.isAiSpeaker("VEILFORGE",false));
        assertTrue(RovekinNetherBubble.isAiSpeaker("rovekin",false));
        assertFalse(RovekinNetherBubble.isAiSpeaker("YOU",true));
        assertFalse(RovekinNetherBubble.isAiSpeaker("Progress",false));
        assertFalse(RovekinNetherBubble.isAiSpeaker("VEILFORGE",true));
    }
    @Test public void chatMovesAboveImeAndReturnsToNavigationSafeGutter(){
        assertEquals(38,RovekinChatPanel.safeBottomPaddingPx(26,18,12));
        assertEquals(332,RovekinChatPanel.safeBottomPaddingPx(320,18,12));
        assertEquals(38,RovekinChatPanel.safeBottomPaddingPx(26,18,12));
        assertEquals(18,RovekinChatPanel.safeBottomPaddingPx(0,18,12));
        assertEquals(18,RovekinChatPanel.safeBottomPaddingPx(-1,18,12));
    }
    @Test public void topLeftReconnectRoutesToOneDiagnosticSaveThenSessionRejoin(){
        assertEquals("Rovekin-ALL-DIAGNOSTICS-1234.zip",
            MainActivity.reconnectDiagnosticFilename(1234L));
        List<String> calls=new ArrayList<>();
        RovekinActionRouter.Host host=(RovekinActionRouter.Host)Proxy.newProxyInstance(
            getClass().getClassLoader(),new Class<?>[]{RovekinActionRouter.Host.class},
            (proxy,method,args)->{calls.add(method.getName());return null;});
        RovekinActionRouter router=new RovekinActionRouter(host);
        RovekinFeatureContract.Runtime offline=new RovekinFeatureContract.Runtime(false,false,false,false);
        assertEquals(RovekinActionRouter.Result.HANDLED,
            router.dispatch(RovekinFeatureContract.Feature.RECONNECT_WITH_DIAGNOSTICS,
                null,offline,java.util.Collections.emptyList(),""));
        assertEquals(java.util.Arrays.asList("reconnectWithDiagnostics"),calls);
        assertFalse(calls.contains("stopBotService"));
    }
    @Test public void stopIsTaskOnlyAndReconnectStartsExistingController(){
        List<String> calls=new ArrayList<>();
        RovekinActionRouter.Host host=(RovekinActionRouter.Host)Proxy.newProxyInstance(
            getClass().getClassLoader(),new Class<?>[]{RovekinActionRouter.Host.class},
            (proxy,method,args)->{calls.add(method.getName());return null;});
        RovekinActionRouter router=new RovekinActionRouter(host);
        RovekinFeatureContract.Runtime offline=new RovekinFeatureContract.Runtime(false,false,false,false);
        assertEquals(RovekinActionRouter.Result.HANDLED,
            router.dispatch(RovekinFeatureContract.Feature.EMERGENCY_STOP,null,offline,
                java.util.Collections.emptyList(),""));
        assertEquals(java.util.Arrays.asList("stopCurrentJob"),calls);
        assertEquals(RovekinActionRouter.Result.HANDLED,
            router.dispatch(RovekinFeatureContract.Feature.START_SERVICE,null,offline,
                java.util.Collections.emptyList(),""));
        assertEquals(java.util.Arrays.asList("stopCurrentJob","startBotService"),calls);
        assertFalse("Public STOP must not shut down the Android bot service",
            calls.contains("stopBotService"));
    }
}