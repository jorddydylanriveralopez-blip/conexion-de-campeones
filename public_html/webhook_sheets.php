<?php
declare(strict_types=1);

/**
 * Llamada desde Google Apps Script cuando cambia la hoja de boletos.
 *
 * 1. Genera un token largo (ej. 32+ caracteres) y ponlo aquí Y en Apps Script
 *    (Archivo → Configuración del proyecto → Propiedades del script → SHEET_WEBHOOK_TOKEN).
 * 2. URL de ejemplo (ajusta dominio y carpeta):
 *    https://ganayaavs.com/ruta-a-tu-carpeta/webhook_sheets.php?token=TU_TOKEN
 *
 * Cooldown por defecto 10 minutos para no spamear si editas muchas celdas seguidas.
 */

require_once __DIR__ . '/push_send.php';

// Preferible: variable de entorno SHEET_WEBHOOK_TOKEN en el hosting.
// Si no tienes entorno, descomenta y pon un token largo (el mismo en Apps Script):
// define('SHEET_WEBHOOK_TOKEN', 'cambia_esto_por_un_token_largo_secreto');

$token_esperado = getenv('SHEET_WEBHOOK_TOKEN') ?: (defined('SHEET_WEBHOOK_TOKEN') ? (string) SHEET_WEBHOOK_TOKEN : '');
if ($token_esperado === '' || strlen($token_esperado) < 24) {
    http_response_code(500);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Configura SHEET_WEBHOOK_TOKEN: variable de entorno en el hosting, o define(\'SHEET_WEBHOOK_TOKEN\', \'...\') arriba en webhook_sheets.php (24+ caracteres).';
    exit;
}

$token_recibido = (string) ($_GET['token'] ?? $_POST['token'] ?? '');
if ($token_recibido === '' || !hash_equals($token_esperado, $token_recibido)) {
    http_response_code(403);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Token inválido.';
    exit;
}

$cooldown_segundos = 600;
$estado = sys_get_temp_dir() . '/yaavs_sheet_webhook_' . hash('sha256', $token_esperado) . '.ts';
$ahora = time();
if (is_readable($estado)) {
    $ultimo = (int) file_get_contents($estado);
    if ($ultimo > 0 && ($ahora - $ultimo) < $cooldown_segundos) {
        header('Content-Type: text/plain; charset=utf-8');
        echo 'OK (cooldown: no se reenvió push, edita de nuevo en unos minutos si hace falta).';
        exit;
    }
}

file_put_contents($estado, (string) $ahora);

$titulo = 'Boletos actualizados';
$mensaje = 'La base de boletos en Google Sheets cambió. Vuelve a consultar tus boletos en Conexión de Campeones.';

$resultado = yaavs_push_broadcast($titulo, $mensaje, 'https://ganayaavs.com');

header('Content-Type: application/json; charset=utf-8');
echo json_encode($resultado, JSON_UNESCAPED_UNICODE);
