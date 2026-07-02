# AGENTS.md

## Cursor Cloud specific instructions

"Gana Yaavs / Conexión de Campeones" — a static PWA (HTML/CSS/JS) for a raffle + mini-game. No build step or npm dependencies for the front-end.

### How to run (dev)
Serve over HTTP from the repo root, e.g.:
```bash
python3 -m http.server 8090
```
Then open `http://localhost:8090/index.html`. Sub-pages live under `ganadores/`, `madrescampeonas/`, `vinculaciones/`.

### Optional PHP push backend (not required to develop the site)
The `push_*.php` / `notificaciones.php` files implement Web Push and require **PHP >= 8.1 + Composer** (`composer install`) plus generated VAPID keys and HTTPS — see `INSTALL_PUSH.txt`. PHP/Composer are **not** installed in the base VM; install them only if you need to work on push notifications. The rest of the app runs fully as static files.
