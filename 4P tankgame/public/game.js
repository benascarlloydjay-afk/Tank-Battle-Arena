window.tankApi = {
    async saveMatchResults(results) {
        const response = await fetch("api/save-results.php", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ results })
        });
        if (!response.ok) {
            const result = await response.json().catch(() => ({}));
            throw new Error(result.error || "Could not save match results.");
        }
        return response.json();
    }
};

const loginScreen = document.getElementById("loginScreen");
const welcomeScreen = document.getElementById("welcomeScreen");
const playButton = document.getElementById("playButton");
const backToWelcomeButton = document.getElementById("backToWelcomeButton");
const gameScreen = document.getElementById("gameScreen");

const joinButton = document.getElementById("joinButton");
const restartButton = document.getElementById("restartButton");
const backToRegistrationButton = document.getElementById("backToRegistrationButton");
const resultsBackButton = document.getElementById("resultsBackButton");
const playAgainButton = document.getElementById("playAgainButton");
const matchTimer = document.getElementById("matchTimer");
const matchOver = document.getElementById("matchOver");
const matchOverMessage = document.getElementById("matchOverMessage");
const finalStandings = document.getElementById("finalStandings");
const loginMessage = document.getElementById("loginMessage");
const playerCountInput = document.getElementById("playerCount");
const gameCategoryInput = document.getElementById("gameCategory");
const categoryHint = document.getElementById("categoryHint");
const authForm = document.getElementById("authForm");
const authIntro = document.getElementById("authIntro");
const authUsernameInput = document.getElementById("authUsername");
const authPasswordInput = document.getElementById("authPassword");
const authPasswordConfirmInput = document.getElementById("authPasswordConfirm");
const passwordConfirmLabel = document.getElementById("passwordConfirmLabel");
const authBirthDateInput = document.getElementById("authBirthDate");
const birthDateLabel = document.getElementById("birthDateLabel");
const authSubmit = document.getElementById("authSubmit");
const authModeToggle = document.getElementById("authModeToggle");
const accountBar = document.getElementById("accountBar");
const accountUsername = document.getElementById("accountUsername");
const signOutButton = document.getElementById("signOutButton");
const onboarding = document.getElementById("onboarding");
const deviceChoiceStep = document.getElementById("deviceChoiceStep");
const experienceChoiceStep = document.getElementById("experienceChoiceStep");
const tutorialStep = document.getElementById("tutorialStep");
const tutorialProgress = document.getElementById("tutorialProgress");
const tutorialTitle = document.getElementById("tutorialTitle");
const tutorialText = document.getElementById("tutorialText");
const tutorialBackButton = document.getElementById("tutorialBackButton");
const tutorialNextButton = document.getElementById("tutorialNextButton");
const tutorialGrid = document.getElementById("tutorialGrid");
const tutorialGridMessage = document.getElementById("tutorialGridMessage");
const tutorialControlHint = document.getElementById("tutorialControlHint");
const tutorialSkillStatus = document.getElementById("tutorialSkillStatus");
const tutorialShootButton = document.getElementById("tutorialShootButton");
const tutorialSkillButton = document.getElementById("tutorialSkillButton");
const setupActions = document.getElementById("setupActions");
const matchSettingsSection = document.getElementById("matchSettings");
const roomForm = document.getElementById("roomForm");
const roomCodeInput = document.getElementById("roomCode");
const createRoomButton = document.getElementById("createRoomButton");
const joinRoomButton = document.getElementById("joinRoomButton");
const startRoomButton = document.getElementById("startRoomButton");
const roomStatus = document.getElementById("roomStatus");
const touchControls = document.getElementById("touchControls");

const canvases = [0, 1, 2, 3].map(index =>
    document.getElementById(`canvas${index}`)
);

const contexts = canvases.map(canvas =>
    canvas.getContext("2d")
);

const playerInfo = [0, 1, 2, 3].map(index =>
    document.getElementById(`info${index}`)
);

const leaderboardList = document.getElementById("leaderboardList");
const leaderboardSort = document.getElementById("leaderboardSort");
const killFeedList = document.getElementById("killFeedList");
let leaderboardData = null;

let registeredPlayers = [];
let currentState = null;
let started = false;
let matchSettings = { timeLimitMinutes: 5, deathLimit: 5, skillAmount: 10 };
let roomSocket = null;
let isRoomHost = false;
let localPlayerIndex = -1;
let roomPlayers = [];
let currentAccount = null;
let resultSubmittedForMatch = false;
let authMode = "signin";
let selectedControlMode = "pc";
let tutorialIndex = 0;
let tutorialSlides = [];
const tutorialGridSize = 8;
const tutorialDirections = [
    { name: "up", x: 0, y: -1, rotation: 0 },
    { name: "right", x: 1, y: 0, rotation: 90 },
    { name: "down", x: 0, y: 1, rotation: 180 },
    { name: "left", x: -1, y: 0, rotation: 270 }
];
const tutorialWalls = new Set(["3,1", "3,2", "3,4", "3,5", "5,2", "5,5"]);
let tutorialTank = { x: 1, y: 5, direction: 1 };
let tutorialEnemies = [];
let tutorialCrate = null;
let tutorialHasSkill = false;
let tutorialShotCells = [];
const roomInputs = Array.from({ length: 4 }, () => ({}));

const pressedKeys = new Set();
const touchInputs = { up: false, down: false, left: false, right: false, shoot: false, skill: false };

const MAX_HEALTH = 100;

const controls = [
    {
        up: ["w"],
        down: ["s"],
        left: ["a"],
        right: ["d"],
        shoot: [" "],
        skill: ["q"]
    },
    {
        up: ["arrowup"],
        down: ["arrowdown"],
        left: ["arrowleft"],
        right: ["arrowright"],
        shoot: ["enter"],
        skill: ["m"]
    },
    {
        up: ["i"],
        down: ["k"],
        left: ["j"],
        right: ["l"],
        shoot: ["u"],
        skill: ["o"]
    },
    {
        up: ["8"],
        down: ["5"],
        left: ["4"],
        right: ["6"],
        shoot: ["9"],
        skill: ["7"]
    }
];

function applyMovementOptions() {
    const style = document.getElementById("movementStyleAll").value;
    const showKey = key => ({
        arrowup: "↑", arrowdown: "↓", arrowleft: "←", arrowright: "→", " ": "SPACE"
    }[key] || key.toUpperCase());
    controls.forEach((control, index) => {
        const up = showKey(control.up[0]);
        const down = showKey(control.down[0]);
        const left = showKey(control.left[0]);
        const right = showKey(control.right[0]);
        const movementHint = style === "turn-drive"
            ? `Drive: ${up}/${down} | Turn: ${left}/${right}`
            : style === "spin-drive"
                ? `Spin | Hold ${up} to stop and drive forward; tap to reverse spin + shoot`
                : `Move: ${up}/${down}/${left}/${right}`;
        const actionHint = `Shoot: ${showKey(control.shoot[0])} | Skill: ${showKey(control.skill[0])}`;
        document.getElementById(`controls${index}`).textContent = `${movementHint} | ${actionHint}`;
    });
}

document.getElementById("movementStyleAll").addEventListener("change", applyMovementOptions);
applyMovementOptions();

playButton.addEventListener("click", () => {
    welcomeScreen.classList.add("hidden");
    loginScreen.classList.remove("hidden");
});

function hasPressed(keys) {
    return keys.some(key => pressedKeys.has(key));
}

function sendInputs() {
    if (!started) {
        return;
    }

    const control = controls[localPlayerIndex];
    if (!control || !roomSocket || roomSocket.readyState !== WebSocket.OPEN) return;
    const input = {
        up: hasPressed(control.up) || touchInputs.up,
        down: hasPressed(control.down) || touchInputs.down,
        left: hasPressed(control.left) || touchInputs.left,
        right: hasPressed(control.right) || touchInputs.right,
        shoot: hasPressed(control.shoot) || touchInputs.shoot,
        skill: hasPressed(control.skill) || touchInputs.skill
    };
    if (isRoomHost) {
        roomInputs[localPlayerIndex] = input;
        window.TankEngine?.inputs(roomInputs);
    } else {
        roomSocket.send(JSON.stringify({ type: "input", input }));
    }
}

