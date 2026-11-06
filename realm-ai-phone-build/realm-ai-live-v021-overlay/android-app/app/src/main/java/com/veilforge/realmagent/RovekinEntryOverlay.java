package com.veilforge.realmagent;

import android.app.AlertDialog;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.content.res.ColorStateList;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.RippleDrawable;
import android.net.Uri;
import android.os.Build;
import android.text.InputType;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.view.animation.DecelerateInterpolator;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Production onboarding and chat transition for the current native Android
 * MainActivity. It NEVER substitutes its own Minecraft client, local API,
 * Microsoft token handler, command queue, home logic or stored session.
 *
 * This UI is a private integration candidate. Privileged controls are NOT
 * enabled without a verified entitlement provided by the existing backend.
 */
public final class RovekinEntryOverlay {
    private static final int BACK=0xff052719, PANEL=0xe90c4029, LIGHT=0xffa6ff67;
    private static final int WHITE=0xffefffee, MUTED=0xffadd3ad, PURPLE=0xffd1a0ff;
    private final MainActivity a;
    private final FrameLayout frame;
    private final LinearLayout legacy;
    private final RovekinFeatureContract.Authorization trustedRole; // may be null
    private final RovekinActionRouter router;
    private RovekinChatPanel chat;
    private RovekinVfxView painting;
    private LinearLayout overlayPanel;
    private TextView statusText, authText, footerText;
    private Button copyButton, openLoginButton;
    private String actualCode="", verificationUrl="", liveStatus="Waiting to connect";
    private boolean beginTapped=false, chatShown=false;
    private JSONObject lastStatus;
    private Screen screen=Screen.SPLASH;

