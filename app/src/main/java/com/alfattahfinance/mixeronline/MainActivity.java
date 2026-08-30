package com.alfattahfinance.mixeronline;

import android.app.*;
import android.os.*;
import android.content.*;
import android.provider.MediaStore;
import android.webkit.*;

public class MainActivity extends Activity {
  WebView web;
  static final String MIXER_URL="https://alfattahfinance.github.io/Mixer-Online/";

  @Override public void onCreate(Bundle b){
    super.onCreate(b);
    web=new WebView(this);
    WebSettings s=web.getSettings();
    s.setJavaScriptEnabled(true);
    s.setDomStorageEnabled(true);
    s.setMediaPlaybackRequiresUserGesture(false);
    web.setWebViewClient(new WebViewClient());
    web.addJavascriptInterface(new NativeMedia(this),"NativeMedia");
    web.loadUrl(MIXER_URL);
    setContentView(web);
  }

  public static class NativeMedia {
    final Activity a;
    NativeMedia(Activity x){a=x;}
    private boolean launch(Intent i){try{a.startActivity(i);return true;}catch(Exception e){return false;}}
    @JavascriptInterface public void openRecorder(){launch(new Intent(MediaStore.Audio.Media.RECORD_SOUND_ACTION));}
    @JavascriptInterface public void openFiles(){Intent i=new Intent(Intent.ACTION_OPEN_DOCUMENT);i.setType("*/*");i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE,true);i.addCategory(Intent.CATEGORY_OPENABLE);launch(i);}
    @JavascriptInterface public void openMusic(){
      Intent i=new Intent(Intent.ACTION_MAIN);i.addCategory(Intent.CATEGORY_APP_MUSIC);
      if(launch(i))return;
      if(launch(new Intent("android.intent.action.MUSIC_PLAYER")))return;
      Intent v=new Intent(Intent.ACTION_VIEW);v.setDataAndType(android.net.Uri.parse("content://media/external/audio/media/1"),"audio/*");v.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);launch(v);
    }
  }

  @Override public void onBackPressed(){if(web.canGoBack())web.goBack();else super.onBackPressed();}
}