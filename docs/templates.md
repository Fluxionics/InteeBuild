# Guía de Plantillas

InteeBuild incluye 30+ plantillas preconfiguradas que cubren los casos de uso más comunes. Cada plantilla viene con permisos, plugins y configuraciones óptimas verificadas.

## Plantillas Disponibles

### Web & Contenido

#### Web estándar
- **Uso:** Sitios web genéricos sin funcionalidades especiales
- **Permisos:** Solo INTERNET
- **Proveedor:** Capacitor 7
- **Características:** Pull-to-refresh, pantalla offline, descargas

#### PWA Nativa
- **Uso:** Aplicaciones web progresivas
- **Permisos:** Notificaciones, almacenamiento
- **Proveedor:** Capacitor 7
- **Características:** Soporte PWA completo, service worker, manifest

#### Portal Noticias / Blog
- **Uso:** Blogs, portales de noticias, medios
- **Permisos:** Notificaciones, almacenamiento
- **Proveedor:** Capacitor 7
- **Características:** Lectura offline, compartir contenido

#### News & Medios
- **Uso:** Portales de noticias modernos
- **Permisos:** Notificaciones, almacenamiento
- **Proveedor:** Capacitor 7
- **Características:** Notificaciones push, offline reader, zoom de texto

> **Nota:** Todas las plantillas incluyen iconos SVG en lugar de emojis para un diseño más consistente y profesional.

### Audio & Media

#### Radio & Audio Stream
- **Uso:** Emisoras de radio, streaming de audio
- **Permisos:** Foreground, Wake Lock, notificaciones
- **Proveedor:** Capacitor 7
- **Características:** Audio 100% nativo, reproducción con pantalla apagada
- **Nota:** Ver [docs/foreground.md](./foreground.md) para configuración detallada

#### Podcast & Audio On-Demand
- **Uso:** Aplicaciones de podcast, audio bajo demanda
- **Permisos:** Foreground, Wake Lock, notificaciones, almacenamiento
- **Proveedor:** Capacitor 7
- **Características:** Lista de episodios, descargas offline, controles de medios

#### Video & Streaming
- **Uso:** Plataformas de video, streaming
- **Permisos:** Foreground, Wake Lock
- **Proveedor:** Capacitor 7
- **Características:** Audio nativo + video, pantalla encendida, rotación por sensor

### Comercio & Negocios

#### Tienda Ecommerce
- **Uso:** Tiendas online, catálogos de productos
- **Permisos:** Almacenamiento, cámara/micrófono, GPS
- **Proveedor:** Capacitor 7
- **Características:** Fotos de productos, ubicación, compartir

#### Food Delivery
- **Uso:** Aplicaciones de delivery de comida
- **Permisos:** GPS, notificaciones, cámara/micrófono, almacenamiento
- **Proveedor:** Capacitor 7
- **Características:** Seguimiento de pedidos, fotos, GPS

#### Marketplace
- **Uso:** Plataformas de compra-venta
- **Permisos:** Cámara/micrófono, almacenamiento, GPS, notificaciones
- **Proveedor:** Capacitor 7
- **Características:** Fotos, ubicación, pagos integrados

#### Real Estate
- **Uso:** Bienes raíces, propiedades
- **Permisos:** GPS, cámara/micrófono, almacenamiento, teléfono
- **Proveedor:** Capacitor 7
- **Características:** Mapas, fotos, llamadas directas

#### Banking & FinTech
- **Uso:** Banca móvil, finanzas
- **Permisos:** Biometría, notificaciones
- **Proveedor:** Capacitor 7
- **Características:** Seguridad biométrica, protección anti-screenshots, AAB para Play Store

#### Finanzas & Pagos
- **Uso:** Wallets, pagos móviles
- **Permisos:** Biometría, notificaciones
- **Proveedor:** Capacitor 7
- **Características:** Bloqueo de selección, protección de pantalla

### Social & Comunicación

#### Comunidad & Social
- **Uso:** Redes sociales, comunidades
- **Permisos:** Notificaciones, cámara/micrófono, almacenamiento
- **Proveedor:** Capacitor 7
- **Características:** Fotos, avisos, compartir

#### Social Network
- **Uso:** Redes sociales completas
- **Permisos:** Cámara/micrófono, almacenamiento, notificaciones, GPS
- **Proveedor:** Capacitor 7
- **Características:** Fotos, videos, ubicación, notificaciones en tiempo real, deep links

