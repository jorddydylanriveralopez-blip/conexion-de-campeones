/**
 * Un Google Sheet por formulario.
 * destino=clabe-buenfin → CLABE Buen Fin desde 6 nov 2026
 * destino=clabe-octubre → CLABE landing desde 30 oct 2026 (archivo)
 * destino=clabe-octubre-archivo → archivo anterior
 * destino=vinculaciones-anterior → Formulario vinculaciones anterior
 */

var NOTIFY_EMAIL_DEFAULT = '';
var HOJA = 'Respuestas';
var DESTINOS = {
  'clabe-buenfin': {
    id: '12kr4j644llGb8dTcVQd6fiof8Wrbps-8CsW-iLUd6NI',
    nombre: 'CLABE Buen Fin — nuevo registro desde 6 nov 2026'
  },
  'clabe-octubre': {
    id: '1RtB0Z2MwKgYNGLFTT1nXZEGGrw_hPNenQnAuVd2D59E',
    nombre: 'CLABE landing — nuevo registro desde 30 oct 2026'
  },
  'clabe-octubre-archivo': {
    id: '1Z_MWJmrLMbqdn3XZ5RsClRDatZlOKCYwBI9p3Lj6X2Y',
    nombre: 'CLABE comisiones octubre (archivo)'
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

function quitarCorreoDeAviso() {
  try {
    PropertiesService.getScriptProperties().deleteProperty('FORM_NOTIFY_EMAIL');
  } catch (err) {
    Logger.log('quitarCorreoDeAviso: ' + err);
  }
}

function limpiarArchivoAnterior() {
  var destino = DESTINOS['clabe-octubre-archivo'];
  if (!destino) {
    return { ok: false, error: 'Sin archivo anterior' };
  }
  var sheet = prepararHoja(destino.id);
  var last = sheet.getLastRow();
  var lastCol = Math.max(sheet.getLastColumn(), ENCABEZADOS.length);
  var borradas = 0;
  if (last > 1) {
    borradas = last - 1;
    sheet.getRange(2, 1, last, lastCol).clearContent();
  }
  return { ok: true, borradas: borradas, hoja: destino.nombre };
}

function prepararNuevoRegistro() {
  var destino = DESTINOS['clabe-buenfin'];
  var sheet = prepararHoja(destino.id);
  return {
    ok: true,
    hoja: destino.nombre,
    id: destino.id,
    url: 'https://docs.google.com/spreadsheets/d/' + destino.id + '/edit',
    filas: sheet.getLastRow()
  };
}

function restaurarDatosAnteriores(sourceId) {
  var srcSs = SpreadsheetApp.openById(sourceId);
  var src = srcSs.getSheetByName('Respuestas') || srcSs.getSheets()[0];
  var dest = prepararHoja(DESTINOS['clabe-octubre-archivo'].id);
  var values = src.getDataRange().getValues();
  if (!values || values.length === 0) {
    return { ok: false, error: 'Fuente vacia' };
  }
  dest.clear();
  dest.getRange(1, 1, values.length, values[0].length).setValues(values);
  var header = dest.getRange(1, 1, 1, Math.min(values[0].length, ENCABEZADOS.length));
  header.setBackground('#1e3a5f').setFontColor('#ffffff').setFontWeight('bold').setFontFamily('Arial');
  dest.setFrozenRows(1);
  return {
    ok: true,
    filas: values.length,
    datos: Math.max(0, values.length - 1),
    hoja: DESTINOS['clabe-octubre-archivo'].nombre,
    id: DESTINOS['clabe-octubre-archivo'].id,
    url: 'https://docs.google.com/spreadsheets/d/' + DESTINOS['clabe-octubre-archivo'].id + '/edit'
  };
}

function doGet(e) {
  try {
    quitarCorreoDeAviso();
    var params = (e && e.parameter) || {};
    if (params.action === 'submit') {
      return guardarFormulario(params);
    }
    if (params.action === 'preparar-nuevo') {
      return jsonOut(prepararNuevoRegistro());
    }
    if (params.action === 'limpiar-archivo') {
      return jsonOut(limpiarArchivoAnterior());
    }
    if (params.action === 'restaurar-anteriores') {
      var sourceId = params.sourceId || '1jbga4T5jlczr6oJxtdp_ND0Uqnm4sA0eIPKZWMSEXDo';
      return jsonOut(restaurarDatosAnteriores(sourceId));
    }
    if (params.action === 'limpiar-activo') {
      var destino = DESTINOS['clabe-buenfin'];
      var sheet = prepararHoja(destino.id);
      var last = sheet.getLastRow();
      var lastCol = Math.max(sheet.getLastColumn(), ENCABEZADOS.length);
      var borradas = 0;
      if (last > 1) {
        borradas = last - 1;
        sheet.getRange(2, 1, last, lastCol).clearContent();
      }
      return jsonOut({ ok: true, borradas: borradas, hoja: destino.nombre });
    }
    return jsonOut({
      ok: true,
      message: 'Web App formularios Yaavs activa',
      version: 7,
      destinos: Object.keys(DESTINOS),
      hojaActiva: DESTINOS['clabe-buenfin'].nombre
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
  quitarCorreoDeAviso();
}
