#!/usr/bin/env python3
"""v0.9.2: expose Xbox auth / joined Realm selection / spawn and failures.
This changes status reporting only: no new sign-in method, retries or credential logging.
Run after the reviewed v0.9.1 Microsoft code UI patch.
"""
from pathlib import Path
import sys
root=Path(sys.argv[1]); cp=root/'bedrock-agent/src/connection.js'
ui=root/'android-app/app/src/main/java/com/veilforge/realmagent/MainActivity.java'
s=cp.read_text(encoding='utf8')
def patch(text,old,new):
    n=text.count(old)
    if n!=1: raise RuntimeError('Unexpected v0.9.1 source ('+str(n)+'): '+old[:90])
    return text.replace(old,new,1)
s=patch(s,"this.username='';this.authChallenge=null;this.lastError='';","this.username='';this.authChallenge=null;this.authState='starting';this.lastError='';")
s=patch(s,"lastError:this.lastError,lastCommand:","lastError:this.lastError,authState:this.authState,lastCommand:")
s=patch(s,"      this.emit('auth-code',this.authChallenge)","      this.authState='sign-in-required';this.lastError=''\n      this.emit('auth-code',this.authChallenge)")
s=patch(s,"    const client=bedrock.createClient(options)", """    // This callback is invoked by Bedrock Realms discovery for the signed-in account.
    if(options.realms?.pickRealm){
      const original=options.realms.pickRealm
      options.realms.pickRealm=realms=>{
        this.authState='realm-selecting'
        this.log('Realm discovery returned '+(Array.isArray(realms)?realms.length:0)+' joined Realm(s).')
        try{
          const selected=original(realms)
          this.authChallenge=null;this.authState='realm-selected'
          this.log('Realm selected; attempting game connection.')
          return selected
        }catch(e){
          this.authChallenge=null;this.authState='error'
          this.lastError=String(e?.message||e).slice(0,180)
          this.log('Realm discovery failed: '+this.lastError)
          throw e
        }
      }
    }
    const client=bedrock.createClient(options)""")
s=patch(s,"    client.on('connect',()=>{this.connected=true;this.log('Bedrock transport connected.')})", """    // The library reports authentication/transport separately from the game join.
    // Do not log tokens, automatically retry or infer that the game has spawned.
    client.on('session',()=>{
      this.authChallenge=null;this.authState='authenticated';this.lastError=''
      this.log('Minecraft session established; joining the Realm.')
    })
    client.on('connect',()=>{this.connected=true;this.authChallenge=null;this.authState='connecting';this.log('Bedrock transport connected.')})""")
s=patch(s,"client.on('join',()=>{this.authChallenge=null;this.joined=true;","client.on('join',()=>{this.authChallenge=null;this.authState='joined';this.joined=true;")
s=patch(s,"      this.authChallenge=null\n      this.username=","      this.authChallenge=null;this.authState='spawned';this.lastError=''\n      this.username=")
s=patch(s,"client.on('error',e=>{this.lastError=String(e.message||e);this.log('Bedrock error: '+this.lastError)})","client.on('error',e=>{this.lastError=String(e.message||e).slice(0,180);this.authChallenge=null;this.authState='error';this.log('Bedrock error: '+this.lastError)})")
s=patch(s,"client.on('disconnect',e=>{this.emit('session-end');this.log('Disconnected: '+JSON.stringify(e).slice(0,240));this.connected=false;this.joined=false;this.spawned=false})","client.on('disconnect',e=>{this.emit('session-end');this.log('Disconnected');if(!this.lastError)this.lastError='Disconnected before spawning in the Realm.';this.authChallenge=null;this.authState='disconnected';this.connected=false;this.joined=false;this.spawned=false})")
s=patch(s,"client.on('close',()=>{this.emit('session-end');this.log('Connection closed');this.connected=false;this.joined=false;this.spawned=false})","client.on('close',()=>{this.emit('session-end');this.log('Connection closed');if(!this.lastError)this.lastError='Connection closed before spawning in the Realm.';this.authChallenge=null;this.authState='disconnected';this.connected=false;this.joined=false;this.spawned=false})")
s=patch(s,"client.on('end',()=>{this.emit('session-end');this.log('Connection ended');this.connected=false;this.joined=false;this.spawned=false})","client.on('end',()=>{this.emit('session-end');this.log('Connection ended');if(!this.lastError)this.lastError='Connection ended before spawning in the Realm.';this.authChallenge=null;this.authState='disconnected';this.connected=false;this.joined=false;this.spawned=false})")
cp.write_text(s,encoding='utf8')
s=ui.read_text(encoding='utf8')
start=s.index('        lastStatus=r;JSONObject plan=r.optJSONObject("planner");')
end=s.index('        JSONArray updates=r.optJSONArray("updates");',start)
block="""        lastStatus=r;JSONObject plan=r.optJSONObject("planner");
        String phase=r.optString("authState","starting");
        String err=r.optString("lastError","").trim();
        if(!err.isEmpty())connection.setText("Realm error: "+err);
        else if(r.optBoolean("spawned"))connection.setText("In Realm as "+r.optString("username"));
        else if(r.optBoolean("joined"))connection.setText("Joined Realm • waiting to spawn");
        else if("realm-selecting".equals(phase))connection.setText("Microsoft approved • searching joined Realms");
        else if("realm-selected".equals(phase))connection.setText("Realm found • connecting to Minecraft");
        else if("authenticated".equals(phase))connection.setText("Microsoft session ready • joining Realm");
        else if("connecting".equals(phase))connection.setText("Minecraft server connected • joining game");
        else if("sign-in-required".equals(phase))connection.setText("Microsoft sign-in pending • see code below");
        else if(plan!=null&&!"idle".equals(plan.optString("state")))connection.setText("Plan "+plan.optString("state")+" • "+plan.optInt("current")+"/"+plan.optInt("total"));
        else connection.setText("AI running • checking Microsoft / Realm connection");
        JSONObject challenge=r.optJSONObject("authChallenge");
        String code=challenge==null?"":challenge.optString("userCode","").trim();
        if(err.isEmpty() && "sign-in-required".equals(phase) && !code.isEmpty() && !code.startsWith("(")){
            displayedAuthCode=code;
            authCodeLabel.setText("MICROSOFT CODE: "+code+"\\nUse the Copy button only if Microsoft requests sign-in.");
            authCodeLabel.setVisibility(View.VISIBLE);copyAuthCode.setVisibility(View.VISIBLE);
        }else{
            displayedAuthCode="";authCodeLabel.setVisibility(View.GONE);copyAuthCode.setVisibility(View.GONE);
        }
"""
s=s[:start]+block+s[end:]
for key in ['MICROSOFT CODE:','Realm error:',"\"realm-selected\".equals(phase)"]:
    if key not in s: raise RuntimeError('Missing patch marker: '+key)
ui.write_text(s,encoding='utf8')
print('v0.9.2: auth, Realm discovery and spawn progress visible; no auth tokens or password logged')
