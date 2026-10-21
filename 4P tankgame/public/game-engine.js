(function () {
const WORLD = {
    width: 1200,
    height: 1200,
    tile: 40
};

const WALL_LAYOUT = "original";

const TANK_SIZE = 26;
const TANK_SPEED = 4.5;
const BULLET_SPEED = 9;
const SHOOT_DELAY = 350;

const MAX_HEALTH = 100;
const DAMAGE_PER_HIT = 25;
const POINTS_PER_HIT = 100;
const SHRINK_DURATION_TICKS = 200;
const SHRINK_SCALE = 0.55;
const ARMOR_DURATION_TICKS = 200;
const ARMOR_DAMAGE_REDUCTION = 0.5;
const SKILL_TYPES = ["rocket", "mine", "laser", "bounceLaser", "gatling", "bigBullet", "shrink", "armor", "hpKit"];
const SKILL_CHARGES = { rocket: 1, mine: 3, laser: 1, bounceLaser: 1, gatling: 1, bigBullet: 5, armor: 1, hpKit: 1 };
const BOUNCE_LASER_LENGTH = 840;
const BOUNCE_LASER_BOUNCES = 4;
const WEAPON_LABELS = {
    bullet: "bullet",
    rocket: "homing rocket",
    mine: "landmine",
    laser: "laser",
    bounceLaser: "bouncing laser",
    gatling: "gatling burst",
    bigBullet: "big bullet"
};
const COLORS = [
    "#42d9ff",
    "#ff6868",
    "#ffd34d",
    "#ad83ff"
];

let game = {
    started: false,
    over: false,
    overReason: null,
    winnerIndex: null,
    winnerTeamIndex: null,
    category: "ffa",
    timeLimitTicks: 0,
    timeRemainingTicks: 0,
    deathLimit: 5,
    skillAmount: 10,
    players: [],
    walls: [],
    bullets: [],
    pickups: [],
    mines: [],
    effects: []
};

function rectanglesOverlap(a, b) {
    return (
        a.x < b.x + b.w &&
        a.x + a.w > b.x &&
        a.y < b.y + b.h &&
        a.y + a.h > b.y
    );
}

function getTankSize(player) {
    return TANK_SIZE * (player?.shrinkTicks > 0 ? SHRINK_SCALE : 1);
}

function tankRectangle(x, y, size = TANK_SIZE) {
    return {
        x: x - size / 2,
        y: y - size / 2,
        w: size,
        h: size
    };
}

function isInsideWorld(x, y, player = null) {
    const half = getTankSize(player) / 2;

    return (
        x >= half &&
        y >= half &&
        x <= WORLD.width - half &&
        y <= WORLD.height - half
    );
}

function overlapsWall(x, y, walls, player = null) {
    const tank = tankRectangle(x, y, getTankSize(player));

    return walls.some(wall =>
        rectanglesOverlap(tank, wall)
    );
}

function segmentRectangleCollision(x1, y1, x2, y2, rect, padding) {
    const left = rect.x - padding;
    const right = rect.x + rect.w + padding;
    const top = rect.y - padding;
    const bottom = rect.y + rect.h + padding;
    const dx = x2 - x1;
    const dy = y2 - y1;
    let enterX = -Infinity;
    let exitX = Infinity;
    let enterY = -Infinity;
    let exitY = Infinity;
    let normalX = 0;
    let normalY = 0;

    if (Math.abs(dx) < 1e-9) {
        if (x1 < left || x1 > right) return null;
    } else if (dx > 0) {
        enterX = (left - x1) / dx;
        exitX = (right - x1) / dx;
        normalX = -1;
    } else {
        enterX = (right - x1) / dx;
        exitX = (left - x1) / dx;
        normalX = 1;
    }

    if (Math.abs(dy) < 1e-9) {
        if (y1 < top || y1 > bottom) return null;
    } else if (dy > 0) {
        enterY = (top - y1) / dy;
        exitY = (bottom - y1) / dy;
        normalY = -1;
    } else {
        enterY = (bottom - y1) / dy;
        exitY = (top - y1) / dy;
        normalY = 1;
    }

    const enter = Math.max(enterX, enterY);
    const exit = Math.min(exitX, exitY);
    if (enter > exit || exit < 0 || enter < 0 || enter > 1) return null;

    if (enterX > enterY + 1e-9) normalY = 0;
    else if (enterY > enterX + 1e-9) normalX = 0;

    return { time: enter, normalX, normalY };
}

function firstWallCollision(x1, y1, x2, y2, radius, walls) {
    let firstHit = null;

    for (const wall of walls) {
        const hit = segmentRectangleCollision(x1, y1, x2, y2, wall, radius);
        if (hit && (!firstHit || hit.time < firstHit.time)) {
            firstHit = hit;
        }
    }

    return firstHit;
}

function moveBulletWithBounces(bullet) {
    let remaining = 1;

    for (let collisionCount = 0; collisionCount < 4; collisionCount++) {
        const startX = bullet.x;
        const startY = bullet.y;
        const endX = startX + bullet.vx * remaining;
        const endY = startY + bullet.vy * remaining;
        const hit = firstWallCollision(
            startX, startY, endX, endY, bullet.radius, game.walls
        );

        if (!hit) {
            bullet.x = endX;
            bullet.y = endY;
            return true;
        }

        const maxBounces = bullet.type === "rocket" ? 1000000 : 3;
        if (bullet.bounces >= maxBounces) return false;

        bullet.x = startX + (endX - startX) * hit.time + hit.normalX * 0.05;
        bullet.y = startY + (endY - startY) * hit.time + hit.normalY * 0.05;
        if (hit.normalX) bullet.vx *= -1;
        if (hit.normalY) bullet.vy *= -1;
        bullet.angle = Math.atan2(bullet.vy, bullet.vx);
        bullet.bounces++;
        remaining *= 1 - hit.time;
        if (remaining < 1e-4) return true;
    }

    return true;
}

function findRocketPath(rocket, target) {
    const columns = Math.ceil(WORLD.width / WORLD.tile);
    const rows = Math.ceil(WORLD.height / WORLD.tile);
    const cellCount = columns * rows;
    const cellX = index => (index % columns) * WORLD.tile + WORLD.tile / 2;
    const cellY = index => Math.floor(index / columns) * WORLD.tile + WORLD.tile / 2;
    const clear = new Uint8Array(cellCount);
    const clearance = rocket.radius + 2;

    for (let index = 0; index < cellCount; index++) {
        const x = cellX(index);
        const y = cellY(index);
        const box = { x: x - clearance, y: y - clearance, w: clearance * 2, h: clearance * 2 };
        clear[index] = game.walls.some(wall => rectanglesOverlap(box, wall)) ? 0 : 1;
    }

    let start = -1;
    let nearestStartDistance = Infinity;
    for (let index = 0; index < cellCount; index++) {
        if (!clear[index] || firstWallCollision(rocket.x, rocket.y, cellX(index), cellY(index), rocket.radius, game.walls)) continue;
        const distance = Math.hypot(cellX(index) - rocket.x, cellY(index) - rocket.y);
        if (distance < nearestStartDistance) {
            nearestStartDistance = distance;
            start = index;
        }
    }
    if (start < 0) return null;

    const previous = new Int32Array(cellCount);
    previous.fill(-1);
    const visited = new Uint8Array(cellCount);
    const queue = new Int32Array(cellCount);
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    visited[start] = 1;
    const offsets = [-columns, 1, columns, -1];

    while (head < tail) {
        const current = queue[head++];
        const row = Math.floor(current / columns);
        const column = current % columns;
        for (const offset of offsets) {
            const next = current + offset;
            if (next < 0 || next >= cellCount || visited[next] || !clear[next]) continue;
            if (offset === 1 && column === columns - 1) continue;
            if (offset === -1 && column === 0) continue;
            visited[next] = 1;
            previous[next] = current;
            queue[tail++] = next;
        }
    }

    const targetColumn = Math.max(0, Math.min(columns - 1, Math.floor(target.x / WORLD.tile)));
    const targetRow = Math.max(0, Math.min(rows - 1, Math.floor(target.y / WORLD.tile)));
    const targetCell = targetRow * columns + targetColumn;
    // Prefer the target's own tile whenever it is reachable. A nearer visible tile
    // on the rocket's side of a wall can otherwise become a dead-end destination.
    let goal = visited[targetCell] ? targetCell : -1;
    let nearestTargetDistance = Infinity;
    if (goal < 0) {
        for (let index = 0; index < cellCount; index++) {
            if (!visited[index] || firstWallCollision(cellX(index), cellY(index), target.x, target.y, rocket.radius + 1, game.walls)) continue;
            const distance = Math.hypot(cellX(index) - target.x, cellY(index) - target.y);
            if (distance < nearestTargetDistance) {
                nearestTargetDistance = distance;
                goal = index;
            }
        }
    }
    if (goal < 0) {
        for (let index = 0; index < cellCount; index++) {
            if (!visited[index]) continue;
            const distance = Math.hypot(cellX(index) - target.x, cellY(index) - target.y);
            if (distance < nearestTargetDistance) {
                nearestTargetDistance = distance;
                goal = index;
            }
        }
    }
    if (goal < 0) return null;

    const path = [];
    for (let index = goal; index !== -1; index = previous[index]) {
        path.push({ x: cellX(index), y: cellY(index) });
        if (index === start) break;
    }
    path.reverse();
    return path;
}

function updateHomingRocket(rocket, target) {
    if (!target) return false;

    if (!rocket.path || rocket.pathRefreshTicks <= 0 || rocket.pathTargetIndex !== target.index) {
        rocket.path = findRocketPath(rocket, target);
        rocket.pathIndex = 0;
        rocket.pathTargetIndex = target.index;
        rocket.pathRefreshTicks = 10;
    } else {
        rocket.pathRefreshTicks--;
    }

    let waypoint = null;
    if (rocket.path?.length) {
        for (let index = rocket.path.length - 1; index >= rocket.pathIndex; index--) {
            const candidate = rocket.path[index];
            if (!firstWallCollision(rocket.x, rocket.y, candidate.x, candidate.y, rocket.radius + 1, game.walls)) {
                rocket.pathIndex = index;
                waypoint = candidate;
                break;
            }
        }
    }
    // If pathfinding cannot currently produce a waypoint (for example, when
    // the rocket is close to a wall), keep steering toward the target. The
    // safe-step search below will choose a wall-free direction around it.
    if (!waypoint) {
        waypoint = target;
        rocket.path = null;
        rocket.pathRefreshTicks = 0;
    }

    if (rocket.path && rocket.pathIndex >= rocket.path.length - 1 &&
        !firstWallCollision(rocket.x, rocket.y, target.x, target.y, rocket.radius + 1, game.walls)) {
        waypoint = target;
    }

    const dx = waypoint.x - rocket.x;
    const dy = waypoint.y - rocket.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 1 && rocket.path && rocket.pathIndex < rocket.path.length - 1) {
        rocket.pathIndex++;
        return updateHomingRocket(rocket, target);
    }

    const desiredAngle = Math.atan2(dy, dx);
    const angleDifference = Math.atan2(
        Math.sin(desiredAngle - rocket.angle),
        Math.cos(desiredAngle - rocket.angle)
    );
    const turnRate = 0.15;
    let nextAngle = distance <= rocket.speed
        ? desiredAngle
        : rocket.angle + Math.max(-turnRate, Math.min(turnRate, angleDifference));
    let step = distance <= rocket.speed ? distance : rocket.speed;
    let nextX = rocket.x + Math.cos(nextAngle) * step;
    let nextY = rocket.y + Math.sin(nextAngle) * step;

    // If the smooth turn would clip a wall, steer along the clear waypoint segment.
    if (firstWallCollision(rocket.x, rocket.y, nextX, nextY, rocket.radius, game.walls)) {
        nextAngle = desiredAngle;
        step = Math.min(rocket.speed, distance);
        nextX = rocket.x + Math.cos(nextAngle) * step;
        nextY = rocket.y + Math.sin(nextAngle) * step;
    }

    // A desired path segment can become blocked between path refreshes as the
    // target moves. Probe nearby headings and take the closest clear step so
    // the rocket routes around the obstacle instead of freezing in place.
    if (firstWallCollision(rocket.x, rocket.y, nextX, nextY, rocket.radius, game.walls)) {
        rocket.path = null;
        rocket.pathRefreshTicks = 0;
        let safeStep = null;
        for (let offset = 1; offset <= 16 && !safeStep; offset++) {
            const angles = offset === 16
                ? [desiredAngle + Math.PI]
                : [desiredAngle + offset * Math.PI / 16, desiredAngle - offset * Math.PI / 16];
            for (const angle of angles) {
                const candidateX = rocket.x + Math.cos(angle) * rocket.speed;
                const candidateY = rocket.y + Math.sin(angle) * rocket.speed;
                if (!firstWallCollision(rocket.x, rocket.y, candidateX, candidateY, rocket.radius, game.walls)) {
                    safeStep = { angle, x: candidateX, y: candidateY };
                    break;
                }
            }
        }
        if (!safeStep) return false;
        nextAngle = safeStep.angle;
        nextX = safeStep.x;
        nextY = safeStep.y;
    }

    rocket.angle = nextAngle;
    rocket.x = nextX;
    rocket.y = nextY;
    return true;
}

function overlapsOtherPlayer(x, y, players, excludedIndex = -1, movingPlayer = null) {
    return players.some(player => {
        if (player.index === excludedIndex || player.eliminated) {
            return false;
        }

        return rectanglesOverlap(
            tankRectangle(x, y, getTankSize(movingPlayer)),
            tankRectangle(player.x, player.y, getTankSize(player))
        );
    });
}

function createOriginalWalls() {
    const walls = [];
    const tile = WORLD.tile;
    const wallWidth = 6;
    const mapColumns = Math.floor(WORLD.width / tile);
    const mapRows = Math.floor(WORLD.height / tile);

    walls.push(
        { x: 0, y: 0, w: WORLD.width, h: 10, kind: "line" },
        { x: 0, y: WORLD.height - 10, w: WORLD.width, h: 10, kind: "line" },
        { x: 0, y: 0, w: 10, h: WORLD.height, kind: "line" },
        { x: WORLD.width - 10, y: 0, w: 10, h: WORLD.height, kind: "line" }
    );

    const horizontalRuns = [
        [2, 4, 4],
        [2, 14, 2],
        [2, 22, 4],
        [4, 2, 4],
        [4, 12, 2],
        [4, 16, 2],
        [4, 24, 4],
        [6, 5, 5],
        [6, 20, 4],
        [8, 4, 4],
        [8, 12, 2],
        [8, 16, 2],
        [8, 22, 4],
        [10, 8, 2],
        [10, 20, 2],
        [12, 4, 2],
        [12, 14, 2],
        [12, 24, 2],
        [14, 4, 2],
        [14, 10, 2],
        [14, 18, 2],
        [14, 24, 2],
        [16, 4, 2],
        [16, 10, 2],
        [16, 18, 2],
        [16, 24, 2],
        [18, 4, 2],
        [18, 14, 2],
        [18, 24, 2],
        [20, 8, 2],
        [20, 20, 2],
        [22, 4, 4],
        [22, 12, 2],
        [22, 16, 2],
        [22, 22, 4],
        [24, 6, 4],
        [24, 20, 4],
        [26, 2, 4],
        [26, 12, 2],
        [26, 16, 2],
        [26, 24, 4],
        [28, 4, 4],
        [28, 14, 2],
        [28, 22, 4]
    ];
    const verticalRuns = [
        [2, 2, 4],
        [2, 8, 4],
        [2, 18, 4],
        [2, 24, 4],
        [4, 14, 2],
        [8, 8, 2],
        [8, 12, 2],
        [8, 16, 2],
        [8, 20, 2],
        [10, 0, 4],
        [10, 14, 2],
        [10, 26, 4],
        [12, 6, 2],
        [12, 10, 2],
        [12, 18, 2],
        [12, 22, 2],
        [14, 14, 2],
        [16, 14, 2],
        [18, 6, 2],
        [18, 10, 2],
        [18, 18, 2],
        [18, 22, 2],
        [20, 0, 4],
        [20, 14, 2],
        [20, 26, 4],
        [22, 8, 2],
        [22, 12, 2],
        [22, 16, 2],
        [22, 20, 2],
        [26, 14, 2],
        [28, 2, 4],
        [28, 8, 4],
        [28, 18, 4],
        [28, 24, 4]
    ];

    for (const [row, firstColumn, length] of horizontalRuns) {
        const scaledLength = Math.min(
            mapColumns - firstColumn,
            length
        );
        walls.push({
            x: firstColumn * tile,
            y: row * tile - wallWidth / 2,
            w: scaledLength * tile,
            h: wallWidth,
            kind: "line"
        });
    }
    for (const [column, firstRow, length] of verticalRuns) {
        const scaledLength = Math.min(
            mapRows - firstRow,
            length
        );
        walls.push({
            x: column * tile - wallWidth / 2,
            y: firstRow * tile,
            w: wallWidth,
            h: scaledLength * tile,
            kind: "line"
        });
    }
    return walls;
}

function createSpacedWalls() {
    const walls = [
        { x: 0, y: 0, w: WORLD.width, h: 10, kind: "line" },
        { x: 0, y: WORLD.height - 10, w: WORLD.width, h: 10, kind: "line" },
        { x: 0, y: 0, w: 10, h: WORLD.height, kind: "line" },
        { x: WORLD.width - 10, y: 0, w: 10, h: WORLD.height, kind: "line" }
    ];
    const tile = WORLD.tile;
    const wallWidth = 6;
    const mapRows = Math.floor(WORLD.height / tile);
    const mapColumns = Math.floor(WORLD.width / tile);

    for (let rowIndex = 0, row = 2; row < mapRows - 1; rowIndex++, row += 4) {
        const firstColumn = rowIndex % 2 === 0 ? 1 : 3;
        for (let column = firstColumn; column + 2 <= mapColumns - 1; column += 4) {
            walls.push({
                x: column * tile,
                y: row * tile - wallWidth / 2,
                w: 2 * tile,
                h: wallWidth,
                kind: "line"
            });
        }
    }

    for (let columnIndex = 0, column = 3; column < mapColumns - 1; columnIndex++, column += 4) {
        const firstRow = columnIndex % 2 === 0 ? 1 : 3;
        for (let row = firstRow; row + 2 <= mapRows - 1; row += 4) {
            walls.push({
                x: column * tile - wallWidth / 2,
                y: row * tile,
                w: wallWidth,
                h: 2 * tile,
                kind: "line"
            });
        }
    }

    return walls;
}

function createWalls() {
    return WALL_LAYOUT === "original" ? createOriginalWalls() : createSpacedWalls();
}

function createSkillPickups(walls, amount, players = []) {
    const availableTiles = getEmptyFloorTiles(walls).filter(tile =>
        !overlapsOtherPlayer(tile.x, tile.y, players)
    );
    const pickups = [];

    for (let index = 0; index < Math.min(amount, availableTiles.length); index++) {
        const tileIndex = Math.floor(Math.random() * availableTiles.length);
        const [tile] = availableTiles.splice(tileIndex, 1);
        pickups.push({
            id: index,
            x: tile.x,
            y: tile.y,
            skill: null,
            lifeTicks: 0,
            respawnTicks: Math.floor(Math.random() * 200) + 1
        });
    }

    return pickups;
}

function getEmptyFloorTiles(walls) {
    const tile = WORLD.tile;
    const columns = Math.floor(WORLD.width / tile);
    const rows = Math.floor(WORLD.height / tile);
    const emptyTiles = [];

    for (let r = 1; r < rows - 1; r++) {
        for (let c = 1; c < columns - 1; c++) {
            const centerX = c * tile + tile / 2;
            const centerY = r * tile + tile / 2;
            const tankRect = tankRectangle(centerX, centerY);

            const overlapsWall = walls.some(wall =>
                rectanglesOverlap(tankRect, wall)
            );

            if (!overlapsWall) {
                emptyTiles.push({
                    col: c,
                    row: r,
                    x: centerX,
                    y: centerY
                });
            }
        }
    }

    return emptyTiles;
}

function randomPickupSpawnTile(pickup) {
    const activePickupTiles = game.pickups
        .filter(other => other !== pickup && other.skill)
        .map(other => other);
    const openTiles = getEmptyFloorTiles(game.walls).filter(tile =>
        !overlapsOtherPlayer(tile.x, tile.y, game.players) &&
        activePickupTiles.every(other => Math.hypot(other.x - tile.x, other.y - tile.y) >= WORLD.tile)
    );
    const choices = openTiles.length ? openTiles : getEmptyFloorTiles(game.walls);
    return choices[Math.floor(Math.random() * choices.length)] || null;
}

function randomPickupDelay() {
    return Math.floor(Math.random() * 200) + 1;
}

function findRandomSafeSpawn(
    walls,
    otherPlayers = [],
    excludedSpawns = [],
    preferDistanceFromPlayers = false
) {
    const emptyTiles = getEmptyFloorTiles(walls);

    if (emptyTiles.length === 0) {
        return {
            x: WORLD.width / 2,
            y: WORLD.height / 2,
            angle: 0
        };
    }

    const nonExcludedTiles = emptyTiles.filter(tile =>
        excludedSpawns.every(spawn => tile.x !== spawn.x || tile.y !== spawn.y)
    );
    let candidates = nonExcludedTiles.length > 0 ? nonExcludedTiles : emptyTiles;

    if (otherPlayers.length > 0) {
        const unoccupiedCandidates = candidates.filter(tile =>
            !overlapsOtherPlayer(tile.x, tile.y, otherPlayers)
        );
        if (unoccupiedCandidates.length > 0) {
            candidates = unoccupiedCandidates;
        }
    }

    if (preferDistanceFromPlayers && otherPlayers.length > 0) {
        const distantCandidates = candidates.filter(tile =>
            otherPlayers.every(player =>
                Math.hypot(player.x - tile.x, player.y - tile.y) >= 140
            )
        );

        if (distantCandidates.length > 0) {
            candidates = distantCandidates;
        }
    }

    const chosen = candidates[Math.floor(Math.random() * candidates.length)];

    const directions = [
        { angle: 0, dc: 1, dr: 0 },
        { angle: Math.PI / 2, dc: 0, dr: 1 },
        { angle: Math.PI, dc: -1, dr: 0 },
        { angle: -Math.PI / 2, dc: 0, dr: -1 }
    ];

    const openDirections = directions.filter(dir => {
        const nextC = chosen.col + dir.dc;
        const nextR = chosen.row + dir.dr;
        return emptyTiles.some(t => t.col === nextC && t.row === nextR);
    });

    const chosenDir = openDirections.length > 0
        ? openDirections[Math.floor(Math.random() * openDirections.length)]
        : directions[Math.floor(Math.random() * directions.length)];

    return {
        x: chosen.x,
        y: chosen.y,
        angle: chosenDir.angle
    };
}

function createPlayer(player, index, spawn, category = "ffa") {
    return {
        index: index,
        player_id: player.player_id,
        username: player.username,
        movementMode: ["turn-drive", "spin-drive"].includes(player.movementMode) ? player.movementMode : "direct",
        spinDirection: 1,

        x: spawn.x,
        y: spawn.y,
        angle: spawn.angle,
        initialSpawn: { x: spawn.x, y: spawn.y },
        lastSpawn: { x: spawn.x, y: spawn.y },

        teamIndex: category === "2v2" ? Math.floor(index / 2) : null,
        color: category === "2v2" ? COLORS[Math.floor(index / 2)] : COLORS[index],
        score: 0,
        kills: 0,
        wins: Number(player.wins || 0),
        deaths: 0,
        eliminated: false,

        health: MAX_HEALTH,
        shrinkTicks: 0,
        armorTicks: 0,
        invulnerableTicks: 40,
        skill: null,
        skillUses: 0,
        skillWasDown: false,
        burst: null,

        keys: {
            up: false,
            down: false,
            left: false,
            right: false,
            shoot: false,
            skill: false
        },

        lastShot: 0
    };
}

function endMatch(reason) {
    if (game.over) return;
    game.over = true;
    game.overReason = reason;
    const contenders = game.players.filter(player => !player.eliminated);
    let winnerTeamIndex = null;
    if (game.category === "2v2") {
        const teamStats = [0, 1].map(teamIndex => {
            const players = game.players.filter(player => player.teamIndex === teamIndex);
            return {
                teamIndex,
                players,
                alive: players.filter(player => !player.eliminated).length,
                kills: players.reduce((sum, player) => sum + player.kills, 0),
                score: players.reduce((sum, player) => sum + player.score, 0),
                deaths: players.reduce((sum, player) => sum + player.deaths, 0)
            };
        });
        const aliveTeams = teamStats.filter(team => team.alive > 0);
        const rankedTeams = [...(aliveTeams.length ? aliveTeams : teamStats)].sort((a, b) =>
            b.kills - a.kills || b.score - a.score || a.deaths - b.deaths || b.alive - a.alive
        );
        const first = rankedTeams[0];
        const second = rankedTeams[1];
        if (first && (!second || first.kills !== second.kills || first.score !== second.score ||
            first.deaths !== second.deaths || first.alive !== second.alive)) {
            winnerTeamIndex = first.teamIndex;
        }
        if (reason === "last_team" && winnerTeamIndex !== null) {
            for (const player of game.players.filter(player => player.teamIndex === winnerTeamIndex && !player.eliminated)) {
                player.score += 1000;
            }
        }
    }
    const standings = contenders.length ? contenders : game.players;
    const rankedPlayers = [...standings].sort((a, b) =>
        b.kills - a.kills || b.score - a.score
    );
    const topPlayers = rankedPlayers.filter(player =>
        player.kills === rankedPlayers[0]?.kills && player.score === rankedPlayers[0]?.score
    );
    const winner = game.category === "2v2"
        ? game.players.filter(player => player.teamIndex === winnerTeamIndex).sort((a, b) =>
            b.kills - a.kills || b.score - a.score
        )[0] || null
        : topPlayers.length === 1 ? topPlayers[0] : null;
    game.winnerTeamIndex = winnerTeamIndex;
    if (reason === "last_player" && winner) {
        winner.score += 1000;
        console.log(`${winner.username} earned 1,000 points for being the last tank standing.`);
    }
    game.winnerIndex = winner ? winner.index : null;
    for (const player of game.players) {
        player.keys = { up: false, down: false, left: false, right: false, shoot: false, skill: false };
    }
}

function respawnPlayer(target, shooter = null, weapon = "bullet") {
    const deathLocation = {
        x: target.x,
        y: target.y
    };

    target.deaths++;
    const eliminated = target.deaths >= game.deathLimit;
    target.health = eliminated ? 0 : MAX_HEALTH;
    target.skill = null;
    target.skillUses = 0;
    target.shrinkTicks = 0;
    target.armorTicks = 0;
    target.burst = null;
    target.lastShot = 0;
    if (shooter && shooter.index !== target.index) {
        shooter.kills++;
    }

    if (eliminated) {
        target.eliminated = true;
        target.keys = { up: false, down: false, left: false, right: false, shoot: false, skill: false };
        emitLocal("player:eliminated", {
            victimIndex: target.index, victimName: target.username, victimColor: target.color,
            killerIndex: shooter ? shooter.index : null, killerName: shooter ? shooter.username : null,
            killerColor: shooter ? shooter.color : "#ffffff",
            weapon: WEAPON_LABELS[weapon] || WEAPON_LABELS.bullet,
            deathX: deathLocation.x, deathY: deathLocation.y, spawnX: null, spawnY: null,
            deaths: target.deaths, deathLimit: game.deathLimit, eliminated: true
        });
        const remainingPlayers = game.players.filter(player => !player.eliminated);
        if (game.category === "2v2") {
            const activeTeams = new Set(remainingPlayers.map(player => player.teamIndex));
            if (activeTeams.size <= 1) endMatch(activeTeams.size === 1 ? "last_team" : "all_eliminated");
        } else if (remainingPlayers.length === 1) {
            endMatch("last_player");
        } else if (remainingPlayers.length === 0) {
            endMatch("all_eliminated");
        }
        return;
    }

    const otherPlayers = game.players.filter(
        player => player.index !== target.index && !player.eliminated
    );

    const spawn = findRandomSafeSpawn(
        game.walls,
        otherPlayers,
        [target.initialSpawn, target.lastSpawn]
    );

    target.x = spawn.x;
    target.y = spawn.y;
    target.angle = spawn.angle;
    target.lastSpawn = { x: spawn.x, y: spawn.y };

    target.invulnerableTicks = 50;

    target.lastShot = 0;
    target.skill = null;
    target.skillUses = 0;
    target.burst = null;

    console.log(
        `${target.username} was defeated by ${shooter ? shooter.username : "hazard"}! Respawned at random location: ` +
        `(${Math.round(target.x)}, ${Math.round(target.y)})`
    );

    emitLocal("player:eliminated", {
        victimIndex: target.index,
        victimName: target.username,
        victimColor: target.color,
        killerIndex: shooter ? shooter.index : null,
        killerName: shooter ? shooter.username : null,
        killerColor: shooter ? shooter.color : "#ffffff",
        weapon: WEAPON_LABELS[weapon] || WEAPON_LABELS.bullet,
        deathX: deathLocation.x,
        deathY: deathLocation.y,
        spawnX: spawn.x,
        spawnY: spawn.y,
        deaths: target.deaths,
        deathLimit: game.deathLimit,
        eliminated: false
    });
}

function moveTank(player, dx, dy) {
    const nextX = player.x + dx;

    if (
        isInsideWorld(nextX, player.y, player) &&
        !overlapsWall(nextX, player.y, game.walls, player) &&
        !overlapsOtherPlayer(nextX, player.y, game.players, player.index, player)
    ) {
        player.x = nextX;
    }

    const nextY = player.y + dy;

    if (
        isInsideWorld(player.x, nextY, player) &&
        !overlapsWall(player.x, nextY, game.walls, player) &&
        !overlapsOtherPlayer(player.x, nextY, game.players, player.index, player)
    ) {
        player.y = nextY;
    }
}

function isTankPositionSafe(player, x, y) {
    return isInsideWorld(x, y, player) &&
        !overlapsWall(x, y, game.walls, player) &&
        !overlapsOtherPlayer(x, y, game.players, player.index, player);
}

function resolveTankGrowth(player) {
    if (isTankPositionSafe(player, player.x, player.y)) return;

    for (let radius = 2; radius <= 18; radius += 2) {
        for (let step = 0; step < 24; step++) {
            const angle = (step / 24) * Math.PI * 2;
            const x = player.x + Math.cos(angle) * radius;
            const y = player.y + Math.sin(angle) * radius;
            if (isTankPositionSafe(player, x, y)) {
                player.x = x;
                player.y = y;
                return;
            }
        }
    }

    const otherPlayers = game.players.filter(other =>
        other.index !== player.index && !other.eliminated
    );
    const spawn = findRandomSafeSpawn(
        game.walls,
        otherPlayers,
        [player.initialSpawn, player.lastSpawn]
    );
    player.x = spawn.x;
    player.y = spawn.y;
    player.angle = spawn.angle;
}

function createProjectile(player, angle, options = {}) {
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const speed = options.speed || BULLET_SPEED;
    const radius = options.radius || 4;
    const muzzleDistance = getTankSize(player) / 2 + radius + 2;
    let x = player.x + dx * muzzleDistance;
    let y = player.y + dy * muzzleDistance;
    let vx = dx * speed;
    let vy = dy * speed;
    let bounces = 0;

    const muzzleHit = firstWallCollision(
        player.x, player.y, x, y, radius, game.walls
    );
    if (muzzleHit) {
        x = player.x + (x - player.x) * muzzleHit.time + muzzleHit.normalX * 0.05;
        y = player.y + (y - player.y) * muzzleHit.time + muzzleHit.normalY * 0.05;
        if (muzzleHit.normalX) vx *= -1;
        if (muzzleHit.normalY) vy *= -1;
        bounces = 1;
    }

    game.bullets.push({
        x,
        y,
        vx,
        vy,
        angle: Math.atan2(vy, vx),
        speed,
        owner: player.index,
        color: player.color,
        type: options.type || "bullet",
        radius,
        damage: options.damage || DAMAGE_PER_HIT,
        life: options.life || 60,
        bounces,
        age: 0,
        launchTicks: options.launchTicks || 0
    });
    return true;
}

function fireBullet(player) {
    const now = Date.now();
    if (now - player.lastShot < SHOOT_DELAY) return;
    player.lastShot = now;
    createProjectile(player, player.angle);
}

function areTeammates(first, second) {
    return game.category === "2v2" && Boolean(first && second) && first.teamIndex !== null &&
        first.teamIndex !== undefined && first.teamIndex === second.teamIndex;
}

function applyDamage(target, shooter, damage, weapon = "bullet") {
    if (target.eliminated || target.invulnerableTicks > 0 || (shooter && areTeammates(target, shooter))) return false;

    const appliedDamage = target.armorTicks > 0
        ? Math.max(1, Math.ceil(damage * (1 - ARMOR_DAMAGE_REDUCTION)))
        : damage;
    target.health = Math.max(0, target.health - appliedDamage);
    if (shooter) awardPoints(shooter);
    if (target.health <= 0) respawnPlayer(target, shooter, weapon);
    return true;
}

function traceBounceLaser(x, y, angle) {
    const segments = [];
    let remainingLength = BOUNCE_LASER_LENGTH;
    let dx = Math.cos(angle);
    let dy = Math.sin(angle);

    for (let bounce = 0; bounce <= BOUNCE_LASER_BOUNCES && remainingLength > 0; bounce++) {
        const endX = x + dx * remainingLength;
        const endY = y + dy * remainingLength;
        const hit = firstWallCollision(x, y, endX, endY, 0, game.walls);
        const distance = hit ? remainingLength * hit.time : remainingLength;
        const segmentEndX = x + dx * distance;
        const segmentEndY = y + dy * distance;
        segments.push({ x1: x, y1: y, x2: segmentEndX, y2: segmentEndY });
        remainingLength -= distance;

        if (!hit || bounce === BOUNCE_LASER_BOUNCES) break;
        x = segmentEndX + hit.normalX * 0.01;
        y = segmentEndY + hit.normalY * 0.01;
        if (hit.normalX) dx *= -1;
        if (hit.normalY) dy *= -1;
    }

    return segments;
}

function damageAlongLaserSegments(segments, player, weapon) {
    for (const target of game.players) {
        if (target.index === player.index || areTeammates(target, player) || target.eliminated || target.invulnerableTicks > 0) continue;
        const tankRadius = getTankSize(target) / 2;
        const hit = segments.some(segment => {
            const dx = segment.x2 - segment.x1;
            const dy = segment.y2 - segment.y1;
            const lengthSquared = dx * dx + dy * dy;
            if (lengthSquared === 0) return false;
            const along = ((target.x - segment.x1) * dx + (target.y - segment.y1) * dy) / lengthSquared;
            if (along < 0 || along > 1) return false;
            const closestX = segment.x1 + dx * along;
            const closestY = segment.y1 + dy * along;
            return Math.hypot(target.x - closestX, target.y - closestY) <= tankRadius;
        });
        if (hit) applyDamage(target, player, MAX_HEALTH, weapon);
    }
}

function activateSkill(player) {
    const skill = player.skill;
    if (!skill) return;

    player.skillUses = Math.max(0, player.skillUses - 1);
    if (player.skillUses === 0) player.skill = null;

    if (skill === "mine") {
        const behindX = player.x - Math.cos(player.angle) * 22;
        const behindY = player.y - Math.sin(player.angle) * 22;
        game.mines.push({
            x: behindX,
            y: behindY,
            owner: player.index,
            color: player.color,
            armTicks: 10,
            life: 600
        });
    } else if (skill === "laser") {
        const dx = Math.cos(player.angle);
        const dy = Math.sin(player.angle);
        const endX = player.x + dx * Math.max(WORLD.width, WORLD.height);
        const endY = player.y + dy * Math.max(WORLD.width, WORLD.height);

        game.effects.push({
            type: "laser",
            x1: player.x,
            y1: player.y,
            x2: endX,
            y2: endY,
            color: player.color,
            life: 6
        });

        for (const target of game.players) {
            if (target.index === player.index || target.eliminated || target.invulnerableTicks > 0) continue;
            const along = (target.x - player.x) * dx + (target.y - player.y) * dy;
            const across = Math.abs((target.x - player.x) * dy - (target.y - player.y) * dx);
            if (along > 0 && along < Math.max(WORLD.width, WORLD.height) && across <= getTankSize(target) / 2) {
                applyDamage(target, player, MAX_HEALTH, "laser");
            }
        }
    } else if (skill === "bounceLaser") {
        const segments = traceBounceLaser(player.x, player.y, player.angle);
        game.effects.push({
            type: "bounceLaser",
            segments,
            color: player.color,
            life: 6
        });
        damageAlongLaserSegments(segments, player, "bounceLaser");
    } else if (skill === "gatling") {
        createProjectile(player, player.angle, { type: "gatling", radius: 3, speed: 11 });
        player.burst = { angle: player.angle, shotsLeft: 7, cooldown: 2 };
    } else if (skill === "bigBullet") {
        createProjectile(player, player.angle, {
            type: "bigBullet",
            radius: 6,
            damage: DAMAGE_PER_HIT
        });
    } else if (skill === "rocket") {
        createProjectile(player, player.angle, {
            type: "rocket",
            speed: 6.5,
            radius: 7,
            damage: 50,
            life: 200,
            launchTicks: 30
        });
    } else if (skill === "shrink") {
        player.shrinkTicks = SHRINK_DURATION_TICKS;
    } else if (skill === "armor") {
        player.armorTicks = ARMOR_DURATION_TICKS;
    } else if (skill === "hpKit") {
        player.health = Math.min(MAX_HEALTH, player.health + 50);
    }
}

function updatePickups() {
    for (const pickup of game.pickups) {
        if (pickup.respawnTicks > 0) {
            pickup.respawnTicks--;
            if (pickup.respawnTicks === 0) {
                const tile = randomPickupSpawnTile(pickup);
                if (tile) {
                    pickup.x = tile.x;
                    pickup.y = tile.y;
                }
                pickup.skill = SKILL_TYPES[Math.floor(Math.random() * SKILL_TYPES.length)];
                pickup.lifeTicks = 200;
            }
            continue;
        }

        if (!pickup.skill) continue;

        pickup.lifeTicks--;
        if (pickup.lifeTicks <= 0) {
            pickup.skill = null;
            pickup.respawnTicks = randomPickupDelay();
            continue;
        }

        const collector = game.players.find(player =>
            !player.eliminated && !player.skill && Math.hypot(player.x - pickup.x, player.y - pickup.y) < 28
        );
        if (collector) {
            collector.skill = pickup.skill;
            collector.skillUses = SKILL_CHARGES[pickup.skill] || 1;
            pickup.skill = null;
            pickup.respawnTicks = randomPickupDelay();
        }
    }
}

function updateMines() {
    const remainingMines = [];
    for (const mine of game.mines) {
        mine.life--;
        if (mine.armTicks > 0) mine.armTicks--;
        let exploded = false;

        if (mine.armTicks === 0) {
            for (const target of game.players) {
                if (target.index === mine.owner || target.eliminated || target.invulnerableTicks > 0) continue;
                const owner = game.players.find(player => player.index === mine.owner);
                if (owner && areTeammates(owner, target)) continue;
                if (Math.hypot(target.x - mine.x, target.y - mine.y) <= 36) {
                    applyDamage(target, owner, 100, "mine");
                    game.effects.push({ type: "blast", x: mine.x, y: mine.y, color: mine.color, life: 10 });
                    exploded = true;
                    break;
                }
            }
        }

        if (!exploded && mine.life > 0) remainingMines.push(mine);
    }
    game.mines = remainingMines;
}

function awardPoints(player) {
    if (!player) {
        return;
    }

    player.score += POINTS_PER_HIT;
}

function updateGame() {
    if (!game.started || game.over) {
        return;
    }

    if (game.timeRemainingTicks > 0) game.timeRemainingTicks--;
    if (game.timeRemainingTicks <= 0) {
        endMatch("time");
        return;
    }

    for (const player of game.players) {
        if (player.eliminated) continue;
        if (player.shrinkTicks > 0) {
            player.shrinkTicks--;
            if (player.shrinkTicks === 0) resolveTankGrowth(player);
        }
        if (player.armorTicks > 0) player.armorTicks--;
        if (player.invulnerableTicks > 0) {
            player.invulnerableTicks--;
        }

        const keys = player.keys;

        if (player.movementMode === "turn-drive") {
            const turnSpeed = 0.0975;
            if (keys.left) player.angle -= turnSpeed;
            if (keys.right) player.angle += turnSpeed;
            const direction = Number(keys.up) - Number(keys.down);
            if (direction !== 0) {
                moveTank(
                    player,
                    Math.cos(player.angle) * TANK_SPEED * direction,
                    Math.sin(player.angle) * TANK_SPEED * direction
                );
            }
        } else if (player.movementMode === "spin-drive") {
            if (!keys.up) player.angle += 0.0975 * player.spinDirection;
            const direction = Number(keys.up) - Number(keys.down);
            if (direction !== 0) {
                moveTank(
                    player,
                    Math.cos(player.angle) * TANK_SPEED * direction,
                    Math.sin(player.angle) * TANK_SPEED * direction
                );
            }
        } else {
            let dx = 0;
            let dy = 0;
            if (keys.up) dy -= 1;
            if (keys.down) dy += 1;
            if (keys.left) dx -= 1;
            if (keys.right) dx += 1;

            if (dx !== 0 || dy !== 0) {
                const length = Math.hypot(dx, dy);
                dx = (dx / length) * TANK_SPEED;
                dy = (dy / length) * TANK_SPEED;
                player.angle = Math.atan2(dy, dx);
                moveTank(player, dx, dy);
            }
        }

        if (keys.skill && !player.skillWasDown) activateSkill(player);
        player.skillWasDown = keys.skill;

        if (keys.shoot && player.movementMode !== "spin-drive") {
            fireBullet(player);
        }

        if (player.burst) {
            player.burst.cooldown--;
            if (player.burst.cooldown <= 0 && player.burst.shotsLeft > 0) {
                const spreadStep = 4 - player.burst.shotsLeft;
                const spread = (spreadStep % 2 === 0 ? 1 : -1) * Math.ceil(spreadStep / 2) * 0.045;
                createProjectile(player, player.burst.angle + spread, {
                    type: "gatling",
                    radius: 3,
                    speed: 11
                });
                player.burst.shotsLeft--;
                player.burst.cooldown = 2;
                if (player.burst.shotsLeft === 0) player.burst = null;
            }
        }
    }

    updatePickups();
    updateMines();

    for (const effect of game.effects) effect.life--;
    game.effects = game.effects.filter(effect => effect.life > 0);

    const remainingBullets = [];

    for (const bullet of game.bullets) {
        bullet.life--;

        if (bullet.life <= 0) continue;

        if (bullet.type === "rocket" && bullet.age >= bullet.launchTicks) {
            let target = game.players.find(player =>
                player.index === bullet.targetIndex && player.index !== bullet.owner && !player.eliminated &&
                !areTeammates(player, game.players[bullet.owner])
            );
            if (!target) {
                target = game.players
                    .filter(player => player.index !== bullet.owner && !player.eliminated &&
                        !areTeammates(player, game.players[bullet.owner]))
                    .sort((a, b) =>
                        Math.hypot(a.x - bullet.x, a.y - bullet.y) -
                        Math.hypot(b.x - bullet.x, b.y - bullet.y)
                    )[0];
                bullet.targetIndex = target?.index ?? null;
                bullet.path = null;
            }

            if (target) {
                updateHomingRocket(bullet, target);
                game.effects.push({
                    type: "rocketSmoke",
                    x: bullet.x,
                    y: bullet.y,
                    color: target.color,
                    life: 14,
                    radius: 3 + Math.random() * 2
                });
            } else if (!moveBulletWithBounces(bullet)) {
                continue;
            }
        } else {
            if (bullet.type === "rocket") bullet.age++;
            if (!moveBulletWithBounces(bullet)) continue;
        }

        if (
            bullet.x < -bullet.radius ||
            bullet.y < -bullet.radius ||
            bullet.x > WORLD.width + bullet.radius ||
            bullet.y > WORLD.height + bullet.radius
        ) {
            continue;
        }

        let bulletHitPlayer = false;

        for (const target of game.players) {
            const shooter = game.players.find(player => player.index === bullet.owner);
            if (target.index === bullet.owner || target.eliminated || (shooter && areTeammates(target, shooter))) {
                continue;
            }

            if (target.invulnerableTicks && target.invulnerableTicks > 0) {
                continue;
            }

            const bulletBox = {
                x: bullet.x - bullet.radius,
                y: bullet.y - bullet.radius,
                w: bullet.radius * 2,
                h: bullet.radius * 2
            };

            if (
                rectanglesOverlap(
                    bulletBox,
                    tankRectangle(target.x, target.y, getTankSize(target))
                )
            ) {
                applyDamage(target, shooter, bullet.damage, bullet.type);

                bulletHitPlayer = true;
                break;
            }
        }

        if (!bulletHitPlayer) {
            remainingBullets.push(bullet);
        }
    }

    game.bullets = remainingBullets;
}


function getPublicState() {
    return {
        started: game.started,
        over: game.over,
        overReason: game.overReason,
        winnerIndex: game.winnerIndex,
        winnerTeamIndex: game.winnerTeamIndex,
        category: game.category,
        timeRemainingSeconds: Math.ceil(game.timeRemainingTicks / 20),
        timeLimitSeconds: game.timeLimitTicks / 20,
        deathLimit: game.deathLimit,
        skillAmount: game.skillAmount,

        world: WORLD,

        players: game.players.map(player => ({
            index: player.index,
            player_id: player.player_id,
            username: player.username,

            x: player.x,
            y: player.y,
            angle: player.angle,

            color: player.color,
            teamIndex: player.teamIndex,
            score: player.score,
            kills: player.kills,
            wins: player.wins,
            health: player.health,
            shrunk: player.shrinkTicks > 0,
            armored: player.armorTicks > 0,
            armorSeconds: Math.ceil(player.armorTicks / 20),
            deaths: player.deaths,
            eliminated: player.eliminated,
            invulnerable: (player.invulnerableTicks || 0) > 0,
            skill: player.skill,
            skillUses: player.skillUses
        })),

        walls: game.walls,
        bullets: game.bullets.map(({
            path,
            pathIndex,
            pathTargetIndex,
            pathRefreshTicks,
            targetIndex,
            age,
            launchTicks,
            ...bullet
        }) => bullet),
        pickups: game.pickups.filter(pickup => pickup.skill),
        mines: game.mines,
        effects: game.effects
    };
}


function emitLocal(eventName, data) {
    window.dispatchEvent(new CustomEvent(`tank:${eventName}`, { detail: data }));
}

window.TankEngine = {
    start(request) {
        try {
            const players = Array.isArray(request) ? request : request?.players;
            const timeLimitMinutes = Number(Array.isArray(request) ? 5 : request?.timeLimitMinutes ?? 5);
            const deathLimit = Number(Array.isArray(request) ? 5 : request?.deathLimit ?? 5);
            const skillAmount = Number(Array.isArray(request) ? 10 : request?.skillAmount ?? 10);
            const category = Array.isArray(request) ? "ffa" : (request?.category === "2v2" ? "2v2" : "ffa");
            if (!Array.isArray(players) || players.length < 2 || players.length > 4) throw new Error("Choose between 2 and 4 players.");
            if (category === "2v2" && players.length !== 4) throw new Error("2 vs 2 needs exactly four players.");
            if (!Number.isInteger(timeLimitMinutes) || timeLimitMinutes < 1 || timeLimitMinutes > 10 ||
                !Number.isInteger(deathLimit) || deathLimit < 1 || deathLimit > 1000 ||
                !Number.isInteger(skillAmount) || skillAmount < 1 || skillAmount > 50) {
                throw new Error("Time must be 1–10 minutes, deaths 1–1,000, and skill crates 1–50.");
            }
            const uniqueIds = new Set(players.map(player => String(player.player_id)));
            if (uniqueIds.size !== players.length) throw new Error("Each player must have a different ID.");
            if (game.started && !game.over) endMatch("restart");
            const walls = createWalls();
            const spawnedPlayers = [];
            for (let i = 0; i < players.length; i++) {
                const spawn = findRandomSafeSpawn(walls, spawnedPlayers, [], true);
                spawnedPlayers.push(createPlayer(players[i], i, spawn, category));
            }
            game = {
                started: true, over: false, overReason: null, winnerIndex: null, winnerTeamIndex: null,
                category, timeLimitTicks: timeLimitMinutes * 60 * 20, timeRemainingTicks: timeLimitMinutes * 60 * 20,
                deathLimit, skillAmount, players: spawnedPlayers, walls, bullets: [],
                pickups: createSkillPickups(walls, skillAmount, spawnedPlayers), mines: [], effects: []
            };
            emitLocal("game:started");
            emitLocal("game:state", getPublicState());
        } catch (error) {
            emitLocal("game:error", { message: error.message || "Could not start the game. Please try again." });
        }
    },
    inputs(inputs) {
        if (!game.started || game.over || !Array.isArray(inputs)) return;
        for (let i = 0; i < 4; i++) {
            const player = game.players[i];
            const input = inputs[i];
            if (!player || !input) continue;
            player.keys = {
                up: Boolean(input.up), down: Boolean(input.down), left: Boolean(input.left),
                right: Boolean(input.right), shoot: Boolean(input.shoot), skill: Boolean(input.skill)
            };
        }
    },
    spinFire(index) {
        if (!game.started || game.over || !Number.isInteger(index)) return;
        const player = game.players[index];
        if (player && player.movementMode === "spin-drive") {
            player.spinDirection *= -1;
            fireBullet(player);
        }
    },
    leave() {
        game.over = true;
        game.started = false;
        for (const player of game.players) {
            player.keys = { up: false, down: false, left: false, right: false, shoot: false, skill: false };
        }
    }
};

setInterval(() => {
    updateGame();
    if (game.started) emitLocal("game:state", getPublicState());
}, 50);

})();
