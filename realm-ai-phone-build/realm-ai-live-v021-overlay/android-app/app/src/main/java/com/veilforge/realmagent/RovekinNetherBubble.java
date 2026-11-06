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
    private static final int PARTICLES=48;
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
            // This effect happens ONCE for each fresh AI response; there is
            // intentionally no ambient particle view on the chat background.
            final float progress=Math.min(1f,elapsed/1350f);
            final float life=(float)Math.pow(1f-progress,1.15);
            if(life<=0)return;
            final float w=Math.max(1,getWidth()),h=Math.max(1,getHeight());
            final float density=getResources().getDisplayMetrics().density;
            for(int i=0;i<PARTICLES;i++){
                // Deterministic sparks burst UP from the newly appearing reply:
                // the first half rise off left/right edges; the rest ignite
                // across the lower rim. No spark touches the text centre.
                float seed=((i*73)%101)/100f;
                float originX=i%2==0?dp(getContext(),7):w-dp(getContext(),7);
                float originY=h*(.28f+seed*.63f);
                if(i%4==0){originX=w*(.1f+seed*.8f);originY=h-dp(getContext(),6);}
                float driftX=(float)Math.sin(i*1.975f)*density*(24f+seed*35f)*progress;
                float rise=density*(55f+seed*90f)*(1f-(1f-progress)*(1f-progress));
                float x=originX+driftX,y=originY-rise;
                int alpha=Math.min(255,Math.round((.68f+(i%5)*.07f)*255f*life));
                int rgb=i%6==0?0x00efd7ff:i%3==0?0x00db84ff:0x009e45ee;
                p.setColor((alpha<<24)|rgb);
                float radius=dp(getContext(),i%6==0?2.9f:1.8f)*(.5f+.5f*life);
                if(i%3==0)canvas.drawRoundRect(new RectF(x-radius,y-radius,x+radius,y+radius),1,1,p);
                else canvas.drawCircle(x,y,radius,p);
            }
            if(running&&elapsed<1350&&getWindowVisibility()==VISIBLE)
                postInvalidateDelayed(33);
        }
    }
}
