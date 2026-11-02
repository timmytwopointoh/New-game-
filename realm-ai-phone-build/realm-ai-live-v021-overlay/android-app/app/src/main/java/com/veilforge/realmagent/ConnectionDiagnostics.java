package com.veilforge.realmagent;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.json.*;

/** Whitelisted connection observations only; never copy raw status/auth objects. */
final class ConnectionDiagnostics {
    private static final Set<String> PHASES=new HashSet<>(Arrays.asList(("starting realm-discovery minecraft-authentication microsoft-device-code microsoft-token-refresh microsoft-session xbox-authentication xbox-user-token xbox-device-token xbox-title-token xbox-security-token xbox-sisu-authentication sign-in-required realm-selecting realm-selected realm-join-retry authenticated transport-connected bedrock-login-accepted minecraft-login-ok world-started spawned error disconnected connecting closed not-started unavailable unknown not-reached negotiating-packs pack-request pack-storage pack-retry downloading-packs pack-cached packs-ready pack-error").split(" ")));
    static String phase(String value){return PHASES.contains(value)?value:"unknown";}
    static long nonnegative(JSONObject object,String key){Object value=object.opt(key);return value instanceof Number&&((Number)value).longValue()>=0?((Number)value).longValue():0;}
    private static JSONObject failure(JSONObject value)throws JSONException {
        if(value==null)return null;
        JSONObject result=new JSONObject();String stage=phase(value.optString("phase"));result.put("phase",stage);
        int code=value.optInt("httpStatus",0);result.put("httpStatus",code>=400&&code<=599?code:JSONObject.NULL);
        result.put("recordedAt",nonnegative(value,"recordedAt"));
        String explanation=code==403?(stage.equals("xbox-title-token")?"Xbox rejected the app title-token request before a Realm connection.":"The account service or Realms rejected access."):code==401?"The account service rejected authentication.":code==429?"The service limited requests.":code>=500?"The remote service is unavailable.":"The connection failed at the reported stage.";
        result.put("explanation",explanation);return result;
    }
    static JSONObject sanitize(JSONObject input){
        JSONObject result=new JSONObject();if(input==null)input=new JSONObject();
        try{
            result.put("schema",1);result.put("phase",phase(input.optString("phase","not-started")));result.put("authState",phase(input.optString("authState","not-started")));
            for(String field:new String[]{"connected","joined","spawned","deviceCodePending","titleTokenRecoveryAttempted"})result.put(field,Boolean.TRUE.equals(input.opt(field)));
            result.put("packStage",phase(input.optString("packStage","not-reached")));
            String reason=input.optString("packReason","none");
            Set<String> reasons=new HashSet<>(Arrays.asList("none","storage-low","storage-unknown","pack-size-limit","cdn-access-denied","cdn-missing","cdn-unavailable","network-interrupted","pack-integrity","pack-transfer-failed","server-no-pack-data","server-pack-stalled"));
            result.put("packReason",reasons.contains(reason)?reason:"none");
            result.put("packFreeMB",nonnegative(input,"packFreeMB"));result.put("packNeededMB",nonnegative(input,"packNeededMB"));
            result.put("packRetryable",Boolean.TRUE.equals(input.opt("packRetryable")));
            String packChoice=input.optString("packSelectionPolicy","unknown");
            result.put("packSelectionPolicy",packChoice.equals("addon-required")||packChoice.equals("server-required-fallback")?packChoice:"unknown");
            result.put("packCacheStatusIssued",Boolean.TRUE.equals(input.opt("packCacheStatusIssued")));
            result.put("packDownloadRequestIssued",Boolean.TRUE.equals(input.opt("packDownloadRequestIssued")));
            for(String field:new String[]{"packResponseCount","packServerCount","packCdnCount","packAdvertisedCount","packSkippedOptional","packLegacyBehaviorCount"})
                result.put(field,nonnegative(input,field));
            for(String field:new String[]{"packHeaders","packChunks","recordedAt","loadingElapsedSeconds","loadingNoProgressSeconds","loadingUniqueSignals","loadingRepeatedSignals","loadingReceivedBytes","loadingGraceSeconds","loadingRecoveryAttempts","loadingNextRetrySeconds"})result.put(field,nonnegative(input,field));
            result.put("loadingActive",Boolean.TRUE.equals(input.opt("loadingActive")));
            result.put("loadingRecoveryScheduled",Boolean.TRUE.equals(input.opt("loadingRecoveryScheduled")));
            String loadingStage=input.optString("loadingStage","unknown");
            result.put("loadingStage",Arrays.asList("connecting","pack-request","pack-storage","pack-retry","downloading-packs","pack-cached","packs-ready","world-started","world-data","bedrock-login-accepted").contains(loadingStage)?loadingStage:"unknown");
            String lastSignal=input.optString("loadingLastSignal","none");
            result.put("loadingLastSignal",Arrays.asList("none","resource_packs_info","resource_pack_data_info","resource_pack_chunk_data","resource_pack_stack","start_game","level_chunk","sub_chunk","play_status").contains(lastSignal)?lastSignal:"none");
            result.put("failure",failure(input.optJSONObject("failure")));result.put("lastFailure",failure(input.optJSONObject("lastFailure")));
            String state=input.optString("processState");result.put("processState",Arrays.asList("running","stopped","crashed").contains(state)?state:"unknown");
            JSONObject identity=input.optJSONObject("clientIdentity");if(identity!=null&&((identity.optString("platform").equals("Android")&&identity.optInt("deviceOS")==1)||(identity.optString("platform").equals("Nintendo")&&identity.optInt("deviceOS")==12))&&identity.optString("flow").equals("live"))result.put("clientIdentity",new JSONObject().put("platform",identity.optString("platform")).put("deviceOS",identity.optInt("deviceOS")).put("flow","live"));
            result.put("savedAuthentication","kept");
        }catch(JSONException ignored){}
        return result;
    }
    static JSONObject read(File file){
        if(!file.isFile()||file.length()>32768)return null;
        try(InputStream in=new FileInputStream(file);ByteArrayOutputStream out=new ByteArrayOutputStream()){
            byte[] buffer=new byte[2048];int n;while((n=in.read(buffer))!=-1){if(out.size()+n>32768)return null;out.write(buffer,0,n);}
            return sanitize(new JSONObject(out.toString(StandardCharsets.UTF_8.name())));
        }catch(Exception ignored){return null;}
    }
    static JSONObject merge(JSONObject current,JSONObject previous){
        JSONObject result=sanitize(current);
        try{if(result.optJSONObject("lastFailure")==null){JSONObject old=result.optJSONObject("failure");if(old==null&&previous!=null)old=previous.optJSONObject("lastFailure");if(old==null&&previous!=null)old=previous.optJSONObject("failure");result.put("lastFailure",failure(old));}}catch(JSONException ignored){}
        return result;
    }
    private ConnectionDiagnostics(){}
}
