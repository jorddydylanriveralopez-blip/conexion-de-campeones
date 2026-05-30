/**
 * Ganancias extra por vinculación — consulta desde Google Sheets (CSV público).
 *
 * Publica tu hoja: Archivo → Compartir → Publicar en la web → CSV
 * y pega la URL aquí:
 */
const URL_CSV_VINCULACIONES =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vS2w41eevnV1hTtq1Fr4dGToReWKLlNRNDMfzlHlLzAE384PQS7yfZvJKysKuRdwAajK3fG4lIEaF64/pub?gid=2006712567&single=true&output=csv';

/** Columnas Excel del CSV publicado (gid 2006712567) — J = Piso ATT */
const COL_PISO_ATT = 'J';
const COL_PISO_MOVI = 'L';
/** G/H = avance mayo · M/N = vinculadas mayo (N = Vinculadas Movi; P = Acumulado Movi/ganancia) */
const COL_AVANCE_ATT = 'G';
const COL_AVANCE_MOVI = 'H';
const COL_VINCULADO_ATT = 'M';
const COL_VINCULADO_MOVI = 'N';
/** O = Acumulado ATT, P = Acumulado Movi */
const COL_GAN_ATT = 'O';
const COL_GAN_MOVI = 'P';
const COL_GAN_TOTAL = 'Q';

/** Mes de la meta (piso) y del avance en el desglose */
const MES_PISO_LABEL = 'abril';
const MES_AVANCE_LABEL = 'mayo';
const MES_META_LABEL = MES_PISO_LABEL;

/** Datos de prueba mientras no hay hoja CSV conectada */
const DEMO_DATOS = [
  {
    clave: 'DEMO',
    sims: '24',
    esims_vinculadas: '18',
    piso_att: '5',
    piso_movi: '5',
    avance_att: '7',
    vinculado_att: '6',
    avance_movi: '5',
    vinculado_movi: '4',
    ganancia_att: '1250',
    ganancia_movi: '980',
    ganancia_total: '2230',
  },
  {
    clave: 'YA12345',
    sims: '31',
    esims_vinculadas: '22',
    piso_att: '8',
    piso_movi: '6',
    avance_att: '11',
    vinculado_att: '10',
    avance_movi: '9',
    vinculado_movi: '8',
    ganancia_att: '2100',
    ganancia_movi: '1650',
    ganancia_total: '3750',
  },
  {
    clave: 'PRUEBA01',
    sims: '12',
    esims_vinculadas: '9',
    piso_att: '4',
    piso_movi: '4',
    avance_att: '2',
    vinculado_att: '2',
    avance_movi: '3',
    vinculado_movi: '3',
    ganancia_att: '480',
    ganancia_movi: '520',
    ganancia_total: '1000',
  },
  {
    clave: 'CAMPEON24',
    sims: '45',
    esims_vinculadas: '38',
    piso_att: '10',
    piso_movi: '10',
    avance_att: '15',
    vinculado_att: '14',
    avance_movi: '14',
    vinculado_movi: '13',
    ganancia_att: '3200',
    ganancia_movi: '2850',
    ganancia_total: '6050',
  },
  {
    clave: 'TESTATT',
    sims: '20',
    esims_vinculadas: '14',
    piso_att: '3',
    piso_movi: '7',
    avance_att: '8',
    vinculado_att: '7',
    avance_movi: '1',
    vinculado_movi: '1',
    ganancia_att: '1890',
    ganancia_movi: '310',
    ganancia_total: '2200',
  },
  {
    clave: 'TESTMOVI',
    sims: '19',
    esims_vinculadas: '11',
    piso_att: '6',
    piso_movi: '3',
    avance_att: '1',
    vinculado_att: '1',
    avance_movi: '11',
    vinculado_movi: '10',
    ganancia_att: '420',
    ganancia_movi: '1740',
    ganancia_total: '2160',
  },
];