window.addEventListener("keydown", event => {
    const activeElement = document.activeElement;

    if (
        activeElement &&
        (
            activeElement.tagName === "INPUT" ||
            activeElement.tagName === "TEXTAREA" ||
            activeElement.isContentEditable
        )
    ) {
        return;
    }

    const key = event.key.toLowerCase();

    const gameKeys = (controls[localPlayerIndex] ? [controls[localPlayerIndex]] : []).flatMap(control => [
        ...control.up, ...control.down, ...control.left, ...control.right,
        ...control.shoot, ...control.skill
    ]);

    if (gameKeys.includes(key)) {
        event.preventDefault();
    }

    const wasPressed = pressedKeys.has(key);
    pressedKeys.add(key);
    sendInputs();
    if (!wasPressed && started && roomPlayers[localPlayerIndex]?.movementMode === "spin-drive" && controls[localPlayerIndex]?.up.includes(key)) {
        if (isRoomHost) window.TankEngine?.spinFire(localPlayerIndex);
        else roomSocket?.send(JSON.stringify({ type: "spin" }));
    }
});

window.addEventListener("keyup", event => {
    pressedKeys.delete(event.key.toLowerCase());
    sendInputs();
});

window.addEventListener("blur", () => {
    pressedKeys.clear();
    Object.keys(touchInputs).forEach(action => { touchInputs[action] = false; });
    sendInputs();
});

touchControls.querySelectorAll("[data-touch-input]").forEach(button => {
    const action = button.dataset.touchInput;
    button.addEventListener("pointerdown", event => {
        event.preventDefault();
        button.setPointerCapture(event.pointerId);
        touchInputs[action] = true;
        if (action === "up" && started && roomPlayers[localPlayerIndex]?.movementMode === "spin-drive") {
            if (isRoomHost) window.TankEngine?.spinFire(localPlayerIndex);
            else roomSocket?.send(JSON.stringify({ type: "spin" }));
        }
        sendInputs();
    });
    const release = event => {
        event.preventDefault();
        touchInputs[action] = false;
        sendInputs();
    };
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("lostpointercapture", release);
});

function updatePlayerCount() {
    if (gameCategoryInput.value === "2v2") playerCountInput.value = "4";
    const count = Number(playerCountInput.value);
    document.querySelectorAll(".game-category-option").forEach(button => {
        const selected = button.dataset.category === gameCategoryInput.value;
        button.classList.toggle("selected", selected);
        button.setAttribute("aria-pressed", String(selected));
    });
    document.querySelectorAll(".player-count-option").forEach(button => {
        const selected = Number(button.dataset.count) === count;
        button.classList.toggle("selected", selected);
        button.setAttribute("aria-pressed", String(selected));
        button.disabled = gameCategoryInput.value === "2v2" && Number(button.dataset.count) !== 4;
    });
    document.querySelectorAll(".player-form").forEach((form, index) => {
        form.classList.toggle("hidden", index >= count);
    });
    document.querySelectorAll(".player-panel").forEach((panel, index) => {
        panel.classList.toggle("hidden", index >= count);
    });
    document.querySelectorAll(".hud-card").forEach((card, index) => {
        card.classList.toggle("hidden", index >= count);
    });
}

document.querySelectorAll(".player-count-option").forEach(button => {
    button.addEventListener("click", () => {
        playerCountInput.value = button.dataset.count;
        document.querySelectorAll(".player-count-option").forEach(option => {
            const selected = option === button;
            option.classList.toggle("selected", selected);
            option.setAttribute("aria-pressed", String(selected));
        });
        updatePlayerCount();
    });
});
gameCategoryInput.addEventListener("change", () => {
    categoryHint.textContent = gameCategoryInput.value === "2v2"
        ? "Players 1–2 are Team Blue; Players 3–4 are Team Red. Teammates cannot damage each other."
        : "All other tanks are opponents.";
    updatePlayerCount();
});
document.querySelectorAll(".game-category-option").forEach(button => {
    button.addEventListener("click", () => {
        gameCategoryInput.value = button.dataset.category;
        gameCategoryInput.dispatchEvent(new Event("change", { bubbles: true }));
    });
});
updatePlayerCount();

function displayAccount(account) {
    currentAccount = account || null;
    const signedIn = Boolean(currentAccount);
    authForm.classList.toggle("hidden", signedIn);
    accountBar.classList.toggle("hidden", !signedIn);
    onboarding.classList.toggle("hidden", !signedIn);
    deviceChoiceStep.classList.toggle("hidden", !signedIn);
    experienceChoiceStep.classList.add("hidden");
    tutorialStep.classList.add("hidden");
    matchSettingsSection.classList.add("hidden");
    roomForm.classList.add("hidden");
    setupActions.classList.toggle("hidden", signedIn);
    if (signedIn) {
        accountUsername.textContent = currentAccount.username;
        authIntro.textContent = "You are signed in. Set up your controls before joining a match.";
        loginMessage.textContent = "Choose your device controls to continue.";
    } else {
        authIntro.textContent = "Sign in to play online, or create an account to get started.";
    }
}

function finishOnboarding() {
    onboarding.classList.add("hidden");
    matchSettingsSection.classList.remove("hidden");
    roomForm.classList.remove("hidden");
    setupActions.classList.remove("hidden");
    loginMessage.textContent = "Create a room or enter a friend's room code.";
}

document.querySelectorAll("[data-control-mode]").forEach(button => {
    button.addEventListener("click", () => {
        selectedControlMode = button.dataset.controlMode;
        document.body.dataset.controlMode = selectedControlMode;
        deviceChoiceStep.classList.add("hidden");
        experienceChoiceStep.classList.remove("hidden");
        loginMessage.textContent = "Choose Newbie for the guided tutorial or Veteran to skip it.";
    });
});

document.getElementById("backToDeviceChoiceButton").addEventListener("click", () => {
    experienceChoiceStep.classList.add("hidden");
    deviceChoiceStep.classList.remove("hidden");
});

function makeTutorialSlides() {
    const movement = selectedControlMode === "mobile"
        ? "Use the on-screen pad to move and turn. Hold SHOOT to fire. Press SKILL when you have a crate ability."
        : "Your assigned keyboard layout is shown under the arena during a match. Player 1 uses W/A/S/D, Space to shoot, and Q for skills; other player slots have their own keys. Follow the control hint under your arena.";
    return [
        {
            title: "Welcome to the arena",
            text: "Fight to score the most kills and survive. The room owner chooses the time limit and how many deaths each player can take before elimination."
        },
        {
            title: "Move your tank",
            text: `${movement} In Turn and Drive mode, up/down moves forward/back and left/right turns. Spin and Drive rotates automatically; hold up to drive forward, and tap up to fire a spinning shot.`
        },
        {
            title: "Aim and shoot",
            text: "Turn your tank toward an opponent, then fire forward. In Turn and Drive, hold your shoot key or the SHOOT button. In Spin and Drive, tap up to fire a spinning shot. Walls can block shots, so keep moving and look for a clear angle."
        },
        {
            title: "Collect and use skills",
            text: "Drive over a glowing crate to collect its random skill. Pickups include homing rockets, mines, piercing or bouncing lasers, gatling bursts, armor, tank shrink, and HP kits. Your player card shows the skill and uses; press your skill key or SKILL button to activate it."
        },
        {
            title: "How a match ends",
            text: "Hits reduce your health. When it reaches zero, you lose a life and respawn until you reach the room's death limit. If time runs out, the player or team with the best kills and score wins. In 2 vs 2, teammates cannot damage each other."
        }
    ];
}

function renderTutorialSlide() {
    const slide = tutorialSlides[tutorialIndex];
    tutorialProgress.textContent = `Step ${tutorialIndex + 1} of ${tutorialSlides.length}`;
    tutorialTitle.textContent = slide.title;
    tutorialText.textContent = slide.text;
    tutorialBackButton.disabled = tutorialIndex === 0;
    tutorialNextButton.textContent = tutorialIndex === tutorialSlides.length - 1 ? "Finish tutorial" : "Next";
    tutorialControlHint.textContent = selectedControlMode === "mobile"
        ? "Use the pad to turn and drive. Tap SHOOT or USE SKILL for actions."
        : "Use W/A/S/D or arrow keys to turn and drive. Space shoots; Q uses the sample skill. You can also click the buttons.";
    resetTutorialArena();
}

function resetTutorialArena() {
    tutorialTank = tutorialIndex === 2
        ? { x: 1, y: 3, direction: 1 }
        : { x: 1, y: 5, direction: 1 };
    tutorialEnemies = tutorialIndex === 2
        ? [{ x: 6, y: 3, alive: true }]
        : [{ x: 6, y: 1, alive: true }, { x: 6, y: 6, alive: true }];
    tutorialCrate = tutorialIndex === 3 ? { x: 2, y: 5, active: true } : null;
    tutorialHasSkill = false;
    tutorialShotCells = [];
    tutorialSkillButton.disabled = true;
    tutorialSkillStatus.textContent = "SKILL: NONE";
    tutorialGridMessage.textContent = tutorialIndex === 2
        ? "Line up with the rival tank and fire in the direction your tank faces."
        : tutorialIndex === 3
            ? "Drive over the crate to collect a sample skill."
            : "Practice on the arena grid. Walls block tanks and shots.";
    renderTutorialArena();
}

