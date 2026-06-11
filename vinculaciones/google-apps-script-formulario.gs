/**
 * FORMULARIO VINCULACIONES → Google Sheets
 *
 * 1) Crea una hoja de cálculo nueva (o usa una existente).
 * 2) Extensiones → Apps Script → pega este archivo.
 * 3) Ejecuta una vez la función setupFormularioSheet (autoriza permisos).
 * 4) Implementar → Nueva implementación → Tipo: Aplicación web
 *    - Ejecutar como: Yo
 *    - Quién tiene acceso: Cualquiera
 * 5) Copia la URL que termina en /exec y pégala en:
 *    vinculaciones/enviar-formulario.php  →  FORMULARIO_SHEETS_WEBAPP
 *
 * Opcional — Propiedades del script:
 *   FORM_TOKEN = token secreto (el mismo en enviar-formulario.php si lo usas)
 */

var HOJA_FORMULARIO = 'Formulario Vinculaciones';

function setupFormularioSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(HOJA_FORMULARIO);
  if (!sheet) {
    sheet = ss.insertSheet(HOJA_FORMULARIO);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      'Fecha (CDMX)',
      'Nombre',
      'Teléfono',
      'Clave cliente',
      'Motivo',
      'Titular',
      'Banco',
      'CLABE',
      'Mensaje',
      'Origen',
    ]);
    sheet.getRange(1, 1, 1, 10).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

function doPost(e) {
  try {
    var props = PropertiesService.getScriptProperties();
    var tokenEsperado = props.getProperty('FORM_TOKEN');
    var raw = (e && e.postData && e.postData.contents) || '{}';
    var data = JSON.parse(raw);

    if (tokenEsperado && data.token !== tokenEsperado) {
      return jsonOut({ ok: false, error: 'Token inválido' });
    }

    if (!data.nombre || !data.telefono || !data.clave) {
      return jsonOut({ ok: false, error: 'Faltan campos obligatorios' });
    }

    setupFormularioSheet();
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HOJA_FORMULARIO);
    var fecha = Utilities.formatDate(
      new Date(),
      'America/Mexico_City',
      'yyyy-MM-dd HH:mm:ss',
    );

    sheet.appendRow([
      fecha,
      String(data.nombre || ''),
      String(data.telefono || ''),
      String(data.clave || ''),
      String(data.motivo || ''),
      String(data.titular || ''),
      String(data.banco || ''),
      String(data.clabe || ''),
      String(data.mensaje || ''),
      String(data.origen || 'ganayaavs.com/vinculaciones'),
    ]);

    return jsonOut({ ok: true });
  } catch (err) {
    return jsonOut({ ok: false, error: String(err) });
  }
}

function doGet() {
  return jsonOut({ ok: true, message: 'Web App formulario vinculaciones activa' });
}