const CLAVES_DEMO_LISTA = DEMO_DATOS.map((r) => r.clave).join(', ');

function normalizarClave(s) {
  return String(s ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}

function normalizarHeader(h) {
  return String(h ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ',') {
      row.push(cell);
      cell = '';
      continue;
    }
    if (ch === '\n' || (ch === '\r' && next === '\n')) {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      if (ch === '\r') i++;
      continue;
    }
    if (ch === '\r') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      continue;
    }
    cell += ch;
  }

  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((r) => r.some((c) => String(c).trim() !== ''));
}

function letraAIndice(letra) {
  let n = 0;
  for (const c of String(letra).trim().toUpperCase()) {
    n = n * 26 + (c.charCodeAt(0) - 64);
  }
  return n - 1;
}

function valorCeldaPorLetra(cols, letra) {
  const v = cols[letraAIndice(letra)];
  return v !== undefined && String(v).trim() !== '' ? String(v).trim() : '';
}

function filasADatos(csvRows) {
  if (csvRows.length < 2) return [];

  const headers = csvRows[0].map(normalizarHeader);
  const datos = [];

  for (let i = 1; i < csvRows.length; i++) {
    const cols = csvRows[i];
    const obj = {};
    headers.forEach((h, idx) => {
      if (h) obj[h] = String(cols[idx] ?? '').trim();
    });
    obj.__col_j_piso_att = valorCeldaPorLetra(cols, COL_PISO_ATT);
    obj.__col_l_piso_movi = valorCeldaPorLetra(cols, COL_PISO_MOVI);
    obj.__col_g_avance_att = valorCeldaPorLetra(cols, COL_AVANCE_ATT);
    obj.__col_h_avance_movi = valorCeldaPorLetra(cols, COL_AVANCE_MOVI);
    obj.__col_m_vinculado_att = valorCeldaPorLetra(cols, COL_VINCULADO_ATT);
    obj.__col_n_vinculado_movi = valorCeldaPorLetra(cols, COL_VINCULADO_MOVI);
    obj.__col_o_gan_att = valorCeldaPorLetra(cols, COL_GAN_ATT);
    obj.__col_p_gan_movi = valorCeldaPorLetra(cols, COL_GAN_MOVI);
    obj.__col_q_gan_total = valorCeldaPorLetra(cols, COL_GAN_TOTAL);
    datos.push(obj);
  }
  return datos;
}

function pick(obj, ...keys) {
  for (const k of keys) {
    const nk = normalizarHeader(k);
    const v = obj[nk];
    if (v !== undefined && String(v).trim() !== '') return String(v).trim();
  }
  return '—';
}

function pickPisoAtt(row) {
  const col = row.__col_j_piso_att;
  if (col) return col;
  return pick(row, 'piso_att', 'piso att');
}

function pickPisoMovi(row) {
  const col = row.__col_l_piso_movi;
  if (col) return col;
  return pick(row, 'piso_movi', 'piso movi', 'piso_movistar');
}

function claveDeFila(row) {
  const raw = pick(
    row,
    'clave_unica',
    'clave unica',
    'clave',
    'clave_cliente',
    'idcliente',
    'id',
    'codigo',
  );
  return raw === '—' ? '' : normalizarClave(raw);
}

function buscarPorClave(datos, claveInput) {
  const clave = normalizarClave(claveInput);
  if (!clave) return null;
  return datos.find((row) => claveDeFila(row) === clave) ?? null;
}

function formatoNumero(val) {
  if (val === '—' || val === '' || val == null) return '—';
  const n = Number(String(val).replace(/[^0-9.-]/g, ''));
  if (Number.isFinite(n)) {
    return n.toLocaleString('es-MX', { maximumFractionDigits: 2 });
  }
  return val;
}

function formatoMoneda(val) {
  if (val === '—' || val === '' || val == null) return '—';
  const n = Number(String(val).replace(/[^0-9.-]/g, ''));
  if (Number.isFinite(n)) {
    return n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
  }
  return val;
}

