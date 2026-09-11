'use strict';

const ghBadge = document.getElementById('ghBadge');
const alertConfig = document.getElementById('alertConfig');
const stepDots = document.querySelectorAll('.step-dot');
const steps = document.querySelectorAll('.step');
const iconInput = document.getElementById('iconInput');
const iconPreview = document.getElementById('iconPreview');
const buildBtn = document.getElementById('buildBtn');
const zipBtn = document.getElementById('zipBtn');
const downloadZipBtn = document.getElementById('downloadZipBtn');
const backFromBuild = document.getElementById('backFromBuild');
const buildReady = document.getElementById('buildReady');
const buildProgress = document.getElementById('buildProgress');
const buildResult = document.getElementById('buildResult');
const progressBar = document.getElementById('progressBar');
const resultError = document.getElementById('resultError');
const resultAppName = document.getElementById('resultAppName');
const resultId = document.getElementById('resultId');
const resultTime = document.getElementById('resultTime');
const resultOutput = document.getElementById('resultOutput');
const resultActions = document.getElementById('resultActions');
const historyList = document.getElementById('historyList');

let currentStep = 0;
let iconBase64 = null;
let keystoreBase64 = null;
let adaptiveFgBase64 = null;
let buildStartTime = null;
let activeBuildId = null;
let isAdvanced = false;
let autoPilotRecommendations = null;

fetch('/api/health')
  .then((r) => r.json())
  .then((h) => {
    if (h.githubReady) {
      ghBadge.textContent = 'GitHub listo';
      ghBadge.className = 'badge badge-ok';
    } else {
      ghBadge.textContent = 'GitHub sin configurar';
      ghBadge.className = 'badge badge-warn';
      alertConfig.classList.remove('hidden');
      alertConfig.innerHTML = '<b>Falta configurar GitHub.</b> Agrega <code>GITHUB_TOKEN</code> e <code>INTEE_BUILDS_REPO</code> en Render o en <code>.env</code>.';
    }
  })
  .catch(() => {
    ghBadge.textContent = 'Servidor no detectado';
    ghBadge.className = 'badge badge-warn';
  });

function goToStep(idx) {
  if (idx < 0 || idx >= steps.length) return;
  steps[currentStep].classList.remove('active');
  stepDots[currentStep].classList.remove('active');
  if (idx > currentStep) stepDots[currentStep].classList.add('done');
  currentStep = idx;
  steps[currentStep].classList.add('active');
  stepDots[currentStep].classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (currentStep === 5) { loadHistory(); loadStats(); }
}

stepDots.forEach((dot) => {
  dot.addEventListener('click', () => {
    const target = Number(dot.dataset.step);
    if (target <= currentStep || stepDots[currentStep].classList.contains('done')) {
      goToStep(target);
    }
  });
});

document.querySelectorAll('.next-btn').forEach((btn) => {
  btn.addEventListener('click', () => goToStep(currentStep + 1));
});
document.querySelectorAll('.prev-btn').forEach((btn) => {
  btn.addEventListener('click', () => goToStep(currentStep - 1));
});

document.querySelectorAll('.toggle-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.toggle-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    const type = btn.dataset.input;
    document.getElementById('urlGroup').classList.toggle('hidden', type !== 'url');
    document.getElementById('htmlGroup').classList.toggle('hidden', type !== 'html');
  });
});

document.querySelectorAll('.perm-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.perm-tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    const target = tab.dataset.ptab;
    document.getElementById('permEasy').classList.toggle('hidden', target !== 'easy');
    document.getElementById('permAdvanced').classList.toggle('hidden', target !== 'advanced');
  });
});

document.querySelectorAll('.perm-tile').forEach((tile) => {
  const chk = tile.querySelector('input[type="checkbox"]');
  if (chk) {
    tile.classList.toggle('checked', chk.checked);
    tile.addEventListener('click', (e) => {
      if (e.target !== chk) chk.checked = !chk.checked;
      tile.classList.toggle('checked', chk.checked);
    });
  }
});

