<?php
declare(strict_types=1);
require __DIR__ . '/auth-session.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['error' => 'Method not allowed.'], 405);
}

start_auth_session();
$token = (string)($_SESSION['ws_token'] ?? '');
try {
    if (preg_match('/^[a-f0-9]{64}$/', $token)) {
        $statement = db()->prepare('DELETE FROM auth_tokens WHERE token_hash = ?');
        $statement->execute([hash('sha256', $token)]);
    }
} catch (Throwable $error) {
    error_log('Sign out token cleanup error: ' . $error->getMessage());
}

$_SESSION = [];
$cookie = session_get_cookie_params();
setcookie(session_name(), '', [
    'expires' => time() - 42000,
    'path' => $cookie['path'],
    'domain' => $cookie['domain'],
    'secure' => $cookie['secure'],
    'httponly' => $cookie['httponly'],
    'samesite' => $cookie['samesite'] ?? 'Lax'
]);
session_destroy();
json_response(['success' => true]);