function renderTutorialArena() {
    const fragment = document.createDocumentFragment();
    for (let y = 0; y < tutorialGridSize; y++) {
        for (let x = 0; x < tutorialGridSize; x++) {
            const cell = document.createElement("div");
            cell.className = "tutorial-cell";
            cell.setAttribute("role", "gridcell");
            const key = `${x},${y}`;
            if (tutorialWalls.has(key)) cell.classList.add("tutorial-wall");
            if (tutorialShotCells.includes(key)) cell.classList.add("tutorial-shot-cell");

            if (tutorialTank.x === x && tutorialTank.y === y) {
                const tank = document.createElement("span");
                tank.className = "tutorial-tank tutorial-player-tank";
                tank.style.setProperty("--tank-rotation", `${tutorialDirections[tutorialTank.direction].rotation}deg`);
                tank.setAttribute("role", "img");
                tank.setAttribute("aria-label", "Your tank");
                cell.appendChild(tank);
            }

            const enemy = tutorialEnemies.find(item => item.alive && item.x === x && item.y === y);
            if (enemy) {
                const tank = document.createElement("span");
                tank.className = "tutorial-tank tutorial-rival-tank";
                tank.setAttribute("role", "img");
                tank.setAttribute("aria-label", "Rival tank");
                cell.appendChild(tank);
            }

            if (tutorialCrate?.active && tutorialCrate.x === x && tutorialCrate.y === y) {
                const crate = document.createElement("span");
                crate.className = "tutorial-crate";
                crate.setAttribute("role", "img");
                crate.setAttribute("aria-label", "Skill crate");
                crate.textContent = "★";
                cell.appendChild(crate);
            }
            fragment.appendChild(cell);
        }
    }
    tutorialGrid.replaceChildren(fragment);
}

function moveTutorialTank(action) {
    if (action === "left") tutorialTank.direction = (tutorialTank.direction + 3) % 4;
    else if (action === "right") tutorialTank.direction = (tutorialTank.direction + 1) % 4;
    else if (action === "up" || action === "down") {
        const direction = tutorialDirections[tutorialTank.direction];
        const sign = action === "up" ? 1 : -1;
        const nextX = tutorialTank.x + direction.x * sign;
        const nextY = tutorialTank.y + direction.y * sign;
        const blocked = nextX < 0 || nextY < 0 || nextX >= tutorialGridSize || nextY >= tutorialGridSize ||
            tutorialWalls.has(`${nextX},${nextY}`) || tutorialEnemies.some(enemy => enemy.alive && enemy.x === nextX && enemy.y === nextY);
        if (blocked) {
            tutorialGridMessage.textContent = "Blocked! Turn or reverse to find another path.";
            return;
        }
        tutorialTank.x = nextX;
        tutorialTank.y = nextY;
        if (tutorialCrate?.active && tutorialCrate.x === nextX && tutorialCrate.y === nextY) {
            tutorialCrate.active = false;
            tutorialHasSkill = true;
            tutorialSkillButton.disabled = false;
            tutorialSkillStatus.textContent = "SKILL: HOMING ROCKET ×1";
            tutorialGridMessage.textContent = "Crate collected! Your skill is ready. Activate it with Q or USE SKILL.";
        } else {
            tutorialGridMessage.textContent = `Tank at grid ${nextX + 1}, ${nextY + 1}. Turn with left/right; drive with up/down.`;
        }
    }
    renderTutorialArena();
}

function shootTutorialTank() {
    const direction = tutorialDirections[tutorialTank.direction];
    const shotCells = [];
    for (let distance = 1; distance < tutorialGridSize; distance++) {
        const x = tutorialTank.x + direction.x * distance;
        const y = tutorialTank.y + direction.y * distance;
        if (x < 0 || y < 0 || x >= tutorialGridSize || y >= tutorialGridSize || tutorialWalls.has(`${x},${y}`)) break;
        shotCells.push(`${x},${y}`);
        const enemy = tutorialEnemies.find(item => item.alive && item.x === x && item.y === y);
        if (enemy) {
            enemy.alive = false;
            tutorialGridMessage.textContent = "Direct hit! Shots travel forward until they hit a rival or wall.";
            break;
        }
    }
    tutorialShotCells = shotCells;
    if (!tutorialEnemies.some(enemy => !enemy.alive) && shotCells.length) {
        tutorialGridMessage.textContent = "Shot fired! Turn to line up with a rival; walls stop bullets.";
    } else if (!shotCells.length) {
        tutorialGridMessage.textContent = "A wall is in the way. Move or turn for a clear shot.";
    }
    renderTutorialArena();
    window.setTimeout(() => {
        tutorialShotCells = [];
        if (!tutorialStep.classList.contains("hidden")) renderTutorialArena();
    }, 300);
}

function activateTutorialSkill() {
    if (!tutorialHasSkill) {
        tutorialGridMessage.textContent = "Collect the glowing crate first to get a skill.";
        return;
    }
    tutorialHasSkill = false;
    tutorialSkillButton.disabled = true;
    tutorialSkillStatus.textContent = "SKILL: USED";
    tutorialGridMessage.textContent = "Homing rocket launched! In a match, skill types and charges vary by crate.";
}

document.querySelectorAll("[data-tutorial-move]").forEach(button => {
    button.addEventListener("click", () => moveTutorialTank(button.dataset.tutorialMove));
});
window.addEventListener("keydown", event => {
    if (tutorialStep.classList.contains("hidden")) return;
    const key = event.key.toLowerCase();
    const moves = { w: "up", arrowup: "up", a: "left", arrowleft: "left", d: "right", arrowright: "right", s: "down", arrowdown: "down" };
    if (moves[key]) {
        event.preventDefault();
        moveTutorialTank(moves[key]);
    } else if (key === " " || key === "spacebar") {
        event.preventDefault();
        shootTutorialTank();
    } else if (key === "q") {
        event.preventDefault();
        activateTutorialSkill();
    }
});
tutorialShootButton.addEventListener("click", shootTutorialTank);
tutorialSkillButton.addEventListener("click", activateTutorialSkill);

document.getElementById("newbieButton").addEventListener("click", () => {
    tutorialSlides = makeTutorialSlides();
    tutorialIndex = 0;
    experienceChoiceStep.classList.add("hidden");
    tutorialStep.classList.remove("hidden");
    renderTutorialSlide();
});

document.getElementById("veteranButton").addEventListener("click", finishOnboarding);
tutorialBackButton.addEventListener("click", () => {
    if (tutorialIndex > 0) {
        tutorialIndex--;
        renderTutorialSlide();
    }
});
tutorialNextButton.addEventListener("click", () => {
    if (tutorialIndex < tutorialSlides.length - 1) {
        tutorialIndex++;
        renderTutorialSlide();
    } else {
        finishOnboarding();
    }
});

authModeToggle.addEventListener("click", () => {
    authMode = authMode === "signin" ? "signup" : "signin";
    authSubmit.textContent = authMode === "signin" ? "SIGN IN" : "SIGN UP";
    authModeToggle.textContent = authMode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in";
    authPasswordInput.autocomplete = authMode === "signin" ? "current-password" : "new-password";
    const signingUp = authMode === "signup";
    passwordConfirmLabel.classList.toggle("hidden", !signingUp);
    authPasswordConfirmInput.classList.toggle("hidden", !signingUp);
    authPasswordConfirmInput.disabled = !signingUp;
    authPasswordConfirmInput.required = signingUp;
    birthDateLabel.classList.toggle("hidden", !signingUp);
    authBirthDateInput.classList.toggle("hidden", !signingUp);
    authBirthDateInput.disabled = !signingUp;
    authBirthDateInput.required = signingUp;
    authPasswordConfirmInput.value = "";
    authPasswordConfirmInput.setCustomValidity("");
    loginMessage.textContent = authMode === "signup"
        ? "Use 3–24 letters, numbers or underscores. Choose a password of at least 8 characters and enter your birth date."
        : "";
});