document.querySelectorAll('.plugin-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.plugin-tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    const cat = tab.dataset.ptab;
    document.querySelectorAll('.plugin-cat').forEach((c) => {
      c.classList.toggle('active', c.dataset.pcat === cat);
    });
  });
});

document.querySelectorAll('.plugin-card').forEach((card) => {
  const chk = card.querySelector('input[type="checkbox"]');
  if (chk) {
    card.classList.toggle('checked', chk.checked);
    card.addEventListener('click', (e) => {
      if (e.target !== chk) chk.checked = !chk.checked;
      card.classList.toggle('checked', chk.checked);
      if (chk.name === 'plugin_inteebridge') {
        const ibBox = document.getElementById('integridgeInfo');
        if (ibBox) ibBox.classList.toggle('hidden', !chk.checked);
      }
    });
  }
});

const splashCheck = document.getElementById('splashCheck');
if (splashCheck) {
  splashCheck.addEventListener('change', (e) => {
    document.getElementById('splashOptions').classList.toggle('hidden', !e.target.checked);
  });
}

const compileSdk = document.querySelector('[name="compileSdk"]');
const targetSdk = document.querySelector('[name="targetSdk"]');
if (compileSdk && targetSdk) {
  compileSdk.addEventListener('change', () => {
    targetSdk.value = compileSdk.value;
  });
}

iconInput.addEventListener('change', () => {
  const file = iconInput.files && iconInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    iconBase64 = reader.result;
    iconPreview.src = iconBase64;
    iconPreview.classList.remove('hidden');
    updatePreview();
  };
  reader.readAsDataURL(file);
});

