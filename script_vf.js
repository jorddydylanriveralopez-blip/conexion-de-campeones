/* =========================================================
   ENLACE DE LA BASE DE DATOS PRINCIPAL (GOOGLE SHEETS CSV)
   ========================================================= */
const URL_CSV_STATS = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQWKmXhz6mBDSwe3vtCQZpIEnNNP9LuRGAdyxAIuQC_wSYkWd9udte1U6fxV5E9H92ad93Ji1A3RUl-/pub?gid=0&single=true&output=csv';

// Variables globales para la paginación de boletos en la consulta
let boletosActuales = [];
let indiceBoletoVisible = 0;
const BOLETOS_POR_PAGINA = 100;

/* =========================================================
   CALENDARIO DE SORTEOS (compartido: aviso web + sorteador)
   ========================================================= */
const CALENDARIO_SORTEOS = [
    { num: 1, fecha: '2026-05-15', label: '15 DE MAYO 2026' },
    { num: 2, fecha: '2026-05-29', label: '29 DE MAYO 2026' },
    { num: 3, fecha: '2026-06-12', label: '12 DE JUNIO 2026' },
    { num: 4, fecha: '2026-06-26', label: '26 DE JUNIO 2026' },
    { num: 5, fecha: '2026-07-10', label: '10 DE JULIO 2026' },
    { num: 6, fecha: '2026-07-31', label: '31 DE JULIO 2026' },
];
const HORA_SORTEO_TEXTO = '3:00 pm (hora CDMX)';

function hoyEnCDMX() {
    const partes = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Mexico_City',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(new Date());
    const y = partes.find((p) => p.type === 'year').value;
    const m = partes.find((p) => p.type === 'month').value;
    const d = partes.find((p) => p.type === 'day').value;
    return `${y}-${m}-${d}`;
}

/** Próximo sorteo según calendario; al pasar su fecha avanza al siguiente */
function resolverSorteoVigente(fechaHoy = hoyEnCDMX()) {
    for (const s of CALENDARIO_SORTEOS) {
        if (s.fecha >= fechaHoy) return s;
    }
    return CALENDARIO_SORTEOS[CALENDARIO_SORTEOS.length - 1];
}

function etiquetaOrdinalSorteo(n) {
    const ordinales = { 1: '1.er', 2: '2.º', 3: '3.er', 4: '4.º', 5: '5.º', 6: '6.º' };
    return `${ordinales[n] || `${n}.º`} SORTEO`;
}

function resolverEstadoAvisoSorteo(fechaHoy = hoyEnCDMX()) {
    for (const s of CALENDARIO_SORTEOS) {
        if (s.fecha >= fechaHoy) {
            return { tipo: s.fecha === fechaHoy ? 'hoy' : 'proximo', sorteo: s };
        }
    }
    return { tipo: 'fin', sorteo: null };
}

function actualizarCalendarioSorteosUI(estado) {
    document.querySelectorAll('.calendario-table-unificada tbody tr[data-sorteo]').forEach((row) => {
        row.classList.remove('sorteo-proximo', 'sorteo-hoy');
        const tagViejo = row.querySelector('.sorteo-estado-tag');
        if (tagViejo) tagViejo.remove();
        if (!estado) return;
        const num = Number(row.dataset.sorteo);
        if (num !== estado.sorteo.num) return;
        row.classList.add(estado.tipo === 'hoy' ? 'sorteo-hoy' : 'sorteo-proximo');
        const td = row.querySelector('td');
        if (!td) return;
        const tag = document.createElement('span');
        tag.className = `sorteo-estado-tag ${estado.tipo === 'hoy' ? 'sorteo-hoy-tag' : 'sorteo-proximo-tag'}`;
        tag.textContent = estado.tipo === 'hoy' ? '¡Hoy!' : 'Próximo';
        td.appendChild(tag);
    });
}

const carruselGanadoresState = {
    slides: [],
    filtrados: [],
    indice: 0,
    filtro: 'todos',
    timer: null,
    porVista: 1,
};

function inicialesDeNombre(nombre, clave) {
    const base = String(nombre || clave || '?').trim();
    if (!base) return '?';
    const partes = base.split(/\s+/).filter(Boolean);
    if (partes.length >= 2) return (partes[0][0] + partes[1][0]).toUpperCase();
    return base.slice(0, 2).toUpperCase();
}

function claseLigaCarrusel(liga) {
    const u = String(liga || '').toUpperCase();
    if (u.includes('ASCENSO')) return 'liga-ascenso';
    if (u.includes('PRO')) return 'liga-pro';
    if (u.includes('ELITE')) return 'liga-elite';
    if (u.includes('CAMBACEO')) return 'liga-cambaceo';
    return '';
}

function carruselGanadoresPorVista() {
    if (window.innerWidth >= 1200) return 3;
    if (window.innerWidth >= 720) return 2;
    return 1;
}

function pausarAutoCarruselGanadores() {
    if (carruselGanadoresState.timer) clearInterval(carruselGanadoresState.timer);
    carruselGanadoresState.timer = null;
}

function cromoAlbumYaVisto() {
    try {
        return sessionStorage.getItem('yaavs_cromo_album') === '1';
    } catch (_) {
        return false;
    }
}

function marcarCromoAlbumVisto() {
    try {
        sessionStorage.setItem('yaavs_cromo_album', '1');
    } catch (_) {}
}

function escaparHtmlCarrusel(texto) {
    return String(texto ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

const VARIANTES_CROMO = ['comun', 'cromado', 'edicion-especial', 'brillante', 'leyenda'];
const ETIQUETAS_CROMO = {
    comun: 'Básico',
    cromado: 'Cromado',
    'edicion-especial': 'Ed. Esp.',
    brillante: 'Brillante',
    leyenda: 'Leyenda',
};

function varianteCromoValida(v) {
    return VARIANTES_CROMO.includes(v) ? v : 'comun';
}

function crearSlideGanadorHTML(g, fotoSrc) {
    const esPoster = !!g.poster;
    const nombre = g.nombre && g.nombre.toUpperCase() !== (g.clave || '').toUpperCase() ? g.nombre : 'Campeón YAAVS';
    const iniciales = inicialesDeNombre(nombre, g.clave);
    const src = fotoSrc || g.foto || '';
    const alt = escaparHtmlCarrusel(g.alt || nombre);

    if (esPoster && src) {
        const variante = varianteCromoValida(g.variante);
        const numero = escaparHtmlCarrusel(g.numero || '');
        const sello = escaparHtmlCarrusel(g.varianteLabel || ETIQUETAS_CROMO[variante] || 'Cromo');
        const nombreToast = escaparHtmlCarrusel(g.nombre || 'Campeón YAAVS');
        const msgToast = escaparHtmlCarrusel(
            g.agradecimiento || '¡Felicidades! Gracias por ser parte de Conexión de Campeones YAAVS.',
        );
        const numHtml = numero
            ? `<span class="cromo-sticker__num" aria-hidden="true">${numero}</span>`
            : '';
        return `
            <div class="cromo-reveal" tabindex="0"
                data-nombre="${nombreToast}"
                data-msg="${msgToast}"
                data-img="${escaparHtmlCarrusel(src)}"
                data-variante="${variante}"
                data-sello="${sello}"
                data-numero="${numero}"
                data-alt="${alt}">
                <div class="cromo-pack">
                    <div class="cromo-pack__shine" aria-hidden="true"></div>
                    <div class="cromo-pack__flap cromo-pack__flap--top" aria-hidden="true"></div>
                    <div class="cromo-pack__flap cromo-pack__flap--left" aria-hidden="true"></div>
                    <div class="cromo-pack__flap cromo-pack__flap--right" aria-hidden="true"></div>
                    <div class="cromo-pack__seal" aria-hidden="true"><i class="fa-solid fa-futbol"></i></div>
                    <article class="carrusel-ganadores__card carrusel-ganadores__card--poster cromo-sticker cromo-sticker--${variante}">
                        <span class="cromo-sticker__sello" aria-hidden="true">${sello}</span>
                        ${numHtml}
                        <div class="cromo-sticker__frame">
                            <img src="${escaparHtmlCarrusel(src)}" alt="${alt}" class="carrusel-ganadores__img" loading="lazy" decoding="async">
                        </div>
                        <span class="cromo-sticker__holo" aria-hidden="true"></span>
                        <span class="cromo-sticker__sparkles" aria-hidden="true"></span>
                        <span class="cromo-sticker__perforacion" aria-hidden="true"></span>
                    </article>
                </div>
            </div>
        `;
    }

    const imgHtml = src
        ? `<img src="${escaparHtmlCarrusel(src)}" alt="${alt}" class="carrusel-ganadores__img" loading="lazy" decoding="async" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">`
        : '';
    const fallbackDisplay = src ? 'none' : 'flex';
    return `
        <article class="carrusel-ganadores__card">
            ${imgHtml}
            <div class="carrusel-ganadores__fallback" style="display:${fallbackDisplay}">
                <span class="carrusel-ganadores__fallback-icon"><i class="fa-solid fa-trophy"></i></span>
                <span class="carrusel-ganadores__fallback-inicial">${escaparHtmlCarrusel(iniciales)}</span>
            </div>
            <span class="carrusel-ganadores__shine" aria-hidden="true"></span>
            <div class="carrusel-ganadores__overlay">
                <span class="carrusel-ganadores__sorteo">${escaparHtmlCarrusel(g.sorteoLabel)}</span>
                <h3 class="carrusel-ganadores__nombre">${escaparHtmlCarrusel(nombre)}</h3>
                <div class="carrusel-ganadores__meta">
                    <span class="carrusel-ganadores__badge ${claseLigaCarrusel(g.liga)}">${escaparHtmlCarrusel(g.liga || 'Liga')}</span>
                    <span class="carrusel-ganadores__badge">${escaparHtmlCarrusel(g.kit || 'Kit')}</span>
                </div>
            </div>
        </article>
    `;
}

function aplicarFiltroCarruselGanadores() {
    const { slides, filtro } = carruselGanadoresState;
    carruselGanadoresState.filtrados =
        filtro === 'todos' ? slides : slides.filter((s) => String(s.sorteo) === String(filtro));
    carruselGanadoresState.indice = 0;
    renderCarruselGanadores();
}

function renderCarruselGanadores() {
    const track = document.getElementById('carrusel-ganadores-track');
    const dots = document.getElementById('carrusel-ganadores-dots');
    const stage = document.getElementById('carrusel-ganadores-stage');
    const loader = document.getElementById('carrusel-ganadores-loader');
    if (!track || !dots) return;

    const { filtrados } = carruselGanadoresState;
    carruselGanadoresState.porVista = carruselGanadoresPorVista();

    if (!filtrados.length) {
        if (loader) {
            loader.style.display = 'block';
            loader.textContent = 'No hay ganadores para este filtro.';
        }
        if (stage) stage.style.display = 'none';
        track.innerHTML = '';
        dots.innerHTML = '';
        return;
    }

    if (loader) loader.style.display = 'none';
    if (stage) stage.style.display = '';

    track.innerHTML = filtrados
        .map(
            (g, i) =>
                `<div class="carrusel-ganadores__slide cromo-tilt-${(i % 5) + 1}">${crearSlideGanadorHTML(g, g.foto)}</div>`,
        )
        .join('');

    const maxIndice = Math.max(0, filtrados.length - carruselGanadoresState.porVista);
    if (carruselGanadoresState.indice > maxIndice) {
        carruselGanadoresState.indice = 0;
    }

    const pct = (100 / carruselGanadoresState.porVista) * carruselGanadoresState.indice;
    track.style.transform = `translateX(-${pct}%)`;

    const slideEls = track.querySelectorAll('.carrusel-ganadores__slide');
    slideEls.forEach((el, i) => {
        el.classList.toggle('is-center', i === carruselGanadoresState.indice + Math.floor(carruselGanadoresState.porVista / 2));
    });

    const totalDots = maxIndice + 1;
    dots.innerHTML = '';
    for (let i = 0; i < totalDots; i++) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `carrusel-ganadores__dot${i === carruselGanadoresState.indice ? ' active' : ''}`;
        btn.setAttribute('aria-label', `Ir al grupo ${i + 1}`);
        btn.addEventListener('click', () => {
            carruselGanadoresState.indice = i;
            renderCarruselGanadores();
            reiniciarAutoCarruselGanadores();
        });
        dots.appendChild(btn);
    }

    enlazarRevealCromos(track);
}

const CROMO_REVEAL_TIMERS = new WeakMap();
let cromoRevealActivo = null;

function resetRevealCromo(el) {
    if (cromoRevealActivo === el && document.getElementById('cromo-modal')?.classList.contains('is-visible')) return;
    const timers = CROMO_REVEAL_TIMERS.get(el);
    if (timers) timers.forEach(clearTimeout);
    CROMO_REVEAL_TIMERS.delete(el);
    el.classList.remove('is-shake-1', 'is-shake-2', 'is-shake-3', 'is-burst');
}

function cerrarCromoModal() {
    const modal = document.getElementById('cromo-modal');
    if (!modal) return;
    modal.classList.remove('is-visible');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('cromo-modal-open');
    if (cromoRevealActivo) {
        resetRevealCromo(cromoRevealActivo);
        cromoRevealActivo = null;
    }
    const root = document.getElementById('carrusel-ganadores');
    if (root && !root.matches(':hover')) {
        reiniciarAutoCarruselGanadores();
    }
}

function abrirCromoModalDesdeReveal(el) {
    const modal = document.getElementById('cromo-modal');
    if (!modal) return;

    const card = document.getElementById('cromo-modal-card');
    const img = document.getElementById('cromo-modal-img');
    const nombre = document.getElementById('cromo-modal-nombre');
    const msg = document.getElementById('cromo-modal-msg');
    const sello = document.getElementById('cromo-modal-sello');
    const num = document.getElementById('cromo-modal-num');

    const variante = varianteCromoValida(el.dataset.variante);
    card.className = `cromo-modal__card cromo-sticker cromo-sticker--${variante}`;
    img.src = el.dataset.img || '';
    img.alt = el.dataset.alt || '';
    nombre.textContent = el.dataset.nombre || 'Campeones YAAVS';
    msg.textContent = el.dataset.msg || '';
    sello.textContent = el.dataset.sello || '';
    num.textContent = el.dataset.numero || '';

    cromoRevealActivo = el;
    marcarCromoAlbumVisto();
    modal.classList.add('is-visible');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('cromo-modal-open');
    modal.querySelector('.cromo-modal__close')?.focus();
}

function vibrarSobreCromo() {
    if (navigator.vibrate) navigator.vibrate([35, 25, 55]);
}

function cromoRevealEnCurso(el) {
    return (
        el.classList.contains('is-shake-1') ||
        el.classList.contains('is-shake-2') ||
        el.classList.contains('is-shake-3') ||
        el.classList.contains('is-burst')
    );
}

function iniciarRevealCromo(el, opts = {}) {
    if (document.getElementById('cromo-modal')?.classList.contains('is-visible')) return;
    if (cromoRevealEnCurso(el)) return;
    resetRevealCromo(el);

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        el.classList.add('is-burst');
        abrirCromoModalDesdeReveal(el);
        return;
    }

    const rapido = opts.rapido || cromoAlbumYaVisto();
    const timers = rapido
        ? [
              setTimeout(() => el.classList.add('is-shake-1'), 30),
              setTimeout(() => {
                  el.classList.remove('is-shake-1');
                  el.classList.add('is-shake-2');
              }, 180),
              setTimeout(() => {
                  el.classList.remove('is-shake-2');
                  el.classList.add('is-burst');
              }, 420),
              setTimeout(() => abrirCromoModalDesdeReveal(el), 580),
          ]
        : [
              setTimeout(() => el.classList.add('is-shake-1'), 80),
              setTimeout(() => {
                  el.classList.remove('is-shake-1');
                  el.classList.add('is-shake-2');
              }, 650),
              setTimeout(() => {
                  el.classList.remove('is-shake-2');
                  el.classList.add('is-shake-3');
              }, 1300),
              setTimeout(() => {
                  el.classList.remove('is-shake-3');
                  el.classList.add('is-burst');
              }, 1950),
              setTimeout(() => abrirCromoModalDesdeReveal(el), 2400),
          ];
    CROMO_REVEAL_TIMERS.set(el, timers);
}

