'use strict';

const crypto = require('crypto');
const JSZip = require('jszip');

function readApkBuffer(req) {
  if (req.is('application/octet-stream') && Buffer.isBuffer(req.body)) return req.body;
  if (req.body && req.body.apkBase64) {
    const b64 = String(req.body.apkBase64).replace(/^data:.*?;base64,/, '');
    return Buffer.from(b64, 'base64');
  }
  if (req.body && req.body.buffer) return Buffer.from(req.body.buffer, 'base64');
  return null;
}

module.exports = function registerDecompileRoutes(app, ctx) {
  const { gh, generator, decompiler, checkRateLimit } = ctx;


  app.post('/api/decompile', async (req,res)=>{
    try{
      let buf=null;
      if (req.is('application/octet-stream') && Buffer.isBuffer(req.body)) buf=req.body;
      else if(req.body.apkBase64){
        const b64=String(req.body.apkBase64).replace(/^data:.*?;base64,/, '');
        buf=Buffer.from(b64,'base64');
      } else if(req.body.buffer) buf=Buffer.from(req.body.buffer,'base64');
      if(!buf || buf.length<100) return res.status(400).json({error:'Envía apkBase64 (data:...;base64,xxx o solo base64) o raw octet-stream. Tamaño min 100 bytes'});
      if(buf.length>100*1024*1024) return res.status(400).json({error:'APK demasiado grande (max 100MB). Para builds de 1GB usa el ZIP del proyecto, no el APK firmado'});
      let zip;
      try{ zip=await JSZip.loadAsync(buf); }catch{ return res.status(400).json({error:'Archivo no es ZIP/APK válido (JSZip falló)'}); }
      const entries=Object.keys(zip.files);
      let manifestStr='';
      let manifestBuf=null;
      let buildConfig=null;
      let packageName='desconocido';
      let permissions=[];
      let appName='App';
      let versionName='';
      let versionCode='';
      let axmlInfo=null;
      let dexInfo=null;
      let decodedManifest='';
      if(zip.files['build-config.json']){
        try{ buildConfig=JSON.parse(await zip.files['build-config.json'].async('string')); packageName=buildConfig.packageName||packageName; appName=buildConfig.appName||appName; permissions=Object.keys(buildConfig.permissions||{}).filter(k=>buildConfig.permissions[k]); versionName=buildConfig.versionName||''; }catch{}
      }
      if(zip.files['AndroidManifest.xml']){
        try{ manifestBuf=await zip.files['AndroidManifest.xml'].async('nodebuffer'); }catch{ manifestBuf=null; }
        if(manifestBuf){

          const head=manifestBuf.toString('utf8',0,Math.min(100,manifestBuf.length));
          if(head.includes('<manifest')){
            manifestStr=manifestBuf.toString('utf8');
            if(manifestStr.includes('package="')){ const m=manifestStr.match(/package="([^"]+)"/); if(m) packageName=m[1]; }
            const verMatch=manifestStr.match(/versionName="([^"]+)"/); if(verMatch) versionName=verMatch[1];
            const codeMatch=manifestStr.match(/versionCode="([^"]+)"/); if(codeMatch) versionCode=codeMatch[1];
            const perms=[...manifestStr.matchAll(/android:name="(android\.permission\.[A-Z_]+|com\.android\.vending\.[A-Z_]+)"/g)].map(m=>m[1]);
            if(perms.length) permissions=[...new Set([...permissions,...perms])];
          } else {
            axmlInfo=decompiler.decodeAxml(manifestBuf);
            if(axmlInfo.package) packageName=axmlInfo.package;
            if(axmlInfo.label && appName==='App') appName=axmlInfo.label;
            if(axmlInfo.versionName && !versionName) versionName=axmlInfo.versionName;
            if(axmlInfo.permissions.length) permissions=[...new Set([...permissions,...axmlInfo.permissions])];
            decodedManifest=decompiler.readableManifestPreview(axmlInfo);
            manifestStr=decodedManifest;
          }
        }
        if(!packageName || packageName==='desconocido'){
          const pkgMatch=(manifestStr||'').match(/[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+/g);
          if(pkgMatch){ const cand=pkgMatch.find(s=>s.includes('.') && s.length<60 && !s.includes('permission')); if(cand) packageName=cand; }
        }
      }

      try{
        const dexFiles=entries.filter(e=>/(^|\/)classes\d*\.dex$/.test(e)).slice(0,5);
        if(dexFiles.length){
          const parts=[];
          for(const name of dexFiles){
            try{
              const b=await zip.files[name].async('nodebuffer');
              const p=decompiler.parseDex(b);
              if(p.valid) parts.push(p);
              if(b.length>8*1024*1024) break; 
            }catch{}
          }
          if(parts.length){
            const libs=[...new Set(parts.flatMap(p=>p.libs))];
            dexInfo={ files:dexFiles, classCount:parts.reduce((a,p)=>a+(p.classCount||0),0), methodCount:parts.reduce((a,p)=>a+(p.methodCount||0),0), stringCount:parts.reduce((a,p)=>a+(p.stringCount||0),0), libs, hasDroncito:parts.some(p=>p.hasDroncito), hasCapacitor:parts.some(p=>p.hasCapacitor), hasAr:parts.some(p=>p.hasAr), hasMlkit:parts.some(p=>p.hasMlkit), hasWeb3j:parts.some(p=>p.hasWeb3j), hasMqtt:parts.some(p=>p.hasMqtt), hasGvr:parts.some(p=>p.hasGvr), hasFirebase:parts.some(p=>p.hasFirebase), hasAdmob:parts.some(p=>p.hasAdmob) };
          }
        }
      }catch{}
      if(zip.files['capacitor.config.json']){
        try{ const cap=JSON.parse(await zip.files['capacitor.config.json'].async('string')); if(cap.appId && packageName==='desconocido') packageName=cap.appId; if(cap.appName) appName=cap.appName; if(cap.server && cap.server.url) appName+=' ('+cap.server.url.slice(0,30)+')'; }catch{}
      }
      if(zip.files['www/index.html']){
        try{ const html=await zip.files['www/index.html'].async('string'); const m=html.match(/https?:\/\/[^"'\s<]+/); if(m) appName+=' -> '+m[0].slice(0,40); }catch{}
      }
      if(zip.files['assets/www/index.html']){
        try{ const html=await zip.files['assets/www/index.html'].async('string'); const m=html.match(/https?:\/\/[^"'\s<]+/); if(m) appName+=' -> '+m[0].slice(0,40); }catch{}
      }

      let iconBase64=null;
      try{
        const iconEntry=entries.find(e=>/(mipmap.*ic_launcher|app-icon)\.png$/i.test(e));
        if(iconEntry){
          const ib=await zip.files[iconEntry].async('nodebuffer');
          if(ib.length>100 && ib.length<500*1024) iconBase64='data:image/png;base64,'+ib.toString('base64');
        }
      }catch{}
      const hasIcon=entries.some(e=>/ic_launcher|app-icon|mipmap.*\.png/i.test(e)) || !!iconBase64;
      const hasDex=entries.some(e=>e.endsWith('.dex'));
      const fileList=entries.slice(0,80);
      let sourceZipBase64=null;
      try{
        const sourceZip=new JSZip();
        for(const [name, file] of Object.entries(zip.files)){
          if(file.dir) continue;
          if(name.includes('..')) continue;
          try{
            const content=await file.async('nodebuffer');
            if(content.length < 4*1024*1024) sourceZip.file(name, content);
          }catch{}
        }

        if(decodedManifest) sourceZip.file('DECODED-AndroidManifest.xml', decodedManifest);
        if(axmlInfo) sourceZip.file('decompiler-axml.json', JSON.stringify({ package:axmlInfo.package, permissions:axmlInfo.permissions, features:axmlInfo.features, minSdk:axmlInfo.minSdk, targetSdk:axmlInfo.targetSdk, label:axmlInfo.label },null,2));
        if(dexInfo) sourceZip.file('decompiler-dex.json', JSON.stringify(dexInfo,null,2));
        sourceZipBase64=await sourceZip.generateAsync({type:'base64', compression:'DEFLATE'});
      }catch{}

      let importConfig;
      if(buildConfig){ importConfig=buildConfig; }
      else{
        const permKeys=decompiler.buildImportPermissions(permissions.filter(p=>String(p).includes('.')), dexInfo);

        permissions.filter(p=>!String(p).includes('.')).forEach(p=>{ permKeys[p]=true; });
        importConfig={ appName:String(appName).slice(0,40).replace(/[^\p{L}\p{N} _\-.]/gu,'').slice(0,40)||'App recuperada', packageName:packageName==='desconocido'?'com.example.app':packageName, url:'https://example.com', versionName:versionName||'1.0.0', permissions:permKeys, iconBase64:iconBase64||undefined, droncito:dexInfo?{ libs:dexInfo.libs, hasDroncito:dexInfo.hasDroncito }:undefined };
        if(iconBase64) importConfig.iconBase64=iconBase64;
      }
      res.json({
        ok:true,
        meta:{ packageName, appName, permissions, hasIcon, hasDex, fileCount:entries.length, sizeKB:Math.round(buf.length/1024), versionName, versionCode, minSdk:axmlInfo?.minSdk||null, targetSdk:axmlInfo?.targetSdk||null, features:axmlInfo?.features||[] },
        axml: axmlInfo?{ binary:axmlInfo.binary, package:axmlInfo.package, permissions:axmlInfo.permissions, features:axmlInfo.features, minSdk:axmlInfo.minSdk, targetSdk:axmlInfo.targetSdk, label:axmlInfo.label }:null,
        dex: dexInfo,
        entries: fileList,
        manifestPreview: (manifestStr||'').slice(0,8000) || '(binario sin strings legibles, ver axml.permissions)',
        importConfig,
        sourceZipBase64,
        sourceZipSizeKB: sourceZipBase64 ? Math.round(Buffer.from(sourceZipBase64,'base64').length/1024) : 0,
        note: buildConfig? 'APK InteeBuild - 100% recuperable + ZIP fuente listo' : dexInfo? ('APK real: AXML decodificado ('+permissions.length+' permisos) + DEX ('+dexInfo.classCount+' clases, libs: '+(dexInfo.libs.join(', ')||'ninguna detectada')+') + importConfig con keys reales + ZIP fuente') : hasDex ? 'APK real descompilado (heurística) + ZIP fuente con manifest/dex/res' : 'ZIP/APK genérico + ZIP fuente'
      });
    }catch(e){ res.status(500).json({error:'No se pudo descompilar: '+e.message}); }
  });




  app.post('/api/decompile/cloud', async (req, res) => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    if (!checkRateLimit(ip)) return res.status(429).json({ error: 'Rate limit: 10/h por IP' });
    const g = gh.config();
    if (!g.ready) return res.status(500).json({ error: 'Configura GITHUB_TOKEN e INTEE_BUILDS_REPO para el descompilador en la nube' });
    const buf = readApkBuffer(req);
    if (!buf || buf.length < 100) return res.status(400).json({ error: 'Envía apkBase64 o raw octet-stream (min 100 bytes)' });
    if (buf.length > 60 * 1024 * 1024) return res.status(413).json({ error: 'APK demasiado grande para la nube (max 60MB). Usa el descompilador local con AXML+DEX' });
    const id = crypto.randomBytes(4).toString('hex');
    const branch = `decompile-${id}`;
    try {
      await gh.syncWorkflow(g.owner, g.repo, g.defaultBranch, generator.DECOMPILE_WORKFLOW_YML, '.github/workflows/decompile-app.yml');
      await gh.pushProject(g.owner, g.repo, branch, {
        '.github/workflows/decompile-app.yml': Buffer.from(generator.DECOMPILE_WORKFLOW_YML, 'utf8'),
        'input/app.apk': buf
      }, g.defaultBranch);
      await gh.dispatchDecompile(g.owner, g.repo, branch, id);
      gh.deleteBranchSoon(g.owner, g.repo, branch, 20 * 60 * 1000);
      res.status(202).json({
        ok: true, id, branch,
        tools: 'jadx 1.5.1 + apktool 2.9.3',
        statusUrl: `/api/decompile/cloud/${id}/status`,
        downloadUrl: `/api/decompile/cloud/${id}/download`,
        note: 'Workflow despachado. El APK se borra de la rama a los 20 min.'
      });
    } catch (e) {
      res.status(e.status || 500).json({ error: e.message });
    }
  });

  app.get('/api/decompile/cloud/:id/status', async (req, res) => {
    const g = gh.config();
    if (!g.ready) return res.status(500).json({ error: 'Configura GITHUB_TOKEN e INTEE_BUILDS_REPO' });
    const branch = `decompile-${req.params.id}`;
    let run = null;
    try { run = await gh.findRunForBranch(g.owner, g.repo, branch); } catch (e) { return res.status(502).json({ error: e.message }); }
    if (!run) return res.json({ status: 'queued', branch, note: 'El workflow aún no aparece en GitHub Actions' });
    let artifacts = [];
    try { artifacts = await gh.getArtifacts(g.owner, g.repo, run.id); } catch (_) {}
    res.json({
      id: req.params.id, branch,
      status: run.status, conclusion: run.conclusion,
      runUrl: run.html_url,
      artifacts: artifacts.map((a) => ({ name: a.name, id: a.id, sizeKB: Math.round((a.size_in_bytes || 0) / 1024) })),
      ready: run.status === 'completed' && run.conclusion === 'success' && artifacts.length > 0
    });
  });

  app.get('/api/decompile/cloud/:id/download', async (req, res) => {
    const g = gh.config();
    if (!g.ready) return res.status(500).json({ error: 'Configura GITHUB_TOKEN e INTEE_BUILDS_REPO' });
    const branch = `decompile-${req.params.id}`;
    let run = null;
    try { run = await gh.findRunForBranch(g.owner, g.repo, branch); } catch (e) { return res.status(502).json({ error: e.message }); }
    if (!run) return res.status(404).json({ error: 'Aún no hay workflow para ese id' });
    if (run.status !== 'completed') return res.status(409).json({ error: 'Workflow todavía corriendo', status: run.status, runUrl: run.html_url });
    let arts = [];
    try { arts = await gh.getArtifacts(g.owner, g.repo, run.id); } catch (_) {}
    const art = arts.find((a) => /decompile/i.test(a.name)) || arts[0];
    if (!art) return res.status(404).json({ error: 'El workflow terminó sin artefacto. Revisa los logs: ' + run.html_url, runUrl: run.html_url });
    try {
      const r = await gh.downloadArtifact(g.owner, g.repo, art.id);
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="decompiled-${req.params.id}.zip"`);
      const stream = require('stream');
      if (r.body && typeof stream.Readable.fromWeb === 'function') return stream.Readable.fromWeb(r.body).pipe(res);
      const ab = await r.arrayBuffer();
      return res.send(Buffer.from(ab));
    } catch (e) {
      res.status(502).json({ error: 'No se pudo bajar el artefacto: ' + e.message });
    }
  });
};