const ksInput = document.getElementById('ksInput');
const ksLabel = document.getElementById('ksLabel');
const ksFields = document.getElementById('ksFields');
if (ksInput) {
  ksInput.addEventListener('change', () => {
    const file = ksInput.files && ksInput.files[0];
    if (!file) { keystoreBase64 = null; ksLabel.textContent = ' Elegir archivo .jks / .keystore'; ksFields.classList.add('hidden'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      keystoreBase64 = reader.result;
      ksLabel.textContent = file.name + ' (' + Math.round(file.size / 1024) + ' KB)';
      ksFields.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  });
}

const adaptiveFgInput = document.getElementById('adaptiveFgInput');
if (adaptiveFgInput) {
  adaptiveFgInput.addEventListener('change', () => {
    const f = adaptiveFgInput.files && adaptiveFgInput.files[0];
    if (!f) { adaptiveFgBase64 = null; return; }
    const r = new FileReader();
    r.onload = () => { adaptiveFgBase64 = r.result; };
    r.readAsDataURL(f);
  });
}
const adaptiveCheck = document.getElementById('adaptiveCheck');
if (adaptiveCheck) adaptiveCheck.addEventListener('change', (e) => document.getElementById('adaptiveBox').classList.toggle('hidden', !e.target.checked));
const dlCheck = document.getElementById('dlCheck');
if (dlCheck) dlCheck.addEventListener('change', (e) => document.getElementById('dlBox').classList.toggle('hidden', !e.target.checked));

const templateSelect = document.getElementById('templateSelect');
if (templateSelect) {
  templateSelect.addEventListener('change', () => {
    const v = templateSelect.value;
    const setCheck = (name, val) => {
      const el = document.querySelector(`[name="${name}"]`);
      if (el) {
        el.checked = !!val;
        const tile = el.closest('.perm-tile, .plugin-card');
        if (tile) tile.classList.toggle('checked', !!val);
      }
    };
    const setVal = (name, val) => { const el = document.querySelector(`[name="${name}"]`); if (el) el.value = val; };

    if (!v) return;

    setCheck('notifications', true);
    setCheck('foreground', true);

    if (v === 'radio') {
      setCheck('foreground', true); setCheck('wakeLock', true); setCheck('plugin_statusBar', true); setCheck('plugin_inteebridge', true);
      setVal('outputType', 'apk');
    } else if (v === 'ecommerce') {
      setCheck('storage', true); setCheck('cameraMic', true); setCheck('gps', true); setCheck('plugin_camera', true); setCheck('plugin_share', true);
    } else if (v === 'game') {
      setCheck('wakeLock', true); setCheck('vibration', true); setCheck('plugin_haptics', true); setCheck('fullscreen', true);
      setVal('orientation', 'landscape');
    } else if (v === 'streaming') {
      setCheck('foreground', true); setCheck('wakeLock', true); setCheck('plugin_statusBar', true);
      setVal('orientation', 'sensor');
    } else if (v === 'maps') {
      setCheck('gps', true); setCheck('plugin_geolocation', true);
    } else if (v === 'ai') {
      setCheck('microphone', true); setCheck('cameraMic', true); setCheck('plugin_clipboard', true); setCheck('plugin_inteebridge', true);
    } else if (v === 'comunidad') {
      setCheck('notifications', true); setCheck('cameraMic', true); setCheck('storage', true); setCheck('plugin_share', true); setCheck('plugin_camera', true);
    }
  });
}

const modeToggle = document.getElementById('modeToggle');
if (modeToggle) {
  modeToggle.addEventListener('click', () => {
    isAdvanced = !isAdvanced;
    modeToggle.textContent = isAdvanced ? 'Modo fácil' : 'Modo avanzado';
    document.querySelectorAll('.advanced').forEach((el) => el.classList.toggle('hidden', !isAdvanced));
  });
}

const appNameInput = document.getElementById('appNameInput');
const urlInput = document.querySelector('[name="url"]');

function updatePreview() {
  const name = appNameInput && appNameInput.value ? appNameInput.value : 'Mi App';
  const url = urlInput && urlInput.value ? urlInput.value : 'https://mi-web.com';

  const previewBar = document.getElementById('previewBar');
  const previewUrl = document.getElementById('previewUrl');
  const previewIcon = document.getElementById('previewIcon');
  if (previewBar) previewBar.textContent = name;
  if (previewUrl) previewUrl.textContent = url;
  if (previewIcon && iconBase64) previewIcon.innerHTML = '<img src="' + iconBase64 + '" />';

  const pbm = document.getElementById('previewBarMain');
  const pum = document.getElementById('previewUrlMain');
  const pim = document.getElementById('previewIconMain');
  if (pbm) pbm.textContent = name;
  if (pum) pum.textContent = url;
  if (pim && iconBase64) pim.innerHTML = '<img src="' + iconBase64 + '" style="width:100%;height:100%;object-fit:cover;border-radius:12px" />';
}

if (appNameInput) appNameInput.addEventListener('input', updatePreview);
if (urlInput) urlInput.addEventListener('input', updatePreview);

let isLandscape = false;
let isDark = false;
const phoneMock = document.getElementById('phoneMock');
const phoneScreen = document.getElementById('phoneScreen');
const previewSplash = document.getElementById('previewSplash');
const previewRotate = document.getElementById('previewRotate');
const previewFullscreen = document.getElementById('previewFullscreen');
const previewSplashBtn = document.getElementById('previewSplashBtn');
const previewTheme = document.getElementById('previewTheme');

if (previewRotate) previewRotate.addEventListener('click', () => { isLandscape = !isLandscape; phoneMock.classList.toggle('landscape', isLandscape); });
if (previewFullscreen) previewFullscreen.addEventListener('click', () => {
  phoneScreen.style.padding = phoneScreen.style.padding === '0px' ? '12px 12px 16px' : '0px';
  document.querySelector('.phone-status').classList.toggle('hidden');
  document.querySelector('.phone-nav').classList.toggle('hidden');
});
if (previewSplashBtn) previewSplashBtn.addEventListener('click', () => {
  previewSplash.classList.toggle('hidden');
  if (!previewSplash.classList.contains('hidden')) {
    const col = document.querySelector('[name="splashColor"]');
    if (col) previewSplash.style.background = col.value;
    setTimeout(() => previewSplash.classList.add('hidden'), 2000);
  }
});
if (previewTheme) previewTheme.addEventListener('click', () => {
  isDark = !isDark;
  phoneScreen.style.background = isDark ? '#18181b' : '#fff';
  phoneScreen.style.color = isDark ? '#fff' : '#18181b';
  previewTheme.textContent = isDark ? '☀️ Light' : ' Dark';
});

const ppRotate = document.getElementById('ppRotate');
const ppFullscreen = document.getElementById('ppFullscreen');
const ppSplashBtn = document.getElementById('ppSplashBtn');
const ppTheme = document.getElementById('ppTheme');
const ppLive = document.getElementById('ppLive');
const phonePreviewMain = document.getElementById('phonePreviewMain');
const ppScreen = document.getElementById('ppScreen');
const previewSplashMain = document.getElementById('previewSplashMain');
const ppIframe = document.getElementById('ppIframe');
const deviceSelect = document.getElementById('deviceSelect');

if (deviceSelect) {
  deviceSelect.addEventListener('change', () => {
    phonePreviewMain.className = 'phone device-' + deviceSelect.value;
  });
}
if (ppRotate) ppRotate.addEventListener('click', () => phonePreviewMain.classList.toggle('landscape'));
if (ppFullscreen) ppFullscreen.addEventListener('click', () => {
  phonePreviewMain.querySelector('.phone-status').classList.toggle('hidden');
  phonePreviewMain.querySelector('.phone-nav').classList.toggle('hidden');
});
if (ppSplashBtn) ppSplashBtn.addEventListener('click', () => {
  previewSplashMain.classList.toggle('hidden');
  setTimeout(() => previewSplashMain.classList.add('hidden'), 2000);
});
if (ppTheme) ppTheme.addEventListener('click', () => {
  const dark = ppScreen.style.background === 'rgb(24, 24, 27)';
  ppScreen.style.background = dark ? '#fff' : '#18181b';
  ppScreen.style.color = dark ? '#18181b' : '#fff';
});
if (ppLive) ppLive.addEventListener('click', () => {
  const url = urlInput ? urlInput.value.trim() : '';
  if (!url) return alert('Por favor ingresa una URL primero');
  if (ppIframe.classList.contains('hidden')) {
    ppIframe.innerHTML = `<iframe src="${url}" sandbox="allow-scripts allow-same-origin"></iframe>`;
    ppIframe.classList.remove('hidden');
    document.getElementById('previewIconMain').classList.add('hidden');
    document.getElementById('previewUrlMain').classList.add('hidden');
  } else {
    ppIframe.classList.add('hidden');
    ppIframe.innerHTML = '';
    document.getElementById('previewIconMain').classList.remove('hidden');
    document.getElementById('previewUrlMain').classList.remove('hidden');
  }
});

setInterval(() => {
  const t = document.getElementById('previewTime');
  if (t) t.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}, 30000);

const analyzeBtn = document.getElementById('analyzeBtn');
if (analyzeBtn) {
  analyzeBtn.addEventListener('click', async () => {
    const url = document.querySelector('[name="url"]').value.trim();
    if (!url) return alert('Ingresa una URL');
    analyzeBtn.textContent = 'Analizando…';
    analyzeBtn.disabled = true;

    try {
      const r = await fetch('/api/analyze?url=' + encodeURIComponent(url));
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);

      const box = document.getElementById('analyzeBox');
      box.classList.remove('hidden');

      document.getElementById('analyzeScore').textContent = j.score;
      const ring = document.getElementById('analyzeRing');
      if (ring) {
        const offset = 138.2 - (138.2 * j.score) / 100;
        ring.style.strokeDashoffset = offset;
        ring.style.stroke = j.score > 80 ? 'var(--success)' : j.score > 50 ? 'var(--warn)' : 'var(--danger)';
      }

      document.getElementById('analyzeDiag').textContent = j.diag;
      document.getElementById('analyzeSubDiag').textContent = `Status: ${j.status} | Recursos inseguros: ${j.insecureCount || 0}`;

      const grid = document.getElementById('analyzeGrid');
      const checkNames = {
        https: 'HTTPS seguro', reachable: 'Página accesible', viewport: 'Responsive (Viewport)',
        manifest: 'Web Manifest', favicon: 'Favicon / Icono', themeColor: 'Theme Color',
        serviceWorker: 'Service Worker', insecureResources: 'Sin recursos HTTP inseguros', htmlErrors: 'HTML válido'
      };
      grid.innerHTML = Object.entries(j.checks)
        .filter(([k]) => checkNames[k])
        .map(([k, v]) => `<div class="analyze-check ${v ? 'ok' : 'fail'}"><span>${v ? '✓' : '✗'}</span> ${checkNames[k]}</div>`)
        .join('');

      const fwBox = document.getElementById('analyzeFramework');
      if (j.frameworks && j.frameworks.length) {
        fwBox.classList.remove('hidden');
        fwBox.innerHTML = '<span style="font-size:11px;color:var(--muted)">Frameworks:</span> ' +
          j.frameworks.map((f) => `<span class="fw-badge">${f}</span>`).join(' ');
      }

      document.getElementById('analyzePwa').classList.toggle('hidden', !j.checks.pwa);
      if (j.pwa) {
        if (j.pwa.name && !appNameInput.value) appNameInput.value = j.pwa.name;
        if (j.pwa.short_name && !appNameInput.value) appNameInput.value = j.pwa.short_name;
        if (j.pwa.theme_color) {
          const ac = document.querySelector('[name="accentColor"]');
          if (ac) ac.value = j.pwa.theme_color;
        }
        updatePreview();
      }

      autoPilotRecommendations = j.recommendations || [];
      const autoBox = document.getElementById('autopilotBox');
      const autoItems = document.getElementById('autopilotItems');
      if (autoPilotRecommendations.length > 0) {
        autoBox.classList.remove('hidden');
        autoItems.innerHTML = autoPilotRecommendations
          .map((rec) => `<div class="autopilot-item">Detectamos uso de <b>${rec.api}</b> → Recomendado: <b>${rec.label}</b></div>`)
          .join('');
      } else {
        autoBox.classList.add('hidden');
      }
    } catch (e) {
      alert(e.message);
    }
    analyzeBtn.textContent = ' Analizar';
    analyzeBtn.disabled = false;
  });
}

const autopilotApply = document.getElementById('autopilotApply');
if (autopilotApply) {
  autopilotApply.addEventListener('click', () => {
    if (!autoPilotRecommendations) return;
    const setCheck = (name, val) => {
      const el = document.querySelector(`[name="${name}"]`);
      if (el) {
        el.checked = !!val;
        const tile = el.closest('.perm-tile, .plugin-card');
        if (tile) tile.classList.toggle('checked', !!val);
      }
    };

    autoPilotRecommendations.forEach((rec) => {
      (rec.permissions || []).forEach((p) => setCheck(p, true));
      (rec.plugins || []).forEach((p) => setCheck('plugin_' + p, true));
    });

    alert('¡Configuración automática aplicada con éxito!');
  });
}

const toggleConsole = document.getElementById('toggleConsole');
const buildConsole = document.getElementById('buildConsole');
if (toggleConsole && buildConsole) {
  toggleConsole.addEventListener('click', () => {
    buildConsole.classList.toggle('hidden');
    toggleConsole.textContent = buildConsole.classList.contains('hidden') ? 'Ver logs' : 'Ocultar logs';
  });
}

function collect() {
  const data = {};
  document.querySelectorAll('input, select, textarea').forEach((el) => {
    if (!el.name) return;
    if (el.type === 'checkbox') {
      data[el.name] = el.checked;
    } else if (el.type === 'file') {
      return;
    } else {
      data[el.name] = el.value;
    }
  });

  const activeToggle = document.querySelector('.toggle-btn.active');
  data.inputType = activeToggle ? activeToggle.dataset.input : 'url';
  data.iconBase64 = iconBase64 || undefined;
  data.keystoreBase64 = keystoreBase64 || undefined;

  data.permissions = {
    notifications: !!data.notifications,
    foreground: !!data.foreground,
    cameraMic: !!data.cameraMic,
    microphone: !!data.microphone,
    storage: !!data.storage,
    gps: !!data.gps,
    bluetooth: !!data.bluetooth,
    phone: !!data.phone,
    sms: !!data.sms,
    calendar: !!data.calendar,
    contacts: !!data.contacts,
    sensors: !!data.sensors,
    nfc: !!data.nfc,
    systemAlert: !!data.systemAlert,
    installPackages: !!data.installPackages,
    alarm: !!data.alarm,
    nearby: !!data.nearby,
    vibration: !!data.vibration,
    wakeLock: !!data.wakeLock,
    biometric: !!data.biometric,
    activityRecognition: !!data.activityRecognition
  };

  data.versionCode = Number(data.versionCode || 1);
  data.compileSdk = Number(data.compileSdk || 35);
  data.targetSdk = Number(data.targetSdk || 35);
  data.minSdk = Number(data.minSdk || 23);
  data.splashDuration = Number(data.splashDuration || 2000);
  data.adaptiveFgBase64 = adaptiveFgBase64 || undefined;
  data.deepLinkPaths = data.deepLinkPaths ? String(data.deepLinkPaths).split(',').map((s) => s.trim()).filter(Boolean) : [];

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
    inteebridge: !!data.plugin_inteebridge
  };

  if (!data.url && data.inputType === 'url') data.url = '';
  return data;
}

