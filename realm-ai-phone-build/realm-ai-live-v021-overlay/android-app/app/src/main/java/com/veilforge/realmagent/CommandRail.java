package com.veilforge.realmagent;

import android.content.Context;
import android.graphics.*;
import android.os.Bundle;
import android.view.*;
import android.view.accessibility.AccessibilityNodeInfo;

/** A thumb rail browses categories only. It never starts or saves a command. */
public final class CommandRail extends View {
    static final String[] LABELS={"All","Travel","Work","Build","Info","Session"};
    interface Listener { void selected(int index); }
    final Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG);
    final Listener listener; int index;
    public CommandRail(Context c,Listener callback){super(c);listener=callback;setFocusable(true);setClickable(true);setMinimumHeight(dp(270));describe();}
    int dp(int n){return Math.round(n*getResources().getDisplayMetrics().density);}
    void describe(){setContentDescription("Command category: "+LABELS[index]+". Slide up or down to browse. No command starts.");}
    void select(int next){next=Math.max(0,Math.min(LABELS.length-1,next));if(index==next)return;index=next;describe();invalidate();performHapticFeedback(HapticFeedbackConstants.CLOCK_TICK);if(listener!=null)listener.selected(index);}
    @Override protected void onDraw(Canvas c){super.onDraw(c);float step=getHeight()/(float)LABELS.length;paint.setStrokeWidth(dp(1));paint.setColor(0xff36514d);c.drawLine(dp(12),step/2,dp(12),getHeight()-step/2,paint);
        for(int i=0;i<LABELS.length;i++){float y=step*(i+.5f);boolean active=i==index;paint.setColor(active?0xff9de9c3:0xff6b8982);c.drawCircle(dp(12),y,dp(active?5:2),paint);if(active){paint.setColor(0xff25463c);c.drawRoundRect(dp(22),y-dp(17),getWidth()-dp(2),y+dp(17),dp(10),dp(10),paint);}paint.setTypeface(Typeface.create("sans-serif",active?Typeface.BOLD:Typeface.NORMAL));paint.setTextSize(dp(11));paint.setColor(active?0xffdcffec:0xff96afa8);c.drawText(LABELS[i],dp(28),y+dp(4),paint);}}
    @Override public boolean onTouchEvent(android.view.MotionEvent e){switch(e.getActionMasked()){case MotionEvent.ACTION_DOWN:case MotionEvent.ACTION_MOVE:getParent().requestDisallowInterceptTouchEvent(true);select((int)(Math.max(0,e.getY())/Math.max(1,getHeight())*LABELS.length));return true;case MotionEvent.ACTION_UP:performClick();getParent().requestDisallowInterceptTouchEvent(false);return true;case MotionEvent.ACTION_CANCEL:getParent().requestDisallowInterceptTouchEvent(false);return true;default:return false;}}
    @Override public boolean performClick(){super.performClick();return true;}
    @Override public boolean onKeyDown(int key,android.view.KeyEvent event){if(key==KeyEvent.KEYCODE_DPAD_DOWN||key==KeyEvent.KEYCODE_DPAD_UP){select(index+(key==KeyEvent.KEYCODE_DPAD_DOWN?1:-1));return true;}return super.onKeyDown(key,event);}
    @Override public void onInitializeAccessibilityNodeInfo(AccessibilityNodeInfo info){super.onInitializeAccessibilityNodeInfo(info);info.setClassName("android.widget.SeekBar");info.setRangeInfo(AccessibilityNodeInfo.RangeInfo.obtain(AccessibilityNodeInfo.RangeInfo.RANGE_TYPE_INT,0,LABELS.length-1,index));info.addAction(AccessibilityNodeInfo.AccessibilityAction.ACTION_SCROLL_FORWARD);info.addAction(AccessibilityNodeInfo.AccessibilityAction.ACTION_SCROLL_BACKWARD);info.addAction(AccessibilityNodeInfo.AccessibilityAction.ACTION_SET_PROGRESS);}
    @Override public boolean performAccessibilityAction(int action,Bundle args){if(action==AccessibilityNodeInfo.ACTION_SCROLL_FORWARD){select(index+1);return true;}if(action==AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD){select(index-1);return true;}if(action==AccessibilityNodeInfo.AccessibilityAction.ACTION_SET_PROGRESS.getId()&&args!=null){select(Math.round(args.getFloat(AccessibilityNodeInfo.ACTION_ARGUMENT_PROGRESS_VALUE)));return true;}return super.performAccessibilityAction(action,args);}
}
