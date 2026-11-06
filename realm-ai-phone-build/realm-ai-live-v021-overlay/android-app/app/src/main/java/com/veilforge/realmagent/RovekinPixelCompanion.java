package com.veilforge.realmagent;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.view.View;
import org.json.JSONObject;
import java.util.Locale;

/**
 * Tiny original pixel-robot, with animations driven by actual on-device
 * controller status. Never predicts work that the Realm has not reported.
 * Supported: idle, follow/walk, mine, build/carpentry, craft, wait/stop.
 */
public final class RovekinPixelCompanion extends View {
    private enum Activity { IDLE, WALK, MINE, BUILD, CRAFT, WAIT }
    private final Paint paint=new Paint();
    private Activity state=Activity.WAIT;
    private final long began=System.nanoTime();
    private boolean animated=true;
    private String spokenState="Waiting for live bot status";
    public RovekinPixelCompanion(Context context) {
        super(context);
        setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_YES);
        setContentDescription(spokenState);
    }
    public void setLiveState(JSONObject status) {
        Activity next=choose(status);
        state=next;
        String label=next==Activity.BUILD?"Building: the pixel companion works at a saw table"
            :next==Activity.MINE?"Mining: the pixel companion swings a pickaxe"
            :next==Activity.WALK?"Following: the pixel companion walks"
            :next==Activity.CRAFT?"Crafting: the pixel companion works at a small table"
            :next==Activity.IDLE?"Idle: the pixel companion looks around"
            :"Waiting: the pixel companion remains still";
        if(!label.equals(spokenState)){spokenState=label;setContentDescription(label);}
        invalidate();
    }
    public static String taskForStatus(JSONObject status){
        return choose(status).name().toLowerCase(Locale.ROOT);
    }
    private static Activity choose(JSONObject status){
        if(status==null)return Activity.WAIT;
        if(!status.optBoolean("spawned"))return Activity.WAIT;
        JSONObject survival=status.optJSONObject("survival");
        JSONObject nav=survival==null?null:survival.optJSONObject("navigation");
        String movement=nav==null?"":nav.optString("mode","").toLowerCase(Locale.ROOT);
        String motion=nav==null?"":nav.optString("state","").toLowerCase(Locale.ROOT);
        JSONObject planner=status.optJSONObject("planner");
        JSONObject plan=survival==null?null:survival.optJSONObject("plans");
        JSONObject resource=survival==null?null:survival.optJSONObject("resourceTask");
        String details=String.join(" ",
            planner==null?"":planner.optString("state","")+" "+planner.optString("action","")+" "+planner.optString("description",""),
            plan==null?"":plan.optString("active","")+" "+plan.optString("command","")+" "+plan.optString("state",""),
            resource==null?"":resource.optString("kind","")+" "+resource.optString("state",""),
            nav==null?"":nav.optString("job","")+" "+nav.optString("kind","")
        ).toLowerCase(Locale.ROOT);
        boolean working=details.contains("active")||details.contains("working")||
            details.contains("running")||details.contains("building")||details.contains("mining");
        if(details.matches("(?s).*(build|house|shelter|floor|wall|carpentry|workshop).*")
             && working)return Activity.BUILD;
        if(details.matches("(?s).*(mine|mining|dig|excavat|quarry).*") && working)
            return Activity.MINE;
        if(details.matches("(?s).*(craft|smelt|forge|workbench).*") && working)
            return Activity.CRAFT;
        if((movement.equals("follow")||movement.equals("walk")||movement.equals("route"))
            && (motion.equals("walking")||motion.equals("moving")||
                motion.equals("following")||motion.equals("running")))
            return Activity.WALK;
        if(motion.contains("mine")||motion.contains("dig"))return Activity.MINE;
        if(motion.contains("build")||motion.contains("plac"))return Activity.BUILD;
        if(motion.contains("waiting")||motion.contains("blocked")||motion.contains("stopped")
            ||motion.contains("landing"))return Activity.WAIT;
        return Activity.IDLE;
    }
    private void rect(Canvas c,int color,float x,float y,float w,float h){
        paint.setColor(color);paint.setStyle(Paint.Style.FILL);
        c.drawRect(x,y,x+w,y+h,paint);
    }
    private void pixelLine(Canvas c,int color,int x,int y,int length,boolean vert){
        rect(c,color,x,y,vert?3:length,vert?length:3);
    }
    private void robot(Canvas c,float time){
        float bob=(float)Math.sin(time*(state==Activity.WALK?9:2))* (state==Activity.WALK?3.4f:1.1f);
        c.save();c.translate(0,bob);
        int shell=0xffc4e1cb,shade=0xff758f90,green=0xff97ef56,lit=0xffc0ff69,
            visor=0xff203042,eye=0xffc37aff;
        // legs and boots; walk alternates short steps
        float step=state==Activity.WALK?(float)Math.sin(time*12)*3.8f:0;
        rect(c,shade,45,77+step,12,23);rect(c,shade,61,77-step,12,23);
        rect(c,green,42,96+step,17,7);rect(c,green,59,96-step,17,7);
        // square player silhouette, mechanical limbs
        rect(c,shade,33,45,13,37);rect(c,shade,73,45,13,37);
        rect(c,green,35,48,9,29);rect(c,green,75,48,9,29);
        rect(c,green,45,44,29,38);rect(c,shade,48,49,23,29);
        rect(c,green,57,57,7,12);rect(c,eye,59,58,3,10);
        // head and faceplate
        rect(c,shade,42,14,37,35);rect(c,shell,40,12,36,32);
        rect(c,green,42,12,34,6);rect(c,visor,45,20,27,19);
        rect(c,eye,49,26,8,7);rect(c,eye,63,26,8,7);
        rect(c,0xffeedbff,51,27,3,5);rect(c,0xffeedbff,65,27,3,5);
        pixelLine(c,lit,56,41,8,false);
        c.restore();
    }
    private void carpenter(Canvas c,float time,boolean saw){
        // Sawing wood at a miniature workbench, visible only when the
        // server reports building/crafting, not whenever UI guesses.
        rect(c,0xff785535,2,75,38,5);
        rect(c,0xff9e6f40,6,80,5,22);rect(c,0xff9e6f40,31,80,5,22);
        rect(c,0xffd4ab67,8,70,27,5);rect(c,0xffad814b,12,68,17,3);
        float swing=(float)Math.sin(time*10)*5;
        if(saw){rect(c,0xffbdc9d1,18+swing,61,3,15);rect(c,0xffeeeaf3,14+swing,59,13,3);}
        else {rect(c,0xffaf89ff,17,59,12,7);rect(c,0xffd2bcff,19,60,7,3);}
        rect(c,0xffc39250,7,65,4,2);rect(c,0xffc39250,34,64,3,2);
    }
    private void pickaxe(Canvas c,float time){
        float swing=(float)Math.sin(time*9)*8;
        c.save();c.rotate(swing,80,68);
        rect(c,0xffa17a52,79,51,4,37);
        rect(c,0xffb9c7d4,69,47,24,5);
        rect(c,0xffe2e8f3,70,46,8,3);
        c.restore();
        rect(c,0xff68767d,85,85,20,15);
        rect(c,0xff9eafb3,82,81,20,8);
    }
    private void spark(Canvas c,float t){
        int color=0xffd997ff;
        rect(c,color,20+(float)Math.sin(t*2)*4,28,3,3);
        rect(c,0xff9e53eb,89,23+(float)Math.cos(t*2)*6,4,4);
        rect(c,0xffe0bbff,96,49,2,2);
    }
    @Override protected void onDraw(Canvas canvas){
        super.onDraw(canvas);
        float scale=Math.min(getWidth()/112f,getHeight()/112f);
        canvas.save();
        canvas.translate((getWidth()-112*scale)*.5f,(getHeight()-112*scale)*.5f);
        canvas.scale(scale,scale);
        float t=(System.nanoTime()-began)*1e-9f;
        rect(canvas,0x44062f22,8,98,99,7);
        if(state==Activity.BUILD||state==Activity.CRAFT)carpenter(canvas,t,state==Activity.BUILD);
        robot(canvas,t);
        if(state==Activity.MINE)pickaxe(canvas,t);
        if(state==Activity.IDLE||state==Activity.WALK)spark(canvas,t);
        canvas.restore();
        if(animated&&getWindowVisibility()==VISIBLE)postInvalidateDelayed(105);
    }
    @Override protected void onDetachedFromWindow(){animated=false;super.onDetachedFromWindow();}
}
