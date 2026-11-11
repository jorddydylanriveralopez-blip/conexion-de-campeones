/**
 * Pega esto en la misma hoja de Google que alimenta el CSV de boletos:
 * Extensiones → Apps Script → nuevo proyecto.
 *
 * 1) Propiedades del proyecto (ícono de engrane) → Script properties:
 *    SHEET_WEBHOOK_TOKEN = el mismo valor que SHEET_WEBHOOK_TOKEN en tu hosting
 *    SHEET_WEBHOOK_URL   = https://TU-DOMINIO/ruta/webhook_sheets.php
 *       (sin token en la URL; el script lo añade solo)
 *
 * 2) Reloj (triggers) → Agregar trigger:
 *    - Función: onCambioHoja
 *    - Evento: Al editar (On edit)
 *
 * Opcional: también puedes renombrar onCambioHoja a onEdit y usar el disparador simple de edición.
 *
 * onEdit se dispara en cada edición; el PHP tiene cooldown 10 min para no spamear.
 */

/** Disparador simple de hoja: descomenta y borra onCambioHoja del trigger si prefieres nombre estándar. */
// function onEdit(e) { onCambioHoja(e); }

function onCambioHoja(e) {
  var token = PropertiesService.getScriptProperties().getProperty('SHEET_WEBHOOK_TOKEN');
  var baseUrl = PropertiesService.getScriptProperties().getProperty('SHEET_WEBHOOK_URL');
  if (!token || !baseUrl) {
    return;
  }
  var url = baseUrl.indexOf('?') >= 0
    ? baseUrl + '&token=' + encodeURIComponent(token)
    : baseUrl + '?token=' + encodeURIComponent(token);

  var options = {
    method: 'get',
    muteHttpExceptions: true,
    followRedirects: true,
    validateHttpsCertificates: true
  };

  UrlFetchApp.fetch(url, options);
}
