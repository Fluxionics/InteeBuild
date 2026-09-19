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

function escHtml(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

fetch('/api/health')
  .then((r) => r.json())
  .then((h) => {
    if (h.githubReady) {
      ghBadge.textContent = 'GitHub Listo';
      ghBadge.className = 'badge badge-ok';
    } else {
      ghBadge.textContent = 'GitHub no configurado';
      ghBadge.className = 'badge badge-warn';
      alertConfig.classList.remove('hidden');
      alertConfig.innerHTML = '<b>Configuración de GitHub pendiente.</b> Agrega <code>GITHUB_TOKEN</code> e <code>INTEE_BUILDS_REPO</code> en Render o en <code>.env</code>.';
    }
  })
  .catch(() => {
    ghBadge.textContent = 'Servidor Offline';
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
  if (currentStep === 5) { runQAChecks(); }
  if (currentStep === 7) { loadHistory(); loadStats(); }
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
      e.stopPropagation();
      chk.checked = !chk.checked;
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
  const rad = card.querySelector('input[type="radio"]');
  if (chk) {
    card.classList.toggle('checked', chk.checked);
    card.addEventListener('click', (e) => {
      e.stopPropagation();
      chk.checked = !chk.checked;
      card.classList.toggle('checked', chk.checked);
      if (chk.name === 'plugin_inteebridge') {
        const ibBox = document.getElementById('integridgeInfo');
        if (ibBox) ibBox.classList.toggle('hidden', !chk.checked);
      }
    });
  } else if (rad) {
    card.classList.toggle('checked', rad.checked);
    card.addEventListener('click', (e) => {
      e.stopPropagation();
      document.querySelectorAll('input[name="provider"]').forEach(r=>r.checked=false);
      document.querySelectorAll('.plugin-card input[name="provider"]').forEach(r=> r.closest('.plugin-card').classList.remove('checked'));
      rad.checked=true;
      card.classList.add('checked');
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
    if (!file) { keystoreBase64 = null; ksLabel.textContent = 'Seleccionar archivo Keystore (.jks)'; ksFields.classList.add('hidden'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      keystoreBase64 = reader.result;
      ksLabel.textContent = file.name + ' (' + Math.round(file.size / 1024) + ' KB)';
      ksFields.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  });
}

let iosP12Base64 = null;
let iosProfileBase64 = null;
const iosP12Input = document.getElementById('iosP12Input');
const iosP12Label = document.getElementById('iosP12Label');
const iosProfileInput = document.getElementById('iosProfileInput');
const iosProfileLabel = document.getElementById('iosProfileLabel');
const iosSignFields = document.getElementById('iosSignFields');
function refreshIosFields() {
  if (iosSignFields) iosSignFields.classList.toggle('hidden', !(iosP12Base64 && iosProfileBase64));
}
if (iosP12Input) {
  iosP12Input.addEventListener('change', () => {
    const file = iosP12Input.files && iosP12Input.files[0];
    if (!file) { iosP12Base64 = null; iosP12Label.textContent = 'Elegir .p12'; refreshIosFields(); return; }
    const reader = new FileReader();
    reader.onload = () => {
      iosP12Base64 = reader.result;
      iosP12Label.textContent = file.name + ' (' + Math.round(file.size / 1024) + ' KB)';
      refreshIosFields();
    };
    reader.readAsDataURL(file);
  });
}
if (iosProfileInput) {
  iosProfileInput.addEventListener('change', () => {
    const file = iosProfileInput.files && iosProfileInput.files[0];
    if (!file) { iosProfileBase64 = null; iosProfileLabel.textContent = 'Elegir .mobileprovision'; refreshIosFields(); return; }
    const reader = new FileReader();
    reader.onload = () => {
      iosProfileBase64 = reader.result;
      iosProfileLabel.textContent = file.name + ' (' + Math.round(file.size / 1024) + ' KB)';
      refreshIosFields();
    };
    reader.readAsDataURL(file);
  });
}
const platformSelect = document.getElementById('platformSelect');
const iosHint = document.getElementById('iosHint');
if (platformSelect && iosHint) {
  const syncHint = () => { iosHint.style.display = platformSelect.value === 'android' ? 'none' : 'block'; };
  platformSelect.addEventListener('change', syncHint);
  syncHint();
}

document.querySelectorAll('[data-devview]').forEach((el) => {
  el.addEventListener('click', () => {
    const view = document.getElementById('devCodeView');
    if (!view) return;
    const appName = (document.querySelector('[name="appName"]') || {}).value || 'Mi App';
    const pkg = (document.querySelector('[name="packageName"]') || {}).value || 'com.inteebuild.app';
    const k = el.getAttribute('data-devview');
    if (k === 'capacitor') view.textContent = '{\n  "appId": "' + pkg + '",\n  "appName": "' + appName + '",\n  "webDir": "www"\n}';
    else if (k === 'manifest') view.textContent = '<manifest xmlns:android="http://schemas.android.com/apk/res/android">\n  <!-- Manifest generado automáticamente -->\n</manifest>';
    else if (k === 'package') view.textContent = '{\n  "name": "inteebuild-app",\n  "version": "1.0.0"\n}';
    else if (k === 'res') view.textContent = 'plugins/\nres/\n  mipmap-hdpi/\n  values/colors.xml';
  });
});

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
const drawerCheck=document.getElementById('drawerCheck');
if(drawerCheck) drawerCheck.addEventListener('change', e=> document.getElementById('drawerBox').classList.toggle('hidden', !e.target.checked));
const bottomCheck=document.getElementById('bottomCheck');
if(bottomCheck) bottomCheck.addEventListener('change', e=> document.getElementById('bottomBox').classList.toggle('hidden', !e.target.checked));
const nativeAudioCheck=document.getElementById('nativeAudioCheck');
if(nativeAudioCheck) {
  const syncNativeBox=()=> document.getElementById('nativeAudioBox').classList.toggle('hidden', !nativeAudioCheck.checked);
  nativeAudioCheck.addEventListener('change', syncNativeBox);
  syncNativeBox();
}

const templateSelect = document.getElementById('templateSelect');
if (templateSelect) {
  templateSelect.addEventListener('change', async () => {
    const v = templateSelect.value;
    if (!v) return;
    const setCheck = (name, val) => {
      const el = document.querySelector(`[name="${name}"]`);
      if (el) {
        el.checked = !!val;
        const tile = el.closest('.perm-tile, .plugin-card, .switch');
        if (tile) tile.classList.toggle('checked', !!val);
      }
    };
    const setVal = (name, val) => { const el = document.querySelector(`[name="${name}"]`); if (el && val !== undefined) el.value = val; };
    const setProvider = (p) => {
      const rad = document.querySelector(`input[name="provider"][value="${p}"]`);
      if (rad) {
        document.querySelectorAll('input[name="provider"]').forEach(r=>{r.checked=false; r.closest('.plugin-card')?.classList.remove('checked');});
        rad.checked = true;
        rad.closest('.plugin-card')?.classList.add('checked');
      }
    };
    try {
      const r = await fetch('/api/templates/' + encodeURIComponent(v));
      const t = await r.json();
      if (!r.ok) throw new Error(t.error || 'Plantilla no encontrada');
      const c = t.config || {};
      // Limpia permisos/plugins antes de aplicar plantilla completa
      document.querySelectorAll('#permEasy input[type="checkbox"], #permAdvanced input[type="checkbox"]').forEach(el=>{ el.checked=false; el.closest('.perm-tile')?.classList.remove('checked'); });
      Object.entries(c.permissions || {}).forEach(([k,val])=> setCheck(k, !!val));
      Object.entries(c.plugins || {}).forEach(([k,val])=> setCheck('plugin_' + k, !!val));
      ['orientation','outputType','loadingIndicator','offlineMessage','desktopPlatform'].forEach(k=>{ if(c[k]!==undefined) setVal(k, c[k]); });
      ['fullscreen','keepScreenOn','edgeToEdge','useCleartext','splashEnabled','pullRefresh','offlineScreen','downloadManager','flagSecure','blockSelection','encryptedStorage','rootDetection','firebaseEnabled','admobInterstitial','admobRewarded','iapEnabled','twaEnabled','desktopEnabled','nativeAudio','nativeAutoplay'].forEach(k=>{ if(c[k]!==undefined) setCheck(k, !!c[k]); });
      if (c.nativeAudio) { const nb=document.getElementById('nativeAudioBox'); if(nb) nb.classList.remove('hidden'); }
      if(c.provider) setProvider(c.provider);
      // Cara HTML: la plantilla trae cara starter 100% editable.
      // Si el editor está vacío se pone sola; si tienes tu HTML, te pregunta sin borrar nada.
      if (t.faceHtml) {
        window._lastTemplateFace = t.faceHtml;
        window._lastTemplateName = t.name;
        const ta = document.querySelector('[name="htmlCode"]');
        const cur = ta ? ta.value.trim() : '';
        if (ta && !cur) {
          const htmlToggle = document.querySelector('.toggle-btn[data-input="html"]');
          if (htmlToggle) htmlToggle.click();
          ta.value = t.faceHtml;
        } else if (ta && cur && cur !== t.faceHtml) {
          setTimeout(() => {
            if (confirm('La plantilla "' + t.name + '" trae una cara HTML de ejemplo. ¿Usarla como cara? (Tu HTML actual se reemplaza. Todo lo demás ya quedó nativo.)')) {
              const htmlToggle = document.querySelector('.toggle-btn[data-input="html"]');
              if (htmlToggle) htmlToggle.click();
              ta.value = t.faceHtml;
            }
          }, 350);
        }
        const faceBtn = document.getElementById('faceBtn');
        if (faceBtn) faceBtn.classList.remove('hidden');
      }
      if (typeof updatePreview === 'function') updatePreview();
      if (typeof runAudit === 'function') setTimeout(runAudit, 300);
      alert('Plantilla aplicada: ' + t.name + ' (nativo verificado + cara HTML lista). Revisa Audit en el paso 2.');
    } catch (e) {
      alert('No se pudo aplicar la plantilla: ' + e.message);
    }
  });
}

const faceBtn = document.getElementById('faceBtn');
if (faceBtn) {
  faceBtn.addEventListener('click', async () => {
    if (window._lastTemplateFace) {
      const ta = document.querySelector('[name="htmlCode"]');
      const htmlToggle = document.querySelector('.toggle-btn[data-input="html"]');
      if (htmlToggle) htmlToggle.click();
      if (ta) ta.value = window._lastTemplateFace;
      return;
    }
    const v = templateSelect ? templateSelect.value : '';
    if (!v) return alert('Elige primero una plantilla arriba.');
    try {
      const r = await fetch('/api/templates/' + encodeURIComponent(v));
      const t = await r.json();
      if (!r.ok || !t.faceHtml) throw new Error('Sin cara disponible');
      window._lastTemplateFace = t.faceHtml;
      const htmlToggle = document.querySelector('.toggle-btn[data-input="html"]');
      if (htmlToggle) htmlToggle.click();
      document.querySelector('[name="htmlCode"]').value = t.faceHtml;
    } catch (e) { alert(e.message); }
  });
}

const modeToggle = document.getElementById('modeToggle');
if (modeToggle) {
  modeToggle.addEventListener('click', () => {
    isAdvanced = !isAdvanced;
    modeToggle.textContent = isAdvanced ? 'Modo estándar' : 'Modo avanzado';
    document.querySelectorAll('.advanced').forEach((el) => el.classList.toggle('hidden', !isAdvanced));
  });
}

const appNameInput = document.getElementById('appNameInput');
const urlInput = document.querySelector('[name="url"]');

function updatePreview() {
  const name = appNameInput && appNameInput.value ? appNameInput.value : 'Mi Aplicación';
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

const templateZipBtn = document.getElementById('templateZipBtn');
if (templateZipBtn) {
  templateZipBtn.addEventListener('click', async () => {
    const tpl = document.getElementById('templateSelect') ? document.getElementById('templateSelect').value : '';
    if (!tpl) return alert('Elige primero una plantilla arriba (ej. Radio).');
    templateZipBtn.textContent = 'Generando ZIP…';
    templateZipBtn.disabled = true;
    try {
      const cfg = collect();
      cfg.template = tpl;
      const res = await fetch('/api/project', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cfg) });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'No se pudo generar el ZIP'); }
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'inteebuild-plantilla-' + tpl + '.zip';
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) { alert(e.message); }
    templateZipBtn.innerHTML = '📦 Ver código (ZIP) de la plantilla';
    templateZipBtn.disabled = false;
  });
}

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
  previewTheme.textContent = isDark ? 'Claro' : 'Oscuro';
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
  const activeToggle = document.querySelector('.toggle-btn.active');
  const mode = activeToggle ? activeToggle.dataset.input : 'url';
  if (ppIframe.classList.contains('hidden')) {
    if (mode === 'html') {
      const code = document.querySelector('[name="htmlCode"]') ? document.querySelector('[name="htmlCode"]').value : '';
      if (!code.trim()) return alert('Pega tu código HTML o importa un archivo primero');
      const frame = document.createElement('iframe');
      frame.setAttribute('sandbox', 'allow-scripts');
      frame.srcdoc = code;
      ppIframe.innerHTML = '';
      ppIframe.appendChild(frame);
    } else {
      const url = urlInput ? urlInput.value.trim() : '';
      if (!url) return alert('Por favor ingresa una URL válida primero');
      ppIframe.innerHTML = `<iframe src="${url}" sandbox="allow-scripts allow-same-origin"></iframe>`;
    }
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
    if (!url) return alert('Ingresa una URL web');
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
      document.getElementById('analyzeSubDiag').textContent = `Código de estado: ${j.status} | Recursos Http Inseguros: ${j.insecureCount || 0}`;

      const grid = document.getElementById('analyzeGrid');
      const checkNames = {
        https: 'Conexión HTTPS Segura', reachable: 'Acceso a Servidor Web', viewport: 'Diseño Responsive (Viewport)',
        manifest: 'Manifiesto Web (Manifest.json)', favicon: 'Icono / Favicon', themeColor: 'Color de Tema (Theme Color)',
        serviceWorker: 'Service Worker Registrado', insecureResources: 'Recursos 100% Incriptados', htmlErrors: 'Sintaxis HTML Válida'
      };
      grid.innerHTML = Object.entries(j.checks)
        .filter(([k]) => checkNames[k])
        .map(([k, v]) => `<div class="analyze-check ${v ? 'ok' : 'fail'}"><span>${v ? '✓' : '✕'}</span> ${checkNames[k]}</div>`)
        .join('');

      const fwBox = document.getElementById('analyzeFramework');
      if (j.frameworks && j.frameworks.length) {
        fwBox.classList.remove('hidden');
        fwBox.innerHTML = '<span style="font-size:11px;color:var(--muted)">Tecnología detectada:</span> ' +
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
          .map((rec) => `<div class="autopilot-item">Uso detectado de <b>${rec.api}</b> → Sugerencia: <b>${rec.label}</b></div>`)
          .join('');
      } else {
        autoBox.classList.add('hidden');
      }

      // Security box
      const secBox=document.getElementById('securityBox');
      const secScore=document.getElementById('secScore');
      const secIssues=document.getElementById('secIssues');
      if(secBox && j.security){
        secBox.classList.remove('hidden');
        secScore.textContent=j.security.score+'/100 '+j.security.level;
        secScore.style.background=j.security.score>=80?'var(--success)':j.security.score>=50?'var(--warn)':'var(--danger)';
        secIssues.innerHTML=j.security.issues.length ? j.security.issues.map(i=>`<div style="display:flex;gap:6px"><span style="color:${i.severity==='critical'?'var(--danger)':i.severity==='high'?'var(--danger)':i.severity==='medium'?'var(--warn)':'var(--muted)'}">●</span><span><b>${i.msg}</b> — <small style="color:var(--muted)">${i.fix}</small></span></div>`).join('') : '<span style="color:var(--success)">Sin problemas críticos</span>';
      }
      const errBox=document.getElementById('errorsBox');
      const errList=document.getElementById('errorsList');
      if(errBox && j.errors){
        errBox.classList.remove('hidden');
        const all=[...j.errors.errors.map(e=>`<span style="color:var(--danger)">✕ ${e.msg} → ${e.fix}</span>`), ...j.errors.warnings.map(w=>`<span style="color:var(--warn)">⚠ ${w.msg} → ${w.fix}</span>`)];
        errList.innerHTML = all.length? all.join('<br>') : '<span style="color:var(--success)">Sin errores detectados</span>';
      }
      const optBox=document.getElementById('optBox');
      const optTips=document.getElementById('optTips');
      const optScore=document.getElementById('optScore');
      if(optBox && j.optimization){
        optBox.classList.remove('hidden');
        optScore.textContent=j.optimization.grade+' ('+j.optimization.score+'/100) - '+j.optimization.sizeKB+'KB, '+j.optimization.images+' imgs';
        optTips.innerHTML=j.optimization.tips.map(t=>`<div>• ${t.msg} <small style="color:var(--muted)">→ ${t.fix}</small> <span style="font-size:10px;padding:1px 5px;border-radius:999px;background:${t.impact==='high'?'var(--danger-soft)':t.impact==='medium'?'var(--warn-soft)':'var(--accent-soft)'}">${t.impact}</span></div>`).join('');
        // store fixed html for apply
        optBox.dataset.fixed=j.autoFix && j.autoFix.preview ? j.autoFix.preview : '';
        window._lastFixedHtml=j.autoFix && j.autoFix.preview ? j.autoFix.preview : null;
        if(j.autoFix && j.autoFix.available) document.getElementById('applyFixBtn').style.display='';
        else document.getElementById('applyFixBtn').style.display='none';
      }
    } catch (e) {
      alert(e.message);
    }
    analyzeBtn.textContent = 'Analizar salud web';
    analyzeBtn.disabled = false;
  });
}
const applyFixBtn=document.getElementById('applyFixBtn');
if(applyFixBtn){
  applyFixBtn.addEventListener('click',()=>{
    const html=window._lastFixedHtml;
    if(!html) return alert('No hay fix disponible. Analiza una URL primero.');
    // switch to HTML mode and inject
    const htmlToggle=document.querySelector('.toggle-btn[data-input="html"]');
    if(htmlToggle) htmlToggle.click();
    const ta=document.querySelector('[name="htmlCode"]');
    if(ta){ ta.value=html; alert('HTML optimizado aplicado en el editor. Revisa el paso 1.'); }
  });
}

