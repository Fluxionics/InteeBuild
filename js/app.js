'use strict';

const ghBadge = $('#ghBadge');
const alertConfig = $('#alertConfig');
const stepDots = $$('.step-dot');
const steps = $$('.step');


paintIcons();

let currentStep = 0;

const refreshHealthBadge = async () => {
  try {
    const r = await fetch('/api/health');
    const h = await r.json();
    if (h.githubReady) {
      ghBadge.textContent = 'GitHub Listo';
      ghBadge.className = 'badge badge-ok';
    } else {
      ghBadge.textContent = 'GitHub no configurado';
      ghBadge.className = 'badge badge-warn';
      show(alertConfig);
      alertConfig.innerHTML = '<b>Configuración de GitHub pendiente.</b> Agrega <code>GITHUB_TOKEN</code> e <code>INTEE_BUILDS_REPO</code> en Render o en <code>.env</code>.';
    }
  } catch (_) {
    ghBadge.textContent = 'Servidor Offline';
    ghBadge.className = 'badge badge-warn';
  }
};

function goToStep(idx) {
  if (idx < 0 || idx >= steps.length) return;
  steps[currentStep].classList.remove('active');
  stepDots[currentStep].classList.remove('active');
  if (idx > currentStep) stepDots[currentStep].classList.add('done');
  currentStep = idx;
  steps[currentStep].classList.add('active');
  stepDots[currentStep].classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (currentStep === 5) Build.runQAChecks();
  if (currentStep === 7) {
    Build.loadHistory();
    Build.loadStats();
  }
}

stepDots.forEach((dot) => {
  dot.addEventListener('click', () => {
    const target = Number(dot.dataset.step);
    if (target <= currentStep || stepDots[currentStep].classList.contains('done')) {
      goToStep(target);
    }
  });
});

onAll('.next-btn', 'click', () => goToStep(currentStep + 1));
onAll('.prev-btn', 'click', () => goToStep(currentStep - 1));




Build.bindBackButton();

refreshHealthBadge();
Build.loadStats();
