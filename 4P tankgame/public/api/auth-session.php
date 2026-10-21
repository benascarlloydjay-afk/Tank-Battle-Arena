<?php
declare(strict_types=1);
require_once __DIR__ . '/db.php';

function start_auth_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) return;
    $secure = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== '' && $_SERVER['HTTPS'] !== 'off';
    ini_set('session.gc_maxlifetime', (string)(60 * 60 * 24 * 30));
    session_name('tank_session');
    session_set_cookie_params([
        'lifetime' => 60 * 60 * 24 * 30,
        'path' => '/',
        'secure' => $secure,
        'httponly' => true,
        'samesite' => 'Lax'
    ]);
    session_start();
}

function current_auth_account(): ?array
{
    start_auth_session();
    $playerId = (string)($_SESSION['player_id'] ?? '');
    $token = (string)($_SESSION['ws_token'] ?? '');
    if ($playerId === '' || !preg_match('/^[a-f0-9]{64}$/', $token)) return null;

    $statement = db()->prepare(
        'SELECT a.player_id, a.username, t.token_hash FROM accounts a
         INNER JOIN auth_tokens t ON t.player_id = a.player_id
         WHERE a.player_id = ? AND t.token_hash = ? AND t.expires_at > UTC_TIMESTAMP() LIMIT 1'
    );
    $statement->execute([$playerId, hash('sha256', $token)]);
    $account = $statement->fetch();
    return $account ?: null;
}

function require_auth_account(): array
{
    $account = current_auth_account();
    if (!$account) json_response(['error' => 'Please sign in again.'], 401);
    return $account;
}

function create_auth_token(string $playerId): string
{
    $token = bin2hex(random_bytes(32));
    $statement = db()->prepare(
        'INSERT INTO auth_tokens (token_hash, player_id, expires_at)
         VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 30 DAY))'
    );
    $statement->execute([hash('sha256', $token), $playerId]);
    return $token;
}

function auth_account_payload(string $playerId, string $username, string $token): array
{
    return ['success' => true, 'account' => [
        'player_id' => $playerId,
        'username' => $username,
        'ws_token' => $token
    ]];
}
