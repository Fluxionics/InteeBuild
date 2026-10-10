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



  let droncitoEssentials = ['internet', 'vibration', 'wakeLock', 'notifications', 'cameraMic', 'gps', 'storage', 'nfc', 'biometric', 'bluetooth', 'bluetoothScan', 'bluetoothConnect', 'changeWifiState', 'changeNetworkState', 'nearbyWifiDevices'];
  const renderGranularPerms = async () => {
    try {
      const [r, rd] = await Promise.all([
        fetch('/api/permissions/spec'),
        fetch('/api/permissions/droncito-defaults').catch(() => null)
      ]);
      if (!r.ok) return;
      if (rd && rd.ok) {
        const jd = await rd.json();
        if (Array.isArray(jd.essentials) && jd.essentials.length) droncitoEssentials = jd.essentials;
      }
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
        return '<details class="acc" style="margin:6px 0"><summary>' + escHtml(api) + '</summary>' + titles + '</details>';
      }).join('');

      const wrap = document.createElement('div');
      wrap.innerHTML = '<p class="hint" style="margin:12px 0 4px">Capacidades granulares (cada una muestra su permiso Android real):</p>'
        + groupHtml
        + '<p class="hint" style="margin:8px 0 0;font-size:11px">AdMob está en COMING SOON (requiere SDK real, el Audit lo bloquea si se pide por API).</p>';
      adv.appendChild(wrap);

      const activeProvider = $('input[name="provider"]:checked');
      if (activeProvider && activeProvider.value === 'droncito') {
        wrap.querySelectorAll('input[type="checkbox"]').forEach((el) => {
          el.checked = droncitoEssentials.includes(el.getAttribute('data-perm-key') || el.name);
          const tile = el.closest('.switch');
          if (tile) tile.classList.toggle('checked', el.checked);
        });
      }


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
    ['nativeAudioCheck', 'nativeAudioBox'],
    ['privacyModeCheck', 'privacyOptions']
  ];
  CHECK_PANELS.forEach(([checkId, boxId]) => {
    const check = $('#' + checkId);
    const box = $('#' + boxId);
    if (!check || !box) return;
    const sync = () => setVisible(box, check.checked);
    check.addEventListener('change', sync);
    sync();
  });

  const signingEnabledCheck = $('#signingEnabledCheck');
  const signingFields = $('#signingFields');
  const signingHint = $('#signingHint');

  const updateSigningVisibility = () => {
    const fmtInputs = $$('[name="outputs"]');
    const hasReleaseOutput = Array.from(fmtInputs).some(el => 
      !el.disabled && el.checked && (el.value === 'aab' || el.value === 'release-apk' || el.value === 'release-aab')
    );
    const showHint = signingEnabledCheck && !hasReleaseOutput;
    const showFields = signingEnabledCheck && signingEnabledCheck.checked && hasReleaseOutput;
    
    if (signingHint) signingHint.style.display = showHint ? 'block' : 'none';
    if (signingFields) setVisible(signingFields, showFields);
  };

  if (signingEnabledCheck) {
    signingEnabledCheck.addEventListener('change', updateSigningVisibility);
  }
  $$('[name="outputs"]').forEach(el => el.addEventListener('change', updateSigningVisibility));
  updateSigningVisibility();

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

  const drawMonogram = (ctx, text, w, h, fontPx) => {
    const letters = String(text || 'A').trim().slice(0, 3).toUpperCase() || 'A';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 ' + fontPx + 'px Inter, Arial, sans-serif';
    ctx.fillText(letters, w / 2, h / 2);
  };

  const makeIconMonogram = (text, color) => {
    const cv = document.createElement('canvas');
    cv.width = 512;
    cv.height = 512;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = color || '#4f46e5';
    ctx.fillRect(0, 0, 512, 512);
    drawMonogram(ctx, text, 512, 512, 220);
    return cv.toDataURL('image/png');
  };

  const makeSplashMonogram = () => {
    const cv = document.createElement('canvas');
    cv.width = 1080;
    cv.height = 1920;
    const ctx = cv.getContext('2d');
    const bg = ($('[name="splashColor"]') && $('[name="splashColor"]').value) || '#ffffff';
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 1080, 1920);
    if (state.iconBase64) {
      const img = new Image();
      img.src = state.iconBase64;
      const size = 380;
      try { ctx.drawImage(img, (1080 - size) / 2, (1920 - size) / 2 - 120, size, size); } catch (_) {}
    }
    const name = String($('[name="appName"]') && $('[name="appName"]').value || '').trim().slice(0, 24);
    if (name) {
      const dark = bg.toLowerCase() !== '#ffffff' && bg.toLowerCase() !== '#fff' && bg.toLowerCase() !== '#f5f5f5';
      ctx.fillStyle = dark ? '#ffffff' : '#111111';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '700 88px Inter, Arial, sans-serif';
      ctx.fillText(name, 540, 1280);
    }
    return cv.toDataURL('image/png');
  };

  on('#monoIconBtn', 'click', () => {
    const text = ($('#monoIconText') && $('#monoIconText').value.trim()) || String($('[name="appName"]') && $('[name="appName"]').value || '').trim() || 'A';
    const color = ($('#monoIconColor') && $('#monoIconColor').value) || '#4f46e5';
    const dataUrl = makeIconMonogram(text, color);
    state.iconBase64 = dataUrl;
    const ip = $('#iconPreview');
    if (ip) { ip.src = dataUrl; show(ip); }
    Preview.refresh();
  });

  on('#monoSplashBtn', 'click', () => {
    splashImageBase64 = makeSplashMonogram();
    alert('Splash generado con tu monograma. Activa la pantalla de splash si aún no lo hiciste.');
  });

  on('#playPreviewBtn', 'click', async () => {
    const box = $('#playPreviewBox');
    if (!box) return;
    box.innerHTML = '<small style="color:var(--muted)">Armando la ficha…</small>';
    show(box);
    try {
      const r = await fetch('/api/listing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(collect())
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'No se pudo armar la ficha');
      const L = j.listing || {};
      const icon = state.iconBase64
        ? '<img src="' + state.iconBase64 + '" alt="icon" style="width:64px;height:64px;border-radius:14px;object-fit:cover" />'
        : '<div style="width:64px;height:64px;border-radius:14px;background:var(--border);display:flex;align-items:center;justify-content:center;font-weight:700">' + escHtml(String(L.title || 'A').slice(0, 1)) + '</div>';
      box.innerHTML =
        '<div style="display:flex;gap:12px;align-items:center;padding:10px;border:1px solid var(--border);border-radius:10px">' + icon +
        '<div style="min-width:0"><b style="font-size:15px">' + escHtml(L.title || '') + '</b> <small style="color:var(--muted)">' + escHtml(L.version || '') + '</small>' +
        '<div style="font-size:12px;color:var(--muted)">' + escHtml(L.category || '') + ' · ' + escHtml(L.packageName || '') + '</div>' +
        '<div style="font-size:12px;margin-top:2px">' + escHtml(L.shortDescription || '') + '</div></div></div>' +
        '<details style="margin-top:8px"><summary style="cursor:pointer;font-size:13px">Descripción larga y palabras clave</summary>' +
        '<p style="font-size:12px;white-space:pre-wrap">' + escHtml(L.fullDescription || '') + '</p>' +
        '<p style="font-size:12px;color:var(--muted)">Palabras clave: ' + escHtml(L.keywords || '') + '</p></details>';
    } catch (e) {
      box.innerHTML = '<span style="color:var(--danger)">' + escHtml(e.message) + '</span>';
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

  let splashImageBase64 = null;
  bindFileInput({
    input: '#splashImageInput',
    onLoaded: (dataUrl) => { splashImageBase64 = dataUrl; },
    onCleared: () => { splashImageBase64 = null; }
  });

  const htmlDropZone = $('#htmlDropZone');
  const htmlFileInput2 = $('#htmlFileInput2');
  if (htmlDropZone && htmlFileInput2) {
    htmlFileInput2.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      if (file.size > 500 * 1024) {
        alert('El archivo supera 500 KB.');
        e.target.value = '';
        return;
      }
      if (file.name.endsWith('.zip')) {
        alert('Los archivos ZIP se procesan en el servidor. Selecciona HTML/CSS/JS o usa la plantilla.');
        e.target.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        $('.toggle-btn[data-input="html"]')?.click();
        setField('htmlCode', String(reader.result || ''));
        if (!$('[name="appName"]').value) {
          setField('appName', file.name.replace(/\.(html?|css|js|txt)$/i, '').replace(/[_-]+/g, ' ').trim() || 'Mi App');
        }
        Preview.refresh();
      };
      reader.readAsText(file);
    });
    window.handleHtmlDrop = (event) => {
      const file = event.dataTransfer.files && event.dataTransfer.files[0];
      if (!file) return;
      if (file.size > 500 * 1024) {
        alert('El archivo supera 500 KB.');
        return;
      }
      if (file.name.endsWith('.zip')) {
        alert('Los archivos ZIP se procesan en el servidor. Selecciona HTML/CSS/JS o usa la plantilla.');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        $('.toggle-btn[data-input="html"]')?.click();
        setField('htmlCode', String(reader.result || ''));
        if (!$('[name="appName"]').value) {
          setField('appName', file.name.replace(/\.(html?|css|js|txt)$/i, '').replace(/[_-]+/g, ' ').trim() || 'Mi App');
        }
        Preview.refresh();
      };
      reader.readAsText(file);
    };
  }

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

  const tt = (k) => (window.IB_I18N && window.IB_I18N.t) ? window.IB_I18N.t(k) : k;

  const setProvider = (provider) => {
    const rad = $(`input[name="provider"][value="${provider}"]`);
    if (!rad) return;
    $$('input[name="provider"]').forEach((r) => {
      r.checked = false;
      r.closest('.plugin-card')?.classList.remove('checked');
    });
    rad.checked = true;
    rad.closest('.plugin-card')?.classList.add('checked');
    const det = rad.closest('details');
    if (det) det.open = true;
    droncitoDefaultsMark = '';
    onProviderSelect();
  };

  const PROVIDER_OUTPUTS = {
    droncito: { android: ['apk', 'aab', 'release-apk', 'release-aab'], ios: ['ipa'], both: ['apk', 'aab', 'release-apk', 'release-aab', 'ipa'] },
    capacitor: { android: ['apk', 'aab', 'xapk', 'apks', 'release-apk', 'release-aab'], ios: ['ipa'], both: ['apk', 'aab', 'xapk', 'apks', 'release-apk', 'release-aab', 'ipa'] },
    native: { android: ['apk', 'aab', 'release-apk', 'release-aab'], ios: ['ipa'], both: ['apk', 'aab', 'release-apk', 'release-aab', 'ipa'] },
    gecko: { android: ['apk', 'aab', 'release-apk', 'release-aab'], ios: ['ipa'], both: ['apk', 'aab', 'release-apk', 'release-aab', 'ipa'] },
    twa: { android: ['apk', 'aab', 'release-apk', 'release-aab'], ios: ['ipa'], both: ['apk', 'aab', 'release-apk', 'release-aab', 'ipa'] },
    cordova: { android: ['apk', 'aab', 'release-apk', 'release-aab'], ios: [], both: ['apk', 'aab', 'release-apk', 'release-aab'] },
    flutter: { android: ['apk', 'aab', 'release-apk', 'release-aab'], ios: [], both: ['apk', 'aab', 'release-apk', 'release-aab'] },
    tauri: { android: ['exe'], ios: [], both: ['exe', 'msi', 'dmg', 'appimage'] },
    ios: { android: [], ios: ['ipa'], both: ['ipa'] },
    desktop: { android: [], ios: [], both: ['exe', 'msi', 'dmg', 'appimage'] }
  };

  const syncOutputsForProvider = () => {
    const providerEl = $('input[name="provider"]:checked');
    const platformEl = $('#platformSelect');
    const provider = providerEl ? providerEl.value : 'capacitor';
    const platform = platformEl ? platformEl.value : 'android';
    const prov = PROVIDER_OUTPUTS[provider] || PROVIDER_OUTPUTS.capacitor;
    const allowed = prov[platform] || prov.android || [];
    
    const fmtInputs = $$('[name="outputs"]');
    fmtInputs.forEach((el) => {
      const isAllowed = allowed.includes(el.value);
      el.disabled = !isAllowed;
      el.closest('.fmt-chip')?.classList.toggle('disabled', !isAllowed);
      if (!isAllowed && el.checked) el.checked = false;
    });

    const enabled = fmtInputs.filter((el) => !el.disabled);
    if (!enabled.some((el) => el.checked)) {
      const fallback = enabled.find((el) => el.value === 'apk') || enabled[0];
      if (fallback) fallback.checked = true;
    }

    const fmtNote = $('#fmtNote');
    if (fmtNote && allowed.length) {
      fmtNote.textContent = `Formatos soportados por ${provider}: ${allowed.map(f => f.toUpperCase()).join(', ')}`;
      setTimeout(() => { fmtNote.textContent = ''; }, 4000);
    }
  };

  let droncitoDefaultsMark = '';
  const applyProviderDefaults = () => {
    const provider = $('input[name="provider"]:checked');
    const p = provider ? provider.value : '';
    if (p !== 'droncito') {
      droncitoDefaultsMark = '';
      return;
    }
    if (droncitoDefaultsMark === 'droncito') return;
    droncitoDefaultsMark = 'droncito';
    $$('#permEasy input[type="checkbox"], #permAdvanced input[type="checkbox"]').forEach((el) => {
      el.checked = droncitoEssentials.includes(el.getAttribute('data-perm-key') || el.name);
      const tile = el.closest('.perm-tile, .switch');
      if (tile) tile.classList.toggle('checked', el.checked);
    });
    setVisible($('#integridgeInfo'), true);
  };

  const onProviderSelect = () => {
  onProviderSelect();
    applyProviderDefaults();
  };

  const applyConfig = (c) => {
    if (!c || typeof c !== 'object') return;
    if (c.inputType === 'html') {
      $('.toggle-btn[data-input="html"]')?.click();
      setField('htmlCode', c.htmlCode || '');
    } else if (c.inputType === 'url') {
      $('.toggle-btn[data-input="url"]')?.click();
      setField('url', c.url || '');
    }
    const scalars = ['appName', 'packageName', 'versionName', 'versionCode', 'orientation', 'platform',
      'desktopPlatform', 'loadingIndicator', 'offlineMessage', 'compileSdk', 'targetSdk', 'minSdk',
      'splashColor', 'splashDuration', 'splashAnimation', 'accentColor', 'statusBarColor', 'navigationBarColor',
      'themeColor', 'notifChannel', 'notifImportance', 'notifyDelayMinutes', 'privacyCustomBlocklist'];
    scalars.forEach((k) => {
      if (c[k] !== undefined) setField(k, c[k]);
    });
    const bools = ['fullscreen', 'edgeToEdge', 'keepScreenOn', 'useCleartext', 'splashEnabled',
      'notifSound', 'notifVibration', 'adaptiveIconEnabled', 'desktopEnabled', 'offlineScreen',
      'downloadManager', 'flagSecure', 'blockSelection', 'encryptedStorage', 'rootDetection',
      'firebaseEnabled', 'admobInterstitial', 'admobRewarded', 'iapEnabled', 'twaEnabled',
      'nativeAudio', 'nativeAutoplay', 'pullRefresh', 'transparentNavBar',
      'webviewPullRefresh', 'webviewPinchZoom', 'webviewHideScrollbars', 'webviewDisableCopy', 'webviewDisableLongPress',
      'privacyMode', 'privacyBlockAds', 'privacyBlockTracking', 'privacyBlockCookies', 'privacyBlockGeolocation',
      'privacyBlockRedirects', 'privacyAutoDetect', 'signingEnabled'];
    bools.forEach((k) => {
      if (c[k] !== undefined) setField(k, !!c[k]);
    });
    if (Array.isArray(c.outputs) && c.outputs.length) setOutputs(c.outputs);
    else if (c.outputType === 'both') setOutputs(['apk', 'aab']);
    else if (c.outputType) setOutputs([c.outputType]);
    Object.entries(c.permissions || {}).forEach(([k, v]) => setField(k, !!v));
    Object.entries(c.plugins || {}).forEach(([k, v]) => setField('plugin_' + k, !!v));
    if (c.provider) setProvider(c.provider);
    if (Array.isArray(c.drawerItems) && c.drawerItems.length) setField('drawerItems', JSON.stringify(c.drawerItems, null, 2));
    if (Array.isArray(c.bottomNavItems) && c.bottomNavItems.length) setField('bottomNavItems', JSON.stringify(c.bottomNavItems, null, 2));
    if (Array.isArray(c.iapProducts) && c.iapProducts.length) setField('iapProducts', c.iapProducts.join(', '));
    if (Array.isArray(c.deepLinkPaths) && c.deepLinkPaths.length) setField('deepLinkPaths', c.deepLinkPaths.join(', '));
    if (c.iconBase64) {
      state.iconBase64 = c.iconBase64;
      const ip = $('#iconPreview');
      if (ip) { ip.src = c.iconBase64; show(ip); }
    }
    if (c.keystoreBase64) {
      keystoreBase64 = c.keystoreBase64;
      const kl = $('#ksLabel');
      if (kl) kl.textContent = tt('Keystore (.jks) cargado desde tu borrador');
      show($('#ksFields'));
    }
    if (c.keystorePassword) {
      const kp = $('#ksPass');
      if (kp) kp.value = c.keystorePassword;
    }
    if (c.keyAlias) {
      const ka = $('#ksAlias');
      if (ka) ka.value = c.keyAlias;
    }
    if (c.keyPassword) {
      const kkp = $('#ksKeyPass');
      if (kkp) kkp.value = c.keyPassword;
    }
    if (c.iosP12Base64) iosP12Base64 = c.iosP12Base64;
    if (c.iosProfileBase64) iosProfileBase64 = c.iosProfileBase64;
    if (c.iosP12Base64 || c.iosProfileBase64) refreshIosFields();
    if (c.adaptiveFgBase64) adaptiveFgBase64 = c.adaptiveFgBase64;
    if (c.splashImageBase64) splashImageBase64 = c.splashImageBase64;
    if (c.nativeAudio) show($('#nativeAudioBox'));
    updateSigningVisibility();
    Preview.refresh();
    setTimeout(() => Permissions.runAudit(), 300);
  };

  const validate = () => {
    const cfg = collect();
    const errs = [];
    if (cfg.inputType === 'url') {
      const url = String(cfg.url || '').trim();
      if (!url) errs.push('Falta la URL de tu sitio (paso 1).');
      else {
        try {
          const u = new URL(url);
          if (u.protocol !== 'http:' && u.protocol !== 'https:') errs.push('La URL debe empezar con http:// o https://.');
          else if (/^(localhost|127\.|0\.0\.0\.0|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(u.hostname)) errs.push('No se compila desde direcciones locales o privadas.');
        } catch (_) {
          errs.push('La URL no es válida. Ejemplo: https://mi-sitio.com');
        }
      }
    } else {
      const len = String(cfg.htmlCode || '').length;
      if (len < 50) errs.push('Pega tu HTML en el paso 1 (está muy corto).');
      else if (len > 500000) errs.push('El HTML supera el límite de 500 KB.');
    }
    if (String(cfg.appName || '').trim().length < 2) errs.push('Falta el nombre de la app (paso 1).');
    if (cfg.splashEnabled) {
      const sd = Number(cfg.splashDuration || 0);
      if (!sd || sd <= 0) errs.push('La duración del splash debe ser mayor a 0 ms.');
    }
    if (cfg.themeColor && !/^#[0-9a-fA-F]{6}$/.test(cfg.themeColor)) errs.push('El color de tema debe ser un hex válido (ej. #22d3a7).');
    if (cfg.signingEnabled) {
      if (!cfg.keystoreBase64) errs.push('Falta el archivo Keystore (.jks) para firmar.');
      if (!cfg.keyAlias) errs.push('Falta el alias de la clave (keyAlias).');
      if (!cfg.keystorePassword) errs.push('Falta la contraseña del Keystore.');
      if (!cfg.keyPassword) errs.push('Falta la contraseña de la clave privada.');
    }
    return errs.map(tt);
  };

  const DRAFT_KEY = 'ib:draft';
  let draftTimer = null;
  let draftBaseline = '';

const writeDraft = (cfg) => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ t: Date.now(), cfg }));
      return;
    } catch (_) {}
    ['iconBase64', 'keystoreBase64', 'iosP12Base64', 'iosProfileBase64', 'adaptiveFgBase64', 'splashImageBase64', 'keystorePassword', 'keyAlias', 'keyPassword'].forEach((k) => { delete cfg[k]; });
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ t: Date.now(), cfg })); } catch (___) {}
  };

  const saveDraft = () => {
    if (draftTimer) clearTimeout(draftTimer);
    draftTimer = setTimeout(() => {
      draftTimer = null;
      const cfg = collect();
      const snap = JSON.stringify(cfg);
      if (snap === draftBaseline) return;
      writeDraft(cfg);
    }, 700);
  };

  const initDraft = () => {
    draftBaseline = JSON.stringify(collect());
    document.addEventListener('change', saveDraft, true);
    document.addEventListener('input', saveDraft, true);
    if (new URLSearchParams(location.search).get('dup')) return;
    let d = null;
    try { d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch (_) {}
    if (!d || !d.cfg || !d.t || Date.now() - d.t > 604800000) {
      try { localStorage.removeItem(DRAFT_KEY); } catch (_) {}
      return;
    }
    show($('#draftBar'));
    on('#draftRestore', 'click', () => {
      applyConfig(d.cfg);
      hide($('#draftBar'));
      goToStep(0);
    });
    on('#draftDiscard', 'click', () => {
      try { localStorage.removeItem(DRAFT_KEY); } catch (_) {}
      hide($('#draftBar'));
    });
  };

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
    data.splashImageBase64 = splashImageBase64 || undefined;

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

    data.webview = {
      pullRefresh: !!data.webviewPullRefresh,
      pinchZoom: !!data.webviewPinchZoom,
      hideScrollbars: !!data.webviewHideScrollbars,
      disableCopy: !!data.webviewDisableCopy,
      disableLongPress: !!data.webviewDisableLongPress
    };

    data.privacy = {
      mode: !!data.privacyMode,
      blockAds: !!data.privacyBlockAds,
      blockTracking: !!data.privacyBlockTracking,
      blockCookies: !!data.privacyBlockCookies,
      blockGeolocation: !!data.privacyBlockGeolocation,
      blockRedirects: !!data.privacyBlockRedirects,
      autoDetect: !!data.privacyAutoDetect,
      customBlocklist: data.privacyCustomBlocklist || ''
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

  $$('input[name="provider"]').forEach((r) => {
    r.addEventListener('change', onProviderSelect);
    r.addEventListener('click', onProviderSelect);
  });
  const platformSelectEl = $('#platformSelect');
  if (platformSelectEl) platformSelectEl.addEventListener('change', syncOutputsForProvider);

  syncOutputsForProvider();

  return { collect, setOutputs, applyConfig, validate, initDraft };
})();
