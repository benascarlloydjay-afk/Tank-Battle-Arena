"use strict";

const crypto = require("node:crypto");
const http = require("node:http");
const { WebSocketServer, WebSocket } = require("ws");

const port = Number(process.env.PORT || 8080);
const ticketSecret = process.env.ROOM_TICKET_SECRET || "";
const allowedOrigin = (process.env.ALLOWED_ORIGIN || "").replace(/\/$/, "");
const maxMessageBytes = 512 * 1024;

if (Buffer.byteLength(ticketSecret) < 32) {
    throw new Error("ROOM_TICKET_SECRET must contain at least 32 bytes.");
}

const server = http.createServer((request, response) => {
    if (request.method === "GET" && request.url === "/healthz") {
        response.writeHead(200, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
        response.end("ok");
        return;
    }
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
});

const wss = new WebSocketServer({ noServer: true, maxPayload: maxMessageBytes, perMessageDeflate: false });
const clients = new Map();
const rooms = new Map();
const usedTickets = new Map();

server.on("upgrade", (request, socket, head) => {
    const requestUrl = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
    const origin = request.headers.origin || "";
    if (requestUrl.pathname !== "/rooms" || (allowedOrigin && origin !== allowedOrigin)) {
        socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
        socket.destroy();
        return;
    }
    wss.handleUpgrade(request, socket, head, ws => wss.emit("connection", ws, request));
});

function send(ws, message) {
    if (ws?.readyState !== WebSocket.OPEN) return;
    try {
        ws.send(JSON.stringify(message));
    } catch (error) {
        console.error("WebSocket send failed:", error.message);
    }
}

function sendError(ws, message) {
    send(ws, { type: "error", message });
}

function verifyTicket(ticket) {
    if (typeof ticket !== "string" || ticket.length > 2048) return null;
    const parts = ticket.split(".");
    if (parts.length !== 2) return null;
    const [payload, signature] = parts;
    const expected = crypto.createHmac("sha256", ticketSecret).update(payload).digest();
    let supplied;
    try {
        supplied = Buffer.from(signature, "base64url");
    } catch {
        return null;
    }
    if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) return null;

    let claims;
    try {
        claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    } catch {
        return null;
    }
    if (!claims || typeof claims !== "object" || Array.isArray(claims) ||
        typeof claims.player_id !== "string" || !/^[a-f0-9]{24}$/i.test(claims.player_id) ||
        typeof claims.username !== "string" || !/^[A-Za-z0-9_]{3,24}$/.test(claims.username) ||
        !Number.isInteger(claims.expires_at) || claims.expires_at <= Math.floor(Date.now() / 1000) ||
        claims.expires_at > Math.floor(Date.now() / 1000) + 120 ||
        typeof claims.nonce !== "string" || !/^[a-f0-9]{32}$/.test(claims.nonce)) {
        return null;
    }
    if (usedTickets.has(claims.nonce)) return null;
    usedTickets.set(claims.nonce, claims.expires_at);
    return claims;
}

function publicPlayer(member) {
    return member.player;
}

function roomSummary(room) {
    return room.members.map(publicPlayer);
}

function broadcastRoom(room, message) {
    for (const member of room.members) send(member.client, message);
}

function broadcastRoomExcept(room, exceptClient, message) {
    for (const member of room.members) {
        if (member.client !== exceptClient) send(member.client, message);
    }
}

function removeClient(ws) {
    const client = clients.get(ws);
    if (!client) return;
    clients.delete(ws);
    const code = client.room;
    if (!code || !rooms.has(code)) return;
    const room = rooms.get(code);
    const slot = client.slot;

    if (slot === 0) {
        broadcastRoom(room, { type: "closed", message: "The room owner disconnected." });
        for (const member of room.members) {
            clients.delete(member.client);
            if (member.client && member.client !== ws && member.client.readyState !== WebSocket.CLOSED) {
                member.client.close(1000, "Room owner disconnected");
            }
        }
        rooms.delete(code);
        return;
    }

    if (room.started) {
        const host = room.members[0]?.client;
        send(host, { type: "remote-input", slot, input: {
            up: false, down: false, left: false, right: false, shoot: false, skill: false
        } });
        const member = room.members[slot];
        if (member) member.client = null;
        return;
    }

    room.members.splice(slot, 1);
    room.members.forEach((member, index) => {
        member.slot = index;
        const state = clients.get(member.client);
        if (state) state.slot = index;
    });
    room.host = room.members[0]?.client || null;
    for (const member of room.members) {
        send(member.client, { type: "room", code, slot: member.slot,
            host: member.slot === 0, players: roomSummary(room) });
    }
    if (room.members.length === 0) rooms.delete(code);
}

function normalizeInput(input) {
    if (!input || typeof input !== "object" || Array.isArray(input)) return null;
    return {
        up: Boolean(input.up), down: Boolean(input.down), left: Boolean(input.left),
        right: Boolean(input.right), shoot: Boolean(input.shoot), skill: Boolean(input.skill)
    };
}

