# Analyzer: segurança, erros e otimização antes de compilar

O analyzer audita a sua web sem compilar nada. Ele é disparado pelo botão `Analizar salud web` do passo de Aplicação ou pela API com `GET /api/analyze?url=…`. Se o que você quer revisar é HTML solto, `POST /api/analyze/html` faz o mesmo trabalho sem baixar nada.

Não é um analisador de segurança certificado: são regras locais do servidor, sem IA nem serviços externos. Servem para ver de repente o que falta antes de colocar a sua web num WebView.

## Verificações base

Baixa a página com um timeout de 10 segundos e verifica uma lista de coisas concretas: que use HTTPS, que responda, que tenha `meta viewport`, manifest, favicon, theme-color, service worker, que nenhum `src` nem `href` aponte para `http://`, que o HTML tenha doctype, e presença de Open Graph e dados estruturados. Se traz manifest, tenta baixá-lo em `/manifest.json` ou `/manifest.webmanifest` para devolver o seu conteúdo em `pwa`.

Dali sai um `score` de 0 a 100 e um diagnóstico em texto: `Listo para compilar` a partir de 90, `Bueno, con mejoras menores` a partir de 70, `Necesita ajustes` a partir de 50 e `Requiere correcciones` abaixo. Cada verificação soma ou tira pontos: viewport e service worker pesam mais que o favicon.

A requisição vai com `redirect: manual`, então não segue redirecionamentos: se a resposta é 3xx, só se verifica que o header `Location` não aponte para uma URL privada e devolve o status como está.

## Segurança

O módulo `security` devolve o seu próprio `score` (0-100), um `level` (`Excelente`, `Bueno`, `Riesgo medio`, `Crítico`) e uma lista de incidentes com severidade e correção proposta. Detecta:

- Ausência de HTTPS (tira 25).
- Ausência de Content-Security-Policy, tanto no header quanto em `http-equiv`.
- Recursos carregados com `http://` e scripts externos via HTTP.
- `eval()` no HTML.
- `innerHTML` sem sanitização.
- Cookies lidas sem a flag `Secure`.
- jQuery 1.x ou 2.x.
- Ausência de `X-Content-Type-Options: nosniff`.

Tudo isto se aplica igual dentro do WebView: mixed content e `eval()` continuam sendo um problema num app empacotado.

## Erros

`errors` devolve duas listas. `errors` é para o que quebra de verdade: ausência de `<!DOCTYPE html>` e ausência da tag `<html>`. `warnings` é o resto, com `type`, mensagem e correção: IDs duplicados (com os três primeiros), possível desencaixe de tags sem fechar, imagens sem `alt`, mais de 15 estilos inline, `var` em vez de `let` ou `const`, possível atribuição dentro de um `if`, e links `#` vazios. O resumo traz `total`, `altMissing` e `duplicateIds`.

## Otimização

`optimization` devolve `score`, `grade` (`A` a partir de 85, `B` a partir de 70, `C` a partir de 50, `D` abaixo), `sizeKB`, `images`, `scripts` e uma lista de `tips` com impacto `high`, `medium` ou `low`. Verifica peso do HTML, quantidade de imagens e quantas vão sem `loading="lazy"`, número de scripts externos, CSS bloqueante, ausência de WebP e blocos `<style>` repetidos.

## Frameworks, Web APIs e permissões

`frameworks` é uma lista de etiquetas detectadas por regex: React, Vue, Angular, Next.js, Nuxt, Svelte, Astro, Vite, WordPress, Shopify, Webflow, Wix, Bubble, Lovable, Replit, Bootstrap e Tailwind. Se não reconhece nada, devolve `html`.

`detectedApis` lista as Web APIs presentes: geolocalização, câmera, microfone, Bluetooth, NFC, notificações, vibração, compartilhar, tela cheia, orientação, localStorage, indexedDB, service worker, WebGL, pagamentos, área de transferência e wake lock. Com isso `recommendations` traduz quais permissões e plugins faltariam: por exemplo, `geolocation` sugere a permissão `gps` e o plugin `geolocation`.

Essa mesma cadeia é a que usa o botão `Sugerir por Web API` do passo de Permissões, e também `POST /api/permissions/suggest`, que aceita HTML, URL ou a lista de APIs já detectada.

## Auto-fix

`autoFixHtml` faz quatro coisas, e nada mais: troca `http://` por `https://` em `src` e `href`, adiciona `loading="lazy"` às imagens que não o têm, injeta o `meta viewport` se faltar, e adiciona `alt=""` às imagens sem `alt`. O resultado é comparado com o original para dizer `autoFix.available`, e os primeiros 8.000 caracteres vão em `autoFix.preview`.

Há três formas de aplicá-lo:

- `POST /api/analyze/fix` devolve `{fixed, originalLength, fixedLength}` com o HTML completo corrigido.
- `POST /api/analyze/html` devolve `autoFix.full` além de `preview`.
- O botão `Aplicar Auto-Fix y previsualizar HTML optimizado` do estúdio coloca o resultado no editor para que você o revise.

É heurístico. `alt=""` vazio não é uma descrição acessível, e forçar `https://` num recurso que não existe em HTTPS deixa a imagem quebrada. Revise o diff antes de dar a saída como boa.

## Ordem de trabalho recomendada

Analise primeiro com a URL, e se o score ficar abaixo de 70 aplique o fix e olhe a lista de otimização. Depois revise `security`: um `eval()` ou mixed content que você passe para trás agora aparece igual no build. Use `Sugerir por Web API` para marcar só as permissões que a sua web usa de verdade, confira o resultado no Audit do passo de Permissões, e analise de novo quando mudar coisas grandes do seu site.

Os limites de tamanho estão em [api.md](./api.md); o que o Permission Engine faz com essa informação, em [permissions.md](./permissions.md).
