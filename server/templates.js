'use strict';

// Plantillas completas y verificadas: cada una define la configuración mínima
// necesaria para compilar a la primera (permisos + plugins + provider + UI).
// El Permission Engine autocompleta plugins y el Audit debe dar canBuild=true.

const TEMPLATES = {
  web: {
    name: 'Web estándar',
    description: 'Web genérica sin permisos especiales. Solo INTERNET.',
    config: {
      permissions: {},
      provider: 'capacitor',
      orientation: 'any',
      outputType: 'apk',
      pullRefresh: true,
      offlineScreen: true,
      downloadManager: true,
      loadingIndicator: 'spinner'
    }
  },
  pwa: {
    name: 'PWA Nativa',
    description: 'PWA con notificaciones y archivos.',
    config: {
      permissions: { notifications: true, storage: true },
      provider: 'capacitor',
      orientation: 'any',
      outputType: 'apk',
      pullRefresh: true,
      offlineScreen: true,
      downloadManager: true,
      loadingIndicator: 'spinner'
    }
  },
  radio: {
    name: 'Radio & Audio Stream',
    description: 'Audio en segundo plano con pantalla apagada. Ver docs/foreground.md.',
    config: {
      permissions: { foreground: true, wakeLock: true, notifications: true },
      provider: 'capacitor',
      orientation: 'any',
      outputType: 'apk',
      pullRefresh: false,
      offlineScreen: true,
      offlineMessage: 'Sin conexión. El stream necesita internet.',
      downloadManager: false,
      loadingIndicator: 'spinner',
      splashEnabled: false
    }
  },
  ecommerce: {
    name: 'Tienda Ecommerce',
    description: 'Fotos, ubicación y compartir productos.',
    config: {
      permissions: { storage: true, cameraMic: true, gps: true },
      provider: 'capacitor',
      orientation: 'any',
      outputType: 'apk',
      pullRefresh: true,
      offlineScreen: true,
      downloadManager: true,
      loadingIndicator: 'spinner'
    }
  },
  blog: {
    name: 'Portal Noticias / Blog',
    description: 'Lectura con notificaciones y compartir.',
    config: {
      permissions: { notifications: true, storage: true },
      provider: 'capacitor',
      orientation: 'any',
      outputType: 'apk',
      pullRefresh: true,
      offlineScreen: true,
      downloadManager: true,
      loadingIndicator: 'bar'
    }
  },
  portafolio: {
    name: 'Portafolio / CV',
    description: 'Presentación ligera con compartir.',
    config: {
      permissions: { notifications: true, storage: true },
      provider: 'capacitor',
      orientation: 'any',
      outputType: 'apk',
      pullRefresh: false,
      offlineScreen: true,
      downloadManager: true,
      loadingIndicator: 'bar'
    }
  },
  game: {
    name: 'Juego HTML5',
    description: 'Horizontal, pantalla completa, sin pausas.',
    config: {
      permissions: { wakeLock: true, vibration: true },
      provider: 'capacitor',
      orientation: 'landscape',
      fullscreen: true,
      outputType: 'apk',
      pullRefresh: false,
      offlineScreen: true,
      downloadManager: false,
      loadingIndicator: 'none',
      keepScreenOn: true
    }
  },
  edu: {
    name: 'Educación & Cursos',
    description: 'Clases con cámara, archivos y avisos.',
    config: {
      permissions: { notifications: true, storage: true, cameraMic: true },
      provider: 'capacitor',
      orientation: 'any',
      outputType: 'apk',
      pullRefresh: true,
      offlineScreen: true,
      downloadManager: true,
      loadingIndicator: 'spinner'
    }
  },
  empresa: {
    name: 'Corporativa',
    description: 'Acceso con biometría y avisos.',
    config: {
      permissions: { notifications: true, storage: true, biometric: true },
      provider: 'capacitor',
      orientation: 'portrait',
      outputType: 'aab',
      pullRefresh: false,
      offlineScreen: true,
      downloadManager: true,
      flagSecure: true,
      loadingIndicator: 'spinner'
    }
  },
  comunidad: {
    name: 'Comunidad & Social',
    description: 'Fotos, avisos y compartir.',
    config: {
      permissions: { notifications: true, cameraMic: true, storage: true },
      provider: 'capacitor',
      orientation: 'any',
      outputType: 'apk',
      pullRefresh: true,
      offlineScreen: true,
      downloadManager: true,
      loadingIndicator: 'spinner'
    }
  },
  streaming: {
    name: 'Video & Streaming',
    description: 'Video con pantalla encendida y rotación por sensor.',
    config: {
      permissions: { foreground: true, wakeLock: true },
      provider: 'capacitor',
      orientation: 'sensor',
      fullscreen: true,
      outputType: 'apk',
      pullRefresh: false,
      offlineScreen: true,
      downloadManager: false,
      loadingIndicator: 'spinner',
      keepScreenOn: true
    }
  },
  dashboard: {
    name: 'Panel & Analytics',
    description: 'Panel interno con avisos.',
    config: {
      permissions: { notifications: true },
      provider: 'capacitor',
      orientation: 'any',
      outputType: 'apk',
      pullRefresh: true,
      offlineScreen: true,
      downloadManager: true,
      flagSecure: true,
      loadingIndicator: 'bar'
    }
  },
  ai: {
    name: 'AI Web Application',
    description: 'Voz, cámara y portapapeles para apps de IA.',
    config: {
      permissions: { microphone: true, cameraMic: true },
      provider: 'capacitor',
      orientation: 'any',
      outputType: 'apk',
      pullRefresh: false,
      offlineScreen: true,
      downloadManager: false,
      loadingIndicator: 'spinner'
    }
  },
  maps: {
    name: 'Mapas & Geolocalización',
    description: 'GPS en primer plano (sin background automático).',
    config: {
      permissions: { gps: true },
      provider: 'capacitor',
      orientation: 'any',
      outputType: 'apk',
      pullRefresh: false,
      offlineScreen: true,
      offlineMessage: 'Sin conexión. Los mapas necesitan internet.',
      downloadManager: false,
      loadingIndicator: 'spinner'
    }
  },
  finanzas: {
    name: 'Finanzas & Pagos',
    description: 'Biometría y avisos, sin permisos sensibles.',
    config: {
      permissions: { biometric: true, notifications: true },
      provider: 'capacitor',
      orientation: 'portrait',
      outputType: 'aab',
      pullRefresh: false,
      offlineScreen: true,
      downloadManager: false,
      flagSecure: true,
      blockSelection: true,
      loadingIndicator: 'spinner'
    }
  },
  eventos: {
    name: 'Eventos & Tickets',
    description: 'Cámara (QR) y ubicación del evento.',
    config: {
      permissions: { cameraMic: true, gps: true },
      provider: 'capacitor',
      orientation: 'any',
      outputType: 'apk',
      pullRefresh: true,
      offlineScreen: true,
      downloadManager: true,
      loadingIndicator: 'spinner'
    }
  }
};

