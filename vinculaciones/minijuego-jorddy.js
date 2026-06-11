/**
 * Minijuego secreto: escribe "jorddy" en la landing (fuera de inputs).
 */
(function () {
  const CODIGO = 'jorddy';
  const DURACION_MS = 25000;
  const ANCHO_JUGADOR = 72;
  const VELOCIDAD_JUGADOR = 9;
  const ANCHO_ARENA = 340;
  const ALTO_ARENA = 380;

  let buffer = '';
  let overlay = null;
  let arena = null;
  let player = null;
  let scoreEl = null;
  let timeEl = null;
  let loopId = null;
  let activo = false;
  let score = 0;
  let tiempoRestante = 0;
  let jugadorX = 0;
  const teclas = { left: false, right: false };
  const caidas = [];

  function esCampoFormulario(el) {
    return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT');
  }

  function crearOverlay() {
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = 'minigame-jorddy';
    overlay.className = 'minigame';
    overlay.hidden = true;
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Minijuego Atrapa la eSIM');
    overlay.innerHTML = `
      <div class="minigame__panel">
        <button type="button" class="minigame__cerrar" aria-label="Cerrar">&times;</button>
        <p class="minigame__badge">Modo secreto · Jorddy</p>
        <h2 class="minigame__titulo">Atrapa la eSIM</h2>
        <p class="minigame__instruccion">
          Mueve con <kbd>←</kbd> <kbd>→</kbd> o <kbd>A</kbd> <kbd>D</kbd>. Evita el glitch.
        </p>
        <div class="minigame__stats">
          <span>Puntos: <strong id="minigame-score">0</strong></span>
          <span>Tiempo: <strong id="minigame-time">25</strong>s</span>
        </div>
        <div class="minigame__arena" id="minigame-arena">
          <div class="minigame__player" id="minigame-player" aria-hidden="true"></div>
        </div>
        <p class="minigame__estado" id="minigame-estado">Pulsa Espacio para empezar</p>
        <button type="button" class="minigame__btn" id="minigame-start">Jugar</button>
      </div>
    `;

    document.body.appendChild(overlay);

    arena = overlay.querySelector('#minigame-arena');
    player = overlay.querySelector('#minigame-player');
    scoreEl = overlay.querySelector('#minigame-score');
    timeEl = overlay.querySelector('#minigame-time');
    const estado = overlay.querySelector('#minigame-estado');

    overlay.querySelector('.minigame__cerrar')?.addEventListener('click', cerrar);
    overlay.querySelector('#minigame-start')?.addEventListener('click', iniciarPartida);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) cerrar();
    });

    document.addEventListener('keydown', (e) => {
      if (!overlay || overlay.hidden) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        cerrar();
        return;
      }
      if (!activo && (e.key === ' ' || e.code === 'Space')) {
        e.preventDefault();
        iniciarPartida();
        return;
      }
      if (!activo) return;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') teclas.left = true;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') teclas.right = true;
    });

    document.addEventListener('keyup', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') teclas.left = false;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') teclas.right = false;
    });

    return overlay;
  }

  function abrir() {
    crearOverlay();
    overlay.hidden = false;
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('minigame-abierto');
    resetPartida();
    overlay.querySelector('#minigame-start')?.focus();
  }

  function cerrar() {
    if (!overlay) return;
    detenerLoop();
    activo = false;
    overlay.hidden = true;
    overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('minigame-abierto');
    limpiarCaidas();
    buffer = '';
  }

  function resetPartida() {
    detenerLoop();
    activo = false;
    score = 0;
    tiempoRestante = DURACION_MS / 1000;
    jugadorX = (ANCHO_ARENA - ANCHO_JUGADOR) / 2;
    if (scoreEl) scoreEl.textContent = '0';
    if (timeEl) timeEl.textContent = String(tiempoRestante);
    const estado = overlay?.querySelector('#minigame-estado');
    if (estado) estado.textContent = 'Pulsa Espacio o Jugar para empezar';
    if (player) player.style.transform = `translateX(${jugadorX}px)`;
    limpiarCaidas();
  }

  function limpiarCaidas() {
    caidas.forEach((c) => c.el.remove());
    caidas.length = 0;
  }

  function iniciarPartida() {
    if (activo) return;
    limpiarCaidas();
    activo = true;
    score = 0;
    tiempoRestante = DURACION_MS / 1000;
    jugadorX = (ANCHO_ARENA - ANCHO_JUGADOR) / 2;
    const estado = overlay?.querySelector('#minigame-estado');
    if (estado) estado.textContent = '¡Atrapa las eSIM!';
    let ultimoTick = performance.now();
    let acumuladorSpawn = 0;

    function tick(ahora) {
      if (!activo) return;
      const dt = Math.min(ahora - ultimoTick, 50);
      ultimoTick = ahora;
      acumuladorSpawn += dt;

      if (acumuladorSpawn > 650) {
        acumuladorSpawn = 0;
        spawnItem();
      }

      if (teclas.left) jugadorX -= VELOCIDAD_JUGADOR * (dt / 16);
      if (teclas.right) jugadorX += VELOCIDAD_JUGADOR * (dt / 16);
      jugadorX = Math.max(0, Math.min(ANCHO_ARENA - ANCHO_JUGADOR, jugadorX));
      if (player) player.style.transform = `translateX(${jugadorX}px)`;

      for (let i = caidas.length - 1; i >= 0; i--) {
        const item = caidas[i];
        item.y += item.vy * (dt / 16);
        item.el.style.transform = `translate(${item.x}px, ${item.y}px)`;

        if (colision(item)) {
          score += item.puntos;
          if (scoreEl) scoreEl.textContent = String(score);
          item.el.classList.add('minigame__item--pop');
          setTimeout(() => item.el.remove(), 200);
          caidas.splice(i, 1);
          continue;
        }

        if (item.y > ALTO_ARENA + 20) {
          item.el.remove();
          caidas.splice(i, 1);
        }
      }

      tiempoRestante -= dt / 1000;
      if (timeEl) timeEl.textContent = String(Math.max(0, Math.ceil(tiempoRestante)));

      if (tiempoRestante <= 0) {
        finPartida();
        return;
      }

      loopId = requestAnimationFrame(tick);
    }

    loopId = requestAnimationFrame(tick);
  }

  function detenerLoop() {
    if (loopId) {
      cancelAnimationFrame(loopId);
      loopId = null;
    }
  }

  function spawnItem() {
    if (!arena) return;
    const esGlitch = Math.random() < 0.18;
    const el = document.createElement('span');
    el.className = `minigame__item ${esGlitch ? 'minigame__item--glitch' : 'minigame__item--esim'}`;
    el.textContent = esGlitch ? '⚡' : 'eSIM';
    const w = esGlitch ? 36 : 44;
    const x = Math.random() * (ANCHO_ARENA - w);
    arena.appendChild(el);
    caidas.push({
      el,
      x,
      y: -40,
      w,
      h: 32,
      vy: 2.2 + Math.random() * 1.8,
      puntos: esGlitch ? -12 : 10,
    });
  }

  function colision(item) {
    const py = ALTO_ARENA - 48;
    const ph = 40;
    const px = jugadorX;
    const pw = ANCHO_JUGADOR;
    return (
      item.x < px + pw &&
      item.x + item.w > px &&
      item.y + item.h > py &&
      item.y < py + ph
    );
  }

  function finPartida() {
    activo = false;
    detenerLoop();
    limpiarCaidas();
    const estado = overlay?.querySelector('#minigame-estado');
    let msg = `Tiempo. Puntaje: ${score}. `;
    if (score >= 120) msg += '¡Campeón de señal!';
    else if (score >= 60) msg += 'Buena conexión.';
    else msg += 'Sigue practicando.';
    if (estado) estado.textContent = msg;

    try {
      const prev = Number(localStorage.getItem('yaavs_minigame_best') || 0);
      if (score > prev) localStorage.setItem('yaavs_minigame_best', String(score));
    } catch {
      /* ignore */
    }
  }

  function escucharCodigo(e) {
    if (!overlay?.hidden && overlay) return;
    if (esCampoFormulario(e.target)) return;

    const key = e.key.length === 1 ? e.key.toLowerCase() : '';
    if (!key) return;

    buffer = (buffer + key).slice(-CODIGO.length);
    if (buffer === CODIGO) {
      buffer = '';
      abrir();
    }
  }

  document.addEventListener('keydown', escucharCodigo);
})();