// Permission Engine
const runAuditBtn=document.getElementById('runAuditBtn');
const autoSuggestBtn=document.getElementById('autoSuggestBtn');
const auditBox=document.getElementById('auditBox');
const readinessBox=document.getElementById('buildReadinessBox');
async function runAudit(){
  if(!auditBox) return;
  auditBox.innerHTML='<small style="color:var(--muted)">🛡️ Auditando permisos...</small>';
  try{
    const cfg=collect();
    const r=await fetch('/api/permissions/audit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(cfg)});
    const j=await r.json();
    if(!r.ok) throw new Error(j.error || 'Audit falló');
    const items=j.items.map(i=>{
      const icon=i.status==='ok'?'✓':i.status==='warn'?'⚠':'✕';
      const manOk=(i.manifest||'').startsWith('GENERATED');
      const runOk=(i.runtime||'').startsWith('GENERATED');
      const natOk=(i.native||'').startsWith('GENERATED');
      return `<div class="audit-item ${i.status}"><span class="audit-ico">${icon}</span><div class="audit-main"><b>${escHtml(i.title)}</b> <small>(${escHtml(i.key)})</small> ${i.verified?'<small style="color:var(--success)">· verificado en APK</small>':'<small style="color:var(--danger)">· NO generado</small>'}<div class="audit-meta"><span class="audit-chip ${manOk?'ok':'fail'}">Manifest ${escHtml(i.manifest)}</span><span class="audit-chip ${runOk?'ok':(i.runtime||'').startsWith('N/A')?'warn':'fail'}">Runtime ${escHtml((i.runtime||'').slice(0,70))}</span><span class="audit-chip ${natOk?'ok':'fail'}">Native ${escHtml((i.native||i.handler||'').slice(0,80))}</span><span class="audit-chip">Bridge ${escHtml((i.bridge||'').slice(0,50))}</span>${i.version!=='OK'?`<span class="audit-chip warn">${escHtml(i.version)} · minSdk ${i.minSdk}</span>`:''}${i.special?`<span class="audit-chip warn">⚠ ${escHtml((i.special||'').slice(0,90))}</span>`:''}${i.provider&&i.provider.startsWith('WARN')?`<span class="audit-chip warn">${escHtml(i.provider)}</span>`:''}</div></div><span class="audit-badge ${i.status}">${i.status}</span></div>`;
    }).join('');
    auditBox.innerHTML = j.total? items + `<div class="audit-summary ${j.canBuild?'good':'bad'}"><b>${j.ok}/${j.total} OK</b> · Readiness ${j.readiness}% ${j.canBuild?'· ✓ Listo para compilar':'· ✕ Bloqueado: revisa permisos'}</div>` : '<small style="color:var(--muted)">Selecciona al menos un permiso para auditar. Sin permisos el APK solo usa INTERNET.</small>';
    if(readinessBox){
      const br=await fetch('/api/build-readiness',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(collect())}).then(rr=>rr.json());
      const barColor=br.readiness>=90?'linear-gradient(90deg,var(--success),#34d399)':br.readiness>=70?'linear-gradient(90deg,var(--warn),#fbbf24)':'linear-gradient(90deg,var(--danger),#f87171)';
      readinessBox.innerHTML=`<div class="readiness-card"><div class="readiness-top"><span>BUILD READINESS</span><span class="readiness-pct">${br.readiness}%</span></div><div class="readiness-bar"><div class="readiness-fill" style="width:${br.readiness}%;background:${barColor}"></div></div><small style="color:var(--muted)">${escHtml(br.message||'')}</small>${(br.warnings||[]).length?'<div style="margin-top:6px;font-size:11px;color:var(--warn)">⚠ '+br.warnings.map(w=>escHtml(w)).join('<br>⚠ ')+'</div>':''}<div class="readiness-checks">${Object.entries(br.checks||{}).map(([k,v])=>`<span class="readiness-check ${v?'yes':'no'}">${v?'✓':'✕'} ${escHtml(k)}</span>`).join('')}</div></div>`;
      const buildBtnEl=document.getElementById('buildBtn');
      if(buildBtnEl) {
        buildBtnEl.disabled=false;
        buildBtnEl.title=br.canBuild?'Listo para compilar':'Audit con observaciones: al compilar se te dirá qué corregir';
        buildBtnEl.style.opacity=br.canBuild?'1':'.75';
      }
    }
  }catch(e){ auditBox.innerHTML='<span style="color:var(--danger)">'+escHtml(e.message)+'</span>'; }
}
if(runAuditBtn) runAuditBtn.addEventListener('click', runAudit);
if(autoSuggestBtn) autoSuggestBtn.addEventListener('click', async()=>{
  const mode=document.querySelector('input[name="permMode"]:checked')?.value||'manual';
  let html=''; let url='';
  const active=document.querySelector('.toggle-btn.active')?.dataset.input;
  if(active==='html') html=document.querySelector('[name="htmlCode"]')?.value||'';
  else url=document.querySelector('[name="url"]')?.value||'';
  if(!html && !url) return alert('Pon URL o HTML para sugerir');
  const r=await fetch('/api/permissions/suggest',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({html,url})});
  const j=await r.json();
  if(!j.suggested.length) return alert('No se detectaron APIs que requieran permisos');
  const msg=j.suggested.map(s=>`${s.spec.title} (${s.key})`).join(', ');
  if(mode==='manual'){
    if(auditBox) auditBox.innerHTML='<div class="suggest-banner">Sugerido por Web API: <b>'+escHtml(msg)+'</b><br><small>Actívalo manualmente si lo necesitas. Detección ≠ uso real.</small></div>'+auditBox.innerHTML;
  } else if(mode==='recommended'){
    if(confirm('Sugerido: '+msg+'\n¿Activar automáticamente?')){
      j.suggested.forEach(s=>{ const el=document.querySelector(`[name="${s.key}"]`); if(el){ el.checked=true; const tile=el.closest('.perm-tile, .switch'); if(tile) tile.classList.add('checked'); } });
      if(auditBox) auditBox.innerHTML='<div class="suggest-banner good">✓ Activados: '+escHtml(msg)+'</div>';
      runAudit();
    }
  } else if(mode==='auto'){
    document.querySelectorAll('#permEasy input[type="checkbox"], #permAdvanced input[type="checkbox"]').forEach(el=>{ el.checked=false; const t=el.closest('.perm-tile'); if(t) t.classList.remove('checked'); });
    j.suggested.forEach(s=>{ const el=document.querySelector(`[name="${s.key}"]`); if(el){ el.checked=true; const t=el.closest('.perm-tile'); if(t) t.classList.add('checked'); } });
    if(auditBox) auditBox.innerHTML='<div class="suggest-banner good">🤖 Auto: '+escHtml(msg)+' — solo lo detectado, sin extras.</div>';
    runAudit();
  }
});
document.querySelectorAll('input[name="permMode"]').forEach(r=> r.addEventListener('change', e=>{
  if(e.target.value==='auto' || e.target.value==='recommended'){
    // trigger suggest automatically when mode changes to auto/recommended
    if(document.querySelector('[name="url"]')?.value || document.querySelector('[name="htmlCode"]')?.value) autoSuggestBtn.click();
  }
}));

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

    alert('Configuración sugerida aplicada exitosamente');
  });
}

