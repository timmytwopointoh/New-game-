package com.veilforge.rovekin.preview;

import android.app.Activity;
import android.app.AlertDialog;
import android.os.Bundle;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Intent;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import android.graphics.Shader;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.animation.LinearInterpolator;
import android.animation.ObjectAnimator;
import android.animation.ValueAnimator;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;
import java.util.Locale;

/**
 * Standalone Android-native UI preview (not the live bot controller).
 * No networking, no fake Microsoft code, no credential access, no Realm activity.
 * The production integration must subscribe to real BotService status events.
 */
public final class RovekinPreviewActivity extends Activity {
    private static final int DEEP = Color.rgb(5, 28, 17);
    private static final int FOREST = Color.rgb(8, 49, 30);
    private static final int PANEL = Color.rgb(13, 67, 38);
    private static final int GREEN = Color.rgb(109, 255, 42);
    private static final int LIME = Color.rgb(180, 255, 89);
    private static final int WHITE = Color.rgb(243, 255, 236);
    private static final int MUTED = Color.rgb(172, 214, 168);
    private static final int VIOLET = Color.rgb(200, 111, 255);
    private static final int RED = Color.rgb(222, 83, 93);
    private RovekinFlow flow;
    private FrameLayout stage;
    private EditText nameInput;
    private TextView errorLabel;
    private ObjectAnimator splashBob, promptBob;

