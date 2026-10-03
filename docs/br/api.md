# API do desenvolvedor

Toda a API vive sob `/api` no mesmo servidor que a interface. A base URL é o seu domínio ou `http://localhost:8787`. Tudo é JSON, exceto os endpoints que devolvem ZIP, texto puro ou PNG.

Se você precisa de uma visão navegável dos mesmos endpoints, está `developer.html`. `GET /api/docs` devolve um resumo em JSON da API com a versão do servidor.

## Autenticação

As API keys não são obrigatórias: enquanto não existir nenhuma, a API está aberta. Assim que você cria a primeira, `POST /api/v1/build` passa a exigi-la.

```bash
curl -X POST /api/keys -H "Content-Type: application/json" -d '{"name":"ci"}'
# → {"id":"…","key":"ib_…","keyHash":"…","prefix":"ib_…","scopes":["build","decompile","analyze"]}
```

A key é devolvida uma única vez, nessa resposta. Em disco só fica o seu hash sha256 (`keyHash`) e o prefixo (os dez primeiros caracteres), nunca o segredo. `GET /api/keys` devolve o mascarado (`ib_1a2b3c4…` mais os últimos quatro do hash), uso, última chamada e estado; `DELETE /api/keys/:id` faz exclusão lógica marcando `revokedAt`, e essa key deixa de servir. O limite são 10 keys ativas.

Aceita-se de duas formas: `X-API-Key: ib_…` ou `Authorization: Bearer ib_…`.

Um detalhe que vale saber: os `scopes` são salvos e podem ser limitados ao criar a key, mas não são verificados em nenhuma rota. A permissão real é "a key existe e não está revogada".

Você também tem `GET /api/keys` para a listagem e a revogação a partir do seu próprio cliente.

## Compilar

Há duas entradas. A do estúdio não pede key e responde com `id`; a do versionamento sim pode pedi-la e responde `buildId`.

```bash
curl -X POST /api/build -H "Content-Type: application/json" \
  -d '{"url":"https://mi-tienda.com","appName":"Mi Tienda","packageName":"com.miempresa.miapp","permissions":{"gps":true,"cameraMic":true}}'
# → 202 {"id":"abc123","branch":"build-abc123","status":"queued"}
```

```bash
curl -X POST /api/v1/build -H "Content-Type: application/json" -H "X-API-Key: ib_…" \
  -d '{"url":"https://mi-tienda.com","name":"Mi Tienda","package":"com.miempresa.miapp","output":"apk","template":"ecommerce"}'
# → 202 {"buildId":"abc123","status":"queued","branch":"build-abc123"}
```

`POST /api/build` aceita a configuração completa: `url` ou `htmlCode` com `inputType`, `appName`, `packageName`, `outputType` (`apk`/`aab`/`both`), `outputs` (lista de formatos: `apk`, `aab`, `xapk`, `apks`, `ipa`, `exe`, `msi`, `dmg`, `appimage`), `platform` (`android`/`ios`/`both`), `permissions`, `plugins`, `provider`, `template`, `streamUrl`, `nativeAudio`, `nativeAutoplay`, `orientation`, `iconBase64`, assinatura de keystore e iOS, `webhookUrl`, `desktopEnabled` e o resto dos campos que os SDKs normalizam.

`POST /api/v1/build` é deliberadamente mais estreito: só reconhece `url`, `name`/`appName`, `package`/`packageName`, `output`/`outputType`, `outputs`, `platform`, `inputType` + `htmlCode`, `versionName`, `versionCode`, `compileSdk`, `targetSdk`, `minSdk`, `permissions`, `plugins`, `provider`, `template`, `streamUrl`, `nativeAudio`, `nativeAutoplay` e `webhookUrl`. O ícone e as flags de UI não passam por aí; use `/api/build` se precisar deles.

Erros que você vai ver antes de qualquer coisa ser disparada: GitHub sem configuração devolve `503` com o aviso de `.env`; a URL bloqueada por segurança devolve `400`; HTML acima de 500.000 caracteres devolve `400`; um ícone maior que 7 MB devolve `400`; e o limite de 10 builds por hora por IP devolve `429`. Esse contador é o mesmo que usa a descompilação na nuvem, então uma rodada de descompilações consome também a sua cota de builds.

