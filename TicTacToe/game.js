const board = document.getElementById("board");
const status = document.getElementById("status");
const reset = document.getElementById("reset");
const winnerBanner = document.getElementById("winnerBanner");

/* --- Sound System --- */
const clickSound = new Audio("Click.mp3");
clickSound.volume = 0.4;

function playClick(volume = 0.4) {
    clickSound.volume = volume;
    clickSound.currentTime = 0;
    clickSound.play().catch(() => {});
}

let cells = Array(9).fill(null);
let current = "X";
let gameOver = false;

let mode = "human";
let botLevel = 1;
let totalRounds = 1;
let scoreX = 0;
let scoreO = 0;
let scoreDraw = 0;
let roundsPlayed = 0;
let startingPlayer = "X";
let winRowGlobal = null;

let matchOver = false;
let waitingForNextRound = false;

let playerSkill = 50;
let adaptSpeed = "normal";

let roundMode = "short";
let isInitialized = false;

/* ⭐ HABIT SYSTEM - wird pro Session gemerkt */
let habits = {
    favoriteCells: [0,0,0,0,0,0,0,0,0], // Zähler pro Feld
    mistakes: 0, // +1 wenn Spieler Fehler macht
    badOpenings: [0,0,0,0,0,0,0,0,0] // mit welchem Startzug Spieler verliert
};
let firstMoveMade = false; // für Eröffnung T2

function readSettings() {
    mode = window.currentPlayers;
    botLevel = window.currentDifficulty;
    totalRounds = window.currentRounds;
    roundMode = window.currentMode;
    adaptSpeed = window.currentAdapt;
}

/* NEU: Array mischen */
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

