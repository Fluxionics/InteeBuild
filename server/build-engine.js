'use strict';

const crypto = require('crypto');

const { gh, generator } = require('./deps');
const { builds, checkRateLimit, addHistory, updateHistory } = require('./store');
const { deriveOutputs } = require('./generator/config');

async function fireWebhook(url, payload) {
  if (!url) return;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'InteeBuild-Webhook/1.0' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000)
    });
  } catch (_) {}
}

function pollBuild(g, state) {
  let attempts = 0;
  const timer = setInterval(async () => {
    attempts++;
    try {
      if (!state.runId) {
        const run = await gh.findRun(g.owner, g.repo, state.branch);
        if (run) {
          state.runId = run.id;
          state.runUrl = run.html_url;
          state.step = 'Compilando APK';
          updateHistory(state.id, { runUrl: run.html_url });
        }
      } else {
        const run = await gh.getRun(g.owner, g.repo, state.runId);
        state.runUrl = run.html_url;
        if (run.status === 'completed') {
          clearInterval(timer);
          runCleanup(g);


          try { gh.deleteBranchSoon(g.owner, g.repo, state.branch, 60000); } catch (_) {}
          if (run.conclusion === 'success') {
            state.status = 'success';
            state.step = 'Build completado';
            try {
              const arts = await gh.getArtifacts(g.owner, g.repo, state.runId);
              state.artifacts = arts.map(a => ({ name: a.name, url: a.archive_download_url, size: a.size_in_bytes }));
              if (arts[0]) { state.apkUrl = arts[0].archive_download_url; state.artifactName = arts[0].name; }
            } catch (_) {}
            const duration = Math.round((Date.now() - state.createdAt) / 1000);
            updateHistory(state.id, { status: 'success', runUrl: run.html_url, apkUrl: state.apkUrl, artifacts: state.artifacts, duration });
            await fireWebhook(state.webhookUrl, {
              event: 'build.completed', buildId: state.id, status: 'success',
              appName: state.appName, runUrl: state.runUrl, duration,
              apkUrl: `/api/download/${state.id}`,
              aabUrl: state.artifacts && state.artifacts.some(a => a.name.includes('aab')) ? `/api/download/${state.id}/aab` : null
            });
          } else {
            state.status = 'failed';
            state.step = 'Build fallido';
            state.error = `GitHub Actions concluyo: ${run.conclusion}`;
            updateHistory(state.id, { status: 'failed', error: state.error });
            await fireWebhook(state.webhookUrl, { event: 'build.failed', buildId: state.id, status: 'failed', error: state.error, runUrl: state.runUrl });
            try { gh.deleteBranchSoon(g.owner, g.repo, state.branch, 60000); } catch (_) {}
          }
        } else {
          state.step = run.status === 'queued' ? 'En cola en GitHub Actions' : 'Compilando APK';
        }
      }
    } catch (err) {
      state.step = `Reintentando (${err.message})`;
    }

    if (attempts >= 200) {
      clearInterval(timer);
      if (state.status !== 'success') {
        state.status = 'failed';
        state.error = state.error || 'Tiempo de espera agotado consultando GitHub';
        updateHistory(state.id, { status: 'failed', error: state.error });
        fireWebhook(state.webhookUrl, { event: 'build.failed', buildId: state.id, status: 'failed', error: state.error });
        try { gh.deleteBranchSoon(g.owner, g.repo, state.branch, 60000); } catch (_) {}
      }
    }
  }, 6000);
}

async function startBuild(cfg, ip) {
  const g = gh.config();
  if (!g.ready) throw Object.assign(new Error('GitHub no esta configurado. Define GITHUB_TOKEN e INTEE_BUILDS_REPO en el archivo .env'), { status: 503 });
  if (!checkRateLimit(ip)) throw Object.assign(new Error('Limite de builds alcanzado (10 por hora). Intenta despues.'), { status: 429 });

  const id = crypto.randomBytes(4).toString('hex');
  cfg._buildId = id;
  const branch = `build-${id}`;
  const files = generator.generateFiles(cfg);
  const outputs = deriveOutputs(cfg);

  const state = {
    id, branch, appName: cfg.appName, status: 'queued',
    step: 'Enviando proyecto a GitHub', createdAt: Date.now(),
    runUrl: null, runId: null, apkUrl: null, outputType: cfg.outputType,
    outputs, error: null, webhookUrl: cfg.webhookUrl || ''
  };
  builds.set(id, state);

  const { iconBase64, keystoreBase64, iosP12Base64, iosProfileBase64, keystorePassword, keyPassword, iosP12Password, parsed, ...safeCfg } = cfg;
  addHistory({
    id, appName: cfg.appName, status: 'queued', outputType: cfg.outputType,
    outputs, platform: cfg.platform,
    createdAt: state.createdAt, runUrl: null, apkUrl: null, error: null,
    config: safeCfg
  });

  try {
    state.step = 'Sincronizando workflow';
    await gh.syncWorkflow(g.owner, g.repo, g.defaultBranch, generator.WORKFLOW_YML);
    state.step = 'Subiendo proyecto';
    await gh.pushProject(g.owner, g.repo, branch, files, g.defaultBranch);
    state.status = 'building';
    state.step = 'Lanzando compilacion en GitHub Actions';
    await gh.dispatchBuild(g.owner, g.repo, branch, id, cfg.outputType, cfg.platform, outputs);
    updateHistory(id, { status: 'building' });
    pollBuild(g, state);
  } catch (err) {
    state.status = 'error';
    state.step = 'Error';
    state.error = err.message;
    updateHistory(id, { status: 'error', error: err.message });
    await fireWebhook(state.webhookUrl, { event: 'build.error', buildId: id, status: 'error', error: err.message });
  }

  return { id, branch, status: state.status };
}

function runCleanup(g) {
  if (!g.ready) return;
  setTimeout(() => {
    gh.cleanup(g.owner, g.repo).then(
      r => console.log(`[cleanup] ramas:${r.branches} runs:${r.runs} artifacts:${r.artifacts}`),
      () => {}
    );
  }, 2000);
}

module.exports = { fireWebhook, startBuild, pollBuild, runCleanup };
