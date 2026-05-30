/**
 * Aviso cuando editas la columna 23 (W) — Web Push propio (sin OneSignal).
 *
 * Propiedades del script (Proyecto → Configuración → Propiedades del script):
 *   PUSH_ADMIN_URL   = https://TU-DOMINIO/push_admin_send.php
 *   PUSH_ADMIN_TOKEN = el mismo "admin_token" que en data/push_vapid.local.php del servidor
 *
 * Trigger: desde la hoja → Al editar → función enviarAlertaYaavs
 */

function enviarAlertaYaavs(e) {
  if (!e || !e.source || !e.range) {
    return;
  }
  if (e.range.getColumn() !== 23) {
    return;
  }

  var props = PropertiesService.getScriptProperties();
  var url = props.getProperty('PUSH_ADMIN_URL');
  var token = props.getProperty('PUSH_ADMIN_TOKEN');
  if (!url || !token) {
    throw new Error('Configura PUSH_ADMIN_URL y PUSH_ADMIN_TOKEN en propiedades del script.');
  }

  var payload = {
    title: '¡Actualización de Boletos!',
    body: 'Tus boletos han sido actualizados. Entra a Conexión de Campeones para ver los cambios.',
    url: 'https://ganayaavs.com',
  };

  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: { 'X-Push-Admin': token },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  var resp = UrlFetchApp.fetch(url, options);
  var code = resp.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error('push_admin_send HTTP ' + code + ': ' + resp.getContentText());
  }
}