/** Avance = cantidad de eSIM activadas (solo el número en pantalla). */
function formatoActivaciones(val) {
  return formatoNumero(val === '—' || String(val).includes('%') ? '—' : val);
}

function mostrarStatus(el, tipo, mensaje) {
  el.className = `status-msg visible status-msg--${tipo}`;
  el.textContent = mensaje;
}

function ocultarStatus(el) {
  el.className = 'status-msg';
  el.textContent = '';
}

const DESGLOSE_IDS = [
  'piso-att',
  'piso-movi',
  'avance-att',
  'vinculado-att',
  'avance-movi',
  'vinculado-movi',
  'gan-att',
  'gan-movi',
  'gan-total',
];

function cerrarDesglosePanel() {
  const panel = document.getElementById('desglose-panel');
  if (panel) {
    panel.classList.add('desglose-orden--cerrado');
    panel.classList.remove('desglose-orden--abierto');
    panel.setAttribute('aria-hidden', 'true');
  }
}

function abrirDesglosePanel() {
  const panel = document.getElementById('desglose-panel');
  if (!panel) return;
  panel.classList.remove('desglose-orden--cerrado');
  panel.setAttribute('aria-hidden', 'false');
  void panel.offsetHeight;
  panel.classList.add('desglose-orden--abierto');
  requestAnimationFrame(() => {
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
}

function numeroDeCelda(val) {
  if (val === '—' || val === '' || val == null) return null;
  const n = Number(String(val).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function actualizarEstadoPiso(row) {
  const el = document.getElementById('desglose-estado-piso');
  if (!el) return;

  const operadores = [
    {
      nombre: 'AT&T · Unefon',
      piso: pickPisoAtt(row),
      avance: pickAvanceAtt(row),
      vinculado: pickVinculadoAtt(row),
    },
    {
      nombre: 'Movistar',
      piso: pickPisoMovi(row),
      avance: pickAvanceMovi(row),
      vinculado: pickVinculadoMovi(row),
    },
  ];

  const lineas = [];
  for (const op of operadores) {
    const piso = numeroDeCelda(op.piso);
    const avance = numeroDeCelda(op.avance);
    const vinculado = numeroDeCelda(op.vinculado);
    if (piso == null) continue;

    const ref = vinculado != null ? vinculado : avance;
    if (ref == null) continue;

    if (ref < piso) {
      const faltan = piso - ref;
      const faltanTxt =
        op.nombre === 'Movistar'
          ? `Te faltan ${faltan} para ganar el incentivo acumulado.`
          : `Te faltan ${faltan} vinculaciones para ganar el incentivo acumulado.`;
      lineas.push(
        `${op.nombre}: En mayo llevas ${ref} activaciones vinculadas; tu piso de abril es de ${piso}. ${faltanTxt}`,
      );
    } else if (ref === piso) {
      lineas.push(
        `${op.nombre}: En mayo llevas ${ref} activaciones vinculadas; tu piso de abril es de ${piso}. Supera ese número en mayo para ganar el incentivo acumulado.`,
      );
    } else {
      lineas.push(
        `${op.nombre}: En mayo llevas ${ref} activaciones vinculadas; tu piso de abril era de ${piso}. Ya superaste tu meta y ganas incentivo acumulado.`,
      );
    }
  }

  el.replaceChildren();
  for (const texto of lineas) {
    const p = document.createElement('p');
    p.className = 'desglose-orden__estado-linea';
    p.textContent = texto;
    el.appendChild(p);
  }
  el.className = 'desglose-orden__estado';
  const hayPendiente = operadores.some((op) => {
    const piso = numeroDeCelda(op.piso);
    const ref = numeroDeCelda(op.vinculado) ?? numeroDeCelda(op.avance);
    return piso != null && ref != null && ref <= piso;
  });
  if (hayPendiente && lineas.length) {
    el.classList.add('desglose-orden__estado--pendiente');
  } else if (lineas.length) {
    el.classList.add('desglose-orden__estado--ok');
  }
}

function resetConsultaValores() {
  DESGLOSE_IDS.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.textContent = '—';
  });
  const estadoPiso = document.getElementById('desglose-estado-piso');
  if (estadoPiso) {
    estadoPiso.textContent = '';
    estadoPiso.className = 'desglose-orden__estado';
  }
  cerrarDesglosePanel();
}

function pickAvanceAtt(row) {
  const col = row.__col_g_avance_att;
  if (col) return col;
  return pick(
    row,
    'at_t_real_may',
    'att_real_may',
    'at_t_real_mayo',
    'incremental_att',
    'incremental att',
    'avance_att',
    'avance att',
  );
}

function pickAvanceMovi(row) {
  const col = row.__col_h_avance_movi;
  if (col) return col;
  return pick(
    row,
    'movistar_real_may',
    'movistar_real_mayo',
    'incremental_movi',
    'incremental movi',
    'avance_movi',
    'avance movi',
  );
}

function pickVinculadoAtt(row) {
  const col = row.__col_m_vinculado_att;
  if (col) return col;
  return pick(
    row,
    'vinculadas_att_mayo',
    'vinculadas att mayo',
    'vinculado_att',
    'vinculado att',
  );
}

function pickVinculadoMovi(row) {
  const col = row.__col_n_vinculado_movi;
  if (col) return col;
  return pick(row, 'vinculadas_movi_mayo', 'vinculadas movi mayo', 'vinculado_movi', 'vinculado movi');
}

function pickGanAtt(row) {
  const col = row.__col_o_gan_att;
  if (col) return col;
  return pick(row, 'acumulado_att', 'acumulado att', 'ganancia_att', 'ganancia att');
}

function pickGanMovi(row) {
  const col = row.__col_p_gan_movi;
  if (col) return col;
  return pick(row, 'acumulado_movi', 'acumulado movi', 'ganancia_movi', 'ganancia movistar');
}

function pickGanTotal(row) {
  const col = row.__col_q_gan_total;
  if (col) return col;
  return pick(row, 'acumulado_total', 'acumulado total', 'ganancia_total', 'ganancia total', 'total');
}

function pintarResultados(row) {
  const set = (id, val, money = false) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = money ? formatoMoneda(val) : formatoNumero(val);
    el.classList.remove('is-updated');
    void el.offsetWidth;
    el.classList.add('is-updated');
  };

  const setAvance = (id, val) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = formatoActivaciones(val);
    el.classList.remove('is-updated');
    void el.offsetWidth;
    el.classList.add('is-updated');
  };

  set('piso-att', pickPisoAtt(row));
  set('piso-movi', pickPisoMovi(row));
  setAvance('avance-att', pickAvanceAtt(row));
  setAvance('vinculado-att', pickVinculadoAtt(row));
  setAvance('avance-movi', pickAvanceMovi(row));
  setAvance('vinculado-movi', pickVinculadoMovi(row));
  set('gan-att', pickGanAtt(row), true);
  set('gan-movi', pickGanMovi(row), true);
  set('gan-total', pickGanTotal(row), true);

  actualizarEstadoPiso(row);
  abrirDesglosePanel();
}

