# Tank Battle Arena on XAMPP

## Start the website and database

1. Copy the contents of `public` into `C:\xampp\htdocs\tankgame`.
2. Start Apache and MySQL in the XAMPP Control Panel.
3. Import the current `database.sql` through phpMyAdmin (`http://localhost/phpmyadmin`). It creates the account and token tables alongside the existing score table; reimporting it adds missing tables while keeping existing tables and scores. If you already created the account table before birth dates were added, run `database-migration-birth-date.sql` once in phpMyAdmin.
4. Open `http://localhost/tankgame/`.

The API uses the `tank_game` database, with XAMPP's default MySQL `root` account and an empty password. Configure `DB_HOST`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD` in the environment used by both Apache and PHP CLI if those values differ.

## Sign in and sign up

Choose **Sign up**, enter a username of 3–24 letters, numbers, or underscores, a valid birth date, and a password with at least 8 characters twice. The account is saved in MySQL and signs in automatically. Use **Sign in** on later visits. Passwords are stored as password hashes, and each account keeps its own leaderboard record.

After signing in, choose **PC / Keyboard** or **Mobile / Touch**, then choose **Newbie** for the guided controls and match tutorial or **Veteran** to go straight to room setup.

## Start the PHP room service

Room matchmaking uses PHP's built-in stream functions and does not need Node.js, Composer, or a third-party library.

1. Keep Apache and MySQL running.
2. Double-click `start-rooms.bat` in `C:\xampp\htdocs\tankgame`, or run `C:\xampp\php\php.exe C:\xampp\htdocs\tankgame\websocket-server.php` in a terminal.
3. Leave that terminal open while players use rooms. The service listens on port `8080` by default.
4. On one device choose **Create Room**, then share the six-character code. Other devices open the same website and choose **Join Room**.
5. The room owner starts the match once at least two people have joined. Rooms support up to four devices.

To restrict the service to a different address or port, set `TANK_WS_ADDRESS` before starting it, for example `127.0.0.1:8080` for same-device development only.

## Connecting devices on the same Wi-Fi

On a local network, use the XAMPP computer's LAN address in the browser, such as `http://192.168.1.20/tankgame/`. Allow inbound TCP traffic to Apache and port `8080` in the computer firewall. The browser connects to the PHP room service using the same hostname on port `8080`.

## Publishing for players on any network

For players on different Wi-Fi or mobile networks, put the website, MySQL database, and PHP room process on a public server. Point a domain's DNS record to that server and serve the site over HTTPS. The host must allow a long-running PHP CLI process; many basic shared PHP plans do not. Keep MySQL private to the server.

Put a TLS-enabled reverse proxy in front of the room service. It should forward WebSocket upgrades from a public secure URL such as `wss://play.example.com/rooms` to the PHP process listening on port `8080`. Set that public URL in the `tank-ws-url` meta tag in `index.html`. Open HTTPS to the public server; keep the room service port private behind the proxy when possible.

XAMPP is still useful for development on your computer. Avoid exposing a home XAMPP computer directly to the internet; deploy the site and room process to a public host instead. Once deployed, players can open the domain from a PC or phone without being on the same Wi-Fi.

On phones, the match page displays touch movement, shoot, and skill controls. PCs can keep using the keyboard.

## Match authority

The room owner browser currently runs the existing JavaScript game simulation. PHP assigns room codes and player slots, relays controls to the room owner, and broadcasts the resulting state to the other devices. Keep the room owner connected until the match ends. This is a practical multiplayer prototype, but a public competitive release should move the simulation into a trusted server process to prevent a modified browser from changing match outcomes.
