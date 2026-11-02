package com.veilforge.realmagent;

import android.app.AlertDialog;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.ColorDrawable;
import android.text.*;
import android.view.*;
import android.widget.*;
import org.json.*;
import java.util.*;

/** Searchable field console: browsing and gestures never execute world actions. */
final class CommandDeck {
    final MainActivity a;AlertDialog dialog;final ListView list;final EditText search;final CommandRail rail;final TextView count;
    JSONArray catalog;final ArrayList<JSONObject> shown=new ArrayList<>();final Cards adapter=new Cards();
    CommandDeck(MainActivity activity,JSONArray commands){a=activity;catalog=commands;LinearLayout root=a.vertical();root.setPadding(a.d(12),a.d(8),a.d(12),a.d(12));root.setBackground(a.shape(a.BASE));
        LinearLayout head=new LinearLayout(a);head.setGravity(Gravity.CENTER_VERTICAL);root.addView(head,a.space(1));LinearLayout titles=a.vertical();head.addView(titles,new LinearLayout.LayoutParams(0,-2,1));TextView title=a.txt("COMMAND RAIL",20,a.WHITE);title.setTypeface(Typeface.create("sans-serif-medium",0));titles.addView(title);count=a.txt("",12,a.MUTED);titles.addView(count,a.space(2));Button stop=a.button("STOP",a::stopNow);stop.setTextColor(0xffff9ca4);head.addView(stop,new LinearLayout.LayoutParams(a.d(72),a.d(48)));
        TextView prompt=a.txt("Tell the bot what you want in your own words.",12,a.MUTED);root.addView(prompt,a.space(7));
        LinearLayout instruction=new LinearLayout(a);root.addView(instruction,a.space(10));
        EditText task=a.edit("E.g. build an 8x8 floor of dirt");instruction.addView(task,new LinearLayout.LayoutParams(0,a.d(50),1));
        Button ask=a.button("Ask",()->{String request=task.getText().toString().trim();if(!request.isEmpty()){dialog.dismiss();a.send(request);}});
        instruction.addView(ask,new LinearLayout.LayoutParams(a.d(75),a.d(50)));
        search=a.edit("Find an advanced or specific command…");search.setContentDescription("Search all internal skills and advanced commands");root.addView(search,a.space(12));
        LinearLayout body=new LinearLayout(a);LinearLayout.LayoutParams bp=new LinearLayout.LayoutParams(-1,0,1);bp.topMargin=a.d(10);root.addView(body,bp);rail=new CommandRail(a,index->filter());body.addView(rail,new LinearLayout.LayoutParams(a.d(92),-1));
        list=new ListView(a);list.setDivider(null);list.setSelector(new ColorDrawable(Color.TRANSPARENT));list.setAdapter(adapter);body.addView(list,new LinearLayout.LayoutParams(0,-1,1));list.setOnItemClickListener((parent,view,index,id)->{JSONObject def=shown.get(index);dialog.dismiss();a.showCommandForm(def);});
        TextView hint=a.txt("Ask using natural language above. Advanced opens the full command templates.",12,a.MUTED);root.addView(hint,a.space(9));Button close=a.button("Close",()->dialog.dismiss());root.addView(close,a.space(8));
        dialog=new AlertDialog.Builder(a).setView(root).create();search.addTextChangedListener(new TextWatcher(){public void beforeTextChanged(CharSequence s,int st,int c,int af){}public void onTextChanged(CharSequence s,int st,int before,int n){filter();}public void afterTextChanged(Editable e){}});filter();
    }
    void show(){dialog.show();style(a,dialog,.82f);}
    static void style(MainActivity a,AlertDialog d,float height){if(d.getWindow()==null)return;Window w=d.getWindow();for(int which:new int[]{AlertDialog.BUTTON_POSITIVE,AlertDialog.BUTTON_NEGATIVE,AlertDialog.BUTTON_NEUTRAL})if(d.getButton(which)!=null)d.getButton(which).setTextColor("STOP".contentEquals(d.getButton(which).getText())?0xffff9ca4:a.PURPLE);w.setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));w.setGravity(Gravity.BOTTOM);w.setDimAmount(.55f);w.setLayout(-1,height>0?(int)(a.getResources().getDisplayMetrics().heightPixels*height):-2);w.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);}
    void update(JSONArray commands){if(commands!=null&&commands.length()>0){catalog=commands;filter();}}
    static int category(JSONObject d){String id=d.optString("id");if(Arrays.asList("follow","walk","route","clear","roam","explore").contains(id))return 1;if(id.startsWith("build")||id.equals("place")||Arrays.asList("wall","floor","shelter").contains(id))return 3;if(Arrays.asList("dig","find","hotbar","collect","pickup","wood","harvest","strip_mine","quarry","gather","craft").contains(id))return 2;if(Arrays.asList("status","movement","situation","look","survey","inventory","materials","about","recipe","supply","plan_status","help").contains(id))return 4;return 5;}
    static String badge(JSONObject d){String id=d.optString("id");if(Arrays.asList("wall","floor","shelter","supply","recipe","route").contains(id))return "PREVIEW";if(id.equals("place")||id.startsWith("build_"))return "PLACEMENT · TEST";if(category(d)==4)return "INSPECT";return "PREPARE";}
    void filter(){shown.clear();String q=search.getText().toString().trim().toLowerCase(Locale.ROOT);if(catalog!=null)for(int i=0;i<catalog.length();i++){JSONObject d=catalog.optJSONObject(i);if(d==null)continue;String text=(d.optString("label")+" "+d.optString("template")+" "+d.optString("note")).toLowerCase(Locale.ROOT);boolean quick=Arrays.asList("follow","walk","dig","gather","craft","look","inventory","status","rejoin","collect","find","situation","respawn").contains(d.optString("id"));
        if((!q.isEmpty()||rail.index==5||rail.index==0&&quick||rail.index>0&&category(d)==rail.index)&&(q.isEmpty()||text.contains(q)))shown.add(d);}if(rail.index==0)Collections.sort(shown,(x,y)->Integer.compare(category(x)==3?9:category(x),category(y)==3?9:category(y)));adapter.notifyDataSetChanged();count.setText(shown.size()+" commands · "+CommandRail.LABELS[rail.index]);}
    final class Cards extends BaseAdapter {
        public int getCount(){return shown.size();}public JSONObject getItem(int p){return shown.get(p);}public long getItemId(int p){return p;}
        public View getView(int p,View recycled,android.view.ViewGroup parent){JSONObject d=getItem(p);LinearLayout outer=a.vertical();outer.setPadding(a.d(4),a.d(3),0,a.d(7));LinearLayout card=a.vertical();card.setPadding(a.d(13),a.d(12),a.d(13),a.d(13));card.setBackground(a.shape(a.PANEL));outer.addView(card);TextView chip=a.txt(badge(d),10,d.optString("id").startsWith("build")||d.optString("id").equals("place")?0xffedba85:a.PURPLE);card.addView(chip);TextView label=a.txt(d.optString("label"),17,a.WHITE);label.setTypeface(Typeface.create("sans-serif-medium",0));card.addView(label,a.space(5));String note=d.optString("note");if(note.isEmpty())note=d.optString("template");if(note.isEmpty())note="Prepare this command";TextView detail=a.txt(note,12,a.MUTED);detail.setMaxLines(2);detail.setEllipsize(android.text.TextUtils.TruncateAt.END);card.addView(detail,a.space(5));outer.setContentDescription(d.optString("label")+". "+badge(d)+". Tap to prepare; this does not execute it.");return outer;}
    }
}
