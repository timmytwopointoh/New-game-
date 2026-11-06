package com.veilforge.realmagent;

import android.app.Activity;
import android.content.res.ColorStateList;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.RippleDrawable;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.HorizontalScrollView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.EnumMap;
import java.util.List;

/**
 * Native, functional chat-first screen: all actions dispatch to the EXISTING
 * MainActivity through RovekinActionRouter. No duplicate chat/plan/Realm engine.
 *
 * Usage in the final reviewed MainActivity integration:
 *
 *   RovekinMainActivityHost host = new RovekinMainActivityHost(this, trustedAuth);
 *   RovekinChatPanel shell = new RovekinChatPanel(this,
 *       new RovekinActionRouter(host), trustedAuth);
 *   setContentView(shell.create(scroll)); // Existing scroll keeps log/bubbles!
 *   // In the existing status update path, after 'connection' has been updated:
 *   shell.refresh(realRuntime, realCatalog, connection.getText().toString());
 *
 * Do not enable privileged actions until trustedAuth is backed by authoritative
 * owner/developer verification. Neither botTag nor ownerTag supplies proof.
 */
public final class RovekinChatPanel {
    private static final int INK = 0xff061d13;
    private static final int BASE = 0xff062918;
    private static final int PANEL = 0xff0e4127;
    private static final int BRIGHT = 0xff81ff32;
    private static final int LIME = 0xffc1ff77;
    private static final int PAPER = 0xfff2fff1;
    private static final int FADED = 0xffadceb3;
    private static final int VIOLET = 0xffc77bff;
    private static final int EMERGENCY = 0xffce5267;

    private final Activity activity;
    private final RovekinActionRouter router;
    private final RovekinFeatureContract.Authorization authorization;
    private final EnumMap<RovekinFeatureContract.Feature,Button> controls =
        new EnumMap<>(RovekinFeatureContract.Feature.class);
    private RovekinFeatureContract.Runtime runtime =
        new RovekinFeatureContract.Runtime(false,false,false,false);
    private List<RovekinFeatureContract.Skill> catalog = Collections.emptyList();
    private TextView statusText, audienceText;
    private EditText chatInput;
    private FrameLayout root;
    private LinearLayout authorizedRow;

    public RovekinChatPanel(Activity activity, RovekinActionRouter router,
                            RovekinFeatureContract.Authorization verifiedAuthorization) {
        if (activity == null || router == null) throw new IllegalArgumentException("activity/router");
        this.activity = activity;
        this.router = router;
        this.authorization = verifiedAuthorization;
    }

    private int px(float dp) { return (int)(activity.getResources().getDisplayMetrics().density * dp + .5f); }
    private LinearLayout vertical() { LinearLayout p = new LinearLayout(activity); p.setOrientation(1); return p; }
    private GradientDrawable rounded(int fill, int stroke, int radius) {
        GradientDrawable shape = new GradientDrawable();
        shape.setColor(fill); shape.setCornerRadius(px(radius));
        shape.setStroke(px(1.5f),stroke); return shape;
    }
    private GradientDrawable background() {
        GradientDrawable shape = new GradientDrawable(GradientDrawable.Orientation.TL_BR,
            new int[]{BASE,0xff123f2a,BASE});
        shape.setCornerRadius(0f); return shape;
    }
    private TextView label(String text, int sp, int color, boolean strong) {
        TextView v = new TextView(activity);
        v.setText(text); v.setTextColor(color); v.setTextSize(sp);
        if (strong) v.setTypeface(Typeface.create("sans-serif-black", Typeface.BOLD));
        return v;
    }
    private LinearLayout.LayoutParams line(int top) {
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(-1,-2);
        p.topMargin = px(top); return p;
    }
    private Button button(String text, boolean primary, boolean danger) {
        Button b = new Button(activity);
        b.setAllCaps(false); b.setText(text);
        b.setTypeface(Typeface.create("sans-serif-medium",Typeface.BOLD));
        b.setTextSize(13); b.setMinHeight(px(48));
        b.setPadding(px(12),px(8),px(12),px(8));
        int fill=danger?0xff582633:(primary?BRIGHT:PANEL);
        int border=danger?EMERGENCY:(primary?LIME:BRIGHT);
        b.setTextColor(primary?INK:PAPER);
        b.setBackground(new RippleDrawable(ColorStateList.valueOf(0x60d4ffb0),
            rounded(fill,border,15),null));
        return b;
    }