const toggleConsole = document.getElementById('toggleConsole');
const buildConsole = document.getElementById('buildConsole');
if (toggleConsole && buildConsole) {
  toggleConsole.addEventListener('click', () => {
    buildConsole.classList.toggle('hidden');
    toggleConsole.textContent = buildConsole.classList.contains('hidden') ? 'Ver registros en vivo' : 'Ocultar registros';
  });
}

function collect() {
  const data = {};
  document.querySelectorAll('input, select, textarea').forEach((el) => {
    if (!el.name) return;
    if (el.type === 'checkbox') {
      data[el.name] = el.checked;
    } else if (el.type === 'radio') {
      if (el.checked) data[el.name] = el.value;
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

  data.notifyDelayMinutes = Number(data.notifyDelayMinutes || 0);
  data.versionCode = Number(data.versionCode || 1);
  data.compileSdk = Number(data.compileSdk || 35);
  data.targetSdk = Number(data.targetSdk || 35);
  data.minSdk = Number(data.minSdk || 23);
  data.splashDuration = Number(data.splashDuration || 2000);
  data.adaptiveFgBase64 = adaptiveFgBase64 || undefined;
  data.deepLinkPaths = data.deepLinkPaths ? String(data.deepLinkPaths).split(',').map((s) => s.trim()).filter(Boolean) : [];
  // Catalogo: parse drawer/bottom JSON
  try{ data.drawerItems = data.drawerItems ? JSON.parse(String(data.drawerItems)) : []; if(!Array.isArray(data.drawerItems)) data.drawerItems=[]; }catch{ data.drawerItems=[]; }
  try{ data.bottomNavItems = data.bottomNavItems ? JSON.parse(String(data.bottomNavItems)) : []; if(!Array.isArray(data.bottomNavItems)) data.bottomNavItems=[]; }catch{ data.bottomNavItems=[]; }
  data.iapProducts = data.iapProducts ? String(data.iapProducts).split(',').map(s=>s.trim()).filter(Boolean) : [];

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

function runQAChecks() {
  const list = document.getElementById('qaList');
  const summary = document.getElementById('qaSummary');
  const terms = document.getElementById('qaTerms');
  const nextBtn = document.getElementById('qaNextBtn');
  if (!list) return;
  const cfg = collect();
  const items = [];
  if (cfg.inputType === 'url') {
    const url = String(cfg.url || '').trim();
    let okUrl = false, isHttps = false;
    try {
      const u = new URL(url);
      okUrl = u.protocol === 'http:' || u.protocol === 'https:';
      isHttps = u.protocol === 'https:';
    } catch (_) { okUrl = false; }
    items.push({ label: 'URL válida (http/https)', state: okUrl ? 'ok' : 'fail', detail: okUrl ? url : 'Revisa el paso 1' });
    items.push({ label: 'Conexión segura HTTPS', state: isHttps ? 'ok' : 'warn', detail: isHttps ? 'Cifrado activo' : 'HTTP permitido solo si activaste tráfico cleartext' });
  } else {
    const len = String(cfg.htmlCode || '').length;
    items.push({ label: 'Código HTML presente', state: len > 50 ? 'ok' : 'fail', detail: len > 50 ? len + ' caracteres' : 'Pega tu HTML en el paso 1' });
    items.push({ label: 'Tamaño dentro del límite (500 KB)', state: len < 500000 ? 'ok' : 'fail', detail: Math.round(len / 1024) + ' KB' });
  }
  const nameOk = String(cfg.appName || '').trim().length >= 2;
  items.push({ label: 'Nombre de la app', state: nameOk ? 'ok' : 'fail', detail: nameOk ? cfg.appName : 'Falta en el paso 1' });
  const pkgOk = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(String(cfg.packageName || '').trim().toLowerCase()) || !String(cfg.packageName || '').trim();
  items.push({ label: 'Package ID válido', state: pkgOk ? 'ok' : 'fail', detail: cfg.packageName ? cfg.packageName : 'Se generará automáticamente' });
  items.push({ label: 'Icono personalizado', state: iconBase64 ? 'ok' : 'warn', detail: iconBase64 ? 'Icono listo' : 'Opcional: se usará el icono por defecto' });
  const perms = cfg.permissions || {};
  const permCount = Object.values(perms).filter(Boolean).length;
  items.push({ label: 'Permisos mínimos necesarios', state: permCount > 0 && permCount <= 8 ? 'ok' : 'warn', detail: permCount + ' activos' + (permCount > 8 ? ' (revisa políticas de Play Store)' : '') });
  items.push({ label: 'Firma y ofuscación', state: cfg.keystoreBase64 ? 'ok' : 'warn', detail: cfg.keystoreBase64 ? 'Release + ProGuard' : 'Debug (solo pruebas)' });
  const plat = (cfg.platform === 'ios' || cfg.platform === 'both') ? (cfg.iosP12Base64 && cfg.iosProfileBase64 ? 'ok' : 'warn') : 'ok';
  const platDetail = cfg.platform === 'android' ? 'Solo Android' : (cfg.iosP12Base64 && cfg.iosProfileBase64 ? 'IPA firmado' : 'iOS sin firma: solo validación en simulador');
  items.push({ label: 'Plataforma iOS', state: plat, detail: platDetail });
  items.push({ label: 'Sin secretos en el código', state: 'ok', detail: 'Token y keystore via entorno / rama temporal' });
  const fails = items.filter((i) => i.state === 'fail').length;
  list.innerHTML = items.map((i) =>
    '<div class="qa-item ' + i.state + '"><span class="qa-dot"></span><div><b>' + i.label + '</b><small>' + i.detail + '</small></div></div>'
  ).join('');
  if (summary) {
    summary.classList.remove('hidden');
    if (fails > 0) {
      summary.className = 'alert error';
      summary.style.marginTop = '12px';
      summary.textContent = 'Hay ' + fails + ' punto(s) en rojo. Corrige antes de compilar.';
    } else {
      summary.className = 'alert success';
      summary.style.marginTop = '12px';
      summary.textContent = 'Todo listo. Acepta los términos para ir a compilar.';
    }
  }
  const gate = () => { if (nextBtn) nextBtn.disabled = fails > 0 || !(terms && terms.checked); };
  if (terms && !terms.dataset.qaBound) {
    terms.dataset.qaBound = '1';
    terms.addEventListener('change', gate);
  }
  gate();
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
      throw new Error(err.error || 'No se pudo generar el proyecto nativo');
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
  // Pre-chequeo visible: si el readiness bloquea, explícalo en vez de fallar en silencio
  buildBtn.textContent = 'Verificando…';
  buildBtn.disabled = true;
  try {
    const chk = await fetch('/api/build-readiness', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(collect()) });
    const cj = await chk.json();
    if (chk.ok && cj.canBuild === false) {
      const why = (cj.warnings || []).join('\n• ');
      showError('No se puede compilar aún:\n• ' + (why || 'revisa el Audit en el paso 2 (Permisos → Ejecutar Audit).'));
      buildBtn.textContent = 'Compilar APK';
      buildBtn.disabled = false;
      return;
    }
  } catch (_) { /* si el chequeo falla, intenta compilar igual y muestra el error real */ }
  buildBtn.textContent = 'Compilar APK';
  buildBtn.disabled = false;
  buildReady.classList.add('hidden');
  buildProgress.classList.remove('hidden');
  buildResult.classList.add('hidden');
  resultError.classList.add('hidden');
  progressBar.style.width = '5%';
  buildStartTime = Date.now();

  for (let i = 0; i < 7; i++) setProgressStep(i, '');
  setProgressStep(0, 'active');
  if (buildConsole) { buildConsole.textContent = 'Iniciando proceso de compilación...\nGenerando manifiesto y archivos nativos...\n'; buildConsole.classList.remove('hidden'); }

  let id;
  try {
    const res = await fetch('/api/build', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(collect())
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'No se pudo iniciar el proceso de compilación');
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
          if (resultOutput) resultOutput.textContent = (s.outputType || 'apk').toUpperCase();
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
          aApk.textContent = 'Descargar APK';
          aApk.download = (s.appName || 'app') + '.apk.zip';
          resultActions.appendChild(aApk);

          if (s.artifacts && s.artifacts.some((a) => a.name.includes('aab'))) {
            const aAab = document.createElement('a');
            aAab.href = dlAab;
            aAab.className = 'btn ghost';
            aAab.textContent = 'Descargar AAB';
            aAab.download = (s.appName || 'app') + '.aab.zip';
            resultActions.appendChild(aAab);
          }
          if (s.artifacts && s.artifacts.some((a) => a.name.includes('ipa'))) {
            const aIpa = document.createElement('a');
            aIpa.href = '/api/download/' + id + '/ipa';
            aIpa.className = 'btn primary';
            aIpa.textContent = 'Descargar IPA (iOS)';
            resultActions.appendChild(aIpa);
          }
        }, 600);
      } else if (s.status === 'failed' || s.status === 'error') {
        clearInterval(timer);
        showError(s.error || 'La compilación ha fallado');
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
  goToStep(5);
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
    qrImgBox.innerHTML = `<img src="/api/qr/${activeBuildId}" alt="Código QR de Descarga" />`;
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
        <div class="apk-info-item"><div class="ai-label">TAMAÑO FINAL</div><div class="ai-value accent">${info.artifactSizeMB} MB</div></div>
        <div class="apk-info-item"><div class="ai-label">NOMBRE DE ARTIFACT</div><div class="ai-value" style="font-size:12px;font-weight:600">${info.artifactName}</div></div>
        <div class="apk-info-item"><div class="ai-label">FORMATO GENERADO</div><div class="ai-value">${info.outputType.toUpperCase()}</div></div>
        <div class="apk-info-item"><div class="ai-label">ESTADO DE BUILD</div><div class="ai-value" style="color:var(--success)">EXITOSO</div></div>
      `;
      apkInfoBox.classList.remove('hidden');
    } catch (e) {
      alert('No se pudo obtener información del paquete APK: ' + e.message);
    }
  });
}

// API Keys handlers
const createKeyBtn=document.getElementById('createKeyBtn');
const listKeysBtn=document.getElementById('listKeysBtn');
const apiKeysList=document.getElementById('apiKeysList');
if(createKeyBtn){
  createKeyBtn.addEventListener('click', async()=>{
    const name=document.getElementById('apiKeyName').value||'default';
    const r=await fetch('/api/keys',{method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name})});
    const j=await r.json();
    if(!r.ok) return alert(j.error);
    apiKeysList.innerHTML='<div style="padding:8px;background:var(--success-soft);border-radius:8px;border:1px solid rgba(16,185,129,.3);word-break:break-all"><b>Key generada:</b><br><code style="font-size:11px">'+j.key+'</code><br><small>Copia ahora, luego se muestra enmascarada. ID: '+j.id+'</small></div>'+apiKeysList.innerHTML;
  });
}
if(listKeysBtn){
  listKeysBtn.addEventListener('click', async()=>{
    const r=await fetch('/api/keys');
    const list=await r.json();
    if(!list.length) apiKeysList.innerHTML='<small>Sin keys. Genera una.</small>';
    else apiKeysList.innerHTML=list.map(k=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border)"><span><b>${escHtml(k.name)}</b> <code style="font-size:10px">${escHtml(k.keyMask)}</code> <small>usos:${k.uses||0}</small></span><button type="button" class="btn ghost sm" onclick="fetch('/api/keys/${k.id}',{method:'DELETE'}).then(()=>alert('Eliminada')).catch(()=>{})">Eliminar</button></div>`).join('');
  });
}
// Git handlers
const gitConnectBtn=document.getElementById('gitConnectBtn');
const gitListBtn=document.getElementById('gitListBtn');
const gitList=document.getElementById('gitList');
if(gitConnectBtn){
  gitConnectBtn.addEventListener('click', async()=>{
    const repo=document.getElementById('gitRepo').value.trim();
    const branch=document.getElementById('gitBranch').value.trim()||'main';
    if(!repo) return alert('Escribe usuario/repo');
    const r=await fetch('/api/git/connect',{method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({repo,branch})});
    const j=await r.json();
    if(!r.ok) return alert(j.error);
    alert('Conectado: '+j.repo+'#'+j.branch);
    if(gitListBtn) gitListBtn.click();
  });
}
if(gitListBtn){
  gitListBtn.addEventListener('click', async()=>{
    const r=await fetch('/api/git/integrations');
    const list=await r.json();
    if(!list.length) gitList.innerHTML='<small>Sin integraciones</small>';
    else gitList.innerHTML=list.map(g=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border)"><span><b>${escHtml(g.repo)}</b>#${escHtml(g.branch)} <small>${new Date(g.createdAt).toLocaleString()}</small></span><button type="button" class="btn ghost sm" onclick="fetch('/api/git/${g.id}',{method:'DELETE'}).then(()=>location.reload())">Quitar</button></div>`).join('');
  });
}
// Decompiler
const apkInput=document.getElementById('apkInput');
const decompileBtn=document.getElementById('decompileBtn');
const decompileOut=document.getElementById('decompileOut');
let apkBase64=null;
if(apkInput){
  apkInput.addEventListener('change',()=>{
    const f=apkInput.files&&apkInput.files[0];
    if(!f) return;
    const reader=new FileReader();
    reader.onload=()=>{ apkBase64=reader.result; decompileOut.textContent='APK cargado: '+f.name+' ('+Math.round(f.size/1024)+'KB) listo para descompilar.'; };
    reader.readAsDataURL(f);
  });
}
if(decompileBtn){
  decompileBtn.addEventListener('click', async()=>{
    if(!apkBase64) return alert('Selecciona un APK primero');
    decompileBtn.textContent='Descompilando...'; decompileBtn.disabled=true;
    try{
      const r=await fetch('/api/decompile',{method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({apkBase64})});
      const j=await r.json();
      if(!r.ok) throw new Error(j.error);
      decompileOut.innerHTML='<div class="decompile-result">'
        +'<div class="decompile-row"><b>Package</b><span>'+escHtml(j.meta.packageName)+'</span></div>'
        +'<div class="decompile-row"><b>App</b><span>'+escHtml(j.meta.appName)+'</span></div>'
        +'<div class="decompile-row"><b>Versión</b><span>'+escHtml(j.meta.versionName||'1.0.0')+' '+(j.meta.versionCode?'('+escHtml(j.meta.versionCode)+')':'')+'</span></div>'
        +'<div class="decompile-row"><b>Permisos</b><span>'+escHtml((j.meta.permissions||[]).join(', ')||'ninguno')+'</span></div>'
        +'<div class="decompile-row"><b>Archivos</b><span>'+j.meta.fileCount+' ('+j.meta.sizeKB+'KB) '+ (j.meta.hasIcon?'· 🎨 icono':'') + (j.meta.hasDex?'· ⚙️ dex':'')+'</span></div>'
        +'<div style="margin-top:8px"><b style="font-size:12px">📦 Código fuente recuperado</b><pre class="code" style="margin-top:6px;max-height:160px;overflow:auto">'+escHtml(JSON.stringify(j.importConfig,null,2))+'</pre></div>'
        +'<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap"><button type="button" class="btn primary sm" id="importDecompiled">📥 Importar como proyecto</button>' + (j.sourceZipBase64 ? '<a class="btn ghost sm" href="data:application/zip;base64,'+j.sourceZipBase64+'" download="inteebuild-source-'+escHtml(j.meta.packageName||'app')+'.zip">📦 Descargar ZIP fuente ('+j.sourceZipSizeKB+'KB)</a>' : '') + '</div>'
        +'<div style="margin-top:8px;font-size:11px;color:var(--muted)">'+escHtml(j.note)+'</div>'
        + (j.manifestPreview ? '<details style="margin-top:8px"><summary style="font-size:11px;cursor:pointer;color:var(--accent)">Manifest preview</summary><pre class="code" style="margin-top:6px;max-height:200px;overflow:auto">'+escHtml((j.manifestPreview||'').slice(0,3000))+'</pre></details>' : '')
        +'</div>';
      setTimeout(()=>{
        const imp=document.getElementById('importDecompiled');
        if(imp) imp.addEventListener('click',()=>{
          const c=j.importConfig;
          if(c.appName) setField('appName', c.appName);
          if(c.packageName) setField('packageName', c.packageName);
          if(c.url) setField('url', c.url);
          if(c.permissions) Object.entries(c.permissions).forEach(([k,v])=> setField(k, !!v));
          alert('Config importada. Revisa el paso 1 y compila.');
          goToStep(0);
        });
      },100);
    }catch(e){ decompileOut.textContent='Error: '+e.message; }
    decompileBtn.textContent='Descompilar'; decompileBtn.disabled=false;
  });
}

