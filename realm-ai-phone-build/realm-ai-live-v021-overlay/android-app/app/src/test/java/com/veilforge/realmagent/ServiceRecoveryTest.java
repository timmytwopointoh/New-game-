package com.veilforge.realmagent;

import org.junit.Test;
import static org.junit.Assert.*;

/** The app must not trust a saved foreground-service flag after :agent exits. */
public class ServiceRecoveryTest {
    @Test public void recoveringExistingUserRequestNeedsMissingAgentProcess() {
        assertTrue(MainActivity.shouldRecoverRequestedBot(true,false,0,100000));
        assertFalse(MainActivity.shouldRecoverRequestedBot(true,true,0,100000));
        assertFalse(MainActivity.shouldRecoverRequestedBot(false,false,0,100000));
    }
    @Test public void dontRestartWhileServiceMayStillBeLaunching() {
        assertFalse(MainActivity.shouldRecoverRequestedBot(true,false,90000,100000));
        assertFalse(MainActivity.shouldRecoverRequestedBot(true,false,90000,104999));
        assertTrue(MainActivity.shouldRecoverRequestedBot(true,false,90000,105000));
    }
    @Test public void aClockCorrectionDoesNotForceImmediateRecovery() {
        assertFalse(MainActivity.shouldRecoverRequestedBot(true,false,200000,190000));
    }
}
