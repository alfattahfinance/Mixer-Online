package com.alfattahfinance.mixeronline;
import android.app.*; import android.os.*; import android.content.*; import android.net.*; import android.webkit.*; import android.provider.MediaStore;
public class MainActivity extends Activity {
 WebView web;
 @Override public void onCreate(Bundle b){super.onCreate(b); web=new WebView(this); web.getSettings().setJavaScriptEnabled(true); web.getSettings().setDomStorageEnabled(true); web.addJavascriptInterface(new NativeMedia(this),"NativeMedia"); web.setWebViewClient(new WebViewClient()); web.loadUrl("file:///android_asset/index.html"); setContentView(web);}
 public static class NativeMedia {
  final Activity a; NativeMedia(Activity x){a=x;}
  @JavascriptInterface public void openRecorder(){Intent i=new Intent(MediaStore.Audio.Media.RECORD_SOUND_ACTION); try{a.startActivity(i);}catch(Exception e){a.startActivity(new Intent(MediaStore.INTENT_ACTION_MUSIC_PLAYER));}}
  @JavascriptInterface public void openFiles(){Intent i=new Intent(Intent.ACTION_OPEN_DOCUMENT);i.setType("*/*");i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE,true);i.addCategory(Intent.CATEGORY_OPENABLE);a.startActivityForResult(i,100);}
  @JavascriptInterface public void openMusic(){Intent i=new Intent(Intent.ACTION_MAIN);i.addCategory(Intent.CATEGORY_APP_MUSIC);try{a.startActivity(i);}catch(Exception e){Intent v=new Intent(Intent.ACTION_VIEW);v.setType("audio/*");v.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);a.startActivity(v);}}
 }
 @Override public void onBackPressed(){if(web.canGoBack())web.goBack();else super.onBackPressed();}
}
