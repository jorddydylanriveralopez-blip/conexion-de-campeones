<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

$cfg = require __DIR__ . '/push_config.php';
if (($cfg['vapid']['publicKey'] ?? '') === '' || ($cfg['vapid']['privateKey'] ?? '') === '') {
    http_response_code(503);
    echo json_encode(['ok' => false, 'error' => 'Push no configurado en el servidor']);
    exit;
}

$raw = file_get_contents('php://input');
$data = json_decode($raw ?: 'null', true);
if (!is_array($data) || empty($data['endpoint']) || empty($data['keys']['p256dh']) || empty($data['keys']['auth'])) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Suscripción inválida']);
    exit;
}

$path = __DIR__ . '/data/push_subscribers.json';
@mkdir(dirname($path), 0755, true);

$subs = [];
if (is_readable($path)) {
    $subs = json_decode((string) file_get_contents($path), true) ?: [];
}
if (!is_array($subs)) {
    $subs = [];
}

$found = false;
foreach ($subs as $i => $s) {
    if (is_array($s) && ($s['endpoint'] ?? '') === $data['endpoint']) {
        $subs[$i] = $data;
        $found = true;
        break;
    }
}
if (!$found) {
    $subs[] = $data;
}

file_put_contents($path, json_encode($subs, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX);

echo json_encode(['ok' => true]);
