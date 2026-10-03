# Contribución a InteeBuild

## Reglas básicas

Antes de realizar cambios, ten en cuenta estas normas del proyecto:

- **Estilo de código:** No agregar **comentarios** en JS/CSS/HTML (se verifica con comment-audit.js).
- **Sin emojis**. Usar iconos SVG (Lucide) si es necesario.
- **No hacer commit/push sin permiso explícito** del usuario.
- **No borrar archivos .md**. Puedes actualizarlos si es necesario.
- **No asumir librerías**: verifica que existan en el código antes de usarlas.
- **Seguridad:** Nunca registrar o commitear secrets/keys.

## Desarrollo

1. Instalar dependencias: 
pm install
2. Ejecutar servidor local: 
ode server/server.js (puerto 8787 por defecto)
3. Verificar estado: git status, git diff antes de proponer cambios

## Verificaciones obligatorias

Antes de entregar cambios, ejecutar las verificaciones:

`ash
node C:\Users\memit\AppData\Local\Temp\opencode\comment-audit.js
node C:\Users\memit\AppData\Local\Temp\opencode\wf-check.js
node C:\Users\memit\AppData\Local\Temp\opencode\devhtml-check.js
npm test  # debe pasar 22/22
`

## Tests

- Los tests deben mantener **22/22 en verde** (
pm test).
- No romper rutas ni funcionalidad existente.
- Validar con 
ode i18n/validate.js y cobertura i18n si modificas claves.
