<?php
declare(strict_types=1);

/**
 * Recibe el formulario de vinculaciones y lo reenvía al Web App de Google Apps Script.
 *
 * Configura la URL después de implementar google-apps-script-formulario.gs
 * (debe terminar en /exec).
 */
const FORMULARIO_SHEETS_WEBAPP = 'https://script.google.com/macros/s/AKfycby0WX9APv7sA98HHTRDaolGhl2TxvPSRogzoz7MgfhLEXdwSgjE8wn3EovrAqXx1RkmSg/exec';

/** Misma URL CSV que vinculaciones.js (base de claves válidas) */
const VINCULACIONES_CSV_URL =
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vS2w41eevnV1hTtq1Fr4dGToReWKLlNRNDMfzlHlLzAE384PQS7yfZvJKysKuRdwAajK3fG4lIEaF64/pub?gid=2006712567&single=true&output=csv';

/** Opcional: mismo valor que FORM_TOKEN en Apps Script → Propiedades del script */
const FORMULARIO_SHEETS_TOKEN = '';

function normalizarClave(string $s): string
{
    $s = strtoupper(trim($s));
    return preg_replace('/\s+/', '', $s) ?? '';
}

function normalizarHeader(string $h): string
{
    $h = trim($h);
    $h = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $h) ?: $h;
    $h = strtolower($h);
    $h = preg_replace('/[^a-z0-9]+/', '_', $h) ?? $h;
    return trim($h, '_');
}

/** @return list<int> */
function indicesColumnaClave(array $headers): array
{
    $aliases = [
        'clave_unica',
        'clave',
        'clave_cliente',
        'idcliente',
        'id',
        'codigo',
    ];
    $indices = [];
    foreach ($headers as $idx => $header) {
        if (in_array(normalizarHeader((string) $header), $aliases, true)) {
            $indices[] = (int) $idx;
        }
    }
    return $indices;
}

function claveExisteEnCsv(string $claveInput): ?bool
{
    $clave = normalizarClave($claveInput);
    if ($clave === '') {
        return false;
    }

    $context = stream_context_create([
        'http' => [
            'timeout' => 20,
            'header' => "User-Agent: ganayaavs-vinculaciones/1.0\r\n",
        ],
    ]);
    $csv = @file_get_contents(VINCULACIONES_CSV_URL, false, $context);
    if ($csv === false || trim($csv) === '') {
        return null;
    }

    $stream = fopen('php://memory', 'r+');
    if ($stream === false) {
        return null;
    }
    fwrite($stream, $csv);
    rewind($stream);

    $headers = fgetcsv($stream);
    if (!is_array($headers) || $headers === []) {
        fclose($stream);
        return null;
    }

    $indicesClave = indicesColumnaClave($headers);
    if ($indicesClave === []) {
        fclose($stream);
        return null;
    }

    while (($row = fgetcsv($stream)) !== false) {
        if (!is_array($row)) {
            continue;
        }
        foreach ($indicesClave as $idx) {
            $valor = normalizarClave((string) ($row[$idx] ?? ''));
            if ($valor !== '' && $valor === $clave) {
                fclose($stream);
                return true;
            }
        }
    }

    fclose($stream);
    return false;
}

function notificarFormularioVinculacion(array $data): void
{
    $pushPath = dirname(__DIR__) . '/push_send.php';
    if (!is_file($pushPath)) {
        return;
    }

    require_once $pushPath;

    $nombre = trim((string) ($data['nombre'] ?? ''));
    $motivo = trim((string) ($data['motivo'] ?? ''));
    $clave = trim((string) ($data['clave'] ?? ''));
    $titulo = 'Nuevo formulario vinculaciones';
    $cuerpo = $nombre !== ''
        ? $nombre . ' — ' . ($motivo !== '' ? $motivo : 'nueva solicitud')
        : 'Clave ' . $clave;

    try {
        yaavs_push_broadcast($titulo, $cuerpo, 'https://ganayaavs.com/vinculaciones');
    } catch (Throwable) {
        // No bloquear la respuesta al usuario si falla el push.
    }
}

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header('Access-Control-Allow-Methods: POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Método no permitido'], JSON_UNESCAPED_UNICODE);
    exit;
}

