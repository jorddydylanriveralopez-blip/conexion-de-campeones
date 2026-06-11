/**
 * FORMULARIO VINCULACIONES → Google Sheets
 *
 * IMPORTANTE: Borra TODO el código en Apps Script y pega ESTE archivo completo.
 *
 * Pasos:
 * 1) Ejecuta setupFormularioSheet (una vez) → acepta permisos
 * 2) Ejecuta testDoPost (una vez) → acepta permisos de escritura en la hoja
 * 3) Implementar → Nueva implementación → Web app
 *    · Ejecutar como: Yo
 *    · Quién tiene acceso: Cualquiera
 * 4) Copia la URL /exec en vinculaciones/enviar-formulario.php
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
      'Origen'
    ]);
    sheet.getRange(1, 1, 1, 10).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
}

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var props = PropertiesService.getScriptProperties();
    var tokenEsperado = props.getProperty('FORM_TOKEN');
    var raw = '{}';
    if (e && e.postData && e.postData.contents) {
      raw = e.postData.contents;
    }
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
      'yyyy-MM-dd HH:mm:ss'
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
      String(data.origen || 'ganayaavs.com/vinculaciones')
    ]);

    return jsonOut({ ok: true });
  } catch (err) {
    return jsonOut({ ok: false, error: String(err) });
  }
}

function doGet() {
  return jsonOut({ ok: true, message: 'Web App formulario vinculaciones activa' });
}

/** Ejecutar una vez en el editor antes de implementar (activa permisos de doPost). */
function testDoPost() {
  var result = doPost({
    postData: {
      contents: JSON.stringify({
        nombre: 'Prueba Apps Script',
        telefono: '0000000000',
        clave: 'TEST',
        motivo: 'Prueba',
        origen: 'test editor',
      }),
    },
  });
  Logger.log(result.getContent());
}
