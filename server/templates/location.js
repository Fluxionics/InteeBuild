'use strict';



module.exports = {
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
};
