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
import android.bluetooth.le.BluetoothLeScanner;
import android.bluetooth.le.ScanCallback;
import android.bluetooth.le.ScanResult;
import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Android-only BLE bridge for the existing Mixer-Online Web Bluetooth code. */
public final class NativeBluetoothBridge {
    private static final int REQ_BT = 7001;
    private static final long SCAN_MS = 10000L;
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

    @JavascriptInterface
    public void disconnect() { main.post(this::closeGatt); }

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
            if (value != null) js("window.__mixerBtOnRx('" + Base64.encodeToString(value, Base64.NO_WRAP) + "')");
        }

        @Override public void onCharacteristicChanged(BluetoothGatt g, BluetoothGattCharacteristic characteristic, byte[] value) {
            if (value != null) js("window.__mixerBtOnRx('" + Base64.encodeToString(value, Base64.NO_WRAP) + "')");
        }
    };

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
    }

    private void js(String code) { main.post(() -> webView.evaluateJavascript(code, null)); }

    private static String q(String value) {
        if (value == null) value = "";
        return "'" + value.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n").replace("\r", "\\r") + "'";
    }
}
