package com.veilforge.realmagent;

import android.app.Activity;
import android.content.Intent;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.os.Bundle;
import android.graphics.Color;
import android.view.View;
import android.view.inputmethod.EditorInfo;
import android.webkit.CookieManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.Toast;
import android.widget.TextView;
import android.text.InputType;
import android.app.AlertDialog;
import java.net.URLEncoder;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

/** A disposable, user-visible reference browser. The agent never drives it
 * using an accessibility service, WebView JavaScript bridge, or Chrome cookies.
 * Programmatic word learning uses the separate read-only HTTPS dictionary API.
 */
public final class WordBrowserActivity extends Activity {
    private static final Set<String> REFERENCE_HOSTS=new HashSet<>(Arrays.asList(
        "www.google.com", "google.com", "en.wiktionary.org",
        "dictionary.cambridge.org", "www.merriam-webster.com", "dictionaryapi.dev"
    ));
    private WebView browser;
    private EditText word;
    private boolean allowed(String url) {
        try {
            android.net.Uri uri=android.net.Uri.parse(url);
            return "https".equalsIgnoreCase(uri.getScheme()) && REFERENCE_HOSTS.contains(uri.getHost()==null?"":uri.getHost().toLowerCase(java.util.Locale.ROOT));
        } catch(Exception ignored) {return false;}
    }
    private void search() {
        String term=word.getText().toString().trim();
        if(term.length()<2 || term.length()>60 || !term.matches("[\\p{L}][\\p{L} '-]*")) {
            Toast.makeText(this,"Enter a word or short phrase",Toast.LENGTH_SHORT).show(); return;
        }
        String encoded;try{encoded=URLEncoder.encode("define "+term,"UTF-8");}catch(java.io.UnsupportedEncodingException e){return;}
        browser.loadUrl("https://www.google.com/search?q="+encoded);
    }
    // The browser is an owner-operated research tool. Google AI's website
    // requires an interactive browser; we do not scrape its private UI.
    private void openGoogleAi(){
        String task=word.getText().toString().trim();
        if(task.length()<2||task.length()>190){Toast.makeText(this,"Enter your task (2-190 characters)",Toast.LENGTH_SHORT).show();return;}
        String prompt="Explain this Minecraft Bedrock task: "+task+". Give up to 5 exact steps, each starting COMMAND:. Allowed: look around; find MATERIAL; route to X Y Z; walk to X Y Z; dig X Y Z; place MATERIAL at X Y Z; inventory; survival status. Never invent coordinates, inventory, or abilities. Tell me what is not yet possible. Server results must confirm success.";
        ClipboardManager cb=(ClipboardManager)getSystemService(Context.CLIPBOARD_SERVICE);
        cb.setPrimaryClip(ClipData.newPlainText("Realm AI research prompt",prompt));
        Toast.makeText(this,"Question copied. Paste into Google AI; copy the answer and return here.",Toast.LENGTH_LONG).show();
        startActivity(new Intent(Intent.ACTION_VIEW,android.net.Uri.parse("https://www.google.com/ai")));
    }
    private void storeGoogleKey(){
        EditText key=new EditText(this);key.setSingleLine(true);key.setHint("Google AI Studio API key");
        key.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_PASSWORD);
        new AlertDialog.Builder(this).setTitle("Connect Google Search AI")
            .setMessage("An API key from Google AI Studio enables unattended search and command proposals. The key stays in private app storage; usage may incur Google charges. Google AI Mode in Chrome cannot be automatically scraped.")
            .setView(key).setPositiveButton("Save key",(dialog,which)->{
                Intent result=new Intent();result.putExtra("researchKey",key.getText().toString().trim());setResult(Activity.RESULT_OK,result);finish();
            }).setNeutralButton("Clear key",(dialog,which)->{
                Intent result=new Intent();result.putExtra("clearResearchKey",true);setResult(Activity.RESULT_OK,result);finish();
            }).setNegativeButton("Cancel",null).show();
    }
    private void runAutomatic(){
        String task=word.getText().toString().trim();
        if(task.length()<3||task.length()>190){Toast.makeText(this,"Enter one task, 3–190 characters",Toast.LENGTH_SHORT).show();return;}
        Intent result=new Intent();result.putExtra("automaticResearchTask",task);setResult(Activity.RESULT_OK,result);finish();
    }
    private void returnAiAnswer(){
        String task=word.getText().toString().trim();
        if(task.isEmpty()||task.length()>190){Toast.makeText(this,"Enter the original task first",Toast.LENGTH_SHORT).show();return;}
        ClipboardManager cb=(ClipboardManager)getSystemService(Context.CLIPBOARD_SERVICE);
        ClipData clip=cb.getPrimaryClip();
        String answer=clip!=null&&clip.getItemCount()>0?String.valueOf(clip.getItemAt(0).coerceToText(this)):"";
        if(answer.isEmpty()||answer.length()>7000){Toast.makeText(this,"Copy the Google AI response (max 7000 characters) first",Toast.LENGTH_LONG).show();return;}
        Intent result=new Intent();result.putExtra("researchTask",task);result.putExtra("researchAnswer",answer);
        setResult(Activity.RESULT_OK,result);finish();
    }
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        LinearLayout root=new LinearLayout(this); root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.rgb(17,16,27));
        TextView help=new TextView(this);
        help.setText("BOT LOOKUP: The bot now looks up unfamiliar task words by itself. If a Google AI Studio key is set once, it can also research multi-step tasks automatically when you tell it what to do. You do not need to open this window or copy answers for automatic tasks. The browser below is optional.");
        help.setTextColor(Color.WHITE);help.setTextSize(14);help.setPadding(16,16,16,12);root.addView(help);
        LinearLayout tools=new LinearLayout(this);root.addView(tools);
        Button close=new Button(this);close.setText("Close");tools.addView(close);
        close.setOnClickListener(v->finish());
        word=new EditText(this);word.setSingleLine(true);word.setHint("Word or Minecraft task");word.setTextColor(Color.WHITE);
        word.setHintTextColor(Color.LTGRAY);word.setImeOptions(EditorInfo.IME_ACTION_SEARCH);
        tools.addView(word,new LinearLayout.LayoutParams(0,-2,1));
        Button go=new Button(this);go.setText("Search");tools.addView(go);go.setOnClickListener(v->search());
        word.setOnEditorActionListener((v,action,event)->{if(action==EditorInfo.IME_ACTION_SEARCH){search();return true;}return false;});
        LinearLayout aiButtons=new LinearLayout(this);root.addView(aiButtons);
        Button ai=new Button(this);ai.setText("Google AI Mode");aiButtons.addView(ai,new LinearLayout.LayoutParams(0,-2,1));ai.setOnClickListener(v->openGoogleAi());
        Button use=new Button(this);use.setText("Use copied answer");aiButtons.addView(use,new LinearLayout.LayoutParams(0,-2,1));use.setOnClickListener(v->returnAiAnswer());
        LinearLayout direct=new LinearLayout(this);root.addView(direct);
        Button setup=new Button(this);setup.setText("Connect bot to Google AI");direct.addView(setup,new LinearLayout.LayoutParams(0,-2,1));setup.setOnClickListener(v->storeGoogleKey());
        Button auto=new Button(this);auto.setText("Ask bot to research + do");direct.addView(auto,new LinearLayout.LayoutParams(0,-2,2));auto.setOnClickListener(v->runAutomatic());
        browser=new WebView(this);root.addView(browser,new LinearLayout.LayoutParams(-1,0,1));
        WebSettings s=browser.getSettings();
        s.setJavaScriptEnabled(false);s.setAllowFileAccess(false);s.setAllowContentAccess(false);
        s.setDomStorageEnabled(false);s.setSupportMultipleWindows(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        CookieManager.getInstance().setAcceptCookie(false);
        CookieManager.getInstance().setAcceptThirdPartyCookies(browser,false);
        browser.setWebViewClient(new WebViewClient(){
            @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){
                if(!request.isForMainFrame())return !allowed(request.getUrl().toString());
                boolean ok=allowed(request.getUrl().toString());
                if(!ok)Toast.makeText(WordBrowserActivity.this,"Only trusted HTTPS reference sites open here",Toast.LENGTH_SHORT).show();
                return !ok;
            }
        });
        setContentView(root);
        word.setText(getIntent().getStringExtra("word")==null?"":getIntent().getStringExtra("word"));
        if(word.getText().length()>0)search();
    }
    @Override public void onBackPressed(){if(browser!=null&&browser.canGoBack())browser.goBack();else super.onBackPressed();}
    @Override protected void onDestroy(){if(browser!=null){browser.stopLoading();browser.destroy();browser=null;}super.onDestroy();}
}
