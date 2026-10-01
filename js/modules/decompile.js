'use strict';

(() => {
  let apkBase64 = null;

  const decompileBtn = $('#decompileBtn');
  const decompileOut = $('#decompileOut');

  on('#apkInput', 'change', (e) => {
    const input = e.currentTarget;
    const file = input.files && input.files[0];
    if (!file) return;
    readFileAsDataURL(file, (dataUrl) => {
      apkBase64 = dataUrl;
      decompileOut.textContent = 'APK cargado: ' + file.name + ' (' + kb(file.size) + 'KB) listo para descompilar.';
    });
  });

  on('#decompileBtn', 'click', async () => {
    if (!apkBase64) return alert('Selecciona un APK primero');
    decompileBtn.textContent = 'Descompilando...';
    decompileBtn.disabled = true;
    try {
      const r = await fetch('/api/decompile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apkBase64 })
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);

      decompileOut.innerHTML = '<div class="decompile-result">'
        + '<div class="decompile-row"><b>Package</b><span>' + escHtml(j.meta.packageName) + '</span></div>'
        + '<div class="decompile-row"><b>App</b><span>' + escHtml(j.meta.appName) + '</span></div>'
        + '<div class="decompile-row"><b>Versión</b><span>' + escHtml(j.meta.versionName || '1.0.0') + ' ' + (j.meta.versionCode ? '(' + escHtml(j.meta.versionCode) + ')' : '') + '</span></div>'
        + '<div class="decompile-row"><b>Permisos</b><span>' + escHtml((j.meta.permissions || []).join(', ') || 'ninguno') + '</span></div>'
        + '<div class="decompile-row"><b>Archivos</b><span>' + j.meta.fileCount + ' (' + j.meta.sizeKB + 'KB) ' + (j.meta.hasIcon ? '· <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg> icono' : '') + (j.meta.hasDex ? '· <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0 .33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> dex' : '') + '</span></div>'
        + '<div style="margin-top:8px"><b style="font-size:12px"><svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg> Código fuente recuperado</b><pre class="code" style="margin-top:6px;max-height:160px;overflow:auto">' + escHtml(JSON.stringify(j.importConfig, null, 2)) + '</pre></div>'
        + '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap"><button type="button" class="btn primary sm" id="importDecompiled"><svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Importar como proyecto</button>' + (j.sourceZipBase64 ? '<a class="btn ghost sm" href="data:application/zip;base64,' + j.sourceZipBase64 + '" download="inteebuild-source-' + escHtml(j.meta.packageName || 'app') + '.zip"><svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg> Descargar ZIP fuente (' + j.sourceZipSizeKB + 'KB)</a>' : '') + '</div>'
        + '<div style="margin-top:8px;font-size:11px;color:var(--muted)">' + escHtml(j.note) + '</div>'
        + (j.manifestPreview ? '<details style="margin-top:8px"><summary style="font-size:11px;cursor:pointer;color:var(--accent)">Manifest preview</summary><pre class="code" style="margin-top:6px;max-height:200px;overflow:auto">' + escHtml((j.manifestPreview || '').slice(0, 3000)) + '</pre></details>' : '')
        + '</div>';


      setTimeout(() => {
        const importBtn = $('#importDecompiled');
        if (importBtn) {
          importBtn.addEventListener('click', () => {
            const c = j.importConfig;
            if (c.appName) setField('appName', c.appName);
            if (c.packageName) setField('packageName', c.packageName);
            if (c.url) setField('url', c.url);
            if (c.permissions) Object.entries(c.permissions).forEach(([k, v]) => setField(k, !!v));
            alert('Config importada. Revisa el paso 1 y compila.');
            goToStep(0);
          });
        }
      }, 100);
    } catch (e) {
      decompileOut.textContent = 'Error: ' + e.message;
    }
    decompileBtn.textContent = 'Descompilar';
    decompileBtn.disabled = false;
  });


  on('#decompileCloudBtn', 'click', async () => {
    if (!apkBase64) return alert('Selecciona un APK primero');
    const cloudBtn = $('#decompileCloudBtn');
    cloudBtn.disabled = true;
    decompileBtn.disabled = true;
    const stamp = () => new Date().toLocaleTimeString();
    const set = (t) => { decompileOut.textContent = t; };
    let timer = null;
    let timeout = null;

    try {
      set('[' + stamp() + '] Subiendo APK al repo efímero y despachando workflow decompile-app.yml ...');
      const r = await fetch('/api/decompile/cloud', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apkBase64 })
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'no se pudo despachar');
      set('[' + stamp() + '] Despachado. id=' + j.id + ' rama=' + j.branch + '\nHerramientas: ' + j.tools + '\nPolling estado cada 5s (jadx tarda ~1-3 min)...\n' + (j.statusUrl || ''));

      const poll = async () => {
        try {
          const sr = await fetch(j.statusUrl);
          const s = await sr.json();
          if (!sr.ok) throw new Error(s.error || 'status');
          if (s.status === 'completed' && s.conclusion === 'success') {
            clearInterval(timer);
            clearTimeout(timeout);
            const art = (s.artifacts || [])[0];
            decompileOut.innerHTML = '[' + stamp() + '] <b>' + IBIcon('check') + 'Descompilación en la nube lista</b>\n'
              + '<div style="margin-top:6px"><a class="btn primary sm" href="' + escHtml(j.downloadUrl) + '">Descargar sources (jadx + apktool) .zip</a> '
              + '<a class="btn ghost sm" href="' + escHtml(s.runUrl || '#') + '" target="_blank" rel="noopener">Ver logs del workflow</a></div>'
              + '<div style="margin-top:6px;font-size:11px;color:var(--muted)">El ZIP trae output/sources (Java), output/resources (res+smali), AndroidManifest-decoded.xml y REPORT.txt</div>';
            return;
          }
          if (s.status === 'completed' && s.conclusion !== 'success') {
            clearInterval(timer);
            clearTimeout(timeout);
            decompileOut.innerHTML = '[' + stamp() + '] ' + IBIcon('x') + ' Workflow terminó con ' + escHtml(s.conclusion) + '.\nLogs: ' + escHtml(s.runUrl || '');
          } else {
            decompileOut.textContent = '[' + stamp() + '] Estado: ' + s.status + (s.conclusion ? ' (' + s.conclusion + ')' : '') + (s.runUrl ? '\nRun: ' + s.runUrl : '') + '\nesperando a jadx + apktool ...';
          }
        } catch (_) {   }
      };


      timer = setInterval(poll, 5000);
      timeout = setTimeout(() => {
        clearInterval(timer);
        set('[' + stamp() + '] Timeout (5 min). Revisa la rama ' + j.branch + ' y los runs de Actions: ' + (j.statusUrl || ''));
      }, 300000);
      setTimeout(poll, 4000);
    } catch (e) {
      if (timer) clearInterval(timer);
      set('Error: ' + e.message + '\n\nNecesitas GITHUB_TOKEN + INTEE_BUILDS_REPO en el .env y el repo de builds en GitHub.');
    }
    cloudBtn.disabled = false;
    decompileBtn.disabled = false;
  });
})();
