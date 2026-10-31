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
import android.text.method.LinkMovementMethod;
import android.text.util.Linkify;
import java.util.*;
import org.json.*;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.concurrent.*;

/** Text controller for the embedded Android bot. No PC, external API server or password is used. */
public class MainActivity extends Activity {
    final int BASE=0xff110d1e,PANEL=0xff2b223d,PURPLE=0xffbb9cfb,WHITE=0xfffaf5ff,MUTED=0xffc8bed9;
    final Handler ui = new Handler(Looper.getMainLooper());
    final ExecutorService io = Executors.newSingleThreadExecutor();
    final ExecutorService urgent = Executors.newSingleThreadExecutor();
    volatile long commandEpoch=System.currentTimeMillis(); int selectedPlan=0;
    EditText botField,ownerField,realmField,input;
    LinearLayout log;ScrollView scroll;TextView connection,authCodeLabel,settingsStatus;Button copyAuthCode,powerButton,commandsButton,activateButton;String displayedAuthCode="";
    String token="",lastProgressText=""; long cursor=0,serviceRevision=0,lastApiSuccessAt=0,serviceStateSince=0; boolean active=false,serviceStarted=false,apiConnected=false;
    final int PORT=8765;
    int d(int v){return (int)(v*getResources().getDisplayMetrics().density);}
    GradientDrawable shape(int color){GradientDrawable r=new GradientDrawable();r.setColor(color);r.setCornerRadius(d(14));return r;}
    GradientDrawable circle(int color){GradientDrawable r=new GradientDrawable();r.setColor(color);r.setShape(GradientDrawable.OVAL);return r;}
    TextView txt(String value,int size,int color){TextView v=new TextView(this);v.setText(value);v.setTextColor(color);v.setTextSize(size);return v;}
    LinearLayout vertical(){LinearLayout l=new LinearLayout(this);l.setOrientation(1);return l;}
    LinearLayout.LayoutParams space(int pixels){LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,-2);p.topMargin=d(pixels);return p;}
    EditText edit(String hint){EditText e=new EditText(this);e.setSingleLine(true);e.setHint(hint);e.setHintTextColor(MUTED);e.setTextColor(WHITE);e.setTextSize(15);e.setPadding(d(12),d(12),d(12),d(12));e.setBackground(shape(PANEL));return e;}
    Button button(String s,Runnable action){Button b=new Button(this);b.setAllCaps(false);b.setText(s);b.setTextColor(WHITE);b.setBackground(shape(PANEL));b.setOnClickListener(v->action.run());return b;}
    JSONArray catalog=new JSONArray(),cards=new JSONArray();JSONObject options=new JSONObject();
    @Override public void onCreate(Bundle state){super.onCreate(state);getWindow().setStatusBarColor(BASE);getWindow().setNavigationBarColor(BASE);
        token=getPreferences(MODE_PRIVATE).getString("token","");serviceStarted=getPreferences(MODE_PRIVATE).getBoolean("serviceStarted",false);serviceStateSince=serviceStarted?System.currentTimeMillis():0;
        botField=edit("AI Xbox gamertag");ownerField=edit("Your Xbox gamertag");realmField=edit("Realm name");
        botField.setText(getPreferences(MODE_PRIVATE).getString("botTag",""));ownerField.setText(getPreferences(MODE_PRIVATE).getString("ownerTag",""));realmField.setText(getPreferences(MODE_PRIVATE).getString("realmName",""));
        LinearLayout root=vertical();root.setPadding(d(10),d(8),d(10),d(6));root.setBackgroundColor(BASE);setContentView(root);
        root.setOnApplyWindowInsetsListener((v,insets)->{int l=0,t=0,r=0,b=0;if(Build.VERSION.SDK_INT>=30){android.graphics.Insets i=insets.getInsets(android.view.WindowInsets.Type.systemBars());l=i.left;t=i.top;r=i.right;b=i.bottom;}else{l=insets.getSystemWindowInsetLeft();t=insets.getSystemWindowInsetTop();r=insets.getSystemWindowInsetRight();b=insets.getSystemWindowInsetBottom();}v.setPadding(d(10)+l,d(8)+t,d(10)+r,d(6)+b);return insets;});root.requestApplyInsets();
        LinearLayout header=new LinearLayout(this);header.setGravity(Gravity.CENTER_VERTICAL);root.addView(header,space(1));
        powerButton=button("●",this::toggleBotService);powerButton.setPadding(0,0,0,0);header.addView(powerButton,new LinearLayout.LayoutParams(d(42),d(42)));renderPowerButton();
        Button updates=button("Updates",()->AppUpdater.show(this));updates.setContentDescription("Check companion updates");header.addView(updates,new LinearLayout.LayoutParams(d(94),d(44)));
        View headerSpacer=new View(this);header.addView(headerSpacer,new LinearLayout.LayoutParams(0,d(44),1));
        Button settings=button("⚙",this::showSettings);settings.setContentDescription("Settings");settings.setPadding(0,0,0,0);header.addView(settings,new LinearLayout.LayoutParams(d(42),d(44)));
        connection=txt("Not running",12,MUTED);connection.setMaxLines(4);connection.setVisibility(View.VISIBLE);root.addView(connection,space(2));
        authCodeLabel=txt("",16,WHITE);authCodeLabel.setTextIsSelectable(false);authCodeLabel.setAutoLinkMask(Linkify.WEB_URLS);authCodeLabel.setLinksClickable(true);authCodeLabel.setLinkTextColor(PURPLE);authCodeLabel.setMovementMethod(LinkMovementMethod.getInstance());authCodeLabel.setContentDescription("Microsoft device sign-in code and clickable link; shown while sign-in is pending.");authCodeLabel.setVisibility(View.GONE);
        copyAuthCode=button("Copy sign-in code",()->{android.content.ClipboardManager cb=(android.content.ClipboardManager)getSystemService(CLIPBOARD_SERVICE);cb.setPrimaryClip(ClipData.newPlainText("Microsoft code",displayedAuthCode));});copyAuthCode.setVisibility(View.GONE);
        copyAuthCode.setContentDescription("Copy the visible Microsoft device sign-in code");root.addView(authCodeLabel,space(2));root.addView(copyAuthCode,space(2));
        scroll=new ScrollView(this);scroll.setFillViewport(false);LinearLayout.LayoutParams sc=new LinearLayout.LayoutParams(-1,0,1);sc.topMargin=d(4);root.addView(scroll,sc);log=vertical();scroll.addView(log);
        FrameLayout actions=new FrameLayout(this);root.addView(actions,space(4));
        Button stop=button("STOP",this::stopNow);stop.setBackground(circle(0xff743344));stop.setContentDescription("Stop command immediately");actions.addView(stop,new FrameLayout.LayoutParams(d(72),d(64),Gravity.START|Gravity.CENTER_VERTICAL));
        activateButton=button("▶",this::activateQueuedPlans);activateButton.setTextSize(22);activateButton.setBackground(circle(0xff198754));activateButton.setContentDescription("Activate all waiting commands");actions.addView(activateButton,new FrameLayout.LayoutParams(d(74),d(74),Gravity.CENTER));
        commandsButton=button("Commands",this::showJobs);commandsButton.setBackground(shape(0xffb33b50));commandsButton.setContentDescription("Commands: open the supported command picker");actions.addView(commandsButton,new FrameLayout.LayoutParams(d(100),d(60),Gravity.END|Gravity.CENTER_VERTICAL));
        LinearLayout entry=new LinearLayout(this);root.addView(entry,space(4));input=edit("Ask, or type command …");input.setSingleLine(true);input.setImeOptions(android.view.inputmethod.EditorInfo.IME_ACTION_SEND);entry.addView(input,new LinearLayout.LayoutParams(0,d(52),1));Button send=button("↑",()->send(input.getText().toString()));send.setContentDescription("Send question or command");entry.addView(send,new LinearLayout.LayoutParams(d(54),d(52)));
        input.setOnEditorActionListener((v,id,event)->{if(id==android.view.inputmethod.EditorInfo.IME_ACTION_SEND){send(input.getText().toString());return true;}return false;});
    }
    void saveAccountSettings(){getPreferences(MODE_PRIVATE).edit().putString("botTag",botField.getText().toString().trim()).putString("ownerTag",ownerField.getText().toString().trim()).putString("realmName",realmField.getText().toString().trim()).apply();}
    void showSettings(){LinearLayout body=vertical();body.setPadding(d(12),d(4),d(12),d(8));settingsStatus=txt("Connection: "+connection.getText()+"\nMode and abilities: open this panel after joining for server evidence.",14,MUTED);body.addView(settingsStatus,space(3));
        for(EditText e:new EditText[]{botField,ownerField,realmField}){if(e.getParent()!=null)((android.view.ViewGroup)e.getParent()).removeView(e);body.addView(e,space(5));}
        body.addView(txt("Use two different Xbox gamertags. A blank Realm name is allowed when only one Realm is joined.",12,MUTED),space(4));
        LinearLayout account=new LinearLayout(this);body.addView(account,space(5));account.addView(button("Start bot",this::startBot),new LinearLayout.LayoutParams(0,d(46),1));Button signIn=button("Microsoft sign-in code",this::showAuth);signIn.setContentDescription("Show Microsoft sign-in code");account.addView(signIn,new LinearLayout.LayoutParams(0,d(46),1));
        LinearLayout modes=new LinearLayout(this);body.addView(modes,space(5));modes.addView(button("Survival",()->modeAction("survival")),new LinearLayout.LayoutParams(0,d(46),1));modes.addView(button("Creative",()->modeAction("creative")),new LinearLayout.LayoutParams(0,d(46),1));
        LinearLayout management=new LinearLayout(this);body.addView(management,space(5));management.addView(button("Saved plans",this::showPlans),new LinearLayout.LayoutParams(0,d(46),1));management.addView(button("Stop bot service",this::stopServiceNow),new LinearLayout.LayoutParams(0,d(46),1));
        body.addView(button("Learning",this::showLearning),space(5));
        body.addView(button("Connection diagnostics",this::showDiagnostics),space(5));
        body.addView(txt("Choose one file to share with another app. Android opens its file picker first, then its Share sheet. Only the file you choose is shared; Realm AI Live does not scan your phone or keep file access.",12,MUTED),space(10));
        Button shareFile=button("Share one file…",this::pickFileToShare);shareFile.setContentDescription("Choose one file from Android's file picker, then select an app to share it");body.addView(shareFile,space(4));
        ScrollView scroller=new ScrollView(this);scroller.addView(body);AlertDialog dialog=new AlertDialog.Builder(this).setTitle("Settings · account, connection, and mode").setView(scroller).setPositiveButton("Save",(a,b)->saveAccountSettings()).setNegativeButton("Close",null).create();dialog.setOnDismissListener(x->{for(EditText e:new EditText[]{botField,ownerField,realmField})if(e.getParent()!=null)((android.view.ViewGroup)e.getParent()).removeView(e);});dialog.show();
    }
    void showLearning(){
        if(!apiConnected||token.isEmpty()){showLearningStatus(lastStatus);return;}
        io.submit(()->{try{JSONObject status=request("GET","/status",null);ui.post(()->{lastStatus=status;showLearningStatus(status);});}catch(Exception e){ui.post(()->showLearningStatus(lastStatus));}});
    }
    void showLearningStatus(JSONObject status){
        JSONObject survival=status==null?null:status.optJSONObject("survival");
        JSONObject language=survival==null?null:survival.optJSONObject("language"),vocabulary=survival==null?null:survival.optJSONObject("vocabulary"),learning=survival==null?null:survival.optJSONObject("learning");
        String detail="Offline glossary: "+(language==null?"5,000":language.optInt("bundledWords"))+" words. This app uses vocabulary and command rules; a neural language model is not installed.\n\n";
        if(vocabulary==null)detail+="Start the bot to see current Realm learning.\n";
        else{detail+="Saved word mappings: "+vocabulary.optInt("count")+" / 200 (private to this Realm).\n";for(String field:new String[]{"actions","materials"}){JSONObject entries=vocabulary.optJSONObject(field);if(entries!=null){Iterator<String> keys=entries.keys();int shown=0;while(keys.hasNext()&&shown++<6){String word=keys.next();detail+=word+" → "+entries.optString(word)+"\n";}}}if(!vocabulary.optString("error").isEmpty())detail+=vocabulary.optString("error")+"\n";}
        if(learning!=null){detail+="\nServer-confirmed tasks: "+learning.optInt("confirmed")+". Blocked: "+learning.optInt("blocked")+". Interrupted: "+learning.optInt("interrupted")+".\n";if(!learning.optString("error").isEmpty())detail+=learning.optString("error")+"\n";}
        detail+="\nIt remembers your confirmed word corrections and learns from task outcomes. Repeating a failed action shows a reminder to recheck the cause. It does not rewrite its code or learn instructions from ambient player chat.\n\nTry: “what does troll mean?” or “what have you learned?”\nTeach: command teach action dredge = dig\nReview: command vocabulary\nForget: command forget action dredge\n\nAll work still waits for Activate. Stop is immediate.";
        new AlertDialog.Builder(this).setTitle("Language and learning").setMessage(detail).setPositiveButton("Close",null).show();
    }
    JSONObject savedDiagnostics(){
        JSONObject cache=null;try{String text=getPreferences(MODE_PRIVATE).getString("lastConnectionDiagnostics","");if(!text.isEmpty())cache=ConnectionDiagnostics.sanitize(new JSONObject(text));}catch(Exception ignored){}
        JSONObject file=ConnectionDiagnostics.read(new File(getFilesDir(),"nodejs-project/private/diagnostics/connection.json"));
        if(file!=null&&(cache==null||file.optLong("recordedAt")>=cache.optLong("recordedAt")))return ConnectionDiagnostics.merge(file,cache);
        if(cache!=null)return ConnectionDiagnostics.merge(cache,file);
        return lastStatus==null?null:ConnectionDiagnostics.sanitize(lastStatus.optJSONObject("diagnostics"));
    }
    void rememberDiagnostics(JSONObject report){
        if(report==null)return;
        try{JSONObject safe=ConnectionDiagnostics.sanitize(report);safe.put("recordedAt",System.currentTimeMillis());safe=ConnectionDiagnostics.merge(safe,savedDiagnostics());getPreferences(MODE_PRIVATE).edit().putString("lastConnectionDiagnostics",safe.toString()).apply();}catch(Exception ignored){}
    }
    void markControllerAvailable(){
        apiConnected=true;lastApiSuccessAt=System.currentTimeMillis();
        if(!serviceStarted){serviceStarted=true;getPreferences(MODE_PRIVATE).edit().putBoolean("serviceStarted",true).apply();}
        renderPowerButton();
    }
    String diagnosticText(JSONObject report,String source,boolean reachable){
        JSONObject safe=ConnectionDiagnostics.sanitize(report);
        try{safe.put("reportSource",source);safe.put("localApiReachable",reachable);safe.put("serviceRequested",serviceStarted);safe.put("applicationId",getPackageName());safe.put("appVersionCode",getPackageManager().getPackageInfo(getPackageName(),0).versionCode);safe.put("copiedAt",System.currentTimeMillis());safe.put("reportAvailable",report!=null);return safe.toString(2);}catch(Exception ignored){return "Connection diagnostics are unavailable. Saved login has not been changed.";}
    }
    void showDiagnostics(){
        JSONObject saved=savedDiagnostics();final String[] text={diagnosticText(saved,saved==null?"app-only":"saved",false)};
        AlertDialog dialog=new AlertDialog.Builder(this).setTitle("Connection diagnostics").setMessage(text[0]).setPositiveButton("Copy diagnostics",(d,w)->{android.content.ClipboardManager cb=(android.content.ClipboardManager)getSystemService(CLIPBOARD_SERVICE);cb.setPrimaryClip(ClipData.newPlainText("Realm AI Live diagnostics",text[0]));Toast.makeText(this,"Diagnostics copied; paste them into the development chat",Toast.LENGTH_LONG).show();}).setNegativeButton("Close",null).show();
        TextView message=dialog.findViewById(android.R.id.message);if(message!=null)message.setTextIsSelectable(true);
        if(token.isEmpty()||(!serviceStarted&&!apiConnected))return;
        final long revision=serviceRevision;
        io.submit(()->{try{JSONObject report=request("GET","/diagnostics",null);ui.post(()->{if(revision!=serviceRevision)return;markControllerAvailable();rememberDiagnostics(report);text[0]=diagnosticText(savedDiagnostics(),"live",true);if(dialog.isShowing())dialog.setMessage(text[0]);});}catch(Exception e){ui.post(()->{text[0]=diagnosticText(savedDiagnostics(),savedDiagnostics()==null?"app-only":"saved",false);if(dialog.isShowing())dialog.setMessage(text[0]);});}});
    }
    static final int REQUEST_PICK_SHARED_FILE=41021;
    void pickFileToShare(){Intent picker=new Intent(Intent.ACTION_OPEN_DOCUMENT);picker.addCategory(Intent.CATEGORY_OPENABLE);picker.setType("*/*");try{startActivityForResult(picker,REQUEST_PICK_SHARED_FILE);}catch(ActivityNotFoundException e){bubble("Progress","Android could not open its file picker.",false);}}
    @Override protected void onActivityResult(int requestCode,int resultCode,Intent data){super.onActivityResult(requestCode,resultCode,data);if(requestCode!=REQUEST_PICK_SHARED_FILE)return;if(resultCode!=RESULT_OK||data==null||data.getData()==null){bubble("Progress","File sharing canceled; no file was shared.",false);return;}Uri selected=data.getData();String mime;try{mime=getContentResolver().getType(selected);}catch(RuntimeException ignored){mime=null;}if(mime==null||mime.isEmpty())mime="*/*";Intent send=new Intent(Intent.ACTION_SEND);send.setType(mime);send.putExtra(Intent.EXTRA_STREAM,selected);send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);send.setClipData(ClipData.newUri(getContentResolver(),"Selected file",selected));try{startActivity(Intent.createChooser(send,"Share selected file"));}catch(ActivityNotFoundException e){bubble("Progress","No app is available to receive the selected file.",false);}}
    void renderPowerButton(){if(powerButton==null)return;if(apiConnected){powerButton.setBackground(circle(0xffb33b50));powerButton.setContentDescription("Stop bot service");}else if(serviceStarted){powerButton.setBackground(circle(0xff88672c));powerButton.setContentDescription("Cancel bot service startup");}else{powerButton.setBackground(circle(0xff7e3040));powerButton.setContentDescription("Start bot service");}}
    void toggleBotService(){if(serviceStarted){stopServiceNow();return;}if(botField.getText().toString().trim().length()<2||ownerField.getText().toString().trim().length()<2){showSettings();bubble("Progress","Enter the bot and owner gamertags in Settings, then turn the bot on.",false);return;}startBot();}
    void stopServiceNow(){commandEpoch++;try{ComponentName accepted=startService(new Intent(this,BotService.class).setAction("STOP"));if(accepted==null)throw new IllegalStateException("Android did not accept the stop request.");serviceRevision++;serviceStarted=false;apiConnected=false;serviceStateSince=0;getPreferences(MODE_PRIVATE).edit().putBoolean("serviceStarted",false).apply();renderPowerButton();connection.setText("Bot service stopped; saved login and plans kept.");bubble("Progress","Stop request sent to Android. Saved login and plans are kept; plans do not resume automatically.",false);}catch(Exception e){bubble("Progress","Android could not stop the bot service: "+e.getClass().getSimpleName(),false);}}
    void modeAction(String mode){getPreferences(MODE_PRIVATE).edit().putString("modePreference",mode).apply();if(!serviceStarted||token.isEmpty()){bubble("Progress",mode.substring(0,1).toUpperCase(java.util.Locale.ROOT)+mode.substring(1)+" selected for the next session. The server must confirm the bot’s mode and abilities.",false);return;}final long epoch=commandEpoch;io.submit(()->{try{JSONObject r=request("POST","/mode",new JSONObject().put("mode",mode).put("epoch",epoch));ui.post(()->{bubble("Progress",r.optString("message","Waiting for server mode confirmation."),false);updateSettingsStatus(r.optJSONObject("verification"));});}catch(Exception e){ui.post(()->bubble("Progress","Mode request failed: "+e.getMessage(),false));}});}
    void activateQueuedPlans(){planAction("activate-queue",new JSONObject());}
    void updateSettingsStatus(JSONObject verification){if(settingsStatus==null)return;String status="Connection: "+connection.getText();if(verification!=null){String mode=verification.optString("mode","unknown");status+="\nBot mode: "+mode+" · desired: "+verification.optString("desiredMode","survival")+"\n"+verification.optString("reason","");}else if(lastStatus!=null){JSONObject survival=lastStatus.optJSONObject("survival");JSONObject v=survival==null?null:survival.optJSONObject("verification");if(v!=null)status+="\nBot mode: "+v.optString("mode","unknown")+" · "+v.optString("reason","");}settingsStatus.setText(status);}
    void bubble(String who,String body,boolean mine){if(body==null||body.isEmpty())return;LinearLayout row=new LinearLayout(this);row.setGravity(mine?Gravity.RIGHT:Gravity.LEFT);log.addView(row,space(9));
        LinearLayout panel=vertical();panel.setPadding(d(12),d(9),d(12),d(10));panel.setBackground(shape(mine?0xff594278:PANEL));row.addView(panel);
        panel.addView(txt(who,11,PURPLE));TextView content=txt(body,15,WHITE);content.setTextIsSelectable(true);content.setMaxWidth(getResources().getDisplayMetrics().widthPixels-d(94));panel.addView(content,space(4));scroll.post(()->scroll.fullScroll(View.FOCUS_DOWN));}
    void startBot(){if(apiConnected){bubble("Progress","Bot is already connected to the local controller. Use Stop bot service before changing account settings or restarting it.",false);return;}if(serviceStarted){bubble("Progress","Bot service is already starting. Wait for its connection status before trying again.",false);return;}String bot=botField.getText().toString().trim(),owner=ownerField.getText().toString().trim(),name=realmField.getText().toString().trim();
        if(bot.length()<2||owner.length()<2||bot.equalsIgnoreCase(owner)||bot.length()>60||owner.length()>60||name.length()>100){bubble("VEILFORGE","Enter two different, valid Xbox gamertags. A separate player cannot use your own active Minecraft identity.",false);return;}
        try {
            String secret=token;if(!secret.matches("[a-f0-9]{64}")){byte[] b=new byte[32];new SecureRandom().nextBytes(b);StringBuilder t=new StringBuilder();for(byte v:b)t.append(String.format(java.util.Locale.ROOT,"%02x",v&255));secret=t.toString();}
            JSONObject m=new JSONObject();m.put("mode","realm");m.put("realmInvite","");m.put("realmId","");m.put("realmName",name);m.put("username","veilforge-mobile-auth");m.put("botPlayerName",bot);m.put("offline",false);m.put("version","");
        JSONObject config=new JSONObject();config.put("minecraft",m);config.put("ownerPlayerNames",new JSONArray().put(owner));config.put("localAPI",new JSONObject().put("port",PORT).put("token",secret));config.put("requestedGameMode",getPreferences(MODE_PRIVATE).getString("modePreference","survival"));
            config.put("worldBridge",new JSONObject().put("allowWorldEdits",false).put("maxRadius",10).put("maxBlocksPerTask",12).put("followIntervalTicks",10));
            File root=new File(getFilesDir(),"nodejs-project");if(!root.exists()&&!root.mkdirs())throw new IOException("Could not prepare secure app directory");
            File file=new File(root,"config.json");try(FileOutputStream out=new FileOutputStream(file)){out.write(config.toString(2).getBytes(StandardCharsets.UTF_8));}
            token=secret;
            Intent svc=new Intent(this,BotService.class);ComponentName accepted=Build.VERSION.SDK_INT>=26?startForegroundService(svc):startService(svc);if(accepted==null)throw new IllegalStateException("Android did not accept the start request.");
            getPreferences(MODE_PRIVATE).edit().putString("botTag",bot).putString("ownerTag",owner).putString("realmName",name).putString("token",token).putBoolean("serviceStarted",true).apply();serviceStarted=true;apiConnected=false;serviceStateSince=System.currentTimeMillis();serviceRevision++;renderPowerButton();
            connection.setText("Starting embedded AI player on this phone…");
            bubble("VEILFORGE","Starting a separate Realm player on the phone. You may need to complete the Microsoft device-code login. No PC is needed.",false);
        } catch(Exception e){serviceStarted=false;apiConnected=false;getPreferences(MODE_PRIVATE).edit().putBoolean("serviceStarted",false).apply();renderPowerButton();bubble("VEILFORGE","Could not start: "+e.getClass().getSimpleName(),false);}
    }
    void showJobs(){io.submit(()->{try{JSONObject result=request("GET","/catalog",null);ui.post(()->{catalog=result.optJSONArray("catalog");options=result.optJSONObject("options");if(options==null)options=new JSONObject();if(catalog==null||catalog.length()==0){bubble("Progress","No supported commands were returned. Check the bot connection in Settings.",false);return;}String[] names=new String[catalog.length()];for(int i=0;i<names.length;i++)names[i]=catalog.optJSONObject(i).optString("label");new AlertDialog.Builder(this).setTitle("Prepare a command (nothing executes)").setItems(names,(dlg,n)->showCommandForm(catalog.optJSONObject(n))).setNegativeButton("Close",null).show();});}catch(Exception e){ui.post(()->bubble("VEILFORGE","Start the bot service before preparing plans.",false));}});}
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
    void syncPlans(JSONObject plans){if(plans==null)return;cards=plans.optJSONArray("cards");if(cards==null)cards=new JSONArray();selectedPlan=plans.optInt("selected",0);int waiting=plans.optInt("pending",0);if(activateButton!=null)activateButton.setContentDescription("Activate all waiting commands; "+waiting+" waiting, selected first");}
    void showPlans(){io.submit(()->{try{JSONObject r=request("GET","/plans",null);ui.post(()->{syncPlans(r.optJSONObject("plans"));final JSONArray shownCards=cards;String[] names=new String[shownCards.length()];for(int i=0;i<names.length;i++){JSONObject c=shownCards.optJSONObject(i),desc=c.optJSONObject("descriptor");names[i]="#"+c.optInt("id")+(c.optInt("id")==selectedPlan?" (selected)":"")+" · "+c.optString("label")+" · "+c.optString("state");}
        new AlertDialog.Builder(this).setTitle("Saved plans ("+cards.length()+"/5)").setItems(names,(dlg,n)->{JSONObject c=shownCards.optJSONObject(n);new AlertDialog.Builder(this).setTitle("Plan #"+c.optInt("id")).setMessage(c.optString("command")+"\n"+c.optString("note")+"\n"+c.optString("result")+"\nReuse returns this card to the waiting queue. The green button runs waiting cards in order, selected first. Plans never resume automatically.").setPositiveButton("Reuse",(a,b)->{try{planAction("select",new JSONObject().put("id",c.optInt("id")));}catch(Exception ignored){}}).setNeutralButton("Delete",(a,b)->{try{planAction("delete",new JSONObject().put("id",c.optInt("id")));}catch(Exception ignored){}}).setNegativeButton("Close",null).show();})
        .setPositiveButton("Activate waiting",(a,b)->activateQueuedPlans()).setNegativeButton("Close",null).show();});}catch(Exception e){ui.post(()->bubble("VEILFORGE","Plans unavailable: "+e.getMessage(),false));}});}
    void stopNow(){commandEpoch++;bubble("YOU","STOP",true);urgent.submit(()->{try{JSONObject r=request("POST","/stop?epoch="+commandEpoch,new JSONObject());ui.post(()->{syncPlans(r.optJSONObject("plans"));bubble("VEILFORGE",r.optString("message"),false);});}catch(Exception e){ui.post(()->bubble("VEILFORGE","Stop not confirmed: "+e.getMessage(),false));}});}
    JSONObject lastStatus=null;
    void showAuth(){if(token.isEmpty()){bubble("Progress","Start the bot and wait for the local controller before requesting its Microsoft sign-in code.",false);return;}io.submit(()->{try{JSONObject status=request("GET","/status",null);ui.post(()->{lastStatus=status;showAuth(status);});}catch(Exception e){ui.post(()->bubble("Progress","Could not check Microsoft sign-in status: "+e.getMessage(),false));}});}
    void showAuth(JSONObject status){JSONObject info=status!=null?status.optJSONObject("authChallenge"):null;
        if(info==null||info.optString("userCode").isEmpty()){
            bubble("Progress","No Microsoft sign-in code is pending, so there is nothing to copy. The latest connection error is shown above. When Microsoft requests a new code, it and the clickable link will appear here.",false);return;}
        String code=info.optString("userCode");
        displayedAuthCode=code;authCodeLabel.setText("Microsoft sign-in code: " + code + "\nOpen https://www.microsoft.com/link and enter it");
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
    void send(String raw){String msg=raw.trim();if(msg.equalsIgnoreCase("stop")){stopNow();return;}if(msg.equalsIgnoreCase("command")||msg.equalsIgnoreCase("commands")){input.setText("");showJobs();return;}final long epoch=commandEpoch;if(msg.length()<1||msg.length()>190||msg.contains("\n"))return;input.setText("");bubble("YOU",msg,true);
        io.submit(()->{if(epoch!=commandEpoch)return;try{JSONObject r=request("POST","/message",new JSONObject().put("message",msg).put("epoch",epoch));ui.post(()->{syncPlans(r.optJSONObject("plans"));if(r.optBoolean("showCatalog"))showJobs();bubble("VEILFORGE",r.optString("message","No response"),false);});}
          catch(Exception e){ui.post(()->bubble("VEILFORGE","Bot not ready: "+e.getMessage(),false));}});}
    void update(){final long revision=serviceRevision;io.submit(()->{try{JSONObject r=request("GET","/updates?after="+cursor,null);ui.post(()->{if(revision!=serviceRevision)return;
        markControllerAvailable();rememberDiagnostics(r.optJSONObject("diagnostics"));lastStatus=r;
        JSONObject survival=r.optJSONObject("survival");if(survival!=null)syncPlans(survival.optJSONObject("plans"));
        JSONObject plan=r.optJSONObject("planner");
        String phase=r.optString("authState","starting");
        String err=r.optString("lastError","").trim();
        JSONObject pack=r.optJSONObject("packStatus");
        String packStage=pack==null?"":pack.optString("stage","");
        if(!err.isEmpty())connection.setText("Realm error ("+r.optString("lastPhase","unknown stage")+"): "+err);
        else if(r.optBoolean("spawned")){JSONObject verify=survival==null?null:survival.optJSONObject("verification");connection.setText("In Realm as "+r.optString("username")+" · "+(verify==null?"mode unverified":verify.optString("mode","unknown")+" · "+verify.optString("reason","")));}
        else if("pack-request".equals(packStage))
            connection.setText("Requested Realm packs • waiting "+r.optInt("packWaitSeconds",0)+"s for server data");
        else if("downloading-packs".equals(packStage)||"pack-cached".equals(packStage))
            connection.setText("Realm resource packs: "+pack.optInt("done")+"/"+pack.optInt("total")+" verified");
        else if("packs-ready".equals(packStage))connection.setText("Realm packs ready • waiting to spawn");
        else if("negotiating-packs".equals(phase))connection.setText("Minecraft handshake • checking required packs");
        else if(r.optBoolean("joined"))connection.setText("Joined Realm • waiting to spawn");
        else if("microsoft-device-code".equals(phase))connection.setText("Requesting Microsoft device sign-in code");
        else if("microsoft-token-refresh".equals(phase)||"microsoft-session".equals(phase))connection.setText("Checking the saved Microsoft session");
        else if(phase.startsWith("xbox-"))connection.setText("Checking Xbox access · "+phase);
        else if("realm-discovery".equals(phase))connection.setText("Checking joined Realms for the signed-in bot account");
        else if("realm-selecting".equals(phase))connection.setText("Microsoft approved • searching joined Realms");
        else if("realm-join-retry".equals(phase))connection.setText("Minecraft Realms temporarily unavailable (503) • retrying with saved login");
        else if("realm-selected".equals(phase))connection.setText("Realm found • connecting to Minecraft");
        else if("authenticated".equals(phase))connection.setText("Microsoft session ready • joining Realm");
        else if("connecting".equals(phase))connection.setText("Minecraft server connected • joining game");
        else if("sign-in-required".equals(phase))connection.setText("Microsoft sign-in pending • see code below");
        else if(plan!=null&&!"idle".equals(plan.optString("state")))connection.setText("Plan "+plan.optString("state")+" • "+plan.optInt("current")+"/"+plan.optInt("total"));
        else connection.setText("AI running • checking Microsoft / Realm connection");
        JSONObject savedPlans=survival==null?null:survival.optJSONObject("plans");JSONObject batch=savedPlans==null?null:savedPlans.optJSONObject("batch");
        if(batch!=null)connection.setText(connection.getText()+" · queued command "+(batch.optInt("total")-batch.optInt("remaining")+1)+"/"+batch.optInt("total"));
        else if(savedPlans!=null&&savedPlans.optInt("pending")>0)connection.setText(connection.getText()+" · "+savedPlans.optInt("pending")+" command(s) waiting");
        updateSettingsStatus(null);
        if(plan!=null){String progress=plan.optString("id","?")+":"+plan.optString("state","idle")+":"+plan.optInt("current")+":"+plan.optInt("total")+":"+plan.optString("lastResult","");if(!progress.equals(lastProgressText)&&!"idle".equals(plan.optString("state"))){lastProgressText=progress;bubble("Progress","Plan "+plan.optString("id")+" · "+plan.optString("state")+" · "+plan.optInt("current")+"/"+plan.optInt("total")+" steps. "+plan.optString("lastResult",""),false);}}
        JSONObject challenge=r.optJSONObject("authChallenge");
        String code=challenge==null?"":challenge.optString("userCode","").trim();
        if(err.isEmpty() && "sign-in-required".equals(phase) && !code.isEmpty() && !code.startsWith("(")){
            displayedAuthCode=code;
            authCodeLabel.setText("MICROSOFT CODE: "+code+"\nOpen https://www.microsoft.com/link and enter it.");
            authCodeLabel.setVisibility(View.VISIBLE);copyAuthCode.setVisibility(View.VISIBLE);
        }else{
            displayedAuthCode="";authCodeLabel.setVisibility(View.GONE);copyAuthCode.setVisibility(View.GONE);
        }
        JSONArray updates=r.optJSONArray("updates");if(updates!=null)for(int i=0;i<updates.length();i++){JSONObject e=updates.optJSONObject(i);if(e==null||e.optLong("id")<=cursor)continue;cursor=e.optLong("id");bubble(e.optString("source","Realm"),e.optString("message"),false);}
        });}catch(Exception ex){ui.post(()->{if(revision!=serviceRevision)return;apiConnected=false;long reference=Math.max(lastApiSuccessAt,serviceStateSince);if(serviceStarted&&reference>0&&System.currentTimeMillis()-reference>=15000){serviceStarted=false;serviceStateSince=0;getPreferences(MODE_PRIVATE).edit().putBoolean("serviceStarted",false).apply();bubble("Progress","The bot service stopped responding. Your saved login and plans remain; tap the power button to start it again.",false);}renderPowerButton();connection.setText("Waiting for local bot…");File f=new File(getFilesDir(),"boot-status.txt");if(f.exists())try(FileInputStream in=new FileInputStream(f)){byte[] buf=new byte[512];int n=in.read(buf);if(n>0)connection.setText(new String(buf,0,n,StandardCharsets.UTF_8));}catch(Exception ignored){}});}});}
    protected JSONObject request(String verb,String path,JSONObject payload)throws Exception{
        final long revision=serviceRevision;
        HttpURLConnection c=(HttpURLConnection)new URL("http://127.0.0.1:"+PORT+path).openConnection();try{
            c.setConnectTimeout(4000);c.setReadTimeout(5000);c.setRequestMethod(verb);c.setRequestProperty("Authorization","Bearer "+token);c.setRequestProperty("Accept","application/json");
            if(payload!=null){c.setDoOutput(true);c.setRequestProperty("Content-Type","application/json");try(OutputStream o=c.getOutputStream()){o.write(payload.toString().getBytes(StandardCharsets.UTF_8));}}
            if(c.getResponseCode()!=200)throw new IOException("Local API returned "+c.getResponseCode());
            try(InputStream in=c.getInputStream();ByteArrayOutputStream out=new ByteArrayOutputStream()){byte[] buf=new byte[2048];int n;while((n=in.read(buf))!=-1){if(out.size()+n>32768)throw new IOException("Response too large");out.write(buf,0,n);}JSONObject result=new JSONObject(out.toString("UTF-8"));ui.post(()->{if(revision==serviceRevision)markControllerAvailable();});return result;}
        }finally{c.disconnect();}}
    final Runnable refresh=new Runnable(){public void run(){if(!active)return;if(!token.isEmpty())update();ui.postDelayed(this,4500);}};
    @Override protected void onResume(){super.onResume();if(getIntent().getBooleanExtra("showUpdates",false)){getIntent().removeExtra("showUpdates");AppUpdater.show(this);}active=true;ui.removeCallbacks(refresh);ui.post(refresh);}
    @Override protected void onPause(){active=false;ui.removeCallbacks(refresh);super.onPause();}
    @Override protected void onDestroy(){io.shutdownNow();urgent.shutdownNow();super.onDestroy();}
}
