# Guía de UI/UX

InteeBuild ofrece múltiples opciones para personalizar la interfaz de usuario y experiencia de tu aplicación Android.

## Personalización Visual

### Colores y Temas

#### Color de Acento
El color principal de tu aplicación:
```json
{
  "accentColor": "#4f46e5"
}
```

#### Color de Fondo
Color de fondo de la WebView:
```json
{
  "backgroundColor": "#ffffff"
}
```

#### Tema Oscuro/Claro
Soporte para temas automáticos:
```json
{
  "theme": "auto"  // "light", "dark", "auto"
}
```

### Status Bar y Navigation Bar

#### Status Bar Style
```json
{
  "statusBarStyle": "default"  // "default", "light", "dark"
}
```

#### Navigation Bar Style
```json
{
  "navigationBarStyle": "default"  // "default", "light", "dark"
}
```

#### Edge-to-Edge
Hace que el contenido se extienda hasta los bordes:
```json
{
  "edgeToEdge": true
}
```

## Iconos y Splash Screen

### Icono de la App
- Formatos aceptados: PNG, JPG, WebP
- Tamaño recomendado: 1024x1024px
- Se generan automáticamente todos los tamaños necesarios

### Icono Adaptativo
Genera `mipmap-anydpi-v26` con:
- Capa de fondo (monocromático)
- Capa de foreground (logo principal)
- Soporte para Android 8.0+

### Splash Screen
Configuración completa:
```json
{
  "splashEnabled": true,
  "splashColor": "#4f46e5",
  "splashDuration": 2000,
  "splashImage": "path/to/image.png"
}
```

## Orientación y Pantalla

### Orientación
```json
{
  "orientation": "any"  // "portrait", "landscape", "sensor", "any"
}
```

- `portrait`: Solo vertical
- `landscape`: Solo horizontal
- `sensor`: Detecta rotación del dispositivo
- `any`: Permite cualquier orientación

### Pantalla Completa
```json
{
  "fullscreen": true
}
```

### Mantener Pantalla Encendida
```json
{
  "keepScreenOn": true
}
```

Útil para videos, juegos, streaming.

## Navegación y Layout

### Drawer Lateral
Menú deslizante lateral:
```json
{
  "drawerEnabled": true,
  "drawerItems": [
    {"title": "Inicio", "icon": "home", "url": "/"},
    {"title": "Perfil", "icon": "user", "url": "/profile"}
  ]
}
```

### Bottom Tabs
Pestañas en la parte inferior:
```json
{
  "bottomTabsEnabled": true,
  "bottomTabs": [
    {"title": "Inicio", "icon": "home", "url": "/"},
    {"title": "Buscar", "icon": "search", "url": "/search"}
  ]
}
```

### Pull-to-Refresh
Actualización al deslizar hacia abajo:
```json
{
  "pullRefresh": true
}
```

## Pantallas Especiales

### Offline Screen
Pantalla cuando no hay conexión:
```json
{
  "offlineScreen": true,
  "offlineMessage": "Sin conexión. Revisa tu internet."
}
```

### Loading Indicator
Indicador de carga:
```json
{
  "loadingIndicator": "spinner"  // "spinner", "bar", "none"
}
```

## Seguridad Visual

### FLAG_SECURE
Bloquea capturas de pantalla:
```json
{
  "flagSecure": true
}
```

### Bloqueo de Selección
Evita copiado de texto:
```json
{
  "blockSelection": true
}
```

## Animaciones y Transiciones

### Animación de Entrada
```json
{
  "enterAnimation": "fade"  // "fade", "slide", "none"
}
```

### Transiciones
Transiciones suaves entre páginas:
```json
{
  "smoothTransitions": true
}
```

## Tipografía y Texto

### Zoom de Texto
Permite al usuario ajustar tamaño de texto:
```json
{
  "textZoom": true
}
```

### Fuente del Sistema
Usa la fuente del sistema Android:
```json
{
  "useSystemFont": true
}
```

## Responsive Design

### Viewport Configurado
El viewport móvil se configura automáticamente:
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
```

### Adaptación a Tamaños
Tu HTML debe ser responsive:
```css
@media (max-width: 768px) {
  /* Estilos móviles */
}
```

## Accesibilidad

### Contraste de Colores
Asegura contraste suficiente para lectura:
- Mínimo 4.5:1 para texto normal
- Mínimo 3:1 para texto grande

### Tamaño de Elementos Táctiles
Mínimo 48x48dp para elementos interactivos:
```css
button {
  min-height: 48px;
  min-width: 48px;
}
```

### Descripción de Imágenes
Incluye `alt` en imágenes:
```html
<img src="logo.png" alt="Logo de la aplicación" />
```

## Animaciones de Loading

### Spinner
Indicador circular de carga:
```json
{
  "loadingIndicator": "spinner"
}
```

### Barra de Progreso
Barra lineal de carga:
```json
{
  "loadingIndicator": "bar"
}
```

### Sin Indicador
Para experiencias instantáneas:
```json
{
  "loadingIndicator": "none"
}
```

## Notificaciones Visuales

### Toast Messages
Mensajes temporales:
```javascript
if (window.Intee) {
  Intee.toast('Mensaje temporal');
}
```

### Dialogs
Diálogos modales:
```javascript
if (window.Intee) {
  Intee.dialog({
    title: 'Confirmación',
    message: '¿Estás seguro?',
    buttons: ['Cancelar', 'Confirmar']
  });
}
```

## Optimización de Performance

### Lazy Loading
Carga contenido bajo demanda:
```javascript
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      loadContent(entry.target);
    }
  });
});
```

### Imágenes Optimizadas
Usa formatos modernos:
```html
<picture>
  <source srcset="image.webp" type="image/webp">
  <img src="image.jpg" alt="Descripción">
</picture>
```

### CSS Crítico
Carga CSS crítico primero:
```html
<style>
  /* CSS crítico para above-the-fold */
</style>
<link rel="preload" href="styles.css" as="style">
```

## Testing de UI/UX

### Pruebas en Dispositivos Reales
Testea en:
- Diferentes tamaños de pantalla
- Diferentes versiones de Android
- Con y sin notch
- Modo oscuro y claro

### Pruebas de Accesibilidad
- Navegación por teclado
- Lector de pantalla (TalkBack)
- Contraste de colores
- Tamaño de elementos táctiles

### Pruebas de Performance
- Tiempo de carga inicial
- Tiempo de interacción
- Uso de memoria
- Consumo de batería

## Recursos Adicionales

- [Material Design Guidelines](https://material.io/design)
- [Android Accessibility](https://developer.android.com/guide/topics/ui/accessibility)
- [Web Performance](https://web.dev/performance/)
- [Responsive Design](https://web.dev/responsive-web-design/)