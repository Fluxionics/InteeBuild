'use strict';

const Permissions = (() => {
  let isAdvanced = false;

  const auditItemHtml = (i) => {
    const icon = i.status === 'ok' ? IBIcon('check') : i.status === 'warn' ? IBIcon('alert') : IBIcon('x');
    const manOk = (i.manifest || '').startsWith('GENERATED');
    const runOk = (i.runtime || '').startsWith('GENERATED');
    const natOk = (i.native || '').startsWith('GENERATED');
    const grantedChip = i.granted ? `<span class="audit-chip ${i.mechanism === 'special' ? 'warn' : 'ok'}">Concedido: ${escHtml(i.granted)}</span>` : '';
    const usedChip = i.used === 'detectado' ? '<span class="audit-chip ok">Uso: detectado en tu web</span>'
      : i.used === 'sin-uso' ? '<span class="audit-chip warn">Uso: sin uso detectado</span>'
      : i.used === 'sin-datos' ? '<span class="audit-chip">Uso: sin analizar</span>' : '';
    const rangeChip = i.rangeStatus === 'warn' && i.range ? `<span class="audit-chip warn">${IBIcon('alert')} ${escHtml(i.range)}</span>` : '';
    return `<div class="audit-item ${i.status}"><span class="audit-ico">${icon}</span><div class="audit-main"><b>${escHtml(i.title)}</b> <small>(${escHtml(i.key)})</small> ${i.verified ? '<small style="color:var(--success)">· verificado en APK</small>' : '<small style="color:var(--danger)">· NO generado</small>'}<div class="audit-meta"><span class="audit-chip ${manOk ? 'ok' : 'fail'}">Manifest ${escHtml(i.manifest)}</span><span class="audit-chip ${runOk ? 'ok' : (i.runtime || '').startsWith('N/A') ? 'warn' : 'fail'}">Runtime ${escHtml((i.runtime || '').slice(0, 70))}</span><span class="audit-chip ${natOk ? 'ok' : 'fail'}">Native ${escHtml((i.native || i.handler || '').slice(0, 80))}</span><span class="audit-chip">Bridge ${escHtml((i.bridge || '').slice(0, 50))}</span>${grantedChip}${usedChip}${rangeChip}${i.mechanism ? `<span class="audit-chip">${escHtml(i.mechanism)}</span>` : ''}${i.version !== 'OK' ? `<span class="audit-chip warn">${escHtml(i.version)} · minSdk ${i.minSdk}</span>` : ''}${i.special ? `<span class="audit-chip warn">${IBIcon('alert')} ${escHtml((i.special || '').slice(0, 90))}</span>` : ''}${i.provider && i.provider.startsWith('WARN') ? `<span class="audit-chip warn">${escHtml(i.provider)}</span>` : ''}</div></div><span class="audit-badge ${i.status}">${i.status}</span></div>`;
  };

  const renderReadiness = async () => {
    const readinessBox = $('#buildReadinessBox');
    if (!readinessBox) return;
    const rr = await fetch('/api/build-readiness', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Form.collect())
    });
    const br = await rr.json();
    const barColor = br.readiness >= 90
      ? 'var(--success)'
      : br.readiness >= 70
        ? 'var(--warn)'
        : 'var(--danger)';
    const checks = Object.entries(br.checks || {})
      .map(([k, v]) => `<span class="readiness-check ${v ? 'yes' : 'no'}">${v ? IBIcon('check') : IBIcon('x')} ${escHtml(k)}</span>`)
      .join('');
    const warnings = (br.warnings || []).length
      ? '<div style="margin-top:6px;font-size:11px;color:var(--warn)">' + IBIcon('alert') + ' ' + br.warnings.map((w) => escHtml(w)).join('<br>' + IBIcon('alert') + ' ') + '</div>'
      : '';
    readinessBox.innerHTML = `<div class="readiness-card"><div class="readiness-top"><span>BUILD READINESS</span><span class="readiness-pct">${br.readiness}%</span></div><div class="readiness-bar"><div class="readiness-fill" style="width:${br.readiness}%;background:${barColor}"></div></div><small style="color:var(--muted)">${escHtml(br.message || '')}</small>${warnings}<div class="readiness-checks">${checks}</div></div>`;

    const buildBtn = $('#buildBtn');
    if (buildBtn) {
      buildBtn.disabled = false;
      buildBtn.title = br.canBuild ? 'Listo para compilar' : 'Audit con observaciones: al compilar se te dirá qué corregir';
      buildBtn.style.opacity = br.canBuild ? '1' : '.75';
    }
  };

  const runAudit = async () => {
    const auditBox = $('#auditBox');
    if (!auditBox) return;
    auditBox.innerHTML = '<small style="color:var(--muted)"><svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg> Auditando permisos...</small>';
    try {
      const r = await fetch('/api/permissions/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Form.collect())
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Audit falló');

      const items = j.items.map(auditItemHtml).join('');
      auditBox.innerHTML = j.total
        ? items + `<div class="audit-summary ${j.canBuild ? 'good' : 'bad'}"><b>${j.ok}/${j.total} OK</b> · Readiness ${j.readiness}% ${j.canBuild ? `· ${IBIcon('check')}Listo para compilar` : `· ${IBIcon('x')}Bloqueado: revisa permisos`}</div>`
        : '<small style="color:var(--muted)">Selecciona al menos un permiso para auditar. Sin permisos el APK solo usa INTERNET.</small>';

      if ($('#buildReadinessBox')) await renderReadiness();
    } catch (e) {
      auditBox.innerHTML = '<span style="color:var(--danger)">' + escHtml(e.message) + '</span>';
    }
  };

  on('#modeToggle', 'click', (e) => {
    isAdvanced = !isAdvanced;
    e.currentTarget.textContent = isAdvanced ? 'Modo estándar' : 'Modo avanzado';
    $$('.advanced').forEach((el) => setVisible(el, isAdvanced));
  });

  on('#runAuditBtn', 'click', runAudit);

  on('#autoSuggestBtn', 'click', async () => {
    const auditBox = $('#auditBox');
    const mode = $('input[name="permMode"]:checked')?.value || 'manual';
    let html = '';
    let url = '';
    const active = $('.toggle-btn.active')?.dataset.input;
    if (active === 'html') html = $('[name="htmlCode"]')?.value || '';
    else url = $('[name="url"]')?.value || '';
    if (!html && !url) return alert('Pon URL o HTML para sugerir');

    const r = await fetch('/api/permissions/suggest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html, url })
    });
    const j = await r.json();
    if (!j.suggested.length) return alert('No se detectaron APIs que requieran permisos');
    const msg = j.suggested.map((s) => `${s.spec.title} (${s.key})`).join(', ');

    const checkSuggested = (containers) => {
      j.suggested.forEach((s) => {
        const el = $(`[name="${s.key}"]`);
        if (!el) return;
        el.checked = true;
        const tile = el.closest(containers);
        if (tile) tile.classList.add('checked');
      });
    };

    if (mode === 'manual') {
      if (auditBox) {
        auditBox.innerHTML = '<div class="suggest-banner">Sugerido por Web API: <b>' + escHtml(msg) + '</b><br><small>Actívalo manualmente si lo necesitas. Detección ≠ uso real.</small></div>' + auditBox.innerHTML;
      }
    } else if (mode === 'recommended') {
      if (confirm('Sugerido: ' + msg + '\n¿Activar automáticamente?')) {
        checkSuggested('.perm-tile, .switch');
        if (auditBox) auditBox.innerHTML = '<div class="suggest-banner good">' + IBIcon('check') + 'Activados: ' + escHtml(msg) + '</div>';
        runAudit();
      }
    } else if (mode === 'auto') {
      $$('#permEasy input[type="checkbox"], #permAdvanced input[type="checkbox"]').forEach((el) => {
        el.checked = false;
        el.closest('.perm-tile')?.classList.remove('checked');
      });
      checkSuggested('.perm-tile');
      if (auditBox) auditBox.innerHTML = '<div class="suggest-banner good">' + IBIcon('robot') + 'Auto: ' + escHtml(msg) + ' — solo lo detectado, sin extras.</div>';
      runAudit();
    }
  });

  onAll('input[name="permMode"]', 'change', (e) => {
    if (e.target.value !== 'auto' && e.target.value !== 'recommended') return;
    if ($('[name="url"]')?.value || $('[name="htmlCode"]')?.value) $('#autoSuggestBtn')?.click();
  });

  return { runAudit };
})();
