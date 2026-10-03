# Versões, atualizações e CI/CD

Tudo desta página funciona no seu próprio servidor e é salvo em arquivos locais (`data/versions.json` e `data/git-integrations.json`). Não há serviços externos nem contas adicionadas: o único que você precisa é o GitHub, que já usa para compilar.

## Versionamento

Cada build carrega `versionName` e `versionCode`. A versão aceita de um a quatro blocos numéricos separados por pontos (`1`, `1.0`, `1.0.1`, `1.0.1.2`) e o que não se encaixar é rejeitado com um `400`. O `versionCode` é um inteiro que sempre sobe: a Play Store exige que cresça a cada publicação, e o servidor aceita qualquer número inteiro positivo.

No estúdio, você preenche no passo de Aplicação. Pela API, eles vão no corpo de `POST /api/build` como `versionName` e `versionCode`; em `POST /api/v1/build` também são aceitos.

## Publicar e consultar versões

```bash
curl -X POST /api/versions/publish -H "Content-Type: application/json" \
  -d '{"appId":"com.miempresa.miapp","version":"1.0.1","changelog":"Corrige audio en segundo plano"}'
# → {"ok":true,"appId":"com.miempresa.miapp","versions":[{"version":"1.0.1","changelog":"…","publishedAt":1712345678901}]}
```

Guarda até 20 entradas por `appId`, sempre com a mais nova no começo. Se você não envia `appId` ou a versão não cumpre o formato, devolve `400`.

```bash
curl /api/versions/com.miempresa.miapp
# → {"appId":"com.miempresa.miapp","versions":[…]}
```

Devolve a lista completa. Se ninguém publicou para esse `appId`, responde com o objeto vazio (`versions: []`).

```bash
curl "/api/check-update?appId=com.miempresa.miapp&version=1.0.0"
# → {"updateAvailable":true,"latest":"1.0.1","changelog":"Corrige audio en segundo plano"}
```

Compara a versão que você envia com a última publicada, componente a componente. Se não há nada publicado, responde `{"updateAvailable":false}`.

Isto é um registro que você pode consultar: não há cliente OTA dentro do app gerado, então o banner de "nova versão disponível" você mesmo monta, na sua web ou no seu HTML, chamando este endpoint e linkando para o seu APK ou AAB.

## Compilação automática a cada push

O fluxo tem quatro passos:

1. Conecte o repositório: `POST /api/git/connect` com `{"repo":"usuario/mi-web","branch":"main"}`. A integração é salva e devolve o seu `id`.
2. Gere o workflow: `POST /api/cicd` com `{"repo":"usuario/mi-web","branch":"main","baseUrl":"https://tu-dominio.com"}`. Devolve o YAML completo e o caminho para onde subi-lo.
3. Suba esse YAML para `usuario/mi-web/.github/workflows/inteebuild-auto.yml`.
4. Cada push nessa branch dispara o `curl` do workflow contra `POST /api/git/webhook` do seu servidor.

O webhook aceita o formato nativo do GitHub (`{"repository":{"full_name":"usuario/mi-web"},"ref":"refs/heads/main"}`) e também um formato curto com `repo` e `branch`. Se não há integração registrada para essa combinação, responde `404`. Se o corpo traz um campo `config`, ele é usado como configuração do build; senão, monta-se uma mínima com `url: https://usuario/mi-web` e o nome do repositório.

As integrações são listadas com `GET /api/git/integrations` e apagadas com `DELETE /api/git/:id`.

Um detalhe a saber antes de enviar o token: o campo `token` do `connect` é salvo inteiro em `data/git-integrations.json` (além de um resumo para a listagem) e hoje nada o lê. Como o webhook não o usa, a recomendação é não enviá-lo.

Como a limpeza automática apaga branches `build-*` assim que completam alguns minutos, o repositório de builds não enche: cada push gera uma branch nova, um run e alguns artefatos que vivem pouco tempo.

Sobre os limites dos builds, em [production.md](./production.md). Sobre o que sai de cada compilação, em [outputs.md](./outputs.md).