let cacheDatos = null;

async function cargarDatos() {
  if (cacheDatos) return cacheDatos;

  if (!URL_CSV_VINCULACIONES) {
    return DEMO_DATOS.map((row) => {
      const obj = {};
      Object.keys(row).forEach((k) => {
        obj[normalizarHeader(k)] = row[k];
      });
      return obj;
    });
  }

  const res = await fetch(URL_CSV_VINCULACIONES, { cache: 'no-store' });
  if (!res.ok) throw new Error('No se pudo descargar la base de datos.');
  const text = await res.text();
  cacheDatos = filasADatos(parseCsv(text));
  return cacheDatos;
}

async function consultarVinculacion() {
  const input = document.getElementById('clave-cliente');
  const status = document.getElementById('consulta-status');
  const btn = document.getElementById('btn-consultar');
  const clave = input?.value?.trim();

  ocultarStatus(status);

  if (!clave) {
    resetConsultaValores();
    mostrarStatus(status, 'error', 'Escribe tu clave de cliente.');
    input?.focus();
    return;
  }

  cerrarDesglosePanel();
  DESGLOSE_IDS.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.textContent = '—';
  });

  btn.disabled = true;
  mostrarStatus(status, 'info', 'Consultando tu meta…');

  try {
    if (!URL_CSV_VINCULACIONES) {
      cacheDatos = null;
    }
    const datos = await cargarDatos();
    const row = buscarPorClave(datos, clave);

    if (!row) {
      const demo = !URL_CSV_VINCULACIONES;
      mostrarStatus(
        status,
        'error',
        demo
          ? `No encontramos «${clave}». Prueba con: ${CLAVES_DEMO_LISTA}`
          : `No encontramos la clave «${clave}». Revisa que esté bien escrita o contacta a tu ejecutivo.`,
      );
      return;
    }

    pintarResultados(row);
    const demo = !URL_CSV_VINCULACIONES;
    mostrarStatus(
      status,
      'ok',
      demo
        ? `Datos de prueba cargados (${clave}). Cuando tengas la tabla, conecta Google Sheets en vinculaciones.js.`
        : `Datos cargados para la clave ${clave}.`,
    );
  } catch (err) {
    mostrarStatus(
      status,
      'error',
      err instanceof Error ? err.message : 'Error al consultar. Intenta de nuevo.',
    );
  } finally {
    btn.disabled = false;
  }
}

