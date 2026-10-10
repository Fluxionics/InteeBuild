'use strict';

const Projects = (() => {
  const KEY = 'ib:projects';
  const MAX = 20;

  const load = () => {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (_) { return []; }
  };

  const persist = (list) => {
    try { localStorage.setItem(KEY, JSON.stringify(list)); return true; } catch (_) {}
    const slim = list.map((p) => {
      const c = Object.assign({}, p.cfg);
      ['iconBase64', 'keystoreBase64', 'iosP12Base64', 'iosProfileBase64', 'adaptiveFgBase64', 'splashImageBase64'].forEach((k) => { delete c[k]; });
      return { name: p.name, t: p.t, cfg: c };
    });
    try { localStorage.setItem(KEY, JSON.stringify(slim)); return true; } catch (_) { return false; }
  };

  const fmtTime = (t) => {
    try { return new Date(t).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (_) { return ''; }
  };

  const render = () => {
    const box = $('#projList');
    if (!box) return;
    const list = load();
    if (!list.length) {
      box.innerHTML = '<small style="color:var(--muted)">Todavía no guardas ningún proyecto. Ponele nombre y le das a Guardar.</small>';
      return;
    }
    box.innerHTML = list.map((p, i) =>
      '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-top:1px solid var(--border)">' +
      '<div style="flex:1;min-width:140px"><b>' + escHtml(p.name) + '</b><br><small style="color:var(--muted)">' + fmtTime(p.t) + '</small></div>' +
      '<button type="button" class="btn primary sm" data-proj-load="' + i + '">Cargar</button>' +
      '<button type="button" class="btn ghost sm" data-proj-exp="' + i + '">JSON</button>' +
      '<button type="button" class="btn ghost sm" data-proj-del="' + i + '">Borrar</button>' +
      '</div>'
    ).join('');
  };

  on('#projSaveBtn', 'click', () => {
    const nameInput = $('#projName');
    const name = (nameInput && nameInput.value.trim()) || String(Form.collect().appName || '').trim() || 'Mi proyecto';
    const list = load();
    list.unshift({ name, t: Date.now(), cfg: Form.collect() });
    if (!persist(list.slice(0, MAX))) return alert('No se pudo guardar: el navegador se quedó sin espacio.');
    if (nameInput) nameInput.value = '';
    render();
  });

  on('#projExportBtn', 'click', () => {
    const cfg = Form.collect();
    const name = String(cfg.appName || 'proyecto').replace(/[^a-z0-9áéíóúñ ]/gi, '').trim().replace(/\s+/g, '-').toLowerCase() || 'proyecto';
    saveBlob(new Blob([JSON.stringify(cfg, null, 2)], { type: 'application/json' }), 'inteebuild-' + name + '.json');
  });

  on('#projImportInput', 'change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const cfg = JSON.parse(reader.result);
        if (!cfg || typeof cfg !== 'object') throw new Error('El archivo no parece una configuración');
        Form.applyConfig(cfg);
        alert('Proyecto importado. Revisa los datos antes de compilar.');
      } catch (err) {
        alert('No se pudo importar: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  const listEl = $('#projList');
  if (listEl) {
    listEl.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-proj-load], button[data-proj-exp], button[data-proj-del]');
      if (!btn) return;
      const list = load();
      if (btn.dataset.projLoad !== undefined) {
        const p = list[Number(btn.dataset.projLoad)];
        if (!p) return;
        Form.applyConfig(p.cfg);
        goToStep(0);
        alert('Proyecto "' + p.name + '" cargado.');
      } else if (btn.dataset.projExp !== undefined) {
        const p = list[Number(btn.dataset.projExp)];
        if (!p) return;
        saveBlob(new Blob([JSON.stringify(p.cfg, null, 2)], { type: 'application/json' }), 'inteebuild-' + p.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '.json');
      } else if (btn.dataset.projDel !== undefined) {
        const idx = Number(btn.dataset.projDel);
        const p = list[idx];
        if (!p) return;
        if (!confirm('¿Borrar el proyecto "' + p.name + '"?')) return;
        list.splice(idx, 1);
        persist(list);
        render();
      }
    });
  }

  render();
  return { render };
})();
