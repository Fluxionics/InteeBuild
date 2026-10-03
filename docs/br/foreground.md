# Áudio em segundo plano

O caso de uso que mais se repete no InteeBuild é uma rádio, um podcast ou um streaming que continue tocando com o app minimizado e a tela apagada. Este guia descreve o que o projeto gera para isso, como testar e o que fazer quando o som é cortado.

Há dois caminhos e convém escolher um:

- **Áudio nativo (recomendado).** O HTML só tem botões que chamam `window.InteeAudio`; o stream é reproduzido por `RadioService.java` com `MediaPlayer` e `MediaSession`. O que a WebView fizer deixa de importar.
- **Áudio a partir da WebView.** Sua página controla um `<audio>` ou `<video>` convencional. Com `foreground` ativado, o projeto injeta um runtime em `catalog.js` que, ao ocultar a página (app minimizado ou tela apagada), transfere a reprodução para o `RadioService` com a posição atual e a devolve à WebView ao voltar. Enquanto o app está à vista, manda seu reprodutor como sempre.

Os templates `radio`, `streaming` e `podcast` ativam `nativeAudio`.

## Configuração mínima

No estúdio, cartão **Áudio 100% nativo** (passo Ajustes): marque a reprodução nativa e cole a URL do stream. Pela API:

```json
{
  "appName": "Mi Radio",
  "url": "https://mi-radio.com",
  "template": "radio",
  "permissions": { "foreground": true, "wakeLock": true, "notifications": true },
  "nativeAudio": true,
  "nativeAutoplay": true,
  "streamUrl": "https://tu-servidor.com:8000/stream"
}
```

Com `nativeAudio` e `streamUrl` preenchidos, `normalizeConfig` força `foreground` e `wakeLock`, então não é preciso marcá-los manualmente. Sem `streamUrl`, o readiness retorna `canBuild: false` com o aviso `Audio nativo activo pero sin URL del stream`: sem URL não há nada para tocar no nativo, e esse bloqueio é deliberado.

## O que aparece no ZIP

Manifesto (verificável em `main-manifest.xml`):

```xml
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_DATA_SYNC" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />
<uses-permission android:name="android.permission.WAKE_LOCK" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<service android:name=".RadioService"
         android:exported="false"
         android:foregroundServiceType="dataSync|mediaPlayback" />
```

Arquivos:

- `RadioService.java` — canal `inteebuild_radio` com `IMPORTANCE_LOW`, `startForeground(1, notificação)` e `onStartCommand` que retorna `START_STICKY` para que o sistema o reviva. Pede o stream com `MediaPlayer` e envia o cabeçalho `Icy-MetaData: 0` para que o Shoutcast não coloque metadados no MP3. O `PARTIAL_WAKE_LOCK` e o `WifiLock` (`WIFI_MODE_FULL_HIGH_PERF`, para que o WiFi não entre em economia de energia com a tela apagada e o stream não fique sem buffer) são pedidos com `try/catch`: se a permissão faltar, continua tocando sem locks em vez de derrubar o serviço, e são liberados ao pausar ou destruir. Em `onCompletion` só reconecta se a URL parecer um stream ao vivo; um MP3 termina e para.
- `AudioBridge.java` — expõe `window.InteeAudio` com `play(url)`, `playAt(url, ms)`, `pause()`, `isPlaying()`, `isActive()` e `keepAwake(bool)`. É gerado com `foreground` mesmo que você não use áudio nativo, porque é o destino da transferência.
- `patch-main-activity.js` e `patch-audio.js` — injetam a inicialização do serviço e a ponte em `MainActivity.java`. `patch-audio.js` só toca `MainActivity extends BridgeActivity`; no provider `native` a ponte já vem pronta na classe, e em `gecko` a inicialização do serviço também vem pronta em `gecko-MainActivity.java`, mas a ponte não (veja o limite abaixo).
- `www/catalog.js` — além da interface do catálogo, traz o runtime da transferência (reconhecível por `window.__ibFg`).

No log do workflow deve aparecer `--- audio service installed ---` seguido de `1` e `--- native audio installed ---`. Se você vir `0`, o patch não foi aplicado: verifique `build-config.json` e `permissions.foreground`.

## Transferência automática do `<audio>` da página

Com `foreground` marcado, o runtime de `catalog.js` faz o seguinte em cada página (também em uma URL remota, porque o patch o injeta em `onPageFinished`):

1. Escuta `play`, `pause` e `ended` de `<audio>` e `<video>` e anota URL, posição e se está tocando.
2. Ao ocultar a página, se havia algo tocando, chama `InteeAudio.playAt(url, posição)` e pausa seu elemento. A WebView congela com a tela apagada, mas o `MediaPlayer` do serviço continua com o wakelock e o WifiLock ativos.
3. Ao voltar, se o serviço continua ativo (`isActive()`), pausa o nativo, devolve o elemento para a posição estimada e chama `play()`. Se você tiver parado o áudio pelos controles da notificação, ele não é retomado.

Limites que continuam sendo seus:

- **Provider `gecko`: não há ponte `InteeAudio`.** O GeckoView não expõe `addJavascriptInterface`, então `AudioBridge` não pode ser conectado à WebView. O serviço `RadioService` compila e pode iniciar (o hook vem pronto em `gecko-MainActivity.java`), mas seu HTML não tem `window.InteeAudio`: os botões caem no `<audio>` da web e com a tela apagada o som é cortado, porque o runtime de transferência de `catalog.js` detecta que não há ponte e não faz nada. Para rádio em segundo plano com tela apagada, use `capacitor`, `native` ou `twa`.
- URLs `blob:` (hls.js, YouTube embutido, tudo o que passe pelo Media Source Extensions) não podem ser entregues ao nativo: com a tela apagada são cortadas. Use uma URL direta de stream ou o áudio nativo.
- Os iframes não são tocados.
- Se o seu HTML pausa em `visibilitychange`, remova esse listener: a transferência e a sua pausa se atrapalham.

