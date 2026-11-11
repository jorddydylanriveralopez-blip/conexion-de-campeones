<?php
declare(strict_types=1);

// ==========================================
// NOTIFICACIONES WEB PUSH (sin OneSignal) — SORTEOS
// Ejecutar 1 vez al día (cron) en horario fijo, ej. 9:00 CDMX:
//   php /ruta/notificaciones.php
//   o URL: https://tudominio.com/.../notificaciones.php?cron_key=TU_CLAVE
// ==========================================

require_once __DIR__ . '/push_send.php';

// Opcional: evita que cualquiera dispare el script por URL sin cron del servidor
$cron_key_esperado = getenv('NOTIFICACIONES_CRON_KEY') ?: '';
if ($cron_key_esperado !== '') {
    $cron_key_recibido = (string) ($_GET['cron_key'] ?? '');
    if (!hash_equals($cron_key_esperado, $cron_key_recibido)) {
        http_response_code(403);
        header('Content-Type: text/plain; charset=utf-8');
        echo 'cron_key inválida o falta.';
        exit;
    }
}

$hoy = date('Y-m-d');

$fechas_sorteos = [
    '2026-05-15',
    '2026-05-29',
    '2026-06-12',
    '2026-06-26',
    '2026-07-10',
    '2026-07-31',
];

$mensaje = '';
$titulo = '';

foreach ($fechas_sorteos as $fecha_sorteo) {
    // Prioridad: día del sorteo > víspera > “casi” (2 días antes)
    if ($hoy === $fecha_sorteo) {
        $titulo = '¡ESTAMOS EN VIVO!';
        $mensaje = 'Entra ya a la app y descubre si eres uno de los campeones ganadores.';
        break;
    }

    $un_dia_antes = date('Y-m-d', strtotime($fecha_sorteo . ' -1 day'));
    if ($hoy === $un_dia_antes) {
        $titulo = '¡Mañana es el sorteo!';
        $mensaje = 'Prepara tus boletos. Mañana transmitiremos en vivo el sorteo quincenal.';
        break;
    }

    $dos_dias_antes = date('Y-m-d', strtotime($fecha_sorteo . ' -2 day'));
    if ($hoy === $dos_dias_antes) {
        $titulo = '¡El sorteo está muy cerca!';
        $mensaje = 'En 2 días es el sorteo quincenal. Revisa tus boletos y no te pierdas la transmisión en vivo.';
        break;
    }
}

if ($mensaje === '') {
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Hoy no toca aviso de sorteo (ni víspera ni 2 días antes ni día de sorteo).';
    exit;
}

header('Content-Type: application/json; charset=utf-8');
$resultado = yaavs_push_broadcast($titulo, $mensaje, 'https://ganayaavs.com');
echo json_encode($resultado, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . "\n";
