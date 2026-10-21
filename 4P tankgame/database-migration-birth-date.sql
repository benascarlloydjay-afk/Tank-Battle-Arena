USE tank_game;

ALTER TABLE accounts
    ADD COLUMN birth_date DATE NULL AFTER password_hash;
