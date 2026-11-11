<?php
declare(strict_types=1);

/**
 * Uso (en tu Mac o servidor con PHP y Composer ya instalados):
 *   cd "Conexion de campeones"
 *   composer install
 *   php push_vapid_generate.php
 *
 * Crea data/push_vapid.local.php con claves VAPID. No lo subas a repos públicos.
 */

if (!is_file(__DIR__ . '/vendor/autoload.php')) {
    fwrite(STDERR, "Error: ejecuta primero \"composer install\" en esta carpeta.\n");
    exit(1);
}

require __DIR__ . '/vendor/autoload.php';

use Minishlink\WebPush\VAPID;

$keys = VAPID::createVapidKeys();
@mkdir(__DIR__ . '/data', 0755, true);

$export = [
    'vapid' => [
        'subject' => 'mailto:contacto@ganayaavs.com',
        'publicKey' => $keys['publicKey'],
        'privateKey' => $keys['privateKey'],
    ],
    'admin_token' => bin2hex(random_bytes(24)),
];

$php = "<?php\nreturn " . var_export($export, true) . ";\n";
$target = __DIR__ . '/data/push_vapid.local.php';
file_put_contents($target, $php);

echo "Listo: {$target}\n";
echo "Opcional: edita 'subject' a un correo tuyo real (mailto:...).\n";
echo "Copia admin_token a Google Apps Script (propiedad PUSH_ADMIN_TOKEN) si usas push_admin_send.php.\n";