function initCromoModalGlobal() {
    const modal = document.getElementById('cromo-modal');
    if (!modal || modal.dataset.listo === '1') return;
    modal.dataset.listo = '1';
    const dialog = modal.querySelector('.cromo-modal__dialog');
    modal.querySelectorAll('[data-cromo-modal-close]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            cerrarCromoModal();
        });
    });
    modal.addEventListener('click', () => {
        if (modal.classList.contains('is-visible')) cerrarCromoModal();
    });
    dialog?.addEventListener('click', (e) => e.stopPropagation());
    modal.querySelector('.cromo-modal__rotate')?.addEventListener('click', (e) => e.stopPropagation());
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('is-visible')) cerrarCromoModal();
    });
}

function enlazarRevealCromos(track) {
    initCromoModalGlobal();
    const hoverFine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    track.querySelectorAll('.cromo-reveal').forEach((el) => {
        if (el.dataset.revealListo === '1') return;
        el.dataset.revealListo = '1';

        let touchTimer = null;
        let touchMoved = false;
        let touchHandled = false;

        const activar = (opts = {}) => {
            pausarAutoCarruselGanadores();
            if (opts.vibrar) vibrarSobreCromo();
            iniciarRevealCromo(el, { rapido: !!opts.rapido });
        };

        if (hoverFine) {
            el.addEventListener('mouseenter', () => activar());
            el.addEventListener('mouseleave', () => {
                if (!document.getElementById('cromo-modal')?.classList.contains('is-visible')) {
                    resetRevealCromo(el);
                }
            });
        }

        el.addEventListener('click', (e) => {
            if (touchHandled) {
                touchHandled = false;
                return;
            }
            activar({ vibrar: !hoverFine, rapido: true });
        });

        el.addEventListener('focusin', () => activar());

        el.addEventListener(
            'touchstart',
            (e) => {
                touchMoved = false;
                touchHandled = false;
                if (touchTimer) clearTimeout(touchTimer);
                touchTimer = setTimeout(() => {
                    if (!touchMoved && !cromoRevealEnCurso(el)) {
                        touchHandled = true;
                        activar({ vibrar: true, rapido: cromoAlbumYaVisto() });
                    }
                }, 480);
            },
            { passive: true },
        );

        el.addEventListener(
            'touchmove',
            () => {
                touchMoved = true;
                if (touchTimer) clearTimeout(touchTimer);
            },
            { passive: true },
        );

        const finalizarTouch = () => {
            if (touchTimer) clearTimeout(touchTimer);
            if (!touchMoved && !touchHandled && !cromoRevealEnCurso(el)) {
                touchHandled = true;
                activar({ vibrar: true, rapido: cromoAlbumYaVisto() });
            }
        };

        el.addEventListener('touchend', finalizarTouch, { passive: true });
        el.addEventListener('touchcancel', () => {
            if (touchTimer) clearTimeout(touchTimer);
        });
    });
}

function moverCarruselGanadores(delta) {
    const maxIndice = Math.max(0, carruselGanadoresState.filtrados.length - carruselGanadoresState.porVista);
    carruselGanadoresState.indice += delta;
    if (carruselGanadoresState.indice > maxIndice) carruselGanadoresState.indice = 0;
    if (carruselGanadoresState.indice < 0) carruselGanadoresState.indice = maxIndice;
    renderCarruselGanadores();
}

function reiniciarAutoCarruselGanadores() {
    pausarAutoCarruselGanadores();
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (document.getElementById('cromo-modal')?.classList.contains('is-visible')) return;
    if (cromoRevealActivo && cromoRevealEnCurso(cromoRevealActivo)) return;
    carruselGanadoresState.timer = setInterval(() => moverCarruselGanadores(1), 5500);
}

function enlazarControlesCarruselGanadores(root) {
    if (root.dataset.controlesListos === '1') return;
    root.dataset.controlesListos = '1';
    document.getElementById('carrusel-ganadores-prev')?.addEventListener('click', () => {
        moverCarruselGanadores(-1);
        reiniciarAutoCarruselGanadores();
    });
    document.getElementById('carrusel-ganadores-next')?.addEventListener('click', () => {
        moverCarruselGanadores(1);
        reiniciarAutoCarruselGanadores();
    });
    document.getElementById('carrusel-ganadores-filtros')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.carrusel-ganadores__filtro');
        if (!btn) return;
        document.querySelectorAll('.carrusel-ganadores__filtro').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        carruselGanadoresState.filtro = btn.dataset.filtro;
        aplicarFiltroCarruselGanadores();
        reiniciarAutoCarruselGanadores();
    });
    root.addEventListener('mouseenter', pausarAutoCarruselGanadores);
    root.addEventListener('mouseleave', () => {
        if (document.getElementById('cromo-modal')?.classList.contains('is-visible')) return;
        reiniciarAutoCarruselGanadores();
    });
    root.addEventListener('touchstart', pausarAutoCarruselGanadores, { passive: true });
    window.addEventListener('resize', () => renderCarruselGanadores());
}

async function initCarruselGanadores() {
    const root = document.getElementById('carrusel-ganadores');
    if (!root) return;

    try {
        const [cfgRes, s1Res, s2Res] = await Promise.all([
            fetch('ganadores/carrusel-ganadores.json?v=20260611_cromo_refine').catch(() => null),
            fetch(urlGanadoresSorteo(1) + '?v=20260610'),
            fetch(urlGanadoresSorteo(2) + '?v=20260610'),
        ]);

        const cfg = cfgRes?.ok ? await cfgRes.json() : {};
        const s1 = s1Res.ok ? await s1Res.json() : { ganadores: [] };
        const s2 = s2Res.ok ? await s2Res.json() : { ganadores: [] };

        if (cfg.titulo) {
            const t = document.getElementById('carrusel-ganadores-titulo');
            if (t) t.textContent = cfg.titulo;
        }
        if (cfg.subtitulo) {
            const s = document.getElementById('carrusel-ganadores-sub');
            if (s) s.textContent = cfg.subtitulo;
        }
        if (cfg.instruccionesDesktop) {
            const h = document.querySelector('#carrusel-ganadores-hint .carrusel-ganadores__hint-desktop');
            if (h) h.textContent = cfg.instruccionesDesktop;
        }
        if (cfg.instruccionesMobile) {
            const h = document.querySelector('#carrusel-ganadores-hint .carrusel-ganadores__hint-mobile');
            if (h) h.textContent = cfg.instruccionesMobile;
        }

        if (Array.isArray(cfg.imagenes) && cfg.imagenes.length) {
            carruselGanadoresState.slides = cfg.imagenes.map((img, i) => {
                const sorteo = Number(img.sorteo) || 1;
                const variante = varianteCromoValida(img.variante || VARIANTES_CROMO[i % VARIANTES_CROMO.length]);
                return {
                    sorteo,
                    numero: img.numero || String(i + 1).padStart(2, '0'),
                    variante,
                    varianteLabel: img.varianteLabel || ETIQUETAS_CROMO[variante],
                    sorteoLabel: 'Ganador del sorteo',
                    nombre: img.nombre || 'Campeón YAAVS',
                    liga: img.liga || 'Ganador',
                    kit: img.kit || 'Premio',
                    foto: img.src,
                    poster: img.poster !== false,
                    alt: img.alt || img.nombre || 'Ganador del sorteo',
                    agradecimiento: img.agradecimiento || '',
                };
            });
            aplicarFiltroCarruselGanadores();
            reiniciarAutoCarruselGanadores();
            enlazarControlesCarruselGanadores(root);
            return;
        }

        const mapaGanadores = new Map();
        (s1.ganadores || []).forEach((g) => {
            const clave = normalizarClaveYaavser(g.clave);
            if (clave) mapaGanadores.set(clave, { ...g, sorteo: 1, sorteoLabel: '1.er sorteo' });
        });
        (s2.ganadores || []).forEach((g) => {
            const clave = normalizarClaveYaavser(g.clave);
            if (clave) mapaGanadores.set(`${clave}|2`, { ...g, sorteo: 2, sorteoLabel: '2.º sorteo' });
        });

        const fotosPorClave = new Map();
        (cfg.fotos || []).forEach((f) => {
            const clave = normalizarClaveYaavser(f.clave);
            if (clave && f.src) fotosPorClave.set(`${clave}|${f.sorteo}`, f.src);
        });

        const clavesDestacadas = [];
        const pushClave = (clave, sorteo) => {
            const c = normalizarClaveYaavser(clave);
            if (!c) return;
            const key = `${c}|${sorteo}`;
            if (!clavesDestacadas.includes(key)) clavesDestacadas.push(key);
        };

        Object.entries(cfg.destacados || {}).forEach(([sorteo, lista]) => {
            (lista || []).forEach((clave) => pushClave(clave, Number(sorteo)));
        });

        if (!clavesDestacadas.length) {
            (s1.ganadores || []).slice(0, 6).forEach((g) => pushClave(g.clave, 1));
            (s2.ganadores || []).slice(0, 6).forEach((g) => pushClave(g.clave, 2));
        }

        carruselGanadoresState.slides = clavesDestacadas
            .map((key) => {
                const [clave, sorteoStr] = key.split('|');
                const sorteo = Number(sorteoStr);
                const g = sorteo === 2 ? mapaGanadores.get(key) : mapaGanadores.get(clave);
                if (!g) return null;
                return {
                    ...g,
                    clave,
                    sorteo,
                    sorteoLabel: sorteo === 1 ? '1.er sorteo' : '2.º sorteo',
                    foto: fotosPorClave.get(key) || fotosPorClave.get(`${clave}|${sorteo}`) || '',
                };
            })
            .filter(Boolean);

        aplicarFiltroCarruselGanadores();
        reiniciarAutoCarruselGanadores();
        enlazarControlesCarruselGanadores(root);
    } catch (err) {
        console.warn('[Carrusel ganadores]', err);
        const loader = document.getElementById('carrusel-ganadores-loader');
        if (loader) loader.textContent = 'No se pudo cargar el carrusel de ganadores.';
    }
}