function setProgressStep(idx, state) {
  const el = document.getElementById('ps' + idx);
  if (!el) return;
  el.classList.remove('active', 'done');
  if (state === 'active') el.classList.add('active');
  if (state === 'done') el.classList.add('done');
}

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'hace ' + sec + 's';
  const min = Math.floor(sec / 60);
  if (min < 60) return 'hace ' + min + 'm';
  const hr = Math.floor(min / 60);
  if (hr < 24) return 'hace ' + hr + 'h';
  const d = Math.floor(hr / 24);
  return 'hace ' + d + 'd';
}

async function downloadZip(cfg) {
  try {
    const res = await fetch('/api/project', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cfg || collect())
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'No se pudo generar el proyecto');
    }
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'inteebuild-proyecto.zip';
    a.click();
    URL.revokeObjectURL(a.href);
  } catch (err) {
    alert(err.message);
  }
}

zipBtn.addEventListener('click', () => downloadZip());
if (downloadZipBtn) {
  downloadZipBtn.addEventListener('click', () => downloadZip());
}

buildBtn.addEventListener('click', async () => {
  buildReady.classList.add('hidden');
  buildProgress.classList.remove('hidden');
  buildResult.classList.add('hidden');
  resultError.classList.add('hidden');
  progressBar.style.width = '5%';
  buildStartTime = Date.now();

  for (let i = 0; i < 7; i++) setProgressStep(i, '');
  setProgressStep(0, 'active');
  if (buildConsole) { buildConsole.textContent = 'Iniciando build...\nProyecto generado...\n'; buildConsole.classList.remove('hidden'); }

  let id;
  try {
    const res = await fetch('/api/build', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(collect())
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'No se pudo iniciar el build');
    id = data.id;
    activeBuildId = id;
    setProgressStep(0, 'done');
    setProgressStep(1, 'active');
    progressBar.style.width = '15%';
  } catch (err) {
    showError(err.message);
    return;
  }

  const timer = setInterval(async () => {
    try {
      const res = await fetch('/api/build/' + id);
      const s = await res.json();

      if (s.step && s.step.includes('Sincronizando')) {
        setProgressStep(1, 'done');
        setProgressStep(2, 'active');
        progressBar.style.width = '30%';
      } else if (s.step && s.step.includes('Subiendo')) {
        setProgressStep(2, 'done');
        setProgressStep(3, 'active');
        progressBar.style.width = '45%';
      } else if (s.step && s.step.includes('Lanzando')) {
        setProgressStep(3, 'done');
        setProgressStep(4, 'active');
        progressBar.style.width = '60%';
      } else if (s.step && s.step.includes('Compilando')) {
        setProgressStep(4, 'done');
        setProgressStep(5, 'active');
        progressBar.style.width = '80%';
      }

      if (s.status === 'success') {
        clearInterval(timer);
        setProgressStep(5, 'done');
        setProgressStep(6, 'done');
        progressBar.style.width = '100%';

        setTimeout(() => {
          buildProgress.classList.add('hidden');
          buildResult.classList.remove('hidden');
          resultAppName.textContent = s.appName || '';
          resultId.textContent = id;
          if (resultOutput) resultOutput.textContent = s.outputType || 'apk';
          const elapsed = Math.round((Date.now() - buildStartTime) / 1000);
          const min = Math.floor(elapsed / 60);
          const sec = elapsed % 60;
          resultTime.textContent = min > 0 ? min + 'm ' + sec + 's' : sec + 's';

          resultActions.innerHTML = '';
          const dlApk = '/api/download/' + id;
          const dlAab = '/api/download/' + id + '/aab';

          const aApk = document.createElement('a');
          aApk.href = dlApk;
          aApk.className = 'btn primary';
          aApk.textContent = '⬇️ Descargar APK';
          aApk.download = (s.appName || 'app') + '.apk.zip';
          resultActions.appendChild(aApk);

          if (s.artifacts && s.artifacts.some((a) => a.name.includes('aab'))) {
            const aAab = document.createElement('a');
            aAab.href = dlAab;
            aAab.className = 'btn ghost';
            aAab.textContent = ' Descargar AAB';
            aAab.download = (s.appName || 'app') + '.aab.zip';
            resultActions.appendChild(aAab);
          }
        }, 600);
      } else if (s.status === 'failed' || s.status === 'error') {
        clearInterval(timer);
        showError(s.error || 'El build falló');
      }

      if (buildConsole && s.runUrl) {
        try {
          const lr = await fetch('/api/build/' + id + '/logs');
          const lj = await lr.json();
          if (lj.logs) { buildConsole.textContent = lj.logs.substring(0, 15000); buildConsole.classList.remove('hidden'); }
        } catch (_) {}
      }
    } catch (_) {}
  }, 3000);
});

