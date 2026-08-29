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
  @JavascriptInterface public void openMusic(){Intent i=new Intent(Intent.ACTION_MAIN);i.addCategory(Intent.CATEGORY_APP_MUSIC);launch(i);}
 }
 @Override public void onBackPressed(){if(web.canGoBack())web.goBack();else super.onBackPressed();}
}
