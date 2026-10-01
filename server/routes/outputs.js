'use strict';

module.exports = function registerOutputRoutes(app, ctx) {
  const { generator, configFromBody, loadVersions, saveVersions } = ctx;




  const AD_SLOTS = {
    banner: { key: 'f782587ac8395b4bfe62f052ed3b33b5', format: 'iframe', height: 250, width: 300 },
    mobile: { key: '43ebfe1e4238ce12d9f5d3aef4789066', format: 'iframe', height: 50, width: 320 }
  };
  const AD_HOSTS = (process.env.AD_PROXY_HOSTS || 'www.highrevenueformat.com').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  const adCache = new Map();

  app.get('/api/ads/:slot', (req, res) => {
    const slot = AD_SLOTS[String(req.params.slot || '').toLowerCase()];
    if (!slot) return res.status(404).json({ error: 'Slot no existe (banner, mobile)' });
    const loader = '/api/ad-proxy?u=' + encodeURIComponent('https://www.highrevenueformat.com/' + slot.key + '/invoke.js');
    res.json({ ...slot, loader });
  });

  app.get('/api/ad-proxy', async (req, res) => {
    let target = '';
    try {
      target = new URL(String(req.query.u || ''));
      if (!/^https?:$/.test(target.protocol)) throw new Error('bad proto');
      if (!AD_HOSTS.includes(target.hostname.toLowerCase())) throw new Error('host no permitido');
    } catch {
      return res.status(400).json({ error: 'URL de ad no permitida' });
    }
    const cacheKey = target.toString();
    const hit = adCache.get(cacheKey);
    if (hit && Date.now() - hit.at < 60000) {
      res.type(hit.ct || 'application/javascript').send(hit.body);
      return;
    }
    try {
      const r = await fetch(cacheKey, { headers: { 'User-Agent': 'Mozilla/5.0', Referer: req.headers.referer || '' }, signal: AbortSignal.timeout(8000) });
      if (!r.ok) throw new Error('Ad upstream ' + r.status);
      let body = await r.text();
      if (body.length > 200000) throw new Error('Ad muy grande');


      const here = (req.headers['x-forwarded-proto'] || req.protocol) + '://' + req.headers.host;
      AD_HOSTS.forEach(h => {
        body = body.split('https://' + h).join(here + '/api/ad-proxy?u=https://' + h);
        body = body.split('http://' + h).join(here + '/api/ad-proxy?u=http://' + h);
        body = body.split('//' + h).join(here.replace(/^https?:/, '') + '/api/ad-proxy?u=https://' + h);
      });
      const ct = (r.headers.get('content-type') || '').includes('html') ? 'text/html' : 'application/javascript';
      adCache.set(cacheKey, { at: Date.now(), body, ct });
      if (adCache.size > 50) adCache.clear();
      res.type(ct).send(body);
    } catch (e) {
      res.status(502).json({ error: 'Ad no disponible: ' + e.message });
    }
  });


  app.post('/api/listing', (req,res)=>{
    try{
      const cfg=configFromBody(req.body);
      res.json({ok:true, listing:generator.buildPlayListing(cfg)});
    }catch(e){ res.status(400).json({error:e.message}); }
  });


  app.post('/api/security-audit', (req,res)=>{
    try{
      const cfg=configFromBody(req.body);
      const audit=generator.getPermissionAudit(cfg);
      const issues=[];
      const sensitive=['phone','sms','systemAlert','installPackages','gpsBackground'];
      sensitive.forEach(k=>{ if(cfg.permissions[k]) issues.push({severity:'high', msg:'Permiso sensible '+k+' requiere justificación en Play Store', fix:'Quítalo si tu app no es de esa categoría'}); });
      if(!cfg.useCleartext && String(cfg.url||'').startsWith('http://')) issues.push({severity:'medium', msg:'URL http con cleartext desactivado', fix:'Activa tráfico cleartext o usa https'});
      const gdpr=[
        {item:'Política de privacidad enlazada', ok:!!String(req.body.privacyUrl||'').trim(), fix:'GET /api/privacy-policy para generarla'},
        {item:'Sin permisos sensibles innecesarios', ok:!sensitive.some(k=>cfg.permissions[k]), fix:'Quita phone/sms/gpsBackground si no aplican'},
        {item:'Keystore propio para release', ok:!!cfg.useCustomSigning, fix:'Sube tu .jks en Firma para publicar'}
      ];
      const score=Math.max(0, 100 - audit.items.filter(i=>i.status==='fail').length*20 - audit.items.filter(i=>i.status==='warn').length*5 - issues.filter(i=>i.severity==='high').length*5);
      res.json({ok:true, score, level: score>=90?'Excelente':score>=70?'Bueno':score>=50?'Revisar':'Crítico', audit, issues, gdpr});
    }catch(e){ res.status(400).json({error:e.message}); }
  });

  app.get('/api/privacy-policy', (req,res)=>{
    const appName=String(req.query.appName||'Mi app').slice(0,60);
    const pkg=String(req.query.package||'com.example.app').slice(0,80);
    res.type('text/plain').send(
      'POLÍTICA DE PRIVACIDAD — '+appName+' ('+pkg+')\n\n'
      + '1. Datos que recoge la app: la app muestra contenido web y usa únicamente los permisos que el usuario concede en Android (cámara, ubicación, etc.).\n'
      + '2. Uso: los datos se usan solo para el funcionamiento visible de la app y no se venden.\n'
      + '3. Terceros: si tu web carga servicios externos (analítica, anuncios), revisa sus políticas.\n'
      + '4. Conservación: InteeBuild borra la rama de compilación al terminar el build; los artefactos se auto-limpian.\n'
      + '5. Contacto: publica un correo de contacto antes de subir a Play Store.\n\n'
      + 'Generado gratis con InteeBuild. Adáptalo con tu abogado.'
    );
  });


  app.get('/api/versions/:appId', (req,res)=>{
    const v=loadVersions();
    res.json(v[String(req.params.appId)]||{appId:req.params.appId, versions:[]});
  });
  app.post('/api/versions/publish', (req,res)=>{
    const appId=String(req.body.appId||'').slice(0,80);
    const version=String(req.body.version||'').slice(0,20);
    const changelog=String(req.body.changelog||'').slice(0,500);
    if(!appId || !/^\d+(\.\d+){0,3}$/.test(version)) return res.status(400).json({error:'appId y version (ej 1.0.1) requeridos'});
    const v=loadVersions();
    const entry=v[appId]||{appId, versions:[]};
    entry.versions.unshift({version, changelog, publishedAt:Date.now()});
    entry.versions=entry.versions.slice(0,20);
    v[appId]=entry; saveVersions(v);
    res.json({ok:true, ...entry});
  });
  app.get('/api/check-update', (req,res)=>{
    const appId=String(req.query.appId||'');
    const current=String(req.query.version||'0.0.0');
    const entry=(loadVersions())[appId];
    if(!entry || !entry.versions.length) return res.json({updateAvailable:false});
    const latest=entry.versions[0].version;
    const cmp=(a,b)=>{ const pa=a.split('.').map(Number), pb=b.split('.').map(Number); for(let i=0;i<3;i++){ if((pa[i]||0)!==(pb[i]||0)) return (pa[i]||0)>(pb[i]||0)?1:-1; } return 0; };
    if(cmp(latest,current)>0) return res.json({updateAvailable:true, latest, changelog:entry.versions[0].changelog});
    res.json({updateAvailable:false, latest});
  });


  app.post('/api/cicd', (req,res)=>{
    const repo=String(req.body.repo||'').trim();
    const branch=String(req.body.branch||'main').trim();
    const baseUrl=String(req.body.baseUrl||'https://tu-dominio.com').replace(/\/$/,'');
    if(!/^[^/]+\/[^/]+$/.test(repo)) return res.status(400).json({error:'repo debe ser usuario/repo'});
    const yml='name: inteebuild-auto\non:\n  push:\n    branches: ['+branch+']\n    paths: [index.html, src/**, www/**]\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - name: Trigger InteeBuild\n        run: |\n          curl -X POST '+baseUrl+'/api/git/webhook -H "Content-Type: application/json" -d \'{"repository":{"full_name":"'+repo+'"},"ref":"refs/heads/'+branch+'"}\'\n';
    res.json({ok:true, repo, branch, file:'.github/workflows/inteebuild-auto.yml', workflow:yml, note:'Súbelo a '+repo+' y conecta el repo en POST /api/git/connect. Sin costos, usa tu propio servidor.'});
  });
};
