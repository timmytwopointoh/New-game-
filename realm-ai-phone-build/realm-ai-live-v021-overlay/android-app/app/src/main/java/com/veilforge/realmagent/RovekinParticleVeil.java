package com.veilforge.realmagent;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.view.View;
import java.util.Random;

/** A soft overlay of violet particles beneath all Android controls. */
public final class RovekinParticleVeil extends View {
    private static final int N=118;
    private final Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG);
    private final float[] x=new float[N],y=new float[N],size=new float[N],speed=new float[N];
    private final int[] tint=new int[N];
    private final long origin=System.nanoTime();
    private boolean running=true;
    public RovekinParticleVeil(Context c){
        super(c);setClickable(false);
        setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
        Random rng=new Random(655006L);
        for(int i=0;i<N;i++){
            x[i]=rng.nextFloat();y[i]=rng.nextFloat();
            size[i]=1+rng.nextFloat()*3;
            speed[i]=.015f+rng.nextFloat()*.045f;
            tint[i]=i%6==0?0x99f2b2ff:i%3==0?0x889b4aff:0x559d54c8;
        }
    }
    @Override protected void onDraw(Canvas c){
        super.onDraw(c);
        float t=(System.nanoTime()-origin)/1e9f;
        float width=getWidth(),height=getHeight();
        for(int i=0;i<N;i++){
            float px=x[i]*width+(float)Math.sin(t*.7+i*1.2)*4;
            float py=((y[i]-speed[i]*t)%1f+1f)%1f*height;
            paint.setColor(tint[i]);
            c.drawRoundRect(px,py,px+size[i]*1.3f,py+size[i]*1.3f,1,1,paint);
        }
        if(running&&getWindowVisibility()==VISIBLE)postInvalidateDelayed(92);
    }
    @Override protected void onDetachedFromWindow(){running=false;super.onDetachedFromWindow();}
}
