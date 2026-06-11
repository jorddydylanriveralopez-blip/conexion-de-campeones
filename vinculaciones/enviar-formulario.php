<?php
declare(strict_types=1);

/**
 * Recibe el formulario de vinculaciones y lo reenvía al Web App de Google Apps Script.
 *
 * Configura la URL después de implementar google-apps-script-formulario.gs
 * (debe terminar en /exec).
 */
const FORMULARIO_SHEETS_WEBAPP = 'https://script.google.com/macros/s/AKfycbwlwrz_N2Y_rw4NR3ZPJGbt8yUAarepZw5GCwMIegxf1hGYz-ffXshys5PEsIuxV9_dqQ/exec';

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

$payload = json_encode($data, JSON_UNESCAPED_UNICODE);
if ($payload === false) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'No se pudo codificar la solicitud'], JSON_UNESCAPED_UNICODE);
    exit;
}

$ch = curl_init(FORMULARIO_SHEETS_WEBAPP);
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => $payload,
    CURLOPT_HTTPHEADER => ['Content-Type: text/plain;charset=utf-8'],
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
    http_response_code($httpCode >= 200 && $httpCode < 300 ? 200 : 502);
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
