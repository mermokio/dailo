import test from "node:test";
import assert from "node:assert/strict";
import {
  buildKeyboardState,
  getDailyAnswers,
  hashString,
  localDateKey,
  resultEmojiRows,
  scoreGuess
} from "../public/scripts/game.js";

test("localDateKey uses local calendar parts", () => {
  assert.equal(localDateKey(new Date(2026, 10, 4, 23, 59)), "2026-11-04");
});

test("hashString is deterministic", () => {
  assert.equal(hashString("dailo"), hashString("dailo"));
  assert.notEqual(hashString("dailo"), hashString("daily"));
});

test("daily answers are stable, unique, and date-specific", () => {
  const words = ["apple", "baker", "cider", "dream", "eager", "flame", "grape"];
  const first = getDailyAnswers("2026-11-14", words);
  assert.deepEqual(first, getDailyAnswers("2026-11-14", words));
  assert.equal(new Set(first).size, 3);
  assert.notDeepEqual(first, getDailyAnswers("2026-11-15", words));
});

test("scoreGuess handles duplicate letters without overcounting", () => {
  assert.deepEqual(scoreGuess("allee", "apple"), ["correct", "present", "absent", "absent", "correct"]);
  assert.deepEqual(scoreGuess("sassy", "class"), ["present", "present", "absent", "correct", "absent"]);
});

test("keyboard keeps the strongest known state", () => {
  const state = buildKeyboardState(["crane", "cider"], "cider");
  assert.equal(state.c, "correct");
  assert.equal(state.n, "absent");
  assert.equal(state.e, "correct");
});

test("emoji output reflects scored guesses", () => {
  assert.deepEqual(resultEmojiRows(["cider"], "cider"), ["🟩🟩🟩🟩🟩"]);
});