authPasswordConfirmInput.addEventListener("input", () => {
    authPasswordConfirmInput.setCustomValidity(
        authPasswordConfirmInput.value === authPasswordInput.value ? "" : "Passwords do not match."
    );
});
authPasswordInput.addEventListener("input", () => {
    if (authMode === "signup") {
        authPasswordConfirmInput.setCustomValidity(
            authPasswordConfirmInput.value === authPasswordInput.value ? "" : "Passwords do not match."
        );
    }
});

authForm.addEventListener("submit", async event => {
    event.preventDefault();
    if (authMode === "signup" && authPasswordInput.value !== authPasswordConfirmInput.value) {
        authPasswordConfirmInput.setCustomValidity("Passwords do not match.");
        authPasswordConfirmInput.reportValidity();
        return;
    }
    authSubmit.disabled = true;
    loginMessage.textContent = authMode === "signin" ? "Signing in..." : "Creating your account...";
    try {
        const response = await fetch("api/auth.php", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                mode: authMode,
                username: authUsernameInput.value.trim(),
                password: authPasswordInput.value,
                password_confirmation: authPasswordConfirmInput.value,
                birth_date: authBirthDateInput.value
            })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not sign in.");
        displayAccount(result.account);
        authPasswordInput.value = "";
        authPasswordConfirmInput.value = "";
        authBirthDateInput.value = "";
    } catch (error) {
        loginMessage.textContent = error.message;
    } finally {
        authSubmit.disabled = false;
    }
});

async function loadSignedInAccount() {
    try {
        const response = await fetch("api/me.php", { cache: "no-store" });
        if (!response.ok) return;
        const result = await response.json();
        displayAccount(result.account);
    } catch (error) {
        loginMessage.textContent = "Could not check your saved sign-in.";
    }
}

async function signOut() {
    if (roomSocket?.readyState === WebSocket.OPEN) {
        roomSocket.send(JSON.stringify({ type: "leave" }));
        roomSocket.close();
    }
    roomSocket = null;
    started = false;
    window.TankEngine?.leave();
    localPlayerIndex = -1;
    isRoomHost = false;
    roomPlayers = [];
    createRoomButton.disabled = joinRoomButton.disabled = false;
    startRoomButton.classList.add("hidden");
    try {
        await fetch("api/logout.php", { method: "POST" });
    } catch (error) {
        console.warn("Server sign out could not complete:", error.message);
    } finally {
        displayAccount(null);
        loginMessage.textContent = "You have signed out.";
        gameScreen.classList.add("hidden");
        matchOver.classList.add("hidden");
        loginScreen.classList.remove("hidden");
        welcomeScreen.classList.add("hidden");
    }
}

signOutButton.addEventListener("click", signOut);
loadSignedInAccount();

async function connectToRoom(action) {
    if (!currentAccount?.ws_token) {
        loginMessage.textContent = "Sign in before connecting to a room.";
        return;
    }
    const code = roomCodeInput.value.trim().toUpperCase();
    if (action === "join" && !/^[A-Z0-9]{6}$/.test(code)) {
        loginMessage.textContent = "Enter the six-character room code.";
        return;
    }
    createRoomButton.disabled = joinRoomButton.disabled = true;
    loginMessage.textContent = "Connecting to the room service...";
    try {
        const profile = {
            player_id: currentAccount.player_id,
            username: currentAccount.username,
            movementMode: document.getElementById("movementStyleAll").value
        };
        const configuredWsUrl = document.querySelector('meta[name="tank-ws-url"]')?.content.trim();
        const scheme = location.protocol === "https:" ? "wss:" : "ws:";
        let roomTicket = null;
        if (configuredWsUrl) {
            const ticketResponse = await fetch("api/ws-ticket.php", { method: "POST", cache: "no-store" });
            const ticketResult = await ticketResponse.json().catch(() => ({}));
            if (!ticketResponse.ok) throw new Error(ticketResult.error || "Could not authorize the room connection.");
            roomTicket = ticketResult.ticket;
            if (!roomTicket) throw new Error("The room service returned an invalid sign-in ticket.");
        }
        const socket = new WebSocket(configuredWsUrl || `${scheme}//${location.hostname}:8080`);
        roomSocket = socket;
        socket.addEventListener("open", () => socket.send(JSON.stringify(configuredWsUrl
            ? { type: "hello", auth_ticket: roomTicket, player: profile }
            : { type: "hello", auth_token: currentAccount.ws_token, player: profile })));
        socket.addEventListener("message", event => {
            let message;
            try { message = JSON.parse(event.data); } catch { return; }
            if (message.type === "ready") socket.send(JSON.stringify({ type: action, code, player: profile }));
            if (message.type === "error") {
                loginMessage.textContent = message.message;
                createRoomButton.disabled = joinRoomButton.disabled = false;
                if (localPlayerIndex === -1) {
                    roomSocket = null;
                    socket.close();
                }
            }
            if (message.type === "room") {
                localPlayerIndex = message.slot;
                isRoomHost = message.host;
                roomPlayers = message.players || [];
                roomInputs.length = 0;
                roomInputs.push(...Array.from({ length: 4 }, () => ({})));
                startRoomButton.classList.toggle("hidden", !isRoomHost);
                startRoomButton.disabled = roomPlayers.length < 2;
                createRoomButton.disabled = joinRoomButton.disabled = true;
                roomCodeInput.value = message.code;
                roomStatus.textContent = `Room ${message.code} · Player ${localPlayerIndex + 1} of 4`;
                loginMessage.textContent = isRoomHost
                    ? `Room created. Share code ${message.code}; start when everyone has joined.`
                    : `Joined room ${message.code}. Waiting for the room owner to start.`;
            }
            if (message.type === "players") {
                roomPlayers = message.players || [];
                startRoomButton.disabled = roomPlayers.length < 2;
                roomStatus.textContent = `Room ${roomCodeInput.value} · ${roomPlayers.length} player${roomPlayers.length === 1 ? "" : "s"}`;
                loginMessage.textContent = `${roomPlayers.map(item => item.username).join(", ")} · ${roomPlayers.length}/4 connected`;
            }
            if (message.type === "start") {
                resultSubmittedForMatch = false;
                registeredPlayers = message.players || [];
                roomPlayers = registeredPlayers;
                matchSettings = message.settings;
                playerCountInput.value = String(registeredPlayers.length);
                updatePlayerCount();
                document.querySelectorAll(".player-panel").forEach((panel, index) => panel.classList.toggle("hidden", index !== localPlayerIndex));
                startRoomButton.classList.add("hidden");
                document.getElementById("roomStatus").textContent = `Room ${roomCodeInput.value} · You are Player ${localPlayerIndex + 1}`;
                restartButton.classList.toggle("hidden", !isRoomHost);
                playAgainButton.classList.toggle("hidden", !isRoomHost);
                if (isRoomHost) window.TankEngine.start({ players: registeredPlayers, ...matchSettings });
                else {
                    started = true;
                    matchOver.classList.add("hidden");
                    loginScreen.classList.add("hidden");
                    gameScreen.classList.remove("hidden");
                    refreshLeaderboard();
                }
            }
            if (message.type === "remote-input" && isRoomHost) {
                roomInputs[message.slot] = message.input || {};
                window.TankEngine?.inputs(roomInputs);
            }
            if (message.type === "remote-spin" && isRoomHost) window.TankEngine?.spinFire(message.slot);
            if (message.type === "state" && !isRoomHost && message.state) {
                window.dispatchEvent(new CustomEvent("tank:game:state", { detail: message.state }));
            }
            if (message.type === "closed") {
                started = false;
                loginMessage.textContent = message.message;
                roomStatus.textContent = "Room disconnected";
                gameScreen.classList.add("hidden");
                loginScreen.classList.remove("hidden");
                createRoomButton.disabled = joinRoomButton.disabled = false;
            }
        });
        socket.addEventListener("error", () => {
            loginMessage.textContent = "Could not connect to the PHP room service. Start it with the XAMPP instructions.";
            createRoomButton.disabled = joinRoomButton.disabled = false;
        });
        socket.addEventListener("close", () => {
            if (roomSocket === socket && started) {
                started = false;
                roomStatus.textContent = "Connection lost";
            }
        });
    } catch (error) {
        loginMessage.textContent = error.message;
        createRoomButton.disabled = joinRoomButton.disabled = false;
    }
}

