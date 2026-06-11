/**
 * FORMULARIO VINCULACIONES → Google Sheets
 *
 * IMPORTANTE: Borra TODO el código en Apps Script y pega ESTE archivo completo.
 *
 * Pasos:
 * 1) Ejecuta setupFormularioSheet (una vez) → acepta permisos
 * 2) Ejecuta refrescarTablaFormulario (una vez) → da formato bonito a la tabla
 * 3) Ejecuta testGuardarFormulario (una vez) → prueba de escritura
 * 4) Implementar → Nueva implementación → Web app
 *    · Ejecutar como: Yo
 *    · Quién tiene acceso: Cualquiera
 * 5) Copia la URL /exec en vinculaciones/enviar-formulario.php
 *
 * NOTIFICACIONES: cada envío manda correo a NOTIFY_EMAIL_DEFAULT (o FORM_NOTIFY_EMAIL en propiedades).
 */

var HOJA_FORMULARIO = 'Formulario Vinculaciones';
var NOTIFY_EMAIL_DEFAULT = 'jorddydylan2001@gmail.com';
var COLS_FORMULARIO = 10;

var ESTILO = {
  headerBg: '#1e3a5f',
  headerFg: '#ffffff',
  rowPar: '#f8fafc',
  rowImpar: '#e8f1fa',
  borde: '#b8c9de',
  acento: '#f5b800',
};

var ENCABEZADOS = [
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
];

function setupFormularioSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(HOJA_FORMULARIO);
  if (!sheet) {
    sheet = ss.insertSheet(HOJA_FORMULARIO);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(ENCABEZADOS);
  }
  formatFormularioSheet(sheet);
}

/** Ejecutar una vez para embellecer la tabla (también con datos ya existentes). */
function refrescarTablaFormulario() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HOJA_FORMULARIO);
  if (!sheet) {
    setupFormularioSheet();
    return;
  }
  formatFormularioSheet(sheet);
}

function formatFormularioSheet(sheet) {
  var lastRow = Math.max(sheet.getLastRow(), 1);
  var header = sheet.getRange(1, 1, 1, COLS_FORMULARIO);
  var tabla = sheet.getRange(1, 1, lastRow, COLS_FORMULARIO);

  header
    .setValues([ENCABEZADOS])
    .setBackground(ESTILO.headerBg)
    .setFontColor(ESTILO.headerFg)
    .setFontWeight('bold')
    .setFontSize(11)
    .setFontFamily('Arial')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setWrap(true);

  sheet.setRowHeight(1, 44);

  if (lastRow > 1) {
    var cuerpo = sheet.getRange(2, 1, lastRow - 1, COLS_FORMULARIO);
    cuerpo
      .setFontSize(10)
      .setFontFamily('Arial')
      .setFontColor('#1a202c')
      .setVerticalAlignment('middle')
      .setWrap(true);

    for (var r = 2; r <= lastRow; r++) {
      var fondo = r % 2 === 0 ? ESTILO.rowPar : ESTILO.rowImpar;
      sheet.getRange(r, 1, 1, COLS_FORMULARIO)
        .setBackground(fondo)
        .setHorizontalAlignment('left');
    }

    sheet.getRange(2, 1, lastRow - 1, 1).setHorizontalAlignment('center');
    sheet.getRange(2, 3, lastRow - 1, 1).setHorizontalAlignment('center');
    sheet.getRange(2, 4, lastRow - 1, 1).setHorizontalAlignment('center');
    sheet.getRange(2, 8, lastRow - 1, 1).setHorizontalAlignment('center').setFontFamily('Roboto Mono');

    for (var h = 2; h <= lastRow; h++) {
      sheet.setRowHeight(h, 36);
    }
  }

  tabla.setBorder(
    true, true, true, true, true, true,
    ESTILO.borde,
    SpreadsheetApp.BorderStyle.SOLID_MEDIUM
  );

  header.setBorder(
    false, false, true, false, false, false,
    ESTILO.acento,
    SpreadsheetApp.BorderStyle.SOLID_THICK
  );

  sheet.setColumnWidth(1, 148);
  sheet.setColumnWidth(2, 185);
  sheet.setColumnWidth(3, 118);
  sheet.setColumnWidth(4, 132);
  sheet.setColumnWidth(5, 195);
  sheet.setColumnWidth(6, 210);
  sheet.setColumnWidth(7, 105);
  sheet.setColumnWidth(8, 168);
  sheet.setColumnWidth(9, 240);
  sheet.setColumnWidth(10, 210);

  sheet.setFrozenRows(1);
  sheet.setTabColor(ESTILO.headerBg);

  var filtro = sheet.getFilter();
  if (filtro) {
    filtro.remove();
  }
  header.createFilter();
}

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function guardarFormulario(data) {
  var props = PropertiesService.getScriptProperties();
  var tokenEsperado = props.getProperty('FORM_TOKEN');

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

  formatFormularioSheet(sheet);
  notificarNuevoFormulario(data, fecha);

  return jsonOut({ ok: true, saved: true });
}

