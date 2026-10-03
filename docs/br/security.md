# Segurança

O InteeBuild trabalha em duas frentes: o que o servidor faz para não ser um vetor de ataque, e o que gera no APK para que o app não vaze nada. Esta página descreve o que está implementado hoje, com seus limites.

## No servidor

### URLs de saída

`isBlockedUrl` é aplicado em `/api/build`, `/api/project`, `/api/analyze`, nas redireções que o analisador retorna e no download do manifesto da PWA. Bloqueia:

- Qualquer protocolo que não seja `http` ou `https`, e as URLs que não puderem ser analisadas.
- Hosts privados ou locais: `localhost`, `127.*`, `10.*`, `192.168.*`, `172.16-31.*`, `0.0.0.0`, `::1`, `fc00:*`, `fe80:*` e `169.254.*`.
- Endpoints de metadados de cloud: `169.254.169.254`, `metadata.google.internal` e `100.100.100.200`.

Isso evita que um atacante converta o analisador ou o build em um proxy para a rede interna do próprio servidor. Não protege contra destinos públicos: qualquer URL pública continua válida, porque é para isso que o produto existe.

### Tamanhos e rate limit

- HTML: 500.000 caracteres em `/api/analyze`, `/api/build` e `/api/project`; 600.000 em `/api/analyze/html`.
- Ícone: 7 MB de base64 em `/api/build`.
- Corpos: `express.json` com 110 MB e `express.raw` com 100 MB.
- APK: 100 MB no descompilador local, 60 MB na nuvem, 30 MB em `/api/inspect`.
- Rate limit: 10 operações por hora por IP em `POST /api/build`, `POST /api/v1/build` e `POST /api/decompile/cloud`. O contador é único para os três, então usar um consome a cota dos outros.

O limite vive em memória, então se perde ao reiniciar o processo.

### API keys

São salvas apenas como hash sha256 (`keyHash`) e o prefixo de dez caracteres; o segredo não persiste. `GET /api/keys` retorna a hash mascarada, e `DELETE /api/keys/:id` faz exclusão lógica com `revokedAt`, depois da qual a key deixa de autenticar. São aceitos `X-API-Key` e `Authorization: Bearer`.

Dois limites que vale conhecer: os `scopes` são salvos, mas não são verificados em nenhuma rota, e enquanto não existir nenhuma key a API inteira está aberta. Crie a primeira key antes de expor o servidor.

### CORS e cabeçalhos

`CORS_ORIGIN` no `.env` fixa a origem permitida. Se estiver vazio, qualquer origem é refletida, que é o modo de desenvolvimento; em produção, coloque seu domínio.

Toda resposta traz `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin` e `Permissions-Policy: camera=(), microphone=(), geolocation=()`.

### Segredos nas respostas

`/api/health` só diz se o GitHub está configurado. `/api/diag` verifica token, repo, branch e workflow e retorna orientações em texto, nunca o valor do token. O histórico salva a config de cada build, mas sem senhas: `iconBase64`, keystore e iOS são separados antes de gravar a entrada.

### Webhooks

`webhookUrl` recebe um POST com JSON plano (`build.completed`, `build.failed`, `build.error`) e timeout de 8 segundos. Não traz assinatura HMAC: se o seu receptor for sensível, exija um token próprio na URL ou valide a origem.

## No app gerado

### FLAG_SECURE

A opção `flagSecure` adiciona a bandeira `FLAG_SECURE` à janela de `MainActivity`, o que impede capturas de tela e gravação de tela dessa atividade. Vem ativada nos templates `empresa`, `dashboard`, `finanzas` e `banking`.

### Bloqueio de seleção

`blockSelection` injeta CSS no seu HTML (`user-select: none` em tudo, exceto campos de texto) e também passa pelo script do catálogo. Está em `finanzas` e `banking`. Serve para evitar copiar dados com um toque longo; não é criografia nem criptografia.

### O que não faz nada hoje

O template `banking` traz `screenCaptureSecurity: true` e `emergency` traz `highPriority: true`, mas nenhum dos dois campos está em `normalizeConfig`, então não chegam ao manifesto nem ao código. O bloco de canais de notificação (`notifChannel`, `notifImportance`, `notifSound`, `notifVibration`) é normalizado sim, mas também não é lido por nenhum gerador hoje: não muda a prioridade de nada.

### Permissões

O Permission Engine tem 86 entradas e 52 delas são de execução em tempo real. A ideia é mínimo privilégio: `gps` e `gpsBackground` são permissões distintas com justificativas distintas na Play Store, `bluetoothScan`, `bluetoothConnect` e `bluetoothAdvertise` podem ser pedidos separadamente, e `useExactAlarm` e `scheduleExactAlarm` também. O Audit revisa manifesto, permissões em tempo real, implementação nativa, ponte JavaScript e compatibilidade com o provider, e retorna `canBuild` só se tudo encaixar.