Durante a compilação, os passos passam por `Enviando proyecto a GitHub`, `Sincronizando workflow`, `Subiendo proyecto`, `Lanzando compilacion en GitHub Actions`, `En cola en GitHub Actions` e `Compilando APK`, e terminam em `Build completado` ou `Build fallido`.

## Consultar status e baixar

O estúdio consulta a cada 3 segundos. Você pode fazer isso na frequência que quiser.

```bash
curl /api/build/abc123
# → {"id":"abc123","status":"building","step":"Compilando APK","runUrl":"https://github.com/…","apkUrl":null,"outputType":"apk"}
```

`status` passa por `queued` → `building` → `success` ou `failed`. Se o build não está mais em memória, o endpoint olha no histórico e devolve a entrada com `fromHistory: true`; se não aparecer, `404`.

`GET /api/v1/build/:id` devolve o mesmo com outra forma: `apkUrl`, `aabUrl` e `ipaUrl` relativos à API (ou `null` se aquele artefato não foi gerado), mais `outputs` (o que você pediu) e `formats` (o que o artefato no GitHub Actions confirma que existe).

```bash
curl /api/v1/build/abc123
# → {"buildId":"abc123","status":"success","apkUrl":"/api/download/abc123","aabUrl":null,"ipaUrl":null,"outputs":["apk"],"formats":["apk"]}
```

Downloads:

- `GET /api/download/:id` — APK.
- `GET /api/download/:id/aab` — AAB.
- `GET /api/download/:id/ipa` — IPA, só se houve assinatura da Apple.

Os três funcionam igual: procuram o artefato do run, abrem o ZIP que o GitHub Actions subiu e devolvem o binário solto com a sua extensão (se não encontram o binário, devolvem o ZIP inteiro). Se o build ainda está em progresso, respondem `404` com "Build aun en progreso".

Há uma condição que vale lembrar: o download precisa que o build esteja na memória do servidor. Se o processo reiniciou, o endpoint responde `404` mesmo que o artefato exista no GitHub. O histórico serve para consultar status e configuração, não para baixar.

Os artefatos são servidos pelo GitHub Actions e expiram aos 30 minutos. `GET /api/apk-info/:id` devolve a ficha do artefato (nome, tamanho em MB, links de cada um) só quando o build já terminou. `GET /api/build/:id/logs` devolve o log do run truncado em 80.000 caracteres, e só se o build já tem `runId`.

O servidor consulta o GitHub a cada 6 segundos e faz 200 tentativas: se se esgotam, o build passa para `failed` com "Tiempo de espera agotado consultando GitHub" e a branch é apagada aos 60 segundos.

Para pedir o projeto sem compilar:

```bash
curl -X POST /api/project -H "Content-Type: application/json" -d '{"url":"https://mi-tienda.com","template":"ecommerce"}' -o proyecto.zip
```

## Templates

```bash
curl /api/templates
curl /api/templates/radio
curl /api/templates/radio/native
```

A lista traz `id`, `name`, `description`, `hasFace` e o audit resumido (`ok`, `total`, `readiness`, `canBuild`). O detalhe inclui `config` e `faceHtml`. O terceiro gera em memória o manifesto, os arquivos Java/XML e o audit sem compilar. O detalhe de cada template está em [templates.md](./templates.md).

## Permissões e readiness

```bash
curl /api/permissions/spec
curl -X POST /api/permissions/audit -H "Content-Type: application/json" -d '{"appName":"Mi Tienda","url":"https://mi-tienda.com","permissions":{"cameraMic":true}}'
curl -X POST /api/permissions/suggest -H "Content-Type: application/json" -d '{"url":"https://mi-tienda.com"}'
curl -X POST /api/build-readiness -H "Content-Type: application/json" -d '{"appName":"Mi Tienda","url":"https://mi-tienda.com","permissions":{"gps":true}}'
```

