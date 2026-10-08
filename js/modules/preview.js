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

  let liveMode = null;
  let liveDebounce = null;

  const currentInputMode = () => {
    const active = $('.toggle-btn.active');
    return active ? active.dataset.input : 'url';
  };

  const showLivePlaceholder = () => {
    const previewIconMain = $('#previewIconMain');
    const previewUrlMain = $('#previewUrlMain');
    if (previewIconMain) previewIconMain.style.display = '';
    if (previewUrlMain) previewUrlMain.style.display = '';
  };

  const hideLivePlaceholder = () => {
    const previewIconMain = $('#previewIconMain');
    const previewUrlMain = $('#previewUrlMain');
    if (previewIconMain) previewIconMain.style.display = 'none';
    if (previewUrlMain) previewUrlMain.style.display = 'none';
  };

  const destroyLive = () => {
    if (ppIframeWrap) {
      ppIframeWrap.innerHTML = '';
      ppIframeWrap.classList.add('hidden');
    }
    iframe = null;
    liveMode = null;
    showLivePlaceholder();
  };

  const createLive = (mode) => {
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
      if (!code.trim()) { destroyLive(); return; }
      iframe.srcdoc = code;
    } else {
      const url = urlInput ? urlInput.value.trim() : '';
      if (!url) { destroyLive(); return; }
      iframe.src = url;
    }

    iframe.onload = () => {
      setupIframeCommunication(iframe);
      applyZoom();
      applyDarkMode();
      simulateNetwork(networkStatus);
    };

    ppIframeWrap.appendChild(iframe);
    liveMode = mode;
    hideLivePlaceholder();
  };

  const isValidLiveUrl = (url) => {
    try {
      const u = new URL(url);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch (e) {
      return false;
    }
  };

  const ensureLive = (force) => {
    if (!ppIframeWrap) return;
    const mode = currentInputMode();

    if (mode === 'html') {
      const code = ($('[name="htmlCode"]')?.value || '').trim();
      if (!code) { destroyLive(); return; }
      if (iframe && liveMode === 'html' && !force) {
        if (iframe.srcdoc !== code) iframe.srcdoc = code;
        return;
      }
      createLive('html');
      return;
    }

    const url = (urlInput?.value || '').trim();
    if (!url || !isValidLiveUrl(url)) { destroyLive(); return; }
    if (iframe && liveMode === 'url' && !force) {
      if ((iframe.getAttribute('src') || '') !== url) iframe.src = url;
      return;
    }
    createLive('url');
  };

  const scheduleLive = () => {
    clearTimeout(liveDebounce);
    liveDebounce = setTimeout(() => ensureLive(false), 700);
  };

  const initLivePreview = () => {
    ensureLive(true);
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
    if (urlInput) {
      urlInput.addEventListener('input', () => {
        refresh();
        scheduleLive();
      });
    }
    const htmlCodeEl = $('[name="htmlCode"]');
    if (htmlCodeEl) htmlCodeEl.addEventListener('input', scheduleLive);
    document.addEventListener('click', (e) => {
      const tb = e.target && e.target.closest ? e.target.closest('.toggle-btn[data-input]') : null;
      if (tb) setTimeout(() => ensureLive(true), 40);
    });

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
      const mode = currentInputMode();

      if (mode === 'html') {
        const code = ($('[name="htmlCode"]')?.value || '').trim();
        if (!code) return alert('Pega tu código HTML o importa un archivo primero');
      } else {
        const url = (urlInput?.value || '').trim();
        if (!url || !isValidLiveUrl(url)) return alert('Por favor ingresa una URL válida primero');
      }
      ensureLive(true);
    });

    if (zoomInBtn) on('#zoomIn', 'click', () => setZoom(zoomLevel + 0.25));
    if (zoomOutBtn) on('#zoomOut', 'click', () => setZoom(zoomLevel - 0.25));
    if (zoomResetBtn) on('#zoomReset', 'click', () => setZoom(1));

    const closePermDialog = () => {
      $('#ppPermDialog')?.classList.add('hidden');
      $('#ppPerms')?.classList.remove('active');
    };

    on('#ppPerms', 'click', () => {
      const dialog = $('#ppPermDialog');
      if (!dialog) return;
      const showing = !dialog.classList.contains('hidden');
      closePermDialog();
      if (showing) return;
      const nameEl = $('#ppPermAppName');
      if (nameEl) nameEl.textContent = (appNameInput && appNameInput.value) ? appNameInput.value : t('Mi Aplicación');
      const textEl = $('#ppPermText');
      if (textEl) textEl.textContent = t('¿Permitir que la app acceda a la ubicación de este dispositivo?');
      dialog.classList.remove('hidden');
      $('#ppPerms')?.classList.add('active');
    });
    on('#ppPermDeny', 'click', closePermDialog);
    on('#ppPermAllow', 'click', closePermDialog);

    let notifTimer = null;
    const showNotifBanner = () => {
      const banner = $('#ppNotifBanner');
      if (!banner) return;
      const titleEl = $('#ppNotifTitle');
      if (titleEl) titleEl.textContent = (appNameInput && appNameInput.value) ? appNameInput.value : t('Mi Aplicación');
      const notifyText = ($('[name="notifyText"]')?.value || '').trim();
      const textEl = $('#ppNotifText');
      if (textEl) textEl.textContent = notifyText || t('Notificación de prueba');
      const timeEl = $('#ppNotifTime');
      if (timeEl) timeEl.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      banner.classList.remove('hidden');
      clearTimeout(notifTimer);
      notifTimer = setTimeout(() => banner.classList.add('hidden'), 4500);
    };
    on('#ppNotif', 'click', showNotifBanner);
    on('#ppNotifBanner', 'click', () => $('#ppNotifBanner')?.classList.add('hidden'));

    const setOfflineSim = (on) => {
      $('#ppOfflineScreen')?.classList.toggle('hidden', !on);
      $('#ppOffline')?.classList.toggle('active', on);
      const sel = $('#networkSelect');
      const want = on ? 'offline' : 'online';
      if (sel && sel.value !== want) {
        sel.value = want;
        simulateNetwork(want);
      } else {
        updateNetworkIndicator();
      }
    };
    on('#ppOffline', 'click', () => {
      const sel = $('#networkSelect');
      setOfflineSim(!sel || sel.value !== 'offline');
    });
    on('#ppOfflineRetry', 'click', () => setOfflineSim(false));

    if (networkSelect) {
      on('#networkSelect', 'change', (e) => {
        simulateNetwork(e.target.value);
        const offline = e.target.value === 'offline';
        $('#ppOfflineScreen')?.classList.toggle('hidden', !offline);
        $('#ppOffline')?.classList.toggle('active', offline);
      });
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
    ensureLive();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { refresh, initLivePreview, ensureLive, setDevice, setZoom, toggleDark, simulateNetwork, toggleLandscape, openFullscreenModal };
})();