function handleMessage(ws, message) {
    const client = clients.get(ws);
    if (!client?.ready) {
        const claims = message.type === "hello" ? verifyTicket(message.auth_ticket) : null;
        if (!claims) {
            sendError(ws, "Your sign-in expired or the room connection could not be verified. Please reconnect.");
            setTimeout(() => ws.close(1008, "Invalid room ticket"), 100);
            return;
        }
        const player = message.player && typeof message.player === "object" ? message.player : {};
        client.player = {
            username: claims.username,
            player_id: claims.player_id,
            movementMode: player.movementMode === "spin-drive" ? "spin-drive" : "turn-drive"
        };
        client.ready = true;
        send(ws, { type: "ready" });
        return;
    }

    if (message.type === "create") {
        if (client.room || [...rooms.values()].some(room =>
            room.members.some(member => member.player.player_id === client.player.player_id))) {
            return sendError(ws, "That player ID is already in a room.");
        }
        let code;
        do {
            code = crypto.randomBytes(3).toString("hex").toUpperCase();
        } while (rooms.has(code));
        client.room = code;
        client.slot = 0;
        const room = {
            host: ws,
            started: false,
            settings: null,
            members: [{ client: ws, slot: 0, player: client.player }]
        };
        rooms.set(code, room);
        send(ws, { type: "room", code, slot: 0, host: true, players: roomSummary(room) });
        return;
    }

    if (message.type === "join") {
        const code = String(message.code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
        const room = rooms.get(code);
        if (!room) return sendError(ws, "Room code not found.");
        if (room.started) return sendError(ws, "This match has already started.");
        if (room.members.length >= 4) return sendError(ws, "This room is full.");
        if ([...rooms.values()].some(entry => entry.members.some(member => member.player.player_id === client.player.player_id))) {
            return sendError(ws, "That player ID is already in a room.");
        }
        const slot = room.members.length;
        client.room = code;
        client.slot = slot;
        room.members.push({ client: ws, slot, player: client.player });
        for (const member of room.members) {
            send(member.client, { type: "room", code, slot: member.slot,
                host: member.slot === 0, players: roomSummary(room) });
        }
        return;
    }

    const code = client.room;
    const room = code ? rooms.get(code) : null;
    if (!room) return sendError(ws, "Create or join a room first.");
    const slot = client.slot;

    if (message.type === "start") {
        if (slot !== 0) return sendError(ws, "Only the room owner can start the match.");
        if (room.members.length < 2) return sendError(ws, "Invite at least one other player first.");
        const input = message.settings && typeof message.settings === "object" ? message.settings : {};
        const settings = {
            timeLimitMinutes: Math.max(1, Math.min(10, Number.parseInt(input.timeLimitMinutes, 10) || 5)),
            deathLimit: Math.max(1, Math.min(1000, Number.parseInt(input.deathLimit, 10) || 5)),
            skillAmount: Math.max(1, Math.min(50, Number.parseInt(input.skillAmount, 10) || 10)),
            category: input.category === "2v2" ? "2v2" : "ffa"
        };
        if (settings.category === "2v2" && room.members.length !== 4) {
            return sendError(ws, "2 vs 2 needs four connected players.");
        }
        room.started = true;
        room.settings = settings;
        broadcastRoom(room, { type: "start", players: roomSummary(room), settings });
        return;
    }

    if ((message.type === "input" || message.type === "spin") && room.started) {
        if (message.type === "spin") {
            send(room.host, { type: "remote-spin", slot });
        } else {
            const input = normalizeInput(message.input);
            if (input) send(room.host, { type: "remote-input", slot, input });
        }
        return;
    }

    if (message.type === "state" && slot === 0 && room.started) {
        if (message.state && typeof message.state === "object" && !Array.isArray(message.state)) {
            broadcastRoomExcept(room, ws, { type: "state", state: message.state });
        }
        return;
    }

    if (message.type === "leave") {
        removeClient(ws);
        ws.close(1000, "Left room");
    }
}

wss.on("connection", ws => {
    const client = { ready: false, player: null, room: null, slot: null, messageWindow: Date.now(), messageCount: 0 };
    clients.set(ws, client);
    ws.on("message", data => {
        const now = Date.now();
        if (now - client.messageWindow >= 1000) {
            client.messageWindow = now;
            client.messageCount = 0;
        }
        if (++client.messageCount > 80) {
            ws.close(1008, "Too many messages");
            return;
        }
        let message;
        try {
            message = JSON.parse(data.toString("utf8"));
        } catch {
            sendError(ws, "Invalid room message.");
            return;
        }
        if (!message || typeof message !== "object" || Array.isArray(message)) {
            sendError(ws, "Invalid room message.");
            return;
        }
        handleMessage(ws, message);
    });
    ws.on("close", () => removeClient(ws));
    ws.on("error", error => console.error("WebSocket error:", error.message));
});

const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
        if (ws.isAlive === false) {
            ws.terminate();
            continue;
        }
        ws.isAlive = false;
        ws.ping();
    }
    const now = Math.floor(Date.now() / 1000);
    for (const [nonce, expiry] of usedTickets) {
        if (expiry <= now) usedTickets.delete(nonce);
    }
}, 30000);
wss.on("connection", ws => {
    ws.isAlive = true;
    ws.on("pong", () => { ws.isAlive = true; });
});
wss.on("close", () => clearInterval(heartbeat));

server.listen(port, "0.0.0.0", () => {
    console.log(`Tank room service listening on port ${port}`);
});

function shutdown() {
    clearInterval(heartbeat);
    for (const ws of wss.clients) ws.close(1001, "Room service restarting");
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
