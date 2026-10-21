<?php
declare(strict_types=1);

// Lightweight room relay for XAMPP. Run with: php websocket-server.php
// The room owner simulates the match; this service routes inputs and state.
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}
require_once __DIR__ . '/api/db.php';
set_time_limit(0);
$address = getenv('TANK_WS_ADDRESS') ?: '0.0.0.0:8080';
$server = stream_socket_server('tcp://' . $address, $errorCode, $errorMessage);
if (!$server) {
    fwrite(STDERR, "Could not listen on {$address}: {$errorMessage} ({$errorCode})\n");
    exit(1);
}
stream_set_blocking($server, false);
echo "Tank rooms listening on {$address}\n";

$clients = [];
$rooms = [];

function sendFrame($client, array $data): void
{
    if (!is_resource($client)) return;
    $payload = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($payload === false) return;
    $length = strlen($payload);
    $header = chr(0x81);
    if ($length < 126) $header .= chr($length);
    elseif ($length < 65536) $header .= chr(126) . pack('n', $length);
    else $header .= chr(127) . pack('NN', 0, $length);
    @fwrite($client, $header . $payload);
}

function sendError($client, string $message): void
{
    sendFrame($client, ['type' => 'error', 'message' => $message]);
}

function broadcastRoom(array &$rooms, string $code, array $message): void
{
    if (!isset($rooms[$code])) return;
    foreach ($rooms[$code]['members'] as $member) sendFrame($member['client'], $message);
}

function roomSummary(array $room): array
{
    return array_map(static fn(array $member): array => $member['player'], array_values($room['members']));
}

function removeClient($client, array &$clients, array &$rooms): void
{
    $id = (int)$client;
    if (!isset($clients[$id])) return;
    $code = $clients[$id]['room'] ?? null;
    $slot = $clients[$id]['slot'] ?? null;
    unset($clients[$id]);
    if ($code === null || !isset($rooms[$code])) return;
    if ($slot === 0) {
        broadcastRoom($rooms, $code, ['type' => 'closed', 'message' => 'The room owner disconnected.']);
        foreach ($rooms[$code]['members'] as $member) {
            $otherId = (int)$member['client'];
            if ($otherId !== $id) @fclose($member['client']);
            unset($clients[$otherId]);
        }
        unset($rooms[$code]);
        return;
    }
    if ($rooms[$code]['started']) {
        sendFrame($rooms[$code]['host'], ['type' => 'remote-input', 'slot' => $slot,
            'input' => ['up' => false, 'down' => false, 'left' => false, 'right' => false, 'shoot' => false, 'skill' => false]]);
        return;
    }
    unset($rooms[$code]['members'][$slot]);
    $rooms[$code]['members'] = array_values($rooms[$code]['members']);
    foreach ($rooms[$code]['members'] as $index => &$member) {
        $member['slot'] = $index;
        $clients[(int)$member['client']]['slot'] = $index;
    }
    unset($member);
    $rooms[$code]['host'] = $rooms[$code]['members'][0]['client'];
    foreach ($rooms[$code]['members'] as $index => $member) {
        sendFrame($member['client'], ['type' => 'room', 'code' => $code, 'slot' => $index,
            'host' => $index === 0, 'players' => roomSummary($rooms[$code])]);
    }
}

