<?php
declare(strict_types=1);

use Minishlink\WebPush\Subscription;
use Minishlink\WebPush\WebPush;

/**
 * Envía Web Push a todos los suscriptores guardados en data/push_subscribers.json
 */
function yaavs_push_broadcast(string $titulo, string $cuerpo, string $url = 'https://ganayaavs.com'): array
{
    if (!is_file(__DIR__ . '/vendor/autoload.php')) {
        return ['ok' => false, 'error' => 'Falta la carpeta vendor. En tu PC: composer install y sube vendor/ al hosting.'];
    }

    require_once __DIR__ . '/vendor/autoload.php';

    $cfg = require __DIR__ . '/push_config.php';
    $v = $cfg['vapid'];
    if (($v['publicKey'] ?? '') === '' || ($v['privateKey'] ?? '') === '') {
        return ['ok' => false, 'error' => 'VAPID no configurado'];
    }

    $path = __DIR__ . '/data/push_subscribers.json';
    if (!is_readable($path)) {
        return ['ok' => true, 'sent' => 0, 'note' => 'No hay suscriptores aún'];
    }

    $subs = json_decode((string) file_get_contents($path), true);
    if (!is_array($subs) || $subs === []) {
        return ['ok' => true, 'sent' => 0, 'note' => 'Lista de suscriptores vacía'];
    }

    $auth = [
        'VAPID' => [
            'subject' => $v['subject'],
            'publicKey' => $v['publicKey'],
            'privateKey' => $v['privateKey'],
        ],
    ];

    $webPush = new WebPush($auth);
    $payload = json_encode([
        'title' => $titulo,
        'body' => $cuerpo,
        'url' => $url,
    ], JSON_UNESCAPED_UNICODE);

    foreach ($subs as $row) {
        if (!is_array($row) || empty($row['endpoint'])) {
            continue;
        }
        try {
            $webPush->queueNotification(Subscription::create($row), $payload);
        } catch (Throwable $e) {
            // fila inválida, se omite
        }
    }

    $expired = [];
    $ok = 0;
    foreach ($webPush->flush() as $report) {
        if ($report->isSuccess()) {
            ++$ok;
            continue;
        }
        if ($report->isSubscriptionExpired()) {
            $expired[] = $report->getEndpoint();
        }
    }

    if ($expired !== []) {
        $kept = [];
        foreach ($subs as $row) {
            if (!is_array($row) || in_array($row['endpoint'] ?? '', $expired, true)) {
                continue;
            }
            $kept[] = $row;
        }
        file_put_contents($path, json_encode($kept, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX);
    }

    return ['ok' => true, 'sent' => $ok, 'removed_expired' => count($expired)];
}