`spec` devolve as entradas do Permission Engine (86 na versão atual). `audit` devolve uma linha por permissão com `status` (`ok`/`warn`/`fail`), `minSdk`, implementação nativa e se o provider o suporta, mais `ok`, `total`, `canBuild`, `verifiedAll` e `readiness`. `suggest` aceita `{html}`, `{url}` ou `{detectedApis}` e responde `{detected, suggested, count}`.

`build-readiness` é o que usa o passo de Compilar. Devolve `readiness` (0-100), `checks`, `audit`, `warnings` e `canBuild`. `canBuild` só é `true` se o audit passa, há URL ou HTML, e o áudio nativo tem o seu stream. Um aviso típico é "Audio nativo activo pero sin URL del stream: pon tu servidor en Audio nativo", que bloqueia a rádio até que você escreva `streamUrl`.

**Foreground + WifiLock**: se `permissions.foreground` está ativado, o gerador inclui agora `WifiLock` (`WIFI_MODE_FULL_HIGH_PERF`, com `try/catch`) para evitar que o áudio corte quando a tela apaga por economia de energia do WiFi. O `WakeLock` (PARTIAL) continua ativo também. Veja `foreground.md` para os detalhes do serviço em segundo plano.

O campo `provider` na configuração agora é propagado corretamente para `build-config.json` (antes se perdia com escapes quebrados no workflow) e o pipeline usa esse valor para decidir se injeta o `MainActivity` nativo/gecko ou a ponte do Capacitor.

`POST /api/manifest-diff` compara o que você pediu com o que é gerado: devolve `requested`, `generated`, `missing`, `unexpected` e `rows` com status `MATCH` ou `MISSING` por permissão. Serve para detectar permissões que ficaram de fora do manifesto antes de compilar.

## Análise de web

```bash
curl "/api/analyze?url=https://mi-tienda.com"
curl -X POST /api/analyze/html -H "Content-Type: application/json" -d '{"html":"<html>…</html>"}'
curl -X POST /api/analyze/fix -H "Content-Type: application/json" -d '{"html":"<html>…</html>"}'
```

`GET /api/analyze` baixa a página com um timeout de 10 segundos, verifica HTTPS, viewport, manifest, favicon, theme-color, service worker, recursos com `http://`, Open Graph e dados estruturados, e devolve `score` de 0 a 100 com o seu diagnóstico. Junto com isso entrega `frameworks`, `detectedApis`, `recommendations`, `security` (pontuação com incidentes), `errors`, `optimization` e `autoFix.preview` com os primeiros 8.000 caracteres corrigidos. Se a página traz manifest, tenta baixá-lo para devolver `pwa`. Rejeita HTML de mais de 500.000 caracteres e URLs bloqueadas.

`POST /api/analyze/html` faz a mesma análise sobre HTML enviado, com o limite em 600.000 caracteres, e devolve ainda `autoFix.full`. `POST /api/analyze/fix` devolve `{fixed, originalLength, fixedLength}` sem diagnóstico.

## Inspector, descompilador

```bash
curl -X POST /api/inspect -H "Content-Type: application/json" -d '{"apkBase64":"UEs…"}'
curl -X POST /api/decompile -H "Content-Type: application/json" -d '{"apkBase64":"UEs…"}'
curl -X POST /api/decompile/cloud -H "Content-Type: application/json" -d '{"apkBase64":"UEs…"}'
curl /api/decompile/cloud/abc123/status
curl -L -o salida.zip /api/decompile/cloud/abc123/download
```

`/api/inspect` devolve ficha técnica (`packageName`, versão, tamanho, número de arquivos, `.dex`, `.so`, ícones), permissões detectadas, `riskyPermissions`, `findings` e um `security.score`. Aceita até 30 MB e no mínimo 100 bytes.

`/api/decompile` trabalha local: aceita `apkBase64` (com ou sem prefixo `data:`) ou corpo `application/octet-stream`, até 100 MB. Devolve `meta`, `importConfig`, `sourceZipBase64` e `manifestPreview`.

`/api/decompile/cloud` sobe o APK para uma branch `decompile-<id>` e lança um workflow com `jadx 1.5.1 + apktool 2.9.3`. Responde `202` com `statusUrl`, `downloadUrl` e o aviso de que o APK é apagado da branch aos 20 minutos. O limite é 60 MB e compartilha o rate limit de 10/h por IP. O status devolve `status`, `conclusion`, `runUrl`, `artifacts` e `ready`; o cliente espera com polling de 5 segundos e um teto de 5 minutos. O ZIP baixado traz `output/sources` (Java), `output/resources` (res e smali), `AndroidManifest-decoded.xml` e `REPORT.txt`.

