# Guía de inicio rápido — Tu primer APK en 5 minutos

Esta guía te lleva desde cero hasta descargar tu APK.

## 1. Prepara tu fuente (1 min)

Tienes dos opciones:

- **URL**: la dirección de tu sitio, por ejemplo `https://mi-tienda.com`. Debe empezar con `http://` o `https://` y ser pública (no localhost).
- **HTML directo**: pega tu código o pulsa **"Descargar ejemplo HTML"** para inspirarte.

Consejo: pulsa **"Analizar salud web"** antes de compilar. Una puntuación de 80+ significa que tu sitio está listo.

## 2. Elige plantilla o permisos (1 min)

- Si no sabes qué permisos marcar, elige una **plantilla** arriba (Web, PWA, Radio, Tienda, Blog, Juego...). Marca lo necesario por ti.
- Marca solo los permisos que tu app usa de verdad. Google Play rechaza permisos sensibles sin justificación (SMS, teléfono, superposición).

## 3. Personaliza (2 min)

- **Nombre**: solo letras, números, espacios, guiones y puntos (2-40 caracteres). Ejemplo: `Mi Tienda`.
- **Package ID**: solo minúsculas, números y puntos, con al menos un punto. Ejemplo: `com.miempresa.miapp`. Si lo dejas vacío se genera solo.
- **Versión**: números separados por puntos. Ejemplo: `1.0.0`.
- Sube tu icono (PNG/JPG/WebP, ideal 512×512) y elige salida: APK, AAB o ambos.

## 4. Compila y descarga (1 min + espera)

1. Revisa el resumen en el paso de compilación.
2. Pulsa **Compilar APK**.
3. Sigue el progreso en vivo. Si falla, abre **Logs** para ver el detalle en GitHub.
4. Descarga tu APK. En Android permite "instalar apps desconocidas" para instalarlo.

## Siguiente paso

- Lee [troubleshooting.md](./troubleshooting.md) si algo falla.
- Lee [permissions.md](./permissions.md) para cada permiso con pruebas reales.
- Para radios: [foreground.md](./foreground.md).
- Para automatizar: [api.md](./api.md) y panel `developer.html`.
- Guarda tu configuración con el botón **JSON** del historial para reutilizarla.

## Índice completo

Ver [README de docs](./README.md).
