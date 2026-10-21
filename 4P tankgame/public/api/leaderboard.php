<?php
declare(strict_types=1);
require __DIR__ . '/db.php';

try {
    $connection = db();
    $scores = $connection->query(
        'SELECT username, player_id, total_score FROM players ORDER BY total_score DESC LIMIT 10'
    )->fetchAll();
    $kills = $connection->query(
        'SELECT username, player_id, kills, wins FROM players ORDER BY kills DESC, username ASC LIMIT 10'
    )->fetchAll();
    $wins = $connection->query(
        'SELECT username, player_id, kills, wins FROM players ORDER BY wins DESC, username ASC LIMIT 10'
    )->fetchAll();
    json_response(['scores' => $scores, 'kills' => $kills, 'wins' => $wins]);
} catch (Throwable $error) {
    error_log('Leaderboard error: ' . $error->getMessage());
    json_response(['error' => 'Could not load the leaderboard.'], 500);
}