function actualizarAvisoSorteoEnPagina() {
    const banner = document.getElementById('aviso-sorteo');
    if (!banner) return;

    const estado = resolverEstadoAvisoSorteo();
    if (estado.tipo === 'fin') {
        banner.style.display = 'none';
        actualizarCalendarioSorteosUI(null);
        return;
    }

    const { tipo, sorteo } = estado;
    const ordinal = etiquetaOrdinalSorteo(sorteo.num);
    const badge = document.getElementById('aviso-sorteo-badge');
    const titulo = document.getElementById('aviso-sorteo-titulo');
    const fecha = document.getElementById('aviso-sorteo-fecha');
    const texto = document.getElementById('aviso-sorteo-texto');

    banner.style.display = '';
    banner.classList.toggle('aviso-sorteo-proximo--hoy', tipo === 'hoy');

    if (tipo === 'hoy') {
        if (badge) badge.innerHTML = '<i class="fa-solid fa-trophy"></i> ¡Es hoy!';
        if (titulo) titulo.textContent = `¡Es el ${ordinal}!`;
        if (fecha) fecha.textContent = `Hoy · ${HORA_SORTEO_TEXTO}`;
        if (texto) texto.textContent = '¡Rápido, revisa tus boletos! Nos vemos en la transmisión en vivo.';
    } else {
        if (badge) badge.innerHTML = '<i class="fa-solid fa-bell"></i> ¡Ya casi!';
        if (titulo) titulo.textContent = `Se acerca el ${ordinal}`;
        if (fecha) fecha.textContent = `${sorteo.label} · ${HORA_SORTEO_TEXTO}`;
        if (texto) texto.textContent = '¡Rápido, revisa tus boletos y sigue vinculando para participar!';
    }

    actualizarCalendarioSorteosUI(estado);
}

/* =========================================================
   BASE DE DATOS: PREGUNTAS FRECUENTES (FAQ)
   ========================================================= */
window.FAQ_ENTRIES = [
    {
        q: "¿Qué es Conexión de Campeones?",
        a: "<p>Es la campaña publicitaria nacional de YAAVS inspirada en la Copa Mundial FIFA 2026, donde los YAAVSERS acumulan boletos por activaciones vinculadas para participar en sorteos quincenales con premios exclusivos.</p>"
    },
    {
        q: "¿Quiénes pueden participar?",
        a: "<p>Pueden participar <strong>todos los YAAVSERS activos</strong> a nivel nacional, incluyendo clientes y cambaceadores.</p>"
    },
    {
        q: "¿Cuál es la vigencia de la campaña?",
        a: "<p>La dinámica estará vigente del <strong>1 de mayo al 31 de julio de 2026</strong>.</p>"
    },
    {
        q: "¿Cómo puedo participar?",
        a: "<p>Solo necesitas realizar activaciones vinculadas. Cada activación genera boletos automáticos para los sorteos.</p>"
    },
    {
        q: "¿Cómo acumulo boletos?",
        a: "<p>Los boletos se generan automáticamente según el tipo de activación:</p><ul><li><strong>SIM multimarca:</strong> 1 boleto</li><li><strong>Portabilidad multimarca:</strong> 2 boletos</li><li><strong>eSIM multimarca:</strong> 2 boletos</li></ul><p>Además, las activaciones <strong>AT&T o UNEFON</strong> generan un boleto extra adicional.</p>"
    },
    {
        q: "¿Los nuevos YAAVSERS también participan?",
        a: "<p><strong>Sí.</strong> Los nuevos YAAVSERS reciben automáticamente 1 boleto de bienvenida al aperturar su cuenta.</p>"
    },
    {
        q: "¿Dónde puedo consultar mis boletos acumulados?",
        a: "<p>Puedes revisar diariamente tus boletos acumulados en la página oficial: <a href='https://ganayaavs.com' target='_blank'>ganayaavs.com</a></p>"
    },
    {
        q: "¿Cada cuánto se realizan los sorteos?",
        a: "<p>Los sorteos se realizan <strong>cada dos semanas</strong> mediante transmisión en vivo por Facebook Live.</p>"
    },
    {
        q: "¿En dónde se transmiten los sorteos?",
        a: "<p>Los sorteos se transmitirán en el <strong>Facebook oficial de YAAVS</strong>.</p>"
    },
    {
        q: "¿A qué hora son los sorteos?",
        a: "<p>Cada viernes quincenal a las <strong>3:00 p.m.</strong> (hora CDMX).</p>"
    },
    {
        q: "¿Cómo funciona el sorteo?",
        a: "<p>YAAVS utilizará un sistema digital de sorteos que seleccionará boletos aleatoriamente entre todos los acumulados durante el periodo correspondiente.</p>"
    },
    {
        q: "¿Qué categorías participan?",
        a: "<p>Los YAAVSERS participan según su volumen semanal de activaciones vinculadas:</p><ul><li>Liga Ascenso</li><li>Liga Pro</li><li>Liga Elite</li><li>Liga Cambaceo</li></ul>"
    },
    {
        q: "¿Cómo sé en qué categoría estoy?",
        a: "<p>Tu categoría depende de la cantidad de vinculaciones semanales registradas en tu cuenta YAAVS.</p>"
    },
    {
        q: "¿Cuántos premios habrá durante la campaña?",
        a: "<p>La campaña contará con un total de <strong>153 kits disponibles</strong> distribuidos en distintos sorteos.</p>"
    },
    {
        q: "¿Puedo ganar más de una vez?",
        a: "<p>En el mismo sorteo <strong>NO</strong>, pero <strong>SÍ</strong> puedes seguir participando en los siguientes sorteos quincenales.</p>"
    },
    {
        q: "¿Los boletos se acumulan para el siguiente sorteo?",
        a: "<p><strong>No.</strong> Después de cada sorteo quincenal, los boletos acumulados se reinician automáticamente.</p>"
    },
    {
        q: "¿Los boletos son transferibles?",
        a: "<p><strong>No.</strong> Los boletos son personales e intransferibles entre YAAVSERS.</p>"
    },
    {
        q: "¿Cómo me avisarán si gano?",
        a: "<p>Los ganadores serán publicados en redes sociales oficiales y en la página web oficial <a href='https://ganayaavs.com' target='_blank'>ganayaavs.com</a></p>"
    },
    {
        q: "¿Cómo recibiré mi premio?",
        a: "<p>El premio será entregado mediante tu ejecutivo de ventas correspondiente en la dirección registrada de tu cuenta YAAVS.</p>"
    },
    {
        q: "¿Cuánto tarda la entrega del premio?",
        a: "<p>La entrega se realizará en un plazo máximo de <strong>8 días</strong> posteriores al sorteo.</p>"
    },
    {
        q: "¿Qué pasa si una operación no es válida?",
        a: "<p>Todas las operaciones estarán sujetos a validación por parte de YAAVS.</p>"
    },
    {
        q: "¿Dónde puedo enterarme de novedades de la campaña?",
        a: "<p>A través de nuestros canales oficiales:</p><ul><li>Redes sociales oficiales de YAAVS</li><li>Apps oficiales de YAAVS</li><li>Mesa de control</li><li>Estados de WhatsApp</li></ul>"
    }
];

/* =========================================================
   SEGURIDAD ANTIRROBO
   ========================================================= */
document.addEventListener('contextmenu', (e) => {
    if (e.target.tagName === 'IMG') e.preventDefault();
});
document.addEventListener('dragstart', (e) => {
    if (e.target.tagName === 'IMG') e.preventDefault();
});
document.addEventListener('keydown', (e) => {
    if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && ['I', 'C', 'J'].includes(e.key)) ||
        (e.ctrlKey && ['U', 'S'].includes(e.key))
    ) {
        e.preventDefault();
    }
});

/* =========================================================
   SISTEMA DE COOKIES
   ========================================================= */
function initCookies() {
    const cookieBanner = document.getElementById('cookie-banner');
    const acceptBtn = document.getElementById('accept-cookies');
    
    if (!cookieBanner || !acceptBtn) return;
    if (!localStorage.getItem('yaavs_cookies_accepted')) {
        setTimeout(() => {
            cookieBanner.style.display = 'block';
        }, 2000);
    }
    acceptBtn.addEventListener('click', () => {
        localStorage.setItem('yaavs_cookies_accepted', 'true');
        cookieBanner.style.animation = 'slideDownCookie 0.5s forwards';
        setTimeout(() => {
            cookieBanner.style.display = 'none';
        }, 500);
        playSuccess();
    });
}

/* =========================================================
   PARTÍCULAS DE FONDO Y AUDIO
   ========================================================= */
const canvasParticles = document.getElementById('particle-canvas');
const ctxP = canvasParticles.getContext('2d');
let particlesArray = [];
canvasParticles.width = window.innerWidth;
canvasParticles.height = window.innerHeight;

class Particle {
    constructor() {
        this.x = Math.random() * canvasParticles.width;
        this.y = Math.random() * canvasParticles.height;
        this.size = Math.random() * 2.5;
        this.speedX = Math.random() * 0.5 - 0.25;
        this.speedY = Math.random() * -0.5 - 0.2;
        this.color = Math.random() > 0.5 ? 'rgba(34, 255, 94, 0.5)' : 'rgba(0, 229, 255, 0.5)';
    }
    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        if (this.x < 0 || this.x > canvasParticles.width) this.speedX *= -1;
        if (this.y < 0) this.y = canvasParticles.height;
    }
    draw() {
        ctxP.fillStyle = this.color;
        ctxP.beginPath();
        ctxP.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctxP.fill();
    }
}
function initParticles() {
    for (let i = 0; i < 60; i++) particlesArray.push(new Particle());
}
function animateParticles() {
    ctxP.clearRect(0, 0, canvasParticles.width, canvasParticles.height);
    particlesArray.forEach((p) => {
        p.update();
        p.draw();
    });
    requestAnimationFrame(animateParticles);
}
initParticles();
animateParticles();

let introCtaParticlesRaf = null;
let introCtaParts = [];

