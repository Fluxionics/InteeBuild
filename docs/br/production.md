# Entrada em produção

Este guia cobre como implantar o InteeBuild em serviços gratuitos e o que verificar antes de expô-lo. Tudo o que o projeto faz funciona sem planos de pagamento: os builds rodam no GitHub Actions, o servidor cabe no plano gratuito do Render e não há nem uma API de pagamento por trás.

## Implantação gratuita

`render.yaml` define o serviço com `plan: free`, `npm install` como build, `node server/server.js` como inicialização e `/api/health` como health check. Em Render > Environment vão `GITHUB_TOKEN`, `INTEE_BUILDS_REPO`, `INTEE_DEFAULT_BRANCH` e, se você quiser, `CORS_ORIGIN` e `CLEANUP_SECRET`.

Três coisas que vale ter presentes do plano gratuito:

- **O disco é apagado ao reiniciar.** Tudo o que o servidor escreve em `data/` (histórico de builds, API keys, integrações git e versões) vive no disco efêmero do Render e desaparece a cada reinício ou implantação. É esperado: não guarde ali nada que não possa perder.
- **O serviço dorme sem tráfego** e leva cerca de um minuto para acordar. A primeira requisição após a inatividade é lenta.
- **GitHub Actions cobra minutos dos repositórios privados.** Na conta gratuita há uma cota mensal de cerca de 2000 minutos em runners Linux, e cada build ocupa um runner por vários minutos. Os repositórios públicos não consomem essa cota. Se você ficar sem saldo, use um repo de builds público ou verifique o painel de billing do GitHub.

O repo de builds não custa nada e se autoclimpa: a cada 30 minutos o servidor apaga branches `build-*` e `decompile-*` com mais de 5 minutos, e runs e artefatos com mais de 30 minutos. Por isso os links de download expiram logo.

## Segurança antes de publicar

1. **Token com permissões mínimas.** Um fine-grained token apenas sobre o repo de builds, com `Contents: Read/write` e `Actions: Read/write`. Nada mais. Se vazar, o dano fica contido naquele repo.
2. **Nunca suba `.env` para o repo.** Ele está em `.gitignore`. As variáveis vão em Render > Environment.
3. **`CORS_ORIGIN` configurado.** Em `.env.example` ele vem vazio, que é o modo desenvolvimento (qualquer origem). Em produção, `CORS_ORIGIN=https://tu-dominio.com`.
4. **Limpeza manual desativada por padrão.** `/api/cleanup` devolve `403` a menos que você coloque `CLEANUP_SECRET` e passe `?secret=…`. A limpeza automática a cada 30 minutos não depende disso.
5. **Rate limit ativo.** 10 builds por hora por IP, compartilhados com a descompilação na nuvem. No Render o contador se perde ao reiniciar, que é um efeito colateral do disco efêmero.
6. **Proteção SSRF ativa.** As URLs para localhost, redes privadas e endpoints de metadados de cloud ficam bloqueadas em `/api/build`, `/api/project` e `/api/analyze`, e também nos redirecionamentos que o analisador devolver.
7. **Sem segredos nas respostas.** `/api/health` e `/api/diag` confirmam que o token existe e se é válido, mas nunca o devolvem. A listagem de API keys devolve o hash mascarado, não a key.

## Diagnóstico

Abra `/api/diag` no seu domínio (há também o link "Diagnóstico" no footer). Ele percorre cinco passos e para no primeiro que falha:

- `env.hasToken` ou `env.hasRepo` em `false`: faltam variáveis em Render > Environment. Adicione-as e refaça o deploy.
- `token.hint` com "inválido": o token expirou ou foi revogado; gere um novo.
- `repo.hint` com "no existe o sin acceso": `INTEE_BUILDS_REPO` está escrito errado (formato `usuario/repo`) ou o token não alcança aquele repo.
- `branch.hint` com o branch padrão do GitHub diferente do que você usa: ajuste `INTEE_DEFAULT_BRANCH` para o valor que indica a mensagem.
- `workflow.hint` com "aún no hay workflow": normal em instalação nova, o arquivo é criado sozinho no primeiro build.
- `ok: true`: tudo se encaixa. Se o build falhar depois, abra os logs do run pelo botão do resultado.

## Erros comuns

- `503 "GitHub no configurado"` — faltam `GITHUB_TOKEN` ou `INTEE_BUILDS_REPO`.
- `429` com `Limite de builds alcanzado (10 por hora)` — 10 por hora por IP; aguarde a janela expirar.
- `400` de validação — a mensagem indica o que corrigir: nome, URL bloqueada, package, versão, HTML de mais de 500.000 caracteres ou ícone de mais de 7 MB.
- Build em `failed` com erro do GitHub — abra `/api/diag` e, se der `ok: true`, verifique o log do run.
- Build em `failed` com "Tiempo de espera agotado consultando GitHub" — o servidor esgotou as suas 200 consultas de 6 segundos (cerca de 20 minutos); o runner demorou mais que o previsto ou o GitHub esteve lento.

## Custo

$0 em licenças e serviços: builds, assinatura debug, downloads e API não custam nada. O único que pode consumir dinheiro é a sua própria conta do GitHub ou do Render se você passar da cota gratuita, e isso se vê nos painéis de faturamento deles. Se em algum momento você adicionar planos de pagamento, faça-o num fork separado para não complicar esta versão.

Sobre limites concretos da API, em [api.md](./api.md). Sobre segurança dos builds e do servidor, em [security.md](./security.md).
