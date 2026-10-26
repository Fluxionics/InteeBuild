'use strict';

const Doctor = (() => {
  const run = async () => {
    const box = $('#doctorBox');
    if (!box) return;
    box.innerHTML = '<small style="color:var(--muted)">Diagnosticando antes de compilar…</small>';
    try {
      const r = await fetch('/api/doctor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Form.collect())
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'El Doctor falló');
      const ico = { ok: 'check', warn: 'alert', error: 'x' };
      const cls = { ok: 'ok', warn: 'warn', error: 'fail' };
      const rows = j.checks.map((c) =>
        `<div class="audit-item ${cls[c.status] || 'warn'}"><span class="audit-ico">${IBIcon(ico[c.status] || 'alert')}</span><div class="audit-main"><b>${escHtml(c.label)}</b>${c.detail ? `<div class="audit-meta"><span class="audit-chip">${escHtml(c.detail)}</span></div>` : ''}</div><span class="audit-badge ${cls[c.status] || 'warn'}">${c.status === 'error' ? 'error' : c.status}</span></div>`
      ).join('');
      const barColor = j.canBuild ? (j.warns ? 'var(--warn)' : 'var(--success)') : 'var(--danger)';
      box.innerHTML = rows +
        `<div class="audit-summary ${j.canBuild ? 'good' : 'bad'}"><b>Score ${j.score}/100</b> · ${j.checks.length} chequeos · ${escHtml(j.summary)}</div>` +
        `<div class="readiness-bar" style="margin-top:6px"><div class="readiness-fill" style="width:${j.score}%;background:${barColor}"></div></div>`;
    } catch (e) {
      box.innerHTML = '<span style="color:var(--danger)">' + escHtml(e.message) + '</span>';
    }
  };

  on('#doctorBtn', 'click', run);

  return { run };
})();
