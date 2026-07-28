// storage.js — thin wrapper around localStorage for people + expenses

const STORAGE_KEY = "ledger_data_v1";

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { people: [], expenses: [] };
    const parsed = JSON.parse(raw);
    return {
      people: Array.isArray(parsed.people) ? parsed.people : [],
      expenses: Array.isArray(parsed.expenses) ? parsed.expenses : []
    };
  } catch (e) {
    console.error("Failed to load ledger state:", e);
    return { people: [], expenses: [] };
  }
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error("Failed to save ledger state:", e);
  }
}

function clearState() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error("Failed to clear ledger state:", e);
  }
}
