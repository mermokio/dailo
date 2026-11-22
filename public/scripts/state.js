import { GAMES_PER_DAY, emptyGameState, normalizeDraft } from "./game.js";

export const STORAGE_KEY = "dailo-v2-state-v1";
const ORIGINAL_STORAGE_KEY = "dailo-state-v1";

function readState(storage, key) {
  try {
    const saved = JSON.parse(storage.getItem(key));
    return saved?.days && typeof saved.days === "object" && !Array.isArray(saved.days)
      ? saved
      : null;
  } catch {
    return null;
  }
}

function progress(game) {
  if (!game) return -1;
  if (game.status === "won") return 300;
  if (game.status === "lost") return 200;
  return (game.guesses?.length ?? 0) * 10 + normalizeDraft(game.draft).filter(Boolean).length;
}

export function loadSavedState(storage) {
  const current = readState(storage, STORAGE_KEY);
  if (current?.originalImported) return current;

  const original = readState(storage, ORIGINAL_STORAGE_KEY);
  const days = { ...original?.days, ...current?.days };
  for (const [date, originalDay] of Object.entries(original?.days ?? {})) {
    const currentDay = current?.days[date];
    if (!currentDay) continue;
    const games = Array.from({ length: GAMES_PER_DAY }, (_, index) => {
      const previous = originalDay?.games?.[index];
      const latest = currentDay.games?.[index];
      return (progress(previous) > progress(latest) ? previous : latest) ?? emptyGameState();
    });
    days[date] = { ...originalDay, ...currentDay, games };
  }
  return {
    ...original,
    ...current,
    activeGame: current?.activeGame ?? original?.activeGame ?? 0,
    days,
    originalImported: true
  };
}
