import test from "node:test";
import assert from "node:assert/strict";
import {
  areVerticallyStackedSegments,
  buildKeyboardState,
  emptyGameState,
  findEmptyDraftSlot,
  getDailyAnswers,
  hashString,
  localDateKey,
  normalizeDraft,
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

test("draft slots support arbitrary-order entry and legacy drafts", () => {
  assert.deepEqual(emptyGameState().draft, ["", "", "", "", ""]);
  assert.deepEqual(normalizeDraft("cr"), ["c", "r", "", "", ""]);
  const slots = normalizeDraft(["c", "", "d", "", "e"]);
  assert.equal(findEmptyDraftSlot(slots, 2), 3);
  assert.equal(findEmptyDraftSlot(slots, 4), 1);
});

test("fold layout activates only for two vertically stacked segments", () => {
  const top = { left: 0, right: 400, top: 0, bottom: 390, width: 400 };
  const bottom = { left: 0, right: 400, top: 410, bottom: 800, width: 400 };
  const right = { left: 420, right: 820, top: 0, bottom: 390, width: 400 };
  assert.equal(areVerticallyStackedSegments([top, bottom]), true);
  assert.equal(areVerticallyStackedSegments([top, right]), false);
  assert.equal(areVerticallyStackedSegments([top]), false);
});
