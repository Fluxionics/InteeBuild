# Providers WebView — qué motor compila tu app

El provider cambia el motor que renderiza tu web, el tamaño del APK y qué plugins funcionan. Se elige en el Paso 1 → tarjeta `Proveedor de Compilación PRO`.

## Tabla rápida

| Provider | Estado | APK aprox | Cuándo usarlo | Limitaciones |
|---|---|---|---|---|
| Capacitor 7 | READY | +3 MB base | Default. Quieres plugins y `InteeBridge` | APK más grande |
| Native WebView | READY | +1.5 MB base | APK ultraligero, arranque rápido | Sin plugins Capacitor, usa `JSBridge` propio + `catalog.js` |
| TWA Chrome | EXPERIMENTAL | Muy ligero | Tu web ya es PWA perfecta, quieres Chrome real | Requiere Chrome instalado + `assetlinks.json` |
| GeckoView | EXPERIMENTAL | +15 MB | Evitar bugs de Chromium, privacidad Firefox | Descarga `GeckoView`, build más lento |
| Cordova | EXPERIMENTAL | Medio | Proyecto legacy Cordova | `config.xml` manual |
| Flutter / Tauri | PLANNED | — | Roadmap | Solo generan README, no compilan aún |

## Cómo activarlo

Studio: marca la tarjeta del provider. API:

```json
{ "appName": "Mi App", "url": "https://mi-web.com", "provider": "native" }
```

El ZIP incluye `provider.json` con `{provider, version, webview}` y el workflow aplica el motor en el paso `Apply provider WebView`.

## Qué cambia por provider

- **Capacitor:** genera `capacitor.config.json`, instala `@capacitor/*`, `MainActivity extends BridgeActivity`.
- **Native:** genera `native-MainActivity.java` (`AppCompatActivity + WebView`), el workflow lo copia como `MainActivity.java`. Manifest usa `.MainActivity`.
- **Gecko:** genera `gecko-MainActivity.java` (`GeckoView + GeckoSession`). Requiere dependencia `org.mozilla.geckoview`.
- **TWA:** genera `twa-manifest.json` + `assetlinks.json`. Requiere subir `assetlinks.json` a `https://tu-dominio/.well-known/`.
- **Cordova:** genera `config.xml`.

## Compatibilidad con permisos

El Audit muestra `provider: OK / WARN`. Ejemplo: `NFC` con `NDEFReader` solo funciona bien en Chromium (Capacitor/Native). En Gecko puede marcar `WARN`.

Si cambias de provider, ejecuta el Audit de nuevo: algunos handlers cambian.
