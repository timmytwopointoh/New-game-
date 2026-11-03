package com.veilforge.realmagent;
import android.content.Context;
import android.os.Build;
import org.json.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.zip.*;

/** Exports a fixed set of sanitized app diagnostics, even with no bot service. */
final class SupportBundle {
 static final Set<String> ISSUES=set("flight_unconfirmed loading_wait unknown_terrain body_collision server_stuck work_blocked terrain_decode runtime_error input_error process_restart respawn_unconfirmed");
 static final Set<String> EVENTS=set("sample session_start process_exit runtime_error input_error api_request api_rejected");
 static Set<String> set(String s){return new HashSet<>(Arrays.asList(s.split(" ")));}
 static JSONObject read(File file,int limit){try{if(!file.isFile()||file.length()>limit)return new JSONObject();try(InputStream in=new FileInputStream(file);ByteArrayOutputStream out=new ByteArrayOutputStream()){byte[] b=new byte[4096];int n;while((n=in.read(b))!=-1){if(out.size()+n>limit)return new JSONObject();out.write(b,0,n);}return new JSONObject(out.toString("UTF-8"));}}catch(Exception e){return new JSONObject();}}
 static long count(JSONObject o,String key){return Math.max(0,o.optLong(key));}
 /** Whitelisted startup stages only; this file cannot carry auth or device details. */
 static JSONObject startup(Context c){
  JSONObject raw=read(new File(c.getFilesDir(),"startup-status.json"),4096);
  String stage=raw.optString("stage","not-recorded");
  if(!set("not-recorded service-started copying-assets assets-ready loading-native node-started node-exited startup-failed").contains(stage))stage="unknown";
  JSONObject out=new JSONObject();try{out.put("schema",1).put("stage",stage).put("at",count(raw,"at"));}catch(JSONException ignored){}
  return out;
 }
 static JSONObject state(JSONObject s)throws JSONException{
  JSONObject out=new JSONObject();if(s==null)return out;out.put("life",set("alive dead waiting-for-server server-ready waiting-for-health respawned blocked").contains(s.optString("life"))?s.optString("life"):"unknown");
  for(String k:new String[]{"spawned","loading","flying","mayFly","invulnerable","instantBuild","noClip","grounded","serverGrounded","terrainKnown","bodyClear","modePending","moveLocked","jumpLocked"})if(s.opt(k) instanceof Boolean)out.put(k,s.getBoolean(k));
  for(String k:new String[]{"remaining","climbPlaced","climbTotal","decodeErrors","sections","blockRevision","flightAttempts","inventoryRevision","selectedHotbar","heldCount","placementConfirmed","placementTotal"})out.put(k,count(s,k));
  for(String k:new String[]{"health","verticalVelocity"})if(s.opt(k) instanceof Number&&Double.isFinite(s.optDouble(k)))out.put(k,s.optDouble(k));
  Set<String> words=set("unknown survival creative adventure spectator idle solo follow mine build stopped walking following waiting-for-player waiting-for-terrain waiting-for-position blocked jumping stepping-down mining mining-obstacle building confirmed cancelled interrupted arrived-predicted waiting-for-placement approaching progressing stalled unverified waiting-for-server no-feedback unconfirmed");
  for(String k:new String[]{"mode","desiredMode","job","navigation","feedback"})out.put(k,words.contains(s.optString(k))?s.optString(k):"unknown");
  out.put("phase",ConnectionDiagnostics.sanitize(new JSONObject().put("phase",s.optString("phase"))).optString("phase","unknown"));
  JSONObject p=s.optJSONObject("position");if(p!=null){JSONObject pos=new JSONObject();for(String k:new String[]{"x","y","z"})if(p.opt(k) instanceof Number&&Double.isFinite(p.optDouble(k))&&Math.abs(p.optDouble(k))<=30000000)pos.put(k,p.optDouble(k));if(pos.length()==3)out.put("position",pos);}
  return out;
 }
 static JSONObject trace(JSONObject raw)throws JSONException{
  JSONObject out=new JSONObject().put("schema",1).put("savedAt",count(raw,"savedAt"));JSONArray events=new JSONArray(),issues=new JSONArray(),src=raw.optJSONArray("events");
  if(src!=null)for(int i=Math.max(0,src.length()-240);i<src.length();i++){
   JSONObject e=src.optJSONObject(i);if(e==null||!EVENTS.contains(e.optString("kind")))continue;
   JSONObject clean=new JSONObject().put("at",count(e,"at")).put("kind",e.optString("kind"));if(e.has("state"))clean.put("state",state(e.optJSONObject("state")));
   if(set("TypeError RangeError SyntaxError ReferenceError Error").contains(e.optString("errorClass")))clean.put("errorClass",e.optString("errorClass"));
   JSONArray frames=new JSONArray(),f=e.optJSONArray("frames");if(f!=null)for(int j=0;j<Math.min(f.length(),6);j++){JSONObject frame=f.optJSONObject(j);if(frame!=null&&frame.optString("file").matches("src/[a-z0-9_./-]+\\.js")&&!frame.optString("file").contains(".."))frames.put(new JSONObject().put("file",frame.optString("file")).put("line",count(frame,"line")).put("column",count(frame,"column")));}if(frames.length()>0)clean.put("frames",frames);events.put(clean);
  }
  src=raw.optJSONArray("issues");if(src!=null)for(int i=Math.max(0,src.length()-24);i<src.length();i++){JSONObject e=src.optJSONObject(i);if(e!=null&&ISSUES.contains(e.optString("code")))issues.put(new JSONObject().put("code",e.optString("code")).put("count",count(e,"count")).put("firstAt",count(e,"firstAt")).put("lastAt",count(e,"lastAt")).put("state",state(e.optJSONObject("state"))));}
  JSONObject counters=new JSONObject(),p=raw.optJSONObject("packets");if(p!=null)for(String k:set("player_auth_input player_action request_ability command_request inventory_transaction player_hotbar mob_equipment subchunk_request serverbound_loading_screen start_game spawn update_abilities correct_player_move_prediction move_player update_block inventory_slot update_client_input_locks disconnect error respawn set_health inventory_content container_open container_close item_stack_response other"))if(p.has(k))counters.put(k,count(p,k));
  return out.put("events",events).put("issues",issues).put("packets",counters);
 }
 static String issues(Context c){try{JSONObject t=trace(read(new File(c.getFilesDir(),"nodejs-project/private/diagnostics/runtime.json"),524288));JSONArray list=t.getJSONArray("issues");StringBuilder s=new StringBuilder("Collected symptoms: "+list.length()+" types. These are diagnostic clues, not proven causes.\n\n");for(int i=0;i<list.length();i++){JSONObject e=list.getJSONObject(i);s.append(e.getString("code")).append(" ×").append(e.getLong("count")).append('\n');}return s.append("\nExport ONE ZIP with startup, connection, pack-loading, runtime failures, and safe learning/work counts. If the bot responds, its current game state is included; if not, saved diagnostics are included. Share just this ZIP in the development chat. Nothing is uploaded automatically.").toString();}catch(Exception e){return "No readable runtime report yet. You can still export app diagnostics with the bot stopped.";}}
 static void entry(ZipOutputStream zip,String name,String data)throws IOException{zip.putNextEntry(new ZipEntry(name));zip.write(data.getBytes(StandardCharsets.UTF_8));zip.closeEntry();}
 static void export(Context c,OutputStream destination)throws Exception{export(c,destination,null);}
 static void export(Context c,OutputStream destination,JSONObject liveSource)throws Exception{
  JSONObject metadata=new JSONObject().put("schema",1).put("package",c.getPackageName()).put("versionCode",c.getPackageManager().getPackageInfo(c.getPackageName(),0).versionCode).put("androidSdk",Build.VERSION.SDK_INT).put("createdAt",System.currentTimeMillis()).put("remoteAccess",false);
  JSONArray appEvents=new JSONArray(),source=read(SupportLog.file(c),131072).optJSONArray("events");if(source!=null)for(int i=Math.max(0,source.length()-200);i<source.length();i++){JSONObject e=source.optJSONObject(i);if(e!=null&&SupportLog.CODES.contains(e.optString("code")))appEvents.put(new JSONObject().put("at",count(e,"at")).put("code",e.optString("code")));}
  JSONObject live=SupportSnapshot.sanitize(liveSource);
  File nodeDir=new File(c.getFilesDir(),"nodejs-project/private/diagnostics");
  File connectionFile=new File(nodeDir,"connection.json"),runtimeFile=new File(nodeDir,"runtime.json");
  JSONObject connection=ConnectionDiagnostics.sanitize(read(connectionFile,32768));
  JSONObject handshake=HandshakeDiagnostics.read(new File(nodeDir,"pack-handshake.json"));
  JSONObject runtime=trace(read(runtimeFile,524288));
  JSONObject summary=new JSONObject()
    .put("schema",1).put("createdAt",System.currentTimeMillis())
    .put("reportFormat","one-zip").put("includesLiveSnapshot",liveSource!=null)
    .put("appVersionCode",metadata.optInt("versionCode"))
    .put("connectionPhase",connection.optString("phase","unknown"))
    .put("lastFailure",connection.optJSONObject("lastFailure"))
    .put("loadingStage",connection.optString("loadingStage","unknown"))
    .put("loadingNoProgressSeconds",count(connection,"loadingNoProgressSeconds"))
    .put("resourcePackStage",connection.optString("packStage","unknown"))
    .put("resourcePackReason",connection.optString("packReason","none"))
    .put("handshakeTraceAvailable",handshake.optJSONArray("sessions").length()>0)
    .put("packHeaders",count(connection,"packHeaders"))
    .put("packChunks",count(connection,"packChunks"))
    .put("runtimeEvents",runtime.optJSONArray("events").length())
    .put("runtimeIssueTypes",runtime.optJSONArray("issues").length())
    .put("savedAuthentication","kept");
  JSONObject manifest=new JSONObject().put("schema",1).put("createdAt",System.currentTimeMillis())
    .put("oneZipContainsAllAvailableDiagnostics",true)
    .put("liveSnapshotCaptured",liveSource!=null)
    .put("connectionReportFilePresent",connectionFile.isFile())
    .put("runtimeReportFilePresent",runtimeFile.isFile())
    .put("sections",new JSONArray(Arrays.asList("README.txt","summary.json","manifest.json","app.json","app-events.json","startup.json","connection.json","runtime.json","live-snapshot.json","pack-loading.json","pack-handshake.json","work-learning.json")));
  JSONObject pack=new JSONObject().put("schema",1)
    .put("status",connection.optString("packStage","unknown"))
    .put("reason",connection.optString("packReason","none"));
  for(String k:new String[]{"packHeaders","packChunks","packAdvertisedCount","packVerifiedCacheCount","packMissingCount","packSkippedOptional","packServerCount","packCdnCount","packResponseCount","packWireCode","packWireBytes","packWireIds","packResourceClassifiedCount","packBehaviorClassifiedCount","packAddonClassifiedCount","transportReliableWrites","transportReliableWritesOpen","transportReliableWritesClosed","transportReliableAfterPackRequest","transportClosedAfterRequestSeconds","loadingElapsedSeconds","loadingNoProgressSeconds","loadingUniqueSignals","loadingRepeatedSignals","loadingReceivedBytes","loadingRecoveryAttempts","loadingNextRetrySeconds"})pack.put(k,count(connection,k));
  for(String k:new String[]{"packCacheStatusIssued","packDownloadRequestIssued","packInfoReceived","packStackReceived","packWireEncoded","packWireVerified","packTransportConnectedAtRequest","transportJoinObserved","transportObservedPackRequest","transportPackRequestOpen","transportClosed","loadingRecoveryScheduled","loadingActive"})pack.put(k,connection.optBoolean(k));
  pack.put("transportCloseKind",connection.optString("transportCloseKind","unknown"))
    .put("packWireText",connection.optString("packWireText","unknown"))
    .put("packWireVersion",connection.optString("packWireVersion","unknown"));
  pack.put("packSelectionPolicy",connection.optString("packSelectionPolicy","unknown"));
  pack.put("packHandshakeMode",connection.optString("packHandshakeMode","unknown"))
    .put("loadingStage",connection.optString("loadingStage","unknown"))
    .put("loadingLastSignal",connection.optString("loadingLastSignal","none"));
  JSONObject work=new JSONObject().put("schema",1)
    .put("task",live.optJSONObject("task"))
    .put("learning",live.optJSONObject("learning"))
    .put("world",live.optJSONObject("world"))
    .put("liveAvailable",liveSource!=null);
  try(ZipOutputStream zip=new ZipOutputStream(destination)){
   entry(zip,"README.txt","Realm AI Live ALL-IN-ONE diagnostic ZIP. Open summary.json first, then pack-loading.json, connection.json, runtime.json and work-learning.json. Includes game coordinates if known. Live snapshot is optional and never required for export. No passwords, Microsoft codes/tokens, account names, chat, private signing material, raw packets, raw URLs or arbitrary phone files. No automatic upload or remote access.\n");
   entry(zip,"summary.json",summary.toString(2));entry(zip,"manifest.json",manifest.toString(2));
   entry(zip,"app.json",metadata.toString(2));entry(zip,"app-events.json",new JSONObject().put("events",appEvents).toString(2));entry(zip,"startup.json",startup(c).toString(2));
   entry(zip,"connection.json",connection.toString(2));
   entry(zip,"runtime.json",runtime.toString(2));
   entry(zip,"live-snapshot.json",live.toString(2));
   entry(zip,"pack-loading.json",pack.toString(2));
   entry(zip,"pack-handshake.json",handshake.toString(2));
   entry(zip,"work-learning.json",work.toString(2));
  }
 }
}
