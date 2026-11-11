<?php
declare(strict_types=1);

/**
 * Apps Script u otras herramientas: POST JSON con cabecera X-Push-Admin.
 * Cuerpo: {"title":"...","body":"...","url":"https://ganayaavs.com"}
 *
 * El token debe coincidir con admin_token en data/push_vapid.local.php o PUSH_ADMIN_TOKEN en el servidor.
 */

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/push_send.php';

$cfg = require __DIR__ . '/push_config.php';
$expected = (string) ($cfg['admin_token'] ?? '');
if ($expected === '' || strlen($expected) < 16) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Configura admin_token en data/push_vapid.local.php o PUSH_ADMIN_TOKEN']);
    exit;
}

$hdr = (string) ($_SERVER['HTTP_X_PUSH_ADMIN'] ?? '');
if ($hdr === '' || !hash_equals($expected, $hdr)) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'Cabecera X-Push-Admin inválida']);
    exit;
}

$raw = file_get_contents('php://input');
$in = json_decode($raw ?: 'null', true);
if (!is_array($in) || empty($in['title']) || empty($in['body'])) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Faltan title o body en JSON']);
    exit;
}

$url = isset($in['url']) ? (string) $in['url'] : 'https://ganayaavs.com';
$result = yaavs_push_broadcast((string) $in['title'], (string) $in['body'], $url);
echo json_encode($result, JSON_UNESCAPED_UNICODE);
