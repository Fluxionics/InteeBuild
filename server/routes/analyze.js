'use strict';

module.exports = function registerAnalyzeRoutes(app, ctx) {
  const { isBlockedUrl, detectFramework, detectWebApis, buildRecommendations, securityScan, errorDetection, optimizationReport, autoFixHtml, checkRateLimit } = ctx;

  app.get('/api/analyze', async (req, res) => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    if (!checkRateLimit(ip, 'analyze')) return res.status(429).json({ error: 'Rate limit: 10/h por IP' });
    const url = String(req.query.url || '').trim();
    if (!url) return res.status(400).json({ error: 'Falta url' });
    if (isBlockedUrl(url)) return res.status(400).json({ error: 'URL bloqueada por seguridad' });

    try {
      const r = await fetch(url, {
        headers: { 'User-Agent': 'InteeBuild-Analyzer/2.0 Mozilla/5.0' },
        redirect: 'manual',
        signal: AbortSignal.timeout(10000)
      });

      if (r.status >= 300 && r.status < 400) {
        const loc = r.headers.get('location');
        if (loc) {
          const resolved = new URL(loc, url).toString();
          if (isBlockedUrl(resolved)) return res.status(400).json({ error: 'Redireccion a URL privada bloqueada' });
        }
      }

      const html = await r.text();
      if (html.length > 500000) return res.status(400).json({ error: 'HTML demasiado grande' });
      const headersObj={};
      r.headers.forEach((v,k)=>headersObj[k.toLowerCase()]=v);
      const insecure = (html.match(/src=["']http:\/\//gi) || []).length + (html.match(/href=["']http:\/\//gi) || []).length;

      const checks = {
        https: url.startsWith('https://'),
        reachable: r.ok || r.status < 400,
        viewport: /\<meta[^>]*viewport/i.test(html),
        manifest: /\<link[^>]*rel=["']manifest["']/i.test(html),
        favicon: /\<link[^>]*rel=["'](icon|shortcut icon)["']/i.test(html),
        themeColor: /\<meta[^>]*name=["']theme-color["']/i.test(html),
        serviceWorker: /serviceWorker|navigator\.serviceWorker/i.test(html),
        insecureResources: insecure === 0,
        htmlErrors: /<!DOCTYPE html/i.test(html) && /<html/i.test(html),
        pwa: false,
        robots: /\<meta[^>]*name=["']robots["']/i.test(html),
        openGraph: /property=["']og:/i.test(html),
        structuredData: /application\/ld\+json/.test(html)
      };
      checks.pwa = checks.manifest && checks.serviceWorker;

      let score = 0;
      if (checks.https) score += 15; else score -= 10;
      if (checks.reachable) score += 15;
      if (checks.viewport) score += 20; else score -= 10;
      if (checks.manifest) score += 10;
      if (checks.favicon) score += 5; else score -= 3;
      if (checks.themeColor) score += 5;
      if (checks.serviceWorker) score += 15;
      if (insecure === 0) score += 10; else score -= Math.min(20, insecure * 2);
      if (checks.htmlErrors) score += 5; else score -= 10;
      if (checks.openGraph) score += 3;
      score = Math.max(0, Math.min(100, score));

      const diag = score >= 90 ? 'Listo para compilar' : score >= 70 ? 'Bueno, con mejoras menores' : score >= 50 ? 'Necesita ajustes' : 'Requiere correcciones';

      const frameworks = detectFramework(html);
      const detectedApis = detectWebApis(html);
      const recommendations = buildRecommendations(detectedApis);
      const security = securityScan(html, headersObj, url);
      const errors = errorDetection(html);
      const optimization = optimizationReport(html);
      const fixedHtml = autoFixHtml(html);
      const hasFixes = fixedHtml !== html;

      let pwaData = null;
      if (checks.manifest) {
        try {
          const manifestUrls = [
            ...[...html.matchAll(/\<link[^>]*rel=["']manifest["'][^>]*href=["']([^"']+)["']/gi)].map(m => new URL(m[1], url).toString()),
            new URL('/manifest.json', url).toString(),
            new URL('/manifest.webmanifest', url).toString()
          ];
          for (const mUrl of manifestUrls) {
            if (isBlockedUrl(mUrl)) continue;
            try {
              const mr = await fetch(mUrl, { signal: AbortSignal.timeout(4000) });
              if (mr.ok) { pwaData = await mr.json(); break; }
            } catch (_) {}
          }
        } catch (_) {}
      }

      res.json({ url, status: r.status, checks, score, diag, pwa: pwaData, insecureCount: insecure, frameworks, detectedApis, recommendations, security, errors, optimization, autoFix:{available:hasFixes, preview: fixedHtml.slice(0,8000)} });
    } catch (e) {
      res.status(500).json({ error: 'No se pudo analizar: ' + e.message });
    }
  });


  app.post('/api/analyze/html', async (req,res)=>{
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    if (!checkRateLimit(ip, 'analyze')) return res.status(429).json({ error: 'Rate limit: 10/h por IP' });
    const html=String(req.body.html||'');
    if(!html) return res.status(400).json({error:'Falta html'});
    if(html.length>600000) return res.status(400).json({error:'HTML demasiado grande'});
    const security=securityScan(html, {}, 'https://html-direct');
    const errors=errorDetection(html);
    const optimization=optimizationReport(html);
    const fixed=autoFixHtml(html);
    res.json({security,errors,optimization, autoFix:{available:fixed!==html, preview:fixed.slice(0,8000), full:fixed}});
  });

  app.post('/api/analyze/fix', async (req,res)=>{
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    if (!checkRateLimit(ip, 'analyze')) return res.status(429).json({ error: 'Rate limit: 10/h por IP' });
    const html=String(req.body.html||'');
    if(!html) return res.status(400).json({error:'Falta html'});
    const fixed=autoFixHtml(html);
    res.json({fixed, originalLength:html.length, fixedLength:fixed.length});
  });
};
