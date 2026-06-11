<?php
declare(strict_types=1);

/**
 * Recibe el formulario de vinculaciones y lo reenvía al Web App de Google Apps Script.
 *
 * Configura la URL después de implementar google-apps-script-formulario.gs
 * (debe terminar en /exec).
 */
const FORMULARIO_SHEETS_WEBAPP = 'https://script.google.com/macros/s/AKfycbw1RzE3NP_RilmnVfQLMHwkHchW7kO4074EQjHqll5naBSF_PN0QIHL06D9RW3ul9q7Hw/exec';

/** Opcional: mismo valor que FORM_TOKEN en Apps Script → Propiedades del script */
const FORMULARIO_SHEETS_TOKEN = '';

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

echo json_encode(['ok' => true, 'raw' => $response], JSON_UNESCAPED_UNICODE);