createRoomButton.addEventListener("click", () => connectToRoom("create"));
joinRoomButton.addEventListener("click", () => connectToRoom("join"));
startRoomButton.addEventListener("click", () => {
    const timeLimitMinutes = Number(document.getElementById("timeLimitMinutes").value);
    const deathLimit = Number(document.getElementById("deathLimit").value);
    const skillAmount = Number(document.getElementById("skillAmount").value);
    if (roomPlayers.length < 2 || !Number.isInteger(timeLimitMinutes) || timeLimitMinutes < 1 || timeLimitMinutes > 10 ||
        !Number.isInteger(deathLimit) || deathLimit < 1 || deathLimit > 1000 ||
        !Number.isInteger(skillAmount) || skillAmount < 1 || skillAmount > 50) {
        loginMessage.textContent = "Connect 2–4 players and choose valid match rules.";
        return;
    }
    matchSettings = { timeLimitMinutes, deathLimit, skillAmount, category: gameCategoryInput.value };
    roomSocket?.send(JSON.stringify({ type: "start", settings: matchSettings }));
});

window.addEventListener("tank:game:error", event => {
    const data = event.detail;
    loginMessage.textContent = data.message;
    joinButton.disabled = false;
    if (isRoomHost) startRoomButton.disabled = false;
});

window.addEventListener("tank:game:started", () => {
    started = true;
    matchOver.classList.add("hidden");

    loginScreen.classList.add("hidden");
    gameScreen.classList.remove("hidden");
    restartButton.classList.toggle("hidden", !isRoomHost);

    refreshLeaderboard();
});

window.addEventListener("tank:game:state", event => {
    const state = event.detail;
    currentState = state;
    if (isRoomHost && roomSocket?.readyState === WebSocket.OPEN) {
        roomSocket.send(JSON.stringify({ type: "state", state }));
    }

    if (state.started && state.over) {
        if (!resultSubmittedForMatch) {
            resultSubmittedForMatch = true;
            const ownPlayer = state.players.find(player => player.player_id === currentAccount?.player_id);
            if (ownPlayer) {
                const wins = state.category === "2v2"
                    ? (state.winnerTeamIndex !== null && state.winnerTeamIndex !== undefined &&
                        ownPlayer.teamIndex === state.winnerTeamIndex ? 1 : 0)
                    : (state.winnerIndex === ownPlayer.index ? 1 : 0);
                window.tankApi.saveMatchResults([{
                    player_id: ownPlayer.player_id,
                    score: ownPlayer.score,
                    kills: ownPlayer.kills,
                    wins
                }]).then(() => window.dispatchEvent(new Event("tank:game:results-saved"))).catch(error => {
                    console.error("Could not save match results:", error.message);
                    window.dispatchEvent(new CustomEvent("tank:game:results-save-error", {
                        detail: { message: error.message }
                    }));
                });
            }
        }
        if (matchOver.classList.contains("hidden")) {
            const winner = state.players[state.winnerIndex];
            const result = state.category === "2v2"
                ? (state.winnerTeamIndex === null || state.winnerTeamIndex === undefined
                    ? "The teams tied."
                    : `Team ${state.winnerTeamIndex === 0 ? "Blue" : "Red"} wins.`)
                : winner
                ? `${winner.username} wins with ${winner.kills} kills and ${winner.score} points.`
                : "The match is tied.";
            matchOverMessage.textContent = state.overReason === "time"
                ? `Time is up. ${result}`
                : result;
            renderFinalStandings(state.players, state.category);
        }
        matchOver.classList.remove("hidden");
        started = false;
    }

    if (state.started && !state.over && matchTimer) {
        const seconds = Math.max(0, state.timeRemainingSeconds || 0);
        matchTimer.textContent = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
    }

    if (started) {
        renderAllViews();
    }
});

function renderFinalStandings(players, category) {
    const places = ["1st", "2nd", "3rd", "4th"];
    const rankedPlayers = [...players].sort((a, b) =>
        b.kills - a.kills || b.score - a.score || a.deaths - b.deaths || a.index - b.index
    );
    finalStandings.replaceChildren();

    rankedPlayers.forEach((player, index) => {
        const row = document.createElement("tr");
        const values = [
            places[index] || `${index + 1}th`,
            category === "2v2" ? `Team ${player.teamIndex === 0 ? "Blue" : "Red"}: ${player.username}` : player.username,
            player.score,
            player.kills,
            player.deaths
        ];
        for (const value of values) {
            const cell = document.createElement("td");
            cell.textContent = String(value ?? 0);
            row.appendChild(cell);
        }
        finalStandings.appendChild(row);
    });
}

const visualEffects = [];

function addKillFeedAnnouncement(data) {
    const announcement = document.createElement("li");
    const cause = data.weapon || "an unknown cause";

    const addPlayerName = name => {
        const nameElement = document.createElement("span");
        nameElement.textContent = name;
        nameElement.style.color = "#f1f2f3";
        announcement.appendChild(nameElement);
    };

    if (data.killerName) {
        addPlayerName(data.killerName);
        announcement.append(" eliminated ");
        addPlayerName(data.victimName);
        announcement.append(" using " + cause + ".");
        announcement.style.borderLeftColor = "#d5d8db";
    } else {
        addPlayerName(data.victimName);
        announcement.append(" was eliminated by an arena hazard (" + cause + ").");
        announcement.style.borderLeftColor = "#d5d8db";
    }

    killFeedList.prepend(announcement);
    while (killFeedList.children.length > 8) {
        killFeedList.lastElementChild.remove();
    }
}

function createExplosion(x, y, color) {
    const particleCount = 28;

    for (let i = 0; i < particleCount; i++) {
        const speed = 1.5 + Math.random() * 4.5;
        const angle = Math.random() * Math.PI * 2;

        visualEffects.push({
            type: "particle",
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            color: Math.random() > 0.4 ? color : (Math.random() > 0.5 ? "#ffba33" : "#ff4422"),
            radius: 2 + Math.random() * 3.5,
            alpha: 1,
            decay: 0.03 + Math.random() * 0.025
        });
    }

    visualEffects.push({
        type: "ring",
        x,
        y,
        radius: 6,
        speed: 2.2,
        color: "#ffffff",
        alpha: 1,
        decay: 0.05
    });
}

function createRespawnBeacon(x, y, color) {
    visualEffects.push({
        type: "beacon",
        x,
        y,
        radius: 6,
        speed: 2,
        color: color || "#3bd5a0",
        alpha: 1,
        decay: 0.03
    });
}

function updateVisualEffects() {
    for (let i = visualEffects.length - 1; i >= 0; i--) {
        const fx = visualEffects[i];

        if (fx.type === "particle") {
            fx.x += fx.vx;
            fx.y += fx.vy;
            fx.vx *= 0.94;
            fx.vy *= 0.94;
        } else if (fx.type === "ring" || fx.type === "beacon") {
            fx.radius += fx.speed;
        }

        fx.alpha -= fx.decay;

        if (fx.alpha <= 0) {
            visualEffects.splice(i, 1);
        }
    }
}

function drawVisualEffects(ctx, cameraX, cameraY) {
    for (const fx of visualEffects) {
        const screenX = fx.x - cameraX;
        const screenY = fx.y - cameraY;

        ctx.save();
        ctx.globalAlpha = Math.max(0, fx.alpha);

        if (fx.type === "particle") {
            ctx.fillStyle = fx.color;
            ctx.beginPath();
            ctx.arc(screenX, screenY, fx.radius, 0, Math.PI * 2);
            ctx.fill();
        } else if (fx.type === "ring" || fx.type === "beacon") {
            ctx.strokeStyle = fx.color;
            ctx.lineWidth = 2.5;
            ctx.shadowColor = fx.color;
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.arc(screenX, screenY, fx.radius, 0, Math.PI * 2);
            ctx.stroke();
        }

        ctx.restore();
    }
}

window.addEventListener("tank:player:eliminated", event => {
    const data = event.detail;
    createExplosion(data.deathX, data.deathY, data.victimColor);
    if (Number.isFinite(data.spawnX) && Number.isFinite(data.spawnY)) {
        createRespawnBeacon(data.spawnX, data.spawnY, data.victimColor);
    }
    addKillFeedAnnouncement(data);
});

window.addEventListener("tank:game:results-saved", refreshLeaderboard);
window.addEventListener("tank:game:results-save-error", event => {
    const message = event.detail?.message || "Could not save match results.";
    if (matchOver.classList.contains("hidden")) {
        loginMessage.textContent = message;
    } else {
        matchOverMessage.textContent += ` ${message}`;
    }
});

setInterval(() => {
    if (started) {
        sendInputs();
    }
}, 50);

function restartMatch() {
    if (!isRoomHost || registeredPlayers.length < 2 || registeredPlayers.length > 4) {
        return;
    }

    pressedKeys.clear();
    started = false;

    matchOver.classList.add("hidden");
    roomSocket?.send(JSON.stringify({ type: "start", settings: matchSettings }));
}