    private enum Screen { SPLASH, AI_NAME, INVITER, CONNECTING, CHAT }
    public RovekinEntryOverlay(MainActivity a, FrameLayout frame, LinearLayout legacy,
                               RovekinFeatureContract.Authorization role) {
        this.a=a; this.frame=frame; this.legacy=legacy;this.trustedRole=role;
        this.router=new RovekinActionRouter(new RovekinMainActivityHost(a,role));
    }
    private int dp(float px){return (int)(a.getResources().getDisplayMetrics().density*px+.5f);}
    private GradientDrawable shape(int color,int edge,int radius) {
        GradientDrawable g=new GradientDrawable();g.setColor(color);
        g.setCornerRadius(dp(radius));g.setStroke(dp(1.6f),edge);return g;
    }
    private TextView text(String value,int size,int color,boolean strong){
        TextView v=new TextView(a);v.setText(value);v.setTextColor(color);v.setTextSize(size);
        if(strong)v.setTypeface(Typeface.create("sans-serif-black",Typeface.BOLD));
        return v;
    }
    private LinearLayout column(){LinearLayout p=new LinearLayout(a);p.setOrientation(1);return p;}
    private void add(LinearLayout target,View child,int marginTop){
        LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,-2);
        lp.topMargin=dp(marginTop);target.addView(child,lp);
    }
    private void center(LinearLayout target,View child,int marginTop){
        LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,-2);
        lp.topMargin=dp(marginTop);lp.gravity=Gravity.CENTER_HORIZONTAL;target.addView(child,lp);
    }
    private Button button(String label,boolean primary,Runnable onTap){
        Button b=new Button(a); b.setAllCaps(false);b.setText(label);
        b.setTypeface(Typeface.create("sans-serif-black",Typeface.BOLD));
        b.setTextSize(15);b.setMinHeight(dp(52));
        b.setTextColor(primary?BACK:WHITE);
        GradientDrawable bg=primary
            ?new GradientDrawable(GradientDrawable.Orientation.TL_BR,
                new int[]{0xffd5ff8a,0xff8dff38,0xff38ad29})
            :shape(PANEL,0xff8ffc64,17);
        bg.setCornerRadius(dp(17));
        bg.setStroke(dp(1.5f),primary?0xffd4ffa0:0xff69bb55);
        b.setBackground(new RippleDrawable(ColorStateList.valueOf(0x66e5ffed),bg,null));
        b.setPadding(dp(15),dp(9),dp(15),dp(9));
        b.setElevation(dp(3));
        b.setOnTouchListener((view,event)->{
            if(event.getActionMasked()==MotionEvent.ACTION_DOWN){
                view.animate().scaleX(.966f).scaleY(.95f).translationY(dp(2))
                    .setDuration(90).setInterpolator(new DecelerateInterpolator()).start();
            } else if(event.getActionMasked()==MotionEvent.ACTION_UP
                ||event.getActionMasked()==MotionEvent.ACTION_CANCEL){
                view.animate().scaleX(1).scaleY(1).translationY(0)
                    .setDuration(155).setInterpolator(new DecelerateInterpolator()).start();
            }
            return false; // Android must still receive the REAL button click.
        });
        b.setOnClickListener(v->onTap.run());
        return b;
    }
    private boolean configured(){
        String bot=a.botField.getText().toString().trim(),owner=a.ownerField.getText().toString().trim();
        return bot.length()>=2&&owner.length()>=2&&!bot.equalsIgnoreCase(owner);
    }
    private void createVisuals(){
        if(painting!=null)painting.setAnimated(false);
        frame.removeAllViews();
        painting=new RovekinVfxView(a);
        frame.addView(painting,new FrameLayout.LayoutParams(-1,-1));
        ScrollView scroller=new ScrollView(a);
        scroller.setFillViewport(true);scroller.setVerticalScrollBarEnabled(false);
        FrameLayout.LayoutParams fp=new FrameLayout.LayoutParams(-1,-1);
        frame.addView(scroller,fp);
        scroller.setOnClickListener(v->{if(screen==Screen.SPLASH){beginTapped=true;showFirstStep();}});
        LinearLayout bounds=column();
        bounds.setPadding(dp(22),dp(12),dp(22),dp(24));
        bounds.setGravity(Gravity.BOTTOM|Gravity.CENTER_HORIZONTAL);
        scroller.addView(bounds,new ScrollView.LayoutParams(-1,-1));
        bounds.setOnClickListener(v->{if(screen==Screen.SPLASH){beginTapped=true;showFirstStep();}});
        overlayPanel=column();
        overlayPanel.setPadding(dp(20),dp(17),dp(20),dp(18));
        overlayPanel.setBackground(shape(PANEL,0xff6bcf50,25));
        overlayPanel.setElevation(dp(8));
        LinearLayout.LayoutParams panelParams=new LinearLayout.LayoutParams(-1,-2);
        panelParams.bottomMargin=dp(36);
        bounds.addView(overlayPanel,panelParams);
        if(painting!=null)painting.setAnimated(true);
    }
    private void headline(String heading,String subheading){
        TextView title=text(heading,30,WHITE,true);title.setGravity(Gravity.CENTER);
        title.setShadowLayer(dp(9),0,dp(3),0xbb051a0d);
        center(overlayPanel,title,0);
        TextView subtitle=text(subheading,12,LIGHT,true);
        subtitle.setGravity(Gravity.CENTER);subtitle.setLetterSpacing(.08f);
        center(overlayPanel,subtitle,7);
    }
    public void attach(){
        a.getWindow().setStatusBarColor(0xff052719);
        a.getWindow().setNavigationBarColor(0xff052719);
        legacy.setVisibility(View.GONE);
        // Returning users bypass the first-run welcome and account screens.
        // The real saved-session/Realm checks still run; chat opens on server spawn.
        if(configured())connectScreen(!a.serviceStarted);
        else showSplash();
    }
    private void showSplash(){
        screen=Screen.SPLASH;createVisuals();
        headline("ROVEKIN","YOUR WORLD  •  YOUR COMPANION");
        TextView msg=text("A companion that grows with your world.",15,WHITE,false);
        msg.setGravity(Gravity.CENTER);center(overlayPanel,msg,14);
        TextView tap=text("TAP ANYWHERE TO BEGIN",17,LIGHT,true);
        tap.setGravity(Gravity.CENTER);center(overlayPanel,tap,25);
        android.animation.ObjectAnimator pulse=android.animation.ObjectAnimator.ofFloat(tap,"translationY",0f,-dp(5),0f);
        pulse.setDuration(2000);pulse.setRepeatCount(android.animation.ValueAnimator.INFINITE);
        pulse.setInterpolator(new DecelerateInterpolator());pulse.start();
        frame.setOnClickListener(v->{if(screen==Screen.SPLASH){beginTapped=true;showFirstStep();}});
        overlayPanel.setOnClickListener(v->{if(screen==Screen.SPLASH){beginTapped=true;showFirstStep();}});
    }
    private void showFirstStep(){
        frame.setOnClickListener(null);overlayPanel.setOnClickListener(null);
        if(configured()){connectScreen(true);return;}
        showAiName("");
    }
    private EditText input(String hint,String oldValue){
        EditText in=new EditText(a);in.setSingleLine(true);
        in.setTextColor(WHITE);in.setTextSize(16);in.setHintTextColor(MUTED);
        in.setHint(hint);in.setText(oldValue);
        in.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_FLAG_CAP_WORDS);
        in.setPadding(dp(14),dp(13),dp(14),dp(13));
        in.setBackground(shape(0xff103b26,0xff62954d,14));
        return in;
    }
    private boolean valid(String name){
        String value=name.trim();
        return value.length()>=2&&value.length()<=60
            &&!value.contains("\n")&&!value.contains("/")&&!value.contains("\\");
    }
    private void showAiName(String warning){
        screen=Screen.AI_NAME;createVisuals();
        headline("Name your AI","FIRST-TIME SETUP  •  1 OF 2");
        TextView description=text("Enter the gamertag used by your separate AI player's Minecraft account.",15,WHITE,false);
        add(overlayPanel,description,19);
        EditText field=input("AI player gamertag",a.botField.getText().toString());
        add(overlayPanel,field,11);
        TextView error=text(warning,12,0xffffb8bc,false);add(overlayPanel,error,8);
        add(overlayPanel,button("CONTINUE",true,()->{
            String value=field.getText().toString().trim();
            if(!valid(value)){error.setText("Enter a valid gamertag (2–60 characters).");return;}
            a.botField.setText(value);
            showInviter("");
        }),15);
    }
    private void showInviter(String warning){
        screen=Screen.INVITER;createVisuals();
        headline("Who owns the AI?","FIRST-TIME SETUP  •  2 OF 2");
        TextView description=text("Enter the gamertag of the owner or Realm invitation sender. This is separate from the AI's account.",15,WHITE,false);
        add(overlayPanel,description,17);
        EditText field=input("Owner / inviter gamertag",a.ownerField.getText().toString());
        add(overlayPanel,field,11);
        TextView note=text("The owner can assign the assistant to another player later, without changing the AI's Microsoft sign-in.",12,MUTED,false);
        add(overlayPanel,note,10);
        TextView error=text(warning,12,0xffffb8bc,false);add(overlayPanel,error,7);
        add(overlayPanel,button("CONTINUE & CONNECT",true,()->{
            String name=field.getText().toString().trim();
            if(!valid(name)||name.equalsIgnoreCase(a.botField.getText().toString().trim())){
                error.setText("Enter a different owner gamertag from the AI player.");return;
            }
            a.ownerField.setText(name);
            a.saveAccountSettings(); // existing preference keys botTag/ownerTag/realmName
            a.getPreferences(Context.MODE_PRIVATE).edit().putBoolean("rovekinAutoConnect",true).apply();
            connectScreen(true);
        }),13);
        add(overlayPanel,button("BACK",false,()->showAiName("")),8);
    }
    private void connectScreen(boolean autoConnect){
        screen=Screen.CONNECTING;createVisuals();headline("Connecting your AI","CHECKING SAVED SESSION  •  JOINING REALM");
        statusText=text(liveStatus,15,WHITE,false);
        statusText.setGravity(Gravity.CENTER);
        add(overlayPanel,statusText,22);
        authText=text("Microsoft sign-in will appear here only if needed.",12,MUTED,false);
        authText.setGravity(Gravity.CENTER); add(overlayPanel,authText,13);
        copyButton=button("COPY MICROSOFT CODE",true,()->{
            if(actualCode.isEmpty())return;
            ClipboardManager cb=(ClipboardManager)a.getSystemService(Context.CLIPBOARD_SERVICE);
            cb.setPrimaryClip(ClipData.newPlainText("Microsoft device sign-in code",actualCode));
            Toast.makeText(a,"Microsoft code copied",Toast.LENGTH_SHORT).show();
        });
        copyButton.setVisibility(View.GONE); add(overlayPanel,copyButton,8);
        openLoginButton=button("OPEN MICROSOFT SIGN-IN",false,()->{
            if(actualCode.isEmpty() || !verificationUrl.startsWith("https://"))return;
            a.startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(verificationUrl)));
        });
        openLoginButton.setVisibility(View.GONE); add(overlayPanel,openLoginButton,8);
        add(overlayPanel,button("CONNECT / RETRY",true,()->connect()),18);
        add(overlayPanel,button("EDIT ACCOUNT",false,()->showAiName("")),8);
        // Technical internals remain in the original service and diagnostics; no version/readme clutter.
        if(autoConnect && !a.serviceStarted)connect();
        if(lastStatus!=null)drawRealStatus(lastStatus);
    }
    private void connect(){
        if(!configured()){showAiName("Set the AI and owner names first.");return;}
        if(a.serviceStarted){
            liveStatus="Waiting for the existing on-device service…";
            if(statusText!=null)statusText.setText(liveStatus);
            return;
        }
        a.startBot(); // ORIGINAL embedded service + saved Microsoft auth and Realm.
        liveStatus=a.connection==null?"Starting bot":a.connection.getText().toString();
        if(statusText!=null)statusText.setText(liveStatus);
    }
    private void drawRealStatus(JSONObject r){
        if(r==null)return;
        JSONObject ch=r.optJSONObject("authChallenge");
        String phase=r.optString("authState","");
        String code=ch==null?"":ch.optString("userCode","").trim();
        boolean challenge=!code.isEmpty()&&!code.startsWith("(")
            &&("sign-in-required".equals(phase)||"microsoft-device-code".equals(phase));
        if(challenge){
            actualCode=code;
            String url=ch.optString("verificationUri","");
            if(url.isEmpty())url=ch.optString("verificationUrl","");
            if(!url.startsWith("https://"))url="https://www.microsoft.com/link";
            verificationUrl=url;
        }else{
            actualCode="";verificationUrl="";
        }
        if(statusText!=null)statusText.setText(liveStatus);
        if(authText!=null)authText.setText(challenge
            ?"SIGN IN TO YOUR AI ACCOUNT\nCode: "+actualCode+"\n"+verificationUrl
            :r.optBoolean("joined")
                ?"Realm connected • waiting for actual spawn."
                :"Checking authentication, Realm discovery and resource packs.");
        if(copyButton!=null)copyButton.setVisibility(challenge?View.VISIBLE:View.GONE);
        if(openLoginButton!=null)openLoginButton.setVisibility(challenge?View.VISIBLE:View.GONE);
    }
    private void showLiveChat(JSONObject status){
        if(chatShown)return;
        chatShown=true;screen=Screen.CHAT;
        if(painting!=null)painting.setAnimated(false);
        frame.setOnClickListener(null);
        frame.removeAllViews(); // transcript still lives in the hidden legacy root.
        chat=new RovekinChatPanel(a,router,trustedRole);
        View chatView=chat.create(a.scroll);
        frame.addView(chatView,new FrameLayout.LayoutParams(-1,-1));
        if(status!=null)refreshChat(status);
    }
    private void refreshChat(JSONObject r){
        if(chat==null)return;
        JSONArray catalog=a.catalog;
        if(catalog==null||catalog.length()==0)catalog=a.bundledCatalog();
        RovekinFeatureContract.Runtime actual=new RovekinFeatureContract.Runtime(
            a.apiConnected,r.optBoolean("authenticated",false)
                ||r.optBoolean("spawned",false),
            r.optBoolean("spawned",false),false);
        chat.refresh(actual,RovekinCatalogAdapter.fromLiveCatalog(catalog),liveStatus);
        chat.setAvatarStatus(r);
    }
    /** Called from the existing MainActivity.update() UI callback. */
    public void onStatus(JSONObject realStatus,String legacyConnectionText){
        if(realStatus==null)return;
        lastStatus=realStatus;
        if(legacyConnectionText!=null&&!legacyConnectionText.isEmpty())liveStatus=legacyConnectionText;
        // Do not claim success on fake timers or after joined-but-not-spawned.
        if(screen==Screen.CONNECTING){
            drawRealStatus(realStatus);
            if(realStatus.optBoolean("spawned",false))showLiveChat(realStatus);
        }else if(screen==Screen.CHAT)refreshChat(realStatus);
    }
    public boolean isChatShown(){return chatShown;}
    public void onManualConnectRequested(){if(screen==Screen.CONNECTING)connect();}
}
