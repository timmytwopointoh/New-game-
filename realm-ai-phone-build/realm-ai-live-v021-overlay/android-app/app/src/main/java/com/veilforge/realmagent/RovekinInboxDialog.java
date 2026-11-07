package com.veilforge.realmagent;

import android.app.AlertDialog;
import android.content.res.ColorStateList;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.RippleDrawable;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Native, authenticated questions and permission inbox. Every click carries
 * an opaque live request ID to the existing phone-local Node controller.
 * Never fabricate a Minecraft permission or queue a command in Java.
 */
public final class RovekinInboxDialog {
    private static final int PAPER=0xffefffee, DIM=0xffbed6be, LIME=0xffb6ff72, INK=0xff07241a;
    private RovekinInboxDialog(){}
    private static int dp(MainActivity a,float n){return (int)(n*a.getResources().getDisplayMetrics().density+.5f);}
    private static GradientDrawable shape(MainActivity a,int fill,int stroke,int radius){
        GradientDrawable g=new GradientDrawable();g.setColor(fill);g.setCornerRadius(dp(a,radius));g.setStroke(dp(a,1.5f),stroke);return g;
    }
    private static TextView label(MainActivity a,String value,int size,int color,boolean bold){
        TextView v=new TextView(a);v.setText(value);v.setTextSize(size);v.setTextColor(color);
        if(bold)v.setTypeface(Typeface.create("sans-serif-medium",Typeface.BOLD));return v;
    }
    private static Button button(MainActivity a,String name,boolean bright,Runnable task){
        Button b=new Button(a);b.setAllCaps(false);b.setText(name);
        b.setTextSize(13);b.setTextColor(bright?INK:PAPER);
        b.setTypeface(Typeface.create("sans-serif-medium",Typeface.BOLD));
        b.setMinimumHeight(dp(a,48));b.setMinWidth(0);
        b.setPadding(dp(a,9),dp(a,8),dp(a,9),dp(a,8));
        b.setBackground(new RippleDrawable(ColorStateList.valueOf(0x66dfd4ff),
            shape(a,bright?0xffb7ff77:0xff224631,bright?0xffe6ffc0:0xff6cba70,11),null));
        b.setOnClickListener(v->task.run());
        return b;
    }
    private static void add(LinearLayout target,View child,int margin,MainActivity a){
        LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,-2);p.topMargin=dp(a,margin);target.addView(child,p);
    }
    public static void show(MainActivity a){
        if(a.token==null||a.token.isEmpty()||!a.serviceStarted){
            new AlertDialog.Builder(a).setTitle("RoveKin inbox").setMessage(
                "Start RoveKin to view live requests. Saved home and conversation memory are not erased when the app is offline.")
                .setPositiveButton("OK",null).show();return;
        }
        a.io.submit(()->{
            try{JSONObject response=a.request("GET","/inbox",null);a.ui.post(()->render(a,response));}
            catch(Exception e){a.ui.post(()->new AlertDialog.Builder(a).setTitle("Inbox unavailable")
                .setMessage("The local RoveKin controller is not responding. Reconnect without uninstalling. "+e.getClass().getSimpleName())
                .setPositiveButton("OK",null).show());}
        });
    }
    private static void sendSafeDemo(MainActivity a,AlertDialog current){
        if(a.token==null||a.token.isEmpty()||!a.serviceStarted)return;
        a.io.submit(()->{
            try{
                JSONObject result=a.request("POST","/inbox/demo",new JSONObject());
                a.ui.post(()->{
                    if(current!=null&&current.isShowing())current.dismiss();
                    if(!result.optBoolean("accepted",false)){
                        new AlertDialog.Builder(a).setTitle("Practice inbox")
                            .setMessage(result.optString("message","The controller did not create a test."))
                            .setPositiveButton("OK",null).show();
                        return;
                    }
                    show(a);
                });
            }catch(Exception e){a.ui.post(()->new AlertDialog.Builder(a)
                .setTitle("Inbox test unavailable")
                .setMessage("The on-phone controller is not responding. No game commands were sent.")
                .setPositiveButton("OK",null).show());}
        });
    }
    private static void submit(MainActivity a,String id,String decision,String explanation,Integer choice,AlertDialog current){
        if(id==null||id.length()>80)return;
        final long epoch=a.commandEpoch;
        a.io.submit(()->{
            try{
                JSONObject payload=new JSONObject().put("id",id).put("decision",decision).put("epoch",epoch);
                if(explanation!=null)payload.put("explanation",explanation);
                if(choice!=null)payload.put("choice",choice.intValue());
                JSONObject result=a.request("POST","/inbox/respond",payload);
                a.ui.post(()->{
                    if(epoch!=a.commandEpoch)return;
                    if(current!=null&&current.isShowing())current.dismiss();
                    a.bubble("ROVEKIN",result.optString("message","Request answered."),false);
                    // Re-open to show any other requests; never auto-approve them.
                    show(a);
                });
            }catch(Exception e){a.ui.post(()->new AlertDialog.Builder(a)
                .setTitle("Response not delivered")
                .setMessage("No permission was granted. Please try again when RoveKin is connected.")
                .setPositiveButton("OK",null).show());}
        });
    }
    private static void render(MainActivity a,JSONObject response){
        JSONObject inbox=response.optJSONObject("inbox");
        JSONArray requests=inbox==null?null:inbox.optJSONArray("requests");
        final int count=requests==null?0:requests.length();
        ScrollView scroll=new ScrollView(a);scroll.setFillViewport(false);
        LinearLayout content=new LinearLayout(a);content.setOrientation(1);
        content.setPadding(dp(a,14),dp(a,10),dp(a,14),dp(a,18));
        content.setBackground(shape(a,0xff0a2b20,0xff4d8a64,16));
        scroll.addView(content);
        add(content,label(a,"✉  "+count+" waiting",20,LIME,true),0,a);
        add(content,label(a,"A question is a request for YOUR response. Answering a practice card never changes the Minecraft world.",13,DIM,false),7,a);
        final AlertDialog dialog=new AlertDialog.Builder(a)
            .setTitle("RoveKin • Questions & Permissions")
            .setView(scroll).setNegativeButton("Close",null).create();
        add(content,button(a,"✉  SEND A SAFE TEST MESSAGE",false,()->sendSafeDemo(a,dialog)),11,a);
        add(content,label(a,"Try this first: create a sample question, see the number appear, open it and answer. It requires only the local controller—not a Realm build permission.",12,DIM,false),5,a);
        if(count==0){
            add(content,label(a,"All caught up! RoveKin has no active questions right now.",16,PAPER,false),20,a);
            add(content,label(a,"Real permissions are short-lived for safety. If one expires, ask RoveKin to retry that exact step rather than approving an old code.",13,DIM,false),9,a);
        }
        for(int i=0;i<count;i++){
            JSONObject item=requests.optJSONObject(i);if(item==null)continue;
            final String id=item.optString("id","");
            final String kind=item.optString("kind","");
            LinearLayout card=new LinearLayout(a);card.setOrientation(1);
            card.setPadding(dp(a,12),dp(a,11),dp(a,12),dp(a,13));
            card.setBackground(shape(a,0xff17382c,0xff81ce77,13));
            add(content,card,12,a);
            add(card,label(a,item.optString("category","Question").toUpperCase(),11,0xffcaabfc,true),0,a);
            add(card,label(a,item.optString("title","RoveKin needs an answer"),16,PAPER,true),5,a);
            add(card,label(a,item.optString("prompt",""),14,PAPER,false),7,a);
            final String detail=item.optString("detail","");
            if(!detail.isEmpty())add(card,label(a,detail,12,DIM,false),6,a);
            long seconds=(item.optLong("expiresAt",0)-System.currentTimeMillis())/1000;
            if(seconds>0)add(card,label(a,"Available for about "+Math.max(1,seconds)+" more seconds",11,DIM,false),5,a);
            JSONArray choices=item.optJSONArray("options");
            if("clarification".equals(kind)&&choices!=null&&choices.length()>0){
                add(card,label(a,"Choose the meaning you intended:",13,LIME,true),9,a);
                for(int j=0;j<choices.length();j++){
                    final int index=j;
                    String option=choices.optString(j,"Option "+(j+1));
                    add(card,button(a,(j+1)+". "+option,false,()->submit(a,id,"choose",null,index,dialog)),5,a);
                }
                add(card,button(a,"✕ No, none of these",false,()->submit(a,id,"deny",null,null,dialog)),7,a);
            }else if("demo".equals(kind)){
                LinearLayout row=new LinearLayout(a);row.setGravity(Gravity.CENTER_VERTICAL);
                LinearLayout.LayoutParams yes=new LinearLayout.LayoutParams(0,dp(a,49),1);
                yes.rightMargin=dp(a,7);
                row.addView(button(a,"✓ Got it",true,()->submit(a,id,"approve",null,null,dialog)),yes);
                row.addView(button(a,"✕ No",false,()->submit(a,id,"deny",null,null,dialog)),
                    new LinearLayout.LayoutParams(0,dp(a,49),1));
                add(card,row,11,a);
            }else if("guidance".equals(kind)){
                // Help is not permission: these buttons only acknowledge
                // or dismiss the question. A retry requires a new command.
                LinearLayout row=new LinearLayout(a);row.setGravity(Gravity.CENTER_VERTICAL);
                LinearLayout.LayoutParams yes=new LinearLayout.LayoutParams(0,dp(a,49),1);
                yes.rightMargin=dp(a,7);
                row.addView(button(a,"✓ Got it",true,()->submit(a,id,"approve",null,null,dialog)),yes);
                row.addView(button(a,"Not now",false,()->submit(a,id,"deny",null,null,dialog)),
                    new LinearLayout.LayoutParams(0,dp(a,49),1));
                add(card,row,11,a);
            }else if(!"clarification".equals(kind)||item.optBoolean("approvalRequired",false)){
                LinearLayout row=new LinearLayout(a);row.setGravity(Gravity.CENTER_VERTICAL);
                LinearLayout.LayoutParams yes=new LinearLayout.LayoutParams(0,dp(a,49),1);
                yes.rightMargin=dp(a,7);
                row.addView(button(a,"✓ Approve",true,()->submit(a,id,"approve",null,null,dialog)),yes);
                row.addView(button(a,"✕ No",false,()->submit(a,id,"deny",null,null,dialog)),
                    new LinearLayout.LayoutParams(0,dp(a,49),1));
                add(card,row,11,a);
            }else{
                add(card,button(a,"✓ Yes, learn this",true,()->submit(a,id,"approve",null,null,dialog)),9,a);
                add(card,button(a,"✕ No, not that",false,()->submit(a,id,"deny",null,null,dialog)),5,a);
            }
            EditText explanation=new EditText(a);
            explanation.setSingleLine(false);explanation.setMinLines(2);
            explanation.setMaxLines(4);explanation.setHint("Or explain what you mean…");
            explanation.setTextColor(PAPER);explanation.setHintTextColor(0xffb3cbb8);
            explanation.setTextSize(14);explanation.setPadding(dp(a,9),dp(a,7),dp(a,9),dp(a,7));
            explanation.setBackground(shape(a,0xff0b241e,0xff66a76b,9));
            add(card,explanation,9,a);
            add(card,button(a,"Send explanation",false,()->{
                String note=explanation.getText().toString().trim();
                if(note.length()<2||note.length()>190){
                    explanation.setError("Write a short explanation (2–190 characters)");return;
                }
                submit(a,id,"explain",note,null,dialog);
            }),7,a);
        }
        JSONArray recent=inbox==null?null:inbox.optJSONArray("recent");
        if(recent!=null&&recent.length()>0){
            add(content,label(a,"RECENTLY MISSED OR FINISHED",12,LIME,true),17,a);
            for(int i=0;i<recent.length();i++){
                JSONObject notice=recent.optJSONObject(i);if(notice==null)continue;
                String status=notice.optString("status","no-longer-active");
                String headline=notice.optString("title","Question")+
                    ("expired".equals(status)?"  ·  Expired":"  ·  No longer active");
                add(content,label(a,headline,13,PAPER,false),7,a);
            }
            add(content,label(a,"These are history only. They cannot grant permission. Ask RoveKin to repeat a specific question if needed.",12,DIM,false),8,a);
        }
        dialog.show();
        if(dialog.getWindow()!=null)dialog.getWindow().setLayout(-1,-2);
    }
}
