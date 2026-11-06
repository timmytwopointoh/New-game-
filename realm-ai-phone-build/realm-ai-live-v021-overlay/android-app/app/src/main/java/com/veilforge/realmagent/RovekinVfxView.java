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
 * Original vector scene drawn with Android hardware-accelerated Canvas:
 * whole-body blocky mechanical player, emerald block-world, violet portal ooze.
 * No raster screenshot of controls, no copied Minecraft textures or characters.
 * Rendered separately from native interactive buttons.
 */
public final class RovekinVfxView extends View {
    private final Paint p=new Paint(Paint.ANTI_ALIAS_FLAG);
    private final long start=System.nanoTime();
    private final float[] fx=new float[112],fy=new float[112],fr=new float[112];
    private final int[] shade=new int[112];
    private boolean active=true;
    public RovekinVfxView(Context c) {
        super(c); setLayerType(View.LAYER_TYPE_HARDWARE,null);
        java.util.Random rng=new java.util.Random(261106L);
        for(int i=0;i<112;i++){
            fx[i]=rng.nextFloat(); fy[i]=rng.nextFloat();
            fr[i]=1.5f+rng.nextFloat()*3.4f; shade[i]=i%5;
        }
        setContentDescription("An original emerald robot-skinned block-world player floats near a shimmering purple portal.");
    }
    public void setAnimated(boolean yes){active=yes;if(yes)invalidate();}
    @Override protected void onDetachedFromWindow(){active=false;super.onDetachedFromWindow();}
    private void fill(int col){p.reset();p.setAntiAlias(true);p.setColor(col);p.setStyle(Paint.Style.FILL);}
    private void box(Canvas c,float x,float y,float w,float h,float radius,int col){
        fill(col);c.drawRoundRect(new RectF(x,y,x+w,y+h),radius,radius,p);
    }
    private void poly(Canvas c,int col,float...coords){
        fill(col);Path path=new Path();
        path.moveTo(coords[0],coords[1]);for(int i=2;i<coords.length;i+=2)path.lineTo(coords[i],coords[i+1]);
        path.close();c.drawPath(path,p);
    }
    private void line(Canvas c,int col,float width,float x1,float y1,float x2,float y2){
        fill(col);p.setStrokeWidth(width);p.setStrokeCap(Paint.Cap.ROUND);
        c.drawLine(x1,y1,x2,y2,p);
    }
    private void portal(Canvas c,float time) {
        // Three nested glowing rings; the robot stands in front of the portal.
        fill(0x3335a921);c.drawOval(new RectF(130,240,865,908),p);
        fill(0x2832e961);c.drawOval(new RectF(195,255,805,910),p);
        fill(0xff2b1249);c.drawOval(new RectF(285,245,715,900),p);
        fill(0xff8e39d5);c.drawOval(new RectF(319,281,681,860),p);
        fill(0xff4a176e);c.drawOval(new RectF(337,306,663,835),p);
        fill(0x663e0b6f);c.drawOval(new RectF(362,327,638,802),p);
        // Dripping violet portal matter: irregular animated vertical ooze,
        // not a static purple gradient or fake controls.
        for(int i=0;i<11;i++){
            float x=345+i*28, len=32+(i*29)%96;
            float bob=(float)Math.sin(time*.7+i*.9)*18;
            int color=i%3==0?0xffb266ff:0xff7a32c1;
            box(c,x,315,15,len+bob,8,color);
            fill(color);c.drawCircle(x+7.5f,315+len+bob,7.8f,p);
            fill(0x554adcf8);c.drawCircle(x+11,310+len+bob*.75f,2.4f,p);
        }
        for(int i=0;i<7;i++){
            float x=372+i*40,y=740-((i*43)%100),bob=(float)Math.cos(time+i)*7;
            box(c,x,y+bob,10,24,4,0x996e2bd0);
        }
    }
    private void landscape(Canvas c,float t){
        fill(0xff0c472b);c.drawRect(0,735,1000,1500,p);
        poly(c,0xff176e37,0,784,90,728,172,758,259,705,360,745,470,690,600,732,738,701,845,742,1000,694,1000,1500,0,1500);
        // Left original voxel tree.
        box(c,67,474,55,298,5,0xff5d442a);
        box(c,49,454,25,250,1,0xff8e6033);
        box(c,0,352,225,141,12,0xff268443);
        box(c,37,305,149,86,9,0xff3db752);
        box(c,12,374,120,47,6,0xff54ce5e);
        // Right original voxel tree.
        box(c,882,475,60,296,4,0xff67482f);
        box(c,845,371,155,128,13,0xff276e3b);
        box(c,814,307,186,91,10,0xff3aaa50);
        box(c,847,334,142,25,7,0xff60de69);
        // Blocked-up grass silhouette & rounded block tiles.
        for(int i=0;i<14;i++){
            float x=i*77-25,y=758+(i%3)*19;
            box(c,x,y,75,55,8,i%2==0?0xff36983d:0xff267d35);
            box(c,x,y+47,75,34,4,i%2==0?0xff76552e:0xff594224);
            box(c,x+8,y+65,18,7,2,0xff8d6337);
        }
        fill(0x77000000);c.drawOval(new RectF(285,857,730,922),p);
    }
    private void robot(Canvas c,float time){
        c.save();c.translate(0,(float)Math.sin(time*1.45f)*10);
        // Head and full humanoid body stay centered; all pieces original.
        // Legs
        box(c,385,700,105,170,13,0xff395a54);
        box(c,509,700,105,170,13,0xff395a54);
        poly(c,0xff71cd6b,385,708,404,712,404,854,385,860);
        box(c,378,836,118,35,12,0xffabff6c);
        box(c,508,836,118,35,12,0xffabff6c);
        // Arms: green robot sleeves with soft bevel.
        box(c,276,479,108,244,22,0xff34743e);
        box(c,616,479,108,244,22,0xff34743e);
        box(c,289,490,21,212,8,0xff89ff59);
        box(c,633,490,21,212,8,0xff89ff59);
        box(c,284,688,96,62,12,0xff9bb4ac);
        box(c,620,688,96,62,12,0xff9bb4ac);
        // Suit, chest reactor and mechanical seams.
        box(c,366,471,266,276,32,0xff44745b);
        box(c,390,487,219,243,22,0xff83ec65);
        box(c,409,506,184,216,18,0xff214b39);
        poly(c,0xffbaff78,409,506,447,506,419,722,409,722);
        box(c,460,566,88,106,20,0xff123c3b);
        box(c,472,576,64,79,15,0xffb368ff);
        box(c,484,586,40,58,10,0xffeeacff);
        // Neck
        box(c,453,435,93,60,12,0xff8bafb1);
        // Head shell with top/side facets (Minecraft-like player silhouette,
        // not another tiny rounded floating robot head).
        box(c,358,229,285,256,28,0xffaac0b8);
        poly(c,0xffe0eae1,358,255,383,228,612,228,643,253,612,280,386,280);
        poly(c,0xff66897f,613,280,643,253,643,458,610,483,610,283);
        box(c,380,274,230,186,20,0xff1c3840);
        box(c,398,290,193,153,18,0xff251038);
        box(c,419,331,66,67,14,0xffc875ff);
        box(c,518,331,66,67,14,0xffc875ff);
        box(c,431,341,25,46,8,0xfff3c8ff);
        box(c,529,341,25,46,8,0xfff3c8ff);
        box(c,465,423,69,12,6,0xffa7ff6a);
        // Helmet band, corner bevels.
        box(c,378,240,230,43,12,0xff6fff3d);
        box(c,397,241,178,16,5,0xffd5ffad);
        box(c,337,306,34,118,9,0xff96f759);
        box(c,627,306,34,118,9,0xff96f759);
        // Spark of personality
        box(c,497,205,11,31,4,0xffb4f878);
        fill(0xffbafc70);c.drawCircle(503,202,12,p);
        c.restore();
    }
    @Override protected void onDraw(Canvas real) {
        super.onDraw(real);
        if(getWidth()==0||getHeight()==0)return;
        float secs=(System.nanoTime()-start)/1_000_000_000f;
        // Portrait-safe normalized 1000 x 1500 world; uses crop rather than
        // nonuniform stretch so the robot never becomes distorted.
        float scale=Math.max(getWidth()/1000f,getHeight()/1500f);
        real.save();real.translate((getWidth()-1000*scale)*.5f,(getHeight()-1500*scale)*.5f);
        real.scale(scale,scale);
        fill(0xff062a1a);
        p.setShader(new LinearGradient(0,0,1000,1500,
            0xff05281a,0xff0c402c,Shader.TileMode.CLAMP));
        real.drawRect(0,0,1000,1500,p);p.setShader(null);
        // Subtle architectural emerald voxel gradient, intentionally unobtrusive.
        for(int y=0;y<315;y+=55)for(int x=0;x<1000;x+=55){
            int k=(x*31+y*17)/55;
            if(k%7!=0)continue;
            box(real,x+3,y+3,51,51,6,0x1c59f043);
        }
        landscape(real,secs);
        portal(real,secs);
        robot(real,secs);
        // Nether particles float independently and wrap cleanly.
        for(int i=0;i<fx.length;i++){
            float px=fx[i]*1000f+(float)Math.sin(secs*.7+i)*8;
            float py=(fy[i]*1350f-(secs*(9+(i%7)*3)))%1450f;
            if(py<0)py+=1450f;
            float r=fr[i];int col=shade[i]==0?0xfff2c9ff:shade[i]==1?0xffa549f7:0xffc77dfd;
            box(real,px,py,r*2,r*2,2,col);
        }
        real.restore();
        if(active && getWindowVisibility()==VISIBLE)postInvalidateDelayed(42);
    }
}