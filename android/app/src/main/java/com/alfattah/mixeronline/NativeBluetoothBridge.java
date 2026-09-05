package com.alfattah.mixeronline;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothGatt;
import android.bluetooth.BluetoothGattCallback;
import android.bluetooth.BluetoothGattCharacteristic;
import android.bluetooth.BluetoothGattDescriptor;
import android.bluetooth.BluetoothGattService;
import android.bluetooth.BluetoothManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import org.json.JSONArray;
import org.json.JSONObject;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Android-only BLE bridge for the existing Mixer-Online Web Bluetooth code. */
public final class NativeBluetoothBridge {
    private static final int REQ_BT = 7001;
    private static final long SCAN_MS = 10000L;
    private static final String PREFS = "mixer_online_esp32";
    private static final String SAVED_FEEDBACK = "saved_feedback_state_v1";
    private static final UUID UART_SERVICE = UUID.fromString("6e400001-b5a3-f393-e0a9-e50e24dcca9e");
    private static final UUID UART_RX = UUID.fromString("6e400002-b5a3-f393-e0a9-e50e24dcca9e");
    private static final UUID UART_TX = UUID.fromString("6e400003-b5a3-f393-e0a9-e50e24dcca9e");
    private static final UUID HM_SERVICE = UUID.fromString("0000ffe0-0000-1000-8000-00805f9b34fb");
    private static final UUID HM_CHAR = UUID.fromString("0000ffe1-0000-1000-8000-00805f9b34fb");
    private static final UUID CCCD = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb");

    private final Activity activity;
    private final WebView webView;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final Map<String, BluetoothDevice> scanDevices = new LinkedHashMap<>();
    private final StringBuilder rxBuffer = new StringBuilder();
    private BluetoothLeScanner scanner;
    private ScanCallback scanCallback;
    private BluetoothGatt gatt;
    private BluetoothGattCharacteristic writeCharacteristic;
    private BluetoothGattCharacteristic notifyCharacteristic;
    private boolean waitingForPermission;
    private boolean scanning;

    public NativeBluetoothBridge(Activity activity, WebView webView) {
        this.activity = activity;
        this.webView = webView;
    }

    @JavascriptInterface
    public void requestDevice() {
        main.post(() -> {
            if (!hasBluetoothPermissions()) {
                waitingForPermission = true;
                requestBluetoothPermissions();
                return;
            }
            startScan();
        });
    }

    @JavascriptInterface
    public void connect(String address) {
        main.post(() -> {
            BluetoothDevice device = scanDevices.get(address);
            if (device == null) {
                js("window.__mixerBtConnected(false,'Perangkat Bluetooth tidak ditemukan')");
                return;
            }
            stopScan();
            closeGatt();
            try {
                gatt = device.connectGatt(activity, false, gattCallback, BluetoothDevice.TRANSPORT_LE);
            } catch (SecurityException e) {
                js("window.__mixerBtConnected(false," + q(e.getMessage()) + ")");
            }
        });
    }

    @JavascriptInterface
    public void write(String base64) {
        main.post(() -> {
            if (gatt == null || writeCharacteristic == null) {
                js("window.__mixerBtWriteResult(false,'BLE write characteristic belum siap')");
                return;
            }
            try {
                byte[] data = Base64.decode(base64, Base64.DEFAULT);
                writeCharacteristic.setValue(data);
                boolean noResponse = (writeCharacteristic.getProperties() & BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE) != 0;
                if (Build.VERSION.SDK_INT >= 33) {
                    gatt.writeCharacteristic(writeCharacteristic, data,
                            noResponse ? BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE : BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT);
                } else {
                    writeCharacteristic.setWriteType(noResponse ? BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE : BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT);
                    gatt.writeCharacteristic(writeCharacteristic);
                }
                js("window.__mixerBtWriteResult(true,'')");
            } catch (Exception e) {
                js("window.__mixerBtWriteResult(false," + q(e.getMessage()) + ")");
            }
        });
    }

    @JavascriptInterface
    public void startNotifications() {
        main.post(() -> {
            if (gatt == null || notifyCharacteristic == null) {
                js("window.__mixerBtNotifyResult(false,'BLE notify characteristic belum siap')");
                return;
            }
            try {
                boolean ok = gatt.setCharacteristicNotification(notifyCharacteristic, true);
                BluetoothGattDescriptor cccd = notifyCharacteristic.getDescriptor(CCCD);
                if (cccd != null) {
                    cccd.setValue(BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE);
                    gatt.writeDescriptor(cccd);
                }
                js("window.__mixerBtNotifyResult(" + ok + ",'')");
            } catch (Exception e) {
                js("window.__mixerBtNotifyResult(false," + q(e.getMessage()) + ")");
            }
        });
    }

    /** Returns the persistent latest ESP32 feedback snapshot. */
    @JavascriptInterface
    public String getSavedFeedbackState() {
        return activity.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .getString(SAVED_FEEDBACK, "{}");
    }