function enviarFormulario(e) {
  e.preventDefault();
  const status = document.getElementById('form-status');
  const data = {
    nombre: document.getElementById('form-nombre')?.value?.trim(),
    telefono: document.getElementById('form-telefono')?.value?.trim(),
    clave: document.getElementById('form-clave')?.value?.trim(),
    motivo: document.getElementById('form-motivo')?.value,
    titular: document.getElementById('form-titular')?.value?.trim(),
    banco: document.getElementById('form-banco')?.value?.trim(),
    clabe: document.getElementById('form-clabe')?.value?.trim(),
    mensaje: document.getElementById('form-mensaje')?.value?.trim(),
    fecha: new Date().toISOString(),
  };

  if (!data.nombre || !data.telefono || !data.clave) {
    mostrarStatus(status, 'error', 'Completa nombre, teléfono y clave de cliente.');
    return;
  }

  if (data.motivo === 'Datos bancarios para pago') {
    if (!data.titular || !data.banco || !data.clabe) {
      mostrarStatus(status, 'error', 'Para datos bancarios, completa titular, banco y CLABE.');
      return;
    }
    if (!/^\d{18}$/.test(data.clabe.replace(/\s/g, ''))) {
      mostrarStatus(status, 'error', 'La CLABE debe tener 18 dígitos.');
      return;
    }
    data.clabe = data.clabe.replace(/\s/g, '');
  }

  try {
    const prev = JSON.parse(localStorage.getItem('yaavs_vinc_form') || '[]');
    prev.push(data);
    localStorage.setItem('yaavs_vinc_form', JSON.stringify(prev.slice(-50)));
  } catch {
    /* ignore */
  }

  let textoWa = `Hola YAAVS — Vinculaciones\nClave: ${data.clave}\nNombre: ${data.nombre}\nTel: ${data.telefono}\nMotivo: ${data.motivo}`;
  if (data.titular) {
    textoWa += `\nTitular: ${data.titular}\nBanco: ${data.banco}\nCLABE: ${data.clabe}`;
  }
  if (data.mensaje) textoWa += `\n${data.mensaje}`;

  const wa = `https://wa.me/5212345678900?text=${encodeURIComponent(textoWa)}`;

  mostrarStatus(
    status,
    'ok',
    'Solicitud registrada. Si no se abre WhatsApp, guardamos tu datos en este dispositivo.',
  );
  e.target.reset();

  window.open(wa, '_blank', 'noopener,noreferrer');
}

