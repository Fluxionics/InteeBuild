'use strict';



(function (global) {
  const CAP = global.Capacitor;



  function plugin(name) {
    return (CAP && CAP.Plugins && CAP.Plugins[name]) || null;
  }

  function notAvailable(method) {
    return Promise.reject(new Error('InteeBridge: ' + method + ' no disponible. Activa el plugin correspondiente.'));
  }






  function droncitoRaw(method, args) {
    try {
      if (window.Droncito && typeof Droncito[method] === 'function') {
        return JSON.parse(Droncito[method].apply(Droncito, args || []));
      }
    } catch (e) {}
    return undefined;
  }

  function droncitoJson(method, args, fallback) {
    const data = droncitoRaw(method, args);
    if (data !== undefined) return Promise.resolve(data);
    return Promise.resolve(typeof fallback === 'function' ? fallback() : fallback);
  }



  function droncitoCall(method, args) {
    try {
      if (window.Droncito && typeof Droncito[method] === 'function') {
        Droncito[method].apply(Droncito, args || []);
        return true;
      }
    } catch (e) {}
    return false;
  }



  function postJson(endpoint, payload) {
    return fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {})
    }).then(function (r) { return r.json(); });
  }

  function sentimentCounts(text, positive, negative) {
    return {
      pos: (text.match(positive) || []).length,
      neg: (text.match(negative) || []).length
    };
  }

  function emotionLabel(score) {
    if (score > 0) return 'alegría';
    if (score < 0) return 'tristeza';
    return 'neutral';
  }



  function haversineMeters(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const rad = Math.PI / 180;
    const dLat = (lat2 - lat1) * rad;
    const dLng = (lng2 - lng1) * rad;
    const h = Math.sin(dLat / 2) * Math.sin(dLat / 2)
      + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  const Intee = {
    version: '1.0.0',
    isNative: !!(CAP && CAP.isNativePlatform && CAP.isNativePlatform()),



    location: function (opts) {
      const geo = plugin('Geolocation');
      if (!geo) return notAvailable('location');
      return geo.getCurrentPosition(opts || { enableHighAccuracy: true, timeout: 10000 })
        .then(function (r) {
          return { latitude: r.coords.latitude, longitude: r.coords.longitude, accuracy: r.coords.accuracy, altitude: r.coords.altitude, speed: r.coords.speed, timestamp: r.timestamp };
        });
    },

    watchLocation: function (cb, opts) {
      const geo = plugin('Geolocation');
      if (!geo) { cb(null, new Error('InteeBridge: location no disponible')); return null; }
      return geo.watchPosition(opts || { enableHighAccuracy: true }, function (pos, err) {
        if (err) return cb(null, err);
        cb({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy });
      });
    },

    device: {
      info: function () {
        const dev = plugin('Device');
        if (!dev) return notAvailable('device.info');
        return dev.getInfo();
      },
      battery: function () {
        const dev = plugin('Device');
        if (!dev) return notAvailable('device.battery');
        return dev.getBatteryInfo();
      },
      language: function () {
        const dev = plugin('Device');
        if (dev) return dev.getLanguageCode().then(function (r) { return r.value; });
        return Promise.resolve(navigator.language);
      }
    },

    network: {
      status: function () {
        const net = plugin('Network');
        if (!net) return Promise.resolve({ connected: navigator.onLine, connectionType: 'unknown' });
        return net.getStatus();
      }
    },

    screen: {
      keepOn: function (on) {
        const wake = plugin('KeepAwake');
        if (!wake) return notAvailable('screen.keepOn');
        return on ? wake.keepAwake() : wake.allowSleep();
      },
      brightness: function (val) {
        const sc = plugin('ScreenBrightness');
        if (!sc) return notAvailable('screen.brightness');
        return sc.setBrightness({ brightness: Math.max(0, Math.min(1, val)) });
      },
      orientation: function (mode) {
        const sc = plugin('ScreenOrientation');
        if (!sc) return notAvailable('screen.orientation');
        return sc.lock({ orientation: mode || 'portrait' });
      }
    },

    env: {
      snapshot: function () {
        return droncitoJson('envSnapshot', [], { accel: !!window.DeviceMotionEvent, gyro: !!window.DeviceOrientationEvent });
      },
      watch: function (cb) {
        const handler = function (e) { cb({ alpha: e.alpha, beta: e.beta, gamma: e.gamma }); };
        window.addEventListener('deviceorientation', handler);
        return function () { window.removeEventListener('deviceorientation', handler); };
      }
    },

    power: {
      status: function () {
        return droncitoJson('powerStatus', [], function webBattery() {
          if (navigator.getBattery) return navigator.getBattery().then(function (b) { return { level: Math.round(b.level * 100), charging: b.charging }; });
          const dev = plugin('Device');
          if (dev) return dev.getBatteryInfo();
          return Promise.resolve({});
        });
      },
      requestNoOptimize: function () {
        if (droncitoCall('powerRequestNoOptimize', [])) return Promise.resolve();
        return notAvailable('power.requestNoOptimize');
      }
    },

    iot: {
      snapshot: function () {
        return droncitoJson('iotSnapshot', [], { ble: !!navigator.bluetooth, wifi: true });
      },
      scan: function () {
        if (!navigator.bluetooth) return Promise.resolve({ demo: true, devices: [], note: 'WebBluetooth no disponible; en APK usa BLE nativo' });
        return navigator.bluetooth.requestDevice({ acceptAllDevices: true }).then(function (d) { return { name: d.name, id: d.id }; });
      },
      publish: function (wsUrl, topic, msg) {
        return new Promise(function (resolve, reject) {
          try {
            const ws = new WebSocket(wsUrl);
            ws.onopen = function () { ws.send(JSON.stringify({ topic: topic, msg: msg })); ws.close(); resolve({ ok: true }); };
            ws.onerror = reject;
          } catch (e) { reject(e); }
        });
      }
    },



    camera: function (opts) {
      const cam = plugin('Camera');
      if (!cam) return notAvailable('camera');
      const defaults = { quality: 90, allowEditing: false, resultType: 'dataUrl', source: 'PROMPT' };
      return cam.getPhoto(Object.assign(defaults, opts || {}))
        .then(function (r) { return { dataUrl: r.dataUrl, format: r.format }; });
    },

    share: function (opts) {
      const sh = plugin('Share');
      if (sh) return sh.share(opts || {});
      if (navigator.share) return navigator.share(opts);
      return notAvailable('share');
    },

    vibrate: function (ms) {
      const hap = plugin('Haptics');
      if (hap) return hap.vibrate({ duration: ms || 300 });
      if (navigator.vibrate) { navigator.vibrate(ms || 300); return Promise.resolve(); }
      return notAvailable('vibrate');
    },

    haptic: function (type) {
      const hap = plugin('Haptics');
      if (!hap) return notAvailable('haptic');
      const styles = { light: 'LIGHT', medium: 'MEDIUM', heavy: 'HEAVY', success: 'SUCCESS', warning: 'WARNING', error: 'ERROR' };
      return hap.impact({ style: styles[type] || 'MEDIUM' });
    },

    clipboard: {
      write: function (text) {
        const cb = plugin('Clipboard');
        if (cb) return cb.write({ string: text });
        return navigator.clipboard ? navigator.clipboard.writeText(text) : notAvailable('clipboard.write');
      },
      read: function () {
        const cb = plugin('Clipboard');
        if (cb) return cb.read().then(function (r) { return r.value; });
        return navigator.clipboard ? navigator.clipboard.readText() : notAvailable('clipboard.read');
      }
    },

    toast: function (text, duration) {
      const t = plugin('Toast');
      if (t) return t.show({ text: text, duration: duration || 'short' });
      return Promise.resolve();
    },

    dialog: {
      alert: function (opts) {
        const d = plugin('Dialog');
        if (d) return d.alert(opts || {});
        window.alert((opts || {}).message || '');
        return Promise.resolve();
      },
      confirm: function (opts) {
        const d = plugin('Dialog');
        if (d) return d.confirm(opts || {}).then(function (r) { return r.value; });
        return Promise.resolve(window.confirm((opts || {}).message || ''));
      },
      prompt: function (opts) {
        const d = plugin('Dialog');
        if (d) return d.prompt(opts || {}).then(function (r) { return r.value; });
        return Promise.resolve(window.prompt((opts || {}).message || '', (opts || {}).inputPlaceholder || ''));
      }
    },

    notifications: {
      schedule: function (opts) {
        const ln = plugin('LocalNotifications');
        if (!ln) return notAvailable('notifications.schedule');
        const notif = Object.assign({ id: Date.now(), title: '', body: '', scheduleAt: new Date(Date.now() + 1000) }, opts);
        return ln.schedule({ notifications: [notif] });
      },
      requestPermission: function () {
        const ln = plugin('LocalNotifications');
        if (!ln) return notAvailable('notifications.requestPermission');
        return ln.requestPermissions();
      }
    },

    biometric: function (reason) {
      const bio = plugin('BiometricAuth') || plugin('FingerprintAIO');
      if (!bio) return notAvailable('biometric');
      return bio.authenticate({ reason: reason || 'Verificar identidad' })
        .then(function () { return true; })
        .catch(function () { return false; });
    },



    files: {
      read: function (path) {
        const fs = plugin('Filesystem');
        if (!fs) return notAvailable('files.read');
        return fs.readFile({ path: path }).then(function (r) { return r.data; });
      },
      write: function (path, data) {
        const fs = plugin('Filesystem');
        if (!fs) return notAvailable('files.write');
        return fs.writeFile({ path: path, data: data, recursive: true });
      },
      list: function (path) {
        const fs = plugin('Filesystem');
        if (!fs) return notAvailable('files.list');
        return fs.readdir({ path: path }).then(function (r) { return r.files; });
      }
    },

    storage: {
      get: function (key) {
        const pr = plugin('Preferences');
        if (pr) return pr.get({ key: key }).then(function (r) { return r.value; });
        return Promise.resolve(localStorage.getItem(key));
      },
      set: function (key, value) {
        const pr = plugin('Preferences');
        if (pr) return pr.set({ key: key, value: String(value) });
        localStorage.setItem(key, String(value));
        return Promise.resolve();
      },
      remove: function (key) {
        const pr = plugin('Preferences');
        if (pr) return pr.remove({ key: key });
        localStorage.removeItem(key);
        return Promise.resolve();
      }
    },

    app: {
      info: function () {
        const ap = plugin('App');
        if (!ap) return notAvailable('app.info');
        return ap.getInfo();
      },
      exit: function () {
        const ap = plugin('App');
        if (ap && ap.exitApp) return ap.exitApp();
        return notAvailable('app.exit');
      },
      openUrl: function (url) {
        const ap = plugin('App');
        if (ap && ap.openUrl) return ap.openUrl({ url: url });
        window.open(url, '_blank');
        return Promise.resolve();
      }
    },



    ar: {
      status: function () {
        return droncitoJson('arStatus', [], { available: 'web', note: 'usa <model-viewer> en la web' });
      },
      open: function (modelUrl) {
        if (droncitoCall('arOpen', [modelUrl])) return Promise.resolve();
        window.open(modelUrl || 'https://modelviewer.dev', '_blank');
        return Promise.resolve();
      }
    },

    voice: {
      listen: function (opts) {
        const sr = plugin('SpeechRecognition');
        if (sr && sr.start) {
          return sr.requestPermissions()
            .then(function () { return sr.start({ language: (opts && opts.lang) || 'es-ES', maxResults: 1 }); })
            .then(function (r) {
              const text = r && r.matches ? r.matches[0] : (r && r.value ? r.value : '');
              return { text: text, raw: r };
            });
        }
        if (droncitoCall('voiceListen', [(opts && opts.prompt) || 'Habla ahora'])) return Promise.resolve({ native: true });

        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) return notAvailable('voice.listen');
        return new Promise(function (resolve, reject) {
          const rec = new SR();
          rec.lang = (opts && opts.lang) || 'es-ES';
          rec.interimResults = false;
          rec.onresult = function (e) { resolve({ text: e.results[0][0].transcript }); };
          rec.onerror = reject;
          rec.start();
        });
      }
    },

    ai: {
      status: function () {
        return droncitoJson('aiStatus', [], { mode: 'cloud', note: 'conecta tu API cloud' });
      },
      analyze: function (endpoint, payload) {
        return postJson(endpoint, payload);
      },
      sentiment: function (text, endpoint) {
        if (endpoint) return this.analyze(endpoint, { text: text });
        const { pos, neg } = sentimentCounts(text, /buen|excelente|genial|amor|gracias/gi, /mal|horrible|odio|error|falla/gi);
        return Promise.resolve({ score: pos - neg, label: pos >= neg ? 'positivo' : 'negativo' });
      }
    },

    vr: {
      status: function () {
        return droncitoJson('vrStatus', [], { vr: !!navigator.xr, webxr: !!navigator.xr });
      },
      enter: function (sceneUrl) {
        if (droncitoCall('vrEnter', [sceneUrl])) return Promise.resolve();
        window.open(sceneUrl || 'https://aframe.io/examples/', '_blank');
        return Promise.resolve();
      }
    },

    mr: {
      status: function () { return Intee.vr.status(); },
      enter: function (sceneUrl) {
        if (droncitoCall('vrEnter', [sceneUrl])) return Promise.resolve();
        return Intee.ar.open(sceneUrl);
      }
    },



    geoAdvanced: {
      current: function (opts) { return Intee.location(opts); },
      snapshot: function () {

        try {
          if (window.Droncito && Droncito.geoSnapshot) {
            const s = Droncito.geoSnapshot();
            return Promise.resolve(typeof s === 'string' ? (s ? JSON.parse(s) : {}) : s);
          }
        } catch (e) {}
        return Intee.location();
      },
      track: function (cb, opts) { return Intee.watchLocation(cb, opts); },
      isInside: function (lat, lng, clat, clng, radiusM) {
        return haversineMeters(lat, lng, clat, clng) <= (radiusM || 100);
      },
      recommend: function (lat, lng, spots) {
        return Promise.resolve((spots || [])
          .map(function (s) { return { spot: s, distM: Math.round(haversineMeters(lat, lng, s.lat, s.lng)) }; })
          .sort(function (a, b) { return a.distM - b.distM; })
          .slice(0, 5));
      }
    },

    social: {
      share: function (text, url) {
        if (droncitoCall('socialShare', [text || '', url || ''])) return Promise.resolve();
        return Intee.share({ title: text || '', text: text || '', url: url || '' });
      },
      accounts: function () {


        try {
          if (window.Droncito && Droncito.socialAccounts) {
            const accounts = Droncito.socialAccounts();
            return Promise.resolve(typeof accounts === 'string' ? JSON.parse(accounts) : accounts);
          }
        } catch (e) {}
        return Promise.resolve([]);
      },
      insights: function (endpoint, payload) {
        if (!endpoint) return Promise.resolve({ trends: [], sentiment: 0, engagement: 0, note: 'pasa tu endpoint cloud para insights reales' });
        return postJson(endpoint, payload);
      },
      sentiment: function (text) {
        const { pos, neg } = sentimentCounts(String(text), /buen|excelente|genial|amor|gracias|like/gi, /mal|horrible|odio|error|hate/gi);
        return Promise.resolve({ score: pos - neg, label: pos >= neg ? 'positivo' : 'negativo', engagement: pos + neg });
      }
    },

    adaptive: {
      schedule: function (opts) { return Intee.notifications.schedule(opts); },
      bestHour: function (history) {
        return droncitoJson('adaptiveBestHour', [JSON.stringify(history || [])], { hour: 9 });
      }
    },

    security: {
      check: function () {
        return droncitoJson('securityCheck', [], { rooted: false, web: true });
      },
      auth: function (reason) { return Intee.biometric(reason); },
      secureSet: function (k, v) { return Intee.storage.set('sec_' + k, v); },
      secureGet: function (k) { return Intee.storage.get('sec_' + k); }
    },

    personalize: {
      apply: function (profile) {
        const p = profile || {};
        if (p.accent) document.documentElement.style.setProperty('--accent', p.accent);
        if (p.theme === 'dark') document.body.classList.add('ib-dark');
        if (p.theme === 'light') document.body.classList.remove('ib-dark');
        return Intee.storage.set('ib_profile', JSON.stringify(p));
      },
      load: function () {
        return Intee.storage.get('ib_profile').then(function (v) {
          try { return JSON.parse(v || '{}'); } catch (e) { return {}; }
        });
      }
    },

    data: {
      track: function (event, props) {
        droncitoCall('dataTrack', [event, JSON.stringify(props || {})]);
        const key = 'ib_ev_' + event;
        const count = Number(localStorage.getItem(key) || 0) + 1;
        localStorage.setItem(key, String(count));
        return Promise.resolve({ event: event, count: count });
      },
      dashboard: function (endpoint) {
        if (!endpoint) return Promise.resolve({ events: [], note: 'pasa tu endpoint para dashboard predictivo' });
        return fetch(endpoint).then(function (r) { return r.json(); });
      }
    },



    chain: {
      wallet: function () {
        const key = 'ib_wallet';
        let address = localStorage.getItem(key);
        if (!address) {
          address = '0x' + Array.from(crypto.getRandomValues(new Uint8Array(20))).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
          localStorage.setItem(key, address);
        }
        return Promise.resolve({ address: address, note: 'demo local; en build completo firma con Keystore+web3j' });
      },
      sign: function (msg) {
        return droncitoJson('chainSign', [msg], { hash: 'web', msg: msg });
      },
      tx: function (rpc, method, params) {
        return fetch(rpc, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: method, params: params || [] })
        }).then(function (r) { return r.json(); });
      }
    },

    rpa: {
      macros: [],
      record: function (name, steps) {
        this.macros.push({ name: name, steps: steps || [], at: Date.now() });
        return Intee.storage.set('ib_rpa_' + name, JSON.stringify(steps || []));
      },
      play: function (name) {
        return Intee.storage.get('ib_rpa_' + name).then(function (v) {
          let steps = [];
          try { steps = JSON.parse(v || '[]'); } catch (e) {}
          let i = 0;

          function next() {
            if (i >= steps.length) return Promise.resolve();
            const step = steps[i++];
            try {
              if (step.open) window.open(step.open, '_blank');
              if (step.eval) eval(step.eval);
            } catch (e) {}
            return new Promise(function (done) { setTimeout(done, step.wait || 500); }).then(next);
          }

          return next();
        });
      }
    },

    vuln: {
      scan: function () {
        return droncitoJson('vulnReport', [], function localScan() {
          const report = {
            rooted: false,
            debuggable: location.protocol !== 'https:',
            allowBackup: true,
            https: location.protocol === 'https:',
            csp: !!document.querySelector('meta[http-equiv="Content-Security-Policy"]')
          };
          report.score = (report.https ? 30 : 0) + (!report.debuggable ? 30 : 0) + (!report.rooted ? 20 : 0) + (report.csp ? 20 : 0);
          report.fixes = [];
          if (!report.https) report.fixes.push('Usa HTTPS + cleartext=false');
          if (report.debuggable) report.fixes.push('Desactiva debug en release');
          if (!report.csp) report.fixes.push('Agrega CSP');
          return report;
        });
      }
    },

    emo: {
      detect: function (input) {
        if (input && input.text) {
          const native = droncitoRaw('emoQuick', [input.text]);
          if (native !== undefined) return Promise.resolve({ score: native.score, label: emotionLabel(native.score) });
        }
        const text = String((input && input.text) || input || '').toLowerCase();
        let score = 0;
        if (/feliz|genial|gracias|excelente|amor/.test(text)) score = 2;
        else if (/triste|odio|mal|horrible|ansios/.test(text)) score = -2;
        return Promise.resolve({
          score: score,
          label: emotionLabel(score),
          empathetic: score < 0 ? 'Lamento eso. ¿Quieres ayuda?' : '¡Qué bueno! ¿Seguimos?'
        });
      }
    }
  };

  global.Intee = Intee;

  if (typeof module !== 'undefined' && module.exports) module.exports = Intee;
})(typeof window !== 'undefined' ? window : global);
