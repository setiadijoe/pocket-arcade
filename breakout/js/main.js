import { BreakoutGame } from "./game.js";
import { BreakoutRenderer } from "./renderer.js";
import { attachControls } from "./controls.js";
import { BreakoutAudio } from "./audio.js";
import { getSavedPlayerName } from "../../shared/player-name.js";

function requireElement(id) {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Elemen game tidak ditemukan: #${id}`);
  return element;
}

const canvas = requireElement("game-canvas");
const scoreOutput = requireElement("score");
const livesOutput = requireElement("lives");
const levelOutput = requireElement("level");
const loopCount = requireElement("loop-count");
const overlay = requireElement("screen-overlay");
const overlayTitle = requireElement("overlay-title");
const overlayMessage = requireElement("overlay-message");
const upgradeStatus = requireElement("upgrade-status");
const statusMessage = requireElement("game-status");
const startButton = requireElement("start-button");
const topScoreName = requireElement("top-score-name");
const topScoreValue = requireElement("top-score-value");
const topScoreMessage = requireElement("top-score-message");
const viewHighScoresButton = requireElement("view-high-scores");
const highScoresDialog = requireElement("high-scores-dialog");
const highScoresList = requireElement("high-scores-list");
const loadMoreScoresButton = requireElement("load-more-scores");
const closeHighScoresButton = requireElement("close-high-scores");
const scoreSubmitDialog = requireElement("score-submit-dialog");
const scoreSubmitForm = requireElement("score-submit-form");
const gameOverScore = requireElement("game-over-score");
const scoreSubmitError = requireElement("score-submit-error");
const cancelScoreSubmitButton = requireElement("cancel-score-submit");
const mainMenuButton = requireElement("main-menu");
const retryGameButton = requireElement("retry-game");

const BREAKOUT_GAME_ID = import.meta.env.VITE_BREAKOUT_TITLE_GAME_ID;
const API_BASE_URL = import.meta.env.DEV
  ? window.location.origin
  : import.meta.env.VITE_API_BASE_URL || "https://api-games.nunbun.sbs";

const audio = new BreakoutAudio();
const game = new BreakoutGame({
  onSound: (type) => audio.play(type),
  onLevelComplete: () => audio.playLevelComplete()
});
const renderer = new BreakoutRenderer(canvas);
const pressedKeys = new Set();
let previousFrame = 0;
let lastInterfaceState = "";
let previousGameState = game.state;
let highScoresCursor = "";
let highScoresLoaded = 0;
let highScoresLoading = false;
let highScoresHasMore = true;

function makeScoresUrl(limit, cursor = "") {
  if (!BREAKOUT_GAME_ID) throw new Error("Set VITE_BREAKOUT_TITLE_GAME_ID in .env");
  const url = new URL("/api/scores", API_BASE_URL);
  url.searchParams.set("title_game_id", BREAKOUT_GAME_ID);
  url.searchParams.set("limit", String(limit));
  if (cursor) url.searchParams.set("cursor", cursor);
  return url;
}

async function fetchScores(limit, cursor = "") {
  const response = await fetch(makeScoresUrl(limit, cursor));
  if (!response.ok) throw new Error(`Tidak dapat memuat skor (${response.status})`);
  const page = await response.json();
  if (
    !page ||
    !Array.isArray(page.scores) ||
    typeof page.nextCursor !== "string" ||
    page.scores.some((entry) =>
      !entry || typeof entry.name !== "string" || !Number.isSafeInteger(entry.score)
    )
  ) {
    throw new Error("Server skor mengembalikan data yang tidak valid");
  }
  return page;
}

async function loadTopScore() {
  try {
    const page = await fetchScores(1);
    topScoreMessage.textContent = "";
    const [topScore] = page.scores;
    if (!topScore) {
      topScoreName.textContent = "NO RECORDS";
      topScoreValue.textContent = "------";
      return;
    }
    topScoreName.textContent = topScore.name;
    topScoreValue.textContent = String(topScore.score).padStart(6, "0");
  } catch (error) {
    console.error("Tidak dapat memuat skor tertinggi", error);
    topScoreName.textContent = "UNAVAILABLE";
    topScoreValue.textContent = "------";
    topScoreMessage.textContent = `Skor tidak dapat dimuat: ${error.message}`;
  }
}

