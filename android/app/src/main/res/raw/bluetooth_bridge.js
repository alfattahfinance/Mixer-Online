/* Android-only Bluetooth bridge for Mixer-Online APK.
 * This file is packaged inside the APK and injected by MainActivity.
 * The repository website files are not modified.
 */
(function () {
  'use strict';
  if (window.__MIXER_ANDROID_BLE_BRIDGE__) return;
  window.__MIXER_ANDROID_BLE_BRIDGE__ = true;

  var device = null;
  var connected = false;
  var deviceWaiters = [];
  var connectWaiters = [];
  var notifyWaiters = [];
  var rxListeners = [];
  var deviceListeners = {};
  var lastError = null;

  function resolveAll(list, value) {
    var copy = list.splice(0, list.length);
    copy.forEach(function (w) { try { w.resolve(value); } catch (_) {} });
  }
  function rejectAll(list, error) {
    var copy = list.splice(0, list.length);
    copy.forEach(function (w) { try { w.reject(error); } catch (_) {} });
  }
  function toError(value) {
    return value instanceof Error ? value : new Error(String(value || 'Bluetooth bridge error'));
  }
  function b64(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  }
  function fromB64(value) {
    var raw = atob(value || '');
    var out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }
  function fireDevice(type, event) {
    (deviceListeners[type] || []).slice().forEach(function (fn) {
      try { fn(event || {}); } catch (_) {}
    });
  }
  function status(online, message) {
    var text = online ? 'BLUETOOTH ONLINE' : (message || 'BLUETOOTH OFFLINE');
    var s = document.getElementById('status');
    if (s) {
      s.textContent = text;
      if (online) s.style.color = '#31e66b';
    }
    var lamp = document.getElementById('statusLamp');
    if (lamp) lamp.className = online ? 'live' : '';
    var h = document.getElementById('headerBridgeStatus');
    if (h) h.textContent = online ? 'BLUETOOTH ONLINE' : 'BRIDGE STANDBY';
    var t = document.getElementById('testTransportLabel');
    if (t) t.textContent = online ? 'ESP32 BRIDGE BLUETOOTH ONLINE' : 'OFFLINE';
    var f = document.getElementById('footerConnection');
    if (f) f.textContent = online ? '● BLUETOOTH ONLINE' : '● BLUETOOTH OFFLINE';
    try { document.dispatchEvent(new CustomEvent('mixer:android-bluetooth-status', { detail: { connected: online, message: text } })); } catch (_) {}
  }

  function characteristic(uuid, props) {
    props = props || { write: true, writeWithoutResponse: true, notify: true };
    return {
      uuid: String(uuid).toLowerCase(),
      properties: props,
      writeValue: function (data) {
        if (!connected) return Promise.reject(new Error('Bluetooth offline'));
        return new Promise(function (resolve, reject) {
          try { AndroidBluetooth.write(b64(new Uint8Array(data))); resolve(); }
          catch (e) { reject(e); }
        });
      },
      writeValueWithoutResponse: function (data) {
        return this.writeValue(data);
      },
      startNotifications: function () {
        return new Promise(function (resolve, reject) {
          notifyWaiters.push({ resolve: resolve, reject: reject });
          try { AndroidBluetooth.startNotifications(); }
          catch (e) { rejectAll(notifyWaiters, e); }
        });
      },
      addEventListener: function (type, fn) {
        if (type === 'characteristicvaluechanged' && typeof fn === 'function') rxListeners.push(fn);
      },
      removeEventListener: function (type, fn) {
        if (type === 'characteristicvaluechanged') rxListeners = rxListeners.filter(function (x) { return x !== fn; });
      }
    };
  }

  function service(uuid) {
    var normalized = String(uuid).toLowerCase();
    return {
      uuid: normalized,
      getCharacteristic: function (requested) {
        var u = String(requested).toLowerCase();
        if (u === '6e400002-b5a3-f393-e0a9-e50e24dcca9e' || u === '0000ffe1-0000-1000-8000-00805f9b34fb')
          return Promise.resolve(characteristic(u, { write: true, writeWithoutResponse: true }));
        return Promise.resolve(characteristic(u, { notify: true }));
      },
      getCharacteristics: function () {
        return Promise.resolve([
          characteristic('6e400002-b5a3-f393-e0a9-e50e24dcca9e', { write: true, writeWithoutResponse: true }),
          characteristic('6e400003-b5a3-f393-e0a9-e50e24dcca9e', { notify: true })
        ]);
      }
    };
  }

  function gattServer() {
    return {
      connected: connected,
      getPrimaryService: function (uuid) { return Promise.resolve(service(uuid)); },
      getPrimaryServices: function () {
        return Promise.resolve([
          service('6e400001-b5a3-f393-e0a9-e50e24dcca9e'),
          service('0000ffe0-0000-1000-8000-00805f9b34fb')
        ]);
      }
    };
  }

  function makeDevice(address, name) {
    var d = {
      id: address,
      name: name || 'BLUETOOTH MIXER',
      gatt: {
        connected: connected,
        connect: function () {
          return new Promise(function (resolve, reject) {
            connectWaiters.push({ resolve: resolve, reject: reject });
            try { AndroidBluetooth.connect(address); } catch (e) { rejectAll(connectWaiters, e); }
          });
        },
        disconnect: function () {
          try { AndroidBluetooth.disconnect(); } catch (_) {}
          connected = false;
          d.gatt.connected = false;
          fireDevice('gattserverdisconnected', { target: d });
          status(false);
        }
      },
      addEventListener: function (type, fn) {
        (deviceListeners[type] || (deviceListeners[type] = [])).push(fn);
      },
      removeEventListener: function (type, fn) {
        if (!deviceListeners[type]) return;
        deviceListeners[type] = deviceListeners[type].filter(function (x) { return x !== fn; });
      }
    };
    return d;
  }

  function requestDevice() {
    return new Promise(function (resolve, reject) {
      deviceWaiters.push({ resolve: resolve, reject: reject });
      try { AndroidBluetooth.requestDevice(); }
      catch (e) { rejectAll(deviceWaiters, e); }
    });
  }

  var webBluetooth = {
    requestDevice: requestDevice
  };

  window.__mixerBtDeviceSelected = function (address, name) {
    device = makeDevice(address, name);
    resolveAll(deviceWaiters, device);
  };
  window.__mixerBtDeviceError = function (message) {
    lastError = message || 'Bluetooth scan gagal';
    status(false, lastError);
    rejectAll(deviceWaiters, toError(lastError));
    rejectAll(connectWaiters, toError(lastError));
  };
  window.__mixerBtConnected = function (ok, name) {
    if (!ok) {
      lastError = name || 'Bluetooth connection gagal';
      status(false, lastError);
      rejectAll(connectWaiters, toError(lastError));
      return;
    }
    connected = true;
    if (device) {
      device.name = name || device.name;
      device.gatt.connected = true;
    }
    status(true);
    resolveAll(connectWaiters, gattServer());
  };
  window.__mixerBtDisconnected = function () {
    connected = false;
    if (device) device.gatt.connected = false;
    status(false);
    fireDevice('gattserverdisconnected', { target: device });
  };
  window.__mixerBtNotifyResult = function (ok, message) {
    if (ok) resolveAll(notifyWaiters, true);
    else rejectAll(notifyWaiters, toError(message || 'Notification gagal'));
  };
  window.__mixerBtWriteResult = function (ok, message) {
    if (!ok) lastError = message || 'Bluetooth write gagal';
  };
  window.__mixerBtOnRx = function (payload) {
    var bytes = fromB64(payload);
    var event = { target: { value: new DataView(bytes.buffer) } };
    rxListeners.slice().forEach(function (fn) { try { fn(event); } catch (_) {} });
    try {
      var raw = new TextDecoder().decode(bytes).trim();
      if (raw) document.dispatchEvent(new CustomEvent('mixer:bluetooth-rx', { detail: JSON.parse(raw) }));
    } catch (_) {}
  };

  window.MixerAndroidBluetooth = {
    native: true,
    requestDevice: requestDevice,
    isConnected: function () { return connected; },
    getLastError: function () { return lastError; },
    getSavedFeedback: function () {
      try { return JSON.parse(AndroidBluetooth.getSavedFeedbackState() || '{}'); } catch (_) { return {}; }
    },
    clearSavedFeedback: function () { try { AndroidBluetooth.clearSavedFeedbackState(); } catch (_) {} }
  };

  window.MixerBluetooth = {
    connect: async function () {
      var d = await requestDevice();
      var server = await d.gatt.connect();
      var service = await server.getPrimaryService('6e400001-b5a3-f393-e0a9-e50e24dcca9e');
      var write = await service.getCharacteristic('6e400002-b5a3-f393-e0a9-e50e24dcca9e');
      try {
        var notify = await service.getCharacteristic('6e400003-b5a3-f393-e0a9-e50e24dcca9e');
        await notify.startNotifications();
        notify.addEventListener('characteristicvaluechanged', function () {});
      } catch (_) {}
      return { device: d, server: server, characteristic: write };
    },
    send: async function (payload) {
      if (!connected) throw new Error('Bluetooth offline');
      var d = new TextEncoder().encode(JSON.stringify(payload) + '\n');
      if (device && device.gatt) {
        var server = gattServer();
        var s = await server.getPrimaryService('6e400001-b5a3-f393-e0a9-e50e24dcca9e');
        var c = await s.getCharacteristic('6e400002-b5a3-f393-e0a9-e50e24dcca9e');
        await c.writeValue(d);
      }
    }
  };

  // Make the Web Bluetooth capability visible to the existing website adapter.
  try {
    Object.defineProperty(navigator, 'bluetooth', { configurable: true, value: webBluetooth });
  } catch (_) {
    try {
      var proto = Object.getPrototypeOf(navigator);
      Object.defineProperty(proto, 'bluetooth', { configurable: true, get: function () { return webBluetooth; } });
    } catch (__) {}
  }

  status(false, 'BRIDGE STANDBY');
})();