    private boolean owner() { return authorization != null && authorization.hasVerifiedOwner(); }
    private boolean developer() {
        return owner() && authorization.hasVerifiedDeveloperEntitlement();
    }
    public View create(View existingTranscriptScroll) {
        root = new FrameLayout(activity);
        root.setBackground(background());
        LinearLayout body=vertical();
        body.setPadding(px(13),px(10),px(13),px(11));
        root.addView(body,new FrameLayout.LayoutParams(-1,-1));
        // Header does not expose the old unrestricted settings gear.
        LinearLayout header = new LinearLayout(activity);
        header.setGravity(Gravity.CENTER_VERTICAL);
        TextView mark=label("▣",26,BRIGHT,true);
        header.addView(mark,new LinearLayout.LayoutParams(px(44),px(48)));
        LinearLayout heading=vertical();
        header.addView(heading,new LinearLayout.LayoutParams(0,-2,1));
        heading.addView(label("ROVEKIN",25,PAPER,true));
        audienceText=label("PUBLIC CHAT",11,LIME,true);
        heading.addView(audienceText);
        Button connect=featureButton(RovekinFeatureContract.Feature.START_SERVICE,"CONNECT",false,false);
        header.addView(connect,new LinearLayout.LayoutParams(px(105),px(48)));
        body.addView(header,line(0));

        statusText=label("Not connected • waiting for on-device player",12,FADED,false);
        statusText.setPadding(px(13),px(11),px(13),px(11));
        statusText.setMaxLines(3);
        statusText.setBackground(rounded(PANEL,0xff275c40,12));
        body.addView(statusText,line(7));

        LinearLayout primary= new LinearLayout(activity);
        primary.setGravity(Gravity.CENTER_VERTICAL);
        Button commands = featureButton(
            RovekinFeatureContract.Feature.COMMAND_CATALOG,"ALL COMMANDS",false,false);
        Button updates = featureButton(
            RovekinFeatureContract.Feature.APP_UPDATES,"UPDATES",false,false);
        Button signin = featureButton(
            RovekinFeatureContract.Feature.MICROSOFT_SIGN_IN,"SIGN IN",false,false);
        primary.addView(commands,new LinearLayout.LayoutParams(0,px(49),1.5f));
        primary.addView(updates,new LinearLayout.LayoutParams(0,px(49),1));
        primary.addView(signin,new LinearLayout.LayoutParams(0,px(49),1));
        body.addView(primary,line(8));

        // Every public gameplay feature uses the live catalog. There is no
        // second list of hardcoded "supported commands" in the UI.
        HorizontalScrollView quickScroll=new HorizontalScrollView(activity);
        quickScroll.setHorizontalScrollBarEnabled(false);
        LinearLayout quickRow=new LinearLayout(activity);
        quickRow.setPadding(0,0,px(7),0);
        for (RovekinFeatureContract.Feature feature : Arrays.asList(
            RovekinFeatureContract.Feature.FOLLOW,
            RovekinFeatureContract.Feature.GO_HOME,
            RovekinFeatureContract.Feature.BUILD,
            RovekinFeatureContract.Feature.MINE,
            RovekinFeatureContract.Feature.FARM,
            RovekinFeatureContract.Feature.CRAFT,
            RovekinFeatureContract.Feature.INVENTORY,
            RovekinFeatureContract.Feature.RESEARCH,
            RovekinFeatureContract.Feature.LEARNING)) {
            Button b=featureButton(feature,feature.label,false,false);
            LinearLayout.LayoutParams item=new LinearLayout.LayoutParams(-2,px(50));
            item.rightMargin=px(7);quickRow.addView(b,item);
        }
        quickScroll.addView(quickRow,new ScrollView.LayoutParams(-2,-2));
        body.addView(quickScroll,line(9));

        // Reparent the CURRENT transcript scroll; existing MainActivity.log,
        // bubble() and scroll-to-bottom logic continue to work unchanged.
        FrameLayout transcriptHolder=new FrameLayout(activity);
        transcriptHolder.setBackground(rounded(0xff081f16,0xff376e41,16));
        if(existingTranscriptScroll!=null) {
            ViewGroup previous=(ViewGroup)existingTranscriptScroll.getParent();
            if(previous!=null) previous.removeView(existingTranscriptScroll);
            transcriptHolder.addView(existingTranscriptScroll,
                new FrameLayout.LayoutParams(-1,-1));
        } else {
            TextView notice=label("No live transcript attached",15,FADED,false);
            notice.setGravity(Gravity.CENTER);
            transcriptHolder.addView(notice,new FrameLayout.LayoutParams(-1,-1));
        }
        LinearLayout.LayoutParams transcriptParams=new LinearLayout.LayoutParams(-1,0,1);
        transcriptParams.topMargin=px(10);
        body.addView(transcriptHolder,transcriptParams);

        LinearLayout actions=new LinearLayout(activity);
        Button stop=featureButton(RovekinFeatureContract.Feature.EMERGENCY_STOP,"STOP",false,true);
        Button plans=featureButton(RovekinFeatureContract.Feature.SAVED_PLANS,"PLANS",false,false);
        Button queue=featureButton(RovekinFeatureContract.Feature.ACTIVATE_QUEUE,"▶ QUEUE",true,false);
        Button retry=featureButton(RovekinFeatureContract.Feature.RETRY_BLOCKED,"RETRY",false,false);
        actions.addView(stop,new LinearLayout.LayoutParams(0,px(54),1));
        actions.addView(plans,new LinearLayout.LayoutParams(0,px(54),1));
        actions.addView(queue,new LinearLayout.LayoutParams(0,px(54),1.4f));
        actions.addView(retry,new LinearLayout.LayoutParams(0,px(54),1));
        body.addView(actions,line(8));

        LinearLayout entry=new LinearLayout(activity);
        chatInput=new EditText(activity);
        chatInput.setSingleLine(true);
        chatInput.setTextColor(PAPER);
        chatInput.setHintTextColor(FADED);
        chatInput.setTextSize(16);
        chatInput.setHint("Talk to your AI player…");
        chatInput.setPadding(px(14),px(11),px(14),px(11));
        chatInput.setBackground(rounded(0xff092b1d,BRIGHT,14));
        chatInput.setImeOptions(android.view.inputmethod.EditorInfo.IME_ACTION_SEND);
        entry.addView(chatInput,new LinearLayout.LayoutParams(0,px(53),1));
        Button send=featureButton(RovekinFeatureContract.Feature.CHAT,"SEND",true,false);
        entry.addView(send,new LinearLayout.LayoutParams(px(86),px(53)));
        chatInput.setOnEditorActionListener((v,action,event)->{
            if(action==android.view.inputmethod.EditorInfo.IME_ACTION_SEND) {
                dispatch(RovekinFeatureContract.Feature.CHAT);return true;
            }return false;
        });
        body.addView(entry,line(8));

        authorizedRow=new LinearLayout(activity);
        body.addView(authorizedRow,line(8));
        refresh(runtime,catalog,"Waiting for real connection status");
        return root;
    }

