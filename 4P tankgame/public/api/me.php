<?php
declare(strict_types=1);
require __DIR__ . '/auth-session.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    json_response(['error' => 'Method not allowed.'], 405);
}

try {
    $account = current_auth_account();
    if (!$account) json_response(['error' => 'Not signed in.'], 401);
    json_response(['account' => [
        'player_id' => $account['player_id'],
        'username' => $account['username'],
        'ws_token' => $_SESSION['ws_token']
    ]]);
} catch (Throwable $error) {
    error_log('Session lookup error: ' . $error->getMessage());
    json_response(['error' => 'Could not check your sign-in.'], 500);
}