## Sua face HTML


```html
<button onclick="nPlay()">Play</button>
<button onclick="nPause()">Pausa</button>
<script>
  const STREAM = 'https://tu-servidor.com:8000/stream';

  function nPlay() {
    if (window.InteeAudio) InteeAudio.play(STREAM);
    else {
      const a = document.createElement('audio');
      a.src = STREAM; a.play();
    }
  }
  function nPause() {
    if (window.InteeAudio) InteeAudio.pause();
  }
</script>
```

Se em vez de áudio nativo você usar um `<audio>` da página, há quatro regras que quase sempre são quebradas:

1. `src` em `https://`, a menos que você tenha ativado tráfego HTTP cleartext.
2. Não chamar `audio.pause()` em `visibilitychange`, `pagehide` nem `blur`.
3. O primeiro `play()` tem que vir de um toque do usuário: o autoplay está bloqueado na WebView.
4. Reconectar em `error`, `stalled` e `ended`. Os streams Shoutcast e Icecast caem sozinhos de tempos em tempos e, sem nova tentativa, o silêncio parece um corte do app.

Reconexão mínima:

```html
<script>
  const a = document.getElementById('player');
  let wantPlay = false;

  document.getElementById('play').onclick = () => {
    if (a.paused) { wantPlay = true; a.load(); a.play().catch(() => {}); }
    else { wantPlay = false; a.pause(); }
  };

  ['error', 'stalled', 'suspend'].forEach(ev => a.addEventListener(ev, () => {
    if (!wantPlay) return;
    setTimeout(() => { a.load(); a.play().catch(() => {}); }, 3000);
  }));

  a.addEventListener('ended', () => {
    if (!wantPlay) return;
    a.load(); a.play().catch(() => {});
  });

  if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('play', () => {
      wantPlay = true; a.load(); a.play().catch(() => {});
    });
    navigator.mediaSession.setActionHandler('pause', () => { wantPlay = false; a.pause(); });
  }
</script>
```

## Teste no dispositivo

1. Compile com o template Radio e `streamUrl` preenchido. Antes de instalar, confira no ZIP que `main-manifest.xml` contém `RadioService` e `FOREGROUND_SERVICE_MEDIA_PLAYBACK`.
2. Abra o app: deve aparecer a notificação com o botão Play. Se não houver notificação, o serviço não iniciou e não continue com os demais testes.
3. Dê play e minimize: o áudio continua.
4. Apague a tela por 30 segundos: o áudio continua (`WAKE_LOCK` mais o `PARTIAL_WAKE_LOCK` do reprodutor).
5. Confira que a notificação não pode ser descartada (`setOngoing(true)`) e que os botões dela e da tela de bloqueio controlam o stream.

## Se cortar mesmo assim

- **Corta ao apagar a tela** — quase sempre uma URL `blob:` (hls.js, YouTube) que a transferência não pode entregar ao nativo, ou seu HTML pausa em `visibilitychange`. Com uma URL direta e sem pausas próprias, o `WAKE_LOCK` já vem automático com `foreground`.
- **Corta ao voltar do fundo e não inicia sozinho** — o elemento ficou pausado pelo sistema; dê play. Se você o parou pela notificação, esse é o comportamento esperado.
- **Não aparece notificação** — o serviço não iniciou. Verifique `servicio instalado: 1` no log.
- **Corta aos minutos com a notificação visível** — otimização de bateria agressiva do fabricante. Em Configurações, Apps, seu app, Bateria: sem restrições e permitir atividade em segundo plano.
- **Corta ao minimizar sem notificação** — o build não traz Foreground. Recompile com `foreground + wakeLock + notifications`.
- **A Play rejeita o AAB** — quase sempre `ACCESS_BACKGROUND_LOCATION` sem justificativa. Uma rádio não precisa disso.
- **`onPermissionRequest` concede tudo** — patch antigo com `grant-all`; gere o projeto novamente.

## Erros de compilação relacionados

`androidx.media.app.NotificationCompat does not exist` aparece em ZIPs gerados com uma versão anterior do workflow. O serviço usa apenas classes do framework (`Notification.MediaStyle`, `MediaPlayer`, `MediaSession`) e não precisa de dependências androidx de mídia: compile novamente e verifique `--- audio nativo instalado ---` no log.

Se `grep -c RadioService` der `0` no projeto gerado, não instale esse APK: o serviço não está lá. Se `grep -c InteeAudio` der `0`, a ponte JS não foi injetada e seus botões cairão no fallback web, que com a tela apagada é cortado. A única exceção esperada é o provider `gecko`, onde `InteeAudio` não pode existir (o GeckoView não permite); nesse caso a contagem é `0` de propósito e a transferência não vai funcionar.

## Antes de publicar

- Template Radio aplicado e `streamUrl` com seu servidor no cartão de áudio nativo.
- `main-manifest.xml` com `FOREGROUND_SERVICE_MEDIA_PLAYBACK` e `RadioService`.
- `RadioService.java`, `AudioBridge.java`, `patch-audio.js` presentes no ZIP.
- Audit com `foreground`, `wakeLock` e `notifications` em estado `GENERATED` e `verified: true`.
- Face usando `window.InteeAudio.play(url)`.
- Stream em `https://` com certificado válido.
- Teste de 30 segundos com tela apagada aprovado no dispositivo alvo.

A parte de permissões relacionada está em [permissions.md](./permissions.md); se o build falhar, [troubleshooting.md](./troubleshooting.md).
