import { answers, all } from "../assets/words.js";
import {
  GAMES_PER_DAY,
  MAX_GUESSES,
  WORD_LENGTH,
  buildKeyboardState,
  emptyGameState,
  getDailyAnswers,
  localDateKey,
  resultEmojiRows,
  scoreGuess
} from "./game.js";

const STORAGE_KEY = "dailo-state-v1";
const KEYBOARD_ROWS = ["qwertyuiop", "asdfghjkl", "enterzxcvbnmbackspace"];
const validWords = new Set(all);
const today = localDateKey();
const dailyAnswers = getDailyAnswers(today, answers);

const els = {
  board: document.querySelector("#board"),
  keyboard: document.querySelector("#keyboard"),
  dateLabel: document.querySelector("#date-label"),
  gameKicker: document.querySelector("#game-kicker"),
  gameProgress: document.querySelector("#game-progress"),
  gameMessage: document.querySelector("#game-message"),
  gameSwitcher: document.querySelector("#game-switcher"),
  shareButton: document.querySelector("#share-result-button"),
  toast: document.querySelector("#toast"),
  confetti: document.querySelector("#confetti"),
  streakCount: document.querySelector("#streak-count"),
  helpModal: document.querySelector("#help-modal"),
  statsModal: document.querySelector("#stats-modal"),
  shareModal: document.querySelector("#share-modal"),
  shareCanvas: document.querySelector("#share-canvas"),
  historyList: document.querySelector("#history-list"),
  statPlayed: document.querySelector("#stat-played"),
  statWinRate: document.querySelector("#stat-win-rate"),
  statStreak: document.querySelector("#stat-streak")
};

let state = loadState();
let activeGame = Number(state.activeGame) || 0;
let isAnimating = false;
let viewportSyncFrame = 0;

function syncViewportHeight() {
  cancelAnimationFrame(viewportSyncFrame);
  viewportSyncFrame = requestAnimationFrame(() => {
    const height = window.visualViewport?.height || window.innerHeight;
    document.documentElement.style.setProperty("--app-height", `${Math.round(height)}px`);
    requestAnimationFrame(() => {
      const settledHeight = window.visualViewport?.height || window.innerHeight;
      document.documentElement.style.setProperty("--app-height", `${Math.round(settledHeight)}px`);
    });
  });
}

function syncThemeColor() {
  const lightColor = document.querySelector('meta[name="theme-color"][media*="light"]');
  const darkColor = document.querySelector('meta[name="theme-color"][media*="dark"]');
  if (lightColor) lightColor.content = "#f8faf6";
  if (darkColor) darkColor.content = "#111827";
}

syncViewportHeight();
const colorScheme = window.matchMedia("(prefers-color-scheme: light)");
syncThemeColor(colorScheme);
colorScheme.addEventListener?.("change", syncThemeColor);
window.addEventListener("resize", syncViewportHeight);
window.addEventListener("orientationchange", syncViewportHeight);
window.visualViewport?.addEventListener("resize", syncViewportHeight);
window.visualViewport?.addEventListener("scroll", syncViewportHeight);

function loadState() {
  const fallback = { activeGame: 0, days: {} };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || typeof saved !== "object") return fallback;
    saved.days ||= {};
    return saved;
  } catch {
    return fallback;
  }
}

function todayState() {
  state.days[today] ||= { games: Array.from({ length: GAMES_PER_DAY }, emptyGameState) };
  while (state.days[today].games.length < GAMES_PER_DAY) state.days[today].games.push(emptyGameState());
  return state.days[today];
}

function currentGame() {
  return todayState().games[activeGame];
}

