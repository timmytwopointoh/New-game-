package com.veilforge.realmagent;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import android.graphics.Shader;
import android.view.View;

/**
 * An independent 18dp native fluid accent under Rovekin's chat header.
 * It is drawn by Canvas and never contains controls or fake button imagery.
 * Animation is bounded to ~15fps to keep the on-device Minecraft bot responsive.
 */
public final class RovekinDripBar extends View {
    private final Paint brush=new Paint(Paint.ANTI_ALIAS_FLAG);
    private final long started=System.nanoTime();
    private final float[] droplets={.075f,.17f,.28f,.42f,.55f,.69f,.82f,.945f};
    private boolean active=true;
    @Override protected void onAttachedToWindow(){super.onAttachedToWindow();active=true;invalidate();}
    @Override protected void onDetachedFromWindow(){active=false;super.onDetachedFromWindow();}
    public RovekinDripBar(Context context){
        super(context);
        setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
    }
    @Override protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        int w=getWidth(),h=getHeight();if(w<=0||h<=0)return;
        float t=(System.nanoTime()-started)/1_000_000_000f;
        brush.reset();brush.setAntiAlias(true);
        brush.setShader(new LinearGradient(0,0,w,0,
            0xff65309f,0xffd17cff,Shader.TileMode.CLAMP));
        canvas.drawRoundRect(new RectF(0,h*.05f,w,h*.35f),
            h*.14f,h*.14f,brush);
        brush.setShader(null);
        for(int i=0;i<droplets.length;i++) {
            float x=w*droplets[i];
            float breathe=(float)Math.sin(t*.9+i*1.3);
            float depth=h*(.43f+(.18f*(.5f+.5f*breathe))+(i%3)*.056f);
            float radius=Math.max(2f,h*(i%2==0?.13f:.10f));
            brush.setColor(i%3==0?0xffbd64f5:0xff8d3bd3);
            canvas.drawRoundRect(new RectF(x-radius,0,x+radius,depth),radius,radius,brush);
            canvas.drawCircle(x,depth,radius,brush);
            brush.setColor(0x88e6bcff);
            canvas.drawCircle(x-radius*.32f,depth-radius*.3f,Math.max(1f,radius*.21f),brush);
        }
        if(active && getWindowVisibility()==VISIBLE)postInvalidateDelayed(72);
    }
}