function backToRegistration() {
    pressedKeys.clear();
    started = false;
    window.TankEngine?.leave();
    if (roomSocket?.readyState === WebSocket.OPEN) {
        roomSocket.send(JSON.stringify({ type: "leave" }));
        roomSocket.close();
    }
    roomSocket = null;
    isRoomHost = false;
    localPlayerIndex = -1;
    roomPlayers = [];
    matchOver.classList.add("hidden");
    gameScreen.classList.add("hidden");
    loginScreen.classList.add("hidden");
    welcomeScreen.classList.remove("hidden");
    joinButton.disabled = false;
    createRoomButton.disabled = joinRoomButton.disabled = false;
    startRoomButton.classList.add("hidden");
    loginMessage.textContent = "Returned to player registration.";
}

backToWelcomeButton.addEventListener("click", () => {
    if (roomSocket?.readyState === WebSocket.OPEN) {
        roomSocket.send(JSON.stringify({ type: "leave" }));
        roomSocket.close();
    }
    roomSocket = null;
    localPlayerIndex = -1;
    isRoomHost = false;
    roomPlayers = [];
    createRoomButton.disabled = joinRoomButton.disabled = false;
    startRoomButton.classList.add("hidden");
    loginScreen.classList.add("hidden");
    welcomeScreen.classList.remove("hidden");
    loginMessage.textContent = "";
});

restartButton.addEventListener("click", restartMatch);
playAgainButton.addEventListener("click", restartMatch);
backToRegistrationButton.addEventListener("click", backToRegistration);
resultsBackButton.addEventListener("click", backToRegistration);

function drawGrid(ctx, width, height, cameraX, cameraY, tile) {
    const startX = Math.floor(cameraX / tile) * tile;
    const startY = Math.floor(cameraY / tile) * tile;
    const bricks = ["#865650", "#79504f", "#8f5c52", "#754b4c"];
    ctx.fillStyle = "#382638";
    ctx.fillRect(0, 0, width, height);

    for (let y = startY; y < cameraY + height + tile; y += tile) {
        for (let x = startX; x < cameraX + width + tile; x += tile) {
            const sx = Math.round(x - cameraX);
            const sy = Math.round(y - cameraY);
            const column = Math.floor(x / tile);
            const row = Math.floor(y / tile);
            const colorIndex = Math.abs((column * 17 + row * 31 + column * row * 7) % bricks.length);
            ctx.fillStyle = bricks[colorIndex];
            ctx.fillRect(sx, sy, tile, tile);

            // Offset mortar seams every other course for a chunky brick-floor pattern.
            ctx.fillStyle = "#452b3b";
            ctx.fillRect(sx, sy + tile - 3, tile, 3);
            if (row % 2 === 0) ctx.fillRect(sx + tile - 3, sy, 3, tile - 3);
            else ctx.fillRect(sx, sy, 3, tile - 3);

            // Small square chips give each brick a restrained pixel-art texture.
            ctx.fillStyle = "rgba(255, 190, 145, .2)";
            ctx.fillRect(sx + 7, sy + 7, 4, 3);
            ctx.fillRect(sx + tile - 13, sy + tile - 11, 3, 3);
            ctx.fillStyle = "rgba(40, 20, 39, .25)";
            ctx.fillRect(sx + 13, sy + 15, 5, 3);
        }
    }
}
function drawWalls(ctx, walls, cameraX, cameraY, width, height) {
    for (const wall of walls) {
        const x = wall.x - cameraX;
        const y = wall.y - cameraY;

        if (
            x + wall.w < 0 ||
            y + wall.h < 0 ||
            x > width ||
            y > height
        ) {
            continue;
        }

        if (wall.kind === "block") {
            const centerX = x + wall.w / 2;
            const centerY = y + wall.h / 2;

            ctx.save();
            ctx.translate(centerX, centerY);
            ctx.rotate(Math.PI / 4);
            ctx.fillStyle = "#454545";
            ctx.fillRect(-7, -7, 14, 14);
            ctx.fillStyle = "#777777";
            ctx.fillRect(-5, -5, 4, 3);
            ctx.fillStyle = "#292929";
            ctx.fillRect(3, 3, 3, 3);
            ctx.restore();
        } else {
            const horizontal = wall.w >= wall.h;
            ctx.fillStyle = "#32182f";
            ctx.fillRect(x - 2, y - 2, wall.w + 4, wall.h + 4);

            ctx.fillStyle = "#713a50";
            ctx.fillRect(x, y, wall.w, wall.h);

            // Brighter outline and top edge make narrow collision walls readable at a glance.
            ctx.strokeStyle = "#f0a07e";
            ctx.lineWidth = 2;
            ctx.strokeRect(x - 1, y - 1, wall.w + 2, wall.h + 2);
            ctx.fillStyle = "#ffd092";
            if (horizontal) {
                ctx.fillRect(x + 1, y + 1, Math.max(0, wall.w - 2), 2);
                ctx.fillStyle = "#4a233d";
                for (let seam = 32; seam < wall.w; seam += 40) {
                    ctx.fillRect(x + seam, y + 3, 2, Math.max(0, wall.h - 4));
                }
            } else {
                ctx.fillRect(x + 1, y + 1, 2, Math.max(0, wall.h - 2));
                ctx.fillStyle = "#4a233d";
                for (let seam = 32; seam < wall.h; seam += 40) {
                    ctx.fillRect(x + 3, y + seam, Math.max(0, wall.w - 4), 2);
                }
            }
        }
    }
}