function saveState() {
  state.activeGame = activeGame;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function friendlyDate() {
  return new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(new Date());
}

function render() {
  const game = currentGame();
  const answer = dailyAnswers[activeGame];
  els.dateLabel.textContent = friendlyDate();
  els.gameKicker.textContent = `Game ${activeGame + 1} of ${GAMES_PER_DAY}`;
  els.gameProgress.textContent = `${game.guesses.length} / ${MAX_GUESSES} guesses`;
  renderBoard(game, answer);
  renderKeyboard(game, answer);
  renderSwitcher();
  renderMessage(game, answer);
  renderStats();
  els.shareButton.hidden = game.status === "playing";
}

function renderBoard(game, answer) {
  els.board.replaceChildren();
  for (let rowIndex = 0; rowIndex < MAX_GUESSES; rowIndex += 1) {
    const row = document.createElement("div");
    row.className = "board-row";
    row.dataset.row = rowIndex;
    const submitted = game.guesses[rowIndex];
    const draft = rowIndex === game.guesses.length && game.status === "playing" ? game.draft : "";
    const letters = submitted || draft || "";
    const score = submitted ? scoreGuess(submitted, answer) : [];

    for (let column = 0; column < WORD_LENGTH; column += 1) {
      const tile = document.createElement("div");
      const letter = letters[column] || "";
      tile.className = "tile";
      tile.dataset.column = column;
      if (letter) tile.classList.add("has-letter");
      if (submitted) tile.classList.add(score[column]);
      tile.textContent = letter;
      row.append(tile);
    }
    els.board.append(row);
  }
}

function renderKeyboard(game, answer) {
  const keyStates = buildKeyboardState(game.guesses, answer);
  els.keyboard.replaceChildren();
  KEYBOARD_ROWS.forEach((row, rowIndex) => {
    const rowEl = document.createElement("div");
    rowEl.className = "keyboard-row";
    const keys = rowIndex === 2 ? ["enter", ..."zxcvbnm", "backspace"] : [...row];
    keys.forEach((key) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "key";
      button.dataset.key = key;
      if (key === "enter" || key === "backspace") button.classList.add("wide");
      if (keyStates[key]) button.classList.add(keyStates[key]);
      button.setAttribute("aria-label", key === "backspace" ? "Delete letter" : key === "enter" ? "Submit guess" : key.toUpperCase());
      if (key === "backspace") {
        button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 3H7c-.69 0-1.23.35-1.59.88L0 12l5.41 8.12c.36.53.9.88 1.59.88h15c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2Zm-3 12.59L17.59 17 14 13.41 10.41 17 9 15.59 12.59 12 9 8.41 10.41 7 14 10.59 17.59 7 19 8.41 15.41 12 19 15.59Z"/></svg>';
      } else {
        button.textContent = key.toUpperCase();
      }
      rowEl.append(button);
    });
    els.keyboard.append(rowEl);
  });
}

function renderSwitcher() {
  const games = todayState().games;
  els.gameSwitcher.querySelectorAll(".game-pill").forEach((button, index) => {
    const game = games[index];
    button.classList.toggle("is-active", index === activeGame);
    button.toggleAttribute("aria-current", index === activeGame);
    button.dataset.status = game.status !== "playing" ? game.status : game.guesses.length ? "playing" : "not-started";
    const indicator = button.querySelector("i");
    indicator.setAttribute("aria-label", game.status === "won" ? "Won" : game.status === "lost" ? "Not solved" : game.guesses.length ? "In progress" : "Not started");
  });
}

function renderMessage(game, answer) {
  if (game.status === "won") {
    const tries = game.guesses.length;
    els.gameMessage.innerHTML = `<span>Lovely — solved in <strong>${tries} ${tries === 1 ? "try" : "tries"}</strong></span>`;
  } else if (game.status === "lost") {
    els.gameMessage.innerHTML = `<span>Today's word was <strong>${answer.toUpperCase()}</strong></span>`;
  } else {
    els.gameMessage.innerHTML = "<span>Guess a five-letter word</span>";
  }
}

function handleInput(key) {
  if (isAnimating) return;
  const game = currentGame();
  if (game.status !== "playing") return;

  if (key === "backspace") {
    game.draft = game.draft.slice(0, -1);
    saveState();
    render();
    return;
  }

  if (key === "enter") {
    submitGuess();
    return;
  }

  if (/^[a-z]$/.test(key) && game.draft.length < WORD_LENGTH) {
    game.draft += key;
    saveState();
    render();
    const tile = els.board.querySelector(`[data-row="${game.guesses.length}"] [data-column="${game.draft.length - 1}"]`);
    tile?.classList.add("pop");
  }
}

async function submitGuess() {
  const game = currentGame();
  if (game.draft.length < WORD_LENGTH) {
    rejectRow("Not enough letters");
    return;
  }
  if (!validWords.has(game.draft)) {
    rejectRow("Not in Dailo's word list");
    return;
  }

  const guess = game.draft;
  const answer = dailyAnswers[activeGame];
  const rowIndex = game.guesses.length;
  game.guesses.push(guess);
  game.draft = "";
  if (guess === answer) {
    game.status = "won";
    game.completedAt = new Date().toISOString();
  } else if (game.guesses.length === MAX_GUESSES) {
    game.status = "lost";
    game.completedAt = new Date().toISOString();
  }
  saveState();
  render();

  isAnimating = true;
  const tiles = [...els.board.querySelectorAll(`[data-row="${rowIndex}"] .tile`)];
  tiles.forEach((tile, index) => {
    tile.style.animationDelay = `${index * 95}ms`;
    tile.classList.add("reveal");
  });
  await wait(760);
  isAnimating = false;
  render();

  if (game.status === "won") {
    celebrate();
    toast(["Beautiful!", "Well played!", "That's the one!", "Lovely work!"][Math.floor(Math.random() * 4)]);
  } else if (game.status === "lost") {
    toast(`The word was ${answer.toUpperCase()}`);
  }
}

