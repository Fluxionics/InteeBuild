'use strict';



module.exports = {
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
};