    /** Clears the persistent ESP32 feedback snapshot. */
    @JavascriptInterface
    public void clearSavedFeedbackState() {
        activity.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit().remove(SAVED_FEEDBACK).apply();
    }

    public void onRequestPermissionsResult(int requestCode, int[] grantResults) {
        if (requestCode != REQ_BT) return;
        boolean ok = grantResults.length > 0;
        for (int r : grantResults) ok &= r == PackageManager.PERMISSION_GRANTED;
        if (ok && waitingForPermission) {
            waitingForPermission = false;
            startScan();
        } else if (waitingForPermission) {
            waitingForPermission = false;
            js("window.__mixerBtDeviceError('Izin Nearby devices/Bluetooth ditolak')");
        }
    }

    private boolean hasBluetoothPermissions() {
        if (Build.VERSION.SDK_INT >= 31) {
            return activity.checkSelfPermission(Manifest.permission.BLUETOOTH_SCAN) == PackageManager.PERMISSION_GRANTED
                    && activity.checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED;
        }
        return activity.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    private void requestBluetoothPermissions() {
        if (Build.VERSION.SDK_INT >= 31) {
            activity.requestPermissions(new String[]{Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT}, REQ_BT);
        } else {
            activity.requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION}, REQ_BT);
        }
    }

    private void startScan() {
        BluetoothManager manager = (BluetoothManager) activity.getSystemService(Context.BLUETOOTH_SERVICE);
        BluetoothAdapter adapter = manager != null ? manager.getAdapter() : null;
        if (adapter == null || !adapter.isEnabled()) {
            js("window.__mixerBtDeviceError('Bluetooth belum aktif di perangkat')");
            return;
        }
        try {
            scanner = adapter.getBluetoothLeScanner();
            if (scanner == null) {
                js("window.__mixerBtDeviceError('BLE scanner tidak tersedia')");
                return;
            }
            scanDevices.clear();
            scanning = true;
            scanCallback = new ScanCallback() {
                @Override public void onScanResult(int callbackType, ScanResult result) {
                    BluetoothDevice d = result.getDevice();
                    if (d != null) scanDevices.put(d.getAddress(), d);
                }
                @Override public void onScanFailed(int errorCode) {
                    scanning = false;
                    js("window.__mixerBtDeviceError('BLE scan gagal: " + errorCode + "')");
                }
            };
            scanner.startScan(scanCallback);
            main.postDelayed(this::finishScanDialog, SCAN_MS);
        } catch (SecurityException e) {
            js("window.__mixerBtDeviceError(" + q(e.getMessage()) + ")");
        }
    }

    private void finishScanDialog() {
        stopScan();
        if (scanDevices.isEmpty()) {
            js("window.__mixerBtDeviceError('Tidak menemukan perangkat BLE. Pastikan ESP32 aktif dan berada dekat HP.')");
            return;
        }
        final List<BluetoothDevice> devices = new ArrayList<>(scanDevices.values());
        final String[] labels = new String[devices.size()];
        for (int i = 0; i < devices.size(); i++) {
            BluetoothDevice d = devices.get(i);
            String name;
            try { name = d.getName(); } catch (SecurityException e) { name = null; }
            labels[i] = (name == null || name.trim().isEmpty() ? "BLE Device" : name) + "\n" + d.getAddress();
        }
        new AlertDialog.Builder(activity)
                .setTitle("Pilih ESP32 / Mixer Bluetooth")
                .setItems(labels, (dialog, which) -> {
                    BluetoothDevice d = devices.get(which);
                    String name;
                    try { name = d.getName(); } catch (SecurityException e) { name = null; }
                    String safeName = (name == null || name.trim().isEmpty()) ? "BLUETOOTH MIXER" : name;
                    js("window.__mixerBtDeviceSelected(" + q(d.getAddress()) + "," + q(safeName) + ")");
                })
                .setNegativeButton("Batal", (dialog, which) -> js("window.__mixerBtDeviceError('Pemilihan Bluetooth dibatalkan')"))
                .show();
    }

    private void stopScan() {
        if (!scanning || scanner == null || scanCallback == null) return;
        try { scanner.stopScan(scanCallback); } catch (SecurityException ignored) {}
        scanning = false;
    }

    private final BluetoothGattCallback gattCallback = new BluetoothGattCallback() {
        @Override public void onConnectionStateChange(BluetoothGatt g, int status, int newState) {
            main.post(() -> {
                if (newState == BluetoothGatt.STATE_CONNECTED) {
                    gatt = g;
                    rxBuffer.setLength(0);
                    try { g.discoverServices(); }
                    catch (SecurityException e) { js("window.__mixerBtConnected(false," + q(e.getMessage()) + ")"); }
                } else if (newState == BluetoothGatt.STATE_DISCONNECTED) {
                    js("window.__mixerBtDisconnected()");
                }
            });
        }

        @Override public void onServicesDiscovered(BluetoothGatt g, int status) {
            main.post(() -> {
                if (status != BluetoothGatt.GATT_SUCCESS) {
                    js("window.__mixerBtConnected(false,'GATT service discovery gagal')");
                    return;
                }
                chooseCharacteristics(g);
                if (writeCharacteristic == null) {
                    js("window.__mixerBtConnected(false,'BLE tidak memiliki characteristic WRITE')");
                    return;
                }
                String name = "BLUETOOTH MIXER";
                try { name = g.getDevice().getName(); } catch (SecurityException ignored) {}
                js("window.__mixerBtConnected(true," + q(name == null ? "BLUETOOTH MIXER" : name) + ")");
            });
        }

        @Override public void onCharacteristicChanged(BluetoothGatt g, BluetoothGattCharacteristic characteristic) {
            byte[] value = characteristic.getValue();
            if (value != null) handleRxBytes(value);
        }

        @Override public void onCharacteristicChanged(BluetoothGatt g, BluetoothGattCharacteristic characteristic, byte[] value) {
            if (value != null) handleRxBytes(value);
        }
    };

    private void handleRxBytes(byte[] value) {
        // Keep Android-side persistence independent from the website's runtime state.
        String chunk = new String(value, StandardCharsets.UTF_8);
        rxBuffer.append(chunk);
        String[] lines = rxBuffer.toString().split("\\r?\\n", -1);
        rxBuffer.setLength(0);
        if (lines.length == 0) return;
        for (int i = 0; i < lines.length - 1; i++) persistFeedbackLine(lines[i]);
        rxBuffer.append(lines[lines.length - 1]);
        js("window.__mixerBtOnRx('" + Base64.encodeToString(value, Base64.NO_WRAP) + "')");
    }

    private void persistFeedbackLine(String line) {
        if (line == null || line.trim().isEmpty()) return;
        try {
            JSONObject packet = new JSONObject(line.trim());
            if (!"FEEDBACK".equalsIgnoreCase(packet.optString("type"))) return;
            String scope = packet.optString("scope", "CHANNEL");
            String key;
            if ("CHANNEL".equalsIgnoreCase(scope)) {
                int ch = packet.optInt("ch", 0);
                String param = packet.optString("param", "");
                if (ch < 1 || param.isEmpty()) return;
                key = "CH" + ch + "." + param;
            } else {
                String target = packet.optString("target", packet.optString("fx", packet.optString("bus", scope)));
                String param = packet.optString("param", "");
                if (param.isEmpty()) return;
                key = scope + "." + target + "." + param;
            }
            SharedPreferences prefs = activity.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            JSONObject saved;
            try { saved = new JSONObject(prefs.getString(SAVED_FEEDBACK, "{}")); }
            catch (Exception ignored) { saved = new JSONObject(); }
            JSONObject entry = new JSONObject();
            entry.put("value", packet.opt("value"));
            entry.put("ts", packet.optLong("ts", System.currentTimeMillis()));
            entry.put("device", packet.optString("device", "ESP32"));
            entry.put("transport", packet.optString("transport", "bluetooth"));
            saved.put(key, entry);
            prefs.edit().putString(SAVED_FEEDBACK, saved.toString()).apply();
        } catch (Exception ignored) {
            // Ignore non-JSON or partial data; the website still receives the RX bytes.
        }
    }

    private void chooseCharacteristics(BluetoothGatt g) {
        writeCharacteristic = null;
        notifyCharacteristic = null;
        BluetoothGattService service = g.getService(UART_SERVICE);
        if (service != null) {
            writeCharacteristic = service.getCharacteristic(UART_RX);
            notifyCharacteristic = service.getCharacteristic(UART_TX);
        }
        if (writeCharacteristic == null) {
            service = g.getService(HM_SERVICE);
            if (service != null) writeCharacteristic = service.getCharacteristic(HM_CHAR);
            if (service != null && notifyCharacteristic == null) notifyCharacteristic = service.getCharacteristic(HM_CHAR);
        }
        if (writeCharacteristic == null || notifyCharacteristic == null) {
            for (BluetoothGattService s : g.getServices()) {
                for (BluetoothGattCharacteristic c : s.getCharacteristics()) {
                    int p = c.getProperties();
                    if (writeCharacteristic == null && ((p & BluetoothGattCharacteristic.PROPERTY_WRITE) != 0 || (p & BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE) != 0)) writeCharacteristic = c;
                    if (notifyCharacteristic == null && ((p & BluetoothGattCharacteristic.PROPERTY_NOTIFY) != 0 || (p & BluetoothGattCharacteristic.PROPERTY_INDICATE) != 0)) notifyCharacteristic = c;
                }
            }
        }
    }

    private void closeGatt() {
        try { if (gatt != null) gatt.disconnect(); } catch (Exception ignored) {}
        try { if (gatt != null) gatt.close(); } catch (Exception ignored) {}
        gatt = null;
        writeCharacteristic = null;
        notifyCharacteristic = null;
        rxBuffer.setLength(0);
    }

    private void js(String code) { main.post(() -> webView.evaluateJavascript(code, null)); }

    private static String q(String value) {
        if (value == null) value = "";
        return "'" + value.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n").replace("\r", "\\r") + "'";
    }
}
