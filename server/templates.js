'use strict';

// Plantillas completas y verificadas: cada una define la configuración mínima
// necesaria para compilar a la primera (permisos + plugins + provider + UI).
// El Permission Engine autocompleta plugins y el Audit debe dar canBuild=true.

const TEMPLATES = {
  web: {
    name: 'Web estándar',
    description: 'Web genérica sin permisos especiales. Solo INTERNET. Ideal para sitios informativos simples.',
    config: {
      permissions: {},
      provider: 'capacitor',
      orientation: 'any',
      outputType: 'apk',
      pullRefresh: true,
      offlineScreen: true,
      downloadManager: true,
      loadingIndicator: 'spinner',
      statusBarStyle: 'default',
      navigationBarStyle: 'default',
      backgroundColor: '#ffffff',
      allowedHttpDomains: []
    }
  },
  pwa: {
    name: 'PWA Nativa',
    description: 'PWA con notificaciones, archivos y soporte offline completo. Detecta e instala manifest web.',
    config: {
      permissions: { notifications: true, storage: true },
      provider: 'capacitor',
      orientation: 'any',
      outputType: 'apk',
      pullRefresh: true,
      offlineScreen: true,
      downloadManager: true,
      loadingIndicator: 'spinner',
      statusBarStyle: 'default',
      navigationBarStyle: 'default',
      backgroundColor: '#ffffff',
      webManifest: true,
      serviceWorker: true
    }
  },
  radio: {
    name: 'Radio & Audio Stream',
    description: 'Audio 100% nativo (Java MediaPlayer) con pantalla apagada. Pon tu URL del stream. Ver docs/foreground.md.',
    config: {
      permissions: { foreground: true, wakeLock: true, notifications: true },
      nativeAudio: true,
      nativeAutoplay: true,
      provider: 'capacitor',
      orientation: 'any',
      outputType: 'apk',
      pullRefresh: false,
      offlineScreen: true,
      offlineMessage: 'Sin conexión. El stream necesita internet.',
      downloadManager: false,
      loadingIndicator: 'spinner',
      splashEnabled: false,
      keepScreenOn: false,
      statusBarStyle: 'default',
      navigationBarStyle: 'default',
      backgroundColor: '#1a1a2e',
      mediaSession: true,
      audioFocus: true
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
    description: 'Audio nativo + video con pantalla encendida y rotación por sensor.',
    config: {
      permissions: { foreground: true, wakeLock: true },
      nativeAudio: true,
      nativeAutoplay: false,
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
      loadingIndicator: 'spinner',
      statusBarStyle: 'default',
      navigationBarStyle: 'default',
      backgroundColor: '#ffffff'
    }
  },
  podcast: {
    name: 'Podcast & Audio On-Demand',
    description: 'Reproductor de podcast con lista de episodios, descargas y controles de medios.',
    config: {
      permissions: { foreground: true, wakeLock: true, notifications: true, storage: true },
      nativeAudio: true,
      nativeAutoplay: false,
      provider: 'capacitor',
      orientation: 'any',
      outputType: 'apk',
      pullRefresh: true,
      offlineScreen: true,
      offlineMessage: 'Sin conexión. Descarga episodios para escuchar offline.',
      downloadManager: true,
      loadingIndicator: 'spinner',
      statusBarStyle: 'default',
      navigationBarStyle: 'default',
      backgroundColor: '#1a1a2e',
      mediaSession: true,
      audioFocus: true
    }
  },
  salud: {
    name: 'Salud & Fitness',
    description: 'Sensores de actividad, notificaciones de recordatorios y datos de salud.',
    config: {
      permissions: { sensors: true, notifications: true, activityRecognition: true },
      provider: 'capacitor',
      orientation: 'portrait',
      outputType: 'apk',
      pullRefresh: false,
      offlineScreen: true,
      downloadManager: false,
      loadingIndicator: 'spinner',
      statusBarStyle: 'default',
      navigationBarStyle: 'default',
      backgroundColor: '#ffffff',
      keepScreenOn: false
    }
  },
  delivery: {
    name: 'Delivery & Rastreo',
    description: 'GPS en tiempo real, notificaciones y cámara para evidencias de entrega.',
    config: {
      permissions: { gps: true, gpsBackground: true, notifications: true, cameraMic: true },
      provider: 'capacitor',
      orientation: 'portrait',
      outputType: 'apk',
      pullRefresh: false,
      offlineScreen: true,
      offlineMessage: 'Sin conexión. Se necesita GPS para rastreo.',
      downloadManager: false,
      loadingIndicator: 'spinner',
      statusBarStyle: 'default',
      navigationBarStyle: 'default',
      backgroundColor: '#ffffff',
      keepScreenOn: true
    }
  },
  banking: {
    name: 'Banking & FinTech',
    description: 'Biometría segura, notificaciones de transacciones y protección anti-screenshots.',
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
      loadingIndicator: 'spinner',
      statusBarStyle: 'default',
      navigationBarStyle: 'default',
      backgroundColor: '#ffffff',
      screenCaptureSecurity: true
    }
  },
  social: {
    name: 'Social Network',
    description: 'Red social completa con fotos, videos, ubicación y notificaciones en tiempo real.',
    config: {
      permissions: { cameraMic: true, storage: true, notifications: true, gps: true },
      provider: 'capacitor',
      orientation: 'any',
      outputType: 'apk',
      pullRefresh: true,
      offlineScreen: true,
      downloadManager: true,
      loadingIndicator: 'spinner',
      statusBarStyle: 'default',
      navigationBarStyle: 'default',
      backgroundColor: '#ffffff',
      deepLinks: true
    }
  },
  travel: {
    name: 'Travel & Turismo',
    description: 'Mapas, GPS, cámara para fotos y notificaciones de viajes.',
    config: {
      permissions: { gps: true, cameraMic: true, storage: true, notifications: true },
      provider: 'capacitor',
      orientation: 'any',
      outputType: 'apk',
      pullRefresh: true,
      offlineScreen: true,
      offlineMessage: 'Sin conexión. Descarga mapas para uso offline.',
      downloadManager: true,
      loadingIndicator: 'spinner',
      statusBarStyle: 'default',
      navigationBarStyle: 'default',
      backgroundColor: '#ffffff'
    }
  },
  news: {
    name: 'News & Medios',
    description: 'Portal de noticias con notificaciones push, offline reader y compartir contenido.',
    config: {
      permissions: { notifications: true, storage: true },
      provider: 'capacitor',
      orientation: 'portrait',
      outputType: 'apk',
      pullRefresh: true,
      offlineScreen: true,
      downloadManager: true,
      loadingIndicator: 'bar',
      statusBarStyle: 'default',
      navigationBarStyle: 'default',
      backgroundColor: '#ffffff',
      textZoom: true
    }
  },
  fitness: {
    name: 'Fitness & Deportes',
    description: 'Seguimiento de entrenamientos con sensores, GPS y notificaciones de objetivos.',
    config: {
      permissions: { sensors: true, gps: true, activityRecognition: true, notifications: true, wakeLock: true },
      provider: 'capacitor',
      orientation: 'portrait',
      outputType: 'apk',
      pullRefresh: false,
      offlineScreen: true,
      downloadManager: false,
      loadingIndicator: 'spinner',
      statusBarStyle: 'default',
      navigationBarStyle: 'default',
      backgroundColor: '#1a1a2e',
      keepScreenOn: true
    }
  },
  food: {
    name: 'Food Delivery',
    description: 'Pedidos de comida con GPS, notificaciones y cámara para fotos de pedidos.',
    config: {
      permissions: { gps: true, notifications: true, cameraMic: true, storage: true },
      provider: 'capacitor',
      orientation: 'portrait',
      outputType: 'apk',
      pullRefresh: true,
      offlineScreen: true,
      downloadManager: true,
      loadingIndicator: 'spinner',
      statusBarStyle: 'default',
      navigationBarStyle: 'default',
      backgroundColor: '#ffffff'
    }
  },
  realestate: {
    name: 'Real Estate',
    description: 'Búsqueda de propiedades con GPS, cámara para fotos y llamadas directas.',
    config: {
      permissions: { gps: true, cameraMic: true, storage: true, phone: true },
      provider: 'capacitor',
      orientation: 'portrait',
      outputType: 'apk',
      pullRefresh: true,
      offlineScreen: true,
      downloadManager: true,
      loadingIndicator: 'spinner',
      statusBarStyle: 'default',
      navigationBarStyle: 'default',
      backgroundColor: '#ffffff'
    }
  },
  marketplace: {
    name: 'Marketplace',
    description: 'Comercio electrónico completo con fotos, ubicación y pagos integrados.',
    config: {
      permissions: { cameraMic: true, storage: true, gps: true, notifications: true },
      provider: 'capacitor',
      orientation: 'portrait',
      outputType: 'apk',
      pullRefresh: true,
      offlineScreen: true,
      downloadManager: true,
      loadingIndicator: 'spinner',
      statusBarStyle: 'default',
      navigationBarStyle: 'default',
      backgroundColor: '#ffffff'
    }
  },
  emergency: {
    name: 'Emergency & SOS',
    description: 'App de emergencia con GPS preciso, llamada automática y notificaciones.',
    config: {
      permissions: { gps: true, gpsBackground: true, phone: true, notifications: true, cameraMic: true },
      provider: 'capacitor',
      orientation: 'portrait',
      outputType: 'apk',
      pullRefresh: false,
      offlineScreen: true,
      downloadManager: false,
      loadingIndicator: 'spinner',
      statusBarStyle: 'default',
      navigationBarStyle: 'default',
      backgroundColor: '#ef4444',
      keepScreenOn: true,
      highPriority: true
    }
  },
  lab: {
    name: 'Permission Test Lab',
    description: 'APK de pruebas: ejecuta cada capacidad y reporta resultado real en el dispositivo.',
    config: {
      permissions: { notifications: true, cameraMic: true, microphone: true, gps: true, vibration: true, storage: true, bluetoothScan: true, bluetoothConnect: true, biometric: true, nfc: true },
      provider: 'capacitor',
      orientation: 'portrait',
      outputType: 'apk',
      pullRefresh: false,
      offlineScreen: false,
      downloadManager: false,
      loadingIndicator: 'none'
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
  radio: ['Mi Radio', '#10b981', '<h1><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="2"/><path d="M16.24 7.76l-2.12 2.12"/><path d="M12 2v4"/><path d="M12 18v4"/><path d="M4.93 4.93l2.12 2.12"/><path d="M19.07 4.93l-2.12 2.12"/><path d="M4.93 19.07l2.12-2.12"/><path d="M16.24 16.24l2.12 2.12"/></svg> Mi Radio</h1><p>Audio 100% nativo: suena con pantalla apagada. Cambia la URL por tu servidor.</p><div class="card"><input id="s" value="https://example.com/stream.mp3" style="width:100%;padding:10px;border-radius:8px;border:1px solid #1f2937;background:#020617;color:#fff" /><br><br><button class="btn" onclick="nPlay()"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> Play nativo</button><button class="btn" onclick="nPause()"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Pausa</button><p id="st">Listo</p></div><script>function nPlay(){var u=document.getElementById(\'s\').value;if(window.InteeAudio){try{InteeAudio.play(u);document.getElementById(\'st\').textContent=\'Sonando en nativo…\';}catch(e){fallback(u);}}else fallback(u);}function nPause(){if(window.InteeAudio){try{InteeAudio.pause();}catch(e){}}var a=document.getElementById(\'p\');if(a)a.pause();document.getElementById(\'st\').textContent=\'En pausa\';}function fallback(u){var a=document.getElementById(\'p\');if(!a){a=document.createElement(\'audio\');a.id=\'p\';a.preload=\'none\';document.body.appendChild(a);}a.src=u;a.load();a.play();document.getElementById(\'st\').textContent=\'Sonando en web (fallback)…\';}document.addEventListener(\'visibilitychange\',function(){});</script>'],
  ecommerce: ['Mi Tienda', '#f59e0b', '<h1><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg> Mi Tienda</h1><p>Catálogo de ejemplo: cambia productos por los tuyos.</p><div class="grid"><div class="card"><b>Producto 1</b><p>$19.99</p><button class="btn" onclick="if(window.Intee)Intee.share({title:\'Producto 1\',url:location.href})">Compartir</button></div><div class="card"><b>Producto 2</b><p>$29.99</p><button class="btn" onclick="if(window.Intee)Intee.share({title:\'Producto 2\',url:location.href})">Compartir</button></div></div>'],
  blog: ['Mi Blog', '#38bdf8', '<h1><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg> Mi Blog</h1><div class="card"><b>Artículo 1</b><p>Resumen de la noticia…</p></div><div class="card"><b>Artículo 2</b><p>Resumen de la noticia…</p></div>'],
  portafolio: ['Mi Portafolio', '#8b5cf6', '<h1><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> Hola, soy Yo</h1><p>Desarrollador · Diseñador · Creador</p><div class="card"><b>Proyecto 1</b><p>Descripción breve.</p></div><div class="card"><b>Proyecto 2</b><p>Descripción breve.</p></div>'],
  game: ['Mi Juego', '#ef4444', '<h1><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 12h4"/><path d="M8 10v4"/><line x1="15" y1="13" x2="15.01" y2="13"/><line x1="18" y1="11" x2="18.01" y2="11"/></svg> Mi Juego</h1><div class="card"><canvas id="g" width="300" height="200" style="width:100%;background:#020617;border-radius:8px"></canvas><br><button class="btn" onclick="document.documentElement.requestFullscreen&&document.documentElement.requestFullscreen()">Pantalla completa</button></div><p>Pon tu juego HTML5 aquí: el nativo fija horizontal y pantalla encendida.</p>'],
  edu: ['Mis Cursos', '#22d3a7', '<h1><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg> Mis Cursos</h1><div class="card"><b>Curso 1: HTML</b><p>12 lecciones</p><button class="btn">Continuar</button></div><div class="card"><b>Curso 2: CSS</b><p>9 lecciones</p><button class="btn">Continuar</button></div>'],
  empresa: ['Mi Empresa', '#64748b', '<h1><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/></svg> Mi Empresa</h1><p>Soluciones profesionales.</p><div class="card"><button class="btn" onclick="if(window.Intee&&Intee.biometric)Intee.biometric(\'Acceder\');else alert(\'Biometría solo en la app instalada\')"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Entrar con huella</button></div>'],
  comunidad: ['Mi Comunidad', '#ec4899', '<h1><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg> Mi Comunidad</h1><div class="card"><b>Ana</b><p>¡Bienvenidos al grupo!</p><button class="btn" onclick="if(window.Intee)Intee.share({title:\'Comunidad\',url:location.href})">Compartir</button></div><div class="card"><b>Luis</b><p>Evento este sábado</p></div>'],
  streaming: ['Mi Streaming', '#ef4444', '<h1><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/></svg> Mi Streaming</h1><div class="card"><input id="s" value="https://example.com/stream.mp3" style="width:100%;padding:10px;border-radius:8px;border:1px solid #1f2937;background:#020617;color:#fff" /><br><br><button class="btn" onclick="if(window.InteeAudio){InteeAudio.play(document.getElementById(\'s\').value)}else{var a=document.getElementById(\'p\');if(!a){a=document.createElement(\'audio\');a.id=\'p\';document.body.appendChild(a);}a.src=document.getElementById(\'s\').value;a.load();a.play();}"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> Audio nativo</button><button class="btn" onclick="if(window.InteeAudio){InteeAudio.pause()}"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Pausa</button></div><div class="card"><video src="https://example.com/video.mp4" controls playsinline style="width:100%;border-radius:8px"></video></div><p>Audio en Java nativo + pantalla encendida.</p>'],
  dashboard: ['Mi Panel', '#38bdf8', '<h1><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg> Mi Panel</h1><div class="grid"><div class="card"><b>1,240</b><p>Usuarios</p></div><div class="card"><b>98%</b><p>Uptime</p></div></div>'],
  ai: ['Mi AI', '#a78bfa', '<h1><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a10 10 0 1 0 10 10H12V2z"/><path d="M12 2a10 10 0 0 1 10 10h-10V2z"/><path d="M12 12v10a10 10 0 0 1-10-10h10z"/></svg> Mi AI</h1><div class="card"><p><b>AI:</b> Hola, ¿en qué te ayudo?</p></div><div class="card"><button class="btn" onclick="if(navigator.mediaDevices)navigator.mediaDevices.getUserMedia({audio:true}).then(()=>alert(\'Micrófono OK\')).catch(()=>alert(\'Permiso denegado\'))"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg> Hablar</button></div>'],
  maps: ['Mis Mapas', '#22c55e', '<h1><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><circle cx="12" cy="12" r="3"/></svg> Mis Mapas</h1><div class="card"><button class="btn" onclick="if(window.Intee&&Intee.location)Intee.location().then(l=>document.getElementById(\'c\').textContent=l.latitude+\', \'+l.longitude);else if(navigator.geolocation)navigator.geolocation.getCurrentPosition(p=>document.getElementById(\'c\').textContent=p.coords.latitude+\', \'+p.coords.longitude)">Obtener ubicación</button><p id="c">—</p></div>'],
  finanzas: ['Mis Finanzas', '#10b981', '<h1><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> Mis Finanzas</h1><div class="card"><b>Balance</b><h1>$12,450</h1></div><div class="card"><button class="btn" onclick="if(window.Intee&&Intee.biometric)Intee.biometric(\'Ver balance\');else alert(\'Biometría solo en la app instalada\')"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Desbloquear</button></div>'],
  eventos: ['Mis Eventos', '#f59e0b', '<h1><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> Mis Eventos</h1><div class="card"><b>Concierto · Sáb 20:00</b><p>Estadio Central</p><button class="btn" onclick="if(window.Intee&&Intee.camera)Intee.camera();else alert(\'QR solo en la app instalada\')"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg> Escanear ticket QR</button></div>'],
  podcast: ['Mi Podcast', '#8b5cf6', '<h1><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg> Mi Podcast</h1><div class="card"><b>Episodio 1: Introducción</b><p>45 min · Hoy</p><button class="btn" onclick="if(window.InteeAudio)InteeAudio.play(\'https://example.com/ep1.mp3\')"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> Reproducir</button></div><div class="card"><b>Episodio 2: Avanzado</b><p>32 min · Ayer</p><button class="btn" onclick="if(window.InteeAudio)InteeAudio.play(\'https://example.com/ep2.mp3\')"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> Reproducir</button></div>'],
  salud: ['Mi Salud', '#22c55e', '<h1><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg> Mi Salud</h1><div class="grid"><div class="card"><b>2,340</b><p>Pasos hoy</p></div><div class="card"><b>85</b><p>FC promedio</p></div></div><div class="card"><button class="btn" onclick="alert(\'Actividad registrada\')"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 5-1 5-1 4-1 8-2 8-2z"/><circle cx="12" cy="12" r="10"/></svg> Registrar ejercicio</button></div>'],
  delivery: ['Mi Delivery', '#f59e0b', '<h1><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg> Mi Delivery</h1><div class="card"><b>Pedido #1234</b><p>En camino · 15 min</p><button class="btn" onclick="if(window.Intee&&Intee.location)Intee.location().then(l=>alert(\'GPS: \'+l.latitude+\',\'+l.longitude))"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><circle cx="12" cy="12" r="3"/></svg> Rastrear</button></div><div class="card"><button class="btn" onclick="if(window.Intee&&Intee.camera)Intee.camera()"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg> Foto de entrega</button></div>'],
  banking: ['Mi Banco', '#3b82f6', '<h1><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg> Mi Banco</h1><div class="card"><b>Saldo</b><h1>$15,230.50</h1></div><div class="card"><button class="btn" onclick="if(window.Intee&&Intee.biometric)Intee.biometric(\'Acceder a cuenta\');else alert(\'Biometría solo en la app instalada\')"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Acceder con huella</button></div>'],
  social: ['Mi Social', '#ec4899', '<h1><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg> Mi Social</h1><div class="card"><b>María</b><p>¡Hola a todos!</p><button class="btn" onclick="if(window.Intee)Intee.share({title:\'Post\',url:location.href})">Compartir</button></div><div class="card"><button class="btn" onclick="if(window.Intee&&Intee.camera)Intee.camera()"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg> Nueva foto</button></div>'],
  travel: ['Mi Viaje', '#06b6d4', '<h1><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg> Mi Viaje</h1><div class="card"><b>París, Francia</b><p>15-20 Octubre 2024</p><button class="btn" onclick="if(window.Intee&&Intee.location)Intee.location().then(l=>alert(\'Ubicación: \'+l.latitude+\',\'+l.longitude))"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><circle cx="12" cy="12" r="3"/></svg> Ver en mapa</button></div><div class="card"><button class="btn" onclick="if(window.Intee&&Intee.camera)Intee.camera()"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg> Foto del viaje</button></div>'],
  news: ['Mi Noticias', '#f97316', '<h1><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg> Mi Noticias</h1><div class="card"><b>Tecnología</b><p>Nuevo lanzamiento de IA revoluciona el sector</p></div><div class="card"><b>Deportes</b><p>Equipo local gana campeonato</p></div>'],
  fitness: ['Mi Fitness', '#ef4444', '<h1><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg> Mi Fitness</h1><div class="grid"><div class="card"><b>45</b><p>Minutos hoy</p></div><div class="card"><b>320</b><p>Calorías</p></div></div><div class="card"><button class="btn" onclick="alert(\'Entrenamiento iniciado\')"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M10 8l6 4-6 4V8z"/></svg> Iniciar entrenamiento</button></div>'],
  food: ['Mi Comida', '#f97316', '<h1><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg> Mi Comida</h1><div class="card"><b>Pedido #5678</b><p>Pizza Margarita · $12.99</p><button class="btn" onclick="alert(\'Pedido confirmado\')"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Confirmar</button></div><div class="card"><button class="btn" onclick="if(window.Intee&&Intee.camera)Intee.camera()"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg> Foto del plato</button></div>'],
  realestate: ['Mi Propiedad', '#8b5cf6', '<h1><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> Mi Propiedad</h1><div class="card"><b>Casa en venta</b><p>$250,000 · 3 habitaciones</p><button class="btn" onclick="if(window.Intee&&Intee.location)Intee.location().then(l=>alert(\'Propiedad en: \'+l.latitude+\',\'+l.longitude))"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><circle cx="12" cy="12" r="3"/></svg> Ver ubicación</button></div><div class="card"><button class="btn" onclick="if(window.Intee&&Intee.camera)Intee.camera()"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg> Fotos adicionales</button></div>'],
  marketplace: ['Mi Tienda', '#10b981', '<h1><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg> Mi Tienda</h1><div class="card"><b>Producto destacado</b><p>$45.99 · En stock</p><button class="btn" onclick="if(window.Intee)Intee.share({title:\'Producto\',url:location.href})">Compartir</button></div><div class="card"><button class="btn" onclick="if(window.Intee&&Intee.camera)Intee.camera()"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg> Subir foto</button></div>'],
  lab: ['Permission Lab', '#6366f1', '<h1>Permission Test Lab</h1><p>Cada prueba ejecuta Manifest → runtime → API nativa → WebView y reporta.</p><div id="lab-results"></div><div class="card"><button class="btn" onclick="runLab()">RUN ALL TESTS</button></div><script>function labRow(n,ok,msg){var d=document.createElement("div");d.className="card";d.innerHTML="<b>"+(ok?"PASS ":"FAIL ")+n+"</b><p>"+msg+"</p>";document.getElementById("lab-results").appendChild(d);return ok;}async function tNotif(){try{if(!("Notification" in window))return labRow("Notificaciones",false,"sin API");var p=await Notification.requestPermission();return labRow("Notificaciones",p==="granted","permiso: "+p);}catch(e){return labRow("Notificaciones",false,String(e));}}async function tCam(){try{var s=await navigator.mediaDevices.getUserMedia({video:true});s.getTracks().forEach(t=>t.stop());return labRow("Cámara",true,"getUserMedia video OK");}catch(e){return labRow("Cámara",false,String(e.name||e));}}async function tMic(){try{var s=await navigator.mediaDevices.getUserMedia({audio:true});s.getTracks().forEach(t=>t.stop());return labRow("Micrófono",true,"getUserMedia audio OK");}catch(e){return labRow("Micrófono",false,String(e.name||e));}}async function tGps(){return new Promise(function(res){if(!navigator.geolocation)return res(labRow("GPS",false,"sin API"));navigator.geolocation.getCurrentPosition(function(){res(labRow("GPS",true,"posición OK"));},function(e){res(labRow("GPS",false,"código "+e.code));},{timeout:8000});});}async function tVib(){try{var r=navigator.vibrate?navigator.vibrate(100):false;return labRow("Vibración",!!r,"navigator.vibrate");}catch(e){return labRow("Vibración",false,String(e));}}async function tBt(){try{if(!navigator.bluetooth)return labRow("Bluetooth",false,"sin WebBluetooth (normal en WebView)");return labRow("Bluetooth",true,"API presente");}catch(e){return labRow("Bluetooth",false,String(e));}}async function runLab(){document.getElementById("lab-results").innerHTML="";var oks=0;oks+=await tNotif()?1:0;oks+=await tCam()?1:0;oks+=await tMic()?1:0;oks+=await tGps()?1:0;oks+=await tVib()?1:0;oks+=await tBt()?1:0;var d=document.createElement("div");d.className="card";d.innerHTML="<b>Resultado: "+oks+"/6 en WebView</b><p>Lo demás (biometría, NFC, storage) se valida con InteeBridge en la app instalada.</p>";document.getElementById("lab-results").appendChild(d);}</script>'],
  emergency: ['Mi Emergencia', '#ef4444', '<h1><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> Mi Emergencia</h1><div class="card"><button class="btn" style="background:#ef4444" onclick="if(window.Intee&&Intee.location)Intee.location().then(l=>alert(\'SOS enviado desde: \'+l.latitude+\',\'+l.longitude))"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> ENVIAR SOS</button></div><div class="card"><button class="btn" onclick="if(window.Intee&&Intee.camera)Intee.camera()"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg> Foto de emergencia</button></div>']
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
