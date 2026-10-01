'use strict';



module.exports = {
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
