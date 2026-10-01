'use strict';



module.exports = {
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
};
