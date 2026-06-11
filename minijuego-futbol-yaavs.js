/**
 * Minijuego secreto: escribe "YAAVS" en la consulta de boletos → penales.
 */
(function () {
    const CODIGO = 'YAAVS';
    const TOTAL_PENALES = 5;
    const W = 360;
    const H = 420;

    let overlay = null;
    let canvas = null;
    let ctx = null;
    let statusEl = null;
    let scoreEl = null;
    let shotEl = null;
    let btnWrap = null;
    let rafId = null;

    let abierto = false;
    let animando = false;
    let gol = 0;
    let intento = 0;

    let ball = { x: W / 2, y: H - 52, r: 14 };
    let keeper = { x: W / 2, y: 118, w: 54, h: 72, targetX: W / 2 };
    let ballTarget = { x: W / 2, y: 95 };
    let animT = 0;
    let ultimoResultado = '';

    const ZONAS = {
        left: { x: W * 0.28, label: 'Izquierda' },
        center: { x: W * 0.5, label: 'Centro' },
        right: { x: W * 0.72, label: 'Derecha' },
    };

    function crearOverlay() {
        if (overlay) return;

        overlay = document.createElement('div');
        overlay.id = 'futbol-minigame';
        overlay.className = 'futbol-minigame';
        overlay.hidden = true;
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-label', 'Minijuego de penales YAAVS');
        overlay.innerHTML = `
            <div class="futbol-minigame__panel">
                <button type="button" class="futbol-minigame__cerrar" aria-label="Cerrar">&times;</button>
                <p class="futbol-minigame__badge"><i class="fa-solid fa-futbol"></i> Modo campeón</p>
                <h2 class="futbol-minigame__titulo">Penales YAAVS</h2>
                <p class="futbol-minigame__stats">
                    Goles: <strong id="futbol-minigame-score">0</strong> / ${TOTAL_PENALES}
                    · Tiro: <strong id="futbol-minigame-shot">1</strong>
                </p>
                <canvas id="futbol-minigame-canvas" width="${W}" height="${H}" aria-label="Cancha de penales"></canvas>
                <p class="futbol-minigame__estado" id="futbol-minigame-estado">Elige dónde disparar</p>
                <div class="futbol-minigame__dirs" id="futbol-minigame-dirs">
                    <button type="button" data-dir="left" class="futbol-minigame__dir">← Izq</button>
                    <button type="button" data-dir="center" class="futbol-minigame__dir futbol-minigame__dir--main">Centro</button>
                    <button type="button" data-dir="right" class="futbol-minigame__dir">Der →</button>
                </div>
                <button type="button" class="futbol-minigame__replay" id="futbol-minigame-replay" hidden>Jugar de nuevo</button>
            </div>
        `;

        document.body.appendChild(overlay);

        canvas = overlay.querySelector('#futbol-minigame-canvas');
        ctx = canvas.getContext('2d');
        statusEl = overlay.querySelector('#futbol-minigame-estado');
        scoreEl = overlay.querySelector('#futbol-minigame-score');
        shotEl = overlay.querySelector('#futbol-minigame-shot');
        btnWrap = overlay.querySelector('#futbol-minigame-dirs');
        const replayBtn = overlay.querySelector('#futbol-minigame-replay');

        overlay.querySelector('.futbol-minigame__cerrar')?.addEventListener('click', cerrar);
        replayBtn?.addEventListener('click', reiniciarPartida);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) cerrar();
        });

        btnWrap?.querySelectorAll('[data-dir]').forEach((btn) => {
            btn.addEventListener('click', () => {
                if (!animando && intento < TOTAL_PENALES) disparar(btn.dataset.dir);
            });
        });

        document.addEventListener('keydown', onKeyGame);
    }

    function onKeyGame(e) {
        if (!abierto) return;
        if (e.key === 'Escape') {
            e.preventDefault();
            cerrar();
            return;
        }
        if (animando || intento >= TOTAL_PENALES) return;
        if (e.key === 'ArrowLeft' || e.key === '1') disparar('left');
        if (e.key === 'ArrowUp' || e.key === '2' || e.key === ' ') disparar('center');
        if (e.key === 'ArrowRight' || e.key === '3') disparar('right');
    }

    function dibujarCancha() {
        if (!ctx) return;
        ctx.clearRect(0, 0, W, H);

        const grd = ctx.createLinearGradient(0, 0, 0, H);
        grd.addColorStop(0, '#0a3d20');
        grd.addColorStop(0.45, '#1a6b32');
        grd.addColorStop(1, '#0d4a24');
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, W, H);

        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 8; i++) {
            ctx.beginPath();
            ctx.moveTo(0, 60 + i * 44);
            ctx.lineTo(W, 60 + i * 44);
            ctx.stroke();
        }

        const gx = W / 2 - 100;
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.lineWidth = 3;
        ctx.strokeRect(gx, 48, 200, 72);
        ctx.strokeRect(gx - 18, 36, 236, 96);

        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(gx, 48, 200, 72);

        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 11px Montserrat, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('CONEXIÓN DE CAMPEONES', W / 2, 32);

        ctx.fillStyle = '#22ff5e';
        ctx.fillRect(gx + 4, 48, 192, 4);

        ctx.fillStyle = '#f5f5f5';
        ctx.fillRect(keeper.x - keeper.w / 2, keeper.y - keeper.h / 2, keeper.w, keeper.h);
        ctx.fillStyle = '#1a472a';
        ctx.fillRect(keeper.x - keeper.w / 2 + 8, keeper.y - keeper.h / 2 + 10, keeper.w - 16, keeper.h - 20);
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(keeper.x, keeper.y - keeper.h / 2 - 8, 12, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ccc';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.strokeStyle = '#333';
        ctx.beginPath();
        ctx.arc(ball.x - 3, ball.y - 2, 4, 0, Math.PI * 2);
        ctx.stroke();

        if (ultimoResultado === 'gol') {
            ctx.fillStyle = 'rgba(34, 255, 94, 0.35)';
            ctx.font = 'bold 28px Montserrat, sans-serif';
            ctx.fillText('¡GOL!', W / 2, H / 2);
        } else if (ultimoResultado === 'atajada') {
            ctx.fillStyle = 'rgba(255, 80, 80, 0.4)';
            ctx.font = 'bold 24px Montserrat, sans-serif';
            ctx.fillText('ATAJADA', W / 2, H / 2);
        }
    }

    function loop() {
        dibujarCancha();
        rafId = requestAnimationFrame(loop);
    }

    function elegirAtajada(dirJugador) {
        const dirs = ['left', 'center', 'right'];
        const idx = dirs.indexOf(dirJugador);
        if (Math.random() < 0.55) return dirJugador;
        const otros = dirs.filter((d) => d !== dirJugador);
        return otros[Math.floor(Math.random() * otros.length)];
    }

    function disparar(dir) {
        if (animando || intento >= TOTAL_PENALES) return;
        animando = true;
        ultimoResultado = '';
        setBtns(false);

        const zona = ZONAS[dir];
        ballTarget.x = zona.x + (Math.random() - 0.5) * 24;
        ballTarget.y = 88 + Math.random() * 18;

        const dirPortero = elegirAtajada(dir);
        keeper.targetX = ZONAS[dirPortero].x;

        const startBall = { x: ball.x, y: ball.y };
        const startKeeper = keeper.x;
        const t0 = performance.now();
        const duracion = 520;

        function tick(now) {
            const t = Math.min(1, (now - t0) / duracion);
            const ease = 1 - Math.pow(1 - t, 3);
            ball.x = startBall.x + (ballTarget.x - startBall.x) * ease;
            ball.y = startBall.y + (ballTarget.y - startBall.y) * ease;
            keeper.x = startKeeper + (keeper.targetX - startKeeper) * ease;

            if (t < 1) {
                requestAnimationFrame(tick);
                return;
            }

            const atajada = dirPortero === dir && Math.random() < 0.72;
            if (atajada) {
                ultimoResultado = 'atajada';
                if (typeof playError === 'function') playError();
                statusEl.textContent = '¡El portero la atajó! Siguiente tiro…';
            } else {
                ultimoResultado = 'gol';
                gol += 1;
                scoreEl.textContent = String(gol);
                if (typeof playSuccess === 'function') playSuccess();
                if (typeof confetti === 'function') {
                    confetti({
                        particleCount: 55,
                        spread: 60,
                        origin: { y: 0.55 },
                        colors: ['#22ff5e', '#ffd700', '#fff'],
                        zIndex: 20000,
                    });
                }
                statusEl.textContent = '¡GOOOOL de campeón! ⚽';
            }

            intento += 1;
            shotEl.textContent = String(Math.min(intento + 1, TOTAL_PENALES));

            setTimeout(() => {
                ultimoResultado = '';
                ball.x = W / 2;
                ball.y = H - 52;
                keeper.x = W / 2;
                animando = false;

                if (intento >= TOTAL_PENALES) {
                    finalizarPartida();
                } else {
                    setBtns(true);
                    statusEl.textContent = 'Elige dónde disparar';
                }
            }, 900);
        }

        requestAnimationFrame(tick);
    }

    function setBtns(on) {
        btnWrap?.querySelectorAll('button').forEach((b) => {
            b.disabled = !on;
        });
    }

    function finalizarPartida() {
        setBtns(false);
        const replayBtn = overlay.querySelector('#futbol-minigame-replay');
        if (replayBtn) replayBtn.hidden = false;

        if (gol >= 4) {
            statusEl.innerHTML = `<strong style="color:#22ff5e">¡Crack YAAVS!</strong> Metiste ${gol} de ${TOTAL_PENALES}.`;
        } else if (gol >= 2) {
            statusEl.textContent = `Buen intento: ${gol}/${TOTAL_PENALES} goles. ¡Sigue practicando!`;
        } else {
            statusEl.textContent = `${gol}/${TOTAL_PENALES} goles. El portero fue un muro hoy.`;
        }
    }

    function reiniciarPartida() {
        gol = 0;
        intento = 0;
        animando = false;
        ultimoResultado = '';
        ball.x = W / 2;
        ball.y = H - 52;
        keeper.x = W / 2;
        scoreEl.textContent = '0';
        shotEl.textContent = '1';
        statusEl.textContent = 'Elige dónde disparar';
        const replayBtn = overlay.querySelector('#futbol-minigame-replay');
        if (replayBtn) replayBtn.hidden = true;
        setBtns(true);
    }

    function abrir() {
        crearOverlay();
        reiniciarPartida();
        overlay.hidden = false;
        overlay.classList.add('is-visible');
        abierto = true;
        document.body.classList.add('futbol-minigame-open');
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(loop);
        if (typeof initAudio === 'function') initAudio();
        if (typeof playClick === 'function') playClick();
        overlay.querySelector('.futbol-minigame__dir--main')?.focus();
    }

    function cerrar() {
        if (!overlay) return;
        overlay.hidden = true;
        overlay.classList.remove('is-visible');
        abierto = false;
        document.body.classList.remove('futbol-minigame-open');
        if (rafId) cancelAnimationFrame(rafId);
        rafId = null;
    }

    function intentarAbrirPorTexto(valor) {
        const v = String(valor || '')
            .trim()
            .toUpperCase()
            .replace(/\s/g, '');
        if (v === CODIGO) {
            const input = document.getElementById('inputClave');
            if (input) input.value = '';
            abrir();
            return true;
        }
        return false;
    }

    function enlazarInput() {
        const input = document.getElementById('inputClave');
        if (!input || input.dataset.futbolListo === '1') return;
        input.dataset.futbolListo = '1';

        input.addEventListener('input', () => {
            intentarAbrirPorTexto(input.value);
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                if (intentarAbrirPorTexto(input.value)) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            }
        });
    }

    window.abrirMinijuegoFutbol = abrir;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', enlazarInput);
    } else {
        enlazarInput();
    }
})();
