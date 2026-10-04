'use strict';

const crypto = require('crypto');

module.exports = function registerAccountRoutes(app, ctx) {
  const { generator, loadKeys, saveKeys, createApiKey, rotateApiKey, readAudit, audit, requireAdmin, loadGits, saveGits, startBuild } = ctx;

  app.get('/api/keys', requireAdmin, (req,res)=>{ const keys=loadKeys().map(k=>({id:k.id,name:k.name,createdAt:k.createdAt,lastUsed:k.lastUsed,uses:k.uses,revokedAt:k.revokedAt||null,expiresAt:k.expiresAt||null,scopes:k.scopes||['build'],prefix:k.prefix||(k.key?String(k.key).slice(0,10):'ib_...'),keyMask:(k.prefix||'ib_...')+'...'+(k.keyHash?String(k.keyHash).slice(-4):'****')})); res.json(keys); });
  app.post('/api/keys', requireAdmin, (req,res)=>{
    const name=String(req.body.name||'').slice(0,40)||'default';
    const scopes=Array.isArray(req.body.scopes)?req.body.scopes.slice(0,5):['build','decompile','analyze'];
    const days=parseInt(req.body.expiresInDays,10);
    const keys=loadKeys().filter(k=>!k.revokedAt);
    if(keys.length>=10) return res.status(400).json({error:'Máximo 10 API keys activas'});
    const entry=createApiKey(name, scopes, days);
    res.json(entry);
  });
  app.post('/api/keys/:id/rotate', requireAdmin, (req,res)=>{
    const entry=rotateApiKey(req.params.id);
    if(!entry) return res.status(404).json({error:'Key activa no encontrada'});
    res.json(entry);
  });
  app.get('/api/keys/:id/activity', requireAdmin, (req,res)=>{
    res.json(readAudit(req.params.id, parseInt(req.query.limit,10)||100));
  });
  app.delete('/api/keys/:id', requireAdmin, (req,res)=>{
    const keys=loadKeys();
    const idx=keys.findIndex(k=>k.id===req.params.id);
    if(idx===-1) return res.status(404).json({error:'Key no encontrada'});
    keys[idx].revokedAt=Date.now(); delete keys[idx].key;
    saveKeys(keys); audit({ev:'key_revoked',keyId:req.params.id});
    res.json({ok:true, revoked:true});
  });


  app.get('/api/git/integrations', (req,res)=> res.json(loadGits().map(g=>({...g, token:undefined, rawToken:undefined}))));
  app.post('/api/git/connect', requireAdmin, (req,res)=>{
    const repo=String(req.body.repo||'').trim();
    const branch=String(req.body.branch||'main').trim();
    const token=String(req.body.token||'').trim();
    const webhookUrl=String(req.body.webhookUrl||'').trim();
    if(!/^[^/]+\/[^/]+$/.test(repo)) return res.status(400).json({error:'Repo debe ser usuario/repo'});
    const gits=loadGits();
    const id=crypto.randomBytes(4).toString('hex');
    const entry={id, repo, branch, hasToken:!!token, token: token? crypto.createHash('sha256').update(token).digest('hex').slice(0,12)+'...':null, rawToken: token||null, webhookUrl, createdAt:Date.now()};
    gits.push(entry); saveGits(gits);
    res.json({ok:true, id, repo, branch});
  });
  app.delete('/api/git/:id', requireAdmin, (req,res)=>{
    let gits=loadGits();
    const before=gits.length;
    gits=gits.filter(g=>g.id!==req.params.id);
    if(gits.length===before) return res.status(404).json({error:'No encontrado'});
    saveGits(gits); res.json({ok:true});
  });
  app.post('/api/git/webhook', async (req,res)=>{

    const repo=String(req.body.repository?.full_name || req.body.repo||'').trim();
    const ref=String(req.body.ref||'').trim();
    const branch = ref.replace('refs/heads/','') || String(req.body.branch||'main');
    if(!repo) return res.status(400).json({error:'Falta repo'});
    const gits=loadGits();
    const match=gits.find(g=>g.repo===repo && g.branch===branch);
    if(!match) return res.status(404).json({error:'No hay integración para '+repo+'#'+branch});

    try{
      const cfg=req.body.config ? generator.normalizeConfig(req.body.config) : generator.normalizeConfig({url:'https://'+repo, appName: repo.split('/')[1]||'App'});
      const ip=req.ip||'webhook';
      const result=await startBuild(cfg, ip);
      res.json({ok:true, buildId: result.id, branch});
    }catch(e){ res.status(500).json({error:e.message}); }
  });
};
