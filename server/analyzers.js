'use strict';

function detectFramework(html) {
  const checks = {
    react: /__reactFiber|react-dom|React\.createElement|_jsx\(|from 'react'/.test(html),
    vue: /Vue\.createApp|createApp\(|v-bind:|v-if=|vue\.global\.js|from 'vue'/.test(html),
    angular: /ng-version|ng-app|angular\.js|from '@angular\/core'|\[ngFor\]|ng2\b/.test(html),
    nextjs: /__NEXT_DATA__|next\/router|_next\/static|next\.js/.test(html),
    nuxt: /__nuxt__|nuxt\.config|_nuxt\//.test(html),
    svelte: /svelte|__svelte_/.test(html),
    astro: /astro:|@astrojs|astro-island/.test(html),
    vite: /vite\.svg|@vite\/client|vite\.config/.test(html),
    wordpress: /wp-content\/|wp-json\/|wordpress/.test(html),
    shopify: /shopify\.com|cdn\.shopify\.com|Shopify\.theme/.test(html),
    webflow: /webflow\.com|\.webflow\.io|webflow\.js/.test(html),
    wix: /wix\.com|wixstatic\.com|wix-static/.test(html),
    bubble: /bubble\.io|bubble-element/.test(html),
    lovable: /lovable\.app|lovable-uploads/.test(html),
    replit: /replit\.com|repl\.co/.test(html),
    bootstrap: /bootstrap\.min\.css|bootstrap\.bundle/.test(html),
    tailwind: /tailwind\.config|cdn\.tailwindcss\.com|tailwindcss/.test(html)
  };

  const found = Object.entries(checks).filter(([, v]) => v).map(([k]) => k);
  if (!found.length) found.push('html');
  return found;
}

function detectWebApis(html) {
  const apis = {
    geolocation: /navigator\.geolocation|getCurrentPosition|watchPosition/.test(html),
    camera: /getUserMedia|getDisplayMedia|MediaDevices|navigator\.mediaDevices/.test(html),
    microphone: /getUserMedia.*audio|audio.*getUserMedia|AudioContext|webkitAudioContext/.test(html),
    bluetooth: /navigator\.bluetooth|requestDevice.*bluetooth/.test(html),
    nfc: /navigator\.nfc|NDEFReader/.test(html),
    notifications: /Notification\.|requestPermission.*notification|PushManager/.test(html),
    vibration: /navigator\.vibrate/.test(html),
    share: /navigator\.share\b|Web Share/.test(html),
    fullscreen: /requestFullscreen|webkitRequestFullscreen|fullscreenchange/.test(html),
    orientation: /screen\.orientation|lockOrientation/.test(html),
    localStorage: /localStorage\.|window\.localStorage/.test(html),
    indexedDB: /indexedDB\.|IDBFactory|openDatabase/.test(html),
    serviceWorker: /serviceWorker|navigator\.serviceWorker/.test(html),
    webgl: /WebGLRenderingContext|getContext\('webgl'\)/.test(html),
    payment: /PaymentRequest|payment-request/.test(html),
    clipboard: /navigator\.clipboard|Clipboard API/.test(html),
    wakelock: /WakeLock|navigator\.wakeLock/.test(html)
  };

  return Object.entries(apis).filter(([, v]) => v).map(([k]) => k);
}

function buildRecommendations(detectedApis) {
  const map = {
    geolocation: { label: 'Permiso GPS + Plugin Geolocation', permissions: ['gps'], plugins: ['geolocation'] },
    camera: { label: 'Permiso Cámara/Micrófono + Plugin Camera', permissions: ['cameraMic'], plugins: ['camera'] },
    microphone: { label: 'Permiso Micrófono', permissions: ['microphone'], plugins: [] },
    bluetooth: { label: 'Permiso Bluetooth + Plugin Bluetooth LE', permissions: ['bluetooth'], plugins: ['bluetooth'] },
    nfc: { label: 'Permiso NFC + Plugin NFC', permissions: ['nfc'], plugins: ['nfc'] },
    notifications: { label: 'Plugin Push Notifications + Permiso Notificaciones', permissions: ['notifications'], plugins: ['notifications'] },
    vibration: { label: 'Permiso Vibración + Plugin Haptics', permissions: ['vibration'], plugins: ['haptics'] },
    share: { label: 'Plugin Share nativo', permissions: [], plugins: ['share'] },
    wakelock: { label: 'Permiso Wake Lock + Plugin Screen', permissions: ['wakeLock'], plugins: [] },
    clipboard: { label: 'Plugin Clipboard nativo', permissions: [], plugins: ['clipboard'] }
  };

  return detectedApis
    .filter(api => map[api])
    .map(api => ({ api, ...map[api] }));
}

function securityScan(html, headers, url) {
  const issues=[];
  let score=100;
  if(!url.startsWith('https://')){ issues.push({severity:'critical', msg:'No usa HTTPS', fix:'Migrar a https://'}); score-=25; }
  const hasCSP = /content-security-policy/i.test(headers['content-security-policy']||'') || /http-equiv=["']content-security-policy/i.test(html);
  if(!hasCSP){ issues.push({severity:'medium', msg:'Sin Content-Security-Policy', fix:'Agregar CSP header'}); score-=8; }
  const insecure = (html.match(/src=["']http:\/\//gi)||[]).length + (html.match(/href=["']http:\/\//gi)||[]).length;
  if(insecure){ issues.push({severity:'high', msg: insecure+' recursos inseguros http://', fix:'Cambiar a https://'}); score-= Math.min(20,insecure*4); }
  if(/eval\s*\(/.test(html)) { issues.push({severity:'high', msg:'Uso de eval() detectado', fix:'Evitar eval, usar JSON.parse'}); score-=10; }
  if(/innerHTML\s*=/.test(html)) { issues.push({severity:'low', msg:'innerHTML sin sanitizar', fix:'Usar textContent o DOMPurify'}); score-=3; }
  if(/document\.cookie/.test(html) && !/Secure/.test(headers['set-cookie']||'')) { issues.push({severity:'medium', msg:'Cookies sin flag Secure', fix:'Agregar Secure; HttpOnly'}); score-=5; }
  if(/<script[^>]*>.*http:\/\//i.test(html)) { issues.push({severity:'high', msg:'Script externo sin HTTPS', fix:'Usar https'}); score-=10; }
  if(!/X-Content-Type-Options/i.test(headers['x-content-type-options']||'')) { issues.push({severity:'low', msg:'Falta X-Content-Type-Options: nosniff', fix:'Header nosniff'}); score-=2; }
  if(/jquery.*1\./i.test(html) || /jquery.*2\./i.test(html)) { issues.push({severity:'medium', msg:'jQuery obsoleto detectado', fix:'Actualizar a 3.x'}); score-=5; }
  score=Math.max(0,Math.min(100,score));
  const level= score>=90?'Excelente':score>=70?'Bueno':score>=50?'Riesgo medio':'Crítico';
  return {score, level, issues, hasCSP, insecureCount: insecure};
}

function errorDetection(html){
  const errors=[];
  const warnings=[];

  const ids=[...html.matchAll(/id=["']([^"']+)["']/gi)].map(m=>m[1]);
  const dup=[...new Set(ids.filter((v,i,a)=>a.indexOf(v)!==i))];
  if(dup.length) warnings.push({type:'duplicate-id', msg:'IDs duplicados: '+dup.slice(0,3).join(', '), fix:'IDs deben ser únicos'});

  const openTags=(html.match(/<(div|section|main|header|footer|ul|li|p|span|a)[^>]*>/gi)||[]).length;
  const closeTags=(html.match(/<\/(div|section|main|header|footer|ul|li|p|span|a)>/gi)||[]).length;
  if(Math.abs(openTags-closeTags)>5) warnings.push({type:'unclosed', msg:'Posibles etiquetas sin cerrar', fix:'Validar con https://validator.w3.org'});

  const imgs=(html.match(/<img[^>]*>/gi)||[]);
  const noAlt=imgs.filter(t=>!/alt=/.test(t)).length;
  if(noAlt) warnings.push({type:'accessibility', msg: noAlt+' imágenes sin alt', fix:'Agregar alt descriptivo'});

  const inline=(html.match(/style=["'][^"']*["']/gi)||[]).length;
  if(inline>15) warnings.push({type:'maintainability', msg:'Muchos estilos inline', fix:'Mover a CSS externo'});

  if(/<script[^>]*>([\s\S]*?)<\/script>/i.test(html)){
    const scripts=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]);
    scripts.forEach((code,i)=>{
      if(/=\s*[^=]/.test(code) && /if\s*\(.*=.*\)/.test(code)) warnings.push({type:'js-logic', msg:'Posible asignación en if (script '+(i+1)+')', fix:'Usar ==='});
      if(/var\s+\w+/.test(code)) warnings.push({type:'js-legacy', msg:'Uso de var en lugar de let/const', fix:'Modernizar'});
    });
  }

  const links=[...html.matchAll(/href=["']([^"']+)["']/gi)].map(m=>m[1]);
  const emptyLinks=links.filter(h=>h==='#' || h==='').length;
  if(emptyLinks) warnings.push({type:'links', msg: emptyLinks+' enlaces vacíos (#)', fix:'Agregar href válido'});

  if(!/<!DOCTYPE/i.test(html)) errors.push({type:'doctype', msg:'Falta <!DOCTYPE html>', fix:'Agregar doctype'});
  if(!/<html/i.test(html)) errors.push({type:'html', msg:'Falta tag <html>', fix:'Envolver contenido'});
  return {errors, warnings, total: errors.length+warnings.length, altMissing:noAlt, duplicateIds:dup};
}

function optimizationReport(html){
  const tips=[];
  let score=100;
  const sizeKB=Math.round(Buffer.byteLength(html,'utf8')/1024);
  if(sizeKB>200){ tips.push({msg:'HTML pesado '+sizeKB+'KB', fix:'Minificar y comprimir', impact:'high'}); score-=15; }
  else if(sizeKB>100){ tips.push({msg:'HTML mediano '+sizeKB+'KB', fix:'Optimizar imágenes', impact:'medium'}); score-=5; }
  const images=(html.match(/<img[^>]*>/gi)||[]).length;
  if(images>20){ tips.push({msg:images+' imágenes, muchas sin lazy', fix:'Agregar loading="lazy"', impact:'medium'}); score-=8; }
  const noLazy=(html.match(/<img[^>]*>/gi)||[]).filter(t=>!/loading=/.test(t)).length;
  if(noLazy>3){ tips.push({msg:noLazy+' imágenes sin lazy loading', fix:'Agregar loading="lazy"', impact:'low'}); score-=4; }
  const scripts=(html.match(/<script[^>]*src=/gi)||[]).length;
  if(scripts>6){ tips.push({msg:scripts+' scripts externos (bloquean render)', fix:'Defer/async', impact:'high'}); score-=10; }
  if(/<link[^>]*rel=["']stylesheet["']/i.test(html) && !/media=/.test(html)) { tips.push({msg:'CSS bloqueante', fix:'Agregar media o preload', impact:'medium'}); score-=3; }
  if(!/\.webp/i.test(html) && images>5){ tips.push({msg:'No usa WebP', fix:'Convertir imágenes a WebP', impact:'low'}); score-=3; }
  const inlineCSS=(html.match(/<style[^>]*>/gi)||[]).length;
  if(inlineCSS>3){ tips.push({msg:'Múltiples <style> inline', fix:'Unificar en archivo externo', impact:'low'}); score-=2; }
  score=Math.max(0,Math.min(100,score));
  const grade= score>=85?'A':score>=70?'B':score>=50?'C':'D';
  return {score, grade, tips, sizeKB, images, scripts};
}

function autoFixHtml(html){
  let out=html;

  out=out.replace(/src=["']http:\/\//gi,'src="https://');
  out=out.replace(/href=["']http:\/\//gi,'href="https://');

  out=out.replace(/<img([^>]*?)>/gi,(m,attrs)=> /loading=/.test(attrs)? m : '<img'+attrs+' loading="lazy">');

  if(!/<meta[^>]*viewport/i.test(out)){
    out=out.replace(/<head([^>]*)>/i,'<head$1><meta name="viewport" content="width=device-width, initial-scale=1.0" />');
  }

  out=out.replace(/<img([^>]*?)>/gi,(m,attrs)=> /alt=/.test(attrs)? m : '<img'+attrs+' alt="">');
  return out;
}

module.exports = {
  detectFramework,
  detectWebApis,
  buildRecommendations,
  securityScan,
  errorDetection,
  optimizationReport,
  autoFixHtml
};
