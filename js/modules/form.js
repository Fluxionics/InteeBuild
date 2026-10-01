'use strict';

const Form = (() => {
  let keystoreBase64 = null;
  let adaptiveFgBase64 = null;
  let iosP12Base64 = null;
  let iosProfileBase64 = null;

  const refreshIosFields = () => {
    const signFields = $('#iosSignFields');
    if (!signFields) return;
    signFields.classList.toggle('hidden', !(iosP12Base64 && iosProfileBase64));
  };

  const bindFileInput = ({ input, label, defaultLabel, fields, onLoaded, onCleared }) => {
    const el = $(input);
    if (!el) return;
    el.addEventListener('change', () => {
      const file = el.files && el.files[0];
      if (!file) {
        if (label && defaultLabel) $(label).textContent = defaultLabel;
        if (fields) hide($(fields));
        if (onCleared) onCleared();
        return;
      }
      readFileAsDataURL(file, (dataUrl) => {
        if (label) $(label).textContent = `${file.name} (${kb(file.size)} KB)`;
        if (fields) show($(fields));
        if (onLoaded) onLoaded(dataUrl, file);
      });
    });
  };

  $$('.toggle-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      $$('.toggle-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const type = btn.dataset.input;
      setVisible($('#urlGroup'), type === 'url');
      setVisible($('#htmlGroup'), type === 'html');
    });
  });

  $$('.perm-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      $$('.perm-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      const target = tab.dataset.ptab;
      setVisible($('#permEasy'), target === 'easy');
      setVisible($('#permAdvanced'), target === 'advanced');
    });
  });

  $$('.perm-tile').forEach((tile) => {
    const chk = tile.querySelector('input[type="checkbox"]');
    if (!chk) return;
    tile.classList.toggle('checked', chk.checked);
    tile.addEventListener('click', (e) => {
      e.stopPropagation();
      chk.checked = !chk.checked;
      tile.classList.toggle('checked', chk.checked);
    });
  });



  const renderGranularPerms = async () => {
    try {
      const r = await fetch('/api/permissions/spec');
      if (!r.ok) return;
      const spec = await r.json();
      const covered = new Set(['internet', 'foregroundService']);
      $$('#permEasy input[type="checkbox"], #permAdvanced input[type="checkbox"]').forEach((el) => {
        if (el.name) covered.add(el.name);
      });
      const keys = Object.keys(spec).filter((k) => !covered.has(k) && k !== 'ads');
      if (!keys.length) return;
      const adv = $('#permAdvanced');
      if (!adv) return;



      const groups = {};
      keys.forEach((k) => {
        const api = (spec[k] && spec[k].api) || 'otros';
        (groups[api] = groups[api] || []).push(k);
      });

      const groupHtml = Object.entries(groups).map(([api, ks]) => {
        const titles = ks.map((k) => {
          const s = spec[k] || {};
          const mans = (s.manifest || []).map((m) => String(m).split('.').pop()).join(', ');
          const mech = s.runtime ? 'diálogo runtime' : (s.specialAccess ? 'Settings' : 'al instalar');
          return '<label class="switch"><input type="checkbox" name="' + k + '" data-perm-key="' + k + '" />'
            + '<span class="trk"><span class="knob"></span></span>'
            + '<span class="txt"><b>' + escHtml(s.title || k) + '</b><small>Requiere: ' + escHtml(mans) + ' · ' + escHtml(mech) + (s.specialAccess ? ' · ' + escHtml(String(s.specialAccess).slice(0, 60)) : '') + '</small></span></label>';
        }).join('');
        return '<p class="hint" style="margin:10px 0 2px;text-transform:capitalize;font-weight:700;color:var(--text)">' + escHtml(api) + '</p>' + titles;
      }).join('');

      const wrap = document.createElement('div');
      wrap.innerHTML = '<p class="hint" style="margin:12px 0 4px">Capacidades granulares (cada una muestra su permiso Android real):</p>'
        + groupHtml
        + '<p class="hint" style="margin:8px 0 0;font-size:11px">AdMob está en COMING SOON (requiere SDK real, el Audit lo bloquea si se pide por API).</p>';
      adv.appendChild(wrap);


      adv.addEventListener('change', (e) => {
        const el = e.target;
        if (!el || !el.getAttribute) return;
        const key = el.getAttribute('data-perm-key') || el.name;
        if (!key || !el.checked) return;

        const requireGps = (depLabel) => {
          const dep = $('[name="gps"]');
          if (!dep || dep.checked) return;
          dep.checked = true;
          const tile = dep.closest('.perm-tile');
          if (tile) tile.classList.add('checked');
          alert(depLabel + ' requiere ubicación en primer plano: se activó GPS automáticamente.');
        };
        if (key === 'gpsBackground') requireGps('La ubicación en segundo plano');
        if (key === 'accessBackgroundLocation') requireGps('La ubicación en segundo plano');

        const use = $('[name="alarmUse"]');
        const sched = $('[name="alarmSchedule"]');
        if ((key === 'alarmSchedule' && use && use.checked) || (key === 'alarmUse' && sched && sched.checked)) {
          alert('Elige UNA alarma: SCHEDULE (recomendado) o USE (solo reloj). Se usará SCHEDULE.');
          if (use) use.checked = false;
          if (sched) sched.checked = true;
        }
      });
    } catch (_) {   }
  };
  renderGranularPerms();


  const CHECK_PANELS = [
    ['splashCheck', 'splashOptions'],
    ['adaptiveCheck', 'adaptiveBox'],
    ['dlCheck', 'dlBox'],
    ['drawerCheck', 'drawerBox'],
    ['bottomCheck', 'bottomBox'],
    ['nativeAudioCheck', 'nativeAudioBox']
  ];
  CHECK_PANELS.forEach(([checkId, boxId]) => {
    const check = $('#' + checkId);
    const box = $('#' + boxId);
    if (!check || !box) return;
    const sync = () => setVisible(box, check.checked);
    check.addEventListener('change', sync);
    sync();
  });

  const compileSdk = $('[name="compileSdk"]');
  const targetSdk = $('[name="targetSdk"]');
  if (compileSdk && targetSdk) {
    compileSdk.addEventListener('change', () => {
      targetSdk.value = compileSdk.value;
    });
  }

  bindFileInput({
    input: '#iconInput',
    onLoaded: (dataUrl) => {
      state.iconBase64 = dataUrl;
      const iconPreview = $('#iconPreview');
      if (iconPreview) {
        iconPreview.src = dataUrl;
        show(iconPreview);
      }
      Preview.refresh();
    }
  });

  bindFileInput({
    input: '#ksInput',
    label: '#ksLabel',
    defaultLabel: 'Seleccionar archivo Keystore (.jks)',
    fields: '#ksFields',
    onLoaded: (dataUrl) => { keystoreBase64 = dataUrl; },
    onCleared: () => { keystoreBase64 = null; }
  });

  bindFileInput({
    input: '#iosP12Input',
    label: '#iosP12Label',
    defaultLabel: 'Elegir .p12',
    onLoaded: (dataUrl) => { iosP12Base64 = dataUrl; refreshIosFields(); },
    onCleared: () => { iosP12Base64 = null; refreshIosFields(); }
  });

  bindFileInput({
    input: '#iosProfileInput',
    label: '#iosProfileLabel',
    defaultLabel: 'Elegir .mobileprovision',
    onLoaded: (dataUrl) => { iosProfileBase64 = dataUrl; refreshIosFields(); },
    onCleared: () => { iosProfileBase64 = null; refreshIosFields(); }
  });

  bindFileInput({
    input: '#adaptiveFgInput',
    onLoaded: (dataUrl) => { adaptiveFgBase64 = dataUrl; },
    onCleared: () => { adaptiveFgBase64 = null; }
  });

  const fmtInputs = $$('[name="outputs"]');
  const fmtNote = $('#fmtNote');
  const platformSelect = $('#platformSelect');
  const iosHint = $('#iosHint');
  const desktopEnabled = $('[name="desktopEnabled"]');
  const DESKTOP_OUTPUTS = ['exe', 'dmg', 'appimage', 'msi'];

  const fmtInput = (value) => fmtInputs.find((el) => el.value === value);

  const setFmt = (value, checked) => {
    const el = fmtInput(value);
    if (el) el.checked = checked;
  };



  const disableFmt = (value, disabled) => {
    const el = fmtInput(value);
    if (!el) return;
    el.disabled = disabled;
    el.closest('.fmt-chip')?.classList.toggle('disabled', disabled);
    if (disabled) el.checked = false;
  };

  const syncFmtAvailability = () => {
    const iosAllowed = !!platformSelect && platformSelect.value !== 'android';
    const desktopOn = !!desktopEnabled && desktopEnabled.checked;
    disableFmt('ipa', !iosAllowed);
    DESKTOP_OUTPUTS.forEach((f) => disableFmt(f, !desktopOn));
    if (iosHint) iosHint.style.display = iosAllowed ? 'block' : 'none';


    ensureOneOutput();
  };

  const ensureOneOutput = (changed) => {
    const enabled = fmtInputs.filter((el) => !el.disabled);
    if (enabled.some((el) => el.checked)) return;

    const fallback = enabled.find((el) => el.value === changed) || enabled.find((el) => el.value === 'apk') || enabled[0];
    if (fallback) fallback.checked = true;
    if (fmtNote) {
      fmtNote.textContent = 'Debe quedar al menos un formato activo: se mantuvo ' + (fallback ? fallback.value.toUpperCase() : 'APK') + '.';
      setTimeout(() => { fmtNote.textContent = ''; }, 3000);
    }
  };

  const setOutputs = (list) => {
    const wanted = (Array.isArray(list) ? list : [list]).map((v) => String(v).toLowerCase());
    fmtInputs.forEach((el) => { el.checked = wanted.includes(el.value); });
    syncFmtAvailability();
    ensureOneOutput();
  };

  fmtInputs.forEach((chip) => {
    chip.addEventListener('change', () => ensureOneOutput(chip.value));
  });

  if (platformSelect) platformSelect.addEventListener('change', syncFmtAvailability);

  if (desktopEnabled) {
    desktopEnabled.addEventListener('change', () => {
      syncFmtAvailability();

      if (desktopEnabled.checked && DESKTOP_OUTPUTS.every((f) => !(fmtInput(f) && fmtInput(f).checked))) setFmt('exe', true);
      ensureOneOutput('exe');
    });
  }

  syncFmtAvailability();

  $$('[data-devview]').forEach((el) => {
    el.addEventListener('click', () => {
      const view = $('#devCodeView');
      if (!view) return;
      const appName = ($('[name="appName"]') || {}).value || 'Mi App';
      const pkg = ($('[name="packageName"]') || {}).value || 'com.inteebuild.app';
      const kind = el.getAttribute('data-devview');
      if (kind === 'capacitor') view.textContent = `{\n  "appId": "${pkg}",\n  "appName": "${appName}",\n  "webDir": "www"\n}`;
      else if (kind === 'manifest') view.textContent = '<manifest xmlns:android="http://schemas.android.com/apk/res/android">\n  <!-- Manifest generado automáticamente -->\n</manifest>';
      else if (kind === 'package') view.textContent = '{\n  "name": "inteebuild-app",\n  "version": "1.0.0"\n}';
      else if (kind === 'res') view.textContent = 'plugins/\nres/\n  mipmap-hdpi/\n  values/colors.xml';
    });
  });

  const templateSelect = $('#templateSelect');
  if (templateSelect) {
    templateSelect.addEventListener('change', async () => {
      const value = templateSelect.value;
      if (!value) return;

      const setCheck = (name, val) => {
        const el = $(`[name="${name}"]`);
        if (!el) return;
        el.checked = !!val;
        const tile = el.closest('.perm-tile, .plugin-card, .switch');
        if (tile) tile.classList.toggle('checked', !!val);
      };
      const setVal = (name, val) => {
        const el = $(`[name="${name}"]`);
        if (el && val !== undefined) el.value = val;
      };
      const setProvider = (provider) => {
        const rad = $(`input[name="provider"][value="${provider}"]`);
        if (!rad) return;
        $$('input[name="provider"]').forEach((r) => {
          r.checked = false;
          r.closest('.plugin-card')?.classList.remove('checked');
        });
        rad.checked = true;
        rad.closest('.plugin-card')?.classList.add('checked');
      };

      try {
        const r = await fetch('/api/templates/' + encodeURIComponent(value));
        const t = await r.json();
        if (!r.ok) throw new Error(t.error || 'Plantilla no encontrada');
        const c = t.config || {};

        $$('#permEasy input[type="checkbox"], #permAdvanced input[type="checkbox"]').forEach((el) => {
          el.checked = false;
          el.closest('.perm-tile')?.classList.remove('checked');
        });
        Object.entries(c.permissions || {}).forEach(([k, val]) => setCheck(k, !!val));
        Object.entries(c.plugins || {}).forEach(([k, val]) => setCheck('plugin_' + k, !!val));
        ['orientation', 'loadingIndicator', 'offlineMessage', 'desktopPlatform'].forEach((k) => {
          if (c[k] !== undefined) setVal(k, c[k]);
        });
        ['fullscreen', 'keepScreenOn', 'edgeToEdge', 'useCleartext', 'splashEnabled', 'pullRefresh',
          'offlineScreen', 'downloadManager', 'flagSecure', 'blockSelection', 'encryptedStorage',
          'rootDetection', 'firebaseEnabled', 'admobInterstitial', 'admobRewarded', 'iapEnabled',
          'twaEnabled', 'desktopEnabled', 'nativeAudio', 'nativeAutoplay'].forEach((k) => {
          if (c[k] !== undefined) setCheck(k, !!c[k]);
        });
        if (c.nativeAudio) show($('#nativeAudioBox'));


        if (Array.isArray(c.outputs) && c.outputs.length) setOutputs(c.outputs);
        else if (c.outputType === 'both') setOutputs(['apk', 'aab']);
        else if (c.outputType) setOutputs([c.outputType]);
        else syncFmtAvailability();
        if (c.provider) setProvider(c.provider);



        if (t.faceHtml) {
          window._lastTemplateFace = t.faceHtml;
          window._lastTemplateName = t.name;
          const ta = $('[name="htmlCode"]');
          const current = ta ? ta.value.trim() : '';
          if (ta && !current) {
            $('.toggle-btn[data-input="html"]')?.click();
            ta.value = t.faceHtml;
          } else if (ta && current && current !== t.faceHtml) {

            setTimeout(() => {
              if (confirm('La plantilla "' + t.name + '" trae una cara HTML de ejemplo. ¿Usarla como cara? (Tu HTML actual se reemplaza. Todo lo demás ya quedó nativo.)')) {
                $('.toggle-btn[data-input="html"]')?.click();
                ta.value = t.faceHtml;
              }
            }, 350);
          }
          show($('#faceBtn'));
        }

        Preview.refresh();
        setTimeout(() => Permissions.runAudit(), 300);
        alert('Plantilla aplicada: ' + t.name + ' (nativo verificado + cara HTML lista). Revisa Audit en el paso 2.');
      } catch (e) {
        alert('No se pudo aplicar la plantilla: ' + e.message);
      }
    });
  }

  on('#faceBtn', 'click', async () => {
    if (window._lastTemplateFace) {
      $('.toggle-btn[data-input="html"]')?.click();
      const ta = $('[name="htmlCode"]');
      if (ta) ta.value = window._lastTemplateFace;
      return;
    }
    const value = templateSelect ? templateSelect.value : '';
    if (!value) return alert('Elige primero una plantilla arriba.');
    try {
      const r = await fetch('/api/templates/' + encodeURIComponent(value));
      const t = await r.json();
      if (!r.ok || !t.faceHtml) throw new Error('Sin cara disponible');
      window._lastTemplateFace = t.faceHtml;
      $('.toggle-btn[data-input="html"]')?.click();
      $('[name="htmlCode"]').value = t.faceHtml;
    } catch (e) {
      alert(e.message);
    }
  });

  on('#templateZipBtn', 'click', async () => {
    const tpl = $('#templateSelect') ? $('#templateSelect').value : '';
    if (!tpl) return alert('Elige primero una plantilla arriba (ej. Radio).');
    const templateZipBtn = $('#templateZipBtn');
    templateZipBtn.textContent = 'Generando ZIP…';
    templateZipBtn.disabled = true;
    try {
      const cfg = collect();
      cfg.template = tpl;
      const res = await fetch('/api/project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfg)
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || 'No se pudo generar el ZIP');
      }
      saveBlob(await res.blob(), 'inteebuild-plantilla-' + tpl + '.zip');
    } catch (e) {
      alert(e.message);
    }
    templateZipBtn.innerHTML = '<svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg> Ver código (ZIP) de la plantilla';
    templateZipBtn.disabled = false;
  });

  const collect = () => {
    const data = {};
    const outputs = [];
    document.querySelectorAll('input, select, textarea').forEach((el) => {
      if (!el.name) return;
      if (el.type === 'checkbox') {


        if (el.name === 'outputs') {
          if (el.checked && !el.disabled) outputs.push(el.value);
          return;
        }
        data[el.name] = el.checked;
      } else if (el.type === 'radio') {
        if (el.checked) data[el.name] = el.value;
      } else if (el.type === 'file') {
        return;
      } else {
        data[el.name] = el.value;
      }
    });


    data.outputs = outputs.length ? outputs : ['apk'];

    data.outputType = data.outputs.includes('aab')
      ? (data.outputs.includes('apk') ? 'both' : 'aab')
      : 'apk';

    const activeToggle = $('.toggle-btn.active');
    data.inputType = activeToggle ? activeToggle.dataset.input : 'url';
    data.iconBase64 = state.iconBase64 || undefined;
    data.keystoreBase64 = keystoreBase64 || undefined;
    data.iosP12Base64 = iosP12Base64 || undefined;
    data.iosProfileBase64 = iosProfileBase64 || undefined;

    data.permissions = {
      notifications: !!data.notifications,
      foreground: !!data.foreground,
      cameraMic: !!data.cameraMic,
      microphone: !!data.microphone,
      storage: !!data.storage,
      gps: !!data.gps,
      gpsBackground: !!data.gpsBackground,
      bluetooth: !!data.bluetooth,
      bluetoothScan: !!data.bluetoothScan,
      bluetoothConnect: !!data.bluetoothConnect,
      bluetoothAdvertise: !!data.bluetoothAdvertise,
      phone: !!data.phone,
      sms: !!data.sms,
      calendar: !!data.calendar,
      contacts: !!data.contacts,
      sensors: !!data.sensors,
      nfc: !!data.nfc,
      systemAlert: !!data.systemAlert,
      installPackages: !!data.installPackages,
      alarm: !!data.alarm,
      alarmSchedule: !!data.alarmSchedule,
      alarmUse: !!data.alarmUse,
      nearby: !!data.nearby,
      vibration: !!data.vibration,
      wakeLock: !!data.wakeLock,
      biometric: !!data.biometric,
      activityRecognition: !!data.activityRecognition
    };

    $$('input[data-perm-key]').forEach((el) => {
      if (el.type === 'checkbox') data.permissions[el.getAttribute('data-perm-key')] = el.checked;
    });

    data.notifyDelayMinutes = Number(data.notifyDelayMinutes || 0);
    data.versionCode = Number(data.versionCode || 1);
    data.compileSdk = Number(data.compileSdk || 35);
    data.targetSdk = Number(data.targetSdk || 35);
    data.minSdk = Number(data.minSdk || 23);
    data.splashDuration = Number(data.splashDuration || 2000);
    data.adaptiveFgBase64 = adaptiveFgBase64 || undefined;
    data.deepLinkPaths = data.deepLinkPaths
      ? String(data.deepLinkPaths).split(',').map((s) => s.trim()).filter(Boolean)
      : [];
    try {
      data.drawerItems = data.drawerItems ? JSON.parse(String(data.drawerItems)) : [];
      if (!Array.isArray(data.drawerItems)) data.drawerItems = [];
    } catch { data.drawerItems = []; }
    try {
      data.bottomNavItems = data.bottomNavItems ? JSON.parse(String(data.bottomNavItems)) : [];
      if (!Array.isArray(data.bottomNavItems)) data.bottomNavItems = [];
    } catch { data.bottomNavItems = []; }
    data.iapProducts = data.iapProducts ? String(data.iapProducts).split(',').map((s) => s.trim()).filter(Boolean) : [];

    data.plugins = {
      camera: !!data.plugin_camera,
      geolocation: !!data.plugin_geolocation,
      bluetooth: !!data.plugin_bluetooth,
      nfc: !!data.plugin_nfc,
      biometrics: !!data.plugin_biometrics,
      haptics: !!data.plugin_haptics,
      device: !!data.plugin_device,
      network: !!data.plugin_network,
      filesystem: !!data.plugin_filesystem,
      share: !!data.plugin_share,
      clipboard: !!data.plugin_clipboard,
      preferences: !!data.plugin_preferences,
      notifications: !!data.plugin_notifications,
      localNotifications: !!data.plugin_localNotifications,
      browser: !!data.plugin_browser,
      dialog: !!data.plugin_dialog,
      toast: !!data.plugin_toast,
      statusBar: !!data.plugin_statusBar,
      screenReader: !!data.plugin_screenReader,
      admob: !!data.plugin_admob,
      app: !!data.plugin_app,
      inteebridge: !!data.plugin_inteebridge,
      ar: !!data.plugin_ar,
      voice: !!data.plugin_voice,
      envSensors: !!data.plugin_envSensors,
      ai: !!data.plugin_ai,
      power: !!data.plugin_power,
      adaptiveNotif: !!data.plugin_adaptiveNotif,
      advSecurity: !!data.plugin_advSecurity,
      dynamicUI: !!data.plugin_dynamicUI,
      social: !!data.plugin_social,
      advGeo: !!data.plugin_advGeo,
      dataAnalytics: !!data.plugin_dataAnalytics,
      vr: !!data.plugin_vr,
      blockchain: !!data.plugin_blockchain,
      rpa: !!data.plugin_rpa,
      vulnScan: !!data.plugin_vulnScan,
      emoAI: !!data.plugin_emoAI,
      iot: !!data.plugin_iot,
      mr: !!data.plugin_mr
    };

    if (!data.url && data.inputType === 'url') data.url = '';
    return data;
  };

  const EXAMPLE_HTML = '<!DOCTYPE html>\n<html lang="es">\n<head>\n<meta charset="UTF-8" />\n<meta name="viewport" content="width=device-width, initial-scale=1.0" />\n<title>Mi App</title>\n<style>\nbody { font-family: sans-serif; text-align: center; padding: 40px 20px; }\nh1 { color: #4f46e5; }\n</style>\n</head>\n<body>\n<h1>Hola desde mi app</h1>\n<p>Edita este HTML y compilalo como APK.</p>\n</body>\n</html>';

  on('#exampleHtmlBtn', 'click', () => {
    $('.toggle-btn[data-input="html"]')?.click();
    setField('htmlCode', EXAMPLE_HTML);
    setField('appName', 'Mi App Ejemplo');
  });

  on('#htmlFileInput', 'change', (e) => {
    const input = e.currentTarget;
    const file = input.files && input.files[0];
    if (!file) return;
    if (file.size > 500 * 1024) {
      alert('El archivo supera 500 KB.');
      input.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setField('htmlCode', String(reader.result || ''));
      if (!$('[name="appName"]').value) {
        setField('appName', file.name.replace(/\.(html?|txt)$/i, '').replace(/[_-]+/g, ' ').trim() || 'Mi App');
      }
      Preview.refresh();
    };
    reader.readAsText(file);
  });

  const PRESETS = {
    foto: ['cameraMic', 'storage'],
    ubicacion: ['gps'],
    audio: ['microphone', 'storage']
  };
  $$('[data-preset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const preset = btn.dataset.preset;
      if (preset === 'limpiar') {
        $$('#permEasy input[type="checkbox"], #permAdvanced input[type="checkbox"]').forEach((el) => {
          el.checked = false;
          el.closest('.perm-tile')?.classList.remove('checked');
        });
        return;
      }
      (PRESETS[preset] || []).forEach((name) => setField(name, true));
    });
  });

  return { collect, setOutputs };
})();