function handleMessage($client, array $message, array &$clients, array &$rooms): void
{
    $id = (int)$client;
    $type = $message['type'] ?? '';
    if (empty($clients[$id]['ready'])) {
        $token = (string)($message['auth_token'] ?? '');
        if ($type !== 'hello' || !preg_match('/^[a-f0-9]{64}$/', $token)) {
            sendError($client, 'Sign in before connecting to a room.');
            return;
        }
        try {
            $statement = db()->prepare(
                'SELECT a.player_id, a.username FROM auth_tokens t
                 INNER JOIN accounts a ON a.player_id = t.player_id
                 WHERE t.token_hash = ? AND t.expires_at > UTC_TIMESTAMP() LIMIT 1'
            );
            $statement->execute([hash('sha256', $token)]);
            $account = $statement->fetch();
        } catch (Throwable $error) {
            error_log('Room authentication error: ' . $error->getMessage());
            sendError($client, 'Could not verify your account. Check MySQL and try again.');
            return;
        }
        if (!$account) {
            sendError($client, 'Your sign-in expired. Please sign in again.');
            return;
        }
        $player = is_array($message['player'] ?? null) ? $message['player'] : [];
        $playerId = (string)$account['player_id'];
        $clients[$id] = array_merge($clients[$id], ['client' => $client, 'player' => [
            'username' => (string)$account['username'], 'player_id' => $playerId,
            'movementMode' => ($player['movementMode'] ?? '') === 'spin-drive' ? 'spin-drive' : 'turn-drive'
        ], 'ready' => true, 'room' => null, 'slot' => null]);
        sendFrame($client, ['type' => 'ready']);
        return;
    }

    if ($type === 'create') {
        $code = strtoupper(substr(bin2hex(random_bytes(3)), 0, 6));
        while (isset($rooms[$code])) $code = strtoupper(substr(bin2hex(random_bytes(3)), 0, 6));
        $clients[$id]['room'] = $code;
        $clients[$id]['slot'] = 0;
        $rooms[$code] = ['host' => $client, 'started' => false, 'settings' => null,
            'members' => [['client' => $client, 'slot' => 0, 'player' => $clients[$id]['player']]]];
        sendFrame($client, ['type' => 'room', 'code' => $code, 'slot' => 0, 'host' => true,
            'players' => roomSummary($rooms[$code])]);
        return;
    }

    if ($type === 'join') {
        $code = strtoupper(preg_replace('/[^A-Z0-9]/', '', (string)($message['code'] ?? '')));
        if (!isset($rooms[$code])) { sendError($client, 'Room code not found.'); return; }
        $room = &$rooms[$code];
        if ($room['started']) { sendError($client, 'This match has already started.'); return; }
        if (count($room['members']) >= 4) { sendError($client, 'This room is full.'); return; }
        foreach ($room['members'] as $member) {
            if ($member['player']['player_id'] === $clients[$id]['player']['player_id']) {
                sendError($client, 'That player ID is already in this room.'); return;
            }
        }
        $slot = count($room['members']);
        $clients[$id]['room'] = $code;
        $clients[$id]['slot'] = $slot;
        $room['members'][] = ['client' => $client, 'slot' => $slot, 'player' => $clients[$id]['player']];
        foreach ($room['members'] as $index => $member) {
            sendFrame($member['client'], ['type' => 'room', 'code' => $code, 'slot' => $index,
                'host' => $index === 0, 'players' => roomSummary($room)]);
        }
        return;
    }

    $code = $clients[$id]['room'] ?? null;
    if ($code === null || !isset($rooms[$code])) { sendError($client, 'Create or join a room first.'); return; }
    $room = &$rooms[$code];
    $slot = $clients[$id]['slot'];
    if ($type === 'start') {
        if ($slot !== 0) { sendError($client, 'Only the room owner can start the match.'); return; }
        if (count($room['members']) < 2) { sendError($client, 'Invite at least one other player first.'); return; }
        $settings = $message['settings'] ?? [];
        $settings = [
            'timeLimitMinutes' => max(1, min(10, (int)($settings['timeLimitMinutes'] ?? 5))),
            'deathLimit' => max(1, min(1000, (int)($settings['deathLimit'] ?? 5))),
            'skillAmount' => max(1, min(50, (int)($settings['skillAmount'] ?? 10))),
            'category' => ($settings['category'] ?? '') === '2v2' ? '2v2' : 'ffa'
        ];
        if ($settings['category'] === '2v2' && count($room['members']) !== 4) {
            sendError($client, '2 vs 2 needs four connected players.'); return;
        }
        $room['started'] = true;
        $room['settings'] = $settings;
        broadcastRoom($rooms, $code, ['type' => 'start', 'players' => roomSummary($room), 'settings' => $settings]);
    } elseif ($type === 'input' || $type === 'spin') {
        if (!$room['started']) return;
        sendFrame($room['host'], ['type' => $type === 'spin' ? 'remote-spin' : 'remote-input',
            'slot' => $slot, 'input' => $message['input'] ?? null]);
    } elseif ($type === 'state' && $slot === 0 && $room['started']) {
        broadcastRoom($rooms, $code, ['type' => 'state', 'state' => $message['state'] ?? null]);
    } elseif ($type === 'leave') {
        removeClient($client, $clients, $rooms);
        @fclose($client);
    }
}