/* Render Board */
function render() {
    board.innerHTML = "";
    cells.forEach((value, i) => {
        const cell = document.createElement("div");
        cell.className = "cell";
        cell.innerHTML = value? `<span class="mark ${value}">${value}</span>` : "";

        const isLocked = gameOver || waitingForNextRound || board.classList.contains('locked');

        if (!value &&!isLocked) {
            cell.dataset.ghost = current;
        }
        if (winRowGlobal && winRowGlobal.includes(i)) {
            cell.classList.add("win");
        }
        if (!isLocked) {
            cell.onclick = () => move(i);
            cell.style.cursor = "pointer";
        } else {
            cell.style.cursor = "default";
        }
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
        case "veryfast": return value * 2.0;
    }
}

function getAdaptiveLevelName(level) {
    return ["Anfänger", "Hobbyspieler", "Vereinsspieler", "Meister"][level - 1];
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
	updateHabits(i, current);
    if(isMistake(i)) habits.mistakes++; // zählt deine Fehler
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

/* ⭐ HABIT HELPER */
function updateHabits(move, player) {
    if (player === "X") {
        habits.favoriteCells[move]++;
        if (!firstMoveMade) firstMoveMade = true;
    }
}

function getTopFavoriteCells(n) {
    return habits.favoriteCells
       .map((v, i) => ({i, v}))
       .sort((a,b) => b.v - a.v)
       .slice(0, n)
       .map(x => x.i);
}

function wouldWin(board, player, move) {
    const test = board.slice();
    test[move] = player;
    return checkWin(player, test)!== null;
}

function wouldFork(board, player, move) {
    const test = board.slice();
    test[move] = player;
    let wins = 0;
    for(let i=0; i<9; i++) {
        if(test[i] === null) {
            test[i] = player;
            if(checkWin(player, test)) wins++;
            test[i] = null;
        }
    }
    return wins >= 2;
}

/* T2: Perfekte Eröffnung */
function getPerfectOpening() {
    if (cells[4] === null) return 4; // Mitte
    const corners = [0,2,6,8].filter(i => cells[i] === null);
    if (corners.length) return corners[Math.floor(Math.random() * corners.length)];
    return null;
}

/* T4: Ist Zug ein Fehler? */
function isMistake(move) {
    // Fehler = nicht blocken wenn X gewinnen kann
    const block = findCritical("X");
    if(block!== null && move!== block) return true;
    return false;
}

/* Bot Move - MENSCHLICH */
function botMove() {
    if(waitingForNextRound) return;
    let moveIndex;

    if (botLevel === 5) {
        const adaptiveLevel = getAdaptiveLevel();
        status.textContent = `Adaptiver Bot (aktuell: ${getAdaptiveLevelName(adaptiveLevel)}) | Skill: ${playerSkill.toFixed(0)}`;
        moveIndex = botAdaptive();
    } else {
        if (botLevel === 1) moveIndex = botRandom();
        if (botLevel === 2) moveIndex = botMedium();
        if (botLevel === 3) moveIndex = botHard();
        if (botLevel === 4) moveIndex = botPerfect();
    }

    cells[moveIndex] = "O";
	if(isMistake(moveIndex)) habits.mistakes++; // falls Bot auch Fehler macht
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

/* === MENSCHLICHER BOT === */

/* Hilfsfunktion: Freie Felder */
function getFreeCells() {
    return cells.map((v, i) => v === null? i : null).filter(v => v!== null);
}

/* NEU: Hilfsfunktion für Zufall aus Top N */
function pickFromBest(moves, topN = 2) {
    const count = Math.min(topN, moves.length);
    if(count === 0) return null;
    return moves[Math.floor(Math.random() * count)];
}

/* NEU: Gibt alle gleich guten Minimax Züge zurück - GEMISCHT */
function getBestMovesFromMinimax(board, player) {
    let bestScore = -Infinity;
    let bestMoves = [];
    const free = shuffleArray(board.map((v, i) => v === null? i : null).filter(v => v!== null));

    for (let i of free) {
        const newBoard = board.slice();
        newBoard[i] = player;
        const result = minimax(newBoard, player === "O"? "X" : "O");
        const currentScore = player === "O"? result.score : -result.score;

        if (currentScore > bestScore) {
            bestScore = currentScore;
            bestMoves = [i];
        } else if (currentScore === bestScore) {
            bestMoves.push(i);
        }
    }
    return bestMoves;
}

/* GEÄNDERT: Menschliche Zug-Priorität: Mitte > Ecken > Kanten - JETZT GEMISCHT + 20% Kante statt Ecke */
function getHumanPriorityMoves() {
    const free = getFreeCells();
    const corners = shuffleArray([0,2,6,8].filter(i => free.includes(i)));
    const edges = shuffleArray([1,3,5,7].filter(i => free.includes(i)));

    let priority = [];
    if(free.includes(4)) priority.push(4);

    // 80% Chance: klassisch Ecken vor Kanten
    // 20% Chance: "Druckfehler" - Kanten vor Ecken
    if(Math.random() < 0.8) {
        priority.push(...corners);
        priority.push(...edges);
    } else {
        priority.push(...edges);
        priority.push(...corners);
    }

    return priority;
}

/* Bot Level 1: Zufall + 10% Lieblingsfeld */
function botRandom() {
    const free = getFreeCells();
    const habitRoll = Math.random();

    // 10% nimmt Lieblingsfeld
    if(habitRoll < 0.1) {
        const fav = getTopFavoriteCells(1)[0];
        if(fav!== undefined && cells[fav] === null) return fav;
    }

    // 20% dummer Kanten-Zug
    if(Math.random() < 0.2) {
        const badMoves = free.filter(i =>![0,2,4,6,8].includes(i));
        if(badMoves.length > 0) return badMoves[Math.floor(Math.random() * badMoves.length)];
    }
    return free[Math.floor(Math.random() * free.length)];
}

/* Bot Level 2: 30% Lieblingsfeld blocken + Blocken/Gewinnen */
function botMedium() {
    const habitStrength = 0.6; // war 0.3

    // 60% blockt Top-2 Lieblingsfelder statt nur 1
    if(Math.random() < habitStrength) {
        const favs = getTopFavoriteCells(2);
        const favMove = favs.find(i => cells[i] === null);
        if(favMove!== undefined) return favMove;
    }

    const win = findCritical("O");
    if(win!== null && Math.random() < 0.7) return win;

    const block = findCritical("X");
    if(block!== null && Math.random() < 0.6) return block;

    return pickFromBest(getHumanPriorityMoves(), 2) || botRandom();
}

/* Bot Level 3: 60% Lieblingsfeld + T1 70% + T2 50% + T3 70% + T4 */
function botHard() {
    const habitStrength = 0.9; // 1. war 0.6 -> jetzt 90% merkt er dich
    const free = getFreeCells();

    // T2: 80% Perfekte Eröffnung - 2. war 0.5
    const movesMade = cells.filter(c => c!== null).length;
    if(movesMade < 2 && Math.random() < 0.8) {
        const opening = getPerfectOpening();
        if(opening!== null) return opening;
    }

    // 90% blockt Top-3 Lieblingsfelder - 3. war Top-2 mit 60%
    if(Math.random() < habitStrength) {
        const favs = getTopFavoriteCells(3);
        const favMove = favs.find(i => cells[i] === null);
        if(favMove!== undefined) return favMove;
    }

    const win = findCritical("O");
    if(win!== null) return win;

    const block = findCritical("X");
    if(block!== null && Math.random() < 1.0) return block; // 4. war 0.9 -> blockt jetzt IMMER

    // T1: 90% Gabel stellen - 5. war 0.7
    if(Math.random() < 0.9) {
        const fork = free.find(i => wouldFork(cells, "O", i));
        if(fork!== undefined) return fork;
    }

    // T3: 90% Gegen-Gabel - 6. war 0.7
    if(Math.random() < 0.9) {
        const antiFork = free.find(i => wouldFork(cells, "X", i));
        if(antiFork!== undefined) {
            return free[Math.floor(Math.random() * free.length)];
        }
    }

    // T4: Ab 2 Fehlern +80% aggressiv - 7. war >=3 und 0.6
    if(habits.mistakes >= 2 && Math.random() < 0.8) {
        const fork = free.find(i => wouldFork(cells, "O", i));
        if(fork!== undefined) return fork;
    }

    if(Math.random() < 0.1) { // 8. war 0.15 -> nur noch 10% Denkfehler
        return pickFromBest(getHumanPriorityMoves(), 3) || botRandom();
    }

    return pickFromBest(getHumanPriorityMoves(), 2) || botRandom();
}

/* Bot Level 4: 100% Lieblingsfeld + T1-T4 Immer + Minimax + 10% Patzer */
function botPerfect() {
    // T2: 100% Perfekte Eröffnung
    const movesMade = cells.filter(c => c!== null).length;
    if(movesMade < 2) {
        const opening = getPerfectOpening();
        if(opening!== null) return opening;
    }

    // 80% blockt Top-3 Lieblingsfelder - war 0.3
    const favs = getTopFavoriteCells(3);
    const favMove = favs.find(i => cells[i] === null);
    if(favMove!== undefined && Math.random() < 0.8) return favMove;

    const win = findCritical("O");
    if(win!== null) return win;

    const block = findCritical("X");
    if(block!== null) return block;

    // T1: Gabel immer
    const fork = getFreeCells().find(i => wouldFork(cells, "O", i));
    if(fork!== undefined) return fork;

    // T3: Gegen-Gabel immer
    const antiFork = getFreeCells().find(i => wouldFork(cells, "X", i));
    if(antiFork!== undefined) return antiFork;

    // T4: Fehler-Farmer immer aktiv
    if(habits.mistakes >= 1) {
        const fork = getFreeCells().find(i => wouldFork(cells, "O", i));
        if(fork!== undefined) return fork;
    }

    const bestMoves = getBestMovesFromMinimax(cells, "O");
    let move = pickFromBest(bestMoves, bestMoves.length);

    // 5% Patzer statt 10% - fast perfekt
    if(Math.random() < 0.05) {
        move = pickFromBest(getHumanPriorityMoves(), 3) || move;
    }
    return move;
}

/* Bot Level 5: Adaptive */
function botAdaptive() {
    const adaptiveLevel = getAdaptiveLevel();
    let moveIndex;
    if (adaptiveLevel === 1) moveIndex = botRandom();
    if (adaptiveLevel === 2) moveIndex = botMedium();
    if (adaptiveLevel === 3) moveIndex = botHard();
    if (adaptiveLevel === 4) moveIndex = botPerfect();
    return applyAdaptiveError(moveIndex);
}

/* findCritical bleibt gleich */
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

/* Minimax bleibt gleich */
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
    if (winner === "draw") scoreDraw++;
    roundsPlayed++;
    updateScore(scoreX, scoreDraw, scoreO);

    if (mode === "bot") {
        if (winner === "O") shakeBoard();
        if (winner === "X") fireworkEffect();
    }

    startingPlayer = startingPlayer === "X"? "O" : "X";

    if (winner!== "draw") {
        if (winner === "X") playerSkill += adapt(10);
        if (winner === "O") playerSkill -= adapt(10);
    } else {
        playerSkill += adapt(2);
    }
    playerSkill = Math.max(0, Math.min(100, playerSkill));

    let adaptiveStatus = "";
    if (botLevel === 5) {
        const newAdaptiveLevel = getAdaptiveLevel();
        adaptiveStatus = `Adaptiver Bot (Neu: ${getAdaptiveLevelName(newAdaptiveLevel)}) | Skill: ${playerSkill.toFixed(0)} `;
    }

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
    let parts = [];
    if (botLevel === 5) {
        const newAdaptiveLevel = getAdaptiveLevel();
        parts.push(`Adaptiver Bot (Neu: ${getAdaptiveLevelName(newAdaptiveLevel)}) | Skill: ${playerSkill.toFixed(0)}`);
    } else {
        parts.push(`Match beendet`);
    }
    status.textContent = parts.join(" | ") + " | Klicke 'Neues Spiel'";
    let winnerText = "";
    if (scoreX > scoreO) winnerText = "Gesamtsieger: X";
    else if (scoreO > scoreX) winnerText = "Gesamtsieger: O";
    else winnerText = "Gesamt: Unentschieden!";
    winnerBanner.textContent = winnerText;
    winnerBanner.classList.add("show");
    reset.textContent = "Neues Spiel";
} else {
    status.textContent = adaptiveStatus + message + " | Klicke 'Neue Runde'";
    winnerBanner.classList.remove("show");
    winnerBanner.textContent = "";
    reset.textContent = "Neue Runde";
}
}

/* Reset - ÜBERARBEITET */
function resetGame(full = true) {
    readSettings();
    cells = Array(9).fill(null);
    waitingForNextRound = false;
    winRowGlobal = null;

    if(isInitialized) {
        gameOver = false;
        board.classList.remove('locked');
    }

    if (full) {
		status.classList.remove("winner");
        matchOver = false;
        startingPlayer = "X";
        scoreX = 0;
        scoreO = 0;
        scoreDraw = 0;
        roundsPlayed = 0;
        updateScore(scoreX, scoreDraw, scoreO);
		winnerBanner.classList.remove("show");
        winnerBanner.textContent = "";
    }

    current = startingPlayer;
    status.textContent = full? `Runde 1/${totalRounds} - ${current} beginnt` : `Runde ${roundsPlayed+1}/${totalRounds} - ${current} beginnt`;
    reset.textContent = "Neu starten";
    render();

    if (mode === "bot" && current === "O" &&!matchOver) {
        setTimeout(botMove, 300);
    }
}

/* NEU: Reset Button Logik */
reset.onclick = () => {
    if(matchOver) {
        resetGame(true);
    } else if(waitingForNextRound) {
        resetGame(false);
    } else {
        resetGame(true);
    }
};

/* initial start - Board beim Start sperren */
function init() {
    readSettings();
    cells = Array(9).fill(null);
    gameOver = true;
    board.classList.add('locked');
    matchOver = false;
    status.textContent = "Einstellungen wählen und 'Neues Spiel' klicken";
    reset.textContent = "Neues Spiel";
    render();
    isInitialized = true;
}

/* ⭐ NEU: Sound für alle Cycle-Buttons */
document.querySelectorAll('.cycle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        playClick(0.2);
    });
});

/* ⭐ NEU: Sound für Reset Button */
reset.addEventListener('click', () => {
    playClick(0.2);
});

/* ⭐ NEU: Sound für Back Button */
const backBtn = document.getElementById("backIcon");
if(backBtn) {
    backBtn.addEventListener('click', () => {
        playClick(0.2);
        setTimeout(() => {
            window.location.href = "../index.html?menu=1";
        }, 100);
    });
}

init();