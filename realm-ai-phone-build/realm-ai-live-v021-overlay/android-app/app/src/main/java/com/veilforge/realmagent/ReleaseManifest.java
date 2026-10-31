package com.veilforge.realmagent;

import org.json.JSONObject;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.security.cert.*;
import java.io.ByteArrayInputStream;
import android.util.Base64;

/** Release authorization uses the installed APK certificate, never a key from the server. */
final class ReleaseManifest {
    static final long MAX_BYTES = 256L * 1024 * 1024;
    final long version, size; final String url, sha256, notes;
    private ReleaseManifest(JSONObject m) throws Exception {
        version = m.getLong("versionCode"); size = m.getLong("size");
        url = m.getString("url"); sha256 = m.getString("sha256"); notes = m.getString("notes");
    }
    static URI allowedDownload(String value) throws Exception {
        URI u = new URI(value);
        if (!"https".equals(u.getScheme()) || u.getRawUserInfo()!=null || u.getRawFragment()!=null ||
            (u.getPort()!=-1 && u.getPort()!=443)) throw new SecurityException("HTTPS release required");
        if (!"github.com".equals(u.getHost()) || !u.getPath().startsWith("/timmytwopointoh/New-game-/releases/download/"))
            throw new SecurityException("Unexpected release host/path");
        return u;
    }
    static ReleaseManifest verify(String envelope, byte[] installedCertificate, String appId, long current, long now) throws Exception {
        if (envelope.length()>65536) throw new SecurityException("Oversized release metadata");
        JSONObject e = new JSONObject(envelope);
        byte[] payload=Base64.decode(e.getString("payload"),Base64.NO_WRAP);
        byte[] signature=Base64.decode(e.getString("signature"),Base64.NO_WRAP);
        if(payload.length>32768 || signature.length>1024) throw new SecurityException("Oversized signature/payload");
        java.security.cert.Certificate cert=CertificateFactory.getInstance("X.509").generateCertificate(new ByteArrayInputStream(installedCertificate));
        return verifySigned(payload, signature, cert.getPublicKey(), appId, current, now);
    }
    static ReleaseManifest verifySigned(byte[] payload,byte[] signature,PublicKey publicKey,String appId,long current,long now)throws Exception{
        Signature verifier=Signature.getInstance("SHA256withRSA");verifier.initVerify(publicKey);verifier.update(payload);
        if (!verifier.verify(signature)) throw new SecurityException("Release signature rejected");
        JSONObject m=new JSONObject(new String(payload,StandardCharsets.UTF_8));
        if(m.getInt("schema")!=1 || !appId.equals(m.getString("applicationId"))) throw new SecurityException("Wrong application");
        long issued=m.getLong("issuedAt"), expires=m.getLong("expiresAt");
        if(issued>now+300000 || expires<=now || expires<=issued || expires-issued>7L*86400000) throw new SecurityException("Expired release metadata");
        ReleaseManifest r=new ReleaseManifest(m);
        if(!(m.get("versionCode") instanceof Integer || m.get("versionCode") instanceof Long) || !(m.get("size") instanceof Integer || m.get("size") instanceof Long))throw new SecurityException("Integer version and size required");
        if(r.version<=current) throw new NoUpdateException();
        if(r.size<=0 || r.size>MAX_BYTES || !r.sha256.matches("[a-f0-9]{64}") || r.notes.length()>4000)
            throw new SecurityException("Invalid release artifact");
        allowedDownload(r.url);return r;
    }
    static final class NoUpdateException extends Exception {}
}
