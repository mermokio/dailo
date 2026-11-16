import { answers, all } from "../assets/words.js";
import {
  GAMES_PER_DAY,
  MAX_GUESSES,
  WORD_LENGTH,
  areVerticallyStackedSegments,
  buildKeyboardState,
  emptyGameState,
  encodeReplayToken,
  findEmptyDraftSlot,
  getDailyAnswers,
  localDateKey,
  normalizeDraft,
  resultEmojiRows,
  scoreGuess
} from "./game.js";

const STORAGE_KEY = "dailo-v2-state-v1";
const KEYBOARD_ROWS = ["qwertyuiop", "asdfghjkl", ["z", "x", "c", "v", "b", "n", "m", "backspace"]];
const validWords = new Set(all);
const today = localDateKey();
const dailyAnswers = getDailyAnswers(today, answers);
const shareIcon = new Image();
shareIcon.src = new URL("../assets/icon-home.png", import.meta.url).href;

const els = {
  board: document.querySelector("#board"),
  keyboard: document.querySelector("#keyboard"),
  keyboardWrap: document.querySelector("#keyboard-wrap"),
  dateLabel: document.querySelector("#date-label"),
  gameKicker: document.querySelector("#game-kicker"),
  gameProgress: document.querySelector("#game-progress"),
  gameMessage: document.querySelector("#game-message"),
  gameSwitcher: document.querySelector("#game-switcher"),
  shareButton: document.querySelector("#share-result-button"),
  submitButton: document.querySelector("#submit-guess-button"),
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
let selectedTileIndex = 0;
let isAnimating = false;
let viewportSyncFrame = 0;
let orientationSyncTimers = [];

function syncViewportHeight() {
  cancelAnimationFrame(viewportSyncFrame);
  viewportSyncFrame = requestAnimationFrame(() => {
    const height = window.visualViewport?.height || window.innerHeight;
    document.documentElement.style.setProperty("--app-height", `${Math.round(height)}px`);
  });
}

function syncViewportAfterOrientationChange() {
  orientationSyncTimers.forEach(clearTimeout);
  syncViewportHeight();
  orientationSyncTimers = [100, 260, 520].map((delay) => setTimeout(syncViewportHeight, delay));
}

function syncThemeColor() {
  const lightColor = document.querySelector('meta[name="theme-color"][media*="light"]');
  const darkColor = document.querySelector('meta[name="theme-color"][media*="dark"]');
  if (lightColor) lightColor.content = "#f8faf6";
  if (darkColor) darkColor.content = "#111827";
}

const stackedSegmentsQuery = window.matchMedia("(vertical-viewport-segments: 2)");

syncViewportHeight();
const colorScheme = window.matchMedia("(prefers-color-scheme: light)");
syncThemeColor(colorScheme);
colorScheme.addEventListener?.("change", syncThemeColor);
window.addEventListener("resize", syncViewportHeight);
window.addEventListener("orientationchange", syncViewportAfterOrientationChange);
window.visualViewport?.addEventListener("resize", syncViewportHeight);

function hasVerticallyStackedSegments() {
  try {
    return areVerticallyStackedSegments(Array.from(window.viewport?.segments || []));
  } catch {
    return false;
  }
}

function syncFoldLayout() {
  const stacked = stackedSegmentsQuery.matches || hasVerticallyStackedSegments();
  // Two stacked viewport segments are sufficient to identify the requested
  // top/bottom layout, even if Safari does not expose Device Posture yet.
  document.body.classList.toggle("folded-stacked-mode", stacked);
}

syncFoldLayout();
try {
  navigator.devicePosture?.addEventListener?.("change", syncFoldLayout);
} catch {
  // Unsupported or restricted posture APIs leave the standard layout untouched.
}
window.addEventListener("resize", syncFoldLayout);
window.addEventListener("orientationchange", syncFoldLayout);
window.visualViewport?.addEventListener("resize", syncFoldLayout);
stackedSegmentsQuery.addEventListener?.("change", syncFoldLayout);

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
  state.days[today].games.forEach((game) => {
    if (!Array.isArray(game.draft) || game.draft.length !== WORD_LENGTH || game.draft.some((letter) => letter && !/^[a-z]$/.test(letter))) {
      game.draft = normalizeDraft(game.draft);
    }
  });
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
  els.submitButton.hidden = game.status !== "playing";
  els.keyboardWrap.hidden = game.status !== "playing";
  els.submitButton.disabled = game.status !== "playing" || game.draft.some((letter) => !letter);
}

