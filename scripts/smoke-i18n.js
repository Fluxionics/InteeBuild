const http = require('http');
function get(path) {
  return new Promise((res) => {
    const req = http.get('http://localhost:8787' + path, r => {
      let b = '';
      r.on('data', c => b += c);
      r.on('end', () => res({ status: r.statusCode, headers: r.headers, body: b }));
    });
    req.on('error', e => res({ status: 0, body: String(e) }));
  });
}
(async () => {
  const checks = [
    ['/en/index.html', s => s.status === 200 && s.headers['cache-control'] === 'no-store' && /<script src="\/js\/i18n.js"><\/script>/.test(s.body), 'index EN: no-store + script sin defer'],
    ['/XDDDDD', s => s.status === 404 && s.body.includes('Página no encontrada') && s.body.includes('inteebuild.onrender.com') && s.body.includes('/XDDDDD'), '404 es'],
    ['/en/nope', s => s.status === 404 && s.body.includes('Page not found'), '404 en'],
    ['/ru/nope', s => s.status === 404 && s.body.includes('Страница не найдена'), '404 ru'],
    ['/ch/nope', s => s.status === 404 && s.body.includes('页面未找到'), '404 ch'],
    ['/br/nope', s => s.status === 404 && s.body.includes('Página não encontrada'), '404 br'],
    ['/api/zzz', s => s.status === 404 && s.body.includes('"error"'), '404 api json'],
    ['/docs/en/decompiler.md', s => s.status === 200 && s.body.length > 1000 && !/Descompilación local/.test(s.body.slice(0, 200)), 'md en'],
    ['/docs/es/decompiler.md', s => s.status === 200 && /recupera la configuraci/.test(s.body), 'md es rewrite'],
    ['/docs/ru/faq.md', s => s.status === 200 && /Ф|Для|Что/.test(s.body), 'md ru'],
    ['/docs/ch/quickstart.md', s => s.status === 200 && /[一-鿿]/.test(s.body), 'md ch'],
    ['/docs/br/api.md', s => s.status === 200 && /[ãáõç]/i.test(s.body), 'md br'],
    ['/en/docs.html', s => s.status === 200 && s.body.includes('DOCS_LANG') && s.body.includes('mdUrl'), 'docs.html con mdUrl'],
    ['/i18n/en/docs.json', s => s.status === 200 && JSON.parse(s.body)['Índice'] !== undefined, 'docs dict EN tiene Índice'],
    ['/i18n/ru/docs/radio-face.json', s => s.status === 200 && JSON.parse(s.body)['Señal en Vivo'] !== undefined, 'radio-face dict RU'],
    ['/es/docs.html', s => s.status === 200 && s.body.includes('Cargando documentación'), 'es docs original']
  ];
  let fail = 0;
  for (const [p, fn, label] of checks) {
    const s = await get(p);
    const ok = fn(s);
    if (!ok) fail++;
    console.log((ok ? 'OK  ' : 'FAIL') + ' ' + label + (ok ? '' : '  status=' + s.status + ' body=' + s.body.slice(0, 120)));
  }
  console.log(fail === 0 ? 'SMOKE I18N TODO OK' : 'FALLARON: ' + fail);
  process.exit(fail ? 1 : 0);
})();