backFromBuild.addEventListener('click', () => {
  goToStep(4);
  buildReady.classList.remove('hidden');
  buildProgress.classList.add('hidden');
  buildResult.classList.add('hidden');
});

const qrModal = document.getElementById('qrModal');
const showQrBtn = document.getElementById('showQrBtn');
const qrClose = document.getElementById('qrClose');
const qrImgBox = document.getElementById('qrImgBox');
const qrDirectLink = document.getElementById('qrDirectLink');

if (showQrBtn) {
  showQrBtn.addEventListener('click', () => {
    if (!activeBuildId) return;
    qrModal.classList.remove('hidden');
    qrImgBox.innerHTML = `<img src="/api/qr/${activeBuildId}" alt="QR Code" />`;
    qrDirectLink.href = '/api/download/' + activeBuildId;
  });
}
if (qrClose) {
  qrClose.addEventListener('click', () => qrModal.classList.add('hidden'));
}

const showApkInfoBtn = document.getElementById('showApkInfoBtn');
const apkInfoBox = document.getElementById('apkInfoBox');
const apkInfoGrid = document.getElementById('apkInfoGrid');

if (showApkInfoBtn) {
  showApkInfoBtn.addEventListener('click', async () => {
    if (!activeBuildId) return;
    if (!apkInfoBox.classList.contains('hidden')) {
      apkInfoBox.classList.add('hidden');
      return;
    }
    try {
      const r = await fetch('/api/apk-info/' + activeBuildId);
      const info = await r.json();
      if (!r.ok) throw new Error(info.error);

      apkInfoGrid.innerHTML = `
        <div class="apk-info-item"><div class="ai-label">TAMAÑO</div><div class="ai-value accent">${info.artifactSizeMB} MB</div></div>
        <div class="apk-info-item"><div class="ai-label">ARTIFACT</div><div class="ai-value" style="font-size:12px;font-weight:600">${info.artifactName}</div></div>
        <div class="apk-info-item"><div class="ai-label">OUTPUT TYPE</div><div class="ai-value">${info.outputType.toUpperCase()}</div></div>
        <div class="apk-info-item"><div class="ai-label">STATUS</div><div class="ai-value" style="color:var(--success)">SUCCESS</div></div>
      `;
      apkInfoBox.classList.remove('hidden');
    } catch (e) {
      alert('No se pudo obtener info del APK: ' + e.message);
    }
  });
}

