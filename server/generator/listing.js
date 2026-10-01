'use strict';

function featureBullets(cfg) {
  const bullets = [];
  if (cfg.permissions.foreground) bullets.push('audio en segundo plano');
  if (cfg.permissions.gps) bullets.push('ubicación GPS');
  if (cfg.permissions.cameraMic) bullets.push('cámara y micrófono');
  if (cfg.drawerEnabled) bullets.push('menú lateral nativo');
  if (cfg.bottomNavEnabled) bullets.push('navegación inferior');
  if (cfg.offlineScreen) bullets.push('pantalla sin conexión');
  return bullets;
}

function buildPlayListing(cfg) {
  const perms = Object.entries(cfg.permissions || {}).filter(([, v]) => v).map(([k]) => k);
  const feat = featureBullets(cfg);

  const shortDesc = (cfg.description || ((cfg.appName || 'Mi app') + ' — app Android nativa generada con InteeBuild.')).slice(0, 80);
  const fullDesc = [
    (cfg.description || (cfg.appName || 'Mi app') + ' para Android.'),
    '',
    'Características:',
    ...(feat.length ? feat.map(f => '• ' + f) : ['• Acceso rápido desde tu teléfono']),
    '• Funciona con tu web favorita dentro de la app',
    '',
    'Privacidad: esta app solicita únicamente los permisos necesarios (' + (perms.length ? perms.join(', ') : 'ninguno adicional') + ').'
  ].join('\n').slice(0, 4000);

  return {
    title: String(cfg.appName || 'Mi app').slice(0, 30),
    shortDescription: shortDesc,
    fullDescription: fullDesc,
    keywords: ['android', 'app', cfg.packageName || ''].filter(Boolean).join(', ').slice(0, 100),
    category: 'Herramientas',
    packageName: cfg.packageName || '',
    version: (cfg.versionName || '1.0.0') + ' (' + (cfg.versionCode || 1) + ')'
  };
}

module.exports = { buildPlayListing };
