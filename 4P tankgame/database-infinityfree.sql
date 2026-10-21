-- Create an empty database in the InfinityFree control panel first, then import this file into it.
-- InfinityFree assigns a prefixed database name, so this file intentionally has no CREATE DATABASE or USE.

CREATE TABLE IF NOT EXISTS players (
    player_id VARCHAR(30) NOT NULL PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    total_score INT UNSIGNED NOT NULL DEFAULT 0,
    kills INT UNSIGNED NOT NULL DEFAULT 0,
    wins INT UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS accounts (
    player_id VARCHAR(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL PRIMARY KEY,
    username VARCHAR(24) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    birth_date DATE NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS auth_tokens (
    token_hash CHAR(64) NOT NULL PRIMARY KEY,
    player_id VARCHAR(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_auth_tokens_expiry (expires_at),
    CONSTRAINT fk_auth_tokens_player FOREIGN KEY (player_id)
        REFERENCES accounts (player_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
