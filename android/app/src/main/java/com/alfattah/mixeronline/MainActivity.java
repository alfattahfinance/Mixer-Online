package com.alfattah.mixeronline;

import android.app.Activity;
import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;

import java.util.Collections;

public class MainActivity extends Activity {
    private WebView webView;
    private NativeBluetoothBridge bluetoothBridge;

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

    private void installBluetoothShim() {
        String shim = "(function(){" +
                "if(window.__mixerAndroidBluetoothShim)return;" +
                "window.__mixerAndroidBluetoothShim=true;" +
                "var deviceWaiters=[];var connectWaiters=[];var notifyWaiters=[];" +
                "var selected=null;var connected=false;var deviceListeners={};var rxListeners=[];" +
                "function fire(name,event){(deviceListeners[name]||[]).slice().forEach(function(fn){try{fn(event)}catch(e){}})}" +
                "function b64(a){var s='';for(var i=0;i<a.length;i++)s+=String.fromCharCode(a[i]);return btoa(s)}" +
                "function bytes(s){var b=atob(s),a=new Uint8Array(b.length);for(var i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return a}" +
                "function characteristic(uuid){return {uuid:uuid,properties:{write:true,writeWithoutResponse:true,notify:true}," +
                "writeValue:function(data){AndroidBluetooth.write(b64(new Uint8Array(data)));return Promise.resolve()}," +
                "writeValueWithoutResponse:function(data){AndroidBluetooth.write(b64(new Uint8Array(data)));return Promise.resolve()}," +
                "startNotifications:function(){return new Promise(function(resolve,reject){notifyWaiters.push({resolve:resolve,reject:reject});AndroidBluetooth.startNotifications()})}," +
                "addEventListener:function(type,fn){if(type==='characteristicvaluechanged')rxListeners.push(fn)}," +
                "removeEventListener:function(type,fn){if(type==='characteristicvaluechanged')rxListeners=rxListeners.filter(function(x){return x!==fn})}}}" +
                "function service(uuid){return {uuid:uuid,getCharacteristic:function(c){return Promise.resolve(characteristic(c))},getCharacteristics:function(){return Promise.resolve([characteristic(uuid)])}}}" +
                "function server(){return {getPrimaryService:function(uuid){return Promise.resolve(service(uuid))},getPrimaryServices:function(){return Promise.resolve([service('6e400001-b5a3-f393-e0a9-e50e24dcca9e')])}}}" +
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
        // The normal WebViewClient above installs the fallback/adapter after
        // page load. This branch is intentionally empty for modern WebView;
        // DOCUMENT_START_SCRIPT is used so navigator.bluetooth exists before
        // the website's scripts execute.
    }

    /**
     * Android-only compatibility fix.
     *
     * The existing website has two Bluetooth layers: bluetooth-bridge.js
     * exposes MixerBluetooth, while adapters.js owns the actual mixer TX/RX
     * state. On Android WebView the old button could connect the raw BLE
     * characteristic without registering that connection in MixerAdapters.
     * The result was "connected" UI but mixer controls had no transport.
     *
     * Do not modify the website. Instead, after the packaged page loads,
     * route the website's existing MixerBluetooth API to MixerAdapters only
     * inside the APK. Desktop/web behavior is untouched.
     */
    private void installAndroidMixerBluetoothAdapter() {
        String patch = "(function(){" +
                "if(window.__mixerAndroidAdapterPatch)return;" +
                "window.__mixerAndroidAdapterPatch=true;" +
                "function install(){" +
                "if(!window.MixerAdapters||typeof window.MixerAdapters.connectBluetooth!=='function')return false;" +
                "var old=window.MixerBluetooth||{};" +
                "window.MixerBluetooth={" +
                "connect:function(){return window.MixerAdapters.connectBluetooth();}," +
                "send:function(payload){" +
                "try{" +
                "if(payload&&window.MixerAdapters.active&&window.MixerAdapters.active.connected&&typeof window.MixerAdapters.sendMapped==='function')return window.MixerAdapters.sendMapped(payload);" +
                "}catch(e){}" +
                "return typeof old.send==='function'?old.send(payload):Promise.resolve({ok:false,reason:'bluetooth-adapter-offline'});" +
                "}" +
                "};" +
                "var bt=document.getElementById('connectBluetooth');" +
                "if(bt&&!bt.__androidMixerBtBound){" +
                "bt.__androidMixerBtBound=true;" +
                "bt.addEventListener('click',function(){setTimeout(function(){" +
                "try{if(window.MixerAdapters&&window.MixerAdapters.active&&window.MixerAdapters.active.connected)" +
                "{var s=window.MixerAdapters.active;window.MixerControl&&window.MixerControl.setStatus&&window.MixerControl.setStatus({connected:true,transport:'bluetooth',lastRx:s.lastRx||null});}}catch(e){}" +
                "},0);},true);" +
                "}" +
                "return true;" +
                "}" +
                "if(!install()){" +
                "var n=0,t=setInterval(function(){if(install()||++n>100)clearInterval(t);},100);" +
                "}" +
                "})();";
        webView.evaluateJavascript(patch, null);
    }

    @Override public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (bluetoothBridge != null) bluetoothBridge.onRequestPermissionsResult(requestCode, grantResults);
    }

    @Override protected void onDestroy() {
        if (bluetoothBridge != null) bluetoothBridge.disconnect();
        if (webView != null) webView.destroy();
        super.onDestroy();
    }

    @Override public void onBackPressed() {
        if (webView.canGoBack()) webView.goBack(); else super.onBackPressed();
    }
}
