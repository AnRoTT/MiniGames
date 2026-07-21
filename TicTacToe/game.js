const board = document.getElementById("board");
const status = document.getElementById("status");
const reset = document.getElementById("reset");

/* --- Sound System --- */
const clickSound = new Audio("sounds/Click.mp3");
clickSound.volume = 0.4;

function playClick() {
    clickSound.currentTime = 0;
    clickSound.play().catch(() => {});
}

let cells = Array(9).fill(null);
let current = "X";
let gameOver = false;

// NEU: Wir lesen jetzt aus den globalen Variablen aus dem HTML
let mode = "human"; // "human" oder "bot"
let botLevel = 1; // 1-5
let totalRounds = 1; // 1,3,5,7
let scoreX = 0;
let scoreO = 0;
let scoreDraw = 0; // NEU
let roundsPlayed = 0;
let startingPlayer = "X";
let winRowGlobal = null;

/* ⭐ NEU: Flags für "Neue Runde" */
let matchOver = false;
let waitingForNextRound = false;

/* ⭐ Adaptive KI Skill-Wert */
let playerSkill = 50;
let adaptSpeed = "normal"; // slow, normal, fast, veryfast

/* --- Rundenmodus Variable --- */
let roundMode = "short"; // "short", "full", "tournament"

/* NEU: Variablen aus den Cycle-Buttons holen */
function readSettings() {
    mode = window.currentPlayers;
    botLevel = window.currentDifficulty;
    totalRounds = window.currentRounds;
    roundMode = window.currentMode;
    adaptSpeed = window.currentAdapt;
}

/* Render Board */
function render() {
    board.innerHTML = "";
    cells.forEach((value, i) => {
        const cell = document.createElement("div");
        cell.className = "cell";
        cell.innerHTML = value? `<span class="mark ${value}">${value}</span>` : "";
        if (!value &&!gameOver &&!waitingForNextRound) {
            cell.dataset.ghost = current;
        }
        if (winRowGlobal && winRowGlobal.includes(i)) {
            cell.classList.add("win");
        }
        cell.onclick = () => move(i);
        board.appendChild(cell);
    });
}

/* Particles */
function spawnParticles(x, y) {
    for (let i = 0; i < 10; i++) {
        const p = document.createElement("div");
        p.className = "particle";
        const angle = Math.random() * Math.PI * 2;
        const dist = 20 + Math.random() * 20;
        p.style.left = x + "px";
        p.style.top = y + "px";
        p.style.setProperty("--px", Math.cos(angle) * dist + "px");
        p.style.setProperty("--py", Math.sin(angle) * dist + "px");
        document.body.appendChild(p);
        setTimeout(() => p.remove(), 400);
    }
}

/* ⭐ Adaptive Level bestimmen */
function getAdaptiveLevel() {
    if (playerSkill < 30) return 1;
    if (playerSkill < 60) return 2;
    if (playerSkill < 85) return 3;
    return 4;
}

function adapt(value) {
    switch (adaptSpeed) {
        case "slow": return value * 0.5;
        case "normal": return value;
        case "fast": return value * 1.5;
        case "veryfast": return value * 2.2;
    }
}

function getAdaptiveLevelName(level) {
    return ["Leicht", "Mittel", "Schwer", "Perfekt"][level - 1];
}

/* ⭐ Fehlerquote */
function applyAdaptiveError(index) {
    const errorChance = (100 - playerSkill) / 150;
    if (Math.random() < errorChance) {
        return botRandom();
    }
    return index;
}

/* Bot Preview */
function botPreview() {
    if (botLevel === 5) {
        const adaptiveLevel = getAdaptiveLevel();
        if (adaptiveLevel === 1) return botRandom();
        if (adaptiveLevel === 2) return botMedium();
        if (adaptiveLevel === 3) return botHard();
        if (adaptiveLevel === 4) return botPerfect();
    }
    if (botLevel === 1) return botRandom();
    if (botLevel === 2) return botMedium();
    if (botLevel === 3) return botHard();
    if (botLevel === 4) return botPerfect();
}

