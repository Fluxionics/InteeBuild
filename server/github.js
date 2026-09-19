'use strict';

const API = 'https://api.github.com';

function config() {
  const repo = String(process.env.INTEE_BUILDS_REPO || '').trim();
  const token = String(process.env.GITHUB_TOKEN || '').trim();
  const defaultBranch = String(process.env.INTEE_DEFAULT_BRANCH || 'main').trim();
  const m = /^([^/]+)\/([^/]+)$/.exec(repo);
  return {
    owner: m ? m[1] : null,
    repo: m ? m[2] : null,
    token,
    defaultBranch,
    ready: !!m && !!token
  };
}

async function api(path, { method = 'GET', body } = {}) {
  const { token } = config();
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'InteeBuild',
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }
  if (!res.ok) {
    const msg = data && data.message ? data.message : `GitHub respondio ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return data;
}

async function syncWorkflow(owner, repo, branch, workflowYml) {
  const path = '.github/workflows/build-app.yml';
  const content = Buffer.from(workflowYml, 'utf-8').toString('base64');
  let existing = null;
  try {
    existing = await api(`/repos/${owner}/${repo}/contents/${path}?ref=${branch}`);
  } catch (err) {
    if (err.status !== 404) throw err;
  }
  if (existing) {
    const current = Buffer.from(existing.content, 'base64').toString('utf-8');
    if (current === workflowYml) return;
    await api(`/repos/${owner}/${repo}/contents/${path}`, {
      method: 'PUT',
      body: { message: 'InteeBuild: actualizar workflow', content, sha: existing.sha, branch }
    });
    return;
  }
  await api(`/repos/${owner}/${repo}/contents/${path}`, {
    method: 'PUT',
    body: { message: 'InteeBuild: crear workflow', content, branch }
  });
}

async function baseCommit(owner, repo, branch) {
  const ref = await api(`/repos/${owner}/${repo}/git/ref/heads/${branch}`);
  const sha = ref.object.sha;
  const commit = await api(`/repos/${owner}/${repo}/git/commits/${sha}`);
  return { sha, tree: commit.tree.sha };
}

async function pushProject(owner, repo, branch, files, baseBranch) {
  const base = await baseCommit(owner, repo, baseBranch);

  const blobs = await Promise.all(
    Object.entries(files).map(async ([path, content]) => {
      const isBuffer = Buffer.isBuffer(content);
      const blob = await api(`/repos/${owner}/${repo}/git/blobs`, {
        method: 'POST',
        body: {
          content: isBuffer ? content.toString('base64') : Buffer.from(String(content), 'utf-8').toString('base64'),
          encoding: 'base64'
        }
      });
      return { path, mode: '100644', type: 'blob', sha: blob.sha };
    })
  );

  const tree = await api(`/repos/${owner}/${repo}/git/trees`, {
    method: 'POST',
    body: { base_tree: base.tree, tree: blobs }
  });

  const commit = await api(`/repos/${owner}/${repo}/git/commits`, {
    method: 'POST',
    body: {
      message: `InteeBuild build ${branch}`,
      tree: tree.sha,
      parents: [base.sha]
    }
  });

  try {
    await api(`/repos/${owner}/${repo}/git/refs`, {
      method: 'POST',
      body: { ref: `refs/heads/${branch}`, sha: commit.sha }
    });
  } catch (err) {
    if (err.status !== 422) throw err;
    await api(`/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
      method: 'PATCH',
      body: { sha: commit.sha, force: true }
    });
  }

  return commit.sha;
}

async function dispatchBuild(owner, repo, branch, id, outputType = 'apk', platform = 'android') {
  const body = { ref: branch, inputs: { id, outputType, platform } };
  let lastErr = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      await api(`/repos/${owner}/${repo}/actions/workflows/build-app.yml/dispatches`, {
        method: 'POST',
        body
      });
      return;
    } catch (err) {
      lastErr = err;
      const retryable = err.status === 422 && /workflow_dispatch/i.test(String(err.message || ''));
      if (!retryable || attempt === 5) throw err;
      await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)));
    }
  }
  throw lastErr;
}

