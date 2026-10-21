<?php
declare(strict_types=1);
require __DIR__ . '/auth-session.php';

require_auth_account();

try {
    json_response(db()->query(
        'SELECT username, player_id FROM players ORDER BY total_score DESC, username ASC LIMIT 20'
    )->fetchAll());
} catch (Throwable $error) {
    error_log('Player suggestions error: ' . $error->getMessage());
    json_response(['error' => 'Could not load player suggestions.'], 500);
}