/* Player Move */
function move(i) {
    if (cells[i] || gameOver || waitingForNextRound) return;

    cells[i] = current;
    playClick();
    if (adaptSpeed === "veryfast") {
        playerSkill += 1.2;
        playerSkill = Math.max(0, Math.min(100, playerSkill));
    }
    board.children[i].classList.add("pop");
    const rect = board.children[i].getBoundingClientRect();
    spawnParticles(rect.left + rect.width / 2, rect.top + rect.height / 2);

    const winRow = checkWin(current);
    if (winRow) return endRound(current, winRow);
    if (!cells.includes(null)) return endRound("draw");

    current = current === "X"? "O" : "X";
    if (botLevel!== 5) {
        status.textContent = `${current} ist dran`;
    }
    render();

    if (mode === "bot" && current === "O" &&!gameOver &&!waitingForNextRound) {
        const adaptiveLevel = getAdaptiveLevel();
        const delay = botLevel === 5
        ? 400 + adaptiveLevel * 250
            : {1: 300 + Math.random() * 200, 2: 500 + Math.random() * 300, 3: 700 + Math.random() * 400, 4: 1000 + Math.random() * 500}[botLevel];

        const ghostIndex = botPreview();
        board.children[ghostIndex].dataset.ghost = "O";
        board.classList.add("bot-thinking");

        setTimeout(() => {
            if(waitingForNextRound) return;
            board.children[ghostIndex].dataset.ghost = "";
            board.classList.remove("bot-thinking");
            botMove();
        }, delay);
    }
}

/* Bot Move */
function botMove() {
    if(waitingForNextRound) return;
    let moveIndex;
    if (botLevel === 5) {
        const adaptiveLevel = getAdaptiveLevel();
        status.textContent = `Adaptiver Bot (aktuell: ${getAdaptiveLevelName(adaptiveLevel)})`;
        if (adaptiveLevel === 1) moveIndex = botRandom();
        if (adaptiveLevel === 2) moveIndex = botMedium();
        if (adaptiveLevel === 3) moveIndex = botHard();
        if (adaptiveLevel === 4) moveIndex = botPerfect();
        moveIndex = applyAdaptiveError(moveIndex);
    } else {
        if (botLevel === 1) moveIndex = botRandom();
        if (botLevel === 2) moveIndex = botMedium();
        if (botLevel === 3) moveIndex = botHard();
        if (botLevel === 4) moveIndex = botPerfect();
    }
    cells[moveIndex] = "O";
    playClick();
    if (adaptSpeed === "veryfast") {
        playerSkill -= 1.2;
        playerSkill = Math.max(0, Math.min(100, playerSkill));
    }
    board.children[moveIndex].classList.add("pop");
    const rect = board.children[moveIndex].getBoundingClientRect();
    spawnParticles(rect.left + rect.width / 2, rect.top + rect.height / 2);

    const winRow = checkWin("O");
    if (winRow) return endRound("O", winRow);
    if (!cells.includes(null)) return endRound("draw");

    current = "X";
    if (botLevel!== 5) {
        status.textContent = "X ist dran";
    }
    render();
}

/* Bot Logic */
function botRandom() {
    const free = cells.map((v, i) => v === null? i : null).filter(v => v!== null);
    return free[Math.floor(Math.random() * free.length)];
}
function botMedium() { return botBlockOrRandom(); }
function botHard() { return botWinOrBlockOrRandom(); }
function botPerfect() { return minimax(cells, "O").index; }
function botBlockOrRandom() {
    const block = findCritical("X");
    return block!== null? block : botRandom();
}
function botWinOrBlockOrRandom() {
    const win = findCritical("O");
    if (win!== null) return win;
    const block = findCritical("X");
    return block!== null? block : botRandom();
}
function findCritical(player) {
    const wins = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    for (let w of wins) {
        const [a,b,c] = w;
        const line = [cells[a], cells[b], cells[c]];
        if (line.filter(v => v === player).length === 2 && line.includes(null)) {
            return w[line.indexOf(null)];
        }
    }
    return null;
}

/* Minimax */
function minimax(boardState, player) {
    const free = boardState.map((v, i) => v === null? i : null).filter(v => v!== null);
    if (checkWin("X", boardState)) return { score: -10 };
    if (checkWin("O", boardState)) return { score: 10 };
    if (free.length === 0) return { score: 0 };
    const moves = [];
    for (let i of free) {
        const newState = [...boardState];
        newState[i] = player;
        const result = minimax(newState, player === "O"? "X" : "O");
        moves.push({ index: i, score: result.score });
    }
    return player === "O"? moves.reduce((best, m) => m.score > best.score? m : best) : moves.reduce((best, m) => m.score < best.score? m : best);
}

/* Win Check */
function checkWin(p, state = cells) {
    const wins = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    for (let w of wins) {
        if (w.every(i => state[i] === p)) {
            return w;
        }
    }
    return null;
}

/* Highlight Win - nur Text pulsieren */
function highlightWin(row, winner) {
    row.forEach(i => {
        const cell = board.children[i];
        cell.classList.add("win");
    });
}

/* Shake Board */
function shakeBoard() {
    board.classList.add("shake");
    setTimeout(() => board.classList.remove("shake"), 500);
}