async function findRun(owner, repo, branch, { tries = 12, delayMs = 3000 } = {}) {
  for (let i = 0; i < tries; i++) {
    const runs = await api(`/repos/${owner}/${repo}/actions/runs?event=workflow_dispatch&per_page=50`);
    const run = (runs.workflow_runs || []).find((r) => r.head_branch === branch);
    if (run) return run;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return null;
}

async function getRun(owner, repo, runId) {
  return api(`/repos/${owner}/${repo}/actions/runs/${runId}`);
}

async function getArtifacts(owner, repo, runId) {
  const data = await api(`/repos/${owner}/${repo}/actions/runs/${runId}/artifacts`);
  return data.artifacts || [];
}

async function listBranches(owner, repo) {
  return api(`/repos/${owner}/${repo}/branches?per_page=100`);
}

async function deleteBranch(owner, repo, branch) {
  await api(`/repos/${owner}/${repo}/git/refs/heads/${branch}`, { method: 'DELETE' });
}

async function listRuns(owner, repo) {
  const data = await api(`/repos/${owner}/${repo}/actions/runs?per_page=100`);
  return data.workflow_runs || [];
}

async function deleteRun(owner, repo, runId) {
  await api(`/repos/${owner}/${repo}/actions/runs/${runId}`, { method: 'DELETE' });
}

async function listAllArtifacts(owner, repo) {
  const data = await api(`/repos/${owner}/${repo}/actions/artifacts?per_page=100`);
  return data.artifacts || [];
}

async function deleteArtifact(owner, repo, artifactId) {
  await api(`/repos/${owner}/${repo}/actions/artifacts/${artifactId}`, { method: 'DELETE' });
}

async function deleteBranchSoon(owner, repo, branch, delayMs = 60000) {
  setTimeout(() => {
    deleteBranch(owner, repo, branch).then(
      () => console.log(`[cleanup-branch] ${branch} borrada (código no queda en el repo)`),
      (e) => console.log(`[cleanup-branch] ${branch} no se pudo borrar: ${e.message}`)
    );
  }, delayMs);
}

async function cleanup(owner, repo, keepBranch) {
  const del = { branches: 0, runs: 0, artifacts: 0 };
  const branchCutoff = Date.now() - 5 * 60 * 1000;
  const cutoff = Date.now() - 30 * 60 * 1000;
  try {
    const branches = await listBranches(owner, repo);
    const old = branches.filter(b => {
      if (!/^build-[0-9a-f]{8}$/.test(b.name) || b.name === keepBranch) return false;
      const d = b.commit && b.commit.commit ? b.commit.commit.committer.date : b.commit.committer.date;
      return new Date(d).getTime() < branchCutoff;
    });
    for (const b of old) {
      try { await deleteBranch(owner, repo, b.name); del.branches++; } catch (_) {}
    }
  } catch (_) {}
  try {
    const runs = await listRuns(owner, repo);
    const oldRuns = runs.filter(r => new Date(r.created_at).getTime() < cutoff);
    for (const r of oldRuns) {
      try { await deleteRun(owner, repo, r.id); del.runs++; } catch (_) {}
    }
  } catch (_) {}
  try {
    const arts = await listAllArtifacts(owner, repo);
    const oldArts = arts.filter(a => new Date(a.created_at).getTime() < cutoff);
    for (const a of oldArts) {
      try { await deleteArtifact(owner, repo, a.id); del.artifacts++; } catch (_) {}
    }
  } catch (_) {}
  return del;
}

async function getRunLogs(owner, repo, runId) {
  const { token } = config();
  const res = await fetch(`${API}/repos/${owner}/${repo}/actions/runs/${runId}/logs`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' }
  });
  if (!res.ok) {
    const jobs = await api(`/repos/${owner}/${repo}/actions/runs/${runId}/jobs`);
    return jobs.jobs.map(j=>`${j.name}: ${j.conclusion}\n${(j.steps||[]).map(s=>`  ${s.name} - ${s.conclusion}`).join('\n')}`).join('\n\n');
  }
  return 'Logs binarios (ZIP)';
}

async function downloadArtifact(owner, repo, artifactId) {
  const { token } = config();
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/artifacts/${artifactId}/zip`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json'
    }
  });
  if (!res.ok) throw new Error(`GitHub respondio ${res.status}`);
  return res;
}

module.exports = {
  config,
  syncWorkflow,
  pushProject,
  dispatchBuild,
  findRun,
  getRun,
  getArtifacts,
  downloadArtifact,
  deleteBranch,
  deleteBranchSoon,
  deleteRun,
  cleanup
};