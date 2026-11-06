package com.veilforge.realmagent;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.drawable.GradientDrawable;
import android.os.SystemClock;
import android.view.View;
import android.view.ViewGroup;
import android.view.animation.OvershootInterpolator;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

/** One short-lived, particle-wrapped AI message. Never used for the owner's messages. */
public final class RovekinNetherBubble extends FrameLayout {
    private static final int PARTICLES=30;
    public static boolean isAiSpeaker(String speaker,boolean mine){
        if(mine)return false;
        if(speaker==null)return false;
        String s=speaker.trim().toLowerCase(java.util.Locale.ROOT);
        return s.equals("veilforge")||s.equals("rovekin")||s.equals("ai")||s.equals("bot");
    }
    private static int dp(Context context,float v){
        return Math.round(v*context.getResources().getDisplayMetrics().density);
    }
    private final ParticleHalo halo;
    public RovekinNetherBubble(Context context,String message,int maxWidthPx){
        super(context);
        setClipChildren(false);
        setClipToPadding(false);
        setPadding(dp(context,7),dp(context,7),dp(context,7),dp(context,7));
        halo=new ParticleHalo(context);
        addView(halo,new FrameLayout.LayoutParams(-1,-1));

        LinearLayout backdrop=new LinearLayout(context);
        backdrop.setOrientation(LinearLayout.VERTICAL);
        backdrop.setPadding(dp(context,13),dp(context,10),dp(context,13),dp(context,11));
        GradientDrawable body=new GradientDrawable(
            GradientDrawable.Orientation.TL_BR,
            new int[]{0xff50205e,0xff38234e,0xff202e35});
        body.setCornerRadius(dp(context,19));
        body.setStroke(dp(context,1.4f),0xffaa75fa);
        backdrop.setBackground(body);
        backdrop.setElevation(dp(context,3));
        FrameLayout.LayoutParams area=new FrameLayout.LayoutParams(-2,-2);
        area.setMargins(dp(context,4),dp(context,3),dp(context,4),dp(context,4));
        addView(backdrop,area);

        TextView text=new TextView(context);
        text.setText(message);
        text.setTextSize(15);
        text.setTextColor(0xfff7eaff);
        text.setTextIsSelectable(true);
        text.setMaxWidth(Math.max(dp(context,110),maxWidthPx-dp(context,115)));
        text.setContentDescription(message); // No speaker prefix is presented or read.
        backdrop.addView(text,new LinearLayout.LayoutParams(-2,-2));

        // Short bounce only on arrival. Animations never block text, commands or scrolling.
        setAlpha(0f);
        setTranslationY(dp(context,21));
        setScaleX(.85f);setScaleY(.78f);
        animate().alpha(1f).translationY(0).scaleX(1).scaleY(1)
            .setInterpolator(new OvershootInterpolator(1.2f)).setDuration(430).start();
    }
    @Override protected void onDetachedFromWindow(){
        halo.stop();
        animate().cancel();
        super.onDetachedFromWindow();
    }
    private static final class ParticleHalo extends View {
        private final Paint p=new Paint(Paint.ANTI_ALIAS_FLAG);
        private final long start=SystemClock.uptimeMillis();
        private boolean running=true;
        ParticleHalo(Context context){
            super(context);
            setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
            setClickable(false);
        }
        void stop(){running=false;}
        @Override protected void onDraw(Canvas canvas){
            super.onDraw(canvas);
            long elapsed=SystemClock.uptimeMillis()-start;
            final float life=Math.max(0f,1f-elapsed/950f);
            if(life<=0)return;
            float w=Math.max(1,getWidth()),h=Math.max(1,getHeight());
            // 30 tiny hand-drawn Nether sparks circulate around the message.
            // All particles stay on its rim so none obscure the actual words.
            for(int i=0;i<PARTICLES;i++){
                float t=((elapsed/850f)*(0.35f+(i%5)*.07f)+i*.618034f)%1f;
                float phase=t*6.2831853f;
                float cx=w*.5f+(float)Math.cos(phase)*(w*.5f-dp(getContext(),5));
                float cy=h*.5f+(float)Math.sin(phase)*(h*.5f-dp(getContext(),5));
                float drift=(float)Math.sin(i*2.17f+elapsed/225f)*dp(getContext(),5);
                cx+=drift;cy-=drift*.5f;
                int a=Math.min(255,Math.round((0.48f+(i%4)*.1f)*255f*life));
                int rgb=i%6==0?0x00e9d1ff:i%3==0?0x00d38afc:0x00944ff4;
                p.setColor((a<<24)|rgb);
                float radius=dp(getContext(),i%5==0?2.8f:1.7f)*(.4f+.6f*life);
                if(i%3==0)canvas.drawRoundRect(new RectF(cx-radius,cy-radius,cx+radius,cy+radius),1,1,p);
                else canvas.drawCircle(cx,cy,radius,p);
            }
            if(running&&elapsed<950&&getWindowVisibility()==VISIBLE)
                postInvalidateDelayed(33);
        }
    }
}
