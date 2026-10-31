package com.veilforge.realmagent;

import android.app.*;
import android.os.*;
import android.content.*;
import android.graphics.*;
import android.graphics.drawable.*;
import android.net.Uri;
import android.view.*;
import android.widget.*;
import android.text.*;
import java.util.*;
import org.json.*;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.concurrent.*;

/** Text controller for the embedded Android bot. No PC, external API server or password is used. */
public final class MainActivity extends Activity {
    final int BASE=0xff110d1e,PANEL=0xff2b223d,PURPLE=0xffbb9cfb,WHITE=0xfffaf5ff,MUTED=0xffc8bed9;
    final Handler ui = new Handler(Looper.getMainLooper());
    final ExecutorService io = Executors.newSingleThreadExecutor();
    final ExecutorService urgent = Executors.newSingleThreadExecutor();
    volatile long commandEpoch=System.currentTimeMillis(); int selectedPlan=0;
    EditText botField,ownerField,realmField,input;
    LinearLayout log;ScrollView scroll;TextView connection,authCodeLabel;Button copyAuthCode;String displayedAuthCode="";
    String token=""; long cursor=0; boolean active=false;
    final int PORT=8765;
    int d(int v){return (int)(v*getResources().getDisplayMetrics().density);}
    GradientDrawable shape(int color){GradientDrawable r=new GradientDrawable();r.setColor(color);r.setCornerRadius(d(14));return r;}
    TextView txt(String value,int size,int color){TextView v=new TextView(this);v.setText(value);v.setTextColor(color);v.setTextSize(size);return v;}
    LinearLayout vertical(){LinearLayout l=new LinearLayout(this);l.setOrientation(1);return l;}
    LinearLayout.LayoutParams space(int pixels){LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,-2);p.topMargin=d(pixels);return p;}
    EditText edit(String hint){EditText e=new EditText(this);e.setSingleLine(true);e.setHint(hint);e.setHintTextColor(MUTED);e.setTextColor(WHITE);e.setTextSize(15);e.setPadding(d(12),d(12),d(12),d(12));e.setBackground(shape(PANEL));return e;}
    Button button(String s,Runnable action){Button b=new Button(this);b.setAllCaps(false);b.setText(s);b.setTextColor(WHITE);b.setBackground(shape(PANEL));b.setOnClickListener(v->action.run());return b;}
    JSONArray catalog=new JSONArray(),cards=new JSONArray();JSONObject options=new JSONObject();
    @Override public void onCreate(Bundle state){super.onCreate(state);getWindow().setStatusBarColor(BASE);getWindow().setNavigationBarColor(BASE);
        token=getPreferences(MODE_PRIVATE).getString("token","");
        LinearLayout root=vertical();root.setPadding(d(10),d(8),d(10),d(6));root.setBackgroundColor(BASE);setContentView(root);
        root.addView(txt("VEILFORGE · REALM AI",18,WHITE));
        connection=txt("Not running",12,MUTED);connection.setMaxLines(4);root.addView(connection,space(4));
        authCodeLabel=txt("",16,WHITE);authCodeLabel.setTextIsSelectable(true);root.addView(authCodeLabel,space(4));authCodeLabel.setVisibility(View.GONE);
        copyAuthCode=button("Copy sign-in code",()->{android.content.ClipboardManager cb=(android.content.ClipboardManager)getSystemService(CLIPBOARD_SERVICE);cb.setPrimaryClip(ClipData.newPlainText("Microsoft code",displayedAuthCode));});root.addView(copyAuthCode,space(4));copyAuthCode.setVisibility(View.GONE);
        botField=edit("AI Xbox gamertag");ownerField=edit("Your Xbox gamertag");realmField=edit("Realm name");
        botField.setText(getPreferences(MODE_PRIVATE).getString("botTag",""));ownerField.setText(getPreferences(MODE_PRIVATE).getString("ownerTag",""));realmField.setText(getPreferences(MODE_PRIVATE).getString("realmName",""));
        LinearLayout account=new LinearLayout(this);root.addView(account,space(5));
        account.addView(button("Start",this::startBot),new LinearLayout.LayoutParams(0,d(48),1));account.addView(button("Sign in",this::showAuth),new LinearLayout.LayoutParams(0,d(48),1));account.addView(button("Settings",this::showSettings),new LinearLayout.LayoutParams(0,d(48),1));
        LinearLayout plans=new LinearLayout(this);root.addView(plans,space(5));plans.addView(button("Commands",this::showJobs),new LinearLayout.LayoutParams(0,d(48),1));plans.addView(button("Plans (5)",this::showPlans),new LinearLayout.LayoutParams(0,d(48),1));
        LinearLayout stop=new LinearLayout(this);root.addView(stop,space(5));stop.addView(button("STOP NOW",this::stopNow),new LinearLayout.LayoutParams(0,d(48),1));stop.addView(button("Stop bot service",this::stopServiceNow),new LinearLayout.LayoutParams(0,d(48),1));
        scroll=new ScrollView(this);LinearLayout.LayoutParams sc=new LinearLayout.LayoutParams(-1,0,1);sc.topMargin=d(6);root.addView(scroll,sc);log=vertical();scroll.addView(log);
        LinearLayout entry=new LinearLayout(this);root.addView(entry,space(6));input=edit("Prepare a command…");input.setSingleLine(false);input.setMaxLines(2);entry.addView(input,new LinearLayout.LayoutParams(0,-2,1));entry.addView(button("Save",()->send(input.getText().toString())),new LinearLayout.LayoutParams(-2,d(52)));
        root.addView(txt("Commands save plans. Select → Activate. Stop is immediate.",11,MUTED),space(4));
        bubble("VEILFORGE","Joining uses your saved Microsoft session. Commands and manual chat prepare plans; nothing runs until you select and activate one. Supply/building actions are previews. STOP NOW cancels work while gravity continues.",false);
    }
    void showSettings(){LinearLayout body=vertical();for(EditText e:new EditText[]{botField,ownerField,realmField}){if(e.getParent()!=null)((android.view.ViewGroup)e.getParent()).removeView(e);body.addView(e,space(5));}new AlertDialog.Builder(this).setTitle("Separate bot account / Realm").setView(body).setMessage("Use two different gamertags. Realm name may be blank if only one is joined.").setPositiveButton("Save",(a,b)->getPreferences(MODE_PRIVATE).edit().putString("botTag",botField.getText().toString().trim()).putString("ownerTag",ownerField.getText().toString().trim()).putString("realmName",realmField.getText().toString().trim()).apply()).setNegativeButton("Close",null).show();}
    void stopServiceNow(){commandEpoch++;startService(new Intent(this,BotService.class).setAction("STOP"));connection.setText("Bot service stopped; saved login and plans kept.");bubble("VEILFORGE","Bot service stopped. Start reconnects with saved login; plans never resume automatically.",false);}
    void bubble(String who,String body,boolean mine){if(body==null||body.isEmpty())return;LinearLayout row=new LinearLayout(this);row.setGravity(mine?Gravity.RIGHT:Gravity.LEFT);log.addView(row,space(9));
        LinearLayout panel=vertical();panel.setPadding(d(12),d(9),d(12),d(10));panel.setBackground(shape(mine?0xff594278:PANEL));row.addView(panel);
        panel.addView(txt(who,11,PURPLE));TextView content=txt(body,15,WHITE);content.setTextIsSelectable(true);content.setMaxWidth(getResources().getDisplayMetrics().widthPixels-d(94));panel.addView(content,space(4));scroll.post(()->scroll.fullScroll(View.FOCUS_DOWN));}
    void startBot(){String bot=botField.getText().toString().trim(),owner=ownerField.getText().toString().trim(),name=realmField.getText().toString().trim();
        if(bot.length()<2||owner.length()<2||bot.equalsIgnoreCase(owner)||bot.length()>60||owner.length()>60||name.length()>100){bubble("VEILFORGE","Enter two different, valid Xbox gamertags. A separate player cannot use your own active Minecraft identity.",false);return;}
        try {
            String secret=token;if(!secret.matches("[a-f0-9]{64}")){byte[] b=new byte[32];new SecureRandom().nextBytes(b);StringBuilder t=new StringBuilder();for(byte v:b)t.append(String.format(java.util.Locale.ROOT,"%02x",v&255));secret=t.toString();}
            JSONObject m=new JSONObject();m.put("mode","realm");m.put("realmInvite","");m.put("realmId","");m.put("realmName",name);m.put("username","veilforge-mobile-auth");m.put("botPlayerName",bot);m.put("offline",false);m.put("version","");
            JSONObject config=new JSONObject();config.put("minecraft",m);config.put("ownerPlayerNames",new JSONArray().put(owner));config.put("localAPI",new JSONObject().put("port",PORT).put("token",secret));
            config.put("worldBridge",new JSONObject().put("allowWorldEdits",false).put("maxRadius",10).put("maxBlocksPerTask",12).put("followIntervalTicks",10));
            File root=new File(getFilesDir(),"nodejs-project");if(!root.exists()&&!root.mkdirs())throw new IOException("Could not prepare secure app directory");
            File file=new File(root,"config.json");try(FileOutputStream out=new FileOutputStream(file)){out.write(config.toString(2).getBytes(StandardCharsets.UTF_8));}
            token=secret;
            getPreferences(MODE_PRIVATE).edit().putString("botTag",bot).putString("ownerTag",owner).putString("realmName",name).putString("token",token).apply();
            Intent svc=new Intent(this,BotService.class);if(Build.VERSION.SDK_INT>=26)startForegroundService(svc);else startService(svc);
            connection.setText("Starting embedded AI player on this phone…");
            bubble("VEILFORGE","Starting a separate Realm player on the phone. You may need to complete the Microsoft device-code login. No PC is needed.",false);
        } catch(Exception e){bubble("VEILFORGE","Could not start: "+e.getClass().getSimpleName(),false);}
    }
    void showJobs(){io.submit(()->{try{JSONObject result=request("GET","/catalog",null);ui.post(()->{catalog=result.optJSONArray("catalog");options=result.optJSONObject("options");if(catalog==null||options==null)return;String[] names=new String[catalog.length()];for(int i=0;i<names.length;i++)names[i]=catalog.optJSONObject(i).optString("label");new AlertDialog.Builder(this).setTitle("Prepare a command (nothing executes)").setItems(names,(dlg,n)->showCommandForm(catalog.optJSONObject(n))).setNegativeButton("Close",null).show();});}catch(Exception e){ui.post(()->bubble("VEILFORGE","Start the bot and identify the Realm before preparing plans.",false));}});}
    void showCommandForm(JSONObject def){
        JSONArray fields=def.optJSONArray("fields");if(fields==null)return;if(fields.length()==0){prepareDescriptor(def.optString("id"),new JSONObject());return;}
        LinearLayout body=vertical();body.setPadding(d(14),d(4),d(14),d(8));String note=def.optString("note");if(!note.isEmpty())body.addView(txt(note,14,MUTED),space(5));
        final HashMap<String,EditText> edits=new HashMap<>();final HashMap<String,Spinner> spinners=new HashMap<>();final HashMap<String,ArrayList<String>> choices=new HashMap<>();
        for(int i=0;i<fields.length();i++){JSONObject f=fields.optJSONObject(i);String id=f.optString("id"),type=f.optString("type");body.addView(txt(f.optString("label"),14,WHITE),space(7));
            if(type.equals("player")||type.equals("slot")){
                ArrayList<String> labels=new ArrayList<>(),values=new ArrayList<>();
                if(type.equals("player")){JSONArray owners=options.optJSONArray("owners"),players=options.optJSONArray("players");if(owners!=null)for(int j=0;j<owners.length();j++){String name=owners.optString(j);if(!values.contains(name)){values.add(name);labels.add(name+" (owner)");}}if(players!=null)for(int j=0;j<players.length();j++){String name=players.optString(j);if(!values.contains(name)){values.add(name);labels.add(name+" (observed)");}}}
                else{JSONArray slots=options.optJSONArray("hotbar");if(slots!=null)for(int j=0;j<slots.length();j++){JSONObject item=slots.optJSONObject(j);if(item!=null&&item.optBoolean("known")){values.add(""+item.optInt("slot"));labels.add(item.optInt("slot")+": "+item.optString("name")+" ×"+item.optInt("count"));}}}
                if(values.isEmpty()){labels.add("No server-observed choices yet");}Spinner spin=new Spinner(this);spin.setAdapter(new ArrayAdapter<String>(this,android.R.layout.simple_spinner_dropdown_item,labels));body.addView(spin,space(3));spinners.put(id,spin);choices.put(id,values);
            }else{
                AutoCompleteTextView e=new AutoCompleteTextView(this);e.setTextColor(WHITE);e.setHintTextColor(MUTED);e.setSingleLine(true);e.setBackground(shape(PANEL));e.setPadding(d(10),d(10),d(10),d(10));e.setHint(type.equals("integer")?f.optInt("min")+" to "+f.optInt("max"):"Search material");
                if(type.equals("integer"))e.setInputType(android.text.InputType.TYPE_CLASS_NUMBER|android.text.InputType.TYPE_NUMBER_FLAG_SIGNED);
                else{e.setThreshold(1);e.addTextChangedListener(new TextWatcher(){Runnable search;public void beforeTextChanged(CharSequence x,int a,int c,int z){}public void onTextChanged(CharSequence x,int a,int before,int count){if(search!=null)ui.removeCallbacks(search);String query=x.toString();search=()->io.submit(()->{try{JSONObject r=request("GET","/catalog?q="+java.net.URLEncoder.encode(query,"UTF-8"),null);JSONArray matches=r.getJSONObject("options").getJSONArray("materials");String[] values=new String[matches.length()];for(int j=0;j<values.length;j++)values[j]=matches.optString(j);ui.post(()->e.setAdapter(new ArrayAdapter<String>(MainActivity.this,android.R.layout.simple_dropdown_item_1line,values)));}catch(Exception ignored){}});ui.postDelayed(search,300);}public void afterTextChanged(Editable x){}});}
                body.addView(e,space(3));edits.put(id,e);
            }
        }
        if(def.optString("id").equals("dig")){JSONArray visible=options.optJSONArray("visible");body.addView(txt("Held slot: "+options.optString("heldSlot","unknown")+". Actual tool, block hardness, visibility and protections are checked on activation.",13,MUTED),space(5));if(visible!=null&&visible.length()>0)body.addView(button("Choose visible block",()->{String[] names=new String[visible.length()];for(int i=0;i<names.length;i++){JSONObject block=visible.optJSONObject(i);names[i]=block.optString("name")+" @ "+block.optInt("x")+","+block.optInt("y")+","+block.optInt("z")+" · "+block.optString("tool")+" · "+(block.optBoolean("eligible")?block.optInt("durationMs")+"ms":block.optString("reason"));}new AlertDialog.Builder(this).setTitle("Observed blocks").setItems(names,(a,n)->{JSONObject block=visible.optJSONObject(n);for(String key:new String[]{"x","y","z"})edits.get(key).setText(""+block.optInt(key));}).show();}),space(5));}
        TextView error=txt("",13,0xffffaaaa);body.addView(error,space(5));ScrollView formScroll=new ScrollView(this);formScroll.addView(body);
        AlertDialog dialog=new AlertDialog.Builder(this).setTitle(def.optString("label")).setView(formScroll).setPositiveButton("Save plan",null).setNegativeButton("Cancel",null).create();
        dialog.setOnShowListener(x->dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v->{try{JSONObject values=new JSONObject();for(int i=0;i<fields.length();i++){JSONObject f=fields.optJSONObject(i);String key=f.optString("id"),type=f.optString("type");if(spinners.containsKey(key)){ArrayList<String> list=choices.get(key);if(list.isEmpty())throw new IllegalArgumentException("Wait for server-observed choices.");String val=list.get(spinners.get(key).getSelectedItemPosition());if(type.equals("slot"))values.put(key,Integer.parseInt(val));else values.put(key,val);}else{String val=edits.get(key).getText().toString().trim();if(val.isEmpty())throw new IllegalArgumentException("Enter "+f.optString("label"));if(type.equals("integer")){int n=Integer.parseInt(val);if(n<f.optInt("min")||n>f.optInt("max"))throw new IllegalArgumentException(f.optString("label")+" is outside the allowed range.");values.put(key,n);}else values.put(key,val);}}prepareDescriptor(def.optString("id"),values);dialog.dismiss();}catch(Exception e){error.setText(e.getMessage());}}));dialog.show();
    }
    void prepareDescriptor(String id,JSONObject values){try{planAction("prepare",new JSONObject().put("descriptor",new JSONObject().put("id",id).put("values",values)));}catch(Exception e){bubble("VEILFORGE",e.getMessage(),false);}}
    void planAction(String action,JSONObject payload){final long epoch=commandEpoch;io.submit(()->{if(epoch!=commandEpoch)return;try{payload.put("epoch",epoch);JSONObject r=request("POST","/plans/"+action,payload);ui.post(()->{syncPlans(r.optJSONObject("plans"));bubble("VEILFORGE",r.optString("message",r.optBoolean("accepted")?"Plan updated.":"Plan rejected."),false);});}catch(Exception e){ui.post(()->bubble("VEILFORGE","Plan request failed: "+e.getMessage(),false));}});}
    void syncPlans(JSONObject plans){if(plans==null)return;cards=plans.optJSONArray("cards");if(cards==null)cards=new JSONArray();selectedPlan=plans.optInt("selected",0);}
    void showPlans(){io.submit(()->{try{JSONObject r=request("GET","/plans",null);ui.post(()->{syncPlans(r.optJSONObject("plans"));String[] names=new String[cards.length()];for(int i=0;i<names.length;i++){JSONObject c=cards.optJSONObject(i),desc=c.optJSONObject("descriptor");names[i]="#"+c.optInt("id")+(c.optInt("id")==selectedPlan?" (selected)":"")+" · "+c.optString("label")+" · "+c.optString("state");}
        new AlertDialog.Builder(this).setTitle("Saved plans ("+cards.length()+"/5)").setItems(names,(dlg,n)->{JSONObject c=cards.optJSONObject(n);new AlertDialog.Builder(this).setTitle("Plan #"+c.optInt("id")).setMessage(c.optString("command")+"\n"+c.optString("note")+"\n"+c.optString("result")+"\nCompleted cards remain reusable; select again before reactivation.").setPositiveButton("Select",(a,b)->{try{planAction("select",new JSONObject().put("id",c.optInt("id")));}catch(Exception ignored){}}).setNeutralButton("Delete",(a,b)->{try{planAction("delete",new JSONObject().put("id",c.optInt("id")));}catch(Exception ignored){}}).setNegativeButton("Close",null).show();})
        .setPositiveButton("Activate Plan",(a,b)->{if(selectedPlan==0){bubble("VEILFORGE","Select a saved card first.",false);return;}final int chosen=selectedPlan;new AlertDialog.Builder(this).setTitle("Activate selected plan #"+chosen+"?").setMessage("Only this plan starts. Supply and building plans are previews.").setPositiveButton("Activate",(x,w)->{try{planAction("activate",new JSONObject().put("id",chosen));}catch(Exception ignored){}}).setNegativeButton("Cancel",null).show();}).setNegativeButton("Close",null).show();});}catch(Exception e){ui.post(()->bubble("VEILFORGE","Plans unavailable: "+e.getMessage(),false));}});}
    void stopNow(){commandEpoch++;bubble("YOU","STOP",true);urgent.submit(()->{try{JSONObject r=request("POST","/stop?epoch="+commandEpoch,new JSONObject());ui.post(()->{syncPlans(r.optJSONObject("plans"));bubble("VEILFORGE",r.optString("message"),false);});}catch(Exception e){ui.post(()->bubble("VEILFORGE","Stop not confirmed: "+e.getMessage(),false));}});}
    JSONObject lastStatus=null;
    void showAuth(){JSONObject info=lastStatus!=null?lastStatus.optJSONObject("authChallenge"):null;
        if(info==null||info.optString("userCode").isEmpty()){
            bubble("VEILFORGE","No Microsoft device-code request yet. Start AI player, then tap Microsoft sign-in when a code appears.",false);return;}
        String code=info.optString("userCode");
        displayedAuthCode=code;authCodeLabel.setText("Microsoft sign-in code: " + code + "\nEnter it at microsoft.com/link");
        authCodeLabel.setVisibility(View.VISIBLE);copyAuthCode.setVisibility(View.VISIBLE);
        new AlertDialog.Builder(this).setTitle("Sign in to your bot Xbox account")
          .setMessage("Use Microsoft's official sign-in page and enter this one-time code:\n\n"+code+"\n\nNever type your Microsoft password into VEILFORGE.")
          .setPositiveButton("Open Microsoft",(dlg,w)->startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse("https://www.microsoft.com/link"))))
          .setNeutralButton("Copy code",(dlg,w)->{
              android.content.ClipboardManager cb=(android.content.ClipboardManager)getSystemService(CLIPBOARD_SERVICE);
              cb.setPrimaryClip(ClipData.newPlainText("Microsoft device sign-in code",code));
              Toast.makeText(this,"Code copied. Paste it at microsoft.com/link",Toast.LENGTH_LONG).show();
          })
          .setNegativeButton("Close",(dlg,w)->{}).show();}
    void send(String raw){String msg=raw.trim();if(msg.equalsIgnoreCase("stop")){stopNow();return;}final long epoch=commandEpoch;if(msg.length()<1||msg.length()>190||msg.contains("\n"))return;input.setText("");bubble("YOU",msg,true);
        io.submit(()->{if(epoch!=commandEpoch)return;try{JSONObject r=request("POST","/message",new JSONObject().put("message",msg).put("epoch",epoch));ui.post(()->{syncPlans(r.optJSONObject("plans"));bubble("VEILFORGE",r.optString("message","No response"),false);});}
          catch(Exception e){ui.post(()->bubble("VEILFORGE","Bot not ready: "+e.getMessage(),false));}});}
    void update(){io.submit(()->{try{JSONObject r=request("GET","/updates?after="+cursor,null);ui.post(()->{
        lastStatus=r;
        JSONObject survival=r.optJSONObject("survival");if(survival!=null)syncPlans(survival.optJSONObject("plans"));
        JSONObject plan=r.optJSONObject("planner");
        String phase=r.optString("authState","starting");
        String err=r.optString("lastError","").trim();
        JSONObject pack=r.optJSONObject("packStatus");
        String packStage=pack==null?"":pack.optString("stage","");
        if(!err.isEmpty())connection.setText("Realm error ("+r.optString("lastPhase","unknown stage")+"): "+err);
        else if(r.optBoolean("spawned")){JSONObject verify=survival==null?null:survival.optJSONObject("verification");connection.setText("In Realm as "+r.optString("username")+" · "+(verify!=null&&verify.optBoolean("verified")?"Survival verified":verify==null?"Survival unverified":verify.optString("reason")));}
        else if("pack-request".equals(packStage))
            connection.setText("Requested Realm packs • waiting "+r.optInt("packWaitSeconds",0)+"s for server data");
        else if("downloading-packs".equals(packStage)||"pack-cached".equals(packStage))
            connection.setText("Realm resource packs: "+pack.optInt("done")+"/"+pack.optInt("total")+" verified");
        else if("packs-ready".equals(packStage))connection.setText("Realm packs ready • waiting to spawn");
        else if("negotiating-packs".equals(phase))connection.setText("Minecraft handshake • checking required packs");
        else if(r.optBoolean("joined"))connection.setText("Joined Realm • waiting to spawn");
        else if("realm-selecting".equals(phase))connection.setText("Microsoft approved • searching joined Realms");
        else if("realm-join-retry".equals(phase))connection.setText("Minecraft Realms temporarily unavailable (503) • retrying with saved login");
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
            authCodeLabel.setText("MICROSOFT CODE: "+code+"\nUse the Copy button only if Microsoft requests sign-in.");
            authCodeLabel.setVisibility(View.VISIBLE);copyAuthCode.setVisibility(View.VISIBLE);
        }else{
            displayedAuthCode="";authCodeLabel.setVisibility(View.GONE);copyAuthCode.setVisibility(View.GONE);
        }
        JSONArray updates=r.optJSONArray("updates");if(updates!=null)for(int i=0;i<updates.length();i++){JSONObject e=updates.optJSONObject(i);if(e==null||e.optLong("id")<=cursor)continue;cursor=e.optLong("id");bubble(e.optString("source","Realm"),e.optString("message"),false);}
        });}catch(Exception ex){ui.post(()->{connection.setText("Waiting for local bot…");File f=new File(getFilesDir(),"boot-status.txt");if(f.exists())try(FileInputStream in=new FileInputStream(f)){byte[] buf=new byte[512];int n=in.read(buf);if(n>0)connection.setText(new String(buf,0,n,StandardCharsets.UTF_8));}catch(Exception ignored){}});}});}
    JSONObject request(String verb,String path,JSONObject payload)throws Exception{
        HttpURLConnection c=(HttpURLConnection)new URL("http://127.0.0.1:"+PORT+path).openConnection();try{
            c.setConnectTimeout(4000);c.setReadTimeout(5000);c.setRequestMethod(verb);c.setRequestProperty("Authorization","Bearer "+token);c.setRequestProperty("Accept","application/json");
            if(payload!=null){c.setDoOutput(true);c.setRequestProperty("Content-Type","application/json");try(OutputStream o=c.getOutputStream()){o.write(payload.toString().getBytes(StandardCharsets.UTF_8));}}
            if(c.getResponseCode()!=200)throw new IOException("Local API returned "+c.getResponseCode());
            try(InputStream in=c.getInputStream();ByteArrayOutputStream out=new ByteArrayOutputStream()){byte[] buf=new byte[2048];int n;while((n=in.read(buf))!=-1){if(out.size()+n>32768)throw new IOException("Response too large");out.write(buf,0,n);}return new JSONObject(out.toString("UTF-8"));}
        }finally{c.disconnect();}}
    final Runnable refresh=new Runnable(){public void run(){if(!active)return;if(!token.isEmpty())update();ui.postDelayed(this,4500);}};
    @Override protected void onResume(){super.onResume();active=true;ui.removeCallbacks(refresh);ui.post(refresh);}
    @Override protected void onPause(){active=false;ui.removeCallbacks(refresh);super.onPause();}
    @Override protected void onDestroy(){io.shutdownNow();urgent.shutdownNow();super.onDestroy();}
}
