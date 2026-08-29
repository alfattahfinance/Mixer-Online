package com.alfattahfinance.mixeronline;
import android.app.*; import android.os.*; import android.content.*; import android.provider.MediaStore; import android.webkit.*;
public class MainActivity extends Activity {
 WebView web;
 @Override public void onCreate(Bundle b){super.onCreate(b); web=new WebView(this); web.getSettings().setJavaScriptEnabled(true);web.getSettings().setDomStorageEnabled(true);web.setWebViewClient(new WebViewClient());web.addJavascriptInterface(new NativeMedia(this),"NativeMedia");web.loadUrl("file:///android_asset/index.html");setContentView(web);}
 public static class NativeMedia {
  final Activity a; NativeMedia(Activity x){a=x;}
  private boolean launch(Intent i){try{a.startActivity(i);return true;}catch(Exception e){return false;}}
  @JavascriptInterface public void openRecorder(){launch(new Intent(MediaStore.Audio.Media.RECORD_SOUND_ACTION));}
  @JavascriptInterface public void openFiles(){Intent i=new Intent(Intent.ACTION_OPEN_DOCUMENT);i.setType("*/*");i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE,true);i.addCategory(Intent.CATEGORY_OPENABLE);a.startActivityForResult(i,100);}
  @JavascriptInterface public void openMusic(){
    // First ask Android for any app registered as the device music app.
    Intent i=new Intent(Intent.ACTION_MAIN);
    i.addCategory(Intent.CATEGORY_APP_MUSIC);
    if(launch(i)) return;
    // Legacy music-player action used by several OEM players.
    if(launch(new Intent("android.intent.action.MUSIC_PLAYER"))) return;
    // Explicitly resolve an audio VIEW handler. This opens a real audio app,
    // not the Mixer WebView.
    Intent v=new Intent(Intent.ACTION_VIEW);
    v.setDataAndType(android.net.Uri.parse("content://media/external/audio/media/1"),"audio/*");
    v.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
    launch(v);
  }
 }
 @Override public void onBackPressed(){if(web.canGoBack())web.goBack();else super.onBackPressed();}
}
