(() => {
  const WORD_LENGTH = 5;
  const MAX_GUESSES = 6;
  const root = document.querySelector("#replay-root");
  const board = document.querySelector("#replay-board");
  const meta = document.querySelector("#replay-meta");
  const help = document.querySelector("#replay-help");
  const revealButton = document.querySelector("#reveal-button");
  const error = document.querySelector("#replay-error");
  const colors = { 0: "absent", 1: "present", 2: "correct" };
  const CLEAR_DURATION = 260;
  const TILE_STAGGER = 68;
  const ROW_INTERVAL = 820;
  const FLIP_DURATION = 480;

  function decodeToken(token) {
    try {
      if (typeof token !== "string" || !token || token.length > 512 || !/^[A-Za-z0-9_-]+$/.test(token)) return null;
      const base64 = token.replaceAll("-", "+").replaceAll("_", "/");
      const padded = base64 + "=".repeat((4 - base64.length % 4) % 4);
      const payload = JSON.parse(atob(padded));
      if (payload?.v !== 1 || !/^\d{4}-\d{2}-\d{2}$/.test(payload.d) || !Number.isInteger(payload.g) || payload.g < 0 || payload.g > 2) return null;
      if (!Array.isArray(payload.l) || !payload.l.length || payload.l.length > MAX_GUESSES || payload.l.some((word) => typeof word !== "string" || !/^[a-z]{5}$/.test(word))) return null;
      if (!Array.isArray(payload.r) || payload.r.length !== payload.l.length || payload.r.some((row) => typeof row !== "string" || !/^[012]{5}$/.test(row))) return null;
      return { date: payload.d, gameIndex: payload.g, guesses: payload.l, results: payload.r };
    } catch {
      return null;
    }
  }

  // New links use ?r=...; retain fragment support for previously shared links.
  const search = new URLSearchParams(location.search);
  const fragment = new URLSearchParams(location.hash.slice(1));
  const replay = decodeToken(search.get("r") || fragment.get("r"));

  if (!replay) {
    board.hidden = true;
    meta.hidden = true;
    help.hidden = true;
    revealButton.hidden = true;
    error.hidden = false;
    return;
  }

  try {
    const date = new Date(`${replay.date}T12:00:00`);
    const dateLabel = new Intl.DateTimeFormat(undefined, { dateStyle: "long" }).format(date);
    meta.textContent = `${dateLabel}\nGame ${replay.gameIndex + 1} of 3 · ${replay.guesses.length}/${MAX_GUESSES} guesses`;

    for (let rowIndex = 0; rowIndex < MAX_GUESSES; rowIndex += 1) {
      const row = document.createElement("div");
      row.className = "replay-row";
      for (let column = 0; column < WORD_LENGTH; column += 1) {
        const tile = document.createElement("div");
        tile.className = "replay-tile";
        const resultCode = replay.results[rowIndex]?.[column];
        if (resultCode !== undefined) {
          const color = colors[resultCode];
          tile.classList.add(color);
          tile.dataset.row = String(rowIndex);
          tile.dataset.column = String(column);
          tile.setAttribute("aria-label", `Guess ${rowIndex + 1}, letter ${column + 1}, ${color}`);
        } else {
          tile.setAttribute("aria-hidden", "true");
        }
        row.append(tile);
      }
      board.append(row);
    }

    revealButton.addEventListener("click", () => {
      const tiles = [...board.querySelectorAll(".replay-tile[data-row]")];
      const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      revealButton.disabled = true;
      revealButton.textContent = "Revealing…";
      help.textContent = "Watch each guess come back to life.";
      tiles.forEach((tile) => {
        tile.classList.remove("absent", "present", "correct", "is-flipping");
        tile.classList.add("is-waiting");
        tile.textContent = "";
        tile.setAttribute("aria-label", `Guess ${Number(tile.dataset.row) + 1}, letter ${Number(tile.dataset.column) + 1}, hidden`);
      });

      const revealTile = (tile, row, column, animate) => {
        const color = colors[replay.results[row][column]];
        tile.classList.remove("is-waiting");
        tile.classList.add(color);
        if (animate) tile.classList.add("is-flipping");
        tile.textContent = replay.guesses[row][column].toUpperCase();
        tile.setAttribute("aria-label", `${replay.guesses[row][column].toUpperCase()}, ${color}`);
        if (animate) setTimeout(() => tile.classList.remove("is-flipping"), FLIP_DURATION);
      };

      if (reduceMotion) {
        tiles.forEach((tile) => revealTile(tile, Number(tile.dataset.row), Number(tile.dataset.column), false));
        revealButton.textContent = "Letters revealed";
        help.textContent = "Here are the letters from each guess.";
        return;
      }

      board.classList.add("is-clearing");
      setTimeout(() => {
        board.classList.remove("is-clearing");
        const showWord = (rowIndex) => {
          const wordTiles = tiles.filter((tile) => Number(tile.dataset.row) === rowIndex);
          wordTiles.forEach((tile) => {
            const column = Number(tile.dataset.column);
            setTimeout(() => revealTile(tile, rowIndex, column, true), column * TILE_STAGGER);
          });
          if (rowIndex + 1 < replay.guesses.length) setTimeout(() => showWord(rowIndex + 1), ROW_INTERVAL);
        };
        showWord(0);
      }, CLEAR_DURATION);

      const finishAfter = CLEAR_DURATION + (replay.guesses.length - 1) * ROW_INTERVAL + (WORD_LENGTH - 1) * TILE_STAGGER + FLIP_DURATION;
      setTimeout(() => {
        revealButton.textContent = "Letters revealed";
        help.textContent = "Here are the letters from each guess.";
      }, finishAfter);
    }, { once: true });
  } catch {
    root.dataset.replayError = "render";
    board.hidden = true;
    meta.hidden = true;
    help.hidden = true;
    revealButton.hidden = true;
    error.hidden = false;
  }
})();