function drawTank(ctx, player, cameraX, cameraY) {
    const x = player.x - cameraX;
    const y = player.y - cameraY;

    ctx.save();

    ctx.translate(x, y);
    ctx.rotate(player.angle);
    if (player.shrunk) ctx.scale(0.55, 0.55);

    ctx.fillStyle = "#151a1d";
    ctx.fillRect(-15, -13, 30, 6);
    ctx.fillRect(-15, 7, 30, 6);

    ctx.fillStyle = player.color;
    ctx.fillRect(-12, -10, 24, 20);

    ctx.fillStyle = "#d9e4e8";
    ctx.fillRect(-4, -5, 16, 10);

    ctx.fillStyle = "#303a40";
    ctx.beginPath();
    ctx.arc(-1, 0, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    ctx.fillStyle = "#ffffff";
    ctx.font = "12px Arial";
    ctx.textAlign = "center";

    ctx.fillText(
        player.username,
        x,
        y - 25
    );

    const barWidth = 42;
    const barHeight = 7;
    const barX = x - barWidth / 2;
    const barY = y - 18;

    const health = Math.max(
        0,
        Math.min(MAX_HEALTH, Number(player.health ?? MAX_HEALTH))
    );

    const healthPercent = health / MAX_HEALTH;

    ctx.fillStyle = "#242424";
    ctx.fillRect(barX, barY, barWidth, barHeight);

    if (healthPercent > 0.7) {
        ctx.fillStyle = "#39e75f";
    } else if (healthPercent > 0.3) {
        ctx.fillStyle = "#ffd43b";
    } else {
        ctx.fillStyle = "#ff4242";
    }

    ctx.fillRect(
        barX + 1,
        barY + 1,
        Math.max(0, (barWidth - 2) * healthPercent),
        barHeight - 2
    );

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barWidth, barHeight);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 10px Arial";

    ctx.fillText(
        `${health} HP`,
        x,
        y - 31
    );

    if (player.invulnerable) {
        ctx.save();
        const pulse = 20 + Math.sin(Date.now() / 90) * 3;
        ctx.strokeStyle = player.color || "#42d9ff";
        ctx.lineWidth = 2.5;
        ctx.shadowColor = player.color || "#42d9ff";
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(x, y, pulse, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = "rgba(255, 255, 255, 0.14)";
        ctx.beginPath();
        ctx.arc(x, y, pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    if (player.armored) {
        ctx.save();
        const pulse = 24 + Math.sin(Date.now() / 120) * 2;
        const armorColor = player.color || "#42d9ff";
        ctx.strokeStyle = armorColor;
        ctx.lineWidth = 3;
        ctx.shadowColor = armorColor;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(x, y, pulse, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }
}

function drawBullets(ctx, bullets, cameraX, cameraY) {
    for (const bullet of bullets) {
        const x = bullet.x - cameraX;
        const y = bullet.y - cameraY;

        if (bullet.type === "rocket") {
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(bullet.angle || 0);

            const time = Date.now() / 35 + bullet.x * 0.17;
            const flicker = Math.sin(time) * 2 + Math.cos(time * 1.7) * 1.2;
            const flameLength = 15 + flicker;

            ctx.shadowColor = "#ff5a19";
            ctx.shadowBlur = 15;
            const exhaust = ctx.createLinearGradient(-flameLength - 7, 0, -5, 0);
            exhaust.addColorStop(0, "rgba(255, 55, 15, 0)");
            exhaust.addColorStop(0.45, "#ff4b16");
            exhaust.addColorStop(0.78, "#ffad32");
            exhaust.addColorStop(1, "#fff4bd");
            ctx.fillStyle = exhaust;
            ctx.beginPath();
            ctx.moveTo(-5, -3.1);
            ctx.quadraticCurveTo(-flameLength * 0.45, -5.5 - flicker * 0.2, -flameLength - 7, 0);
            ctx.quadraticCurveTo(-flameLength * 0.45, 5.5 + flicker * 0.2, -5, 3.1);
            ctx.fill();

            ctx.shadowBlur = 0;
            ctx.fillStyle = "#fff8d4";
            ctx.beginPath();
            ctx.moveTo(-5, -1.15);
            ctx.quadraticCurveTo(-flameLength * 0.48, -2.2, -flameLength + flicker, 0);
            ctx.quadraticCurveTo(-flameLength * 0.48, 2.2, -5, 1.15);
            ctx.fill();

            ctx.fillStyle = "#424d54";
            ctx.beginPath();
            ctx.moveTo(-8, -4);
            ctx.lineTo(-13, -8);
            ctx.lineTo(-2, -5);
            ctx.lineTo(-2, 5);
            ctx.lineTo(-13, 8);
            ctx.lineTo(-8, 4);
            ctx.closePath();
            ctx.fill();

            const body = ctx.createLinearGradient(0, -5, 0, 5);
            body.addColorStop(0, "#ffffff");
            body.addColorStop(0.48, bullet.color || "#dce8ed");
            body.addColorStop(1, "#82939b");
            ctx.fillStyle = body;
            ctx.strokeStyle = "#30383d";
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(-9, -4.5);
            ctx.lineTo(4, -4.5);
            ctx.quadraticCurveTo(7, -4.5, 11, 0);
            ctx.quadraticCurveTo(7, 4.5, 4, 4.5);
            ctx.lineTo(-9, 4.5);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = "rgba(48, 67, 78, 0.82)";
            ctx.beginPath();
            ctx.ellipse(1, 0, 3, 1.9, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
            ctx.fillRect(-6, -2.8, 8, 0.8);
            ctx.restore();
            continue;
        }

        const color = bullet.color || (bullet.type === "gatling"
                ? "#fff2a8"
                : bullet.type === "bigBullet"
                    ? "#57c7ff"
                    : "#ffe66b");

        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.arc(x, y, bullet.radius || 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }
}

const skillLabels = {
    rocket: "Homing Rocket",
    mine: "Landmine",
    laser: "Wall Piercing Laser",
    bounceLaser: "Bouncing Laser",
    gatling: "Gatling Burst",
    bigBullet: "Big Bullet",
    shrink: "Shrink Tank",
    armor: "Armor",
    hpKit: "HP Kit (+50 HP)"
};

const skillColors = {
    rocket: "#ff713b",
    mine: "#343a40",
    laser: "#50d9ff",
    bounceLaser: "#ff5ce8",
    gatling: "#ffcf4b",
    bigBullet: "#54a8ff",
    shrink: "#b9f36b",
    armor: "#f2b84b",
    hpKit: "#65e879"
};

const BOUNCE_LASER_PREVIEW_LENGTH = 840;
const BOUNCE_LASER_PREVIEW_BOUNCES = 4;

function traceAimLaser(player, walls) {
    let x = player.x;
    let y = player.y;
    let dx = Math.cos(player.angle);
    let dy = Math.sin(player.angle);
    let remaining = BOUNCE_LASER_PREVIEW_LENGTH;
    const segments = [];

    for (let bounce = 0; bounce <= BOUNCE_LASER_PREVIEW_BOUNCES && remaining > 0; bounce++) {
        let nearest = null;
        for (const wall of walls) {
            const left = wall.x;
            const right = wall.x + wall.w;
            const top = wall.y;
            const bottom = wall.y + wall.h;
            let enterX = -Infinity;
            let exitX = Infinity;
            let enterY = -Infinity;
            let exitY = Infinity;
            if (Math.abs(dx) < 1e-9) {
                if (x < left || x > right) continue;
            } else if (dx > 0) {
                enterX = (left - x) / dx;
                exitX = (right - x) / dx;
            } else {
                enterX = (right - x) / dx;
                exitX = (left - x) / dx;
            }
            if (Math.abs(dy) < 1e-9) {
                if (y < top || y > bottom) continue;
            } else if (dy > 0) {
                enterY = (top - y) / dy;
                exitY = (bottom - y) / dy;
            } else {
                enterY = (bottom - y) / dy;
                exitY = (top - y) / dy;
            }
            const enter = Math.max(enterX, enterY);
            if (enter > Math.min(exitX, exitY) || enter < 0 || enter > remaining) continue;
            let normalX = 0;
            let normalY = 0;
            if (enterX > enterY + 1e-9) normalX = dx > 0 ? -1 : 1;
            else if (enterY > enterX + 1e-9) normalY = dy > 0 ? -1 : 1;
            else continue;
            if (!nearest || enter < nearest.distance) nearest = { distance: enter, normalX, normalY };
        }

        const distance = nearest ? nearest.distance : remaining;
        const endX = x + dx * distance;
        const endY = y + dy * distance;
        segments.push({ x1: x, y1: y, x2: endX, y2: endY });
        remaining -= distance;
        if (!nearest || bounce === BOUNCE_LASER_PREVIEW_BOUNCES) break;
        x = endX + nearest.normalX * 0.01;
        y = endY + nearest.normalY * 0.01;
        if (nearest.normalX) dx *= -1;
        if (nearest.normalY) dy *= -1;
    }
    return segments;
}

function drawBounceLaserAim(ctx, player, walls, cameraX, cameraY) {
    if (player.skill !== "bounceLaser" || player.eliminated) return;
    ctx.save();
    ctx.strokeStyle = player.color || "#ff5ce8";
    ctx.globalAlpha = 0.62;
    ctx.setLineDash([10, 7]);
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (const segment of traceAimLaser(player, walls)) {
        ctx.moveTo(segment.x1 - cameraX, segment.y1 - cameraY);
        ctx.lineTo(segment.x2 - cameraX, segment.y2 - cameraY);
    }
    ctx.stroke();
    ctx.restore();
}

function drawSkillPickups(ctx, pickups, cameraX, cameraY) {
    for (const pickup of pickups) {
        const x = pickup.x - cameraX;
        const y = pickup.y - cameraY;
        const color = skillColors[pickup.skill] || "#ffffff";

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = "#222";
        ctx.fillRect(-12, -12, 24, 24);
        ctx.fillStyle = color;
        ctx.fillRect(-9, -9, 18, 18);
        ctx.restore();

        ctx.save();
        ctx.fillStyle = "#101419";
        ctx.font = "bold 11px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(pickup.skill === "bigBullet" ? "B" : pickup.skill[0].toUpperCase(), x, y + 0.5);
        ctx.restore();
    }
}

function drawMines(ctx, mines, cameraX, cameraY) {
    for (const mine of mines) {
        const x = mine.x - cameraX;
        const y = mine.y - cameraY;
        ctx.save();
        ctx.fillStyle = mine.armTicks > 0 ? "#8a8a8a" : (mine.color || "#252525");
        ctx.strokeStyle = mine.color || "#f0d17a";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(x - 2, y - 2, 4, 4);
        ctx.restore();
    }
}

function drawSkillEffects(ctx, effects, cameraX, cameraY) {
    for (const effect of effects) {
        if (effect.type === "rocketSmoke") {
            ctx.save();
            ctx.globalAlpha = Math.min(0.5, effect.life / 24);
            ctx.fillStyle = effect.color || "#ffffff";
            ctx.shadowColor = effect.color || "#ffffff";
            ctx.shadowBlur = 9;
            ctx.beginPath();
            ctx.arc(effect.x - cameraX, effect.y - cameraY, effect.radius || 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        } else if (effect.type === "laser" || effect.type === "bounceLaser") {
            ctx.save();
            ctx.globalAlpha = Math.min(1, effect.life / 3);
            ctx.strokeStyle = effect.color || (effect.type === "bounceLaser" ? "#ff5ce8" : "#50d9ff");
            ctx.shadowColor = effect.color || (effect.type === "bounceLaser" ? "#ff5ce8" : "#50d9ff");
            ctx.shadowBlur = 18;
            ctx.lineWidth = 7;
            ctx.beginPath();
            const segments = effect.segments || [effect];
            for (const segment of segments) {
                ctx.moveTo(segment.x1 - cameraX, segment.y1 - cameraY);
                ctx.lineTo(segment.x2 - cameraX, segment.y2 - cameraY);
            }
            ctx.stroke();
            ctx.strokeStyle = "#ffffff";
            ctx.shadowBlur = 0;
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.restore();
        } else if (effect.type === "blast") {
            ctx.save();
            ctx.globalAlpha = effect.life / 10;
            ctx.strokeStyle = effect.color;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(effect.x - cameraX, effect.y - cameraY, (10 - effect.life) * 5 + 8, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }
    }
}

function getNearestEnemy(player) {
    if (!currentState || !currentState.players) {
        return null;
    }

    let nearestEnemy = null;
    let shortestDistance = Infinity;

    for (const enemy of currentState.players) {
        if (enemy.index === player.index || enemy.eliminated) {
            continue;
        }

        const distance = Math.hypot(
            enemy.x - player.x,
            enemy.y - player.y
        );

        if (distance < shortestDistance) {
            shortestDistance = distance;
            nearestEnemy = enemy;
        }
    }

    if (!nearestEnemy) {
        return null;
    }

    return {
        enemy: nearestEnemy,
        distance: shortestDistance
    };
}

function drawEnemyArrow(
    ctx,
    player,
    nearest,
    cameraX,
    cameraY,
    width,
    height
) {
    if (!nearest) {
        return;
    }

    const enemy = nearest.enemy;
    const indicatorColor = enemy.color || "#ff7777";

    const enemyScreenX = enemy.x - cameraX;
    const enemyScreenY = enemy.y - cameraY;

    const enemyVisible =
        enemyScreenX >= 0 &&
        enemyScreenX <= width &&
        enemyScreenY >= 0 &&
        enemyScreenY <= height;

    if (enemyVisible) {
        return;
    }

    const dx = enemy.x - player.x;
    const dy = enemy.y - player.y;

    const angle = Math.atan2(dy, dx);

    const centerX = width / 2;
    const centerY = height / 2;

    const margin = 32;

    const maxX = width / 2 - margin;
    const maxY = height / 2 - margin;

    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    const scaleX =
        Math.abs(cos) < 0.0001
            ? Infinity
            : maxX / Math.abs(cos);

    const scaleY =
        Math.abs(sin) < 0.0001
            ? Infinity
            : maxY / Math.abs(sin);

    const scale = Math.min(scaleX, scaleY);

    const arrowX = centerX + cos * scale;
    const arrowY = centerY + sin * scale;

    ctx.save();

    ctx.translate(arrowX, arrowY);
    ctx.rotate(angle);

    ctx.fillStyle = indicatorColor;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(-8, -9);
    ctx.lineTo(-4, 0);
    ctx.lineTo(-8, 9);
    ctx.closePath();

    ctx.fill();
    ctx.stroke();

    ctx.restore();

    const distanceText =
        `${Math.round(nearest.distance)} units`;

    ctx.save();

    ctx.fillStyle = indicatorColor;
    ctx.font = "bold 12px Arial";
    ctx.textAlign = "center";

    const labelY = Math.max(
        16,
        Math.min(height - 8, arrowY + 23)
    );

    ctx.fillText(
        `NEAREST ENEMY: ${distanceText}`,
        width / 2,
        labelY
    );

    ctx.restore();
}

function renderPlayerView(index) {
    if (!currentState || !currentState.players[index]) {
        return;
    }

    const canvas = canvases[index];
    const ctx = contexts[index];

    const player = currentState.players[index];

    const width = canvas.width;
    const height = canvas.height;

    let cameraX = player.x - width / 2;
    let cameraY = player.y - height / 2;

    cameraX = Math.max(
        0,
        Math.min(
            currentState.world.width - width,
            cameraX
        )
    );

    cameraY = Math.max(
        0,
        Math.min(
            currentState.world.height - height,
            cameraY
        )
    );

    drawGrid(
        ctx,
        width,
        height,
        cameraX,
        cameraY,
        currentState.world.tile
    );

    drawWalls(
        ctx,
        currentState.walls,
        cameraX,
        cameraY,
        width,
        height
    );

    drawSkillPickups(ctx, currentState.pickups || [], cameraX, cameraY);
    drawMines(ctx, currentState.mines || [], cameraX, cameraY);
    drawBounceLaserAim(ctx, player, currentState.walls || [], cameraX, cameraY);

    drawBullets(
        ctx,
        currentState.bullets,
        cameraX,
        cameraY
    );

    for (const tank of currentState.players) {
        if (tank.eliminated) continue;
        const screenX = tank.x - cameraX;
        const screenY = tank.y - cameraY;

        if (
            screenX < -50 ||
            screenY < -50 ||
            screenX > width + 50 ||
            screenY > height + 50
        ) {
            continue;
        }

        drawTank(ctx, tank, cameraX, cameraY);
    }

    drawSkillEffects(ctx, currentState.effects || [], cameraX, cameraY);

    drawVisualEffects(ctx, cameraX, cameraY);

    const nearest = getNearestEnemy(player);

    drawEnemyArrow(
        ctx,
        player,
        nearest,
        cameraX,
        cameraY,
        width,
        height
    );

    if (player.eliminated) {
        ctx.save();
        ctx.fillStyle = "rgba(0, 0, 0, 0.84)";
        ctx.fillRect(0, 0, width, height);
        ctx.textAlign = "center";
        ctx.fillStyle = "#ff6868";
        ctx.font = "bold 38px Arial";
        ctx.fillText("GAME OVER", width / 2, height / 2 - 10);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 17px Arial";
        ctx.fillText("Your death limit has been reached", width / 2, height / 2 + 25);
        ctx.restore();
    }

}

function updatePlayerInfo(player) {
    playerInfo[player.index].style.setProperty("--tank-color", player.color);
    playerInfo[player.index].textContent =
        `${player.username} | ` +
        `${player.teamIndex !== null && player.teamIndex !== undefined ? `Team ${player.teamIndex === 0 ? "Blue" : "Red"} | ` : ""}` +
        `ID: ${player.player_id} | ` +
        `Deaths: ${player.deaths || 0}/${currentState.deathLimit || 5} | ` +
        `Health: ${player.health}/${MAX_HEALTH} | ` +
        `Score: ${player.score} | ` +
        `Skill: ${player.skill ? `${skillLabels[player.skill]} x${player.skillUses || 1}` : "none"}` +
        `${player.shrunk ? " | SHRUNK" : ""}` +
        `${player.armored ? ` | ARMORED ${player.armorSeconds}s` : ""}`;
}

function renderAllViews() {
    updateVisualEffects();
    if (currentState?.players) currentState.players.forEach(updatePlayerInfo);
    if (localPlayerIndex >= 0) renderPlayerView(localPlayerIndex);
}

async function refreshLeaderboard() {
    try {
        const response = await fetch("api/leaderboard.php");

        if (!response.ok) {
            throw new Error("Could not load scores.");
        }

        leaderboardData = await response.json();
        renderSelectedLeaderboard();
    } catch (error) {
        console.error(error);
        leaderboardList.replaceChildren();
        const li = document.createElement("li");
        li.textContent = "Could not load the leaderboard.";
        leaderboardList.appendChild(li);
    }
}

function renderSelectedLeaderboard() {
    if (!leaderboardData) return;

    const selection = {
        scores: { players: leaderboardData.scores, value: player => `${player.total_score} points`, empty: "No scores yet." },
        kills: { players: leaderboardData.kills, value: player => `${player.kills} kills`, empty: "No kills yet." },
        wins: { players: leaderboardData.wins, value: player => `${player.wins} wins`, empty: "No wins yet." }
    }[leaderboardSort.value];

    renderLeaderboard(selection.players, selection.value, selection.empty);
}

function renderLeaderboard(players, statLabel, emptyMessage) {
    leaderboardList.replaceChildren();
    if (!players || players.length === 0) {
        const li = document.createElement("li");
        li.textContent = emptyMessage;
        leaderboardList.appendChild(li);
        return;
    }
    for (const player of players) {
        const li = document.createElement("li");
        li.textContent = `${player.username} (${player.player_id}) — ${statLabel(player)}`;
        leaderboardList.appendChild(li);
    }
}

leaderboardSort.addEventListener("change", renderSelectedLeaderboard);

document
    .getElementById("refreshLeaderboard")
    .addEventListener("click", refreshLeaderboard);
