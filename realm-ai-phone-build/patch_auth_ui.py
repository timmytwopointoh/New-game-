#!/usr/bin/env python3
"""Make the one-time Microsoft device code persistent and copyable in the Android UI.
Strictly patches the audited v0.9 Java source after extraction, before Gradle.
"""
from pathlib import Path
import sys

p=Path(sys.argv[1])
s=p.read_text(encoding='utf-8')

def rep(before,after):
    global s
    if s.count(before)!=1:
        raise RuntimeError('Android sign-in UI source changed; refusing patch: '+before[:75])
    s=s.replace(before,after,1)

rep('    LinearLayout log;ScrollView scroll;TextView connection;',
'    LinearLayout log;ScrollView scroll;TextView connection,authCodeLabel;Button copyAuthCode;String displayedAuthCode="";')

rep('        connection=txt("Not running",12,MUTED);root.addView(connection,space(5));',
'''        connection=txt("Not running",12,MUTED);root.addView(connection,space(5));
        authCodeLabel=txt("",18,WHITE);authCodeLabel.setTextIsSelectable(true);
        authCodeLabel.setPadding(d(12),d(12),d(12),d(12));authCodeLabel.setBackground(shape(PANEL));
        root.addView(authCodeLabel,space(7));authCodeLabel.setVisibility(View.GONE);
        copyAuthCode=button("Copy Microsoft sign-in code",()->{
            if(displayedAuthCode.isEmpty())return;
            android.content.ClipboardManager cb=(android.content.ClipboardManager)getSystemService(CLIPBOARD_SERVICE);
            cb.setPrimaryClip(ClipData.newPlainText("Microsoft device sign-in code",displayedAuthCode));
            Toast.makeText(this,"Code copied. Paste it on Microsoft's sign-in page.",Toast.LENGTH_LONG).show();
        });root.addView(copyAuthCode,space(5));copyAuthCode.setVisibility(View.GONE);''')

rep('        String code=info.optString("userCode");',
'''        String code=info.optString("userCode");
        displayedAuthCode=code;authCodeLabel.setText("Microsoft sign-in code: " + code + "\\nEnter it at microsoft.com/link");
        authCodeLabel.setVisibility(View.VISIBLE);copyAuthCode.setVisibility(View.VISIBLE);''')

rep('''          .setPositiveButton("Open Microsoft",(dlg,w)->startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse("https://www.microsoft.com/link"))))
          .setNegativeButton("Close",(dlg,w)->{}).show();}''',
'''          .setPositiveButton("Open Microsoft",(dlg,w)->startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse("https://www.microsoft.com/link"))))
          .setNeutralButton("Copy code",(dlg,w)->{
              android.content.ClipboardManager cb=(android.content.ClipboardManager)getSystemService(CLIPBOARD_SERVICE);
              cb.setPrimaryClip(ClipData.newPlainText("Microsoft device sign-in code",code));
              Toast.makeText(this,"Code copied. Paste it at microsoft.com/link",Toast.LENGTH_LONG).show();
          })
          .setNegativeButton("Close",(dlg,w)->{}).show();}''')

rep('        JSONObject challenge=r.optJSONObject("authChallenge");if(challenge!=null&&!challenge.optString("userCode").isEmpty())connection.setText("Microsoft sign-in required • tap the sign-in button");',
'''        JSONObject challenge=r.optJSONObject("authChallenge");
        String code=challenge==null?"":challenge.optString("userCode","").trim();
        if(!code.isEmpty()&&!code.startsWith("(")){
            displayedAuthCode=code;
            authCodeLabel.setText("MICROSOFT CODE: " + code + "\\nCopy this code, then tap Microsoft sign-in.");
            authCodeLabel.setVisibility(View.VISIBLE);copyAuthCode.setVisibility(View.VISIBLE);
            connection.setText("Microsoft sign-in required • code shown below");
        } else {
            displayedAuthCode="";authCodeLabel.setVisibility(View.GONE);copyAuthCode.setVisibility(View.GONE);
        }''')
p.write_text(s,encoding='utf-8')
print('Patched: Microsoft sign-in code visible in main screen, copy action present')