let historyCache = [];

function renderHistory() {
  const q = (document.getElementById('histSearch') && document.getElementById('histSearch').value || '').toLowerCase();
  const st = (document.getElementById('histStatus') && document.getElementById('histStatus').value) || '';
  const items = historyCache.filter((h) => {
    if (st && h.status !== st) return false;
    if (q && !((h.appName || '').toLowerCase().includes(q) || (h.id || '').toLowerCase().includes(q))) return false;
    return true;
  });
  if (!items.length) {
    historyList.innerHTML = '<div class="hempty">' + (historyCache.length ? 'Sin resultados para este filtro.' : 'No se registran compilaciones previas.') + '</div>';
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
      buttons.push('<button type="button" class="btn ghost sm" data-dup="' + h.id + '">Duplicar</button>');
      buttons.push('<button type="button" class="btn ghost sm" data-exp="' + h.id + '">JSON</button>');
      buttons.push('<button type="button" class="btn ghost sm" data-del="' + h.id + '">Eliminar</button>');
      return (
        '<div class="hitem">' +
        '<div class="hitem-left">' +
        '<div class="hitem-name">' + escHtml(h.appName || 'Aplicación') + '</div>' +
        '<div class="hitem-meta">' +
        '<span class="hitem-status ' + statusClass + '">' + statusText + '</span>' +
        '<span>' + timeAgo(h.createdAt) + '</span>' +
        '<span>ID: ' + escHtml(h.id) + '</span>' +
        '</div>' +
        '</div>' +
        '<div class="hitem-right">' + buttons.join('') + '</div>' +
        '</div>'
      );
    })
    .join('');
}