## Ficha, segurança e privacidade

```bash
curl -X POST /api/listing -H "Content-Type: application/json" -d '{"appName":"Mi Radio","packageName":"com.miempresa.radio","template":"radio"}'
curl -X POST /api/security-audit -H "Content-Type: application/json" -d '{"appName":"Mi App","url":"https://mi-web.com","permissions":{"cameraMic":true}}'
curl "/api/privacy-policy?appName=Mi%20App&package=com.miempresa.miapp"
```

`/api/listing` devolve `{ok, listing}` com `title`, `shortDescription`, `fullDescription`, `keywords`, `category` e `packageName`, com os limites que impõe o Play Console.

`/api/security-audit` devolve `score`, `level`, o `audit` de permissões, `issues` (permissões sensíveis, cleartext) e uma lista `gdpr` de três verificações: política de privacidade linkada, permissões sensíveis desnecessárias e keystore próprio. A pontuação desconta 20 pontos por permissão em `fail`, 5 por `warn` e 5 por incidente alto.

`/api/privacy-policy` devolve texto puro com os dados que você passar. É uma base para preencher, não um documento legal pronto.

## Versões e CI/CD

```bash
curl -X POST /api/versions/publish -H "Content-Type: application/json" -d '{"appId":"com.miempresa.miapp","version":"1.0.1","changelog":"fix"}'
curl "/api/check-update?appId=com.miempresa.miapp&version=1.0.0"
curl "/api/versions/com.miempresa.miapp"
curl -X POST /api/cicd -H "Content-Type: application/json" -d '{"repo":"usuario/mi-web","branch":"main","baseUrl":"https://tu-dominio.com"}'
```

`versions/publish` guarda até 20 entradas por `appId` com `version` (formato `1.0.1`), `changelog` e data. `check-update` compara com a última publicada e responde `{updateAvailable, latest, changelog}`. Não há cliente OTA embutido no app: é um registro que você pode consultar de onde quiser.

`cicd` devolve o conteúdo de `.github/workflows/inteebuild-auto.yml` para que você o suba para o seu repo, com o `curl` que dispara o webhook. A integração real é `POST /api/git/connect` com `{repo, branch, token, webhookUrl}`, que salva o token com hash; depois `POST /api/git/webhook` com `{"repository":{"full_name":"usuario/repo"},"ref":"refs/heads/main"}` inicia um build com a config que você enviar ou com uma mínima derivada do repo. `GET /api/git/integrations` lista e `DELETE /api/git/:id` apaga.

## Webhooks

`webhookUrl` recebe POST com JSON. Os eventos são `build.completed`, `build.failed` e `build.error` (erro ao enviar o projeto para o GitHub, antes de qualquer coisa rodar).

## Utilidades diversas

- `GET /api/health` — `{ok, service, version, githubReady}`.
- `GET /api/diag` — verifica token, repo, branch e workflow no GitHub e devolve um `hint` por passo para saber o que falta em `.env`.
- `GET /api/history`, `GET /api/history/:id`, `DELETE /api/history/:id` — histórico local. A listagem devolve as 30 primeiras entradas do arquivo, que por sua vez guarda no máximo 50; `:id` devolve a entrada completa com a config usada.
- `GET /api/stats` — totais por status e por `outputType`, mais duração média dos builds concluídos.
- `GET /api/qr/:id` — PNG do link de download.
- `GET /api/cleanup?secret=…` — força a limpeza de artefatos expirados. Requer `CLEANUP_SECRET` no ambiente; sem ela o endpoint devolve `403`.
- `GET /api/ads/:slot` e `GET /api/ad-proxy?u=` — rede de anúncios própria, com cache e proxy do criativo (`u` é a URL a baixar).

Mais sobre limites e implantação em [production.md](./production.md); sobre o que sai de cada build, em [outputs.md](./outputs.md).
