package com.veilforge.realmagent;
import org.json.*;
import java.util.*;

/** Second privacy boundary: only copy fixed numeric, boolean and enum fields from loopback status. */
final class SupportSnapshot {
 static String option(JSONObject source,String key,String choices){
  String value=source==null?"":source.optString(key,"");
  return Arrays.asList(choices.split(" ")).contains(value)?value:"unknown";
 }
 static long number(JSONObject source,String key){return source==null?0:ConnectionDiagnostics.nonnegative(source,key);}
 static void counts(JSONObject output,JSONObject input,String keys)throws JSONException{
  for(String k:keys.split(" "))output.put(k,number(input,k));
 }
 static void flags(JSONObject output,JSONObject input,String keys)throws JSONException{
  for(String k:keys.split(" "))output.put(k,input!=null&&Boolean.TRUE.equals(input.opt(k)));
 }
 static JSONObject sanitize(JSONObject input){
  JSONObject safe=new JSONObject();
  if(input==null)input=new JSONObject();
  try{
   safe.put("schema",1).put("source",input.optString("source","").equals("live")?"live":"offline").put("capturedAt",number(input,"capturedAt"));
   JSONObject connection=input.optJSONObject("connection"),c=new JSONObject();
   c.put("phase",ConnectionDiagnostics.phase(connection==null?"":connection.optString("phase")));
   c.put("authState",ConnectionDiagnostics.phase(connection==null?"":connection.optString("authState")));
   flags(c,connection,"connected joined spawned");
   safe.put("connection",c);
   JSONObject pack=input.optJSONObject("pack"),p=new JSONObject();
   p.put("stage",ConnectionDiagnostics.phase(pack==null?"":pack.optString("stage")));
   String reason=pack==null?"":pack.optString("reason");
   p.put("reason",Arrays.asList("none","server-no-pack-data","server-pack-stalled","network-interrupted","pack-transfer-failed","storage-low","storage-unknown","pack-integrity","cdn-unavailable","cdn-missing","cdn-access-denied","pack-size-limit").contains(reason)?reason:"none");
   counts(p,pack,"headers chunks requested verified advertised optionalSkipped serverPacks cdnPacks");
   flags(p,pack,"downloadRequestIssued");safe.put("pack",p);
   JSONObject loading=input.optJSONObject("loading"),l=new JSONObject();
   String stage=loading==null?"":loading.optString("stage","");
   l.put("stage",Arrays.asList("pack-request","pack-storage","pack-retry","downloading-packs","pack-cached","packs-ready","world-started","world-data","bedrock-login-accepted","connecting").contains(stage)?stage:"unknown");
   counts(l,loading,"elapsedSeconds noProgressSeconds uniqueSignals repeatedSignals receivedBytes recoveryAttempts");
   flags(l,loading,"recoveryScheduled");safe.put("loading",l);
   JSONObject world=input.optJSONObject("world"),w=new JSONObject();
   counts(w,world,"knownSections decodeErrors");
   w.put("gameMode",option(world,"gameMode","survival creative adventure spectator"));
   if(world!=null&&world.opt("health") instanceof Number){double hp=world.optDouble("health");if(Double.isFinite(hp)&&hp>=0&&hp<=10000)w.put("health",hp);}
   flags(w,world,"terrainKnown grounded");
   JSONObject pos=world==null?null:world.optJSONObject("position");
   if(pos!=null){JSONObject coordinates=new JSONObject();boolean valid=true;for(String k:new String[]{"x","y","z"}){if(!(pos.opt(k) instanceof Number)||!Double.isFinite(pos.optDouble(k))||Math.abs(pos.optDouble(k))>30000000){valid=false;break;}coordinates.put(k,pos.optDouble(k));}if(valid)w.put("position",coordinates);}
   safe.put("world",w);
   JSONObject task=input.optJSONObject("task"),t=new JSONObject();
   t.put("navigation",option(task,"navigation","idle walking following waiting-for-player waiting-for-terrain waiting-for-position blocked jumping stepping-down mining mining-obstacle building confirmed cancelled interrupted approaching stopped"));
   t.put("kind",option(task,"kind","idle solo follow mine build collect craft explore"));
   counts(t,task,"remainingRoute queuePending queueTotal queueRemaining cards");
   flags(t,task,"miningActive");safe.put("task",t);
   JSONObject learning=input.optJSONObject("learning"),v=new JSONObject();
   counts(v,learning,"confirmed blocked interrupted learnedMappings offlineWordCount");safe.put("learning",v);
   safe.put("diagnostic",new JSONObject().put("savedAuthentication","kept").put("remoteAccess",false));
  }catch(JSONException ignored){}
  return safe;
 }
 private SupportSnapshot(){}
}
