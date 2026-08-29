package com.alfattahfinance.mixeronline;
import android.app.*; import android.os.*; import android.content.*; import android.provider.MediaStore; import android.webkit.*;
public class MainActivity extends Activity {
 WebView web;
 @Override public void onCreate(Bundle b){super.onCreate(b); web=new WebView(this); web.getSettings().setJavaScriptEnabled(true);web.getSettings().setDomStorageEnabled(true);web.setWebViewClient(new WebViewClient());web.addJavascriptInterface(new NativeMedia(this),"NativeMedia");web.loadUrl("file:///android_asset/index.html");setContentView(web);}
 public static class NativeMedia {
  final Activity a; NativeMedia(Activity x){a=x;}
  private void launch(Intent i){try{a.startActivity(i);}catch(Exception e){Intent v=new Intent(Intent.ACTION_VIEW);v.setType("audio/*");a.startActivity(v);}}
  @JavascriptInterface public void openRecorder(){launch(new Intent(MediaStore.Audio.Media.RECORD_SOUND_ACTION));}
  @JavascriptInterface public void openFiles(){Intent i=new Intent(Intent.ACTION_OPEN_DOCUMENT);i.setType("*/*");i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE,true);i.addCategory(Intent.CATEGORY_OPENABLE);a.startActivityForResult(i,100);}
  @JavascriptInterface public void openMusic(){
    // Try the Android music-player intents in order. Some OEM music apps do not
    // advertise CATEGORY_APP_MUSIC but still handle the legacy MUSIC_PLAYER action.
    Intent[] candidates = new Intent[]{
      new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_APP_MUSIC),
      new Intent("android.intent.action.MUSIC_PLAYER"),
      new Intent("android.intent.action.MUSIC_PLAYER").addCategory(Intent.CATEGORY_DEFAULT)
    };
    for(Intent i:candidates){
      try{
        if(i.resolveActivity(a.getPackageManager())!=null){a.startActivity(i);return;}
      }catch(Exception ignored){}
    }
    // Last resort: show only apps registered to handle audio playback.
    Intent v=new Intent(Intent.ACTION_VIEW);
    v.setType("audio/*");
    v.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
    try{a.startActivity(v);}catch(Exception ignored){}
  }
 }
 @Override public void onBackPressed(){if(web.canGoBack())web.goBack();else super.onBackPressed();}
}
