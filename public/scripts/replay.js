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
    meta.textContent = `${new Intl.DateTimeFormat(undefined, { dateStyle: "long" }).format(date)} · Game ${replay.gameIndex + 1} of 3 · ${replay.guesses.length}/${MAX_GUESSES} guesses`;

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
      board.querySelectorAll(".replay-tile[data-row]").forEach((tile) => {
        const row = Number(tile.dataset.row);
        const column = Number(tile.dataset.column);
        const letter = replay.guesses[row][column].toUpperCase();
        tile.textContent = letter;
        tile.setAttribute("aria-label", `${letter}, ${colors[replay.results[row][column]]}`);
      });
      revealButton.textContent = "Letters revealed";
      revealButton.disabled = true;
      help.textContent = "Here are the letters from each guess.";
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
