package com.veilforge.realmagent;
import java.security.*;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;
import static org.junit.Assert.*;
@RunWith(RobolectricTestRunner.class) @Config(sdk=28)
public class ReleaseManifestTest {
 static KeyPair keys;final long now=1800000000000L;
 @BeforeClass public static void key()throws Exception{KeyPairGenerator g=KeyPairGenerator.getInstance("RSA");g.initialize(2048);keys=g.generateKeyPair();}
 JSONObject release()throws Exception{return new JSONObject().put("schema",1).put("applicationId","com.veilforge.realmagent.live").put("versionCode",200002).put("issuedAt",now).put("expiresAt",now+86400000).put("size",100).put("sha256",new String(new char[64]).replace('\0','a')).put("notes","Update").put("url","https://github.com/timmytwopointoh/New-game-/releases/download/test/Realm-AI-Live.apk");}
 ReleaseManifest verify(JSONObject m)throws Exception{byte[] p=m.toString().getBytes(StandardCharsets.UTF_8);Signature s=Signature.getInstance("SHA256withRSA");s.initSign(keys.getPrivate());s.update(p);return ReleaseManifest.verifySigned(p,s.sign(),keys.getPublic(),"com.veilforge.realmagent.live",200001,now);}
 void reject(String field,Object value)throws Exception{JSONObject m=release().put(field,value);try{verify(m);fail("Accepted "+field);}catch(SecurityException expected){}}
 @Test public void signedReleaseAccepted()throws Exception{assertEquals(200002,verify(release()).version);}
 @Test public void wrongIdentityRejected()throws Exception{reject("applicationId","com.veilforge.realmagent");}
 @Test public void staleReleaseNotOffered()throws Exception{try{verify(release().put("versionCode",200001));fail();}catch(ReleaseManifest.NoUpdateException expected){}}
 @Test public void expiredAndFutureRejected()throws Exception{reject("expiresAt",now-1);reject("issuedAt",now+600000);reject("expiresAt",now+8L*86400000);}
 @Test public void artifactBoundsRejected()throws Exception{reject("size",-1);reject("size",ReleaseManifest.MAX_BYTES+1);reject("sha256","bad");reject("versionCode",200002.5);}
 @Test public void hostileURLsRejected()throws Exception{for(String u:new String[]{"http://github.com/timmytwopointoh/New-game-/releases/download/a/x.apk","https://attacker.example/a.apk","https://github.com/other/repo/releases/download/a/x.apk","https://user:pass@github.com/timmytwopointoh/New-game-/releases/download/a/x.apk"})reject("url",u);}
 @Test public void tamperingAndWrongKeyRejected()throws Exception{byte[] p=release().toString().getBytes(StandardCharsets.UTF_8);Signature s=Signature.getInstance("SHA256withRSA");s.initSign(keys.getPrivate());s.update(p);byte[] sig=s.sign();sig[0]^=1;try{ReleaseManifest.verifySigned(p,sig,keys.getPublic(),"com.veilforge.realmagent.live",200001,now);fail();}catch(SignatureException|SecurityException expected){}}
}