    private Button featureButton(RovekinFeatureContract.Feature f, String text,
                                 boolean primary,boolean danger) {
        Button b=button(text,primary,danger);
        controls.put(f,b);
        b.setContentDescription(text);
        b.setOnClickListener(v->dispatch(f));
        return b;
    }

    private void dispatch(RovekinFeatureContract.Feature feature) {
        String chat=feature==RovekinFeatureContract.Feature.CHAT
            && chatInput!=null ? chatInput.getText().toString().trim() : "";
        RovekinActionRouter.Result r=router.dispatch(feature,authorization,runtime,catalog,chat);
        if(r==RovekinActionRouter.Result.HANDLED) {
            if(feature==RovekinFeatureContract.Feature.CHAT && chatInput!=null)
                chatInput.setText("");
            return;
        }
        String detail=RovekinFeatureContract.status(feature,authorization,runtime,catalog).explanation;
        if(detail.isEmpty()) {
            detail=r==RovekinActionRouter.Result.ACCESS_DENIED?"Account permission required."
                :r==RovekinActionRouter.Result.NOT_READY?"Waiting for bot/Realm status."
                :"Not supported by the current bot version.";
        }
        Toast.makeText(activity,detail,Toast.LENGTH_SHORT).show();
    }

    /**
     * Feed only genuine controller status and current /catalog results. Call after
     * the original MainActivity has updated the status and transcript.
     */
    public void refresh(RovekinFeatureContract.Runtime actual,
                        List<RovekinFeatureContract.Skill> actualCatalog,
                        String realStatus) {
        if(actual!=null) runtime=actual;
        if(actualCatalog!=null) catalog=new ArrayList<>(actualCatalog);
        if(statusText==null) return;
        String visibleStatus=realStatus==null || realStatus.trim().isEmpty()
            ? "Status unknown" : realStatus.trim();
        statusText.setText(visibleStatus);
        if(audienceText!=null) audienceText.setText(
            developer() ? "DEVELOPER ACCESS" : owner() ? "OWNER ACCESS" : "PUBLIC CHAT");
        // Status is advisory only. Buttons stay tappable to explain unavailable
        // features; dispatch still checks access/availability.
        for(java.util.Map.Entry<RovekinFeatureContract.Feature,Button> entry:controls.entrySet()) {
            RovekinFeatureContract.FeatureStatus status=RovekinFeatureContract.status(
                entry.getKey(),authorization,runtime,catalog);
            Button b=entry.getValue();
            if(b!=null) {
                b.setAlpha(status.enabled()?1f:.55f);
                b.setContentDescription(entry.getKey().label +
                    (status.enabled()?"":": "+status.explanation));
            }
        }
        if(authorizedRow!=null) {
            authorizedRow.removeAllViews();
            if(owner()) {
                Button ownerBtn=featureButton(RovekinFeatureContract.Feature.ACCOUNT_SETTINGS,
                    "OWNER CONTROLS",false,false);
                authorizedRow.addView(ownerBtn,new LinearLayout.LayoutParams(0,px(44),1));
            }
            if(developer()) {
                Button devBtn=featureButton(RovekinFeatureContract.Feature.DEV_CONSOLE,
                    "DEVELOPER CONSOLE",false,false);
                authorizedRow.addView(devBtn,new LinearLayout.LayoutParams(0,px(44),1));
                Button report=featureButton(RovekinFeatureContract.Feature.DIAGNOSTIC_EXPORT,
                    "EXPORT REPORT",false,false);
                authorizedRow.addView(report,new LinearLayout.LayoutParams(0,px(44),1));
            }
        }
    }
}
