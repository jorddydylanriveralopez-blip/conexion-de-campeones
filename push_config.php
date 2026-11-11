<?php
declare(strict_types=1);

/**
 * Configuración Web Push (sin OneSignal).
 * Claves VAPID: genera data/push_vapid.local.php con push_vapid_generate.php
 * o define VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY en el hosting.
 */

$vapid = [
    'subject' => getenv('VAPID_SUBJECT') ?: 'mailto:contacto@ganayaavs.com',
    'publicKey' => getenv('VAPID_PUBLIC_KEY') ?: '',
    'privateKey' => getenv('VAPID_PRIVATE_KEY') ?: '',
];

$adminToken = getenv('PUSH_ADMIN_TOKEN') ?: '';

$local = __DIR__ . '/data/push_vapid.local.php';
if (is_readable($local)) {
    $L = require $local;
    if (is_array($L)) {
        if (!empty($L['vapid']['subject'])) {
            $vapid['subject'] = (string) $L['vapid']['subject'];
        }
        if (!empty($L['vapid']['publicKey'])) {
            $vapid['publicKey'] = (string) $L['vapid']['publicKey'];
        }
        if (!empty($L['vapid']['privateKey'])) {
            $vapid['privateKey'] = (string) $L['vapid']['privateKey'];
        }
        if (!empty($L['admin_token'])) {
            $adminToken = (string) $L['admin_token'];
        }
    }
}

return [
    'vapid' => $vapid,
    'admin_token' => $adminToken,
];