async function loadHistory() {
  try {
    const res = await fetch('/api/history');
    const items = await res.json();
    if (!items.length) {
      historyList.innerHTML = '<div class="hempty">No hay builds aún. ¡Crea tu primera app!</div>';
      return;
    }
    historyList.innerHTML = items
      .map((h) => {
        const statusClass = h.status === 'success' ? 'ok' : h.status === 'failed' || h.status === 'error' ? 'fail' : 'pending';
        const statusText = h.status === 'success' ? 'Completado' : h.status === 'failed' ? 'Fallido' : h.status === 'error' ? 'Error' : 'En progreso';
        const buttons = [];
        if (h.status === 'success') {
          buttons.push('<a class="btn primary sm" href="/api/download/' + h.id + '">APK</a>');
        }
        if (h.runUrl) {
          buttons.push('<a class="btn ghost sm" href="' + h.runUrl + '" target="_blank" rel="noopener">Logs</a>');
        }
        return (
          '<div class="hitem">' +
          '<div class="hitem-left">' +
          '<div class="hitem-name">' + (h.appName || 'App') + '</div>' +
          '<div class="hitem-meta">' +
          '<span class="hitem-status ' + statusClass + '">' + statusText + '</span>' +
          '<span>' + timeAgo(h.createdAt) + '</span>' +
          '<span>ID: ' + h.id + '</span>' +
          '</div>' +
          '</div>' +
          '<div class="hitem-right">' + buttons.join('') + '</div>' +
          '</div>'
        );
      })
      .join('');
  } catch (_) {
    historyList.innerHTML = '<div class="hempty">Error cargando historial</div>';
  }
}

async function loadStats() {
  try {
    const r = await fetch('/api/stats');
    const s = await r.json();
    const set = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
    set('statTotal', s.total);
    set('statOk', s.ok);
    set('statFail', s.fail);
    set('statApk', s.apk);
    set('statAab', s.aab);
    set('statBoth', s.both);
    set('statAvg', s.avgSec ? Math.floor(s.avgSec / 60) + 'm ' + (s.avgSec % 60) + 's' : '—');
  } catch (_) {}
}

function showError(msg) {
  buildProgress.classList.add('hidden');
  resultError.textContent = msg;
  resultError.classList.remove('hidden');
  buildReady.classList.remove('hidden');
}
