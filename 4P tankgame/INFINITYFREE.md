# Publish Tank Battle Arena on InfinityFree

The website and account/leaderboard PHP endpoints can run on InfinityFree. Real-time rooms use the separate Node.js service in `room-server/`; InfinityFree does not host WebSocket servers or long-running processes.

## 1. Create the InfinityFree site and database

1. Create an InfinityFree hosting account and claim `tank-battle-arena.free.je` if it is still available. InfinityFree added `free.je` as a free subdomain option in May 2026; subdomain names are first-come, first-served.
2. In the hosting control panel, create a MySQL database and note its host, full database name, username, and password. InfinityFree assigns prefixed names; do not use `tank_game` unless that is the exact name shown in the panel.
3. Open phpMyAdmin for that database and import `database-infinityfree.sql`.
4. Copy the contents of `public/` into the account's `htdocs/` directory.
5. Copy `public/api/config.php.example` to `public/api/config.php` before uploading, then fill in the database values. Keep `config.php` private; `public/api/.htaccess` denies direct web access to it.
6. Enable HTTPS for the domain in the InfinityFree panel and use the HTTPS address when opening the game.

## 2. Deploy the room service on Render

The repository includes `render.yaml` for a single free Render Web Service.

1. Push this repository to a Git provider and connect it to Render.
2. Create a Blueprint instance from the repository and let Render use `render.yaml`.
3. Set `ROOM_TICKET_SECRET` to a random secret of at least 32 bytes. Put the exact same value in `public/api/config.php`.
4. Set `ALLOWED_ORIGIN` to `https://tank-battle-arena.free.je` (no trailing slash).
5. Wait for the service to deploy and copy its `onrender.com` hostname.
6. In `public/index.html`, set the `tank-ws-url` meta tag to `wss://YOUR-SERVICE.onrender.com/rooms`, then upload the updated file to `htdocs/`.

The PHP site issues a one-use, 90-second signed ticket after the player signs in. The room service verifies it without connecting to the InfinityFree MySQL server.

## 3. Launch check

Open the HTTPS site, create an account, and test two separate browser sessions: create a room in one, join it from the other, then start a short match. Check sign-up, sign-in, leaderboard loading, match completion, and the saved scores. The room server health URL is `https://YOUR-SERVICE.onrender.com/healthz` and should return `ok`.

## Free service limits

Render's free Web Services sleep after 15 minutes without inbound HTTP requests or WebSocket messages. The first connection after sleep can take about a minute. A restart or deploy loses in-memory rooms and disconnects active matches. Free services also share 750 instance hours per workspace each month. This setup suits a hobby launch and playtesting; it does not provide always-on or durable game sessions.

Keep this room service at one instance: rooms live in its process memory, so multiple instances would not share room membership or match state. The room owner browser still runs the simulation and submits its view of the result, so the leaderboard is not cheat-proof for competitive play.

## Local XAMPP remains available

Leave `tank-ws-url` empty for the existing XAMPP setup. With the tag empty, browsers use the local PHP room service at port 8080 and its existing database-token authentication.
