'use strict';



module.exports = {
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
};