function renderBoard(game, answer) {
  els.board.replaceChildren();
  for (let rowIndex = 0; rowIndex < MAX_GUESSES; rowIndex += 1) {
    const row = document.createElement("div");
    row.className = "board-row";
    row.dataset.row = rowIndex;
    const submitted = game.guesses[rowIndex];
    const isDraftRow = rowIndex === game.guesses.length && game.status === "playing";
    const draft = isDraftRow ? game.draft : [];
    const score = submitted ? scoreGuess(submitted, answer) : [];

    for (let column = 0; column < WORD_LENGTH; column += 1) {
      const tile = document.createElement("div");
      const letter = submitted ? submitted[column] : draft[column] || "";
      tile.className = "tile";
      tile.dataset.column = column;
      tile.dataset.row = rowIndex;
      if (letter) tile.classList.add("has-letter");
      if (isDraftRow) {
        tile.tabIndex = 0;
        tile.setAttribute("role", "button");
        tile.setAttribute("aria-label", `Letter slot ${column + 1}${letter ? `, ${letter.toUpperCase()}` : ", empty"}`);
        tile.setAttribute("aria-pressed", String(column === selectedTileIndex));
        if (column === selectedTileIndex) tile.classList.add("selected");
      } else {
        tile.tabIndex = -1;
      }
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
  KEYBOARD_ROWS.forEach((row) => {
    const rowEl = document.createElement("div");
    rowEl.className = "keyboard-row";
    const keys = Array.isArray(row) ? row : [...row];
    keys.forEach((key) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "key";
      button.dataset.key = key;
      if (key === "backspace") button.classList.add("wide");
      if (keyStates[key]) button.classList.add(keyStates[key]);
      button.setAttribute("aria-label", key === "backspace" ? "Delete letter" : key.toUpperCase());
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
  const unlockedThrough = nextPlayableGameIndex(games);
  els.gameSwitcher.querySelectorAll(".game-pill").forEach((button, index) => {
    const game = games[index];
    button.disabled = index > unlockedThrough;
    button.classList.toggle("is-active", index === activeGame);
    button.toggleAttribute("aria-current", index === activeGame);
    button.dataset.status = game.status !== "playing" ? game.status : game.guesses.length ? "playing" : "not-started";
    const indicator = button.querySelector("img");
    const complete = game.status !== "playing";
    indicator.src = `./assets/game-${index + 1}-${complete ? "complete" : "incomplete"}.png`;
    indicator.alt = `Game ${index + 1}, ${game.status === "won" ? "complete" : game.status === "lost" ? "finished" : game.guesses.length ? "in progress" : "not started"}`;
    button.title = button.disabled ? `Finish game ${index} before starting this game` : `Open game ${index + 1}`;
    button.setAttribute("aria-label", button.disabled ? `Game ${index + 1}, locked until game ${index} is finished` : `Game ${index + 1}`);
  });
}

function nextPlayableGameIndex(games) {
  const nextPlaying = games.findIndex((game) => game.status === "playing");
  return nextPlaying === -1 ? GAMES_PER_DAY - 1 : nextPlaying;
}

function renderMessage(game, answer) {
  if (game.status === "won") {
    const tries = game.guesses.length;
    els.gameMessage.innerHTML = `<span>Lovely — solved in <strong>${tries} ${tries === 1 ? "try" : "tries"}</strong></span>`;
  } else if (game.status === "lost") {
    els.gameMessage.innerHTML = `<span>Today's word was <strong>${answer.toUpperCase()}</strong></span>`;
  } else {
    els.gameMessage.replaceChildren();
  }
}

function handleInput(key) {
  if (isAnimating) return;
  const game = currentGame();
  if (game.status !== "playing") return;

  if (key === "backspace") {
    let target = selectedTileIndex;
    if (!game.draft[target]) {
      for (let offset = 1; offset < WORD_LENGTH; offset += 1) {
        const previous = (selectedTileIndex - offset + WORD_LENGTH) % WORD_LENGTH;
        if (game.draft[previous]) { target = previous; break; }
      }
    }
    game.draft[target] = "";
    selectedTileIndex = target;
    saveState();
    render();
    return;
  }

  if (key === "enter") {
    submitGuess();
    return;
  }

  if (/^[a-z]$/.test(key)) {
    const enteredIndex = selectedTileIndex;
    game.draft[enteredIndex] = key;
    selectedTileIndex = findEmptyDraftSlot(game.draft, (enteredIndex + 1) % WORD_LENGTH);
    if (selectedTileIndex === -1) selectedTileIndex = enteredIndex;
    saveState();
    render();
    const tile = els.board.querySelector(`[data-row="${game.guesses.length}"] [data-column="${enteredIndex}"]`);
    tile?.classList.add("pop");
  }
}

async function submitGuess() {
  const game = currentGame();
  if (game.draft.some((letter) => !letter)) {
    rejectRow("Not enough letters");
    return;
  }
  const guess = game.draft.join("");
  if (!validWords.has(guess)) {
    rejectRow("Not in Dailo's word list");
    return;
  }

  const answer = dailyAnswers[activeGame];
  const rowIndex = game.guesses.length;
  game.guesses.push(guess);
  game.draft = normalizeDraft([]);
  selectedTileIndex = 0;
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

function replayUrl() {
  const token = encodeReplayToken(today, activeGame, currentGame().guesses, dailyAnswers[activeGame]);
  const url = new URL("./replay.html", window.location.href);
  // Keep the payload in the query string: some mobile share previews discard URL fragments.
  url.searchParams.set("r", token);
  return url.href;
}

function shareText(replayLink) {
  const game = currentGame();
  const rows = resultEmojiRows(game.guesses, dailyAnswers[activeGame]);
  const score = game.status === "won" ? game.guesses.length : "X";
  return `Dailo ${today} · ${activeGame + 1}/3 · ${score}/${MAX_GUESSES}\n\n${rows.join("\n")}\n\n${replayLink}`;
}

async function drawShareCard() {
  const canvas = els.shareCanvas;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");
  if (!shareIcon.complete) {
    await new Promise((resolve, reject) => {
      shareIcon.addEventListener("load", resolve, { once: true });
      shareIcon.addEventListener("error", reject, { once: true });
    });
  }
  if (!shareIcon.naturalWidth) throw new Error("The Dailo share icon could not be loaded");
  const game = currentGame();
  const answer = dailyAnswers[activeGame];
  const rows = game.guesses.map((guess) => ({ guess, score: scoreGuess(guess, answer) }));
  ctx.fillStyle = "#e7f4e9";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const glow = ctx.createRadialGradient(540, 0, 0, 540, 0, 680);
  glow.addColorStop(0, "rgba(153,206,134,.24)");
  glow.addColorStop(1, "rgba(231,244,233,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, canvas.width, 800);

  ctx.drawImage(shareIcon, 100, 94, 118, 118);
  ctx.textAlign = "left";
  ctx.fillStyle = "#174e4a";
  ctx.font = "800 70px system-ui";
  ctx.fillText("Dailo", 252, 170);
  ctx.fillStyle = "#68827b";
  ctx.font = "500 29px system-ui";
  ctx.fillText("your daily word trio", 256, 207);

  ctx.fillStyle = "#174e4a";
  ctx.font = "800 58px system-ui";
  ctx.fillText(game.status === "won" ? "A lovely little win." : "Tomorrow is a new trio.", 100, 330);
  ctx.fillStyle = "#4f9a61";
  ctx.font = "700 27px system-ui";
  ctx.fillText(`${today}  ·  GAME ${activeGame + 1} OF 3  ·  ${game.status === "won" ? `${game.guesses.length}/${MAX_GUESSES}` : `X/${MAX_GUESSES}`}`, 100, 385);

  const size = 108;
  const gap = 18;
  const startX = (canvas.width - (size * 5 + gap * 4)) / 2;
  const startY = 455;
  Array.from({ length: MAX_GUESSES }, (_, rowIndex) => rows[rowIndex] || null).forEach((row, rowIndex) => {
    Array.from({ length: WORD_LENGTH }, (_, column) => {
      const x = startX + column * (size + gap);
      const y = startY + rowIndex * (size + gap);
      if (row) {
        ctx.fillStyle = row.score[column] === "correct" ? "#6cae70" : row.score[column] === "present" ? "#d6ae3c" : "#77868b";
        roundRect(ctx, x, y, size, size, 20);
        ctx.fill();
        ctx.fillStyle = "#fffdf4";
        ctx.font = "800 58px system-ui";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(row.guess[column].toUpperCase(), x + size / 2, y + size / 2);
      } else {
        ctx.lineWidth = 3;
        ctx.strokeStyle = "rgba(255,255,255,.12)";
        roundRect(ctx, x, y, size, size, 20);
        ctx.stroke();
      }
    });
  });
  ctx.fillStyle = "#68827b";
  ctx.font = "500 27px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("Three fresh words are waiting tomorrow.", 540, 1265);
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, width, height, radius);
    return;
  }
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.arcTo(x + width, y, x + width, y + radius, radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
  ctx.lineTo(x + radius, y + height);
  ctx.arcTo(x, y + height, x, y + height - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
}

async function canvasBlob() {
  await drawShareCard();
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const canvas = els.shareCanvas;
  const blob = typeof canvas.toBlob === "function"
    ? await new Promise((resolve) => canvas.toBlob(resolve, "image/png"))
    : null;
  if (blob) return blob;
  const dataUrl = canvas.toDataURL("image/png");
  const response = await fetch(dataUrl);
  return response.blob();
}

async function shareImage() {
  let blob;
  try {
    blob = await canvasBlob();
  } catch {
    toast("Couldn't create the share image. Please try again.");
    return;
  }
  const file = new File([blob], `dailo-${today}-${activeGame + 1}.png`, { type: "image/png" });
  if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (error) {
      if (error.name === "AbortError") return;
    }
  }
  toast("Image sharing isn't supported here. Try Share emoji result instead.");
}

async function shareEmojiResult() {
  if (!navigator.share) {
    toast("Sharing isn't supported in this browser.");
    return;
  }
  try {
    await navigator.share({ title: "My Dailo", text: shareText(replayUrl()) });
  } catch (error) {
    if (error.name !== "AbortError") toast("Couldn't open the share sheet. Please try again.");
  }
}

function openModal(modal) {
  if (typeof modal.showModal === "function") modal.showModal();
}

function wait(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

function selectDraftTile(index) {
  const game = currentGame();
  if (game.status !== "playing" || isAnimating) return;
  selectedTileIndex = index;
  els.board.querySelectorAll(".tile[data-row]").forEach((tile) => {
    const selected = Number(tile.dataset.row) === game.guesses.length && Number(tile.dataset.column) === selectedTileIndex;
    tile.classList.toggle("selected", selected);
    if (tile.hasAttribute("aria-pressed")) tile.setAttribute("aria-pressed", String(selected));
  });
}

els.board.addEventListener("click", (event) => {
  const tile = event.target.closest(".tile[data-row][data-column]");
  if (!tile || Number(tile.dataset.row) !== currentGame().guesses.length) return;
  selectDraftTile(Number(tile.dataset.column));
});

els.board.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const tile = event.target.closest(".tile[data-row][data-column]");
  if (!tile || Number(tile.dataset.row) !== currentGame().guesses.length) return;
  event.preventDefault();
  event.stopPropagation();
  selectDraftTile(Number(tile.dataset.column));
});

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
  if (!button || button.disabled || isAnimating) return;
  activeGame = Number(button.dataset.game);
  selectedTileIndex = findEmptyDraftSlot(currentGame().draft);
  if (selectedTileIndex === -1) selectedTileIndex = WORD_LENGTH - 1;
  saveState();
  render();
});

document.querySelector("#help-button").addEventListener("click", () => openModal(els.helpModal));
document.querySelector("#streak-chip").addEventListener("click", () => { renderStats(); openModal(els.statsModal); });
document.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", () => button.closest("dialog").close()));
document.querySelectorAll("dialog").forEach((dialog) => dialog.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
}));

els.shareButton.addEventListener("click", async () => {
  try {
    await drawShareCard();
    openModal(els.shareModal);
  } catch {
    toast("Couldn't create the share image. Please try again.");
  }
});
els.submitButton.addEventListener("click", submitGuess);
document.querySelector("#native-share-button").addEventListener("click", shareImage);
document.querySelector("#share-emoji-button").addEventListener("click", shareEmojiResult);

if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js"));

const gamesToday = todayState().games;
activeGame = Math.max(0, Math.min(activeGame, nextPlayableGameIndex(gamesToday)));
selectedTileIndex = findEmptyDraftSlot(gamesToday[activeGame].draft);
if (selectedTileIndex === -1) selectedTileIndex = WORD_LENGTH - 1;
saveState();
render();
