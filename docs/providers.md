# Providers WebView — qué motor compila tu app

El provider cambia el motor que renderiza tu web, el tamaño del APK y qué plugins funcionan. Se elige en el Paso 1 → tarjeta `Proveedor de Compilación PRO`.

## Tabla rápida

| Provider | Estado | APK aprox | Cuándo usarlo | Limitaciones |
|---|---|---|---|---|
| Capacitor 7 | READY | +3 MB base | Default. Quieres plugins y `InteeBridge` | APK más grande |
| Native WebView | READY | +1.5 MB base | APK ultraligero, arranque rápido | Sin plugins Capacitor, usa `JSBridge` propio + `catalog.js` |
| TWA Chrome | EXPERIMENTAL | Muy ligero | Tu web ya es PWA perfecta, quieres Chrome real | Requiere Chrome instalado + `assetlinks.json` |
| GeckoView | EXPERIMENTAL | +15 MB | Evitar bugs de Chromium, privacidad Firefox | Requiere agregar `org.mozilla.geckoview` manualmente |
| Cordova | EXPERIMENTAL | Medio | Proyecto legacy Cordova | Solo `config.xml` de referencia |
| Flutter / Tauri | PLANNED | — | Roadmap | Solo generan README, no compilan aún |

## Cómo activarlo

Studio: marca la tarjeta del provider. API:

```json
{ "appName": "Mi App", "url": "https://mi-web.com", "provider": "native" }
```

El ZIP incluye `provider.json` con `{provider, version, webview}` y el workflow aplica el motor en el paso `Apply provider WebView`.

## Qué cambia por provider

- **Capacitor:** genera `capacitor.config.json`, instala `@capacitor/*`, `MainActivity extends BridgeActivity`. Parches reales: permisos runtime, accesos especiales, DownloadManager, audio nativo.
- **Native:** genera `native-MainActivity.java` (`AppCompatActivity + WebView`) con permisos, accesos especiales y audio nativo horneados. El workflow lo copia como `MainActivity.java`. Manifest usa `.MainActivity`.
- **Gecko:** genera `gecko-MainActivity.java` con hooks de permisos. EXPERIMENTAL: agrega `org.mozilla.geckoview` a tu `build.gradle` manualmente.
- **TWA:** genera `twa-manifest.json` + `assetlinks.json`. EXPERIMENTAL: sube `assetlinks.json` a `https://tu-dominio/.well-known/`.
- **Cordova:** genera `config.xml` de referencia. EXPERIMENTAL.
- **Flutter / Tauri:** PLANNED. Hoy solo generan README, no compilan.

## Compatibilidad con permisos

El Audit muestra `provider: OK / WARN`. Ejemplo: `NFC` con `NDEFReader` solo funciona bien en Chromium (Capacitor/Native). En Gecko puede marcar `WARN`.

Si cambias de provider, ejecuta el Audit de nuevo: algunos handlers cambian.

## Anuncios (AdMob): estado honesto

Hoy el generador emite configuración real pero parcial:

```json
{
  "admobAppId": "ca-app-pub-xxxxxxxxxxxxxxxx~yyyyyyyyyy",
  "admobInterstitial": true,
  "admobRewarded": true
}
```

Generado: `admob-config.json` + `meta-data APPLICATION_ID` en el Manifest + plugin `@capacitor-community/admob` si lo marcas. **No generado:** `AdView`/`Interstitial` en código ni inicialización `MobileAds` — por eso el Audit marca `ads` como NO GENERADO y bloquea builds que lo seleccionen. Se implementará con SDK real antes de anunciarlo como listo.

### Manifest generado (esto sí existe)
```xml
<meta-data android:name="com.google.android.gms.ads.APPLICATION_ID" android:value="ca-app-pub-xxx~yyy" />
```

Si cambias de provider, ejecuta el Audit de nuevo: algunos handlers cambian.