function setField(name, val) {
  const el = document.querySelector(`[name="${name}"]`);
  if (!el) return;
  if (el.type === 'checkbox') {
    el.checked = !!val;
    const tile = el.closest('.perm-tile, .plugin-card');
    if (tile) tile.classList.toggle('checked', !!val);
  } else {
    el.value = val == null ? '' : val;
  }
}

async function duplicateBuild(id) {
  try {
    const res = await fetch('/api/history/' + id);
    const h = await res.json();
    if (!res.ok) throw new Error(h.error || 'No se pudo cargar');
    const c = h.config || {};
    if (c.inputType === 'html') {
      document.querySelector('.toggle-btn[data-input="html"]').click();
      setField('htmlCode', c.htmlCode || '');
    } else {
      document.querySelector('.toggle-btn[data-input="url"]').click();
      setField('url', c.url || '');
    }
    ['appName', 'packageName', 'versionName', 'versionCode', 'orientation', 'outputType',
     'compileSdk', 'targetSdk', 'minSdk', 'splashColor', 'splashDuration', 'accentColor',
     'statusBarColor', 'navigationBarColor', 'notifChannel', 'notifImportance'].forEach((k) => {
      if (c[k] !== undefined) setField(k, c[k]);
    });
    ['fullscreen', 'edgeToEdge', 'keepScreenOn', 'useCleartext', 'splashEnabled',
     'notifSound', 'notifVibration', 'adaptiveIconEnabled'].forEach((k) => {
      if (c[k] !== undefined) setField(k, !!c[k]);
    });
    Object.entries(c.permissions || {}).forEach(([k, v]) => setField(k, !!v));
    Object.entries(c.plugins || {}).forEach(([k, v]) => setField('plugin_' + k, !!v));
    if (typeof updatePreview === 'function') updatePreview();
    goToStep(0);
  } catch (err) {
    alert('No se pudo duplicar: ' + err.message);
  }
}

