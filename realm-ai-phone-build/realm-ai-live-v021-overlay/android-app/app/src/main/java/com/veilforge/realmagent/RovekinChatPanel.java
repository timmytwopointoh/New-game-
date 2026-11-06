package com.veilforge.realmagent;

import android.app.Activity;
import android.content.res.ColorStateList;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.RippleDrawable;
import android.view.Gravity;
import android.view.WindowInsets;
import android.os.Build;
import android.graphics.Insets;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;
import org.json.JSONObject;
import java.util.Collections;
import java.util.ArrayList;
import java.util.List;

/**
 * Three controls, one chat bar, real transcript and a real-status pixel friend.
 * START, STOP and SEND still call the existing MainActivity and BotService.
 * Hidden owner tools require verified authorization (long press logo).
 */
public final class RovekinChatPanel {
    private static final int INK=0xff051e15, PAPER=0xffefffee,
        LIME=0xffaaff6c, VIOLET=0xffdb9aff, DIM=0xffb1d5bf;
    private final Activity activity;
    private final RovekinActionRouter router;
    private final RovekinFeatureContract.Authorization authorization;
    private RovekinFeatureContract.Runtime runtime=
        new RovekinFeatureContract.Runtime(false,false,false,false);
    private List<RovekinFeatureContract.Skill> catalog=Collections.emptyList();
    private EditText input;
    private TextView statusText;
    private RovekinPixelCompanion buddy;
    private FrameLayout root;
    private Button start,stop,send;
    public RovekinChatPanel(Activity activity,RovekinActionRouter router,
                            RovekinFeatureContract.Authorization authorization){
        this.activity=activity;this.router=router;this.authorization=authorization;
    }
    private int dp(float v){return (int)(v*activity.getResources().getDisplayMetrics().density+.5f);}
    static int safeBottomPaddingPx(int bottomInsetPx,int minPx,int gutterPx){
        return Math.max(minPx,Math.max(0,bottomInsetPx)+gutterPx);
    }
    private GradientDrawable grad(int[] colors,int border,int corner){
        GradientDrawable g=new GradientDrawable(GradientDrawable.Orientation.TL_BR,colors);
        g.setCornerRadius(dp(corner));g.setStroke(dp(1.6f),border);return g;
    }
    private TextView label(String text,int size,int color,boolean bold){
        TextView v=new TextView(activity);v.setText(text);v.setTextSize(size);
        v.setTextColor(color);
        if(bold)v.setTypeface(Typeface.create("sans-serif-black",Typeface.BOLD));
        return v;
    }
    private LinearLayout column(){LinearLayout l=new LinearLayout(activity);l.setOrientation(1);return l;}
    private LinearLayout.LayoutParams below(int gap){
        LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,-2);p.topMargin=dp(gap);return p;
    }
    private Button button(String name,boolean bright,boolean danger,RovekinFeatureContract.Feature feature){
        Button b=new Button(activity);b.setAllCaps(false);b.setText(name);b.setTextSize(14);
        b.setTypeface(Typeface.create("sans-serif-black",Typeface.BOLD));
        b.setTextColor(bright?INK:PAPER);
        b.setMinHeight(dp(51));b.setMinimumWidth(0);
        b.setPadding(dp(12),dp(8),dp(12),dp(8));
        int[] colors=danger?
            new int[]{0xff8b3646,0xff5d2336,0xff321820}:
            bright?new int[]{0xffecffcb,0xffaaff66,0xff52b72e}:
                   new int[]{0xff316e4a,0xff15432d,0xff0b2c24};
        int stroke=danger?0xffff9cba:bright?0xffddffbc:0xff7eea71;
        b.setBackground(new RippleDrawable(ColorStateList.valueOf(0x88eee2ff),grad(colors,stroke,17),null));
        b.setElevation(dp(5));
        b.setOnTouchListener((view,event)->{
            if(event.getActionMasked()==MotionEvent.ACTION_DOWN){
                view.animate().scaleX(.95f).scaleY(.95f).translationY(dp(2)).setDuration(90).start();
            } else if(event.getActionMasked()==MotionEvent.ACTION_UP||event.getActionMasked()==MotionEvent.ACTION_CANCEL){
                view.animate().scaleX(1f).scaleY(1f).translationY(0).setDuration(165).start();
            }
            return false;
        });
        b.setContentDescription(name);
        b.setOnClickListener(v->dispatch(feature));
        return b;
    }
    private boolean verifiedOwner(){return authorization!=null&&authorization.hasVerifiedOwner();}
    private boolean verifiedDeveloper(){return verifiedOwner()&&authorization.hasVerifiedDeveloperEntitlement();}
    public View create(View existingTranscriptScroll){
        root=new FrameLayout(activity);
        root.setBackground(grad(new int[]{0xff052718,0xff123c28,0xff061d1d},0xff063923,0));
        // Particles belong to each newly appearing AI reply, NOT the chat background.
        LinearLayout body=column();
        body.setPadding(dp(12),dp(8),dp(12),dp(10));
        root.addView(body,new FrameLayout.LayoutParams(-1,-1));
        // Never let gesture bars or the on-screen keyboard cover the input.
        // Android 11+ supplies actual system/IME insets; older devices rely
        // on adjustResize with an additional comfortable 18dp bottom gutter.
        root.setOnApplyWindowInsetsListener((view,insets)->{
            int bottom=0,top=0;
            if(Build.VERSION.SDK_INT>=30){
                Insets nav=insets.getInsets(WindowInsets.Type.navigationBars());
                Insets ime=insets.getInsets(WindowInsets.Type.ime());
                Insets systemTop=insets.getInsets(WindowInsets.Type.statusBars());
                bottom=Math.max(nav.bottom,ime.bottom);
                top=systemTop.top;
            }else {bottom=insets.getSystemWindowInsetBottom();top=insets.getSystemWindowInsetTop();}
            // On edge-to-edge phones, keep the top control BELOW the actual status bar.
            // On legacy non-edge-to-edge phones retain a quiet extra gutter.
            view.setPadding(0,Math.max(dp(14),top+dp(12)),0,safeBottomPaddingPx(bottom,dp(18),dp(12)));
            return insets;
        });
        root.post(root::requestApplyInsets);

        LinearLayout top=new LinearLayout(activity);top.setGravity(Gravity.CENTER_VERTICAL);
        TextView logo=label("ROVEKIN",22,PAPER,true);
        logo.setLetterSpacing(.12f);logo.setShadowLayer(dp(7),0,dp(1),0xaa87e46f);
        // This is a small recessed utility built INTO the top border,
        // not an extra main action button.
        TextView reconnect=label("↻",25,VIOLET,true);
        reconnect.setGravity(Gravity.CENTER);
        reconnect.setContentDescription("Save a diagnostic ZIP to Downloads, then reconnect to Realm");
        reconnect.setBackground(new RippleDrawable(ColorStateList.valueOf(0x66f6dbff),
            grad(new int[]{0xff1f453c,0xff162a38,0xff1c1635},0xffb17ef5,13),null));
        reconnect.setOnClickListener(v->dispatch(RovekinFeatureContract.Feature.RECONNECT_WITH_DIAGNOSTICS));
        // Minimum 48dp touch target, inset into the header border rather than
        // floating in the Android clock / status-bar area.
        LinearLayout.LayoutParams reconnectLP=new LinearLayout.LayoutParams(dp(50),dp(48));
        reconnectLP.rightMargin=dp(9);
        top.addView(reconnect,reconnectLP);
        top.addView(logo,new LinearLayout.LayoutParams(0,dp(48),1));
        logo.setContentDescription("Rovekin");
        // All advanced operations remain in original host, not on the public screen.
        logo.setOnLongClickListener(v->{
            if(verifiedDeveloper())dispatch(RovekinFeatureContract.Feature.DEV_CONSOLE);
            else if(verifiedOwner())dispatch(RovekinFeatureContract.Feature.ACCOUNT_SETTINGS);
            return true;
        });
        statusText=label("Connecting to your AI…",11,DIM,false);
        statusText.setGravity(Gravity.RIGHT|Gravity.CENTER_VERTICAL);
        statusText.setMaxLines(2);statusText.setMaxWidth(dp(180));
        top.addView(statusText,new LinearLayout.LayoutParams(-2,dp(48)));
        body.addView(top,below(0));
        RovekinDripBar drips=new RovekinDripBar(activity);
        body.addView(drips,new LinearLayout.LayoutParams(-1,dp(19)));

        FrameLayout transcriptHolder=new FrameLayout(activity);
        transcriptHolder.setBackground(grad(
           new int[]{0xd8081e17,0xd80b2d22,0xe8071b17},0xff2f7146,21));
        if(existingTranscriptScroll!=null){
            ViewGroup prior=(ViewGroup)existingTranscriptScroll.getParent();
            if(prior!=null)prior.removeView(existingTranscriptScroll);
            FrameLayout.LayoutParams transcriptLP=new FrameLayout.LayoutParams(-1,-1);
            transcriptLP.bottomMargin=dp(117); // pixel friend remains out of message flow
            transcriptHolder.addView(existingTranscriptScroll,transcriptLP);
        }
        // Tiny animated status avatar sits in bottom-right inside conversation.
        buddy=new RovekinPixelCompanion(activity);
        FrameLayout.LayoutParams buddyLP=new FrameLayout.LayoutParams(dp(103),dp(107),Gravity.RIGHT|Gravity.BOTTOM);
        buddyLP.rightMargin=dp(5);buddyLP.bottomMargin=dp(4);
        transcriptHolder.addView(buddy,buddyLP);
        LinearLayout.LayoutParams transcript=new LinearLayout.LayoutParams(-1,0,1);
        transcript.topMargin=dp(6);
        body.addView(transcriptHolder,transcript);

        // Exactly two stand-alone action buttons: cutoff and start.
        LinearLayout actions=new LinearLayout(activity);
        stop=button("STOP",false,true,RovekinFeatureContract.Feature.EMERGENCY_STOP);
        stop.setContentDescription("Stop the current action; keep Rovekin connected");
        start=button("START",true,false,RovekinFeatureContract.Feature.START_SERVICE);
        LinearLayout.LayoutParams s1=new LinearLayout.LayoutParams(0,dp(51),1f);
        s1.rightMargin=dp(8);
        actions.addView(stop,s1);
        actions.addView(start,new LinearLayout.LayoutParams(0,dp(51),1f));
        body.addView(actions,below(7));

        LinearLayout bar=new LinearLayout(activity);
        bar.setGravity(Gravity.CENTER_VERTICAL);
        input=new EditText(activity);input.setSingleLine(true);
        input.setHint("Message your companion…");
        input.setHintTextColor(0xff9ab7a7);
        input.setTextColor(PAPER);input.setTextSize(15);
        input.setPadding(dp(14),dp(9),dp(12),dp(9));
        input.setImeOptions(android.view.inputmethod.EditorInfo.IME_ACTION_SEND);
        input.setBackground(grad(new int[]{0xff164734,0xff0c3028,0xff0b241e},0xff6bcf66,17));
        LinearLayout.LayoutParams ilp=new LinearLayout.LayoutParams(0,dp(53),1);
        ilp.rightMargin=dp(8);bar.addView(input,ilp);
        send=button("SEND",true,false,RovekinFeatureContract.Feature.CHAT);
        bar.addView(send,new LinearLayout.LayoutParams(dp(78),dp(53)));
        input.setOnEditorActionListener((view,action,event)->{
            if(action==android.view.inputmethod.EditorInfo.IME_ACTION_SEND){
                dispatch(RovekinFeatureContract.Feature.CHAT);return true;
            }
            return false;
        });
        body.addView(bar,below(8));
        return root;
    }
    private void dispatch(RovekinFeatureContract.Feature feature){
        String message=feature==RovekinFeatureContract.Feature.CHAT&&input!=null?
            input.getText().toString().trim():"";
        if(feature==RovekinFeatureContract.Feature.CHAT&&message.isEmpty())return;
        RovekinActionRouter.Result result=
            router.dispatch(feature,authorization,runtime,catalog,message);
        if(result==RovekinActionRouter.Result.HANDLED){
            if(feature==RovekinFeatureContract.Feature.CHAT&&input!=null)input.setText("");
            return;
        }
        String reason=RovekinFeatureContract.status(feature,authorization,runtime,catalog).explanation;
        if(reason.isEmpty())reason=result==RovekinActionRouter.Result.NOT_READY?
            "Waiting for Realm connection":result==RovekinActionRouter.Result.ACCESS_DENIED?
            "Owner access required":"This action is unavailable";
        Toast.makeText(activity,reason,Toast.LENGTH_SHORT).show();
    }
    public void refresh(RovekinFeatureContract.Runtime actual,
                        List<RovekinFeatureContract.Skill> actualCatalog,String status){
        if(actual!=null)runtime=actual;
        if(actualCatalog!=null)catalog=new ArrayList<>(actualCatalog);
        if(statusText!=null){
            String text=runtime.spawned?"● IN REALM":
                runtime.controllerConnected?"● CONNECTING":"○ OFFLINE";
            statusText.setText(text);
            statusText.setTextColor(runtime.spawned?LIME:VIOLET);
            // The full status stays in accessibility, rather than covering the chat.
            statusText.setContentDescription(status==null?text:status);
        }
        if(start!=null)start.setAlpha(runtime.controllerConnected?.65f:1f);
        if(buddy!=null)buddy.setContentDescription(buddy.getContentDescription());
    }
    public void setAvatarStatus(JSONObject realControllerStatus){
        if(buddy!=null)buddy.setLiveState(realControllerStatus);
    }
}
