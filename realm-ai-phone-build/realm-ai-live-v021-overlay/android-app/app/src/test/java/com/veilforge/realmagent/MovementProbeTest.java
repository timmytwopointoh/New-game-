package com.veilforge.realmagent;

import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class)
@Config(sdk=28)
public class MovementProbeTest {
 @Test public void safeMovementReasonIsAvailableWithoutCoordinatesOrPlayerIdentity()throws Exception {
  JSONObject in=new JSONObject()
    .put("spawned",true)
    .put("movementGate","abilities-unknown")
    .put("movementState","waiting-for-readiness")
    .put("movementVerified",false)
    .put("movementAbilityKnown",false)
    .put("movementGrounded",true)
    .put("movementTerrainKnown",true)
    .put("followPending",true)
    .put("followActive",false)
    .put("ownerName","PRIVATE-PLAYER")
    .put("playerPosition","PRIVATE-COORDINATES")
    .put("oauthToken","PRIVATE-TOKEN");
  JSONObject out=ConnectionDiagnostics.sanitize(in);
  assertEquals("abilities-unknown",out.getString("movementGate"));
  assertEquals("waiting-for-readiness",out.getString("movementState"));
  assertTrue(out.getBoolean("followPending"));
  assertTrue(out.getBoolean("movementGrounded"));
  assertFalse(out.getBoolean("movementAbilityKnown"));
  String json=out.toString();
  assertFalse(json.contains("PRIVATE-PLAYER"));
  assertFalse(json.contains("PRIVATE-COORDINATES"));
  assertFalse(json.contains("PRIVATE-TOKEN"));
 }
 @Test public void forgedMovementReasonIsNotEchoedToAdb()throws Exception {
  JSONObject in=new JSONObject()
   .put("movementGate","private-user-location-at-1234")
   .put("movementState","invisible-secret")
   .put("followPending","true");
  JSONObject out=ConnectionDiagnostics.sanitize(in);
  assertEquals("unknown",out.getString("movementGate"));
  assertEquals("other",out.getString("movementState"));
  assertFalse(out.getBoolean("followPending"));
 }
}
