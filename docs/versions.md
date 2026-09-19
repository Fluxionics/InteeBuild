# Versiones, updates y CI/CD — gratis y local

Sin servicios de pago. Todo vive en `data/versions.json` de tu servidor.

## Versionado

Cada build lleva `versionName` (ej `1.0.1`) y `versionCode` (entero que siempre sube). Play Store exige subir el `versionCode` en cada release.

## Publicar y consultar updates (OTA simple)

```bash
# Publicar
curl -X POST /api/versions/publish -H "Content-Type: application/json" \
  -d '{"appId":"com.miempresa.miapp","version":"1.0.1","changelog":"Corrige audio en segundo plano"}'

# Ver historial
curl /api/versions/com.miempresa.miapp

# Desde tu app: ¿hay update?
curl "/api/check-update?appId=com.miempresa.miapp&version=1.0.0"
# → {"updateAvailable":true,"latest":"1.0.1","changelog":"..."}
```

En tu web puedes llamar a `/api/check-update` y mostrar un banner "Nueva versión disponible" con link a tu APK/AAB. Sin SDKs de pago.

## CI/CD gratis (auto-build on push)

1. Conecta el repo: `POST /api/git/connect {"repo":"usuario/mi-web","branch":"main"}`.
2. Genera el workflow: `POST /api/cicd {"repo":"usuario/mi-web","branch":"main","baseUrl":"https://tu-dominio.com"}`.
3. Sube el YAML devuelto a `usuario/mi-web/.github/workflows/inteebuild-auto.yml`.
4. Cada `push` a `main` llama a tu webhook y dispara un build con la config que envíes.

Sin GitHub Apps de pago, sin marketplaces: tu servidor + tu repo.
