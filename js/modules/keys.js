'use strict';

(() => {
  const apiKeysList = $('#apiKeysList');
  const gitList = $('#gitList');

  const createKey = async () => {
    const name = $('#apiKeyName').value || 'default';
    const r = await fetch('/api/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    const j = await r.json();
    if (!r.ok) return alert(j.error);
    apiKeysList.innerHTML = '<div style="padding:8px;background:var(--success-soft);border-radius:8px;border:1px solid rgba(16,185,129,.3);word-break:break-all"><b>Key generada:</b><br><code style="font-size:11px">' + j.key + '</code><br><small>Copia ahora, luego se muestra enmascarada. ID: ' + j.id + '</small></div>' + apiKeysList.innerHTML;
  };

  const listKeys = async () => {
    const r = await fetch('/api/keys');
    const list = await r.json();
    if (!list.length) {
      apiKeysList.innerHTML = '<small>Sin keys. Genera una.</small>';
      return;
    }
    apiKeysList.innerHTML = list.map((k) => `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border)"><span><b>${escHtml(k.name)}</b> <code style="font-size:10px">${escHtml(k.keyMask)}</code> <small>usos:${k.uses || 0}</small></span><button type="button" class="btn ghost sm" onclick="fetch('/api/keys/${k.id}',{method:'DELETE'}).then(()=>alert('Eliminada')).catch(()=>{})">Eliminar</button></div>`).join('');
  };

  const connectGit = async () => {
    const repo = $('#gitRepo').value.trim();
    const branch = $('#gitBranch').value.trim() || 'main';
    if (!repo) return alert('Escribe usuario/repo');
    const r = await fetch('/api/git/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repo, branch })
    });
    const j = await r.json();
    if (!r.ok) return alert(j.error);
    alert('Conectado: ' + j.repo + '#' + j.branch);
    $('#gitListBtn')?.click();
  };

  const listGit = async () => {
    const r = await fetch('/api/git/integrations');
    const list = await r.json();
    if (!list.length) {
      gitList.innerHTML = '<small>Sin integraciones</small>';
      return;
    }
    gitList.innerHTML = list.map((g) => `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border)"><span><b>${escHtml(g.repo)}</b>#${escHtml(g.branch)} <small>${new Date(g.createdAt).toLocaleString()}</small></span><button type="button" class="btn ghost sm" onclick="fetch('/api/git/${g.id}',{method:'DELETE'}).then(()=>location.reload())">Quitar</button></div>`).join('');
  };

  on('#createKeyBtn', 'click', createKey);
  on('#listKeysBtn', 'click', listKeys);
  on('#gitConnectBtn', 'click', connectGit);
  on('#gitListBtn', 'click', listGit);
})();