while (true) {
    $read = [$server];
    foreach ($clients as $entry) $read[] = $entry['client'];
    $write = null;
    $except = null;
    if (@stream_select($read, $write, $except, 1) === false) continue;
    foreach ($read as $client) {
        if ($client === $server) {
            $accepted = @stream_socket_accept($server, 0);
            if ($accepted) {
                stream_set_blocking($accepted, false);
                $clients[(int)$accepted] = ['client' => $accepted, 'ready' => false, 'buffer' => '', 'room' => null, 'slot' => null];
            }
            continue;
        }
        $id = (int)$client;
        $chunk = @fread($client, 8192);
        if ($chunk === '' || $chunk === false) {
            if (feof($client)) { removeClient($client, $clients, $rooms); @fclose($client); }
            continue;
        }
        if (!isset($clients[$id])) continue;
        $clients[$id]['buffer'] .= $chunk;
        if (empty($clients[$id]['handshake'])) {
            $buffer = $clients[$id]['buffer'];
            if (strpos($buffer, "\r\n\r\n") === false) continue;
            if (!preg_match('/Sec-WebSocket-Key:\s*(.+)\r\n/i', $buffer, $match)) {
                removeClient($client, $clients, $rooms); @fclose($client); continue;
            }
            $accept = base64_encode(sha1(trim($match[1]) . '258EAFA5-E914-47DA-95CA-C5AB0DC85B11', true));
            @fwrite($client, "HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: {$accept}\r\n\r\n");
            $clients[$id]['buffer'] = substr($buffer, strpos($buffer, "\r\n\r\n") + 4);
            $clients[$id]['handshake'] = true;
        }
        $buffer = $clients[$id]['buffer'];
        while (strlen($buffer) >= 2) {
            $first = ord($buffer[0]); $second = ord($buffer[1]);
            $opcode = $first & 0x0f; $length = $second & 0x7f; $offset = 2;
            if ($length === 126) { if (strlen($buffer) < 4) break; $length = unpack('n', substr($buffer, 2, 2))[1]; $offset = 4; }
            elseif ($length === 127) { if (strlen($buffer) < 10) break; $parts = unpack('N2', substr($buffer, 2, 8)); $length = $parts[2]; $offset = 10; }
            $masked = ($second & 0x80) !== 0;
            if ($masked) $offset += 4;
            if (strlen($buffer) < $offset + $length) break;
            $payload = substr($buffer, $offset, $length);
            if ($masked) { $mask = substr($buffer, $offset - 4, 4); for ($i = 0; $i < $length; $i++) $payload[$i] = $payload[$i] ^ $mask[$i % 4]; }
            $buffer = substr($buffer, $offset + $length);
            if ($opcode === 8) { removeClient($client, $clients, $rooms); @fclose($client); break; }
            if ($opcode === 9) { @fwrite($client, chr(0x8a) . chr(strlen($payload)) . $payload); continue; }
            $message = json_decode($payload, true);
            if (is_array($message)) handleMessage($client, $message, $clients, $rooms);
        }
        if (isset($clients[$id])) $clients[$id]['buffer'] = $buffer;
    }
}
