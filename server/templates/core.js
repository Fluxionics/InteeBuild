'use strict';



module.exports = {
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
};
