<?php
declare(strict_types=1);
require __DIR__ . '/auth-session.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    json_response(['error' => 'Method not allowed.'], 405);
}

try {
    $account = require_auth_account();
    $statement = db()->prepare(
        'SELECT p.player_id, a.username, p.total_score, p.kills, p.wins
         FROM players p INNER JOIN accounts a ON a.player_id = p.player_id
         WHERE p.player_id = ? LIMIT 1'
    );
    $statement->execute([$account['player_id']]);
    json_response(['success' => true, 'player' => $statement->fetch()]);
} catch (Throwable $error) {
    error_log('Player lookup error: ' . $error->getMessage());
    json_response(['error' => 'Could not load your player account.'], 500);
}