// Cara HTML starter: el usuario pone SU html como cara y todo lo demás es nativo.
// Cada plantilla trae una cara de ejemplo lista para editar o reemplazar.
function makeFace(title, accent, body) {
  return '<!DOCTYPE html>\n<html lang="es">\n<head>\n<meta charset="UTF-8" />\n'
    + '<meta name="viewport" content="width=device-width, initial-scale=1.0" />\n'
    + '<title>' + title + '</title>\n<style>\n'
    + '*{box-sizing:border-box}body{margin:0;font-family:sans-serif;background:#0b0f1a;color:#f9fafb;padding:20px 16px 90px}\n'
    + 'h1{font-size:22px;margin:6px 0 4px}p{color:#9ca3af;font-size:14px}\n'
    + '.card{background:#111827;border:1px solid #1f2937;border-radius:12px;padding:16px;margin:12px 0}\n'
    + '.btn{display:inline-block;background:' + accent + ';color:#fff;border:none;border-radius:10px;padding:12px 20px;font-size:15px;font-weight:700;margin:6px 4px 6px 0}\n'
    + '.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}\n'
    + 'img{max-width:100%;border-radius:10px}\n'
    + '</style>\n</head>\n<body>\n' + body + '\n</body>\n</html>';
}

const FACES = {
  web: ['Mi Web', '#6366f1', '<h1>Mi Web</h1><p>Reemplaza este HTML con tu cara: todo lo demás (permisos, splash, menú) es nativo.</p><div class="card"><button class="btn" onclick="location.reload()">Recargar</button></div>'],
  pwa: ['Mi PWA', '#6366f1', '<h1>Mi PWA</h1><p>Instalable y offline gracias al service worker que InteeBuild genera solo.</p><div class="card"><button class="btn" onclick="alert(\'PWA lista\')">Probar</button></div>'],
  radio: ['Mi Radio', '#10b981', '<h1>📻 Mi Radio</h1><p>El audio sigue con pantalla apagada (Foreground + Wake Lock nativos).</p><div class="card"><audio id="p" src="https://example.com/stream.mp3" preload="none" style="width:100%"></audio><br><button class="btn" onclick="document.getElementById(\'p\').play()">▶ Play</button><button class="btn" onclick="document.getElementById(\'p\').pause()">⏸ Pausa</button></div><p>No pauses en visibilitychange: el servicio nativo mantiene el proceso.</p>'],
  ecommerce: ['Mi Tienda', '#f59e0b', '<h1>🛍 Mi Tienda</h1><p>Catálogo de ejemplo: cambia productos por los tuyos.</p><div class="grid"><div class="card"><b>Producto 1</b><p>$19.99</p><button class="btn" onclick="if(window.Intee)Intee.share({title:\'Producto 1\',url:location.href})">Compartir</button></div><div class="card"><b>Producto 2</b><p>$29.99</p><button class="btn" onclick="if(window.Intee)Intee.share({title:\'Producto 2\',url:location.href})">Compartir</button></div></div>'],
  blog: ['Mi Blog', '#38bdf8', '<h1>📰 Mi Blog</h1><div class="card"><b>Artículo 1</b><p>Resumen de la noticia…</p></div><div class="card"><b>Artículo 2</b><p>Resumen de la noticia…</p></div>'],
  portafolio: ['Mi Portafolio', '#8b5cf6', '<h1>👋 Hola, soy Yo</h1><p>Desarrollador · Diseñador · Creador</p><div class="card"><b>Proyecto 1</b><p>Descripción breve.</p></div><div class="card"><b>Proyecto 2</b><p>Descripción breve.</p></div>'],
  game: ['Mi Juego', '#ef4444', '<h1>🎮 Mi Juego</h1><div class="card"><canvas id="g" width="300" height="200" style="width:100%;background:#020617;border-radius:8px"></canvas><br><button class="btn" onclick="document.documentElement.requestFullscreen&&document.documentElement.requestFullscreen()">Pantalla completa</button></div><p>Pon tu juego HTML5 aquí: el nativo fija horizontal y pantalla encendida.</p>'],
  edu: ['Mis Cursos', '#22d3a7', '<h1>🎓 Mis Cursos</h1><div class="card"><b>Curso 1: HTML</b><p>12 lecciones</p><button class="btn">Continuar</button></div><div class="card"><b>Curso 2: CSS</b><p>9 lecciones</p><button class="btn">Continuar</button></div>'],
  empresa: ['Mi Empresa', '#64748b', '<h1>🏢 Mi Empresa</h1><p>Soluciones profesionales.</p><div class="card"><button class="btn" onclick="if(window.Intee&&Intee.biometric)Intee.biometric(\'Acceder\');else alert(\'Biometría solo en la app instalada\')">🔒 Entrar con huella</button></div>'],
  comunidad: ['Mi Comunidad', '#ec4899', '<h1>💬 Mi Comunidad</h1><div class="card"><b>Ana</b><p>¡Bienvenidos al grupo!</p><button class="btn" onclick="if(window.Intee)Intee.share({title:\'Comunidad\',url:location.href})">Compartir</button></div><div class="card"><b>Luis</b><p>Evento este sábado 🎉</p></div>'],
  streaming: ['Mi Streaming', '#ef4444', '<h1>🎬 Mi Streaming</h1><div class="card"><video src="https://example.com/video.mp4" controls playsinline style="width:100%;border-radius:8px"></video></div><p>El nativo mantiene la pantalla encendida durante el video.</p>'],
  dashboard: ['Mi Panel', '#38bdf8', '<h1>📊 Mi Panel</h1><div class="grid"><div class="card"><b>1,240</b><p>Usuarios</p></div><div class="card"><b>98%</b><p>Uptime</p></div></div>'],
  ai: ['Mi AI', '#a78bfa', '<h1>✨ Mi AI</h1><div class="card"><p><b>AI:</b> Hola, ¿en qué te ayudo?</p></div><div class="card"><button class="btn" onclick="if(navigator.mediaDevices)navigator.mediaDevices.getUserMedia({audio:true}).then(()=>alert(\'Micrófono OK\')).catch(()=>alert(\'Permiso denegado\'))">🎤 Hablar</button></div>'],
  maps: ['Mis Mapas', '#22c55e', '<h1>📍 Mis Mapas</h1><div class="card"><button class="btn" onclick="if(window.Intee&&Intee.location)Intee.location().then(l=>document.getElementById(\'c\').textContent=l.latitude+\', \'+l.longitude);else if(navigator.geolocation)navigator.geolocation.getCurrentPosition(p=>document.getElementById(\'c\').textContent=p.coords.latitude+\', \'+p.coords.longitude)">Obtener ubicación</button><p id="c">—</p></div>'],
  finanzas: ['Mis Finanzas', '#10b981', '<h1>💰 Mis Finanzas</h1><div class="card"><b>Balance</b><h1>$12,450</h1></div><div class="card"><button class="btn" onclick="if(window.Intee&&Intee.biometric)Intee.biometric(\'Ver balance\');else alert(\'Biometría solo en la app instalada\')">🔒 Desbloquear</button></div>'],
  eventos: ['Mis Eventos', '#f59e0b', '<h1>🎟 Mis Eventos</h1><div class="card"><b>Concierto · Sáb 20:00</b><p>Estadio Central</p><button class="btn" onclick="if(window.Intee&&Intee.camera)Intee.camera();else alert(\'QR solo en la app instalada\')">📷 Escanear ticket QR</button></div>']
};

Object.entries(FACES).forEach(([id, f]) => {
  if (TEMPLATES[id]) TEMPLATES[id].faceHtml = makeFace(f[0], f[1], f[2]);
});

function getTemplate(id) {
  return TEMPLATES[String(id || '').toLowerCase()] || null;
}

function listTemplates() {
  return Object.entries(TEMPLATES).map(([id, t]) => ({ id, name: t.name, description: t.description, hasFace: !!t.faceHtml }));
}

// Fusiona plantilla como base y los valores del usuario por encima.
// Así "subir el código y compilar" usa siempre una config completa.
function applyTemplate(raw, templateId) {
  const t = getTemplate(templateId);
  if (!t) return raw;
  const base = t.config || {};
  return {
    ...base,
    ...(raw || {}),
    permissions: { ...(base.permissions || {}), ...((raw || {}).permissions || {}) },
    plugins: { ...(base.plugins || {}), ...((raw || {}).plugins || {}) }
  };
}

module.exports = { TEMPLATES, getTemplate, listTemplates, applyTemplate };
