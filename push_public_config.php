<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

$cfg = require __DIR__ . '/push_config.php';
$pub = $cfg['vapid']['publicKey'] ?? '';

if ($pub === '') {
    http_response_code(503);
    echo json_encode(['ok' => false, 'error' => 'VAPID no configurado (ver INSTALL_PUSH.txt)']);
    exit;
}

echo json_encode(['ok' => true, 'publicKey' => $pub], JSON_UNESCAPED_UNICODE);
