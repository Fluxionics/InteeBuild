'use strict';

const JSZip = require('jszip');

module.exports = function registerCatalogRoutes(app, ctx) {
  const { generator, templates, configFromBody, detectWebApis, isBlockedUrl } = ctx;


  app.post('/api/manifest-diff', (req,res)=>{
    try{
      const cfg=configFromBody(req.body);
      const xml=generator.generateAndroidManifest(cfg);
      const generated=[...new Set([...xml.matchAll(/android:name="([^"]+)"/g)].map(m=>m[1]).filter(n=>n.includes('.permission.') || n==='com.android.vending.BILLING'))];
      const requested=[...new Set(Object.entries(cfg.permissions||{}).filter(([,v])=>v).flatMap(([k])=>(generator.PERMISSION_SPEC[k]?.manifest||[])))];
      if(cfg.iapEnabled && !requested.includes('com.android.vending.BILLING')) requested.push('com.android.vending.BILLING');
      const base=['android.permission.INTERNET','android.permission.ACCESS_NETWORK_STATE','android.permission.ACCESS_WIFI_STATE'];
      const missing=requested.filter(p=>!generated.includes(p));
      const unexpected=generated.filter(p=>!requested.includes(p) && !base.includes(p));
      const rows=requested.map(p=>({permission:p, generated:generated.includes(p), status:generated.includes(p)?'MATCH':'MISSING'}));
      res.json({ok:missing.length===0, requested, generated, missing, unexpected, base, rows});
    }catch(e){ res.status(400).json({error:e.message}); }
  });


  app.post('/api/inspect', async (req,res)=>{
    try{
      let buf=null;
      if(req.body.apkBase64){
        const b64=String(req.body.apkBase64).replace(/^data:.*?;base64/, '');
        buf=Buffer.from(b64.replace(/^,/,''),'base64');
      }
      if(!buf || buf.length<100) return res.status(400).json({error:'Envía apkBase64. Tamaño min 100 bytes'});
      if(buf.length>30*1024*1024) return res.status(400).json({error:'APK demasiado grande (max 30MB)'});
      let zip;
      try{ zip=await JSZip.loadAsync(buf); }catch{ return res.status(400).json({error:'No es un APK/ZIP válido'}); }
      const entries=Object.keys(zip.files);
      let manifestRaw='';
      if(zip.files['AndroidManifest.xml']){
        try{ manifestRaw=await zip.files['AndroidManifest.xml'].async('nodebuffer').then(b=>b.toString('latin1')); }catch{ manifestRaw=''; }
      }
      const isTextManifest=manifestRaw.includes('<manifest');
      const perms=[...new Set([...manifestRaw.matchAll(/android\.permission\.([A-Z_]+)/g)].map(m=>'android.permission.'+m[1]))];
      const pkg=(manifestRaw.match(/package="([^"]+)"/)||[])[1]||'desconocido (binario)';
      const version=(manifestRaw.match(/versionName="([^"]+)"/)||[])[1]||'?';
      const hasDex=entries.some(e=>e.endsWith('.dex'));
      const dexCount=entries.filter(e=>e.endsWith('.dex')).length;
      const soCount=entries.filter(e=>e.endsWith('.so')).length;
      const iconCount=entries.filter(e=>/mipmap.*\.png|app-icon/i.test(e)).length;
      const DANGEROUS=['READ_SMS','SEND_SMS','RECEIVE_SMS','CALL_PHONE','READ_CALL_LOG','PROCESS_OUTGOING_CALLS','READ_CONTACTS','WRITE_CONTACTS','READ_CALENDAR','WRITE_CALENDAR','ACCESS_BACKGROUND_LOCATION','REQUEST_INSTALL_PACKAGES','SYSTEM_ALERT_WINDOW','MANAGE_EXTERNAL_STORAGE','READ_PHONE_STATE','READ_PHONE_NUMBERS','ANSWER_PHONE_CALLS','BODY_SENSORS','ACTIVITY_RECOGNITION','RECORD_AUDIO','CAMERA','ACCESS_FINE_LOCATION'];
      const risky=perms.filter(p=>DANGEROUS.includes(p.split('.').pop()));
      const findings=[];
      if(!isTextManifest) findings.push({level:'info', msg:'Manifest binario (AXML): análisis por heurística de strings, no 100% exacto'});
      if(!hasDex) findings.push({level:'warn', msg:'Sin classes.dex: puede no ser un APK instalable'});
      risky.forEach(p=>findings.push({level:'warn', msg:'Permiso sensible: '+p}));
      if(manifestRaw.includes('android:debuggable="true"')) findings.push({level:'fail', msg:'debuggable=true: no publiques así'});
      else if(isTextManifest) findings.push({level:'ok', msg:'debuggable no activo'});
      if(!perms.length) findings.push({level:'warn', msg:'Sin permisos detectados'});
      let score=100;
      score-=risky.length*4;
      if(manifestRaw.includes('android:debuggable="true"')) score-=25;
      if(!hasDex) score-=15;
      if(!isTextManifest) score-=5;
      score=Math.max(0,score);
      res.json({
        ok:true, confidence:isTextManifest?'alta (manifest en texto)':'media (manifest binario, heurística)',
        meta:{packageName:pkg, version, sizeKB:Math.round(buf.length/1024), fileCount:entries.length, hasDex, dexCount, soCount, iconCount},
        permissions:perms, riskyPermissions:risky, findings,
        security:{score, level:score>=90?'Excelente':score>=70?'Bueno':score>=50?'Revisar':'Crítico'}
      });
    }catch(e){ res.status(500).json({error:'No se pudo inspeccionar: '+e.message}); }
  });

  app.get('/api/templates', (req,res)=>{
    const list = templates.listTemplates().map(t=>{
      let audit=null;
      try{
        const safeName=('Tpl '+t.name).replace(/[^A-Za-z0-9 ]/g, '').slice(0, 30) || 'Tpl App';
        const cfg=generator.normalizeConfig({appName:safeName, url:'https://example.com', ...templates.getTemplate(t.id).config});
        audit=generator.getPermissionAudit(cfg);
      }catch(e){ audit={error:e.message}; }
      return {...t, audit: audit ? {ok:audit.ok, total:audit.total, readiness:audit.readiness, canBuild:audit.canBuild} : null};
    });
    res.json(list);
  });
  app.get('/api/templates/:id', (req,res)=>{
    const t=templates.getTemplate(req.params.id);
    if(!t) return res.status(404).json({error:'Plantilla no encontrada'});
    res.json({id:req.params.id, ...t});
  });


  app.get('/api/templates/:id/native', (req,res)=>{
    const t=templates.getTemplate(req.params.id);
    if(!t) return res.status(404).json({error:'Plantilla no encontrada'});
    try{
      const safeName=('Tpl '+t.name).replace(/[^A-Za-z0-9 ]/g, '').slice(0, 30) || 'Tpl App';
      const cfg=generator.normalizeConfig({appName:safeName, url:'https://example.com', packageName:'com.example.'+String(req.params.id).replace(/[^a-z0-9]/g,''), ...t.config});
      const files=generator.generateFiles(cfg);
      const names=Object.keys(files);
      const javaFiles=names.filter(n=>n.endsWith('.java')||n.endsWith('.xml'));
      const audit=generator.getPermissionAudit(cfg);
      res.json({
        id:req.params.id, name:t.name,
        native100: audit.verifiedAll !== false && audit.canBuild,
        manifest: files['main-manifest.xml'],
        files: names,
        javaFiles,
        hasNativePermissions: !!files['NativePermissions.java'],
        hasRadioService: !!files['RadioService.java'],
        hasCatalogPatch: !!files['patch-catalog.js'],
        provider: files['provider.json'] ? JSON.parse(files['provider.json']) : null,
        audit
      });
    }catch(e){ res.status(400).json({error:e.message}); }
  });

  app.get('/api/permissions/spec', (req,res)=> res.json(generator.PERMISSION_SPEC));
  app.post('/api/permissions/audit', (req,res)=>{
    try{
      const cfg=configFromBody(req.body);
      const audit=generator.getPermissionAudit(cfg);
      res.json(audit);
    }catch(e){ res.status(400).json({error:e.message}); }
  });
  app.post('/api/permissions/suggest', async (req,res)=>{
    try{
      let html=String(req.body.html||'');
      const url=String(req.body.url||'').trim();
      let detected=[];
      if(html) detected=detectWebApis(html);
      else if(url && !isBlockedUrl(url)){
        try{
          const r=await fetch(url,{headers:{'User-Agent':'InteeBuild-PermSuggest/1.0'}, signal:AbortSignal.timeout(8000)});
          const t=await r.text();
          html=t.slice(0,500000);
          detected=detectWebApis(html);
        }catch{}
      } else if(req.body.detectedApis) detected=req.body.detectedApis;
      const suggested=generator.suggestPermissionsFromApis(detected);
      res.json({detected, suggested, count:suggested.length});
    }catch(e){ res.status(500).json({error:e.message}); }
  });

  app.post('/api/build-readiness', (req,res)=>{
    try{
      const cfg=configFromBody(req.body);
      const audit=generator.getPermissionAudit(cfg);
      const hasUrlOrHtml = !!(String(cfg.url||'').trim() && cfg.inputType==='url') || !!(String(cfg.htmlCode||'').trim() && cfg.inputType==='html');
      const checks={
        webAnalyzed: hasUrlOrHtml,
        permissionsValidated: audit.canBuild,
        manifestGenerated: true,
        nativeHandlers: audit.ok===audit.total || audit.total===0,
        sdkCompatible: audit.items.every(i=>i.version==='OK'),
        signingConfigured: true,
        workflowReady: true
      };
      const passed=Object.values(checks).filter(Boolean).length;
      const total=Object.keys(checks).length;
      const readiness=Math.round((passed/total*0.5 + (audit.total? audit.ok/audit.total : 1)*0.5)*100);
      const warnings=[];
      audit.items.forEach(i=>{ if(i.status==='warn') warnings.push(i.title+' requiere Android '+i.minSdk+'+'); });
      if(!hasUrlOrHtml) warnings.push('Falta URL o HTML');
      const nativeAudioOk = !cfg.nativeAudio || !!cfg.streamUrl;
      if(cfg.nativeAudio && !cfg.streamUrl) warnings.push('Audio nativo activo pero sin URL del stream: pon tu servidor en Audio nativo');
      if(cfg.nativeAudio && !!cfg.streamUrl && !/^https?:\/\//.test(cfg.streamUrl)) warnings.push('streamUrl debe empezar con http:// o https://');
      res.json({readiness, checks:{...checks, nativeAudio:nativeAudioOk}, audit, warnings, canBuild: audit.canBuild && hasUrlOrHtml && nativeAudioOk, message: readiness>=90?'Listo para compilar': readiness>=70?'Recomendado revisar':'Corrige permisos'});
    }catch(e){ res.status(400).json({error:e.message}); }
  });
};
