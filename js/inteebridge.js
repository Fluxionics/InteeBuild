'use strict';

(function (global) {
  var CAP = global.Capacitor;

  function plugin(name) {
    if (CAP && CAP.Plugins && CAP.Plugins[name]) return CAP.Plugins[name];
    return null;
  }

  function notAvailable(method) {
    return Promise.reject(new Error('InteeBridge: ' + method + ' no disponible. Activa el plugin correspondiente.'));
  }

  var Intee = {
    version: '1.0.0',
    isNative: !!(CAP && CAP.isNativePlatform && CAP.isNativePlatform()),

    location: function (opts) {
      var geo = plugin('Geolocation');
      if (!geo) return notAvailable('location');
      return geo.getCurrentPosition(opts || { enableHighAccuracy: true, timeout: 10000 })
        .then(function (r) {
          return { latitude: r.coords.latitude, longitude: r.coords.longitude, accuracy: r.coords.accuracy, altitude: r.coords.altitude, speed: r.coords.speed, timestamp: r.timestamp };
        });
    },

    watchLocation: function (cb, opts) {
      var geo = plugin('Geolocation');
      if (!geo) { cb(null, new Error('InteeBridge: location no disponible')); return null; }
      return geo.watchPosition(opts || { enableHighAccuracy: true }, function (pos, err) {
        if (err) return cb(null, err);
        cb({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy });
      });
    },

    camera: function (opts) {
      var cam = plugin('Camera');
      if (!cam) return notAvailable('camera');
      var defaults = { quality: 90, allowEditing: false, resultType: 'dataUrl', source: 'PROMPT' };
      return cam.getPhoto(Object.assign(defaults, opts || {}))
        .then(function (r) { return { dataUrl: r.dataUrl, format: r.format }; });
    },

    share: function (opts) {
      var sh = plugin('Share');
      if (!sh) {
        if (navigator.share) return navigator.share(opts);
        return notAvailable('share');
      }
      return sh.share(opts || {});
    },

    vibrate: function (ms) {
      var hap = plugin('Haptics');
      if (hap) return hap.vibrate({ duration: ms || 300 });
      if (navigator.vibrate) { navigator.vibrate(ms || 300); return Promise.resolve(); }
      return notAvailable('vibrate');
    },

    haptic: function (type) {
      var hap = plugin('Haptics');
      if (!hap) return notAvailable('haptic');
      var types = { light: 'LIGHT', medium: 'MEDIUM', heavy: 'HEAVY', success: 'SUCCESS', warning: 'WARNING', error: 'ERROR' };
      return hap.impact({ style: types[type] || 'MEDIUM' });
    },

    clipboard: {
      write: function (text) {
        var cb = plugin('Clipboard');
        if (cb) return cb.write({ string: text });
        return navigator.clipboard ? navigator.clipboard.writeText(text) : notAvailable('clipboard.write');
      },
      read: function () {
        var cb = plugin('Clipboard');
        if (cb) return cb.read().then(function (r) { return r.value; });
        return navigator.clipboard ? navigator.clipboard.readText() : notAvailable('clipboard.read');
      }
    },

    notifications: {
      schedule: function (opts) {
        var ln = plugin('LocalNotifications');
        if (!ln) return notAvailable('notifications.schedule');
        var notif = Object.assign({ id: Date.now(), title: '', body: '', scheduleAt: new Date(Date.now() + 1000) }, opts);
        return ln.schedule({ notifications: [notif] });
      },
      requestPermission: function () {
        var ln = plugin('LocalNotifications');
        if (!ln) return notAvailable('notifications.requestPermission');
        return ln.requestPermissions();
      }
    },

    biometric: function (reason) {
      var bio = plugin('BiometricAuth') || plugin('FingerprintAIO');
      if (!bio) return notAvailable('biometric');
      return bio.authenticate({ reason: reason || 'Verificar identidad' })
        .then(function () { return true; })
        .catch(function () { return false; });
    },

    files: {
      read: function (path) {
        var fs = plugin('Filesystem');
        if (!fs) return notAvailable('files.read');
        return fs.readFile({ path: path }).then(function (r) { return r.data; });
      },
      write: function (path, data) {
        var fs = plugin('Filesystem');
        if (!fs) return notAvailable('files.write');
        return fs.writeFile({ path: path, data: data, recursive: true });
      },
      list: function (path) {
        var fs = plugin('Filesystem');
        if (!fs) return notAvailable('files.list');
        return fs.readdir({ path: path }).then(function (r) { return r.files; });
      }
    },

    storage: {
      get: function (key) {
        var pr = plugin('Preferences');
        if (pr) return pr.get({ key: key }).then(function (r) { return r.value; });
        return Promise.resolve(localStorage.getItem(key));
      },
      set: function (key, value) {
        var pr = plugin('Preferences');
        if (pr) return pr.set({ key: key, value: String(value) });
        localStorage.setItem(key, String(value));
        return Promise.resolve();
      },
      remove: function (key) {
        var pr = plugin('Preferences');
        if (pr) return pr.remove({ key: key });
        localStorage.removeItem(key);
        return Promise.resolve();
      }
    },

    device: {
      info: function () {
        var dev = plugin('Device');
        if (!dev) return notAvailable('device.info');
        return dev.getInfo();
      },
      battery: function () {
        var dev = plugin('Device');
        if (!dev) return notAvailable('device.battery');
        return dev.getBatteryInfo();
      },
      language: function () {
        var dev = plugin('Device');
        if (dev) return dev.getLanguageCode().then(function (r) { return r.value; });
        return Promise.resolve(navigator.language);
      }
    },

    network: {
      status: function () {
        var net = plugin('Network');
        if (!net) return Promise.resolve({ connected: navigator.onLine, connectionType: 'unknown' });
        return net.getStatus();
      }
    },

    screen: {
      keepOn: function (on) {
        var wake = plugin('KeepAwake');
        if (!wake) return notAvailable('screen.keepOn');
        return on ? wake.keepAwake() : wake.allowSleep();
      },
      brightness: function (val) {
        var sc = plugin('ScreenBrightness');
        if (!sc) return notAvailable('screen.brightness');
        return sc.setBrightness({ brightness: Math.max(0, Math.min(1, val)) });
      },
      orientation: function (mode) {
        var sc = plugin('ScreenOrientation');
        if (!sc) return notAvailable('screen.orientation');
        return sc.lock({ orientation: mode || 'portrait' });
      }
    },

    app: {
      info: function () {
        var ap = plugin('App');
        if (!ap) return notAvailable('app.info');
        return ap.getInfo();
      },
      exit: function () {
        var ap = plugin('App');
        if (ap && ap.exitApp) return ap.exitApp();
        return notAvailable('app.exit');
      },
      openUrl: function (url) {
        var ap = plugin('App');
        if (ap && ap.openUrl) return ap.openUrl({ url: url });
        window.open(url, '_blank');
        return Promise.resolve();
      }
    },

    toast: function (text, duration) {
      var t = plugin('Toast');
      if (t) return t.show({ text: text, duration: duration || 'short' });
      return Promise.resolve();
    },

    dialog: {
      alert: function (opts) {
        var d = plugin('Dialog');
        if (d) return d.alert(opts || {});
        window.alert((opts || {}).message || '');
        return Promise.resolve();
      },
      confirm: function (opts) {
        var d = plugin('Dialog');
        if (d) return d.confirm(opts || {}).then(function (r) { return r.value; });
        return Promise.resolve(window.confirm((opts || {}).message || ''));
      },
      prompt: function (opts) {
        var d = plugin('Dialog');
        if (d) return d.prompt(opts || {}).then(function (r) { return r.value; });
        return Promise.resolve(window.prompt((opts || {}).message || '', (opts || {}).inputPlaceholder || ''));
      }
    }
  };

  global.Intee = Intee;

  if (typeof module !== 'undefined' && module.exports) module.exports = Intee;
})(typeof window !== 'undefined' ? window : global);