function doGet(e) {
  try {
    var params = (e && e.parameter) || {};
    if (params.action === 'submit') {
      return guardarFormulario(params);
    }
    return jsonOut({ ok: true, message: 'Web App formulario vinculaciones activa', version: 2 });
  } catch (err) {
    return jsonOut({ ok: false, error: String(err) });
  }
}

function doPost(e) {
  try {
    var raw = '{}';
    if (e && e.postData && e.postData.contents) {
      raw = e.postData.contents;
    }
    return guardarFormulario(JSON.parse(raw));
  } catch (err) {
    return jsonOut({ ok: false, error: String(err) });
  }
}

/** Ejecutar una vez en el editor antes de implementar (activa permisos). */
function testGuardarFormulario() {
  var result = guardarFormulario({
    nombre: 'Prueba Apps Script',
    telefono: '0000000000',
    clave: 'TEST',
    motivo: 'Prueba',
    origen: 'test editor',
  });
  Logger.log(result.getContent());
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Envía correo a FORM_NOTIFY_EMAIL (propiedades del script). */
function notificarNuevoFormulario(data, fecha) {
  try {
    var props = PropertiesService.getScriptProperties();
    var emailsRaw = props.getProperty('FORM_NOTIFY_EMAIL') || NOTIFY_EMAIL_DEFAULT;

    var destinatarios = emailsRaw.split(',').map(function (s) {
      return s.trim();
    }).filter(function (s) {
      return s.indexOf('@') > 0;
    });
    if (destinatarios.length === 0) {
      return;
    }

    var nombre = String(data.nombre || '—');
    var motivo = String(data.motivo || '—');
    var asunto = '📋 Vinculaciones: ' + nombre + ' — ' + motivo;

    var filas = [
      ['Fecha', fecha],
      ['Nombre', nombre],
      ['Teléfono', String(data.telefono || '—')],
      ['Clave cliente', String(data.clave || '—')],
      ['Motivo', motivo],
      ['Titular', String(data.titular || '—')],
      ['Banco', String(data.banco || '—')],
      ['CLABE', String(data.clabe || '—')],
      ['Mensaje', String(data.mensaje || '—')],
      ['Origen', String(data.origen || 'ganayaavs.com/vinculaciones')],
    ];

    var filasHtml = filas.map(function (par) {
      return '<tr>'
        + '<td style="padding:10px 14px;background:#e8f1fa;font-weight:bold;border:1px solid #b8c9de;width:140px;">'
        + escapeHtml(par[0])
        + '</td><td style="padding:10px 14px;border:1px solid #b8c9de;">'
        + escapeHtml(par[1])
        + '</td></tr>';
    }).join('');

    var htmlBody = '<div style="font-family:Arial,sans-serif;max-width:580px;color:#1a202c;">'
      + '<div style="background:#1e3a5f;color:#fff;padding:18px 20px;border-radius:10px 10px 0 0;border-bottom:4px solid #f5b800;">'
      + '<h2 style="margin:0;font-size:18px;">Nueva solicitud</h2>'
      + '<p style="margin:6px 0 0;opacity:0.9;font-size:13px;">Formulario Vinculaciones · YAAVS</p>'
      + '</div>'
      + '<table style="width:100%;border-collapse:collapse;font-size:14px;background:#fff;">'
      + filasHtml
      + '</table>'
      + '<p style="color:#64748b;font-size:12px;margin:16px 4px 0;">'
      + 'Abre la hoja <strong>Formulario Vinculaciones</strong> para ver el registro completo.'
      + '</p></div>';

    var textoPlano = 'Nueva solicitud — Formulario Vinculaciones\n\n'
      + filas.map(function (par) {
        return par[0] + ': ' + par[1];
      }).join('\n');

    MailApp.sendEmail({
      to: destinatarios.join(','),
      subject: asunto,
      body: textoPlano,
      htmlBody: htmlBody,
      name: 'YAAVS Vinculaciones',
    });
  } catch (err) {
    Logger.log('notificarNuevoFormulario: ' + err);
  }
}

/** Prueba solo el correo (sin guardar fila nueva). */
function testNotificacionCorreo() {
  notificarNuevoFormulario({
    nombre: 'Prueba notificación',
    telefono: '0000000000',
    clave: 'TEST',
    motivo: 'Prueba de correo',
    titular: '—',
    banco: '—',
    clabe: '—',
    mensaje: 'Si lees esto, las notificaciones funcionan.',
    origen: 'test editor',
  }, Utilities.formatDate(new Date(), 'America/Mexico_City', 'yyyy-MM-dd HH:mm:ss'));
}
