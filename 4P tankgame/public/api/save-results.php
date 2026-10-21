<?php
declare(strict_types=1);
require __DIR__ . '/auth-session.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['error' => 'Method not allowed.'], 405);
}

$account = require_auth_account();

$body = request_json();
$results = $body['results'] ?? null;
if (!is_array($results) || count($results) !== 1) {
    json_response(['error' => 'Invalid match results.'], 400);
}

try {
    $connection = db();
    $connection->beginTransaction();
    $statement = $connection->prepare(
        'UPDATE players SET total_score = total_score + ?, kills = kills + ?, wins = wins + ? WHERE player_id = ?'
    );
    $seenPlayerIds = [];
    foreach ($results as $result) {
        if (!is_array($result)) {
            throw new InvalidArgumentException('Invalid player result.');
        }
        $playerId = trim((string)($result['player_id'] ?? ''));
        $score = filter_var($result['score'] ?? null, FILTER_VALIDATE_INT);
        $kills = filter_var($result['kills'] ?? null, FILTER_VALIDATE_INT);
        $wins = filter_var($result['wins'] ?? null, FILTER_VALIDATE_INT);
        if ($playerId !== (string)$account['player_id'] || mb_strlen($playerId) > 30 || $score === false || $kills === false || $wins === false ||
            $score < 0 || $kills < 0 || $wins < 0 || $wins > 1 || isset($seenPlayerIds[$playerId])) {
            throw new InvalidArgumentException('Invalid player result.');
        }
        $seenPlayerIds[$playerId] = true;
        $statement->execute([$score, $kills, $wins, $playerId]);
    }
    $connection->commit();
    json_response(['success' => true]);
} catch (InvalidArgumentException $error) {
    if (isset($connection) && $connection->inTransaction()) $connection->rollBack();
    json_response(['error' => $error->getMessage()], 400);
} catch (Throwable $error) {
    if (isset($connection) && $connection->inTransaction()) $connection->rollBack();
    error_log('Save match results error: ' . $error->getMessage());
    json_response(['error' => 'Could not save match results.'], 500);
}