/* Firework Effect */
function fireworkEffect() {
    const container = document.body;
    const centerX = window.innerWidth / 2;
    const centerY = board.offsetTop + board.offsetHeight / 2;
    const colors = ["#3d7dff", "#00e5ff", "#a970ff", "#34C759", "#ffcc00", "#ff2a2a"];
    for (let i = 0; i < 60; i++) {
        const fw = document.createElement("div");
        fw.className = "firework";
        const angle = Math.random() * Math.PI * 2;
        const distance = 120 + Math.random() * 180;
        fw.style.left = centerX + "px";
        fw.style.top = centerY + "px";
        fw.style.background = colors[Math.floor(Math.random() * colors.length)];
        const size = 6 + Math.random() * 14;
        fw.style.width = fw.style.height = size + "px";
        fw.style.setProperty("--dx", Math.cos(angle) * distance + "px");
        fw.style.setProperty("--dy", Math.sin(angle) * distance + "px");
        container.appendChild(fw);
        setTimeout(() => fw.remove(), 1000);
    }
}

/* End Round - MIT UNENTSCHIEDEN */
function endRound(winner, winRow = null) {
    gameOver = true;
    waitingForNextRound = true;
    winRowGlobal = winRow || null;
    render();
    if (winRow) highlightWin(winRow, winner);

    if (winner === "X") scoreX++;
    if (winner === "O") scoreO++;
    if (winner === "draw") scoreDraw++; // NEU
    roundsPlayed++;
    updateScore(scoreX, scoreDraw, scoreO); // GEÄNDERT

    if (mode === "bot") {
        if (winner === "O") shakeBoard();
        if (winner === "X") fireworkEffect();
    }

    startingPlayer = startingPlayer === "X"? "O" : "X";

    if (winner!== "draw") {
        if (winner === "X") playerSkill += 10;
        if (winner === "O") playerSkill -= 10;
    } else {
        playerSkill += adapt(2);
    }
    playerSkill = Math.max(0, Math.min(100, playerSkill));

    let message = "";
    let matchFinished = false;

    if (roundMode === "short") {
        const needed = Math.floor(totalRounds / 2) + 1;
        if (scoreX >= needed || scoreO >= needed) {
            matchFinished = true;
            message = scoreX > scoreO? "Gesamtsieger: X" : "Gesamtsieger: O";
        } else if (roundsPlayed >= totalRounds) {
            matchFinished = true;
            message = scoreX > scoreO? "Gesamtsieger: X" : scoreO > scoreX? "Gesamtsieger: O" : "Match Unentschieden!";
        } else {
            message = winner === "draw"? "Unentschieden!" : `${winner} gewinnt Runde ${roundsPlayed}!`;
        }

    } else if (roundMode === "tournament") {
        if (roundsPlayed >= totalRounds) {
            if (scoreX === scoreO) {
                totalRounds++;
                message = "Verlängerung! Gleichstand";
            } else {
                matchFinished = true;
                message = `Gesamtsieger: ${scoreX > scoreO? "X" : "O"}`;
            }
        } else {
            message = winner === "draw"? "Unentschieden!" : `${winner} gewinnt Runde ${roundsPlayed}!`;
        }

    } else { /* full */
        if (roundsPlayed >= totalRounds) {
            matchFinished = true;
            if (scoreX > scoreO) message = `Gesamtsieger: X ${scoreX}:${scoreO}`;
            else if (scoreO > scoreX) message = `Gesamtsieger: O ${scoreX}:${scoreO}`;
            else message = `Gesamt: Unentschieden! ${scoreX}:${scoreO}`;
        } else {
            message = winner === "draw"? "Unentschieden!" : `${winner} gewinnt Runde ${roundsPlayed}!`;
        }
    }

    matchOver = matchFinished;

    if(matchFinished){
        status.textContent = message + " | Klicke 'Match neustarten'";
        reset.textContent = "Match neustarten";
    } else {
        status.textContent = message + " | Klicke 'Neue Runde'";
        reset.textContent = "Neue Runde";
    }
}

/* Reset - ÜBERARBEITET */
function resetGame(full = true) {
    readSettings(); // NEU: Settings vor jedem Start neu einlesen
    cells = Array(9).fill(null);
    gameOver = false;
    waitingForNextRound = false;
    winRowGlobal = null;

    if (full) {
        matchOver = false;
        startingPlayer = "X";
        scoreX = 0;
        scoreO = 0;
        scoreDraw = 0; // NEU
        roundsPlayed = 0;
        updateScore(scoreX, scoreDraw, scoreO); // GEÄNDERT
    }

    current = startingPlayer;
    status.textContent = `Runde ${roundsPlayed+1}/${totalRounds} - ${current} beginnt`;
    reset.textContent = "Neu starten";
    render();

    if (mode === "bot" && current === "O" &&!matchOver) {
        setTimeout(botMove, 300);
    }
}

/* NEU: Reset Button Logik */
reset.onclick = () => {
    if(waitingForNextRound) {
        resetGame(false);
    } else {
        resetGame(true);
    }
};

/* initial start */
readSettings(); // NEU
resetGame(true);