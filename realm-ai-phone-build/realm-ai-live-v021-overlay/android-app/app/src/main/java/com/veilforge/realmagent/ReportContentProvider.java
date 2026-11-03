package com.veilforge.realmagent;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;
import java.io.File;
import java.io.FileNotFoundException;

/** Read-only Android share boundary for ONE sanitized diagnostic ZIP.
 * Never grants access to Microsoft tokens, source files or arbitrary app data.
 */
public final class ReportContentProvider extends ContentProvider {
    private static final String PREFIX="Realm-AI-Live-ALL-DIAGNOSTICS-";
    private static final String SUFFIX=".zip";
    private static final String FOLDER="diagnostic-reports";
    public static File reportDirectory(android.content.Context c) {
        File dir=new File(c.getCacheDir(),FOLDER);
        if(!dir.isDirectory()&&!dir.mkdirs())throw new IllegalStateException("Cannot create private report directory");
        return dir;
    }
    public static Uri uri(android.content.Context c, File report){
        String name=report.getName();
        if(!allowed(name)||!report.getParentFile().equals(reportDirectory(c)))
            throw new SecurityException("Only generated all-in-one diagnostic ZIPs can be shared");
        return new Uri.Builder().scheme("content").authority(c.getPackageName()+".reports").appendPath(name).build();
    }
    private static boolean allowed(String name){
        return name!=null&&name.matches("^Realm-AI-Live-ALL-DIAGNOSTICS-[0-9]{13}\\.zip$");
    }
    private File resolve(Uri uri)throws FileNotFoundException{
        if(getContext()==null||!getContext().getPackageName().concat(".reports").equals(uri.getAuthority()))
            throw new FileNotFoundException("Invalid report authority");
        String name=uri.getLastPathSegment();
        if(uri.getPathSegments().size()!=1||!allowed(name))
            throw new FileNotFoundException("Invalid report filename");
        File file=new File(reportDirectory(getContext()),name);
        if(!file.isFile()||file.length()==0||file.length()>4*1024*1024)
            throw new FileNotFoundException("Report unavailable or invalid");
        return file;
    }
    @Override public boolean onCreate(){return true;}
    @Override public String getType(Uri uri){return "application/zip";}
    @Override public Cursor query(Uri uri,String[] projection,String selection,String[] selectionArgs,String sortOrder){
        try{
            File file=resolve(uri);
            String[] cols=projection==null?new String[]{OpenableColumns.DISPLAY_NAME,OpenableColumns.SIZE}:projection;
            MatrixCursor cursor=new MatrixCursor(cols);
            Object[] values=new Object[cols.length];
            for(int i=0;i<cols.length;i++){
                if(OpenableColumns.DISPLAY_NAME.equals(cols[i]))values[i]=file.getName();
                else if(OpenableColumns.SIZE.equals(cols[i]))values[i]=file.length();
            }
            cursor.addRow(values);return cursor;
        }catch(FileNotFoundException ignored){return null;}
    }
    @Override public ParcelFileDescriptor openFile(Uri uri,String mode)throws FileNotFoundException{
        if(!"r".equals(mode))throw new FileNotFoundException("Report is read-only");
        return ParcelFileDescriptor.open(resolve(uri),ParcelFileDescriptor.MODE_READ_ONLY);
    }
    @Override public Uri insert(Uri uri,ContentValues values){throw new UnsupportedOperationException("Read-only");}
    @Override public int update(Uri uri,ContentValues values,String selection,String[] selectionArgs){throw new UnsupportedOperationException("Read-only");}
    @Override public int delete(Uri uri,String selection,String[] selectionArgs){throw new UnsupportedOperationException("Read-only");}
}