function appendHighScores(scores) {
  for (const [index, entry] of scores.entries()) {
    const row = document.createElement("li");
    const rank = document.createElement("span");
    const name = document.createElement("span");
    const value = document.createElement("span");
    rank.className = "high-score-rank";
    name.className = "high-score-player";
    value.className = "high-score-points";
    rank.textContent = `${String(highScoresLoaded + index + 1).padStart(2, "0")}.`;
    name.textContent = entry.name;
    value.textContent = String(entry.score).padStart(6, "0");
    row.append(rank, name, value);
    highScoresList.append(row);
  }
  highScoresLoaded += scores.length;
}

async function loadHighScores(reset = false) {
  if (highScoresLoading || (!reset && !highScoresHasMore)) return;
  if (reset) {
    highScoresCursor = "";
    highScoresLoaded = 0;
    highScoresHasMore = true;
    highScoresList.replaceChildren();
    const message = document.createElement("li");
    message.className = "high-scores-message";
    message.textContent = "Memuat skor...";
    highScoresList.append(message);
  }

  highScoresLoading = true;
  loadMoreScoresButton.disabled = true;
  try {
    const page = await fetchScores(10, highScoresCursor);
    if (highScoresLoaded === 0) highScoresList.replaceChildren();
    appendHighScores(page.scores);
    if (highScoresLoaded === 0) {
      const message = document.createElement("li");
      message.className = "high-scores-message";
      message.textContent = "NO RECORDS";
      highScoresList.append(message);
    }
    highScoresCursor = page.nextCursor;
    highScoresHasMore = Boolean(page.nextCursor);
  } catch (error) {
    console.error("Tidak dapat memuat leaderboard", error);
    if (highScoresLoaded === 0) {
      highScoresList.replaceChildren();
      highScoresHasMore = false;
    }
    const message = document.createElement("li");
    message.className = "high-scores-message";
    message.textContent = highScoresLoaded === 0
      ? `Skor tidak dapat dimuat: ${error.message}`
      : "Tidak dapat memuat skor berikutnya.";
    highScoresList.append(message);
  } finally {
    highScoresLoading = false;
    loadMoreScoresButton.disabled = !highScoresHasMore;
    loadMoreScoresButton.hidden = !highScoresHasMore;
  }
}

function openScoreSubmitDialog() {
  gameOverScore.value = String(game.score).padStart(6, "0");
  gameOverScore.textContent = String(game.score).padStart(6, "0");
  scoreSubmitError.hidden = true;
  scoreSubmitError.textContent = "";
  scoreSubmitDialog.showModal();
}

async function submitGameOverScore(event) {
  event.preventDefault();
  const name = getSavedPlayerName().trim();
  if (!name || name.length > 30) {
    scoreSubmitError.textContent = "Nama pemain tidak tersedia. Kembali ke menu utama untuk mengisinya.";
    scoreSubmitError.hidden = false;
    return;
  }

  for (const button of scoreSubmitForm.querySelectorAll("button")) button.disabled = true;
  scoreSubmitError.hidden = true;
  try {
    if (!BREAKOUT_GAME_ID) throw new Error("Set VITE_BREAKOUT_TITLE_GAME_ID di .env");
    const response = await fetch(new URL("/api/scores", API_BASE_URL), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, score: game.score, game_id: BREAKOUT_GAME_ID })
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(
        result && typeof result.error === "string"
          ? result.error
          : `Tidak dapat menyimpan skor (${response.status})`
      );
    }

    statusMessage.textContent = `Skor ${game.score} disimpan untuk ${
      result && typeof result.name === "string" ? result.name : name
    }.`;
    scoreSubmitDialog.close();
    void loadTopScore();
  } catch (error) {
    scoreSubmitError.textContent = `Skor tidak dapat disimpan: ${error.message}`;
    scoreSubmitError.hidden = false;
  } finally {
    for (const button of scoreSubmitForm.querySelectorAll("button")) button.disabled = false;
  }
}

const actions = {
  toggle: toggleGame,
  start: startGame,
  pause: pauseGame,
  setShooting(shooting) {
    game.setShooting(shooting);
  },
  isPressed(code) {
    return pressedKeys.has(code);
  }
};

window.addEventListener("keydown", (event) => pressedKeys.add(event.code));
window.addEventListener("keyup", (event) => pressedKeys.delete(event.code));
attachControls(canvas, game, actions);

