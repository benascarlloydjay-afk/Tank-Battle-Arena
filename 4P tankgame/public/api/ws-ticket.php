<?php
declare(strict_types=1);
require __DIR__ . '/auth-session.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['error' => 'Method not allowed.'], 405);
}

try {
    $account = require_auth_account();
    $configPath = __DIR__ . '/config.php';
    $config = is_file($configPath) ? require $configPath : [];
    $secret = (string)(getenv('ROOM_TICKET_SECRET') ?: ($config['ROOM_TICKET_SECRET'] ?? ''));
    if (strlen($secret) < 32) {
        json_response(['error' => 'Room service is not configured yet.'], 503);
    }

    $base64Url = static fn(string $value): string => rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
    $payload = $base64Url(json_encode([
        'player_id' => (string)$account['player_id'],
        'username' => (string)$account['username'],
        'expires_at' => time() + 90,
        'nonce' => bin2hex(random_bytes(16)),
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR));
    $signature = $base64Url(hash_hmac('sha256', $payload, $secret, true));
    json_response(['ticket' => $payload . '.' . $signature]);
} catch (Throwable $error) {
    error_log('Room ticket error: ' . $error->getMessage());
    json_response(['error' => 'Could not authorize the room connection.'], 500);
}