function initIntroCtaParticles() {
    const canvas = document.getElementById('intro-cta-particles');
    const wrap = document.getElementById('intro-cta-wrap');
    if (!canvas || !wrap || !canvas.getContext) return;
    const ctx = canvas.getContext('2d');
    let w = 400;
    let h = 160;

    function sizeCanvas() {
        const r = wrap.getBoundingClientRect();
        w = Math.max(Math.floor(r.width), 280);
        h = 140;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function tick() {
        const intro = document.getElementById('intro-overlay');
        if (!intro || intro.style.display === 'none') {
            introCtaParticlesRaf = null;
            return;
        }
        ctx.clearRect(0, 0, w, h);
        if (introCtaParts.length < 55) {
            introCtaParts.push({
                x: Math.random() * w,
                y: h + Math.random() * 30,
                vy: -0.6 - Math.random() * 1.4,
                r: 0.8 + Math.random() * 2.2,
                a: 0.35 + Math.random() * 0.45,
                hx: Math.random() > 0.48,
            });
        }
        introCtaParts = introCtaParts.filter((p) => {
            p.y += p.vy;
            p.x += Math.sin((p.y + p.r * 10) * 0.08) * 0.4;
            const hue = p.hx ? 145 : 188;
            ctx.shadowBlur = 10;
            ctx.shadowColor = p.hx ? 'rgba(34,255,94,0.75)' : 'rgba(0,229,255,0.65)';
            ctx.beginPath();
            ctx.fillStyle = `hsla(${hue}, 100%, 58%, ${p.a})`;
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            return p.y > -12;
        });
        introCtaParticlesRaf = requestAnimationFrame(tick);
    }
    sizeCanvas();
    window.addEventListener('resize', sizeCanvas);
    introCtaParts = [];
    if (introCtaParticlesRaf) cancelAnimationFrame(introCtaParticlesRaf);
    introCtaParticlesRaf = requestAnimationFrame(tick);
}

const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx;
function initAudio() {
    if (!audioCtx) audioCtx = new AudioContext();
    if (audioCtx.state === 'suspended') audioCtx.resume();
}
function playTone(freq, type, duration, vol = 0.05) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}
function playHover() { playTone(1800, 'sine', 0.05, 0.015); }
function playClick() { 
    playTone(1000, 'square', 0.1, 0.05); 
    setTimeout(() => playTone(1500, 'sine', 0.2, 0.05), 80); 
}
function playSuccess() {
    playTone(600, 'sine', 0.1, 0.1);
    setTimeout(() => playTone(900, 'sine', 0.2, 0.1), 100);
}
function playError() { playTone(150, 'sawtooth', 0.4, 0.1); }
function playSnd(id) {
    const el = document.getElementById(id);
    if (!el) return;
    try {
        el.currentTime = 0;
        const p = el.play();
        if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch (e) { }
}

/* Música ambiente del sorteador en vivo */
const VOL_SORTEO_BG = 0.2;
const VOL_SORTEO_BG_BAJO = 0.07;
let sorteoMusicaWebActiva = false;
let sorteoMusicaWebTimer = null;
let sorteoMusicaVolMul = 1;
let sorteoMusicaSilenciada = false;

function iniciarMusicaSorteoWeb() {
    if (sorteoMusicaWebActiva || !audioCtx || sorteoMusicaSilenciada) return;
    sorteoMusicaWebActiva = true;
    const acordes = [
        [261.63, 329.63, 392.0],
        [246.94, 311.13, 369.99],
        [293.66, 369.99, 440.0],
        [220.0, 277.18, 329.63],
    ];
    let paso = 0;
    const pulsar = () => {
        if (!sorteoMusicaWebActiva) return;
        acordes[paso % acordes.length].forEach((freq, i) => {
            setTimeout(() => {
                if (sorteoMusicaWebActiva) {
                    playTone(freq, 'sine', 0.42, 0.03 * sorteoMusicaVolMul);
                }
            }, i * 130);
        });
        paso += 1;
        sorteoMusicaWebTimer = setTimeout(pulsar, 2400);
    };
    pulsar();
}

function iniciarMusicaSorteo() {
    if (sorteoMusicaSilenciada) return;
    initAudio();
    detenerMusicaSorteo(false);
    const el = document.getElementById('sndSorteoBg');
    if (el) {
        el.volume = VOL_SORTEO_BG;
        el.currentTime = 0;
        const p = el.play();
        if (p && typeof p.then === 'function') {
            p.then(() => {}).catch(() => iniciarMusicaSorteoWeb());
            return;
        }
    }
    iniciarMusicaSorteoWeb();
}

function detenerMusicaSorteo(limpiarWeb = true) {
    const el = document.getElementById('sndSorteoBg');
    if (el) {
        el.pause();
        el.currentTime = 0;
    }
    if (limpiarWeb) {
        sorteoMusicaWebActiva = false;
        if (sorteoMusicaWebTimer) {
            clearTimeout(sorteoMusicaWebTimer);
            sorteoMusicaWebTimer = null;
        }
    }
}

function atenuarMusicaSorteo(bajo) {
    sorteoMusicaVolMul = bajo ? 0.35 : 1;
    const el = document.getElementById('sndSorteoBg');
    if (el && !el.paused) {
        el.volume = bajo ? VOL_SORTEO_BG_BAJO : VOL_SORTEO_BG;
    }
}

function actualizarBotonMusicaSorteo() {
    const btn = document.getElementById('btnToggleMusicaSorteo');
    if (!btn) return;
    btn.textContent = sorteoMusicaSilenciada ? '🔇 MÚSICA OFF' : '🔊 MÚSICA ON';
    btn.setAttribute('aria-pressed', sorteoMusicaSilenciada ? 'true' : 'false');
}

function toggleMusicaSorteo() {
    initAudio();
    sorteoMusicaSilenciada = !sorteoMusicaSilenciada;
    if (sorteoMusicaSilenciada) {
        detenerMusicaSorteo();
    } else {
        iniciarMusicaSorteo();
    }
    actualizarBotonMusicaSorteo();
}

window.toggleMusicaSorteo = toggleMusicaSorteo;

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.snd-hover').forEach((el) => {
        if (el.closest('#sorter-modal')) return;
        el.addEventListener('mouseenter', () => {
            initAudio();
            playHover();
        });
    });
    document.querySelectorAll('.snd-click').forEach((el) => {
        if (el.closest('#sorter-modal')) return;
        el.addEventListener('click', () => {
            initAudio();
            playClick();
        });
    });
});

/* =========================================================
   SCROLL Y OVERLAYS (INTRO Y VIDEO) + MEMORIA
   ========================================================= */
const observer = new IntersectionObserver(
    (entries) => {
        entries.forEach((e) => {
            if (e.isIntersecting) e.target.classList.add('in-view');
        });
    },
    { threshold: 0.1 }
);
document.querySelectorAll('.animate-on-scroll').forEach((el) => observer.observe(el));

function updateBodyScrollTheme() {
    const main = document.getElementById('main-content');
    if (!main || main.style.display === 'none') return;
    const shouldScroll = window.scrollY > 140;
    const hasTheme = document.body.classList.contains('theme-campaign-scroll');
    if (shouldScroll !== hasTheme) {
        document.body.classList.toggle('theme-campaign-scroll', shouldScroll);
        document.body.classList.add('background-transitioning');
        if (window.__bgTransitionTimer) clearTimeout(window.__bgTransitionTimer);
        window.__bgTransitionTimer = window.setTimeout(() => {
            document.body.classList.remove('background-transitioning');
        }, 850);
    }
}
function ocultarScrollPrompt(permanente) {
    const p = document.getElementById('scroll-prompt');
    if (!p || p.classList.contains('is-hidden')) return;
    p.classList.remove('is-active');
    p.classList.add('is-hidden');
    p.setAttribute('aria-hidden', 'true');
    if (permanente) {
        try {
            sessionStorage.setItem('yaavs_scroll_prompt_visto', '1');
        } catch (_) {}
    }
}

function initScrollPrompt() {
    const p = document.getElementById('scroll-prompt');
    if (!p) return;

    let visto = false;
    try {
        visto = sessionStorage.getItem('yaavs_scroll_prompt_visto') === '1';
    } catch (_) {}

    if (visto || window.scrollY > 40) {
        ocultarScrollPrompt(false);
        return;
    }

    const mostrar = () => {
        if (window.scrollY > 40 || p.classList.contains('is-hidden')) return;
        p.classList.add('is-active');
        p.setAttribute('aria-hidden', 'false');
    };

    setTimeout(mostrar, 700);

    const dismiss = () => ocultarScrollPrompt(true);

    window.addEventListener(
        'scroll',
        () => {
            if (window.scrollY > 40) dismiss();
        },
        { passive: true },
    );

    window.addEventListener(
        'wheel',
        (ev) => {
            if (ev.deltaY > 0) dismiss();
        },
        { passive: true },
    );

    window.addEventListener(
        'touchstart',
        () => {
            window.setTimeout(() => {
                if (window.scrollY > 15) dismiss();
            }, 120);
        },
        { passive: true },
    );
}

window.addEventListener('scroll', () => {
    updateBodyScrollTheme();
});

function iniciarEntradaPagina() {
    if (document.body.classList.contains('page-enter')) return;
    requestAnimationFrame(() => {
        document.body.classList.add('page-enter');
        const hero = document.querySelector('.centered-header');
        if (hero) hero.classList.add('in-view');
    });
}

function finalizarSplashLogo(callback) {
    const splash = document.getElementById('logo-enter-splash');
    if (!splash || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        if (splash) splash.remove();
        callback();
        return;
    }
    splash.classList.add('is-active');
    setTimeout(() => {
        splash.classList.add('is-done');
        callback();
        setTimeout(() => splash.remove(), 580);
    }, 1350);
}

function entrarDirectoAlSitio() {
    const intro = document.getElementById('intro-overlay');
    const videoOverlay = document.getElementById('video-overlay');
    const main = document.getElementById('main-content');
    const vidElement = document.getElementById('welcome-video');

    if (intro) {
        intro.style.display = 'none';
        intro.hidden = true;
    }
    if (videoOverlay) videoOverlay.style.display = 'none';
    if (vidElement) vidElement.src = '';
    if (main) main.style.display = 'block';

    try {
        localStorage.setItem('yaavs_intro_visto', 'true');
    } catch (_) {}

    updateBodyScrollTheme();

    finalizarSplashLogo(() => {
        iniciarEntradaPagina();
        initScrollPrompt();
        if (typeof window.enlazarMinijuegoFutbolConsulta === 'function') {
            window.enlazarMinijuegoFutbolConsulta();
        }
    });
}

document.addEventListener('DOMContentLoaded', entrarDirectoAlSitio);

/* =========================================================
   SISTEMA DE CONSULTA REAL CON GOOGLE SHEETS
   ========================================================= */

function parseCSV(text) {
    const result = [];
    let row = [];
    let cell = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (inQuotes) {
            if (char === '"') {
                if (i + 1 < text.length && text[i + 1] === '"') {
                    cell += '"'; i++;
                } else {
                    inQuotes = false;
                }
            } else {
                cell += char;
            }
        } else {
            if (char === '"') {
                inQuotes = true;
            } else if (char === ',') {
                row.push(cell); cell = '';
            } else if (char === '\n') {
                row.push(cell); result.push(row); row = []; cell = '';
            } else if (char !== '\r') {
                cell += char;
            }
        }
    }
    if (cell || text[text.length - 1] === ',') row.push(cell);
    if (row.length > 0) result.push(row);
    return result;
}

function limpiar() {
    document.getElementById('inputClave').value = '';
    if (typeof window.resetCodigoSecretoUI === 'function') window.resetCodigoSecretoUI();
    document.getElementById('resultados').style.display = 'none';
    const ticketPanel = document.getElementById('boletos-vista');
    if (ticketPanel) ticketPanel.style.display = 'none';
    document.getElementById('inputClave').focus();
}

function mostrarBoletosReales(ticketsList) {
    ticketsList = ticketsList.map(normalizarNomenclaturaBoleto);
    const panel = document.getElementById('boletos-vista');
    const grid = document.getElementById('ticket-grid');
    const count = document.getElementById('ticket-count');
    
    if (!panel || !grid || !count) return;

    boletosActuales = ticketsList;
    indiceBoletoVisible = 0;
    
    const totalBoletos = ticketsList.length;
    count.innerText = totalBoletos;
    grid.innerHTML = ''; 
    
    if (totalBoletos === 0) {
        grid.innerHTML = '<div class="ticket-empty">Aún no hay boletos detallados.</div>';
        panel.style.display = 'block';
        return;
    }

    cargarMasBoletos();
    panel.style.display = 'block';
}

function cargarMasBoletos() {
    const grid = document.getElementById('ticket-grid');
    const siguienteLote = boletosActuales.slice(indiceBoletoVisible, indiceBoletoVisible + BOLETOS_POR_PAGINA);
    
    siguienteLote.forEach((ticket, i) => {
        const badge = document.createElement('div');
        badge.className = 'ticket-badge';
        badge.style.animation = 'modalPop 0.3s ease forwards';
        badge.innerHTML = `
            <span>BOLETO ${indiceBoletoVisible + i + 1}</span>
            <strong>${ticket}</strong>
        `;
        grid.appendChild(badge);
    });

    indiceBoletoVisible += siguienteLote.length;

    const botonExistente = document.getElementById('btn-ver-mas-boletos');
    if (botonExistente) botonExistente.remove();

    if (indiceBoletoVisible < boletosActuales.length) {
        const btnVerMas = document.createElement('button');
        btnVerMas.id = 'btn-ver-mas-boletos';
        btnVerMas.className = 'snd-click';
        btnVerMas.style.cssText = `
            grid-column: 1 / -1;
            margin: 25px auto;
            padding: 14px 40px;
            background: var(--sk);
            color: #000;
            border: none;
            border-radius: 50px;
            font-weight: 900;
            cursor: pointer;
            font-family: 'Montserrat', sans-serif;
            box-shadow: 0 0 20px var(--sk);
            text-transform: uppercase;
            letter-spacing: 1px;
        `;
        btnVerMas.innerText = `MOSTRAR MÁS BOLETOS (+${boletosActuales.length - indiceBoletoVisible})`;
        
        btnVerMas.onclick = () => {
            initAudio();
            playClick();
            cargarMasBoletos();
        };
        
        grid.appendChild(btnVerMas);
    }
}

function applyRligaDisplay(el, ligaNombre) {
    const map = {
        'LIGA ASCENSO': 'liga-resultado--ascenso',
        'LIGA PRO': 'liga-resultado--pro',
        'LIGA ELITE': 'liga-resultado--elite',
        'LIGA CAMBACEO': 'liga-resultado--cambaceo',
    };
    el.textContent = ligaNombre;
    el.className = 'liga-resultado ' + (map[ligaNombre] || 'liga-resultado--placeholder');
}

