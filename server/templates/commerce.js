'use strict';



module.exports = {
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
};
