'use strict';

const Preview = (() => {
  let isLandscape = false;
  let isDark = false;
  let zoomLevel = 1;
  let currentDevice = 'pixel';
  let iframe = null;
  let consoleLogs = [];
  let networkStatus = 'online';

  const appNameInput = $('#appNameInput');
  const urlInput = $('[name="url"]');
  const phoneMock = $('#phoneMock');
  const phoneScreen = $('#phoneScreen');
  const previewSplash = $('#previewSplash');
  const phonePreviewMain = $('#phonePreviewMain');
  const previewSplashMain = $('#previewSplashMain');
  const ppIframeWrap = $('#ppIframe');
  const ppScreen = $('#ppScreen');
  const consolePanel = $('#previewConsole');
  const consoleList = $('#consoleLogList');
  const networkSelect = $('#networkSelect');
  const zoomInBtn = $('#zoomIn');
  const zoomOutBtn = $('#zoomOut');
  const zoomResetBtn = $('#zoomReset');
  const zoomDisplay = $('#zoomDisplay');
  const fullscreenBtn = $('#previewFullscreenMain');
  const deviceSelectMain = $('#deviceSelectMain');
  const deviceSelectSidebar = $('#deviceSelectSidebar');

  const t = (key) => window.IB_I18N?.t?.(key) || key;

  const refresh = () => {
    const name = appNameInput && appNameInput.value ? appNameInput.value : 'Mi Aplicación';
    const url = urlInput && urlInput.value ? urlInput.value : 'https://mi-web.com';

    const previewBar = $('#previewBar');
    const previewUrl = $('#previewUrl');
    const previewIcon = $('#previewIcon');
    if (previewBar) previewBar.textContent = name;
    if (previewUrl) previewUrl.textContent = url;
    if (previewIcon && window.state?.iconBase64) previewIcon.innerHTML = '<img src="' + window.state.iconBase64 + '" />';

    const previewBarMain = $('#previewBarMain');
    const previewUrlMain = $('#previewUrlMain');
    const previewIconMain = $('#previewIconMain');
    if (previewBarMain) previewBarMain.textContent = name;
    if (previewUrlMain) previewUrlMain.textContent = url;
    if (previewIconMain && window.state?.iconBase64) {
      previewIconMain.innerHTML = '<img src="' + window.state.iconBase64 + '" style="width:100%;height:100%;object-fit:cover;border-radius:12px" />';
    }
  };

  const initLivePreview = (mode = 'url') => {
    if (!ppIframeWrap) return;

    ppIframeWrap.innerHTML = '';
    ppIframeWrap.classList.remove('hidden');

    iframe = document.createElement('iframe');
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads allow-top-navigation-by-user-activation');
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    iframe.style.transformOrigin = 'top left';
    iframe.style.background = '#fff';
    iframe.dataset.zoom = '1';

    if (mode === 'html') {
      const code = $('[name="htmlCode"]') ? $('[name="htmlCode"]').value : '';
      if (!code.trim()) return alert('Pega tu código HTML o importa un archivo primero');
      iframe.srcdoc = code;
    } else {
      const url = urlInput ? urlInput.value.trim() : '';
      if (!url) return alert('Por favor ingresa una URL válida primero');
      iframe.src = url;
    }

    iframe.onload = () => {
      setupIframeCommunication(iframe);
      applyZoom();
      applyDarkMode();
      applyNetworkSimulation();
    };

    ppIframeWrap.appendChild(iframe);

    const previewIconMain = $('#previewIconMain');
    const previewUrlMain = $('#previewUrlMain');
    if (previewIconMain) previewIconMain.style.display = 'none';
    if (previewUrlMain) previewUrlMain.style.display = 'none';
  };

  const setupIframeCommunication = (frame) => {
    const handleMessage = (event) => {
      if (!event.data || !event.data.type) return;

      switch (event.data.type) {
        case 'console':
          addConsoleLog(event.data.level, event.data.message, event.data.timestamp);
          break;
        case 'error':
          addConsoleLog('error', event.data.message, event.data.timestamp, event.data.stack);
          break;
        case 'network-status':
          networkStatus = event.data.online ? 'online' : 'offline';
          updateNetworkIndicator();
          break;
      }
    };

    window.addEventListener('message', handleMessage);

    const script = `
      (function() {
        const originalLog = console.log;
        const originalError = console.error;
        const originalWarn = console.warn;
        const originalInfo = console.info;

        console.log = function(...args) {
          originalLog.apply(console, args);
          window.parent.postMessage({ type: 'console', level: 'log', message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' '), timestamp: Date.now() }, '*');
        };
        console.error = function(...args) {
          originalError.apply(console, args);
          window.parent.postMessage({ type: 'console', level: 'error', message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' '), timestamp: Date.now() }, '*');
        };
        console.warn = function(...args) {
          originalWarn.apply(console, args);
          window.parent.postMessage({ type: 'console', level: 'warn', message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' '), timestamp: Date.now() }, '*');
        };
        console.info = function(...args) {
          originalInfo.apply(console, args);
          window.parent.postMessage({ type: 'console', level: 'info', message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' '), timestamp: Date.now() }, '*');
        };

        window.addEventListener('error', function(e) {
          window.parent.postMessage({ type: 'error', message: e.message, stack: e.stack, timestamp: Date.now() }, '*');
        });

        window.addEventListener('unhandledrejection', function(e) {
          window.parent.postMessage({ type: 'error', message: e.reason?.message || String(e.reason), stack: e.reason?.stack, timestamp: Date.now() }, '*');
        });

        setInterval(() => {
          window.parent.postMessage({ type: 'network-status', online: navigator.onLine }, '*');
        }, 2000);
      })();
    `;

    try {
      frame.contentWindow.eval(script);
    } catch (e) {
      console.warn('Could not inject console capture script:', e);
    }

    frame.dataset.messageHandler = 'attached';
  };

  const addConsoleLog = (level, message, timestamp, stack) => {
    const time = new Date(timestamp).toLocaleTimeString();
    const entry = { level, message, time, stack };
    consoleLogs.push(entry);

    if (!consoleList) return;
    const div = document.createElement('div');
    div.className = `console-entry console-${level}`;
    div.innerHTML = `
      <span class="console-time">${time}</span>
      <span class="console-level ${level}">${level.toUpperCase()}</span>
      <span class="console-message">${escapeHtml(message)}</span>
    `;
    if (stack) {
      const stackDiv = document.createElement('div');
      stackDiv.className = 'console-stack';
      stackDiv.textContent = stack;
      div.appendChild(stackDiv);
    }
    consoleList.appendChild(div);
    consoleList.scrollTop = consoleList.scrollHeight;

    if (consoleLogs.length > 200) {
      consoleLogs.shift();
      if (consoleList.firstChild) consoleList.removeChild(consoleList.firstChild);
    }
  };

  const escapeHtml = (text) => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };

  const clearConsole = () => {
    consoleLogs = [];
    if (consoleList) consoleList.innerHTML = '';
  };

  const setDevice = (device) => {
    currentDevice = device;
    const devices = ['iphone', 'galaxy', 'pixel', 'tablet', 'desktop'];
    devices.forEach(d => {
      phonePreviewMain?.classList.remove('device-' + d);
      phoneMock?.classList.remove('device-' + d);
    });
    phonePreviewMain?.classList.add('device-' + device);
    phoneMock?.classList.add('device-' + device);
    updateIframeSize();
  };

  const updateIframeSize = () => {
    if (!iframe) return;
    const dimensions = getDeviceDimensions(currentDevice, isLandscape);
    iframe.style.width = dimensions.width + 'px';
    iframe.style.height = dimensions.height + 'px';
    applyZoom();
  };

  const getDeviceDimensions = (device, landscape) => {
    const dims = {
      iphone: { w: 393, h: 852 },
      galaxy: { w: 384, h: 854 },
      pixel: { w: 360, h: 800 },
      tablet: { w: 768, h: 1024 },
      desktop: { w: 1280, h: 720 }
    };
    const d = dims[device] || dims.pixel;
    return landscape ? { width: d.h, height: d.w } : { width: d.w, height: d.h };
  };

  const setZoom = (level) => {
    zoomLevel = Math.max(0.25, Math.min(3, level));
    applyZoom();
    updateZoomDisplay();
  };

  const applyZoom = () => {
    if (!iframe) return;
    const dims = getDeviceDimensions(currentDevice, isLandscape);
    const wrapWidth = ppIframeWrap?.clientWidth || dims.width;
    const scale = Math.min(wrapWidth / dims.width, 1) * zoomLevel;
    iframe.style.transform = 'scale(' + scale + ')';
    iframe.style.transformOrigin = 'top left';
    iframe.dataset.zoom = zoomLevel;
  };

  const updateZoomDisplay = () => {
    if (zoomDisplay) zoomDisplay.textContent = Math.round(zoomLevel * 100) + '%';
  };

  const toggleDark = () => {
    isDark = !isDark;
    applyDarkMode();
  };

  const applyDarkMode = () => {
    if (!iframe) return;
    if (isDark) {
      iframe.style.filter = 'invert(1) hue-rotate(180deg)';
      iframe.style.background = '#18181b';
    } else {
      iframe.style.filter = 'none';
      iframe.style.background = '#fff';
    }
    if (ppScreen) ppScreen.style.background = isDark ? '#18181b' : '#fff';
    if (phoneScreen) phoneScreen.style.background = isDark ? '#18181b' : '#fff';
  };

  const simulateNetwork = (type) => {
    networkStatus = type;
    if (!iframe?.contentWindow) return;

    try {
      iframe.contentWindow.postMessage({
        type: 'network-simulate',
        status: type
      }, '*');
    } catch (e) {
      console.warn('Network simulation postMessage failed:', e);
    }
    updateNetworkIndicator();
  };

  const updateNetworkIndicator = () => {
    const indicator = $('#networkIndicator');
    if (!indicator) return;
    const labels = {
      online: t('En línea'),
      offline: t('Sin conexión'),
      'slow-3g': t('3G lento'),
      'fast-3g': t('3G rápido')
    };
    indicator.textContent = labels[networkStatus] || networkStatus;
    indicator.className = 'network-indicator ' + networkStatus;
  };

  const toggleLandscape = () => {
    isLandscape = !isLandscape;
    phonePreviewMain?.classList.toggle('landscape', isLandscape);
    phoneMock?.classList.toggle('landscape', isLandscape);
    updateIframeSize();
  };

  const toggleFullscreen = () => {
    const target = phonePreviewMain || phoneMock;
    if (!target) return;

    if (!document.fullscreenElement) {
      target.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen();
    }
  };

  const openFullscreenModal = () => {
    const modal = $('#previewModal');
    const modalIframe = $('#modalIframe');
    if (!modal || !iframe) return;

    modalIframe.innerHTML = '';
    const clone = iframe.cloneNode(true);
    clone.style.width = '100%';
    clone.style.height = '100%';
    clone.style.border = 'none';
    modalIframe.appendChild(clone);
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  };

  const closeFullscreenModal = () => {
    const modal = $('#previewModal');
    const modalIframe = $('#modalIframe');
    if (modal) modal.classList.add('hidden');
    if (modalIframe) modalIframe.innerHTML = '';
    document.body.style.overflow = '';
  };

  const init = () => {
    if (appNameInput) appNameInput.addEventListener('input', refresh);
    if (urlInput) urlInput.addEventListener('input', refresh);

    on('#previewRotate', 'click', () => {
      isLandscape = !isLandscape;
      phoneMock.classList.toggle('landscape', isLandscape);
    });

    on('#previewFullscreen', 'click', () => {
      phoneScreen.style.padding = phoneScreen.style.padding === '0px' ? '12px 12px 16px' : '0px';
      $('.phone-status')?.classList.toggle('hidden');
      $('.phone-nav')?.classList.toggle('hidden');
    });

    on('#previewSplashBtn', 'click', () => {
      previewSplash.classList.toggle('hidden');
      if (!previewSplash.classList.contains('hidden')) {
        const color = $('[name="splashColor"]');
        if (color) previewSplash.style.background = color.value;
        setTimeout(() => previewSplash.classList.add('hidden'), 2000);
      }
    });

    on('#previewTheme', 'click', (e) => {
      isDark = !isDark;
      phoneScreen.style.background = isDark ? '#18181b' : '#fff';
      phoneScreen.style.color = isDark ? '#fff' : '#18181b';
      e.currentTarget.textContent = isDark ? t('Claro') : t('Oscuro');
    });

    on('#ppRotate', 'click', toggleLandscape);

    on('#ppFullscreen', 'click', () => {
      phonePreviewMain.querySelector('.phone-status')?.classList.toggle('hidden');
      phonePreviewMain.querySelector('.phone-nav')?.classList.toggle('hidden');
    });

    on('#ppSplashBtn', 'click', () => {
      previewSplashMain.classList.toggle('hidden');
      setTimeout(() => previewSplashMain.classList.add('hidden'), 2000);
    });

    on('#ppTheme', 'click', () => {
      toggleDark();
      const btn = $('#ppTheme');
      if (btn) btn.textContent = isDark ? t('Claro') : t('Modo oscuro');
    });

    on('#ppLive', 'click', () => {
      const activeToggle = $('.toggle-btn.active');
      const mode = activeToggle ? activeToggle.dataset.input : 'url';

      if (ppIframeWrap.classList.contains('hidden')) {
        initLivePreview(mode);
      } else {
        ppIframeWrap.classList.add('hidden');
        ppIframeWrap.innerHTML = '';
        const previewIconMain = $('#previewIconMain');
        const previewUrlMain = $('#previewUrlMain');
        if (previewIconMain) previewIconMain.style.display = '';
        if (previewUrlMain) previewUrlMain.style.display = '';
      }
    });

    if (zoomInBtn) on('#zoomIn', 'click', () => setZoom(zoomLevel + 0.25));
    if (zoomOutBtn) on('#zoomOut', 'click', () => setZoom(zoomLevel - 0.25));
    if (zoomResetBtn) on('#zoomReset', 'click', () => setZoom(1));

    if (networkSelect) {
      on('#networkSelect', 'change', (e) => simulateNetwork(e.target.value));
    }

    if (fullscreenBtn) on('#previewFullscreenMain', 'click', openFullscreenModal);
    on('#modalClose', 'click', closeFullscreenModal);
    on('#modalOverlay', 'click', closeFullscreenModal);

    if (deviceSelectMain) {
      on('#deviceSelectMain', 'change', (e) => setDevice(e.target.value));
    }

    if (deviceSelectSidebar) {
      on('#deviceSelectSidebar', 'change', (e) => setDevice(e.target.value));
    }

    on('#clearConsole', 'click', clearConsole);

    document.addEventListener('fullscreenchange', () => {
      if (!document.fullscreenElement) {
        phonePreviewMain?.querySelector('.phone-status')?.classList.remove('hidden');
        phonePreviewMain?.querySelector('.phone-nav')?.classList.remove('hidden');
      }
    });

    setInterval(() => {
      const clock = $('#previewTime');
      if (clock) clock.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const clockMain = $('#ppTime');
      if (clockMain) clockMain.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }, 30000);

    const qrModal = $('#qrModal');
    on('#showQrBtn', 'click', () => {
      if (!window.state?.activeBuildId) return;
      show(qrModal);
      $('#qrImgBox').innerHTML = '<img src="/api/qr/' + window.state.activeBuildId + '" alt="Código QR de Descarga" />';
      $('#qrDirectLink').href = '/api/download/' + window.state.activeBuildId;
    });
    on('#qrClose', 'click', () => hide(qrModal));

    setDevice(currentDevice);
    updateZoomDisplay();
    updateNetworkIndicator();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { refresh, initLivePreview, setDevice, setZoom, toggleDark, simulateNetwork, toggleLandscape, openFullscreenModal };
})();