function normalizarCodigoFutbol(valor) {
    return String(valor || '')
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '');
}

function ensureMinijuegoFutbol(callback) {
    if (typeof window.abrirMinijuegoFutbol === 'function') {
        callback();
        return;
    }
    const existente = document.querySelector('script[data-minijuego-futbol="1"]');
    if (existente) {
        existente.addEventListener('load', () => callback(), { once: true });
        return;
    }
    const s = document.createElement('script');
    s.src = 'minijuego-futbol-yaavs.js?v=20260611_futbol4';
    s.dataset.minijuegoFutbol = '1';
    s.onload = () => {
        if (typeof window.enlazarMinijuegoFutbolConsulta === 'function') {
            window.enlazarMinijuegoFutbolConsulta();
        }
        callback();
    };
    document.body.appendChild(s);
}

function abrirMinijuegoFutbolDesdeConsulta() {
    ensureMinijuegoFutbol(() => {
        if (typeof window.abrirMinijuegoFutbol === 'function') window.abrirMinijuegoFutbol();
    });
}

async function consultar() {
    initAudio();
    const inputBusqueda = normalizarCodigoFutbol(document.getElementById('inputClave').value);
    const loader = document.getElementById('loading');
    const resDiv = document.getElementById('resultados');

    if (!inputBusqueda) {
        playError();
        return;
    }

    if (inputBusqueda === 'YAAVS') {
        document.getElementById('inputClave').value = '';
        if (typeof window.resetCodigoSecretoUI === 'function') window.resetCodigoSecretoUI();
        abrirMinijuegoFutbolDesdeConsulta();
        return;
    }

    loader.style.display = 'block';
    resDiv.style.display = 'none';

    document.getElementById('cTotal').innerText = '0';
    const uiElements = ['avPortaBait', 'avPortaMovi', 'avPortaUnefon', 'totPortaBait', 'totPortaMovi', 'totPortaUnefon',
                        'avChipsBait', 'avChipsMovi', 'avChipsUnefon', 'totChipsBait', 'totChipsMovi', 'totChipsUnefon',
                        'avEsimBait', 'avEsimMovi', 'avEsimUnefon', 'totEsimBait', 'totEsimMovi', 'totEsimUnefon'];
    uiElements.forEach(id => document.getElementById(id).innerText = '0');

    try {
        const resStats = await fetch(URL_CSV_STATS);
        const textStats = await resStats.text();
        const filasStats = parseCSV(textStats);

        let encontrado = false;
        let totalCalculado = 0;
        let claveOficialParaBoletos = inputBusqueda;

        // Iterar desde la fila 1 (para saltar el encabezado)
        for (let i = 1; i < filasStats.length; i++) {
            const d = filasStats[i];
            if(d.length < 5) continue; 

            // LECTURA DE COLUMNAS A (0) a D (3)
            const colA_ID = (d[0] || '').trim().toUpperCase();       // A=0
            const colB_Clave = (d[1] || '').trim().toUpperCase();    // B=1
            const colC_Municipio = (d[2] || '').trim().toUpperCase();// C=2
            const colD_Liga = (d[3] || '').trim().toUpperCase();     // D=3

            if (!colA_ID || colA_ID === 'IDCLIENTE' || colA_ID.includes('FILTROS')) continue;

            // Validar si es el usuario que buscamos
            if (colA_ID === inputBusqueda || colB_Clave === inputBusqueda) {
                encontrado = true;
                claveOficialParaBoletos = colB_Clave || colA_ID;

                // Definir Liga visual en base a Columna D (Índice 3)
                let ligaDeterminada = 'LIGA ASCENSO';
                if (colD_Liga.includes('CAMBACEO') || colC_Municipio.includes('CAMBACEO') || claveOficialParaBoletos.includes('CB')) {
                    ligaDeterminada = 'LIGA CAMBACEO';
                }
                else if (colD_Liga.includes('ELITE')) ligaDeterminada = 'LIGA ELITE';
                else if (colD_Liga.includes('PRO')) ligaDeterminada = 'LIGA PRO';
                
                applyRligaDisplay(document.getElementById('rLiga'), ligaDeterminada);

                /* =============================================================
                   CÁLCULO MATEMÁTICO DE BOLETOS
                   Basado en reglas oficiales:
                   - SIM/Porta/eSIM Bait y Movi = Multiplicador normal
                   - AT&T y Unefon = +1 boleto extra a la regla
                ============================================================= */
                
                // SIMS VINCULADAS
                const avChipsUnefon = parseInt(d[4]) || 0;   
                const totChipsUnefon = avChipsUnefon * 2;

                const avChipsBait = parseInt(d[6]) || 0;     
                const totChipsBait = avChipsBait * 1;

                const avChipsMovi = parseInt(d[8]) || 0;     
                const totChipsMovi = avChipsMovi * 1;

                // PORTABILIDADES (PORT IN)
                const avPortaUnefon = parseInt(d[10]) || 0;  
                const totPortaUnefon = avPortaUnefon * 3;

                const avPortaBait = parseInt(d[12]) || 0;    
                const totPortaBait = avPortaBait * 2;

                const avPortaMovi = parseInt(d[14]) || 0;    
                const totPortaMovi = avPortaMovi * 2;

                // eSIMS VINCULADAS
                const avEsimUnefon = parseInt(d[16]) || 0;   
                const totEsimUnefon = avEsimUnefon * 3;

                const avEsimBait = parseInt(d[18]) || 0;     
                const totEsimBait = avEsimBait * 2;

                const avEsimMovi = parseInt(d[20]) || 0;     
                const totEsimMovi = avEsimMovi * 2;

                // TOTAL DE BOLETOS 
                const sumatoriaReal = totChipsUnefon + totChipsBait + totChipsMovi + 
                                      totPortaUnefon + totPortaBait + totPortaMovi + 
                                      totEsimUnefon + totEsimBait + totEsimMovi;
                
                const totalSheets = parseInt(d[22]) || 0;       
                totalCalculado = totalSheets >= sumatoriaReal ? totalSheets : sumatoriaReal;

                /* =============================================================
                   ACTUALIZAR INTERFAZ HTML
                ============================================================= */

                // Inyectar SIMS
                document.getElementById('avChipsUnefon').innerText = avChipsUnefon;
                document.getElementById('totChipsUnefon').innerText = totChipsUnefon;
                document.getElementById('avChipsBait').innerText = avChipsBait;
                document.getElementById('totChipsBait').innerText = totChipsBait;
                document.getElementById('avChipsMovi').innerText = avChipsMovi;
                document.getElementById('totChipsMovi').innerText = totChipsMovi;

                // Inyectar PORTABILIDADES
                document.getElementById('avPortaUnefon').innerText = avPortaUnefon;
                document.getElementById('totPortaUnefon').innerText = totPortaUnefon;
                document.getElementById('avPortaBait').innerText = avPortaBait;
                document.getElementById('totPortaBait').innerText = totPortaBait;
                document.getElementById('avPortaMovi').innerText = avPortaMovi;
                document.getElementById('totPortaMovi').innerText = totPortaMovi;

                // Inyectar eSIMS
                document.getElementById('avEsimUnefon').innerText = avEsimUnefon;
                document.getElementById('totEsimUnefon').innerText = totEsimUnefon;
                document.getElementById('avEsimBait').innerText = avEsimBait;
                document.getElementById('totEsimBait').innerText = totEsimBait;
                document.getElementById('avEsimMovi').innerText = avEsimMovi;
                document.getElementById('totEsimMovi').innerText = totEsimMovi;
                
                break; // Terminamos la búsqueda porque ya lo encontramos
            }
        }

        if (!encontrado) {
            loader.style.display = 'none';
            playError();
            const errorMsg = document.createElement('div');
            errorMsg.style.cssText = "background:#ff3366; color:#fff; padding:15px; border-radius:10px; font-weight:bold; margin-top:20px; animation: modalPop 0.3s;";
            errorMsg.innerText = "⚠️ La Clave o ID ingresado no se encontró en la base de datos.";
            resDiv.innerHTML = '';
            resDiv.appendChild(errorMsg);
            resDiv.style.display = 'block';
            return;
        }

        // Crear la lista para la bolsa visual de boletos
        let ticketsList = [];
        if (totalCalculado > 0) {
            for(let b = 1; b <= totalCalculado; b++) {
                ticketsList.push(`${claveOficialParaBoletos}-${b}-${SORTEO_TICKET_SUFFIX}`);
            }
        }

        // Actualizar el número gigante en la UI
        document.getElementById('cTotal').innerText = totalCalculado;
        mostrarBoletosReales(ticketsList);

        loader.style.display = 'none';
        resDiv.style.display = 'block';
        playSuccess();
        resDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });

    } catch (e) {
        console.error("Error global de conexión: ", e);
        loader.style.display = 'none';
        playError();
        alert('Hubo un error de conexión con las bases de datos.');
    }
}

/* =========================================================
   SORTEADOR EN VIVO Y SEGURIDAD (CONTRASEÑA)
   ========================================================= */
const passModal = document.getElementById('password-modal');
const sorterModal = document.getElementById('sorter-modal');
const inputPass = document.getElementById('inputPassword');
const errorPass = document.getElementById('error-password');

document.getElementById('open-sorter-btn').addEventListener('click', () => {
    passModal.style.display = 'flex';
    inputPass.value = '';
    errorPass.style.display = 'none';
    inputPass.focus();
});
function cerrarPassword() {
    passModal.style.display = 'none';
}
function verificarPassword() {
    if (inputPass.value === 'Yaavsti2026') {
        playSuccess();
        passModal.style.display = 'none';
        iniciarSorteador();
    } else {
        playError();
        errorPass.innerText = 'CONTRASEÑA INCORRECTA';
        errorPass.style.display = 'block';
    }
}
inputPass.addEventListener('keypress', function (event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        verificarPassword();
    }
});
function cerrarSorteador() {
    if (confirm('¿Es seguro de cerrar el evento en vivo? Se perderá el progreso no guardado.')) {
        detenerMusicaSorteo();
        sorterModal.style.display = 'none';
        location.reload();
    }
}

const YAAVS_SECRET_CODE = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
let yaavsSecretBuffer = [];
function triggerYaavsEasterEgg() {
    const overlay = document.getElementById('yaavs-easter-egg');
    if (!overlay || overlay.classList.contains('visible')) return;
    overlay.classList.add('visible');
    overlay.setAttribute('aria-hidden', 'false');
    showCreatorEasterEgg();
    playSuccess();
}
function showCreatorEasterEgg() {
    const status = document.getElementById('yaavs-game-status');
    const details = document.getElementById('yaavs-egg-details');
    const overlay = document.getElementById('yaavs-easter-egg');
    if (overlay) overlay.classList.remove('game-won');
    
    if (status) {
        status.innerHTML = '<span class="egg-title">ESTOY, SOY YO SU CREADOR XD</span><br><span class="egg-subtitle">Jorddy Dylan Rivera Lopez jajaja</span>';
    }
    if (details) {
        details.innerHTML = `
            <div class="egg-card">
                <div class="egg-avatar">JD</div>
                <div class="egg-copy">
                    <p class="egg-title">Bienvenido al mundo oculto</p>
                    <p class="egg-subtitle">¡Si llegaste hasta aquí eres parte del descubrimiento!</p>
                    <div class="egg-socials">
                        <a href="#" target="_blank"><i class="fa-brands fa-instagram"></i> @jorddydylan</a>
                        <a href="#" target="_blank"><i class="fa-brands fa-facebook-f"></i> @jorddydylan</a>
                        <a href="#" target="_blank"><i class="fa-brands fa-tiktok"></i> @jorddydylan</a>
                    </div>
                </div>
            </div>
        `;
    }
}
function closeYaavsEasterEgg() {
    const overlay = document.getElementById('yaavs-easter-egg');
    if (!overlay) return;
    overlay.classList.remove('visible', 'game-won');
    overlay.setAttribute('aria-hidden', 'true');
}
function handleYaavsSecretKey(key) {
    yaavsSecretBuffer.push(key);
    if (yaavsSecretBuffer.length > YAAVS_SECRET_CODE.length) {
        yaavsSecretBuffer.shift();
    }
    if (
        yaavsSecretBuffer.length === YAAVS_SECRET_CODE.length &&
        YAAVS_SECRET_CODE.every((codeKey, index) => codeKey === yaavsSecretBuffer[index])
    ) {
        yaavsSecretBuffer = [];
        triggerYaavsEasterEgg();
    }
}

