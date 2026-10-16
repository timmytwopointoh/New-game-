package com.echoform.game

import android.app.Activity
import android.os.Bundle
import android.content.Context
import android.graphics.*
import android.view.*
import kotlin.math.*

class MainActivity : Activity() {
 override fun onCreate(savedInstanceState: Bundle?) { super.onCreate(savedInstanceState); setContentView(WorldView(this)) }
}

/** Offline prototype: move by dragging; tap ECHO to replay your last path. */
class WorldView(ctx: Context) : View(ctx) {
 private val paint = Paint(3)
 private var px = 0.5f; private var py = 0.68f
 private val history = ArrayList<Pair<Float,Float>>()
 private var echo: List<Pair<Float,Float>> = emptyList()
 private var echoStart = 0L
 private var lastTick = 0L
 private var touching = false
 private var targetX = px; private var targetY = py
 override fun onDraw(c: Canvas) {
  val w=width.toFloat(); val h=height.toFloat(); val now=System.currentTimeMillis()
  if(lastTick==0L) lastTick=now
  val dt=((now-lastTick)/1000f).coerceIn(0f,.05f); lastTick=now
  if(touching) { val dx=targetX-px; val dy=targetY-py; val len=hypot(dx,dy); val step=dt*.25f; if(len>step){px+=dx/len*step;py+=dy/len*step}else{px=targetX;py=targetY} }
  if(history.isEmpty() || hypot(px-history.last().first,py-history.last().second)>.004f){ history.add(px to py); if(history.size>420)history.removeAt(0) }
  val sky=LinearGradient(0f,0f,0f,h, intArrayOf(Color.rgb(11,21,38),Color.rgb(30,68,76),Color.rgb(16,35,31)),null,Shader.TileMode.CLAMP)
  paint.shader=sky;c.drawRect(0f,0f,w,h,paint);paint.shader=null
  paint.color=Color.rgb(29,50,49)
  for(i in 0..14){ val bx=i*w/14; val bh=h*(.15f+.12f*abs(sin(i*2.37)).toFloat());c.drawRect(bx,h*.53f-bh,bx+w/19,h*.53f,paint) }
  paint.color=Color.rgb(26,47,40);c.drawRect(0f,h*.53f,w,h,paint)
  paint.color=Color.rgb(52,92,69)
  for(i in 0..18){ val yy=h*(.55f+i*.028f);c.drawLine(0f,yy,w,yy,paint) }
  paint.color=Color.rgb(77,122,104)
  for(i in -10..10){c.drawLine(w*.5f,h*.53f,w*(.5f+i*.18f),h,paint)}
  paint.color=Color.argb(130,90,240,205)
  for(p in history){c.drawCircle(p.first*w,p.second*h,2.5f,paint)}
  if(echo.isNotEmpty()){
   val idx=(((now-echoStart)/32L)%echo.size).toInt();val e=echo[idx]
   paint.color=Color.argb(90,96,250,255);c.drawCircle(e.first*w,e.second*h,26f,paint)
   paint.color=Color.CYAN;c.drawCircle(e.first*w,e.second*h,11f,paint)
  }
  paint.color=Color.BLACK;c.drawOval(px*w-17,py*h+10,px*w+17,py*h+19,paint)
  paint.color=Color.rgb(225,211,178);c.drawCircle(px*w,py*h-18,12f,paint)
  paint.color=Color.rgb(196,160,103);c.drawRoundRect(px*w-13,py*h-8,px*w+13,py*h+17,7f,7f,paint)
  paint.color=Color.WHITE;paint.textSize=40f;paint.typeface=Typeface.create("sans-serif-light",Typeface.BOLD);c.drawText("E C H O F O R M",25f,60f,paint)
  paint.textSize=21f;paint.typeface=Typeface.DEFAULT;c.drawText("Move: drag  |  Replay: ECHO",25f,95f,paint)
  paint.color=Color.argb(220,15,52,59);c.drawRoundRect(w-185f,h-125f,w-20f,h-35f,18f,18f,paint)
  paint.color=Color.CYAN;paint.textSize=32f;c.drawText("ECHO",w-160f,h-69f,paint)
  postInvalidateDelayed(16)
 }
 override fun onTouchEvent(e: MotionEvent): Boolean {
  val x=e.x/width;val y=e.y/height
  when(e.actionMasked){
   MotionEvent.ACTION_DOWN->{if(e.x>width-200 && e.y>height-150){ if(history.size>1){echo=history.toList();echoStart=System.currentTimeMillis();history.clear()};touching=false }else{touching=true;targetX=x.coerceIn(.02f,.98f);targetY=y.coerceIn(.55f,.96f)};return true}
   MotionEvent.ACTION_MOVE->{if(touching){targetX=x.coerceIn(.02f,.98f);targetY=y.coerceIn(.55f,.96f)};return true}
   MotionEvent.ACTION_UP,MotionEvent.ACTION_CANCEL->{touching=false;return true}
  };return true
 }
}
