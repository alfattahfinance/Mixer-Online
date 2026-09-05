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

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Collections;

/**
 * Android shell for the existing Mixer-Online website.
 * The website itself is copied unchanged into assets/web by the APK workflow.
 * Android-only Bluetooth support is injected at runtime from res/raw.
 */
public class MainActivity extends Activity {
    private WebView webView;
    private NativeBluetoothBridge bluetoothBridge;
    private ValueCallback<Uri[]> fileChooserCallback;
    private static final int FILE_CHOOSER_REQUEST = 8101;
    private static final String WEB_BASE_URL = "file:///android_asset/web/";

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
        settings.setDatabaseEnabled(true);

        webView.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(
                    WebView view,
                    ValueCallback<Uri[]> callback,
                    FileChooserParams params) {
                if (fileChooserCallback != null) fileChooserCallback.onReceiveValue(null);
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

        webView.setWebViewClient(new WebViewClient() {
            @Override public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                installAndroidMixerStatusPatch();
            }
        });

        bluetoothBridge = new NativeBluetoothBridge(this, webView);
        webView.addJavascriptInterface(bluetoothBridge, "AndroidBluetooth");

        installBluetoothDocumentStart();
        loadMixerWebsite();
    }

    /**
     * Loads the exact website from assets/web, while replacing only the Bluetooth
     * script at runtime with the Android-only bridge. No repository website file is edited.
     */
    private void loadMixerWebsite() {
        try {
            String html = readAssetText("web/index.html");
            String androidBluetooth = readRawText(com.alfattah.mixeronline.R.raw.bluetooth_bridge);

            // The Android bridge must execute before adapters.js and the rest of the page.
            String headTag = "<script>" + androidBluetooth + "</script>";
            int head = html.toLowerCase().indexOf("<head");
            if (head >= 0) {
                int close = html.indexOf('>', head);
                if (close >= 0) html = html.substring(0, close + 1) + headTag + html.substring(close + 1);
                else html = headTag + html;
            } else {
                html = headTag + html;
            }

            // Patch only the in-memory copy of adapters.js. The repository adapters.js
            // remains untouched and therefore the live website/engine is unchanged.
            html = inlinePatchedAdapters(html);

            // Prevent the normal Web Bluetooth-only bridge from showing an unsupported
            // browser alert inside the APK. The Android bridge above replaces its role.
            String originalBridgeTag = "<script src=\"bluetooth-bridge.js\"></script>";
            if (html.contains(originalBridgeTag)) {
                html = html.replace(originalBridgeTag, "<!-- Android native bluetooth bridge is injected above. -->");
            }

            webView.loadDataWithBaseURL(WEB_BASE_URL, html, "text/html", "UTF-8", null);
        } catch (IOException e) {
            webView.loadUrl(WEB_BASE_URL + "index.html");
        }
    }

    private String inlinePatchedAdapters(String html) throws IOException {
        String open = "<script src=\"adapters.js";
        int start = html.indexOf(open);
        if (start < 0) return html;
        int end = html.indexOf("</script>", start);
        if (end < 0) return html;
        end += "</script>".length();

        String adapters = readAssetText("web/adapters.js");
        // Do broad, formatting-independent substitutions so a whitespace/version change
        // in the website does not silently restore web-bluetooth-unsupported in the APK.
        adapters = adapters.replace(
                "if (!navigator.bluetooth)",
                "if (!navigator.bluetooth && !window.MixerAndroidBluetooth)");
        adapters = adapters.replace(
                "navigator.bluetooth.requestDevice(",
                "(navigator.bluetooth || window.MixerAndroidBluetooth).requestDevice(");
        adapters = adapters.replace(
                "supportsBluetooth: () => !!navigator.bluetooth",
                "supportsBluetooth: () => !!(navigator.bluetooth || window.MixerAndroidBluetooth)");

        return html.substring(0, start)
                + "<script>\n" + adapters + "\n</script>"
                + html.substring(end);
    }

    private String readAssetText(String path) throws IOException {
        try (InputStream input = getAssets().open(path);
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192];
            int count;
            while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
            return new String(output.toByteArray(), StandardCharsets.UTF_8);
        }
    }

    private String readRawText(int resourceId) throws IOException {
        try (InputStream input = getResources().openRawResource(resourceId);
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192];
            int count;
            while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
            return new String(output.toByteArray(), StandardCharsets.UTF_8);
        }
    }

    private void installBluetoothDocumentStart() {
        try {
            String bridge = readRawText(com.alfattah.mixeronline.R.raw.bluetooth_bridge);
            if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
                WebViewCompat.addDocumentStartJavaScript(webView, bridge, Collections.singleton("*"));
            }
        } catch (Exception ignored) {
            // The bridge is also injected into index.html, so document-start support is optional.
        }
    }

    /** Keeps the existing mixer UI's status indicators synchronized with native BLE. */
    private void installAndroidMixerStatusPatch() {
        if (webView == null) return;
        String js = "(function(){"
                + "if(window.__mixerAndroidStatusPatch)return;window.__mixerAndroidStatusPatch=true;"
                + "function sync(s){var on=!!(s&&s.connected);"
                + "var x=document.getElementById('status');if(x){x.textContent=on?'BLUETOOTH ONLINE':'BRIDGE STANDBY';}"
                + "var l=document.getElementById('statusLamp');if(l)l.className=on?'live':'';"
                + "var h=document.getElementById('headerBridgeStatus');if(h)h.textContent=on?'BLUETOOTH ONLINE':'BRIDGE STANDBY';"
                + "var t=document.getElementById('testTransportLabel');if(t)t.textContent=on?'ESP32 BRIDGE BLUETOOTH ONLINE':'OFFLINE';"
                + "var f=document.getElementById('footerConnection');if(f)f.textContent=on?'● BLUETOOTH ONLINE':'● BLUETOOTH OFFLINE';}"
                + "document.addEventListener('mixer:android-bluetooth-status',function(e){sync(e.detail||{});});"
                + "sync({connected:window.MixerAndroidBluetooth&&window.MixerAndroidBluetooth.isConnected&&window.MixerAndroidBluetooth.isConnected()});"
                + "})();";
        webView.evaluateJavascript(js, null);
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != FILE_CHOOSER_REQUEST || fileChooserCallback == null) return;
        Uri[] results = null;
        if (resultCode == RESULT_OK && data != null) {
            if (data.getClipData() != null) {
                int count = data.getClipData().getItemCount();
                results = new Uri[count];
                for (int i = 0; i < count; i++) results[i] = data.getClipData().getItemAt(i).getUri();
            } else if (data.getData() != null) {
                results = new Uri[]{data.getData()};
            }
        }
        fileChooserCallback.onReceiveValue(results);
        fileChooserCallback = null;
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
        if (webView != null) webView.destroy();
        super.onDestroy();
    }

    @Override public void onBackPressed() {
        if (webView.canGoBack()) webView.goBack(); else super.onBackPressed();
    }
}