function rejectRow(message) {
  toast(message);
  const row = els.board.querySelector(`[data-row="${currentGame().guesses.length}"]`);
  row?.querySelectorAll(".tile").forEach((tile) => tile.classList.add("shake"));
  setTimeout(() => row?.querySelectorAll(".tile").forEach((tile) => tile.classList.remove("shake")), 500);
}

function toast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => els.toast.classList.remove("show"), 1900);
}

function celebrate() {
  const colors = ["#a3e635", "#facc15", "#ff725e", "#f8fafc"];
  for (let index = 0; index < 42; index += 1) {
    const piece = document.createElement("i");
    piece.className = "confetti-piece";
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = colors[index % colors.length];
    piece.style.setProperty("--drift", `${(Math.random() - 0.5) * 14}rem`);
    piece.style.animationDelay = `${Math.random() * 300}ms`;
    els.confetti.append(piece);
    setTimeout(() => piece.remove(), 2400);
  }
}

function renderStats() {
  const completed = Object.values(state.days).flatMap((day) => day.games || []).filter((game) => game.status !== "playing");
  const wins = completed.filter((game) => game.status === "won").length;
  const streak = calculateStreak();
  els.statPlayed.textContent = String(completed.length);
  els.statWinRate.textContent = completed.length ? `${Math.round((wins / completed.length) * 100)}%` : "0%";
  els.statStreak.textContent = String(streak);
  els.streakCount.textContent = String(streak);

  const days = Object.entries(state.days).sort(([a], [b]) => b.localeCompare(a)).slice(0, 7);
  els.historyList.replaceChildren();
  if (!days.length) {
    const empty = document.createElement("div");
    empty.className = "history-empty";
    empty.textContent = "Finish a game and your recent days will appear here.";
    els.historyList.append(empty);
    return;
  }
  days.forEach(([dateKey, day]) => {
    const row = document.createElement("div");
    row.className = "history-day";
    const date = new Date(`${dateKey}T12:00:00`);
    const label = document.createElement("strong");
    label.textContent = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
    const marks = document.createElement("div");
    Array.from({ length: GAMES_PER_DAY }, (_, index) => day.games?.[index]?.status || "playing").forEach((status) => {
      const mark = document.createElement("span");
      if (status !== "playing") mark.classList.add(status);
      mark.setAttribute("aria-label", status === "won" ? "Won" : status === "lost" ? "Not solved" : "Not played");
      marks.append(mark);
    });
    row.append(label, marks);
    els.historyList.append(row);
  });
}

