package com.veilforge.realmagent;

import java.io.File;
import java.util.*;
import org.json.*;

/** Second strict privacy boundary for the local Minecraft packet timeline. */
final class HandshakeDiagnostics {
    private static final Set<String> STATES=options("closed world-spawned pack-requested server-reply starting");
    private static final Set<String> KINDS=options("session-start joined client-session received write-attempt queue-attempt send-mcpe client-closed server-disconnect client-error transport-closed world-spawned");
    private static final Set<String> PACKETS=options("unknown network_settings server_to_client_handshake play_status resource_packs_info resource_pack_data_info resource_pack_chunk_data resource_pack_stack start_game disconnect client_to_server_handshake client_cache_status resource_pack_client_response request_chunk_radius resource_pack_chunk_request");
    private static final Set<String> RESPONSES=options("none Cancel Downloading DownloadingFinished ResourcePackStackFinished");
    private static final Set<String> TRANSPORTS=options("unknown open closed");
    private static Set<String> options(String values){return new HashSet<>(Arrays.asList(values.split(" ")));}
    private static String choice(JSONObject source,String key,Set<String> choices,String fallback){
        String value=source.optString(key,fallback);
        return choices.contains(value)?value:fallback;
    }
    private static long numeric(JSONObject source,String key){
        Object n=source.opt(key);
        return n instanceof Number && ((Number)n).longValue()>=0?Math.min(((Number)n).longValue(),864000000):0;
    }
    static JSONObject sanitize(JSONObject input){
        JSONObject result=new JSONObject();
        if(input==null)input=new JSONObject();
        try{
            result.put("schema",1);
            result.put("capturedAt",numeric(input,"capturedAt")==0?0:ConnectionDiagnostics.nonnegative(input,"capturedAt"));
            JSONArray safe=new JSONArray(),sessions=input.optJSONArray("sessions");
            if(sessions!=null)for(int i=Math.max(0,sessions.length()-3);i<sessions.length();i++){
                JSONObject source=sessions.optJSONObject(i);if(source==null)continue;
                JSONObject row=new JSONObject().put("startedAt",ConnectionDiagnostics.nonnegative(source,"startedAt"))
                    .put("state",choice(source,"state",STATES,"starting"));
                JSONArray events=new JSONArray(),original=source.optJSONArray("events");
                if(original!=null)for(int j=Math.max(0,original.length()-64);j<original.length();j++){
                    JSONObject ev=original.optJSONObject(j);if(ev==null)continue;
                    events.put(new JSONObject().put("ms",numeric(ev,"ms"))
                      .put("kind",choice(ev,"kind",KINDS,"client-error"))
                      .put("packet",choice(ev,"packet",PACKETS,"unknown"))
                      .put("transport",choice(ev,"transport",TRANSPORTS,"unknown"))
                      .put("status",choice(ev,"status",RESPONSES,"none"))
                      .put("packCount",Math.min(256,numeric(ev,"packCount"))));
                }
                row.put("events",events);safe.put(row);
            }
            result.put("sessions",safe);
        }catch(JSONException ignored){}
        return result;
    }
    static JSONObject read(File file){return sanitize(SupportBundle.read(file,48000));}
    static String describe(JSONObject audit){
        JSONArray sessions=audit.optJSONArray("sessions");
        if(sessions==null||sessions.length()==0)return "No saved handshake trace yet. Start the bot and let it reach the Realm's pack loading stage. This screen does not need Microsoft reauthentication.";
        JSONObject session=sessions.optJSONObject(sessions.length()-1);
        if(session==null)return "No readable pack handshake trace.";
        StringBuilder b=new StringBuilder("Latest attempt: "+session.optString("state","unknown")+"\n\n");
        JSONArray events=session.optJSONArray("events");
        if(events!=null)for(int i=0;i<events.length();i++){
            JSONObject e=events.optJSONObject(i);if(e==null)continue;
            b.append(String.format(Locale.US,"%5.2fs  ",e.optLong("ms")/1000.0));
            b.append(e.optString("kind")).append(' ');
            String packet=e.optString("packet","unknown");
            if(!"unknown".equals(packet))b.append(packet).append(' ');
            if("write-attempt".equals(e.optString("kind"))&&e.optString("status").equals("Downloading"))b.append("(pack count ").append(e.optInt("packCount")).append(") ");
            b.append('[').append(e.optString("transport")).append(']').append('\n');
        }
        return b.append("\nA write attempt or transport handoff does NOT prove the server received a packet. Use the all-in-one ZIP to share this timeline; raw pack IDs, addresses and Microsoft tokens are never exported.").toString();
    }
    private HandshakeDiagnostics(){}
}