Um caso que bloqueia de propósito: `ads` retorna `NO GENERADO` porque o gerador não grava a inicialização do AdMob nem as views de anúncio, e o Audit o trata como falha.

### Assinatura

A assinatura própria é opcional e é configurada com seu keystore (`useCustomSigning` só ativa se houver senha e alias). Os keystores não são compartilhados entre builds, a configuração de assinatura é separada do histórico, e o download do APK sempre passa pelo seu servidor. Os builds de iOS só assinam se você enviar `.p12`, `.mobileprovision` e senha.

### Foreground service

O serviço de áudio é declarado com `android:exported="false"` e `foregroundServiceType="dataSync|mediaPlayback"` (mais `location` se houver também `advGeo`), com as permissões `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_DATA_SYNC` e `FOREGROUND_SERVICE_MEDIA_PLAYBACK`. A notificação é permanente para que o sistema não mate o serviço. O detalhe está em [foreground.md](./foreground.md).

## No GitHub Actions

Cada build sobe para uma branch `build-<id>` e roda em um runner efêmero. A branch é apagada cerca de um minuto depois de terminar, e a varredura automática dos 30 minutos leva branches com mais de 5 minutos e runs e artefatos com mais de 30 minutos. Isso limita quanto tempo seu HTML e seu APK ficam no repositório de builds.

O token que o servidor usa deve ser fine-grained, com `Contents: Read/write` e `Actions: Read/write` apenas sobre o repositório de builds. O workflow em si não usa segredos do GitHub: tudo o que ele precisa viaja na branch de build. Se você enviar um keystore próprio, esse ZIP temporário inclui `user-keystore.jks` e `signing.properties` com as senhas em texto claro, e a branch é apagada aos 60 segundos de terminar o run; a varredura dos 30 minutos limpa qualquer resíduo. Use um keystore de release que você possa se dar ao luxo de rotacionar se isso te preocupa, e um repositório de builds privado.

## Dados e privacidade

Não há banco de dados: `data/builds.json`, `data/apikeys.json`, `data/git-integrations.json` e `data/versions.json` são arquivos locais. O código HTML que você envia é subido para o repositório de builds durante o build e vai embora com a branch. A política genérica que você pode vincular na Play vem de `GET /api/privacy-policy` e foi pensada para você adaptá-la, não para publicá-la como está.

Para o usuário final, o prático é: conceda apenas as permissões que o app pede, verifique de onde veio o APK e mantenha o app atualizado. O detalhe de o que cada permissão faz está em [permissions.md](./permissions.md).

## Conformidade com a Play Store

As permissões sensíveis (`phone`, `sms`, `systemAlert`, `installPackages`, `gpsBackground`) exigem justificativa na ficha da Play. `ACCESS_BACKGROUND_LOCATION` tem seu próprio formulário e aprovação. `USE_EXACT_ALARM` só é aceito para apps de relógio, calendário ou alarme. `POST /api/security-audit` marca essas permissões e retorna os três itens da lista de GDPR que dependem de você: política vinculada, permissões desnecessárias e keystore próprio.

## Verificação manual

Depois de um build, confira o ZIP no seu terminal:

```bash
unzip -p proyecto.zip main-manifest.xml | grep "uses-permission"
unzip -p proyecto.zip MainActivity.java | grep "NativePermissions"
unzip -p proyecto.zip main-manifest.xml | grep "RadioService"
```

E com a API:

```bash
curl -X POST /api/manifest-diff -H "Content-Type: application/json" -d '{"url":"https://mi-web.com","permissions":{"gps":true}}'
curl -X POST /api/security-audit -H "Content-Type: application/json" -d '{"url":"https://mi-web.com","permissions":{"gps":true}}'
```

`manifest-diff` diz o que você pediu e o que apareceu, com `missing` e `unexpected`. `security-audit` retorna pontuação, problemas e a lista GDPR.

## Responsabilidades

Do lado do desenvolvedor do app: não colocar segredos no HTML, usar HTTPS, validar no backend o que seu site valida, e revisar o Audit antes de compilar sempre que mudar permissões. Do lado do InteeBuild: gerar o manifesto e os handlers que você pediu, validar entradas no servidor e manter os limites ativos. Nenhum dos dois substitui o outro.

Mais em [permissions.md](./permissions.md), [foreground.md](./foreground.md) e [production.md](./production.md).