/** Formulario visible desde el 1 de junio de 2026 (hora local del navegador). */
const FORMULARIO_FECHA_INICIO = { year: 2026, month: 5, day: 1 };

function fechaLocalSoloDia(year, month, day) {
  const d = new Date(year, month, day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formularioDisponibleHoy() {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const inicio = fechaLocalSoloDia(
    FORMULARIO_FECHA_INICIO.year,
    FORMULARIO_FECHA_INICIO.month,
    FORMULARIO_FECHA_INICIO.day,
  );
  return hoy >= inicio;
}

function initFormularioPorFecha() {
  const aviso = document.getElementById('formulario-aviso');
  const contenido = document.getElementById('formulario-contenido');
  const seccion = document.getElementById('formulario-section');
  if (!aviso || !contenido) return;

  const disponible = formularioDisponibleHoy();

  if (disponible) {
    aviso.hidden = true;
    contenido.hidden = false;
    seccion?.classList.remove('formulario--pendiente');
  } else {
    aviso.hidden = false;
    contenido.hidden = true;
    seccion?.classList.add('formulario--pendiente');
  }
}

function activarPromoBanner(el) {
  if (!el?.classList.contains('promo-banner-item')) return;
  el.classList.add('is-visible');
}

function initPageEnter() {
  const body = document.body;
  if (!body) return;

  const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reducido) {
    body.classList.add('page-enter');
    return;
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      body.classList.add('page-enter');
    });
  });
}

function initScrollReveal() {
  const elementos = document.querySelectorAll('.scroll-reveal');
  if (!elementos.length) return;

  const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const mostrar = (el) => {
    el.classList.add('is-inview');
    activarPromoBanner(el);
  };

  if (reducido) {
    elementos.forEach(mostrar);
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          mostrar(entry.target);
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1, rootMargin: '0px 0px -6% 0px' },
  );

  elementos.forEach((el) => {
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.92 && rect.bottom > 0) {
      mostrar(el);
    } else {
      observer.observe(el);
    }
  });
}

function etiquetaMes(s) {
  const t = String(s ?? '').trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : '';
}

document.addEventListener('DOMContentLoaded', () => {
  const mesAbril = document.getElementById('mes-tag-abril');
  const mesMayo = document.getElementById('mes-tag-mayo');
  if (mesAbril) mesAbril.textContent = etiquetaMes(MES_PISO_LABEL);
  if (mesMayo) mesMayo.textContent = etiquetaMes(MES_AVANCE_LABEL);

  initPageEnter();
  initScrollReveal();
  initFormularioPorFecha();

  document.getElementById('btn-consultar')?.addEventListener('click', consultarVinculacion);
  document.getElementById('clave-cliente')?.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      consultarVinculacion();
    }
  });
  document.getElementById('form-vinculaciones')?.addEventListener('submit', enviarFormulario);

  const adminNote = document.getElementById('admin-csv-note');
  const demoHint = document.getElementById('demo-claves-hint');
  const enModoDemo = !URL_CSV_VINCULACIONES;

  if (adminNote && enModoDemo) {
    adminNote.classList.add('visible');
  }
  if (demoHint) {
    demoHint.hidden = !enModoDemo;
  }

  document.querySelectorAll('.demo-clave-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = document.getElementById('clave-cliente');
      const clave = btn.getAttribute('data-clave') || '';
      if (input) input.value = clave;
      consultarVinculacion();
    });
  });
});