    private int dp(float v) { return (int)(v * getResources().getDisplayMetrics().density + .5f); }
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(DEEP);
        getWindow().setNavigationBarColor(DEEP);
        flow = new RovekinFlow(
            getPreferences(MODE_PRIVATE).getString("botTag", ""),
            getPreferences(MODE_PRIVATE).getString("ownerTag", ""));
        render();
    }
    private GradientDrawable rounded(int color, float radius) {
        GradientDrawable g = new GradientDrawable();
        g.setColor(color); g.setCornerRadius(dp(radius));
        g.setStroke(dp(1.5f), GREEN);
        return g;
    }
    private GradientDrawable bright() {
        GradientDrawable g = new GradientDrawable(GradientDrawable.Orientation.TL_BR,
            new int[] { LIME, GREEN, Color.rgb(43, 200, 21) });
        g.setCornerRadius(dp(17));
        g.setStroke(dp(1), Color.rgb(207, 255, 143));
        return g;
    }
    private TextView text(String s, int sp, int color, boolean bold) {
        TextView t = new TextView(this);
        t.setText(s); t.setTextColor(color); t.setTextSize(sp);
        if (bold) t.setTypeface(Typeface.create("sans-serif-black", Typeface.BOLD));
        return t;
    }
    private LinearLayout column() {
        LinearLayout c = new LinearLayout(this);
        c.setOrientation(LinearLayout.VERTICAL);
        return c;
    }
    private void add(LinearLayout parent, View view, int top) {
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(-1, -2);
        p.topMargin = dp(top); parent.addView(view, p);
    }
    private void center(LinearLayout parent, View v, int top) {
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(-1, -2);
        p.gravity = Gravity.CENTER_HORIZONTAL; p.topMargin = dp(top); parent.addView(v, p);
    }
    private Button button(String title, Runnable action) {
        Button b = new Button(this);
        b.setAllCaps(false); b.setText(title);
        b.setTextColor(DEEP); b.setTextSize(16);
        b.setTypeface(Typeface.create("sans-serif-black", Typeface.BOLD));
        b.setBackground(bright());
        b.setMinimumHeight(dp(55)); b.setPadding(dp(12), dp(10), dp(12), dp(10));
        b.setOnClickListener(v -> action.run());
        return b;
    }
    private Button darkButton(String title, Runnable action) {
        Button b = button(title, action);
        b.setBackground(rounded(PANEL, 17)); b.setTextColor(WHITE);
        return b;
    }
    private void show(String title) {
        Toast.makeText(this, title + " — preview only", Toast.LENGTH_SHORT).show();
    }
    private LinearLayout frameContent(boolean centered) {
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true); scroll.setVerticalScrollBarEnabled(false);
        LinearLayout body = column();
        body.setGravity(centered ? Gravity.CENTER : Gravity.TOP);
        body.setPadding(dp(22), dp(23), dp(22), dp(28));
        scroll.addView(body);
        stage.addView(scroll, new FrameLayout.LayoutParams(-1, -1));
        return body;
    }
    private void brand(LinearLayout body, String heading, String detail) {
        LogoView logo = new LogoView();
        LinearLayout.LayoutParams image = new LinearLayout.LayoutParams(dp(112), dp(112));
        image.gravity = Gravity.CENTER_HORIZONTAL; image.bottomMargin = dp(13);
        body.addView(logo, image);
        TextView head = text(heading, 26, WHITE, true);
        head.setGravity(Gravity.CENTER); center(body, head, 5);
        TextView small = text(detail, 14, MUTED, false);
        small.setGravity(Gravity.CENTER); center(body, small, 9);
    }
    private void render() {
        if (splashBob != null) { splashBob.cancel(); splashBob = null; }
        if (promptBob != null) { promptBob.cancel(); promptBob = null; }
        stage = new FrameLayout(this);
        stage.setBackgroundColor(DEEP);
        stage.setOnApplyWindowInsetsListener((v, insets) -> {
            if (android.os.Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets safe = insets.getInsets(
                    android.view.WindowInsets.Type.systemBars());
                v.setPadding(safe.left, safe.top, safe.right, safe.bottom);
            }
            return insets;
        });
        stage.requestApplyInsets();
        stage.addView(new ParticleBackdrop(), new FrameLayout.LayoutParams(-1, -1));
        setContentView(stage);
        switch (flow.screen()) {
            case SPLASH: splash(); break;
            case AI_NAME: aiName(); break;
            case INVITER_NAME: inviterName(); break;
            case MICROSOFT: microsoft(); break;
            case JOINING: joining(); break;
            case CHAT: chat(); break;
        }
    }
    private void splash() {
        LinearLayout body = frameContent(true);
        LogoView logo = new LogoView();
        LinearLayout.LayoutParams pic = new LinearLayout.LayoutParams(dp(172), dp(172));
        pic.gravity = Gravity.CENTER_HORIZONTAL; body.addView(logo, pic);
        ObjectAnimator bob = ObjectAnimator.ofFloat(logo, "translationY", 0, -dp(11), 0);
        bob.setDuration(2400); bob.setRepeatCount(ValueAnimator.INFINITE);
        bob.setInterpolator(new LinearInterpolator()); splashBob = bob; bob.start();
        TextView name = text("ROVEKIN", 39, WHITE, true);
        name.setLetterSpacing(.08f); name.setGravity(Gravity.CENTER); center(body, name, 22);
        TextView label = text("YOUR WORLD. YOUR COMPANION.", 12, LIME, true);
        label.setGravity(Gravity.CENTER); label.setLetterSpacing(.12f);
        center(body, label, 6);
        TextView prompt = text("TAP ANYWHERE TO BEGIN", 17, WHITE, true);
        prompt.setPadding(dp(12), dp(17), dp(12), dp(17));
        prompt.setGravity(Gravity.CENTER); prompt.setBackground(rounded(PANEL, 19));
        add(body, prompt, 64);
        ObjectAnimator floatPrompt = ObjectAnimator.ofFloat(prompt, "translationY", 0, -dp(6), 0);
        floatPrompt.setRepeatCount(ValueAnimator.INFINITE);
        floatPrompt.setDuration(2800); promptBob = floatPrompt; floatPrompt.start();
        TextView footer = text("Independent gaming companion • Menu preview", 11, MUTED, false);
        footer.setGravity(Gravity.CENTER); center(body, footer, 17);
        // Transparent full-screen touch target above the artwork: even taps on
        // the scroll container or character activate the splash reliably.
        View tapLayer = new View(this);
        tapLayer.setContentDescription("Tap anywhere to begin");
        tapLayer.setOnClickListener(v -> { flow.tapAnywhere(); render(); });
        stage.addView(tapLayer, new FrameLayout.LayoutParams(-1, -1));
    }
    private EditText field(String hint, String pref) {
        EditText e = new EditText(this);
        e.setSingleLine(true); e.setTextColor(WHITE); e.setHintTextColor(MUTED);
        e.setTextSize(18); e.setHint(hint); e.setText(pref);
        e.setSelectAllOnFocus(false);
        e.setBackground(rounded(FOREST, 16));
        e.setPadding(dp(16), dp(15), dp(16), dp(15));
        e.setInputType(android.text.InputType.TYPE_CLASS_TEXT
                        | android.text.InputType.TYPE_TEXT_FLAG_CAP_WORDS);
        return e;
    }
    private void addError(LinearLayout body) {
        errorLabel = text("", 13, Color.rgb(255, 171, 174), false);
        add(body, errorLabel, 11);
    }
    private void aiName() {
        LinearLayout body = frameContent(true);
        brand(body, "Name your AI player", "FIRST-TIME SETUP  •  STEP 1 OF 2");
        add(body, text("Enter the Minecraft/Xbox gamertag used by your separate AI account.", 16, WHITE, false), 31);
        nameInput = field("AI player's gamertag", flow.botTag());
        add(body, nameInput, 13);
        addError(body);
        add(body, button("CONTINUE  ›", () -> {
            String problem = flow.continueBot(nameInput.getText().toString());
            if (!problem.isEmpty()) { errorLabel.setText(problem); return; }
            render();
        }), 22);
    }
    private void inviterName() {
        LinearLayout body = frameContent(true);
        brand(body, "Who invited your AI?", "FIRST-TIME SETUP  •  STEP 2 OF 2");
        add(body, text("Enter the Minecraft gamertag of the Realm invite sender or companion owner.", 16, WHITE, false), 31);
        nameInput = field("Realm invite player's gamertag", flow.ownerTag());
        add(body, nameInput, 13);
        addError(body);
        add(body, text("This is not the AI's Microsoft login. Another player can be assigned to use the companion later with the owner's permission.", 12, MUTED, false), 15);
        add(body, button("CONTINUE  ›", () -> {
            String problem = flow.continueInviter(nameInput.getText().toString());
            if (!problem.isEmpty()) { errorLabel.setText(problem); return; }
            getPreferences(MODE_PRIVATE).edit()
                .putString("botTag", flow.botTag())
                .putString("ownerTag", flow.ownerTag()).apply();
            render();
        }), 22);
        add(body, darkButton("‹  BACK", () -> { flow = new RovekinFlow(flow.botTag(), ""); flow.tapAnywhere(); render(); }), 9);
    }
    private void microsoft() {
        LinearLayout body = frameContent(true);
        brand(body, "Microsoft sign-in", "STEP 3  •  CONNECT YOUR AI ACCOUNT");
        TextView info = text("Waiting for the real client to check the saved Microsoft session…", 16, WHITE, false);
        info.setGravity(Gravity.CENTER); add(body, info, 28);
        TextView code = text(flow.hasActualDeviceCode() ? flow.deviceCode() : "No sign-in code requested yet", 20, LIME, true);
        code.setGravity(Gravity.CENTER); code.setPadding(dp(14), dp(21), dp(14), dp(21));
        code.setBackground(rounded(FOREST, 16)); add(body, code, 17);
        Button copy = button("COPY SIGN-IN CODE", () -> {
            ClipboardManager clip = (ClipboardManager)getSystemService(CLIPBOARD_SERVICE);
            clip.setPrimaryClip(ClipData.newPlainText("Microsoft sign-in code", flow.deviceCode()));
            Toast.makeText(this, "Code copied", Toast.LENGTH_SHORT).show();
        });
        copy.setEnabled(flow.hasActualDeviceCode()); add(body, copy, 14);
        Button open = darkButton("OPEN MICROSOFT SIGN-IN PAGE", () -> {
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(flow.verificationUrl())));
        });
        open.setEnabled(flow.hasActualDeviceCode()); add(body, open, 9);
        TextView note = text("Only the existing bot connection may supply a real user code and verification URL. A valid saved session skips re-login.", 12, MUTED, false);
        note.setGravity(Gravity.CENTER); add(body, note, 18);
        add(body, darkButton("VIEW CHAT LAYOUT (DESIGN PREVIEW ONLY)", () -> {
            flow.showDesignPreviewChat(); render();
        }), 32);
    }
    private void joining() {
        LinearLayout body = frameContent(true);
        brand(body, "Joining your Realm", "MICROSOFT APPROVED");
        for (String s : new String[]{"✓  Microsoft session confirmed", "◌  Discovering invited Realms",
            "◌  Connecting and loading packs", "◌  Waiting for actual player spawn"}) {
            TextView line = text(s, 17, WHITE, false);
            line.setPadding(dp(14), dp(11), dp(14), dp(11));
            line.setBackground(rounded(FOREST, 13)); add(body, line, 10);
        }
        TextView note = text("Chat opens only after the server confirms both Realm and spawn. This standalone preview does not join Realms.", 13, MUTED, false);
        note.setGravity(Gravity.CENTER); add(body, note, 25);
    }
    private void chat() {
        LinearLayout body = frameContent(false);
        LinearLayout header = new LinearLayout(this);
        header.setGravity(Gravity.CENTER_VERTICAL);
        LogoView logo = new LogoView();
        header.addView(logo, new LinearLayout.LayoutParams(dp(48), dp(48)));
        TextView title = text("ROVEKIN", 24, WHITE, true);
        LinearLayout.LayoutParams tp = new LinearLayout.LayoutParams(0, -2, 1);
        tp.leftMargin = dp(12); header.addView(title, tp);
        Button power = darkButton("POWER", () -> show("Power"));
        header.addView(power, new LinearLayout.LayoutParams(dp(96), dp(48)));
        add(body, header, 4);
        TextView status = text("●  DESIGN PREVIEW • NOT CONNECTED", 12, LIME, true);
        status.setPadding(dp(13), dp(12), dp(13), dp(12));
        status.setBackground(rounded(FOREST, 13)); add(body, status, 12);
        add(body, darkButton("UPDATES", () -> show("Updates")), 11);
        TextView welcome = text("Companion chat", 21, WHITE, true);
        add(body, welcome, 24);
        TextView response = text("Welcome! This is the new layout for your separate AI player, "
            + flow.botTag() + ". The live bot and the Realm are not connected in this design preview.", 16, WHITE, false);
        response.setPadding(dp(16), dp(16), dp(16), dp(16));
        response.setBackground(rounded(PANEL, 18)); add(body, response, 12);
        add(body, text("All real chat, commands, saved plans, inventory and world events will still come from the existing controller.", 13, MUTED, false), 11);
        LinearLayout actions = new LinearLayout(this);
        Button stop = darkButton("STOP", () -> { flow.setStop(true); show("STOP"); });
        stop.setTextColor(Color.rgb(255, 175, 178));
        Button activate = button("▶  ACTIVATE", () -> show("Activate queued jobs"));
        Button commands = darkButton("COMMANDS", () -> show("Commands"));
        actions.addView(stop, new LinearLayout.LayoutParams(0, dp(58), 1));
        actions.addView(activate, new LinearLayout.LayoutParams(0, dp(58), 1.6f));
        actions.addView(commands, new LinearLayout.LayoutParams(0, dp(58), 1.3f));
        add(body, actions, 31);
        EditText command = field("Ask or tell me a task…", "");
        add(body, command, 15);
        add(body, button("SEND COMMAND  ↑", () -> {
            if (command.getText().length() > 0) show("Send command");
        }), 10);
        TextView footer = text("No gear button • Profile/admin controls remain separate from everyday chat.", 12, MUTED, false);
        footer.setGravity(Gravity.CENTER); add(body, footer, 30);
        title.setOnLongClickListener(v -> {
            new AlertDialog.Builder(this).setTitle("Rovekin design preview")
                .setMessage("Future owner-only Manage screen will include Realm, delegated assistants, diagnostics and account settings. This preview never changes the live app.")
                .setPositiveButton("OK", null).show(); return true;
        });
    }

    /** Original rounded green companion symbol, not a Minecraft/Microsoft logo. */
    private final class LogoView extends View {
        private final Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        LogoView() { super(RovekinPreviewActivity.this); setContentDescription("Rovekin floating robot emblem"); }
        private void rect(Canvas c, int color, float l, float t, float r, float b, float rad) {
            p.setColor(color); p.setStyle(Paint.Style.FILL);
            c.drawRoundRect(new RectF(l,t,r,b),rad,rad,p);
        }
        @Override protected void onDraw(Canvas actual) {
            Canvas c = actual;
            float w = getWidth(), h = getHeight();
            c.save(); c.translate(w*.12f,h*.10f); c.scale(w*.76f/100f, h*.76f/100f);
            rect(c, GREEN, 5,13,95,91,19);
            rect(c, LIME, 12,7,83,32,9);
            rect(c, 0xffa6b2ac, 18,10,82,79,17);
            rect(c, 0xff243f42, 11,24,89,83,14);
            rect(c, 0xff210c36, 19,27,81,76,12);
            rect(c, VIOLET, 32,39,43,61,4);
            rect(c, VIOLET, 57,39,68,61,4);
            rect(c, GREEN, 3,45,16,73,7);
            rect(c, GREEN, 84,45,97,73,7);
            rect(c, 0xffb7ff88, 35,83,65,94,5);
            c.restore();
        }
    }

    private final class ParticleBackdrop extends View {
        private final Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final float[] x = new float[36], y = new float[36], radius = new float[36];
        private final long started = System.currentTimeMillis();
        ParticleBackdrop() {
            super(RovekinPreviewActivity.this);
            java.util.Random rng = new java.util.Random(261107);
            for (int i=0;i<x.length;i++) {
                x[i]=rng.nextFloat(); y[i]=rng.nextFloat();
                radius[i] = 1 + rng.nextFloat()*3;
            }
        }
        @Override protected void onDraw(Canvas c) {
            int w=getWidth(),h=getHeight();
            p.setShader(new LinearGradient(0,0,w,h,DEEP,FOREST,Shader.TileMode.CLAMP));
            c.drawRect(0,0,w,h,p);p.setShader(null);
            float s=dp(24);
            for (int j=0;j<4;j++) for (int i=0;i<(w/s)+2;i++) {
                p.setColor(((j+i)&1)==0 ? 0xff134d24 : 0xff0b3820);
                c.drawRect(i*s,j*s,(i+1)*s,(j+1)*s,p);
                c.drawRect(i*s,h-(j+1)*s,(i+1)*s,h-j*s,p);
            }
            double seconds=(System.currentTimeMillis()-started)/1000.0;
            for (int i=0;i<x.length;i++) {
                float px=x[i]*w+(float)Math.sin(seconds*.7+i)*dp(5);
                float py=(float)((y[i]*h-seconds*(10+i%6))%h);
                if(py<0)py+=h;
                p.setColor(i%4==0 ? 0xffd486ff : 0xff7d2fb3);
                float z=dp(radius[i]); c.drawRect(px,py,px+z,py+z,p);
            }
            postInvalidateDelayed(40);
        }
    }
}