### Productividad & Negocios

#### Corporativa
- **Uso:** Apps empresariales, intranets
- **Permisos:** Notificaciones, almacenamiento, biometría
- **Proveedor:** Capacitor 7
- **Características:** Acceso biométrico, AAB para Play Store, FLAG_SECURE

#### Panel & Analytics
- **Uso:** Dashboards, paneles de control
- **Permisos:** Notificaciones
- **Proveedor:** Capacitor 7
- **Características:** Orientación portrait, FLAG_SECURE

#### Portafolio / CV
- **Uso:** Portafolios personales, CVs
- **Permisos:** Notificaciones, almacenamiento
- **Proveedor:** Capacitor 7
- **Características:** Presentación ligera, compartir

### Educación & Aprendizaje

#### Educación & Cursos
- **Uso:** Plataformas educativas, cursos online
- **Permisos:** Notificaciones, almacenamiento, cámara/micrófono
- **Proveedor:** Capacitor 7
- **Características:** Clases con cámara, archivos, avisos

### Entretenimiento

#### Juego HTML5
- **Uso:** Juegos web, juegos HTML5
- **Permisos:** Wake Lock, vibración
- **Proveedor:** Capacitor 7
- **Características:** Horizontal, pantalla completa, sin pausas

### Utilidades & Herramientas

#### Mapas & Geolocalización
- **Uso:** Aplicaciones basadas en mapas
- **Permisos:** GPS preciso
- **Proveedor:** Capacitor 7
- **Características:** GPS en primer plano

#### Travel & Turismo
- **Uso:** Guías de viaje, turismo
- **Permisos:** GPS, cámara/micrófono, almacenamiento, notificaciones
- **Proveedor:** Capacitor 7
- **Características:** Mapas, GPS, fotos, notificaciones de viajes

#### Delivery & Rastreo
- **Uso:** Logística, rastreo de envíos
- **Permisos:** GPS, GPS en segundo plano, notificaciones, cámara/micrófono
- **Proveedor:** Capacitor 7
- **Características:** GPS en tiempo real, notificaciones, cámara para evidencias

### Salud & Bienestar

#### Salud & Fitness
- **Uso:** Apps de salud, monitoreo de bienestar
- **Permisos:** Sensores, notificaciones, reconocimiento de actividad
- **Proveedor:** Capacitor 7
- **Características:** Sensores de actividad, recordatorios

#### Fitness & Deportes
- **Uso:** Entrenamientos, deportes
- **Permisos:** Sensores, GPS, reconocimiento de actividad, notificaciones, Wake Lock
- **Proveedor:** Capacitor 7
- **Características:** Seguimiento de entrenamientos, GPS, sensores

### Tecnología & IA

#### AI Web Application
- **Uso:** Apps de inteligencia artificial
- **Permisos:** Micrófono, cámara/micrófono
- **Proveedor:** Capacitor 7
- **Características:** Voz, cámara, portapapeles

### Seguridad & Emergencias

#### Emergency & SOS
- **Uso:** Apps de emergencia, SOS
- **Permisos:** GPS, GPS en segundo plano, teléfono, notificaciones, cámara/micrófono
- **Proveedor:** Capacitor 7
- **Características:** GPS preciso, llamada automática, notificaciones, alta prioridad

## Cómo Usar las Plantillas

1. **Seleccionar plantilla:** En el Studio, elige la plantilla del dropdown
2. **Personalizar:** Ajusta nombre, paquete, versión, icono
3. **Configurar fuente:** URL o HTML según tu caso
4. **Revisar permisos:** La plantilla configura permisos óptimos automáticamente
5. **Compilar:** Genera APK o AAB con la configuración verificada

## Plantillas y Foreground Service

Las plantillas **Radio**, **Streaming**, **Podcast** y **Delivery** incluyen configuración de Foreground Service para ejecución en segundo plano. Consulta [docs/foreground.md](./foreground.md) para detalles técnicos.

## Personalización Avanzada

Cada plantilla puede personalizarse más en el modo avanzado:
- Agregar/quitar permisos individuales
- Modificar plugins nativos
- Ajustar SDK, orientación, colores
- Configurar splash screen, deep links

## Contribuir

¿Falta una plantilla? Abre un issue en GitHub con tu caso de uso y la comunidad puede ayudarte a crearla.