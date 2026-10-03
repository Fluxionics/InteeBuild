# Início rápido

Este guia leva de um site a um APK instalável usando o estúdio em `index.html`. A configuração leva alguns minutos; a espera real é a do GitHub Actions, entre três e seis minutos por build em um runner gratuito.

## 1. Preparar a fonte

O estúdio aceita duas entradas no passo **Aplicação**:

- **URL**: deve começar com `http://` ou `https://` e ser pública. localhost, IPs privados e os endpoints de metadados da nuvem estão bloqueados por segurança (`isBlockedUrl` em `server/url-guard.js`), e essa mesma regra é aplicada em `/api/build` e `/api/project`.
- **HTML direto**: cole seu código. O limite é de 500.000 caracteres; se sua página for maior, minifique-a antes de colar.

Antes de continuar, clique em **Analisar saúde web**. Ele retorna uma pontuação de 0 a 100 com os problemas concretos (HTTPS, viewport, favicon, recursos `http://`). Não é um requisito para compilar, mas quase todos os problemas de "tela em branco" começam por aí. O detalhe está em [analyzer.md](./analyzer.md).

## 2. Template ou permissões manualmente

Se você não sabe quais permissões seu app precisa, escolha um template (há 29, veja [templates.md](./templates.md)): ele só pré-carrega permissões, orientação e flags de interface, nunca toca no seu HTML.

Se você marcar manualmente, marque apenas o que seu site usa de verdade. O Google Play rejeita permissões sensíveis sem justificativa (SMS, telefone, sobreposição) e o Audit avisará sobre incoerências como `gpsBackground` sem `gps`.

## 3. Personalizar

Os campos com validação estrita, porque costumam ser o motivo de um 400:

- **Nome**: letras, números, espaços, hífens e pontos, de 2 a 40 caracteres. Exemplo: `Mi Tienda`.
- **Package ID**: minúsculas, números e sublinhado, com pelo menos um ponto. Exemplo: `com.miempresa.miapp`. Se você deixar em branco, será gerado `com.inteebuild.<slug>`.
- **Versão**: números separados por pontos, até quatro componentes. Exemplo: `1.0.0`.
- **Saída**: `apk`, `aab` ou `both`. Não há outras: não são gerados binários de desktop nem de iOS, exceto o que for indicado abaixo.
- **Ícone**: PNG, JPG ou WebP em data URL. O limite é de 7 * 1024 * 1024 caracteres de base64.

O restante (orientação, splash, cores, drawer, injeção de JS) está documentado em [ui-ux.md](./ui-ux.md).

## 4. Revisar e compilar

No passo **QA** aparecem o Audit e o readiness. Se o botão de compilação reclamar, o motivo é um destes:

- `Falta URL o HTML` — volte ao passo 1.
- `Audio nativo activo pero sin URL del stream` — o template Radio traz `nativeAudio: true` com `streamUrl` vazio de propósito; cole seu stream no passo Ajustes (veja [foreground.md](./foreground.md)).
- Uma permissão em `fail` no Audit — corrija-a em vez de forçar o build.

Ao compilar, o servidor envia o projeto para uma branch `build-<id>` do seu repositório e dispara o workflow. O progresso é consultado a cada 6 segundos (até 200 tentativas) e os logs ficam em `GET /api/build/:id/logs` e no link para o GitHub Actions.

Quando terminar, baixe o APK a partir do resultado. Para instalá-lo no Android, é preciso permitir "instalar apps desconhecidos" para o navegador ou gerenciador que você usar.

## Limites que você vai encontrar

- 10 builds por hora por IP. Se você chegar ao 429, aguarde a janela expirar.
- As branches de build são apagadas ao terminar o run (um minuto depois) e os artefatos do GitHub expiram em 30 minutos: se o link de download expirou, compile novamente.
- O histórico é salvo em disco local (`data/history.json`), 50 entradas, e `GET /api/history` retorna as 30 últimas. No Render free, o disco é apagado ao reiniciar.

## Próximo passo

- Se algo falhar: [troubleshooting.md](./troubleshooting.md).
- Permissões com testes reais: [permissions.md](./permissions.md).
- Rádios e podcasts: [foreground.md](./foreground.md).
- Automação a partir do seu backend: [api.md](./api.md) e o painel `developer.html`.
- O botão **JSON** do histórico salva sua configuração para reutilizá-la.