function startGame() {
  audio.unlock();
  if (game.state === "gameover") game.newGame();
  game.start();
  updateInterface();
}

function toggleGame() {
  if (game.state === "playing") pauseGame();
  else startGame();
}

function pauseGame() {
  if (game.state === "playing") game.pause();
  updateInterface();
}

function updateInterface() {
  const interfaceState = `${game.state}:${game.score}:${game.lives}:${game.level}:${game.loop}:${game.activeUpgrade}:${Math.ceil(game.upgradeTimer)}`;
  if (interfaceState === lastInterfaceState) return;
  lastInterfaceState = interfaceState;
  const gameJustEnded = game.state === "gameover" && previousGameState !== "gameover";
  previousGameState = game.state;
  if (gameJustEnded) audio.playGameOver();
  scoreOutput.value = String(game.score).padStart(4, "0");
  scoreOutput.textContent = String(game.score).padStart(4, "0");
  livesOutput.value = String(game.lives);
  livesOutput.textContent = String(game.lives);
  levelOutput.value = String(game.level).padStart(2, "0");
  levelOutput.textContent = String(game.level).padStart(2, "0");
  loopCount.textContent = `PUTARAN ${game.loop}`;
  upgradeStatus.hidden = !game.activeUpgrade;
  upgradeStatus.textContent = game.activeUpgrade === "wide" ? "PADDLE 2X"
    : game.activeUpgrade === "shooter" ? "TEKAN A UNTUK TEMBAK"
      : game.activeUpgrade === "shield" ? `DINDING ${Math.ceil(game.upgradeTimer)} DETIK` : "";
  startButton.textContent = game.state === "playing" ? "JEDA"
    : game.state === "paused" ? "LANJUT"
      : game.state === "gameover" ? "MAIN LAGI" : "MULAI";

  if (game.state === "playing") {
    overlay.hidden = true;
    statusMessage.textContent = `Permainan berlangsung. Level ${game.level}, putaran ${game.loop}. Skor ${game.score}. Sisa nyawa ${game.lives}.`;
  } else {
    overlay.hidden = false;
    if (game.state === "gameover") {
      overlayTitle.textContent = "GAME OVER";
      overlayMessage.textContent = `Skor akhir ${game.score}. Klik MAIN LAGI untuk bermain kembali.`;
      statusMessage.textContent = `Game over. Skor akhir ${game.score}.`;
    } else if (game.state === "paused") {
      overlayTitle.textContent = "DIJEDA";
      overlayMessage.textContent = "Tekan spasi atau LANJUT untuk kembali bermain";
      statusMessage.textContent = "Permainan dijeda.";
    } else {
      overlayTitle.textContent = "SIAP?";
      overlayMessage.textContent = `Level ${game.level} siap. Klik MULAI atau tekan spasi untuk meluncurkan bola.`;
      statusMessage.textContent = `Level ${game.level} siap. Tekan MULAI untuk meluncurkan bola.`;
    }
  }
  if (gameJustEnded) openScoreSubmitDialog();
}

function frame(timestamp) {
  const deltaSeconds = previousFrame ? (timestamp - previousFrame) / 1000 : 0;
  previousFrame = timestamp;
  game.update(deltaSeconds);
  renderer.draw(game);
  updateInterface();
  window.requestAnimationFrame(frame);
}

startButton.addEventListener("click", () => {
  if (game.state === "playing") pauseGame();
  else startGame();
});
viewHighScoresButton.addEventListener("click", () => {
  highScoresDialog.showModal();
  void loadHighScores(true);
});
loadMoreScoresButton.addEventListener("click", () => void loadHighScores());
closeHighScoresButton.addEventListener("click", () => highScoresDialog.close());
scoreSubmitForm.addEventListener("submit", (event) => {
  void submitGameOverScore(event);
});
cancelScoreSubmitButton.addEventListener("click", () => scoreSubmitDialog.close());
mainMenuButton.addEventListener("click", () => window.location.assign("/"));
retryGameButton.addEventListener("click", () => {
  scoreSubmitDialog.close();
  startGame();
});
window.addEventListener("resize", () => {
  renderer.resize();
  renderer.draw(game);
});

updateInterface();
void loadTopScore();
window.requestAnimationFrame(frame);
