package com.alfattah.mixeronline;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;

import java.util.Collections;

public class MainActivity extends Activity {
    private WebView webView;
    private NativeBluetoothBridge bluetoothBridge;
    private ValueCallback<Uri[]> fileChooserCallback;
    private static final int FILE_CHOOSER_REQUEST = 8101;

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);

        // Android-only WebView support for the website's <input type="file">
        // music selector. The website itself remains unchanged.
        webView.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(
                    WebView view,
                    ValueCallback<Uri[]> callback,
                    FileChooserParams params) {
                if (fileChooserCallback != null) {
                    fileChooserCallback.onReceiveValue(null);
                }
                fileChooserCallback = callback;
                try {
                    Intent intent = params != null ? params.createIntent() : new Intent(Intent.ACTION_OPEN_DOCUMENT);
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    intent.setType("audio/*");
                    intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                    startActivityForResult(intent, FILE_CHOOSER_REQUEST);
                    return true;
                } catch (Exception e) {
                    if (fileChooserCallback != null) {
                        fileChooserCallback.onReceiveValue(null);
                        fileChooserCallback = null;
                    }
                    return false;
                }
            }
        });

        // Keep the packaged website unchanged. Android only adds the native
        // Bluetooth compatibility layer after the page is loaded.
        webView.setWebViewClient(new WebViewClient() {
            @Override public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                installAndroidMixerBluetoothAdapter();
            }
        });

        // Native BLE is exposed only to the packaged local website. The page
        // itself remains unchanged; the bridge supplies Web Bluetooth APIs
        // that Android WebView does not provide natively.
        bluetoothBridge = new NativeBluetoothBridge(this, webView);
        webView.addJavascriptInterface(bluetoothBridge, "AndroidBluetooth");
        installBluetoothShim();

        // The APK continues to load the exact website copied by android-apk.yml.
        webView.loadUrl("file:///android_asset/web/index.html");
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != FILE_CHOOSER_REQUEST) return;

        if (fileChooserCallback == null) return;
        Uri[] results = null;
        if (resultCode == RESULT_OK && data != null) {
            if (data.getClipData() != null) {
                int count = data.getClipData().getItemCount();
                results = new Uri[count];
                for (int i = 0; i < count; i++) {
                    results[i] = data.getClipData().getItemAt(i).getUri();
                }
            } else if (data.getData() != null) {
                results = new Uri[]{data.getData()};
            }
        }
        fileChooserCallback.onReceiveValue(results);
        fileChooserCallback = null;
    }

    private void installBluetoothShim() {
        String shim = "(function(){" +
                "if(window.__mixerAndroidBluetoothShim)return;" +
                "window.__mixerAndroidBluetoothShim=true;" +
                "var deviceWaiters=[];var connectWaiters=[];var notifyWaiters=[];" +
                "var selected=null;var connected=false;var deviceListeners={};var rxListeners=[];" +
                "function fire(name,event){(deviceListeners[name]||[]).slice().forEach(function(fn){try{fn(event)}catch(e){}})}" +
                "function b64(a){var s='';for(var i=0;i<a.length;i++)s+=String.fromCharCode(a[i]);return btoa(s)}" +
                "function bytes(s){var b=atob(s),a=new Uint8Array(b.length);for(var i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return a}" +
                "function characteristic(uuid,props){return {uuid:uuid,properties:props||{write:true,writeWithoutResponse:true,notify:true}," +
                "writeValue:function(data){AndroidBluetooth.write(b64(new Uint8Array(data)));return Promise.resolve()}," +
                "writeValueWithoutResponse:function(data){AndroidBluetooth.write(b64(new Uint8Array(data)));return Promise.resolve()}," +
                "startNotifications:function(){return new Promise(function(resolve,reject){notifyWaiters.push({resolve:resolve,reject:reject});AndroidBluetooth.startNotifications()})}," +
                "addEventListener:function(type,fn){if(type==='characteristicvaluechanged')rxListeners.push(fn)}," +
                "removeEventListener:function(type,fn){if(type==='characteristicvaluechanged')rxListeners=rxListeners.filter(function(x){return x!==fn})}}}" +
                "function service(uuid){return {uuid:uuid,getCharacteristic:function(c){return Promise.resolve(characteristic(c,c===\'6e400002-b5a3-f393-e0a9-e50e24dcca9e\'?{write:true,writeWithoutResponse:true}:c===\'6e400003-b5a3-f393-e0a9-e50e24dcca9e\'?{notify:true}:{write:true,writeWithoutResponse:true,notify:true}))},getCharacteristics:function(){return Promise.resolve([characteristic(\'6e400002-b5a3-f393-e0a9-e50e24dcca9e\',{write:true,writeWithoutResponse:true}),characteristic(\'6e400003-b5a3-f393-e0a9-e50e24dcca9e\',{notify:true})])}}}" +
                "function server(){return {getPrimaryService:function(uuid){return Promise.resolve(service(uuid))},getPrimaryServices:function(){return Promise.resolve([service(\'6e400001-b5a3-f393-e0a9-e50e24dcca9e\')])}}}" +
                "function dev(address,name){var d={id:address,name:name||'BLUETOOTH MIXER',gatt:{connected:false,connect:function(){return new Promise(function(resolve,reject){connectWaiters.push({resolve:resolve,reject:reject});AndroidBluetooth.connect(address)})},disconnect:function(){AndroidBluetooth.disconnect();d.gatt.connected=false;fire('gattserverdisconnected',{})}}};d.addEventListener=function(type,fn){(deviceListeners[type]||(deviceListeners[type]=[])).push(fn)};return d}" +
                "window.__mixerBtDeviceSelected=function(address,name){selected=dev(address,name);deviceWaiters.splice(0).forEach(function(w){w.resolve(selected)})}" +
                "window.__mixerBtDeviceError=function(msg){deviceWaiters.splice(0).forEach(function(w){w.reject(new Error(msg||'Bluetooth scan gagal'))})}" +
                "window.__mixerBtConnected=function(ok,name){if(!ok){connectWaiters.splice(0).forEach(function(w){w.reject(new Error(name||'Bluetooth connection gagal'))});return}connected=true;if(selected){selected.name=name||selected.name;selected.gatt.connected=true}var s=server();connectWaiters.splice(0).forEach(function(w){w.resolve(s)})}" +
                "window.__mixerBtDisconnected=function(){connected=false;if(selected){selected.gatt.connected=false;fire('gattserverdisconnected',{})}}" +
                "window.__mixerBtWriteResult=function(ok,msg){}" +
                "window.__mixerBtNotifyResult=function(ok,msg){notifyWaiters.splice(0).forEach(function(w){if(ok)w.resolve(true);else w.reject(new Error(msg||'Notification gagal'))})}" +
                "window.__mixerBtOnRx=function(payload){var a=bytes(payload);var ev={target:{value:new DataView(a.buffer)}};rxListeners.slice().forEach(function(fn){try{fn(ev)}catch(e){}})}" +
                "var api={requestDevice:function(){return new Promise(function(resolve,reject){deviceWaiters.push({resolve:resolve,reject:reject});AndroidBluetooth.requestDevice()})}};" +
                "try{Object.defineProperty(navigator,'bluetooth',{configurable:true,value:api})}catch(e){try{navigator.bluetooth=api}catch(x){}}" +
                "window.MixerAndroidBluetooth={native:true};" +
                "})();";

        if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            WebViewCompat.addDocumentStartJavaScript(
                    webView,
                    shim,
                    Collections.singleton("file://")
            );
        }
    }

    /** Android-only compatibility layer for the existing mixer website. */
    private void installAndroidMixerBluetoothAdapter() {
        String patch = "(function(){" +
                "if(window.__mixerAndroidAdapterPatch)return;" +
                "window.__mixerAndroidAdapterPatch=true;" +
                "function install(){" +
                "if(!window.MixerAdapters||typeof window.MixerAdapters.connectBluetooth!=='function')return false;" +
                "window.MixerAndroidBluetoothReady=true;" +
                "var bt=document.getElementById('connectBluetooth');" +
                "if(bt&&!bt.__androidMixerBtBound){bt.__androidMixerBtBound=true;bt.setAttribute('data-android-bluetooth','native-ble');}" +
                "return true;" +
                "}" +
                "if(!install()){var n=0,t=setInterval(function(){if(install()||++n>100)clearInterval(t);},100);}" +
                "})();";
        webView.evaluateJavascript(patch, null);
    }

    @Override public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (bluetoothBridge != null) bluetoothBridge.onRequestPermissionsResult(requestCode, grantResults);
    }

    @Override protected void onDestroy() {
        if (fileChooserCallback != null) {
            fileChooserCallback.onReceiveValue(null);
            fileChooserCallback = null;
        }
        if (bluetoothBridge != null) bluetoothBridge.disconnect();
        if (webView != null) webView.destroy();
        super.onDestroy();
    }

    @Override public void onBackPressed() {
        if (webView.canGoBack()) webView.goBack(); else super.onBackPressed();
    }
}
