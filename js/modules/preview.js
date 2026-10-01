'use strict';

const Preview = (() => {
  let isLandscape = false;
  let isDark = false;

  const appNameInput = $('#appNameInput');
  const urlInput = $('[name="url"]');
  const phoneMock = $('#phoneMock');
  const phoneScreen = $('#phoneScreen');
  const previewSplash = $('#previewSplash');
  const phonePreviewMain = $('#phonePreviewMain');
  const previewSplashMain = $('#previewSplashMain');

  const refresh = () => {
    const name = appNameInput && appNameInput.value ? appNameInput.value : 'Mi Aplicación';
    const url = urlInput && urlInput.value ? urlInput.value : 'https://mi-web.com';

    const previewBar = $('#previewBar');
    const previewUrl = $('#previewUrl');
    const previewIcon = $('#previewIcon');
    if (previewBar) previewBar.textContent = name;
    if (previewUrl) previewUrl.textContent = url;
    if (previewIcon && state.iconBase64) previewIcon.innerHTML = '<img src="' + state.iconBase64 + '" />';

    const previewBarMain = $('#previewBarMain');
    const previewUrlMain = $('#previewUrlMain');
    const previewIconMain = $('#previewIconMain');
    if (previewBarMain) previewBarMain.textContent = name;
    if (previewUrlMain) previewUrlMain.textContent = url;
    if (previewIconMain && state.iconBase64) {
      previewIconMain.innerHTML = '<img src="' + state.iconBase64 + '" style="width:100%;height:100%;object-fit:cover;border-radius:12px" />';
    }
  };

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
    e.currentTarget.textContent = isDark ? 'Claro' : 'Oscuro';
  });

  on('#deviceSelect', 'change', (e) => {
    phonePreviewMain.className = 'phone device-' + e.target.value;
  });

  on('#ppRotate', 'click', () => phonePreviewMain.classList.toggle('landscape'));

  on('#ppFullscreen', 'click', () => {
    phonePreviewMain.querySelector('.phone-status')?.classList.toggle('hidden');
    phonePreviewMain.querySelector('.phone-nav')?.classList.toggle('hidden');
  });

  on('#ppSplashBtn', 'click', () => {
    previewSplashMain.classList.toggle('hidden');
    setTimeout(() => previewSplashMain.classList.add('hidden'), 2000);
  });

  on('#ppTheme', 'click', () => {
    const dark = $('#ppScreen').style.background === 'rgb(24, 24, 27)';
    $('#ppScreen').style.background = dark ? '#fff' : '#18181b';
    $('#ppScreen').style.color = dark ? '#18181b' : '#fff';
  });

  on('#ppLive', 'click', () => {
    const ppIframe = $('#ppIframe');
    const activeToggle = $('.toggle-btn.active');
    const mode = activeToggle ? activeToggle.dataset.input : 'url';

    if (ppIframe.classList.contains('hidden')) {
      if (mode === 'html') {
        const code = $('[name="htmlCode"]') ? $('[name="htmlCode"]').value : '';
        if (!code.trim()) return alert('Pega tu código HTML o importa un archivo primero');
        const frame = document.createElement('iframe');
        frame.setAttribute('sandbox', 'allow-scripts');
        frame.srcdoc = code;
        ppIframe.innerHTML = '';
        ppIframe.appendChild(frame);
      } else {
        const url = urlInput ? urlInput.value.trim() : '';
        if (!url) return alert('Por favor ingresa una URL válida primero');
        ppIframe.innerHTML = `<iframe src="${url}" sandbox="allow-scripts allow-same-origin"></iframe>`;
      }
      show(ppIframe);
      hide($('#previewIconMain'));
      hide($('#previewUrlMain'));
    } else {
      hide(ppIframe);
      ppIframe.innerHTML = '';
      show($('#previewIconMain'));
      show($('#previewUrlMain'));
    }
  });

  setInterval(() => {
    const clock = $('#previewTime');
    if (clock) clock.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, 30000);

  const qrModal = $('#qrModal');
  on('#showQrBtn', 'click', () => {
    if (!state.activeBuildId) return;
    show(qrModal);
    $('#qrImgBox').innerHTML = `<img src="/api/qr/${state.activeBuildId}" alt="Código QR de Descarga" />`;
    $('#qrDirectLink').href = '/api/download/' + state.activeBuildId;
  });
  on('#qrClose', 'click', () => hide(qrModal));

  return { refresh };
})();
