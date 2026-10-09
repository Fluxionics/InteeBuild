'use strict';

function runDoctor(cfg, ctx){
  const audit = ctx.audit || {items:[], ok:0, total:0, canBuild:true};
  const html = ctx.html || '';
  const checks = [];
  const add = (status, label, detail) => checks.push({status, label, detail: detail||''});

  const inputType = cfg.inputType || 'url';
  const url = String(cfg.url||'').trim();
  const htmlSrc = String(cfg.htmlCode||cfg.html||'');
  if(inputType==='url' && !url) add('error','Falta la URL del sitio','Pega la URL o cambia a HTML directo');
  else if(inputType==='html' && !htmlSrc) add('error','Falta el HTML','Pega tu codigo o cambia a URL');
  else if(inputType==='url' && ctx.urlError) add('error','La URL no responde', ctx.urlError);
  else if(inputType==='url' && ctx.blockedUrl) add('error','URL bloqueada por seguridad', url);
  else add('ok','Fuente web lista', inputType==='url' ? url : 'HTML directo ('+htmlSrc.length+' bytes)');

  const pkg = String(cfg.packageName||'');
  if(!pkg) add('warn','packageName vacio','Se usa el default del template');
  else if(!/^([a-z][a-z0-9_]*\.)+[a-z][a-z0-9_]*$/.test(pkg)) add('error','packageName invalido', pkg+' — formato: com.tuempresa.tuapp');
  else add('ok','packageName valido', pkg);

  const appName = String(cfg.appName||'').trim();
  if(!appName) add('warn','Falta el nombre de la app','Se usa un nombre por defecto');
  else if(appName.length>30) add('warn','Nombre largo para Play Store', appName.length+' caracteres (Play recomienda max 30)');
  else add('ok','Nombre de la app', appName);

  const ver = String(cfg.appVersion||cfg.version||'1.0');
  if(!/^\d+(\.\d+){0,2}$/.test(ver)) add('error','Version invalida', ver+' — usa formato 1.0 o 1.0.0');
  else add('ok','Version del APK', ver);

  const outputs = Array.isArray(cfg.outputs)&&cfg.outputs.length ? cfg.outputs : ['apk'];
  add('ok','Salidas seleccionadas', outputs.join(', '));

  if(cfg.nativeAudio && !String(cfg.streamUrl||'').trim()) add('error','Audio nativo sin streamUrl','Pon tu servidor en Audio nativo o desactivalo');
  else if(cfg.nativeAudio && !/^https?:\/\//.test(String(cfg.streamUrl||''))) add('error','streamUrl invalido','Debe empezar con http:// o https://');
  else if(cfg.nativeAudio) add('ok','Audio nativo con stream', String(cfg.streamUrl));

  if(audit.total===0) add('ok','Sin permisos especiales','La app solo usa INTERNET');
  else{
    const fails = audit.items.filter(i=>i.status==='fail');
    const warns = audit.items.filter(i=>i.status==='warn');
    if(fails.length) add('error', fails.length+' permiso(s) sin generar', fails.map(i=>i.title).join(', '));
    else add('ok', audit.ok+'/'+audit.total+' permisos verificados', 'Manifest + runtime + handler generados');
    if(warns.length) add('warn', warns.length+' permiso(s) con avisos', warns.map(i=>i.title+(i.version!=='OK'?' (Android '+i.minSdk+'+)':'')).join(', '));
    const rangeWarn = audit.items.filter(i=>i.rangeStatus==='warn');
    if(rangeWarn.length) add('warn', 'Rango de Android incompleto', rangeWarn.map(i=>i.title+': '+i.range).join(', '));
    const unused = audit.items.filter(i=>i.used==='sin-uso');
    if(unused.length) add('warn', unused.length+' permiso(s) declarado(s) sin uso detectado', unused.map(i=>i.title).join(', '));
  }

  if(html){
    const sizeKB = Math.round(Buffer.byteLength(html,'utf8')/1024);
    if(!/<!DOCTYPE/i.test(html)) add('error','Falta <!DOCTYPE html>','Agrega <!DOCTYPE html> como primera linea');
    else if(!/<html/i.test(html)) add('error','Falta tag <html>','Envuelve el contenido en <html>...</html>');
    else add('ok','HTML valido (doctype + <html>)', sizeKB+'KB');
    if(sizeKB>500) add('warn','HTML pesado', sizeKB+'KB — minifica antes de compilar');
    if(!/<meta[^>]*viewport/i.test(html)) add('warn','Sin meta viewport','Agrega <meta name="viewport" content="width=device-width, initial-scale=1.0">');
    else add('ok','Viewport movil presente');
    const insecure = (html.match(/src=["']http:\/\//gi)||[]).length + (html.match(/href=["']http:\/\//gi)||[]).length;
    if(insecure) add('warn', insecure+' recursos por http://','Cambia todos a https://');
    else add('ok','Sin recursos inseguros (http://)');

    if(ctx.errors){
      if(ctx.errors.errors.length) add('error', ctx.errors.errors.length+' error(es) de HTML', ctx.errors.errors.map(e=>e.msg).join(' | '));
      if(ctx.errors.warnings.length) add('warn', ctx.errors.warnings.length+' aviso(s) de HTML', ctx.errors.warnings.slice(0,5).map(w=>w.msg).join(' | '));
    }
    if(ctx.security){
      const crit = ctx.security.issues.filter(i=>i.severity==='critical');
      const high = ctx.security.issues.filter(i=>i.severity==='high');
      const rest = ctx.security.issues.filter(i=>i.severity!=='critical'&&i.severity!=='high');
      if(crit.length) add('error','Seguridad critica', crit.map(i=>i.msg).join(' | '));
      else add('ok','Sin fallos de seguridad criticos', 'score '+ctx.security.score+'/100');
      if(high.length) add('warn', high.length+' fallo(s) de seguridad altos', high.map(i=>i.msg).join(' | '));
      if(rest.length) add('warn', rest.length+' aviso(s) de seguridad', rest.map(i=>i.msg).join(' | '));
    }
    if(Array.isArray(ctx.detectedApis)){
      const recs = (ctx.suggest||[]).filter(r=>r.key && !cfg.permissions?.[r.key]);
      if(recs.length) add('warn','API detectada sin permiso activo', recs.map(r=>r.spec&&r.spec.title?r.spec.title:r.key).join(', '));
      else add('ok','Permisos coherentes con las APIs detectadas', ctx.detectedApis.length ? ctx.detectedApis.join(', ') : 'ninguna API con permiso requerido');
    }
  }

  const score = checks.length ? Math.round(checks.reduce((s,c)=>s+(c.status==='ok'?1:c.status==='warn'?0.5:0),0)/checks.length*100) : 0;
  const errors = checks.filter(c=>c.status==='error').length;
  const warns = checks.filter(c=>c.status==='warn').length;
  const canBuild = errors===0;
  const summary = errors ? errors+' error(es) que impiden compilar'
    : warns ? 'Listo, con '+warns+' aviso(s) recomendados revisar'
    : 'Listo para compilar';
  return {checks, score, canBuild, errors, warns, summary};
}

module.exports = { runDoctor };
