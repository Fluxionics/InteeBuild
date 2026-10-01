'use strict';

(() => {
  let autopilotRecommendations = null;
  const appNameInput = $('#appNameInput');

  const analyzeBtn = on('#analyzeBtn', 'click', async () => {
    const url = $('[name="url"]').value.trim();
    if (!url) return alert('Ingresa una URL web');
    analyzeBtn.textContent = 'Analizando…';
    analyzeBtn.disabled = true;

    try {
      const r = await fetch('/api/analyze?url=' + encodeURIComponent(url));
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);

      show($('#analyzeBox'));
      $('#analyzeScore').textContent = j.score;
      const ring = $('#analyzeRing');
      if (ring) {
        ring.style.strokeDashoffset = 138.2 - (138.2 * j.score) / 100;
        ring.style.stroke = j.score > 80 ? 'var(--success)' : j.score > 50 ? 'var(--warn)' : 'var(--danger)';
      }

      $('#analyzeDiag').textContent = j.diag;
      $('#analyzeSubDiag').textContent = `Código de estado: ${j.status} | Recursos Http Inseguros: ${j.insecureCount || 0}`;

      const checkNames = {
        https: 'Conexión HTTPS Segura',
        reachable: 'Acceso a Servidor Web',
        viewport: 'Diseño Responsive (Viewport)',
        manifest: 'Manifiesto Web (Manifest.json)',
        favicon: 'Icono / Favicon',
        themeColor: 'Color de Tema (Theme Color)',
        serviceWorker: 'Service Worker Registrado',
        insecureResources: 'Recursos 100% Incriptados',
        htmlErrors: 'Sintaxis HTML Válida'
      };
      $('#analyzeGrid').innerHTML = Object.entries(j.checks)
        .filter(([k]) => checkNames[k])
        .map(([k, v]) => `<div class="analyze-check ${v ? 'ok' : 'fail'}"><span>${v ? IBIcon('check') : IBIcon('x')}</span> ${checkNames[k]}</div>`)
        .join('');

      const fwBox = $('#analyzeFramework');
      if (j.frameworks && j.frameworks.length) {
        show(fwBox);
        fwBox.innerHTML = '<span style="font-size:11px;color:var(--muted)">Tecnología detectada:</span> '
          + j.frameworks.map((f) => `<span class="fw-badge">${f}</span>`).join(' ');
      }

      setVisible($('#analyzePwa'), !!j.checks.pwa);
      if (j.pwa) {
        if (j.pwa.name && !appNameInput.value) appNameInput.value = j.pwa.name;
        if (j.pwa.short_name && !appNameInput.value) appNameInput.value = j.pwa.short_name;
        if (j.pwa.theme_color) {
          const accentColor = $('[name="accentColor"]');
          if (accentColor) accentColor.value = j.pwa.theme_color;
        }
        Preview.refresh();
      }

      autopilotRecommendations = j.recommendations || [];
      const autoBox = $('#autopilotBox');
      const autoItems = $('#autopilotItems');
      if (autopilotRecommendations.length > 0) {
        show(autoBox);
        autoItems.innerHTML = autopilotRecommendations
          .map((rec) => `<div class="autopilot-item">Uso detectado de <b>${rec.api}</b> → Sugerencia: <b>${rec.label}</b></div>`)
          .join('');
      } else {
        hide(autoBox);
      }

      const secBox = $('#securityBox');
      const secScore = $('#secScore');
      const secIssues = $('#secIssues');
      if (secBox && j.security) {
        show(secBox);
        secScore.textContent = j.security.score + '/100 ' + j.security.level;
        secScore.style.background = j.security.score >= 80 ? 'var(--success)' : j.security.score >= 50 ? 'var(--warn)' : 'var(--danger)';
        secIssues.innerHTML = j.security.issues.length
          ? j.security.issues.map((i) => `<div style="display:flex;gap:6px"><span style="color:${i.severity === 'critical' ? 'var(--danger)' : i.severity === 'high' ? 'var(--danger)' : i.severity === 'medium' ? 'var(--warn)' : 'var(--muted)'}">●</span><span><b>${i.msg}</b> — <small style="color:var(--muted)">${i.fix}</small></span></div>`).join('')
          : '<span style="color:var(--success)">Sin problemas críticos</span>';
      }

      const errBox = $('#errorsBox');
      const errList = $('#errorsList');
      if (errBox && j.errors) {
        show(errBox);
        const problems = [
          ...j.errors.errors.map((i) => `<span style="color:var(--danger)">${IBIcon('x')} ${i.msg} → ${i.fix}</span>`),
          ...j.errors.warnings.map((w) => `<span style="color:var(--warn)">${IBIcon('alert')} ${w.msg} → ${w.fix}</span>`)
        ];
        errList.innerHTML = problems.length ? problems.join('<br>') : '<span style="color:var(--success)">Sin errores detectados</span>';
      }

      const optBox = $('#optBox');
      const optTips = $('#optTips');
      const optScore = $('#optScore');
      if (optBox && j.optimization) {
        show(optBox);
        optScore.textContent = j.optimization.grade + ' (' + j.optimization.score + '/100) - ' + j.optimization.sizeKB + 'KB, ' + j.optimization.images + ' imgs';
        optTips.innerHTML = j.optimization.tips
          .map((t) => `<div>• ${t.msg} <small style="color:var(--muted)">→ ${t.fix}</small> <span style="font-size:10px;padding:1px 5px;border-radius:999px;background:${t.impact === 'high' ? 'var(--danger-soft)' : t.impact === 'medium' ? 'var(--warn-soft)' : 'var(--accent-soft)'}">${t.impact}</span></div>`)
          .join('');
        optBox.dataset.fixed = j.autoFix && j.autoFix.preview ? j.autoFix.preview : '';
        window._lastFixedHtml = j.autoFix && j.autoFix.preview ? j.autoFix.preview : null;
        $('#applyFixBtn').style.display = j.autoFix && j.autoFix.available ? '' : 'none';
      }
    } catch (e) {
      alert(e.message);
    }
    analyzeBtn.textContent = 'Analizar salud web';
    analyzeBtn.disabled = false;
  });

  on('#applyFixBtn', 'click', () => {
    const html = window._lastFixedHtml;
    if (!html) return alert('No hay fix disponible. Analiza una URL primero.');
    $('.toggle-btn[data-input="html"]')?.click();
    const ta = $('[name="htmlCode"]');
    if (ta) {
      ta.value = html;
      alert('HTML optimizado aplicado en el editor. Revisa el paso 1.');
    }
  });

  on('#autopilotApply', 'click', () => {
    if (!autopilotRecommendations) return;
    const setCheck = (name, val) => {
      const el = $(`[name="${name}"]`);
      if (!el) return;
      el.checked = !!val;
      const tile = el.closest('.perm-tile, .plugin-card');
      if (tile) tile.classList.toggle('checked', !!val);
    };

    autopilotRecommendations.forEach((rec) => {
      (rec.permissions || []).forEach((p) => setCheck(p, true));
      (rec.plugins || []).forEach((p) => setCheck('plugin_' + p, true));
    });

    alert('Configuración sugerida aplicada exitosamente');
  });
})();
