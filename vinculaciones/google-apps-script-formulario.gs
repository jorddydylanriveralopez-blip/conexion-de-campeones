/**
 * Un Google Sheet por formulario.
 * destino=clabe-octubre ? CLABE comisiones octubre
 * destino=vinculaciones-anterior ? Formulario vinculaciones anterior
 */

var NOTIFY_EMAIL_DEFAULT = 'jorddydylan2001@gmail.com';
var HOJA = 'Respuestas';
var DESTINOS = {
  'clabe-octubre': {
    id: '1Z_MWJmrLMbqdn3XZ5RsClRDatZlOKCYwBI9p3Lj6X2Y',
    nombre: 'CLABE comisiones octubre'
  },
  'vinculaciones-anterior': {
    id: '1KCmSqfhHHYYPidFwKC9DzfhqzL_McsZN1Vg0i_qINXw',
    nombre: 'Formulario vinculaciones anterior'
  }
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
  'Origen'
];

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function prepararHoja(spreadsheetId) {
  var ss = SpreadsheetApp.openById(spreadsheetId);
  var sheet = ss.getSheetByName(HOJA);
  if (!sheet) {
    var primera = ss.getSheets()[0];
    if (primera && primera.getLastRow() === 0 && primera.getName() !== HOJA) {
      primera.setName(HOJA);
      sheet = primera;
    } else {
      sheet = ss.insertSheet(HOJA);
    }
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(ENCABEZADOS);
  } else {
    sheet.getRange(1, 1, 1, ENCABEZADOS.length).setValues([ENCABEZADOS]);
  }
  var header = sheet.getRange(1, 1, 1, ENCABEZADOS.length);
  header
    .setBackground('#1e3a5f')
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    .setFontFamily('Arial');
  sheet.setFrozenRows(1);
  ENCABEZADOS.forEach(function (_, i) {
    sheet.autoResizeColumn(i + 1);
  });
  return sheet;
}

function guardarFormulario(data) {
  var destinoKey = String(data.destino || '');
  var destino = DESTINOS[destinoKey];
  if (!destino) {
    return jsonOut({ ok: false, error: 'Formulario desconocido' });
  }
  if (!data.nombre || !data.telefono || !data.clave) {
    return jsonOut({ ok: false, error: 'Faltan campos obligatorios' });
  }

  var sheet = prepararHoja(destino.id);
  var fecha = Utilities.formatDate(new Date(), 'America/Mexico_City', 'yyyy-MM-dd HH:mm:ss');
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
    String(data.origen || '')
  ]);

  if (String(data.nombre) !== 'PRUEBA SISTEMA') {
    notificarNuevoFormulario(data, fecha, destino.nombre);
  }
  return jsonOut({ ok: true, saved: true, destino: destinoKey, hoja: destino.nombre });
}

function doGet(e) {
  try {
    var params = (e && e.parameter) || {};
    if (params.action === 'submit') {
      return guardarFormulario(params);
    }
    return jsonOut({
      ok: true,
      message: 'Web App formularios Yaavs activa',
      version: 3,
      destinos: Object.keys(DESTINOS)
    });
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

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function notificarNuevoFormulario(data, fecha, hoja) {
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
    var asunto = 'Vinculaciones: ' + nombre + ' — ' + motivo;
    var filas = [
      ['Hoja', hoja],
      ['Fecha', fecha],
      ['Nombre', nombre],
      ['Teléfono', String(data.telefono || '—')],
      ['Clave cliente', String(data.clave || '—')],
      ['Motivo', motivo],
      ['Titular', String(data.titular || '—')],
      ['Banco', String(data.banco || '—')],
      ['CLABE', String(data.clabe || '—')],
      ['Mensaje', String(data.mensaje || '—')],
      ['Origen', String(data.origen || '—')]
    ];
    var texto = 'Nueva solicitud — ' + hoja + '\n\n' + filas.map(function (par) {
      return par[0] + ': ' + par[1];
    }).join('\n');
    MailApp.sendEmail({
      to: destinatarios.join(','),
      subject: asunto,
      body: texto,
      name: 'YAAVS Vinculaciones'
    });
  } catch (err) {
    Logger.log('notificarNuevoFormulario: ' + err);
  }
}
