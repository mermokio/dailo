export const WORD_LENGTH = 5;
export const MAX_GUESSES = 6;
export const GAMES_PER_DAY = 3;

export function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function hashString(value) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function getDailyAnswers(dateKey, answerWords, count = GAMES_PER_DAY) {
  if (!answerWords.length) throw new Error("The answer list cannot be empty.");
  const selected = [];
  for (let gameIndex = 0; gameIndex < count; gameIndex += 1) {
    let salt = 0;
    let word;
    do {
      const seed = `dailo:v1:${dateKey}:${gameIndex}:${salt}`;
      word = answerWords[hashString(seed) % answerWords.length];
      salt += 1;
    } while (selected.includes(word) && salt < answerWords.length);
    selected.push(word);
  }
  return selected;
}

export function scoreGuess(guess, answer) {
  const normalizedGuess = guess.toLowerCase();
  const normalizedAnswer = answer.toLowerCase();
  const result = Array(WORD_LENGTH).fill("absent");
  const remaining = {};

  for (let index = 0; index < WORD_LENGTH; index += 1) {
    if (normalizedGuess[index] === normalizedAnswer[index]) {
      result[index] = "correct";
    } else {
      const letter = normalizedAnswer[index];
      remaining[letter] = (remaining[letter] || 0) + 1;
    }
  }

  for (let index = 0; index < WORD_LENGTH; index += 1) {
    if (result[index] === "correct") continue;
    const letter = normalizedGuess[index];
    if (remaining[letter] > 0) {
      result[index] = "present";
      remaining[letter] -= 1;
    }
  }

  return result;
}

const STATE_PRIORITY = { absent: 1, present: 2, correct: 3 };

export function buildKeyboardState(guesses, answer) {
  const keyboard = {};
  for (const guess of guesses) {
    const score = scoreGuess(guess, answer);
    [...guess].forEach((letter, index) => {
      const next = score[index];
      const current = keyboard[letter];
      if (!current || STATE_PRIORITY[next] > STATE_PRIORITY[current]) keyboard[letter] = next;
    });
  }
  return keyboard;
}

export function resultEmojiRows(guesses, answer) {
  const emoji = { correct: "🟩", present: "🟨", absent: "⬛" };
  return guesses.map((guess) => scoreGuess(guess, answer).map((state) => emoji[state]).join(""));
}

export function normalizeDraft(draft) {
  const source = Array.isArray(draft) ? draft : typeof draft === "string" ? [...draft] : [];
  return Array.from({ length: WORD_LENGTH }, (_, index) => {
    const letter = source[index];
    return typeof letter === "string" && /^[a-z]$/i.test(letter) ? letter.toLowerCase() : "";
  });
}

export function findEmptyDraftSlot(draft, startIndex = 0) {
  for (let offset = 0; offset < WORD_LENGTH; offset += 1) {
    const index = (startIndex + offset + WORD_LENGTH) % WORD_LENGTH;
    if (!draft[index]) return index;
  }
  return -1;
}

export function areVerticallyStackedSegments(segments) {
  if (!Array.isArray(segments) || segments.length !== 2) return false;
  const [top, bottom] = [...segments].sort((a, b) => a.top - b.top);
  const horizontalOverlap = Math.min(top.right, bottom.right) - Math.max(top.left, bottom.left);
  const sharedWidth = Math.min(top.width, bottom.width);
  return bottom.top > top.top && top.bottom <= bottom.top + 1 && horizontalOverlap >= sharedWidth * 0.9;
}

export function emptyGameState() {
  return { guesses: [], draft: normalizeDraft([]), status: "playing", completedAt: null };
}
