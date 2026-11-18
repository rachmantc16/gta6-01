// save.js — the whole of Marisol Bay's persistence: one localStorage record
// holding cash, finished missions and where Danny woke up. Saving happens on
// mission completion and every few seconds of play; loading is forgiving —
// a missing or damaged record simply starts a fresh game.

const SAVE_KEY = 'marisol-bay-save-v1';

export function defaultSave() {
  return {
    money: 40,
    missionsDone: [],
    started: false,
    muted: false,
    bestCash: 40,
  };
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw);
    const fresh = defaultSave();
    return {
      money: Number.isFinite(parsed.money) ? parsed.money : fresh.money,
      missionsDone: Array.isArray(parsed.missionsDone) ? parsed.missionsDone.filter((n) => Number.isInteger(n)) : [],
      started: !!parsed.started,
      muted: !!parsed.muted,
      bestCash: Number.isFinite(parsed.bestCash) ? parsed.bestCash : fresh.bestCash,
    };
  } catch {
    return defaultSave();
  }
}

export function storeSave(save) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // Private mode or a full store: the game plays on unsaved.
  }
}

export function wipeSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to wipe.
  }
}