const K = {
    B: { n: 'KIT BÁSICO', d: 'Gorra + Cilindro Oficial', c: '#39FF14', speed: 250 },
    P: { n: 'KIT PRO', d: 'Playera + Gorra + Cilindro', c: '#00AEEF', speed: 350 },
    E: { n: 'KIT ELITE', d: 'Balón + Playera + Cilindro', c: '#FFD700', speed: 800 },
};
const L = [
    { id: 'Ascenso', c: '#39FF14', q: { B: 10, P: 11, E: 10 } },
    { id: 'Pro', c: '#00AEEF', q: { B: 9, P: 17, E: 15 } },
    { id: 'Elite', c: '#FFD700', q: { B: 3, P: 28, E: 19 } },
    { id: 'Cambaceo', c: '#d500ff', q: { B: 5, P: 20, E: 6 } },
];
const sorteoVigente = resolverSorteoVigente();
const SORTEO_NUMERO_ACTUAL = sorteoVigente.num;
const SORTEO_TICKET_SUFFIX = `sorteo-${sorteoVigente.num}`;

function urlGanadoresSorteo(n) {
    return n === 1 ? 'ganadores/ganadores.json' : `ganadores/ganadores-sorteo-${n}.json`;
}

function normalizarNomenclaturaBoleto(ticket) {
    return String(ticket)
        .replace(/-Qna(\d+)$/i, (_, n) => `-sorteo-${n}`)
        .replace(/-sorteo-(\d+)$/i, (m, n) => `-sorteo-${n}`);
}

const SORTEO_PUBLICACION = Object.fromEntries(
    CALENDARIO_SORTEOS.map((s) => [
        `sorteo-${s.num}`,
        { fecha: s.label, titulo: 'GANADORES DEL SORTEO' },
    ]),
);

function infoSorteoActual() {
    return SORTEO_PUBLICACION[SORTEO_TICKET_SUFFIX] || {
        fecha: sorteoVigente.label,
        titulo: 'GANADORES DEL SORTEO',
    };
}

function etiquetaSorteoActual() {
    return etiquetaOrdinalSorteo(SORTEO_NUMERO_ACTUAL);
}

console.info(
    `[Sorteador] Sorteo vigente: ${SORTEO_TICKET_SUFFIX} (${sorteoVigente.label}) · hoy CDMX: ${hoyEnCDMX()}`,
);

function actualizarEncabezadoResultados() {
    const info = infoSorteoActual();
    const fechaEl = document.getElementById('resultadosFecha');
    const tituloEl = document.getElementById('resultadosTitulo');
    const sorteoEl = document.getElementById('resultadosSorteoNum');
    if (fechaEl) fechaEl.textContent = info.fecha;
    if (tituloEl) tituloEl.textContent = info.titulo;
    if (sorteoEl) sorteoEl.textContent = etiquetaSorteoActual();
}

function extraerClaveDeTicket(ticketName) {
    const ticketNorm = normalizarNomenclaturaBoleto(ticketName);
    const sufijo = `-${SORTEO_TICKET_SUFFIX}`;
    if (ticketNorm.endsWith(sufijo)) {
        const base = ticketNorm.slice(0, -sufijo.length);
        const lastDash = base.lastIndexOf('-');
        if (lastDash > 0 && /^\d+$/.test(base.slice(lastDash + 1))) {
            return base.slice(0, lastDash);
        }
    }
    return String(ticketNorm).split('-')[0];
}

/** Una clave solo puede ganar un kit (B, P o E) por transmisión */
const clavesGanadorasEnSorteo = new Set();
/** Por liga + tipo de kit: evita repetir la misma clave en la misma tanda */
const clavesGanadorasPorBloque = new Map();

function idBloqueSorteo(ligaId, kitType) {
    return `${ligaId}|${kitType}`;
}

function registrarClaveGanadora(clave, ligaId, kitType) {
    const c = normalizarClaveYaavser(clave);
    if (!c) return;
    clavesGanadorasEnSorteo.add(c);
    if (ligaId && kitType) {
        const bloque = idBloqueSorteo(ligaId, kitType);
        if (!clavesGanadorasPorBloque.has(bloque)) clavesGanadorasPorBloque.set(bloque, new Set());
        clavesGanadorasPorBloque.get(bloque).add(c);
    }
}

function claveYaGanoEnEsteSorteo(clave) {
    const c = normalizarClaveYaavser(clave);
    return c ? clavesGanadorasEnSorteo.has(c) : false;
}

function claveYaGanoEnBloque(clave, ligaId, kitType) {
    const c = normalizarClaveYaavser(clave);
    if (!c) return false;
    const set = clavesGanadorasPorBloque.get(idBloqueSorteo(ligaId, kitType));
    return set ? set.has(c) : false;
}

/** Un boleto por clave en el bolillero (aunque tenga varios boletos en el mes) */
function boletosElegiblesParaBloque(ligaId) {
    const clavesEnBolillero = new Set();
    const out = [];
    for (const x of db) {
        if (x.l !== ligaId || usados.has(x.n)) continue;
        const clave = extraerClaveDeTicket(x.n);
        if (!clave) continue;
        if (!claveElegibleParaSorteo(clave)) continue;
        if (claveYaGanoEnEsteSorteo(clave)) continue;
        if (clavesEnBolillero.has(clave)) continue;
        clavesEnBolillero.add(clave);
        out.push(x);
    }
    return out;
}

function sacarGanadorDelBolillero(pool, ligaId, kitType) {
    while (pool.length > 0) {
        const idx = Math.floor(Math.random() * pool.length);
        const item = pool.splice(idx, 1)[0];
        const clave = extraerClaveDeTicket(item.n);
        if (
            !clave ||
            !claveElegibleParaSorteo(clave) ||
            claveYaGanoEnEsteSorteo(clave) ||
            claveYaGanoEnBloque(clave, ligaId, kitType)
        ) {
            continue;
        }
        for (let j = pool.length - 1; j >= 0; j--) {
            if (normalizarClaveYaavser(extraerClaveDeTicket(pool[j].n)) === clave) {
                pool.splice(j, 1);
            }
        }
        return item;
    }
    return null;
}

function parseTotalBoletos(valor) {
    const n = parseInt(String(valor ?? '').replace(/[^\d]/g, ''), 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
}

function indiceColumnaCsv(filaEncabezado, ...nombres) {
    const h = filaEncabezado.map((c) => String(c).trim().toLowerCase());
    for (const nombre of nombres) {
        const i = h.indexOf(nombre.toLowerCase());
        if (i >= 0) return i;
    }
    return -1;
}

let db = [];
let usados = new Set();
/** clave YAAVSER normalizada → municipio (columna C del sheet Conexión de Campeones) */
const mapaMunicipioPorClave = new Map();
/** clave YAAVSER normalizada → total de boletos acumulados (columna Total Boletos) */
const mapaTotalBoletosPorClave = new Map();

/** Número de boleto ganador (1…total) según columna W del sheet */
function boletoGanadorParaClave(clave, totalDesdeHoja) {
    const c = normalizarClaveYaavser(clave);
    const total = Math.max(1, totalDesdeHoja || mapaTotalBoletosPorClave.get(c) || 1);
    const numero = Math.floor(Math.random() * total) + 1;
    return `${c}-${numero}-${SORTEO_TICKET_SUFFIX}`;
}

function actualizarTotalesBoletosDesdeDb() {
    for (const x of db) {
        const clave = normalizarClaveYaavser(extraerClaveDeTicket(x.n));
        if (!clave) continue;
        if (x.tot > 0) {
            const prev = mapaTotalBoletosPorClave.get(clave) || 0;
            mapaTotalBoletosPorClave.set(clave, Math.max(prev, x.tot));
            continue;
        }
        const norm = normalizarNomenclaturaBoleto(x.n);
        const re = new RegExp(`-(\\d+)-${SORTEO_TICKET_SUFFIX}$`, 'i');
        const m = norm.match(re);
        if (m) {
            const num = parseInt(m[1], 10);
            const prev = mapaTotalBoletosPorClave.get(clave) || 0;
            if (num > prev) mapaTotalBoletosPorClave.set(clave, num);
        }
    }
}

function municipioDeClave(clave) {
    const c = normalizarClaveYaavser(clave);
    return (c && mapaMunicipioPorClave.get(c)) || '';
}

/** Claves YAAVSER que ya ganaron en sorteos anteriores (no pueden volver a ganar) */
const clavesExcluidasSorteosPrevios = new Set();
let ganadoresPreviosCargados = false;

function normalizarClaveYaavser(clave) {
    return String(clave ?? '').trim().toUpperCase();
}

function extraerClaveDeGanadorHistorico(g) {
    const claveDirecta = normalizarClaveYaavser(g?.clave);
    if (claveDirecta) return claveDirecta;
    const ticket = normalizarNomenclaturaBoleto(g?.ticket || '');
    const conBoleto = ticket.match(/^(.+)-\d+-sorteo-\d+$/i);
    if (conBoleto) return normalizarClaveYaavser(conBoleto[1]);
    return normalizarClaveYaavser(ticket.split('-')[0]);
}

async function cargarGanadoresSorteosPrevios() {
    clavesExcluidasSorteosPrevios.clear();
    ganadoresPreviosCargados = false;
    if (SORTEO_NUMERO_ACTUAL <= 1) {
        ganadoresPreviosCargados = true;
        return;
    }
    const resumenPorSorteo = [];
    for (let n = 1; n < SORTEO_NUMERO_ACTUAL; n++) {
        let agregados = 0;
        try {
            const res = await fetch(urlGanadoresSorteo(n), { cache: 'no-store' });
            if (!res.ok) {
                console.warn(`[Sorteador] No se encontró lista del sorteo ${n} (HTTP ${res.status})`);
                continue;
            }
            const data = await res.json();
            const antes = clavesExcluidasSorteosPrevios.size;
            (data.ganadores || []).forEach((g) => {
                const clave = extraerClaveDeGanadorHistorico(g);
                if (clave) clavesExcluidasSorteosPrevios.add(clave);
            });
            agregados = clavesExcluidasSorteosPrevios.size - antes;
            resumenPorSorteo.push(`${n}.º: ${agregados}`);
        } catch (e) {
            console.warn(`[Sorteador] No se cargó lista del sorteo ${n}:`, e);
        }
    }
    ganadoresPreviosCargados = true;
    console.info(
        `[Sorteador] ${clavesExcluidasSorteosPrevios.size} claves excluidas de sorteos previos (${resumenPorSorteo.join(', ') || 'sin listas'}).`,
    );
}

function claveElegibleParaSorteo(clave) {
    const c = normalizarClaveYaavser(clave);
    if (!c) return false;
    return !clavesExcluidasSorteosPrevios.has(c);
}
let reg = [];
let cIdx = 0;
let inv = {};
let est = 'W';

const sel = document.getElementById('selLiga');
if(sel) L.forEach((l, i) => sel.add(new Option('LIGA ' + l.id.toUpperCase(), i)));

async function iniciarSorteador() {
    sorterModal.style.display = 'flex';
    est = 'W';
    detenerMusicaSorteo();
    actualizarBienvenidaSorteador();
    showSorterScreen('welcome');
    if (!ganadoresPreviosCargados && SORTEO_NUMERO_ACTUAL > 1) {
        await cargarGanadoresSorteosPrevios();
    }
}

function actualizarBienvenidaSorteador() {
    const sorteoEl = document.getElementById('sorter-welcome-sorteo');
    const fechaEl = document.getElementById('sorter-welcome-fecha');
    if (sorteoEl) sorteoEl.textContent = etiquetaOrdinalSorteo(SORTEO_NUMERO_ACTUAL);
    if (fechaEl && sorteoVigente) fechaEl.textContent = sorteoVigente.label;
}

window.addEventListener('keydown', (e) => {
    const overlay = document.getElementById('yaavs-easter-egg');
    const isOverlayVisible = overlay && overlay.classList.contains('visible');
    if (isOverlayVisible) {
        if (e.key === 'Escape') {
            e.preventDefault();
            closeYaavsEasterEgg();
            return;
        }
        return;
    }
    handleYaavsSecretKey(e.key);
    
    if (sorterModal.style.display === 'flex' && passModal.style.display === 'none') {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (est == 'W') iniciarConEspera();
            else if (est == 'S') sorteo();
            else if (est == 'FIN_KIT') continuarDespuesDeKit();
            else if (est == 'FIN_LIGA') irAIntermedio();
        }
    }
});

function showSorterScreen(id) {
    document.querySelectorAll('#sorter-modal .screen').forEach((s) => s.classList.remove('active'));
    document.getElementById('screen-' + id).classList.add('active');
    if (id === 'stadium') est = 'S';
}

/** Confetti + sonido solo al cerrar una tanda (kit) o una liga completa */
function celebrarCierreSorteo(kitType) {
    const finLiga = inv.B <= 0 && inv.P <= 0 && inv.E <= 0;
    const colorLiga = L[cIdx] ? L[cIdx].c : '#22ff5e';

    confetti({
        particleCount: finLiga ? 220 : 140,
        spread: finLiga ? 85 : 70,
        origin: { y: 0.65 },
        colors: [colorLiga, '#ffffff', '#ffd700'],
        zIndex: 35000,
    });

    if (finLiga) {
        playSnd('sndElite');
    } else {
        playSnd(kitType === 'E' ? 'sndElite' : 'sndWin');
    }
}

