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
        // The mascot only performs an action after the REAL on-device Realm
        // controller reports it. No made-up work, no extrapolation from the
        // user's text or from a stored plan that has not started running.
        if(status==null||!status.optBoolean("spawned"))return Activity.WAIT;
        JSONObject survival=status.optJSONObject("survival");
        if(survival==null)return Activity.IDLE;
        JSONObject nav=survival.optJSONObject("navigation");
        JSONObject building=nav==null?null:nav.optJSONObject("building");
        JSONObject mining=nav==null?null:nav.optJSONObject("mining");
        JSONObject excavation=survival.optJSONObject("excavation");
        JSONObject resource=survival.optJSONObject("resourceTask");
        JSONObject workshop=survival.optJSONObject("workshop");
        String buildState=lower(building,"state");
        String mineState=lower(mining,"state");
        String excavationState=lower(excavation,"state");
        String resourceKind=lower(resource,"kind");
        String resourceState=lower(resource,"state");
        String travelKind=lower(nav,"mode");
        String travelState=lower(nav,"state");
        if(active(buildState)&&!(buildState.equals("idle")||buildState.equals("complete")))
            return Activity.BUILD;
        if(workshop!=null&&!workshop.isNull("placing")&&!workshop.optString("placing","").isEmpty())
            return Activity.BUILD;
        if(active(mineState)||active(excavationState))
            return Activity.MINE;
        if(resourceKind.matches(".*(?:mine|dig|excavat|quarry).*")&&active(resourceState))
            return Activity.MINE;
        if(resourceKind.matches(".*(?:build|wood|house|craft|construction).*")&&active(resourceState))
            return Activity.BUILD;
        if(("follow".equals(travelKind)||"walk".equals(travelKind)||"route".equals(travelKind))
            &&(travelState.equals("walking")||travelState.equals("following")||
               travelState.equals("running")||travelState.equals("moving")))
            return Activity.WALK;
        if(travelState.contains("blocked")||travelState.contains("waiting")||
           travelState.contains("landing")||travelState.contains("stopped"))
            return Activity.WAIT;
        return Activity.IDLE;
    }
    private static String lower(JSONObject object,String key){
        return object==null?"":object.optString(key,"").toLowerCase(Locale.ROOT);
    }
    private static boolean active(String state){
        if(state==null||state.isEmpty())return false;
        switch(state){
            case "building":case "placing":case "waiting-for-placement":
            case "mining":case "excavating":case "breaking":
            case "working":case "running":case "crafting":
            case "preparing":case "collecting":case "storage":
            case "approaching":case "approaching-workshop":
                return true;
            default:return false;
        }
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