function calculateStreak() {
  const dateKeys = Object.keys(state.days).sort().reverse();
  if (!dateKeys.length) return 0;
  const cursor = new Date();
  if (!hasWin(localDateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (hasWin(localDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function hasWin(dateKey) {
  return state.days[dateKey]?.games?.some((game) => game.status === "won") || false;
}

function shareText() {
  const game = currentGame();
  const rows = resultEmojiRows(game.guesses, dailyAnswers[activeGame]);
  const score = game.status === "won" ? game.guesses.length : "X";
  return `Dailo ${today} · ${activeGame + 1}/3 · ${score}/${MAX_GUESSES}\n\n${rows.join("\n")}\n\nPlay today's trio`;
}

function drawShareCard() {
  const canvas = els.shareCanvas;
  const ctx = canvas.getContext("2d");
  const game = currentGame();
  const answer = dailyAnswers[activeGame];
  const rows = game.guesses.map((guess) => scoreGuess(guess, answer));
  ctx.fillStyle = "#111827";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const glow = ctx.createRadialGradient(540, 0, 0, 540, 0, 680);
  glow.addColorStop(0, "rgba(163,230,53,.22)");
  glow.addColorStop(1, "rgba(17,24,39,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, canvas.width, 800);

  ctx.fillStyle = "#a3e635";
  roundRect(ctx, 100, 94, 118, 118, 30);
  ctx.fill();
  ctx.fillStyle = "#111827";
  ctx.font = "800 74px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("D", 159, 178);
  ctx.textAlign = "left";
  ctx.fillStyle = "#fffdf7";
  ctx.font = "800 70px system-ui";
  ctx.fillText("Dailo", 252, 170);
  ctx.fillStyle = "#8d96a5";
  ctx.font = "500 29px system-ui";
  ctx.fillText("your daily word trio", 256, 207);

  ctx.fillStyle = "#fffdf7";
  ctx.font = "800 58px system-ui";
  ctx.fillText(game.status === "won" ? "A lovely little win." : "Tomorrow is a new trio.", 100, 330);
  ctx.fillStyle = "#a3e635";
  ctx.font = "700 27px system-ui";
  ctx.fillText(`${today}  ·  GAME ${activeGame + 1} OF 3  ·  ${game.status === "won" ? `${game.guesses.length}/${MAX_GUESSES}` : `X/${MAX_GUESSES}`}`, 100, 385);

  const size = 108;
  const gap = 18;
  const startX = (canvas.width - (size * 5 + gap * 4)) / 2;
  const startY = 455;
  rows.forEach((row, rowIndex) => {
    row.forEach((result, column) => {
      ctx.fillStyle = result === "correct" ? "#5f9513" : result === "present" ? "#9a7610" : "#3b4658";
      roundRect(ctx, startX + column * (size + gap), startY + rowIndex * (size + gap), size, size, 20);
      ctx.fill();
    });
  });
  ctx.fillStyle = "#6f7887";
  ctx.font = "500 27px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("Three fresh words are waiting tomorrow.", 540, 1265);
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
}

function canvasBlob() {
  return new Promise((resolve) => els.shareCanvas.toBlob(resolve, "image/png"));
}

async function shareImage() {
  const blob = await canvasBlob();
  const file = new File([blob], `dailo-${today}-${activeGame + 1}.png`, { type: "image/png" });
  if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
    try {
      await navigator.share({ title: "My Dailo", text: shareText(), files: [file] });
      return;
    } catch (error) {
      if (error.name === "AbortError") return;
    }
  }
  downloadBlob(blob);
  toast("Image saved — ready to share");
}

async function saveImage() {
  downloadBlob(await canvasBlob());
  toast("Share image saved");
}

function downloadBlob(blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `dailo-${today}-${activeGame + 1}.png`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function copyResult() {
  try {
    await navigator.clipboard.writeText(shareText());
    toast("Emoji result copied");
  } catch {
    toast("Copy wasn't available here");
  }
}

function openModal(modal) {
  if (typeof modal.showModal === "function") modal.showModal();
}

function wait(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

els.keyboard.addEventListener("click", (event) => {
  const key = event.target.closest("[data-key]");
  if (!key) return;
  key.classList.add("pressed");
  setTimeout(() => key.classList.remove("pressed"), 120);
  handleInput(key.dataset.key);
});

document.addEventListener("keydown", (event) => {
  if ([...document.querySelectorAll("dialog")].some((dialog) => dialog.open)) return;
  const key = event.key.toLowerCase();
  if (key === "backspace" || key === "enter" || /^[a-z]$/.test(key)) {
    event.preventDefault();
    handleInput(key);
    const button = els.keyboard.querySelector(`[data-key="${key}"]`);
    button?.classList.add("pressed");
    setTimeout(() => button?.classList.remove("pressed"), 100);
  }
});

els.gameSwitcher.addEventListener("click", (event) => {
  const button = event.target.closest("[data-game]");
  if (!button || isAnimating) return;
  activeGame = Number(button.dataset.game);
  saveState();
  render();
});

document.querySelector("#help-button").addEventListener("click", () => openModal(els.helpModal));
document.querySelector("#stats-button").addEventListener("click", () => { renderStats(); openModal(els.statsModal); });
document.querySelector("#streak-chip").addEventListener("click", () => { renderStats(); openModal(els.statsModal); });
document.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", () => button.closest("dialog").close()));
document.querySelectorAll("dialog").forEach((dialog) => dialog.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
}));

els.shareButton.addEventListener("click", () => { drawShareCard(); openModal(els.shareModal); });
document.querySelector("#native-share-button").addEventListener("click", shareImage);
document.querySelector("#save-image-button").addEventListener("click", saveImage);
document.querySelector("#copy-result-button").addEventListener("click", copyResult);

if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js"));

todayState();
saveState();
render();