async function extraerDatosNube() {
    try {
        const res = await fetch(URL_CSV_STATS);
        const text = await res.text();
        const filas = parseCSV(text);
        const enc = filas[0] || [];
        const colId = indiceColumnaCsv(enc, 'idcliente') >= 0 ? indiceColumnaCsv(enc, 'idcliente') : 0;
        const colClave =
            indiceColumnaCsv(enc, 'claveunica', 'clave unica') >= 0
                ? indiceColumnaCsv(enc, 'claveunica', 'clave unica')
                : 1;
        const colMunicipio =
            indiceColumnaCsv(enc, 'municipio') >= 0 ? indiceColumnaCsv(enc, 'municipio') : 2;
        const colLiga = indiceColumnaCsv(enc, 'liga') >= 0 ? indiceColumnaCsv(enc, 'liga') : 3;
        const colTotal =
            indiceColumnaCsv(enc, 'total boletos') >= 0 ? indiceColumnaCsv(enc, 'total boletos') : 22;

        db = [];
        mapaMunicipioPorClave.clear();
        mapaTotalBoletosPorClave.clear();
        for (let i = 1; i < filas.length; i++) {
            const d = filas[i];
            if (d.length < 5) continue;

            const colA_ID = (d[colId] || '').trim().toUpperCase();
            const colB_Clave = (d[colClave] || '').trim().toUpperCase();
            const colC_Municipio = (d[colMunicipio] || '').trim().toUpperCase();
            const colD_Liga = (d[colLiga] || '').trim().toUpperCase();

            if (!colA_ID || colA_ID === 'IDCLIENTE' || colA_ID.includes('FILTROS')) continue;

            const claveFinal = normalizarClaveYaavser(colB_Clave || colA_ID);
            if (claveFinal && colC_Municipio) {
                mapaMunicipioPorClave.set(claveFinal, colC_Municipio);
            }

            let ligaStr = 'Ascenso';
            if (colD_Liga.includes('CAMBACEO') || colC_Municipio.includes('CAMBACEO') || claveFinal.includes('CB')) {
                ligaStr = 'Cambaceo';
            } else if (colD_Liga.includes('ELITE')) ligaStr = 'Elite';
            else if (colD_Liga.includes('PRO')) ligaStr = 'Pro';

            const tot = parseTotalBoletos(d[colTotal]);

            if (tot > 0) {
                mapaTotalBoletosPorClave.set(claveFinal, tot);
                db.push({
                    n: `${claveFinal}-1-${SORTEO_TICKET_SUFFIX}`,
                    l: ligaStr,
                    m: colC_Municipio,
                    tot,
                });
            }
        }
        return db.length > 0;
    } catch (e) {
        console.error('Error al extraer nube:', e);
        return false;
    }
}

const SEGUNDOS_SYNC_INICIAL = 3;
const SEGUNDOS_TRANSICION_LIGA = 1;

function iniciarConEspera() {
    est = 'R';
    limpiarCajaGanadores();
    const radarText = document.getElementById('radar-text');
    const radarSub = document.getElementById('radar-sub');
    if (radarText) radarText.innerText = 'SINCRONIZANDO NUBE...';
    if (radarSub) radarSub.innerText = 'Cargando base de datos en tiempo real';
    showSorterScreen('radar');

    const timerEl = document.getElementById('timer-ui');
    let t = SEGUNDOS_SYNC_INICIAL;
    let minTiempoListo = false;
    let cargaResuelta = null;
    let intervaloSync = null;

    if (timerEl) timerEl.innerText = String(t);

    const finalizarSync = () => {
        if (!minTiempoListo || cargaResuelta === null) return;
        if (intervaloSync) clearInterval(intervaloSync);
        if (cargaResuelta) {
            preparar();
        } else {
            showSorterScreen('drop');
        }
    };

    cargarGanadoresSorteosPrevios()
        .then(() => extraerDatosNube())
        .then((exito) => {
            cargaResuelta = !!exito;
            finalizarSync();
        })
        .catch(() => {
            cargaResuelta = false;
            finalizarSync();
        });

    intervaloSync = setInterval(() => {
        t -= 1;
        if (timerEl) timerEl.innerText = t > 0 ? String(t) : '✓';
        if (t <= 0) {
            minTiempoListo = true;
            finalizarSync();
        }
    }, 1000);
}

function pA(input) {
    if (!input.files || !input.files[0]) return;
    const r = new FileReader();
    r.onload = async (e) => {
        const d = new Uint8Array(e.target.result);
        const wb = XLSX.read(d, { type: 'array' });
        db = XLSX.utils
            .sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 })
            .slice(1)
            .map((x) => ({ n: normalizarNomenclaturaBoleto(x[0]), l: String(x[3] || '').trim() }))
            .filter((x) => x.n);
        if (!ganadoresPreviosCargados) {
            await cargarGanadoresSorteosPrevios();
        }
        actualizarTotalesBoletosDesdeDb();
        preparar();
    };
    r.readAsArrayBuffer(input.files[0]);
}

function limpiarCajaGanadores() {
    const caja = document.getElementById('caja');
    if (caja) caja.innerHTML = '';
}

function crearTagGanadorEnCaja(ticketGanador, municipioGanador) {
    const tag = document.createElement('div');
    tag.className = 'winner-tag';
    const ticketSpan = document.createElement('span');
    ticketSpan.className = 'winner-tag__ticket';
    ticketSpan.textContent = ticketGanador;
    tag.appendChild(ticketSpan);
    if (municipioGanador) {
        const municipioSpan = document.createElement('span');
        municipioSpan.className = 'winner-tag__estado';
        municipioSpan.textContent = municipioGanador;
        tag.appendChild(municipioSpan);
    }
    return tag;
}