function exportConfig(id) {
  const h = historyCache.find((x) => x.id === id);
  if (!h || !h.config) { alert('Esta compilación no tiene configuración guardada.'); return; }
  const blob = new Blob([JSON.stringify(h.config, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'inteebuild-config-' + id + '.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

async function deleteHistoryItem(id) {
  if (!confirm('Eliminar esta compilación del historial?')) return;
  try {
    const res = await fetch('/api/history/' + id, { method: 'DELETE' });
    if (!res.ok) throw new Error('No se pudo eliminar');
    historyCache = historyCache.filter((x) => x.id !== id);
    renderHistory();
    loadStats();
  } catch (err) {
    alert(err.message);
  }
}

async function loadHistory() {
  try {
    const res = await fetch('/api/history');
    historyCache = await res.json();
    renderHistory();
  } catch (_) {
    historyList.innerHTML = '<div class="hempty">Error al obtener el historial.</div>';
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
    set('statLandTotal', s.total);
    set('statLandOk', s.ok);
    set('statLandAvg', s.avgSec ? Math.floor(s.avgSec / 60) + 'm ' + (s.avgSec % 60) + 's' : '—');
  } catch (_) {}
}

if (historyList) {
  historyList.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-dup], button[data-exp], button[data-del]');
    if (!btn) return;
    if (btn.dataset.dup) duplicateBuild(btn.dataset.dup);
    else if (btn.dataset.exp) exportConfig(btn.dataset.exp);
    else if (btn.dataset.del) deleteHistoryItem(btn.dataset.del);
  });
}
const histSearch = document.getElementById('histSearch');
if (histSearch) histSearch.addEventListener('input', renderHistory);
const histStatus = document.getElementById('histStatus');
if (histStatus) histStatus.addEventListener('change', renderHistory);

const EXAMPLE_HTML = '<!DOCTYPE html>\n<html lang="es">\n<head>\n<meta charset="UTF-8" />\n<meta name="viewport" content="width=device-width, initial-scale=1.0" />\n<title>Mi App</title>\n<style>\nbody { font-family: sans-serif; text-align: center; padding: 40px 20px; }\nh1 { color: #4f46e5; }\n</style>\n</head>\n<body>\n<h1>Hola desde mi app</h1>\n<p>Edita este HTML y compilalo como APK.</p>\n</body>\n</html>';
const exampleHtmlBtn = document.getElementById('exampleHtmlBtn');
if (exampleHtmlBtn) {
  exampleHtmlBtn.addEventListener('click', () => {
    document.querySelector('.toggle-btn[data-input="html"]').click();
    setField('htmlCode', EXAMPLE_HTML);
    setField('appName', 'Mi App Ejemplo');
  });
}
const htmlFileInput = document.getElementById('htmlFileInput');
if (htmlFileInput) {
  htmlFileInput.addEventListener('change', () => {
    const file = htmlFileInput.files && htmlFileInput.files[0];
    if (!file) return;
    if (file.size > 500 * 1024) { alert('El archivo supera 500 KB.'); htmlFileInput.value = ''; return; }
    const reader = new FileReader();
    reader.onload = () => {
      setField('htmlCode', String(reader.result || ''));
      if (!document.querySelector('[name="appName"]').value) {
        setField('appName', file.name.replace(/\.(html?|txt)$/i, '').replace(/[_-]+/g, ' ').trim() || 'Mi App');
      }
      if (typeof updatePreview === 'function') updatePreview();
    };
    reader.readAsText(file);
  });
}

const PRESETS = {
  foto: ['cameraMic', 'storage'],
  ubicacion: ['gps'],
  audio: ['microphone', 'storage']
};
document.querySelectorAll('[data-preset]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const p = btn.dataset.preset;
    if (p === 'limpiar') {
      document.querySelectorAll('#permEasy input[type="checkbox"], #permAdvanced input[type="checkbox"]').forEach((el) => {
        el.checked = false;
        const tile = el.closest('.perm-tile');
        if (tile) tile.classList.remove('checked');
      });
      return;
    }
    (PRESETS[p] || []).forEach((name) => setField(name, true));
  });
});

loadStats();

function showError(msg) {
  buildProgress.classList.add('hidden');
  resultError.textContent = msg;
  resultError.classList.remove('hidden');
  buildReady.classList.remove('hidden');
}