if (FORMULARIO_SHEETS_WEBAPP === '') {
    http_response_code(503);
    echo json_encode(
        [
            'ok' => false,
            'error' => 'Formulario en configuración. Falta pegar la URL del Web App en enviar-formulario.php',
        ],
        JSON_UNESCAPED_UNICODE,
    );
    exit;
}

$raw = file_get_contents('php://input');
$data = json_decode($raw ?: '', true);
if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'JSON inválido'], JSON_UNESCAPED_UNICODE);
    exit;
}

$claveFormulario = trim((string) ($data['clave'] ?? ''));
if ($claveFormulario === '') {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Falta la clave de cliente.'], JSON_UNESCAPED_UNICODE);
    exit;
}

$claveValida = claveExisteEnCsv($claveFormulario);
if ($claveValida === null) {
    http_response_code(503);
    echo json_encode(
        ['ok' => false, 'error' => 'No se pudo verificar la clave en este momento. Intenta de nuevo.'],
        JSON_UNESCAPED_UNICODE,
    );
    exit;
}
if ($claveValida === false) {
    http_response_code(403);
    echo json_encode(
        [
            'ok' => false,
            'error' => 'La clave «' . $claveFormulario . '» no está registrada. No puedes enviar el formulario.',
        ],
        JSON_UNESCAPED_UNICODE,
    );
    exit;
}

if (FORMULARIO_SHEETS_TOKEN !== '') {
    $data['token'] = FORMULARIO_SHEETS_TOKEN;
}

$query = [
    'action' => 'submit',
    'nombre' => (string) ($data['nombre'] ?? ''),
    'telefono' => (string) ($data['telefono'] ?? ''),
    'clave' => (string) ($data['clave'] ?? ''),
    'motivo' => (string) ($data['motivo'] ?? ''),
    'titular' => (string) ($data['titular'] ?? ''),
    'banco' => (string) ($data['banco'] ?? ''),
    'clabe' => (string) ($data['clabe'] ?? ''),
    'mensaje' => (string) ($data['mensaje'] ?? ''),
    'origen' => (string) ($data['origen'] ?? 'ganayaavs.com/vinculaciones'),
];
if (FORMULARIO_SHEETS_TOKEN !== '') {
    $query['token'] = FORMULARIO_SHEETS_TOKEN;
}

$webAppUrl = FORMULARIO_SHEETS_WEBAPP . '?' . http_build_query($query);

$ch = curl_init($webAppUrl);
curl_setopt_array($ch, [
    CURLOPT_HTTPGET => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_TIMEOUT => 25,
]);

$response = curl_exec($ch);
$httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

if ($response === false) {
    http_response_code(502);
    echo json_encode(['ok' => false, 'error' => 'No se pudo contactar Google Sheets: ' . $curlError], JSON_UNESCAPED_UNICODE);
    exit;
}

$decoded = json_decode($response, true);
if (is_array($decoded)) {
    if (!empty($decoded['saved'])) {
        notificarFormularioVinculacion($data);
        http_response_code(200);
        echo json_encode(['ok' => true], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if (isset($decoded['message']) && stripos((string) $decoded['message'], 'activa') !== false) {
        http_response_code(502);
        echo json_encode(
            [
                'ok' => false,
                'error' => 'Google Apps Script tiene código viejo. En la hoja Vinculaciones 2026 → Extensiones → Apps Script: borra todo, pega google-apps-script-formulario.gs completo, Guardar, ejecuta testGuardarFormulario, Implementar → Nueva versión (Yo + Cualquiera).',
            ],
            JSON_UNESCAPED_UNICODE,
        );
        exit;
    }

    http_response_code($httpCode >= 200 && $httpCode < 300 && !empty($decoded['ok']) ? 200 : 502);
    echo json_encode($decoded, JSON_UNESCAPED_UNICODE);
    exit;
}

$paginaNoEncontrada = stripos($response, 'Page Not Found') !== false
    || stripos($response, 'No se encontró la página') !== false;
http_response_code(502);
echo json_encode(
    [
        'ok' => false,
        'error' => $paginaNoEncontrada
            ? 'Google Apps Script no responde. Vuelve a implementar el Web App (acceso: Cualquiera) y actualiza la URL /exec.'
            : 'Google Sheets devolvió una respuesta inválida. Intenta de nuevo en unos minutos.',
    ],
    JSON_UNESCAPED_UNICODE,
);