/** Al terminar la liga: mostrar todos los ganadores de esa liga hasta dar ENTER */
function mostrarGanadoresLigaActualEnCaja() {
    const caja = document.getElementById('caja');
    if (!caja) return;
    caja.innerHTML = '';
    const ligaId = L[cIdx].id;
    const hits = reg.filter((r) => r.l === ligaId);
    hits.forEach((h) => {
        caja.appendChild(crearTagGanadorEnCaja(h.n, h.mun));
    });
    if (caja.lastElementChild) {
        caja.lastElementChild.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
}

function preparar() {
    limpiarCajaGanadores();
    const lData = L[cIdx];
    document.documentElement.style.setProperty('--cc', lData.c);
    if (sel) sel.value = cIdx;
    inv = { ...lData.q };
    const btnS = document.getElementById('btnS');
    if (btnS) btnS.style.display = 'block';
    updUI();
    showSorterScreen('stadium');
}

function cambioManual() {
    cIdx = parseInt(sel.value, 10);
    preparar();
}

function updUI() {
    const t = inv.B > 0 ? 'B' : inv.P > 0 ? 'P' : inv.E > 0 ? 'E' : null;
    const b = document.getElementById('btnS');
    if (t) {
        document.getElementById('pName').innerText = K[t].n;
        document.getElementById('pDesc').innerText = K[t].d;
        b.innerText = `SORTEAR ${inv[t]} BLOQUES (ENTER)`;
        b.style.display = 'block';
        est = 'S';
    } else {
        mostrarGanadoresLigaActualEnCaja();
        document.getElementById('pName').innerText = 'LIGA COMPLETADA';
        document.getElementById('pDesc').innerText = 'Siguiente liga en breve...';
        b.innerText = 'SIGUIENTE LIGA (ENTER)';
        b.style.display = 'block';
        est = 'FIN_LIGA';
    }
}

/** Tras terminar una tanda: mantener nombre del kit que acaba de sortearse */
function mostrarEstadoKitCompletado(kitType) {
    const b = document.getElementById('btnS');
    document.getElementById('pName').innerText = K[kitType].n;
    document.getElementById('pDesc').innerText = K[kitType].d;
    const finLiga = inv.B <= 0 && inv.P <= 0 && inv.E <= 0;
    b.innerText = finLiga ? 'SIGUIENTE LIGA (ENTER)' : 'SIGUIENTE KIT (ENTER)';
    b.style.display = 'block';
    est = 'FIN_KIT';
}

function continuarDespuesDeKit() {
    const finLiga = inv.B <= 0 && inv.P <= 0 && inv.E <= 0;
    if (finLiga) {
        mostrarGanadoresLigaActualEnCaja();
        updUI();
    } else {
        limpiarCajaGanadores();
        updUI();
    }
}

function accionSorteadorPrincipal() {
    if (est === 'S') sorteo();
    else if (est === 'FIN_KIT') continuarDespuesDeKit();
    else if (est === 'FIN_LIGA') irAIntermedio();
}

function sorteo() {
    if (est !== 'S') return;
    const t = inv.B > 0 ? 'B' : inv.P > 0 ? 'P' : inv.E > 0 ? 'E' : null;
    if (!t) return;
    est = 'D';
    const n = inv[t];
    const ligaId = L[cIdx].id;
    const p = boletosElegiblesParaBloque(ligaId);
    if (p.length < n) {
        est = 'S';
        alert(
            `No hay suficientes yaavsers elegibles para ${K[t].n} en LIGA ${ligaId.toUpperCase()}. ` +
                `Se necesitan ${n} ganadores distintos y solo hay ${p.length} claves disponibles.`,
        );
        return;
    }
    const c = document.getElementById('caja');
    c.innerHTML = '';
    document.getElementById('btnS').style.display = 'none';

    let i = 0;
    const velocity = K[t].speed;
    
    function addWinner() {
        if (i < n) {
            const itemGanador = sacarGanadorDelBolillero(p, ligaId, t);
            if (!itemGanador) {
                est = 'S';
                alert(
                    `No se pudo completar la tanda de ${K[t].n}: faltan ganadores únicos por clave.`,
                );
                updUI();
                return;
            }

            const claveGanadora = extraerClaveDeTicket(itemGanador.n);
            const ticketGanador = boletoGanadorParaClave(claveGanadora, itemGanador.tot);
            const municipioGanador = itemGanador.m || municipioDeClave(claveGanadora);
            usados.add(itemGanador.n);
            registrarClaveGanadora(claveGanadora, ligaId, t);
            const hoy = new Date();
            reg.push({
                n: ticketGanador,
                l: ligaId,
                k: t,
                mun: municipioGanador,
                h: hoy.toLocaleTimeString(),
                d: hoy.toLocaleDateString(),
            });
            const tag = crearTagGanadorEnCaja(ticketGanador, municipioGanador);
            c.appendChild(tag);
            tag.scrollIntoView({ block: 'nearest', behavior: 'smooth' });

            i++;
            setTimeout(addWinner, velocity);
        } else {
            inv[t] = 0;
            celebrarCierreSorteo(t);
            mostrarEstadoKitCompletado(t);
        }
    }
    addWinner();
}

function irAIntermedio() {
    limpiarCajaGanadores();
    cIdx++;
    if (cIdx < L.length) {
        est = 'R';
        const radarText = document.getElementById('radar-text');
        const radarSub = document.getElementById('radar-sub');
        const timerEl = document.getElementById('timer-ui');
        if (radarText) radarText.innerText = 'SIGUIENTE LIGA...';
        if (radarSub) {
            radarSub.innerText = `Preparando ${L[cIdx].id.toUpperCase()}`;
        }
        if (timerEl) timerEl.innerText = String(SEGUNDOS_TRANSICION_LIGA);
        showSorterScreen('radar');
        setTimeout(preparar, SEGUNDOS_TRANSICION_LIGA * 1000);
    } else {
        abrirH();
    }
}

const LOGO_TABLERO =
    'https://assets.zyrosite.com/EnigzBPrgZr5GxnU/mesa-de-trabajo-23-8-9UuOY2sWU5il4Fc7.png';

function crearItemHistorial(h) {
    const item = document.createElement('div');
    item.className = `h-item h-item--${h.k}`;
    const kit = document.createElement('span');
    kit.className = 'h-item-kit';
    kit.textContent = K[h.k].n;
    const clave = document.createElement('span');
    clave.className = 'h-item-clave';
    clave.textContent = extraerClaveDeTicket(h.n) || h.n;
    const boleto = document.createElement('span');
    boleto.className = 'h-item-boleto';
    boleto.textContent = h.n;
    item.appendChild(kit);
    item.appendChild(clave);
    item.appendChild(boleto);
    if (h.mun) {
        const municipio = document.createElement('span');
        municipio.className = 'h-item-estado';
        municipio.textContent = h.mun;
        item.appendChild(municipio);
    }
    const time = document.createElement('span');
    time.className = 'h-item-time';
    time.textContent = `${h.h} · ${h.d}`;
    item.appendChild(time);
    return item;
}

function actualizarMetaTablero() {
    const info = infoSorteoActual();
    const total = reg.length;
    const sorteoEl = document.getElementById('tableroMetaSorteo');
    const totalEl = document.getElementById('tableroMetaTotal');
    const fechaEl = document.getElementById('tableroMetaFecha');
    if (sorteoEl) {
        sorteoEl.textContent = `${etiquetaSorteoActual()} QUINCENAL`;
    }
    if (totalEl) {
        totalEl.textContent = `${total} ganador${total === 1 ? '' : 'es'} registrados`;
    }
    if (fechaEl) {
        fechaEl.textContent = info.fecha || new Date().toLocaleDateString('es-MX');
    }
}

function abrirH() {
    const cont = document.getElementById('hContent');
    if (!cont) return;
    cont.innerHTML = '';
    L.forEach((l) => {
        const hits = reg.filter((r) => r.l === l.id);
        if (hits.length === 0) return;

        const div = document.createElement('div');
        div.className = 'h-liga-box';
        div.id = 'sec-' + l.id;
        div.style.setProperty('--liga-accent', l.c);

        const info = infoSorteoActual();
        div.innerHTML = `
            <div class="h-liga-head no-captura">
                <div class="h-liga-head__left">
                    <h2 class="h-liga-title" style="color:${l.c}">LIGA ${l.id.toUpperCase()}</h2>
                    <span class="h-liga-count">${hits.length} ganador${hits.length === 1 ? '' : 'es'}</span>
                </div>
                <button type="button" class="btn-resultado btn-resultado--captura btn-captura-liga" onclick="capturarTableroLiga('${l.id}')">📸 CAPTURA LIGA</button>
            </div>
            <div class="h-liga-captura" id="captura-liga-${l.id}">
                <div class="h-liga-captura__banner">
                    <img src="${LOGO_TABLERO}" alt="YAAVS">
                    <div>
                        <p class="h-liga-captura__eyebrow">Conexión de Campeones</p>
                        <h3 class="h-liga-captura__title" style="color:${l.c}">LIGA ${l.id.toUpperCase()}</h3>
                        <p class="h-liga-captura__meta">${info.fecha} · ${hits.length} ganadores</p>
                    </div>
                </div>
                <div class="h-grid">
                    <div class="h-col h-col--basico">
                        <div class="h-col-title" style="color:var(--verde-yaavs)">Básicos</div>
                        <div class="h-col-list" id="h-${l.id}-B"></div>
                    </div>
                    <div class="h-col h-col--pro">
                        <div class="h-col-title" style="color:var(--sk)">Pros</div>
                        <div class="h-col-list" id="h-${l.id}-P"></div>
                    </div>
                    <div class="h-col h-col--elite">
                        <div class="h-col-title" style="color:var(--oro)">Elites</div>
                        <div class="h-col-list" id="h-${l.id}-E"></div>
                    </div>
                </div>
            </div>`;
        cont.appendChild(div);

        hits.forEach((h) => {
            const col = document.getElementById(`h-${l.id}-${h.k}`);
            if (col) col.appendChild(crearItemHistorial(h));
        });
    });

    actualizarMetaTablero();
    document.getElementById('modalH').style.display = 'block';
}

function cerrarH() {
    document.getElementById('modalH').style.display = 'none';
}

async function descargarCapturaElemento(elemento, nombreArchivo) {
    if (!elemento) return;
    if (typeof html2canvas !== 'function') {
        alert('No se pudo cargar la herramienta de captura. Revisa tu conexión y recarga la página.');
        return;
    }
    const modal = document.getElementById('modalH');
    modal.classList.add('capturando', 'modalH--captura');
    try {
        const canvas = await html2canvas(elemento, {
            backgroundColor: '#02060a',
            scale: 2,
            useCORS: true,
            logging: false,
            scrollX: 0,
            scrollY: -window.scrollY,
        });
        const enlace = document.createElement('a');
        enlace.download = nombreArchivo;
        enlace.href = canvas.toDataURL('image/png');
        enlace.click();
    } catch (e) {
        console.error('Captura fallida:', e);
        alert('No se pudo generar la captura. Intenta de nuevo.');
    } finally {
        modal.classList.remove('capturando', 'modalH--captura');
    }
}

function capturarTableroGeneral() {
    const wrap = document.getElementById('tableroCapturaWrap');
    const fecha = new Date().toISOString().slice(0, 10);
    descargarCapturaElemento(wrap, `Tablero_Conexion_Campeones_${fecha}.png`);
}

function capturarTableroLiga(ligaId) {
    const zona = document.getElementById(`captura-liga-${ligaId}`);
    const fecha = new Date().toISOString().slice(0, 10);
    const slug = String(ligaId).replace(/\s+/g, '_');
    descargarCapturaElemento(zona, `Tablero_Liga_${slug}_${fecha}.png`);
}

window.capturarTableroGeneral = capturarTableroGeneral;
window.capturarTableroLiga = capturarTableroLiga;

function ganadoresSinDuplicadosParaExport() {
    const ordenLiga = L.map((liga) => liga.id);
    const ordenKit = { B: 0, P: 1, E: 2 };
    const listaOrdenada = [...reg].sort((a, b) => {
        const ligaDiff = ordenLiga.indexOf(a.l) - ordenLiga.indexOf(b.l);
        if (ligaDiff !== 0) return ligaDiff;
        const kitDiff = ordenKit[a.k] - ordenKit[b.k];
        if (kitDiff !== 0) return kitDiff;
        return a.n.localeCompare(b.n, 'es', { numeric: true, sensitivity: 'base' });
    });
    const vistosExport = new Set();
    return listaOrdenada.filter((r) => {
        const clave = normalizarClaveYaavser(extraerClaveDeTicket(r.n));
        const key = `${r.l}|${r.k}|${clave}`;
        if (!clave || vistosExport.has(key)) return false;
        vistosExport.add(key);
        return true;
    });
}

function exportarExcel() {
    if (!reg || reg.length === 0) {
        return alert('No hay ganadores registrados aún.');
    }
    const sinDuplicados = ganadoresSinDuplicadosParaExport();
    const fecha = new Date().toISOString().slice(0, 10);
    const nombreBase = `Ganadores_Conexión_de_Campeones_${fecha}`;

    const filasCompletas = sinDuplicados.map((r) => ({
        MUNICIPIO: r.mun || municipioDeClave(extraerClaveDeTicket(r.n)),
        LIGA: r.l,
        KIT: K[r.k].n,
        'TICKET / NOMBRE': r.n,
        FECHA: r.d,
        HORA: r.h,
    }));
    const wbCompleto = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wbCompleto, XLSX.utils.json_to_sheet(filasCompletas), 'Ganadores');
    XLSX.writeFile(wbCompleto, `${nombreBase}.xlsx`);

    const filasSoloClaves = sinDuplicados.map((r) => ({
        CLAVE: extraerClaveDeTicket(r.n) || r.n,
    }));
    const wbClaves = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wbClaves, XLSX.utils.json_to_sheet(filasSoloClaves), 'Claves');
    setTimeout(() => {
        XLSX.writeFile(wbClaves, `${nombreBase}_solo_claves.xlsx`);
    }, 400);
}

function reiniciarTodo() {
    if (confirm('¿REINICIAR TODO EL EVENTO? Se perderán los ganadores actuales.')) {
        reg = [];
        cIdx = 0;
        est = 'W';
        usados.clear();
        clavesGanadorasEnSorteo.clear();
        clavesGanadorasPorBloque.clear();
        showSorterScreen('welcome');
    }
}

/* =========================================================
   CONTADOR DEL PRÓXIMO SORTEO
   ========================================================= */
function iniciarContador() {
    const proximoSorteo = new Date('2026-05-29T20:00:00').getTime();
    function actualizarContador() {
        const ahora = new Date().getTime();
        const diferencia = proximoSorteo - ahora;
        if (diferencia <= 0) {
            const d = document.getElementById('countdown-days');
            const h = document.getElementById('countdown-hours');
            const m = document.getElementById('countdown-minutes');
            const s = document.getElementById('countdown-seconds');
            if(d) d.textContent = '0';
            if(h) h.textContent = '0';
            if(m) m.textContent = '0';
            if(s) s.textContent = '0';
            return;
        }
        const dias = Math.floor(diferencia / (1000 * 60 * 60 * 24));
        const horas = Math.floor((diferencia % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutos = Math.floor((diferencia % (1000 * 60 * 60)) / (1000 * 60));
        const segundos = Math.floor((diferencia % (1000 * 60)) / 1000);
        
        const dEl = document.getElementById('countdown-days');
        const hEl = document.getElementById('countdown-hours');
        const mEl = document.getElementById('countdown-minutes');
        const sEl = document.getElementById('countdown-seconds');

        if(dEl) dEl.textContent = String(dias).padStart(2, '0');
        if(hEl) hEl.textContent = String(horas).padStart(2, '0');
        if(mEl) mEl.textContent = String(minutos).padStart(2, '0');
        if(sEl) sEl.textContent = String(segundos).padStart(2, '0');
    }
    actualizarContador();
    setInterval(actualizarContador, 1000);
}

/* =========================================================
   SISTEMA DE PREGUNTAS FRECUENTES (FAQ)
   ========================================================= */
function renderFaqModal() {
    const list = document.getElementById('faq-modal-list');
    if (!list || !window.FAQ_ENTRIES || list.dataset.rendered === '1') return;
    list.innerHTML = window.FAQ_ENTRIES.map((item) => {
        const qEsc = item.q.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return `<details class="faq-acc"><summary class="faq-acc__q">${qEsc}</summary><div class="faq-acc__a">${item.a}</div></details>`;
    }).join('');
    list.dataset.rendered = '1';
}

function openFaqModal() {
    renderFaqModal();
    const m = document.getElementById('faq-modal');
    if (!m) return;
    m.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeFaqModal() {
    const m = document.getElementById('faq-modal');
    if (!m) return;
    m.style.display = 'none';
    document.body.style.overflow = '';
}

document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const m = document.getElementById('faq-modal');
    if (m && m.style.display === 'flex') closeFaqModal();
});

function bootCountersAndFaq() {
    initCookies();
    iniciarContador();
    renderFaqModal();
    actualizarAvisoSorteoEnPagina();
    initCarruselGanadores();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootCountersAndFaq);
} else {
    bootCountersAndFaq();
}

/* =========================================================
   SISTEMA DE PWA Y NOTIFICACIONES (Web Push nativo, sin OneSignal)
   ========================================================= */

let deferredPrompt;

function yaavsUrlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

function yaavsTrySubscribePush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        return Promise.resolve(false);
    }
    if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
        return Promise.resolve(false);
    }

    function continuarTrasPermiso() {
        return fetch('push_public_config.php')
        .then(function (r) { return r.json(); })
        .then(function (cfg) {
            if (!cfg || !cfg.ok || !cfg.publicKey) {
                return false;
            }
            return navigator.serviceWorker.ready.then(function (reg) {
                return reg.pushManager.getSubscription().then(function (existing) {
                    var sub = existing;
                    var p = Promise.resolve(sub);
                    if (!sub) {
                        p = reg.pushManager.subscribe({
                            userVisibleOnly: true,
                            applicationServerKey: yaavsUrlBase64ToUint8Array(cfg.publicKey)
                        });
                    }
                    return p.then(function (s) {
                        return fetch('push_subscribe.php', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(s.toJSON())
                        }).then(function () { return true; });
                    });
                });
            });
        })
        .catch(function (err) {
            console.warn('Web push:', err);
            return false;
        });
    }

    if (typeof Notification === 'undefined' || Notification.permission === 'granted') {
        return continuarTrasPermiso();
    }
    return Notification.requestPermission().then(function (perm) {
        if (perm !== 'granted') {
            return false;
        }
        return continuarTrasPermiso();
    });
}

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').then(registration => {
            console.log('PWA Lista - ServiceWorker registrado: ', registration.scope);
        }).catch(err => {
            console.log('Error en ServiceWorker: ', err);
        });
    });
}

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
});

function preguntarDescargaApp() {
    if (typeof playClick === 'function') {
        initAudio();
        playClick();
    }

    yaavsTrySubscribePush();

    if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                console.log('Usuario instaló la Gana Yaavs App');
            } else {
                console.log('Usuario rechazó la instalación');
            }
            deferredPrompt = null;
        });
    } else {
        alert("Para instalar la App oficial de YAAVS:\n\n🍏 EN iPHONE (Safari):\nToca el botón de 'Compartir' (el cuadrito con la flecha hacia arriba) abajo en tu pantalla y selecciona 'Agregar a inicio'.\n\n🤖 EN ANDROID:\nToca los 3 puntitos de arriba a la derecha y selecciona 'Agregar a la pantalla principal' o 'Instalar aplicación'.");
    }
}