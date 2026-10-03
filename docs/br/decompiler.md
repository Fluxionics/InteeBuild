# Decompiler: recupere a configuração de um APK

Suba um APK e extraia dele pacote, permissões, manifesto e um ZIP com o conteúdo. É usado a partir do passo de Compilar do estúdio (`Descompilador APK`) ou pela API. Há dois modos com escopos distintos: o local, que trabalha sobre AXML e DEX no navegador e no servidor, e o da nuvem, que roda jadx e apktool no GitHub Actions e devolve código Java real.

O local é instantâneo e não precisa do GitHub. O da nuvem leva de um a três minutos e precisa do mesmo `GITHUB_TOKEN` e `INTEE_BUILDS_REPO` dos builds.

## Modo local

```bash
curl -X POST /api/decompile -H "Content-Type: application/json" -d '{"apkBase64":"UEs…"}'
```

Também aceita o APK como corpo `application/octet-stream` e o campo `buffer`. O mínimo são 100 bytes e o máximo 100 MB. Tudo é processado no servidor sem que o binário toque um serviço externo.

A resposta é:

```json
{
  "ok": true,
  "meta": { "packageName": "com.example.app", "appName": "Mi App", "permissions": ["android.permission.CAMERA"], "hasIcon": true, "hasDex": true, "fileCount": 120, "versionName": "1.0.0", "sizeKB": 2048 },
  "axml": { "binary": true, "package": "com.example.app", "permissions": [], "minSdk": 23, "targetSdk": 35 },
  "dex": { "classCount": 900, "methodCount": 5200, "libs": ["capacitor"], "hasCapacitor": true },
  "entries": ["AndroidManifest.xml", "classes.dex", "res/…"],
  "manifestPreview": "<manifest …>…",
  "importConfig": { "appName": "…", "packageName": "…", "url": "https://example.com", "permissions": {} },
  "sourceZipBase64": "UEs…",
  "sourceZipSizeKB": 450,
  "note": "APK real: AXML decodificado (9 permisos) + DEX (900 clases, libs: capacitor) + importConfig con keys reales + ZIP fuente"
}
```

`note` explica em texto o que pôde ser recuperado, e muda conforme o caso:

- APK do InteeBuild: encontra `build-config.json` dentro e o devolve como está, como `importConfig`. É o caso que é recuperado 100%.
- APK normal: decodifica o manifesto AXML, lê `capacitor.config.json`, `www/index.html` ou `assets/www/index.html` se existirem, e analisa até cinco arquivos `classes*.dex` para detectar bibliotecas (Capacitor, Droncito, ARCore, MLKit, web3j, MQTT, GVR, Firebase, AdMob). O `importConfig` é montado com o que pôde ser lido e a URL é preenchida com `https://example.com`.
- ZIP genérico: lista os arquivos e empacota o que houver.

Dentro do ZIP-fonte vão os arquivos com menos de 4 MB, mais `DECODED-AndroidManifest.xml` e os JSON `decompiler-axml.json` e `decompiler-dex.json` com o que foi extraído. Se um arquivo pesa mais, ele fica de fora para não quebrar o navegador.

`manifestPreview` traz os primeiros 8.000 caracteres; se o manifesto é binário e não tem strings legíveis, devolve um aviso e os dados estão em `axml.permissions`.

## Modo na nuvem (jadx + apktool)

```bash
curl -X POST /api/decompile/cloud -H "Content-Type: application/json" -d '{"apkBase64":"UEs…"}'
# → 202 {"ok":true,"id":"ab12cd34","branch":"decompile-ab12cd34","tools":"jadx 1.5.1 + apktool 2.9.3","statusUrl":"…","downloadUrl":"…"}
```

O APK sobe como `input/app.apk` para uma branch efêmera `decompile-<id>` do repositório de builds, com o workflow `decompile-app.yml`. Esse workflow roda jadx 1.5.1 para fontes Java e apktool 2.9.3 para manifesto, recursos e smali, e sobe o resultado como artefato com `retention-days: 7`. A branch com o APK é apagada aos 20 minutos.

O status:

```bash
curl /api/decompile/cloud/ab12cd34/status
# → {"id":"…","branch":"…","status":"completed","conclusion":"success","runUrl":"…","artifacts":[{"name":"inteebuild-decompile-ab12cd34","id":1,"sizeKB":812}],"ready":true}
```

`ready` é `true` só quando o run terminou com sucesso e há artefatos. Enquanto não existir o run, devolve `status: "queued"`. O estúdio consulta a cada 5 segundos com um teto de 5 minutos.

```bash
curl -L -o fuentes.zip /api/decompile/cloud/ab12cd34/download
```

O ZIP traz `output/sources/**/*.java`, `output/resources/**` com res, smali e manifest, `output/AndroidManifest-decoded.xml` e `output/REPORT.txt`. Se o workflow continua rodando, o endpoint responde `409`; se terminou sem artefato, `404` com o link para os logs.

Limites do modo na nuvem: 60 MB (os blobs do git permitem), o mesmo rate limit de 10 builds por hora por IP das demais compilações, e os artefatos expiram aos 7 dias. Falha com APKs ofuscados por ofuscadores comerciais.

## Fluxo de trabalho no estúdio

1. No passo de Compilar, dentro de `Descompilador APK`, escolha o arquivo e clique em `Descompilar`.
2. Revise `packageName`, permissões, `Manifest preview` e as notas do que pôde ser lido.
3. Clique no botão de importar do resultado: preenche o wizard com nome, pacote, URL e permissões.
4. Passe pelo Audit do passo de Permissões antes de compilar.
5. Se você precisa do código Java de verdade, clique em `Decompilar en la nube (jadx + apktool)` e baixe o ZIP de fontes.

O mesmo caminho vale pela API: `POST /api/decompile`, `importConfig`, `POST /api/build` com esses campos e a compilar.

## O que não faz

- Não desobfusca código. Os ofuscadores comerciais produzem código que o jadx devolve ilegível ou incompleto.
- Não extrai chaves, certificados nem recursos ofuscados.
- O `importConfig` de um APK de terceiros usa `https://example.com` como URL: troque pela real antes de compilar.
- Não converte um APK num projeto Gradle completo: devolve manifesto, config e um ZIP com o conteúdo para que você o reimporte no InteeBuild.

Se o que você quer é inspecionar um APK sem reimportá-lo, `POST /api/inspect` devolve ficha técnica e um `security.score` com um limite mais baixo de 30 MB. Os detalhes de limite e rate limit estão em [api.md](./api.md).
