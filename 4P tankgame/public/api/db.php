<?php
declare(strict_types=1);

function db(): PDO
{
    static $connection = null;
    if ($connection instanceof PDO) {
        return $connection;
    }

    $configPath = __DIR__ . '/config.php';
    $config = is_file($configPath) ? require $configPath : [];
    if (!is_array($config)) $config = [];

    $host = getenv('DB_HOST') ?: ($config['DB_HOST'] ?? '127.0.0.1');
    $database = getenv('DB_NAME') ?: ($config['DB_NAME'] ?? 'tank_game');
    $username = getenv('DB_USER') ?: ($config['DB_USER'] ?? 'root');
    $password = getenv('DB_PASSWORD') ?: ($config['DB_PASSWORD'] ?? '');
    $connection = new PDO(
        "mysql:host={$host};dbname={$database};charset=utf8mb4",
        $username,
        $password,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
    );
    return $connection;
}

function json_response(mixed $data, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function request_json(): array
{
    $data = json_decode(file_get_contents('php://input') ?: '', true);
    return is_array($data) ? $data : [];
}
