package com.veilforge.realmagent;
import android.content.Context;
import org.json.*;
import java.io.*;
import java.nio.channels.FileLock;
import java.nio.charset.StandardCharsets;
import java.util.*;

/** App-only bounded event codes. No logcat, chat, device codes or credentials. */
final class SupportLog {
 static final Set<String> CODES=new HashSet<>(Arrays.asList("app_open","app_crash","service_start","service_stop","runtime_start","runtime_exit","runtime_failed","api_ready","api_failed","command_sent","command_blocked","stop_sent","mode_requested","update_check","update_current","update_available","update_unavailable","update_download","update_verified","update_rejected","update_install","update_install_failed","update_installed","update_user_action","update_permission","report_exported","report_failed"));
 static boolean installed;
 static File file(Context c){return new File(c.getFilesDir(),"support/app-events.json");}
 static synchronized void install(Context c){
  if(installed)return;installed=true;Context app=c.getApplicationContext();Thread.UncaughtExceptionHandler previous=Thread.getDefaultUncaughtExceptionHandler();
  Thread.setDefaultUncaughtExceptionHandler((thread,error)->{record(app,"app_crash");if(previous!=null)previous.uncaughtException(thread,error);});
 }
 static synchronized void record(Context c,String code){
  if(!CODES.contains(code))return;
  try{
   File f=file(c);f.getParentFile().mkdirs();
   try(RandomAccessFile lock=new RandomAccessFile(new File(f.getParentFile(),"events.lock"),"rw");FileLock held=lock.getChannel().lock()){
    JSONArray old=SupportBundle.read(f,131072).optJSONArray("events"),events=new JSONArray();long now=System.currentTimeMillis();
    if(old!=null&&old.length()>0){JSONObject last=old.optJSONObject(old.length()-1);if(last!=null&&code.equals(last.optString("code"))&&now-last.optLong("at")<10000)return;}
    if(old!=null)for(int i=Math.max(0,old.length()-199);i<old.length();i++){JSONObject e=old.optJSONObject(i);if(e!=null&&CODES.contains(e.optString("code")))events.put(new JSONObject().put("at",Math.max(0,e.optLong("at"))).put("code",e.optString("code")));}
    events.put(new JSONObject().put("at",now).put("code",code));
    File temp=File.createTempFile("events-",".tmp",f.getParentFile());
    try{try(FileOutputStream out=new FileOutputStream(temp)){out.write(new JSONObject().put("schema",1).put("events",events).toString().getBytes(StandardCharsets.UTF_8));out.getFD().sync();}if(!temp.renameTo(f))throw new IOException();}finally{temp.delete();}
   }
  }catch(Exception ignored){}
 }
}
