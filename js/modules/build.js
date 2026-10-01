'use strict';

const Build = (() => {
  const buildReady = $('#buildReady');
  const buildProgress = $('#buildProgress');
  const buildResult = $('#buildResult');
  const progressBar = $('#progressBar');
  const resultError = $('#resultError');
  const resultAppName = $('#resultAppName');
  const resultId = $('#resultId');
  const resultTime = $('#resultTime');
  const resultOutput = $('#resultOutput');
  const resultActions = $('#resultActions');
  const buildConsole = $('#buildConsole');
  const historyList = $('#historyList');

  let buildStartTime = null;
  let historyCache = [];

  const showError = (msg) => {
    hide(buildProgress);
    resultError.textContent = msg;
    show(resultError);
    show(buildReady);
  };

  const setProgressStep = (idx, status) => {
    const el = $('#ps' + idx);
    if (!el) return;
    el.classList.remove('active', 'done');
    if (status === 'active') el.classList.add('active');
    if (status === 'done') el.classList.add('done');
  };

  const runQAChecks = () => {
    const list = $('#qaList');
    const summary = $('#qaSummary');
    const terms = $('#qaTerms');
    const nextBtn = $('#qaNextBtn');
    if (!list) return;
    const cfg = Form.collect();
    const items = [];

    if (cfg.inputType === 'url') {
      const url = String(cfg.url || '').trim();
      let okUrl = false;
      let isHttps = false;
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
    items.push({ label: 'Icono personalizado', state: state.iconBase64 ? 'ok' : 'warn', detail: state.iconBase64 ? 'Icono listo' : 'Opcional: se usará el icono por defecto' });

    const perms = cfg.permissions || {};
    const permCount = Object.values(perms).filter(Boolean).length;
    items.push({
      label: 'Permisos mínimos necesarios',
      state: permCount > 0 && permCount <= 8 ? 'ok' : 'warn',
      detail: permCount + ' activos' + (permCount > 8 ? ' (revisa políticas de Play Store)' : '')
    });
    items.push({
      label: 'Firma y ofuscación',
      state: cfg.keystoreBase64 ? 'ok' : 'warn',
      detail: cfg.keystoreBase64 ? 'Release + ProGuard' : 'Debug (solo pruebas)'
    });

    const plat = (cfg.platform === 'ios' || cfg.platform === 'both') ? (cfg.iosP12Base64 && cfg.iosProfileBase64 ? 'ok' : 'warn') : 'ok';
    const platDetail = cfg.platform === 'android'
      ? 'Solo Android'
      : (cfg.iosP12Base64 && cfg.iosProfileBase64 ? 'IPA firmado' : 'iOS sin firma: solo validación en simulador');
    items.push({ label: 'Plataforma iOS', state: plat, detail: platDetail });
    items.push({ label: 'Sin secretos en el código', state: 'ok', detail: 'Token y keystore via entorno / rama temporal' });

    const fails = items.filter((i) => i.state === 'fail').length;
    list.innerHTML = items.map((i) =>
      '<div class="qa-item ' + i.state + '"><span class="qa-dot"></span><div><b>' + i.label + '</b><small>' + i.detail + '</small></div></div>'
    ).join('');

    if (summary) {
      summary.classList.remove('hidden');
      summary.style.marginTop = '12px';
      if (fails > 0) {
        summary.className = 'alert error';
        summary.textContent = 'Hay ' + fails + ' punto(s) en rojo. Corrige antes de compilar.';
      } else {
        summary.className = 'alert success';
        summary.textContent = 'Todo listo. Acepta los términos para ir a compilar.';
      }
    }

    const gate = () => {
      if (nextBtn) nextBtn.disabled = fails > 0 || !(terms && terms.checked);
    };
    if (terms && !terms.dataset.qaBound) {
      terms.dataset.qaBound = '1';
      terms.addEventListener('change', gate);
    }
    gate();
  };

  const downloadZip = async (cfg) => {
    try {
      const res = await fetch('/api/project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfg || Form.collect())
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'No se pudo generar el proyecto nativo');
      }
      saveBlob(await res.blob(), 'inteebuild-proyecto.zip');
    } catch (err) {
      alert(err.message);
    }
  };

  on('#zipBtn', 'click', () => downloadZip());
  on('#downloadZipBtn', 'click', () => downloadZip());

  on('#toggleConsole', 'click', (e) => {
    buildConsole.classList.toggle('hidden');
    e.currentTarget.textContent = buildConsole.classList.contains('hidden') ? 'Ver registros en vivo' : 'Ocultar registros';
  });


  const artifactLink = ({ href, className, label, download }) => {
    const a = document.createElement('a');
    a.href = href;
    a.className = className;
    a.textContent = label;
    if (download) a.download = download;
    return a;
  };



  const FORMATS = [
    ['apk', 'APK'],
    ['aab', 'AAB'],
    ['ipa', 'IPA (iOS)'],
    ['xapk', 'XAPK'],
    ['apks', 'APKS'],
    ['exe', 'EXE (Windows)'],
    ['dmg', 'DMG (macOS)'],
    ['appimage', 'AppImage (Linux)'],
    ['msi', 'MSI (Windows)']
  ];
  const FORMAT_LABELS = Object.fromEntries(FORMATS);




  const resolveFormats = (s) => {
    const known = FORMATS.map(([fmt]) => fmt);
    const pick = (list) => (Array.isArray(list)
      ? list.map((f) => String(f).toLowerCase()).filter((f) => known.includes(f))
      : []);
    const fromFormats = pick(s.formats);
    if (fromFormats.length) return fromFormats;
    if (Array.isArray(s.artifacts) && s.artifacts.length) {
      const names = s.artifacts.map((a) => String(a.name || '').toLowerCase());
      const found = known.filter((fmt) => names.some((n) => n === fmt || n.endsWith('-' + fmt)));
      if (found.length) return found;
    }
    const fromOutputs = pick(s.outputs);
    if (fromOutputs.length) return fromOutputs;
    return ['apk'].concat(s.outputType === 'aab' || s.outputType === 'both' ? ['aab'] : []);
  };

  const PROGRESS_MARKERS = [
    ['Sincronizando', 1, 2, '30%'],
    ['Subiendo', 2, 3, '45%'],
    ['Lanzando', 3, 4, '60%'],
    ['Compilando', 4, 5, '80%']
  ];

  const buildBtn = on('#buildBtn', 'click', async () => {

    buildBtn.textContent = 'Verificando…';
    buildBtn.disabled = true;
    try {
      const chk = await fetch('/api/build-readiness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Form.collect())
      });
      const cj = await chk.json();
      if (chk.ok && cj.canBuild === false) {
        const why = (cj.warnings || []).join('\n• ');
        showError('No se puede compilar aún:\n• ' + (why || 'revisa el Audit en el paso 2 (Permisos → Ejecutar Audit).'));
        buildBtn.textContent = 'Compilar APK';
        buildBtn.disabled = false;
        return;
      }
    } catch (_) {   }

    buildBtn.textContent = 'Compilar APK';
    buildBtn.disabled = false;
    hide(buildReady);
    show(buildProgress);
    hide(buildResult);
    hide(resultError);
    progressBar.style.width = '5%';
    buildStartTime = Date.now();

    for (let i = 0; i < 7; i++) setProgressStep(i, '');
    setProgressStep(0, 'active');
    if (buildConsole) {
      buildConsole.textContent = 'Iniciando proceso de compilación...\nGenerando manifiesto y archivos nativos...\n';
      show(buildConsole);
    }

    let id;
    try {
      const res = await fetch('/api/build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Form.collect())
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo iniciar el proceso de compilación');
      id = data.id;
      state.activeBuildId = id;
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

        const marker = PROGRESS_MARKERS.find(([label]) => s.step && s.step.includes(label));
        if (marker) {
          setProgressStep(marker[1], 'done');
          setProgressStep(marker[2], 'active');
          progressBar.style.width = marker[3];
        }

        if (s.status === 'success') {
          clearInterval(timer);
          setProgressStep(5, 'done');
          setProgressStep(6, 'done');
          progressBar.style.width = '100%';


          setTimeout(() => {
            hide(buildProgress);
            show(buildResult);
            resultAppName.textContent = s.appName || '';
            resultId.textContent = id;
            const elapsed = Math.round((Date.now() - buildStartTime) / 1000);
            const min = Math.floor(elapsed / 60);
            const sec = elapsed % 60;
            resultTime.textContent = min > 0 ? min + 'm ' + sec + 's' : sec + 's';

            resultActions.innerHTML = '';
            const formats = resolveFormats(s);
            if (resultOutput) resultOutput.textContent = formats.map((f) => f.toUpperCase()).join(' · ');
            formats.forEach((fmt) => {
              resultActions.appendChild(artifactLink({
                href: '/api/download/' + id + (fmt === 'apk' ? '' : '/' + fmt),
                className: fmt === 'apk' ? 'btn primary' : 'btn ghost',
                label: 'Descargar ' + FORMAT_LABELS[fmt]
              }));
            });
          }, 600);
        } else if (s.status === 'failed' || s.status === 'error') {
          clearInterval(timer);
          showError(s.error || 'La compilación ha fallado');
        }

        if (buildConsole && s.runUrl) {
          try {
            const lr = await fetch('/api/build/' + id + '/logs');
            const lj = await lr.json();
            if (lj.logs) {
              buildConsole.textContent = lj.logs.substring(0, 15000);
              show(buildConsole);
            }
          } catch (_) {}
        }
      } catch (_) {}
    }, 3000);
  });




  const bindBackButton = () => on('#backFromBuild', 'click', () => {
    goToStep(5);
    show(buildReady);
    hide(buildProgress);
    hide(buildResult);
  });

  const apkInfoBox = $('#apkInfoBox');
  on('#showApkInfoBtn', 'click', async () => {
    if (!state.activeBuildId) return;
    if (!apkInfoBox.classList.contains('hidden')) {
      hide(apkInfoBox);
      return;
    }
    try {
      const r = await fetch('/api/apk-info/' + state.activeBuildId);
      const info = await r.json();
      if (!r.ok) throw new Error(info.error);


      const fmts = (Array.isArray(info.formats) && info.formats.length)
        ? info.formats
        : (info.artifacts || []).map((a) => a.type).filter(Boolean);
      const shown = fmts.length ? [...new Set(fmts)].join(' · ') : (info.outputType || 'apk');
      $('#apkInfoGrid').innerHTML = `
        <div class="apk-info-item"><div class="ai-label">TAMAÑO FINAL</div><div class="ai-value accent">${info.artifactSizeMB} MB</div></div>
        <div class="apk-info-item"><div class="ai-label">NOMBRE DE ARTIFACT</div><div class="ai-value" style="font-size:12px;font-weight:600">${escHtml(info.artifactName)}</div></div>
        <div class="apk-info-item"><div class="ai-label">FORMATO GENERADO</div><div class="ai-value">${escHtml(String(shown).toUpperCase())}</div></div>
        <div class="apk-info-item"><div class="ai-label">ESTADO DE BUILD</div><div class="ai-value" style="color:var(--success)">EXITOSO</div></div>
      `;
      show(apkInfoBox);
    } catch (e) {
      alert('No se pudo obtener información del paquete APK: ' + e.message);
    }
  });

  const renderHistory = () => {
    const q = ($('#histSearch') && $('#histSearch').value || '').toLowerCase();
    const st = ($('#histStatus') && $('#histStatus').value) || '';
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

          resolveFormats(h).forEach((fmt) => {
            buttons.push('<a class="btn ' + (fmt === 'apk' ? 'primary' : 'ghost') + ' sm" href="/api/download/' + h.id + (fmt === 'apk' ? '' : '/' + fmt) + '">' + fmt.toUpperCase() + '</a>');
          });
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
  };

  const duplicateBuild = async (id) => {
    try {
      const res = await fetch('/api/history/' + id);
      const h = await res.json();
      if (!res.ok) throw new Error(h.error || 'No se pudo cargar');
      const c = h.config || {};

      if (c.inputType === 'html') {
        $('.toggle-btn[data-input="html"]')?.click();
        setField('htmlCode', c.htmlCode || '');
      } else {
        $('.toggle-btn[data-input="url"]')?.click();
        setField('url', c.url || '');
      }
      ['appName', 'packageName', 'versionName', 'versionCode', 'orientation', 'platform',
        'compileSdk', 'targetSdk', 'minSdk', 'splashColor', 'splashDuration', 'accentColor',
        'statusBarColor', 'navigationBarColor', 'notifChannel', 'notifImportance'].forEach((k) => {
        if (c[k] !== undefined) setField(k, c[k]);
      });
      ['fullscreen', 'edgeToEdge', 'keepScreenOn', 'useCleartext', 'splashEnabled',
        'notifSound', 'notifVibration', 'adaptiveIconEnabled', 'desktopEnabled'].forEach((k) => {
        if (c[k] !== undefined) setField(k, !!c[k]);
      });

      if (Array.isArray(c.outputs) && c.outputs.length) Form.setOutputs(c.outputs);
      else if (c.outputType === 'both') Form.setOutputs(['apk', 'aab']);
      else if (c.outputType) Form.setOutputs([c.outputType]);
      ['fullscreen', 'edgeToEdge', 'keepScreenOn', 'useCleartext', 'splashEnabled',
        'notifSound', 'notifVibration', 'adaptiveIconEnabled'].forEach((k) => {
        if (c[k] !== undefined) setField(k, !!c[k]);
      });
      Object.entries(c.permissions || {}).forEach(([k, v]) => setField(k, !!v));
      Object.entries(c.plugins || {}).forEach(([k, v]) => setField('plugin_' + k, !!v));
      Preview.refresh();
      goToStep(0);
    } catch (err) {
      alert('No se pudo duplicar: ' + err.message);
    }
  };

  const exportConfig = (id) => {
    const h = historyCache.find((x) => x.id === id);
    if (!h || !h.config) {
      alert('Esta compilación no tiene configuración guardada.');
      return;
    }
    saveBlob(new Blob([JSON.stringify(h.config, null, 2)], { type: 'application/json' }), 'inteebuild-config-' + id + '.json');
  };

  const deleteHistoryItem = async (id) => {
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
  };

  const loadHistory = async () => {
    try {
      const res = await fetch('/api/history');
      historyCache = await res.json();
      renderHistory();
    } catch (_) {
      historyList.innerHTML = '<div class="hempty">Error al obtener el historial.</div>';
    }
  };

  const loadStats = async () => {
    try {
      const r = await fetch('/api/stats');
      const s = await r.json();
      const setText = (id, val) => {
        const el = $('#' + id);
        if (el) el.textContent = val;
      };
      setText('statTotal', s.total);
      setText('statOk', s.ok);
      setText('statFail', s.fail);
      setText('statApk', s.apk);
      setText('statAab', s.aab);
      setText('statBoth', s.both);
      setText('statAvg', s.avgSec ? Math.floor(s.avgSec / 60) + 'm ' + (s.avgSec % 60) + 's' : '—');
      setText('statLandTotal', s.total);
      setText('statLandOk', s.ok);
      setText('statLandAvg', s.avgSec ? Math.floor(s.avgSec / 60) + 'm ' + (s.avgSec % 60) + 's' : '—');
    } catch (_) {}
  };

  if (historyList) {
    historyList.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-dup], button[data-exp], button[data-del]');
      if (!btn) return;
      if (btn.dataset.dup) duplicateBuild(btn.dataset.dup);
      else if (btn.dataset.exp) exportConfig(btn.dataset.exp);
      else if (btn.dataset.del) deleteHistoryItem(btn.dataset.del);
    });
  }
  on('#histSearch', 'input', renderHistory);
  on('#histStatus', 'change', renderHistory);

  return { runQAChecks, loadHistory, loadStats, bindBackButton };
})();
