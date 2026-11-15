import { MAX_GUESSES, WORD_LENGTH, decodeReplayToken } from "./game.js";

const root = document.querySelector("#replay-root");
const board = document.querySelector("#replay-board");
const meta = document.querySelector("#replay-meta");
const help = document.querySelector("#replay-help");
const revealButton = document.querySelector("#reveal-button");
const error = document.querySelector("#replay-error");
const replay = decodeReplayToken(new URLSearchParams(location.hash.slice(1)).get("r"));

if (!replay) {
  board.hidden = true;
  meta.hidden = true;
  help.hidden = true;
  revealButton.hidden = true;
  error.hidden = false;
} else {
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
        tile.classList.add(({ 0: "absent", 1: "present", 2: "correct" })[resultCode]);
        tile.dataset.row = String(rowIndex);
        tile.dataset.column = String(column);
        tile.setAttribute("aria-label", `Guess ${rowIndex + 1}, letter ${column + 1}, ${({ 0: "absent", 1: "present", 2: "correct" })[resultCode]}`);
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
      tile.setAttribute("aria-label", `${letter}, ${tile.classList.contains("correct") ? "correct" : tile.classList.contains("present") ? "present" : "absent"}`);
    });
    revealButton.textContent = "Letters revealed";
    revealButton.disabled = true;
    help.textContent = "Here are the letters from each guess.";
  }, { once: true });
}
