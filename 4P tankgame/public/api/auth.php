<?php
declare(strict_types=1);
require __DIR__ . '/auth-session.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['error' => 'Method not allowed.'], 405);
}
start_auth_session();
$body = request_json();
$mode = (string)($body['mode'] ?? '');
$username = trim((string)($body['username'] ?? ''));
$password = (string)($body['password'] ?? '');
$passwordConfirmation = (string)($body['password_confirmation'] ?? '');
$birthDate = (string)($body['birth_date'] ?? '');
if (!preg_match('/^[A-Za-z0-9_]{3,24}$/', $username) || strlen($password) < 8 || strlen($password) > 72) {
    json_response(['error' => 'Use a 3–24 character username (letters, numbers, underscores) and an 8–72 byte password.'], 400);
}
if ($mode === 'signup') {
    $parsedBirthDate = DateTimeImmutable::createFromFormat('!Y-m-d', $birthDate);
    $dateErrors = DateTimeImmutable::getLastErrors();
    if ($password !== $passwordConfirmation) {
        json_response(['error' => 'Passwords do not match.'], 400);
    }
    if (!$parsedBirthDate || $parsedBirthDate->format('Y-m-d') !== $birthDate ||
        ($dateErrors !== false && ($dateErrors['warning_count'] > 0 || $dateErrors['error_count'] > 0)) ||
        $parsedBirthDate > new DateTimeImmutable('today')) {
        json_response(['error' => 'Enter a valid birth date that is not in the future.'], 400);
    }
}

try {
    $connection = db();
    if ($mode === 'signup') {
        $playerId = bin2hex(random_bytes(12));
        $passwordHash = password_hash($password, PASSWORD_DEFAULT);
        $connection->beginTransaction();
        $playerStatement = $connection->prepare('INSERT INTO players (player_id, username) VALUES (?, ?)');
        $playerStatement->execute([$playerId, $username]);
        $accountStatement = $connection->prepare(
            'INSERT INTO accounts (player_id, username, password_hash, birth_date) VALUES (?, ?, ?, ?)'
        );
        $accountStatement->execute([$playerId, $username, $passwordHash, $birthDate]);
        $token = create_auth_token($playerId);
        $connection->commit();
    } elseif ($mode === 'signin') {
        $statement = $connection->prepare('SELECT player_id, username, password_hash FROM accounts WHERE username = ? LIMIT 1');
        $statement->execute([$username]);
        $account = $statement->fetch();
        if (!$account || !password_verify($password, $account['password_hash'])) {
            json_response(['error' => 'Username or password is incorrect.'], 401);
        }
        $playerId = (string)$account['player_id'];
        $username = (string)$account['username'];
        $token = create_auth_token($playerId);
    } else {
        json_response(['error' => 'Choose sign in or sign up.'], 400);
    }

    session_regenerate_id(true);
    $_SESSION['player_id'] = $playerId;
    $_SESSION['ws_token'] = $token;
    json_response(auth_account_payload($playerId, $username, $token));
} catch (PDOException $error) {
    if (isset($connection) && $connection->inTransaction()) $connection->rollBack();
    if ($mode === 'signup' && (string)$error->getCode() === '23000') {
        json_response(['error' => 'That username is already taken.'], 409);
    }
    error_log('Authentication error: ' . $error->getMessage());
    json_response(['error' => 'Could not sign in. Check the MySQL setup and try again.'], 500);
} catch (Throwable $error) {
    if (isset($connection) && $connection->inTransaction()) $connection->rollBack();
    error_log('Authentication error: ' . $error->getMessage());
    json_response(['error' => 'Could not sign in. Check the MySQL setup and try again.'], 500);
}
