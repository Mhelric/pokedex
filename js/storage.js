// ==========================================
// STORAGE MODULE
// Unified LocalStorage management for Caught & Favorite Pokémon collections
// ==========================================

const CAUGHT_STORAGE_KEY = "pokedex_caught";
const FAV_STORAGE_KEY = "pokedex_favorites";

// In-memory sets for O(1) membership lookups
let caughtSet = new Set();
let favSet = new Set();

/**
 * Migrates legacy individual localStorage keys (e.g., "caught_25", "fav_1")
 * into unified JSON arrays under "pokedex_caught" and "pokedex_favorites".
 */
function initializeAndMigrateStorage() {
  try {
    // 1. Load existing unified storage if present
    const savedCaught = localStorage.getItem(CAUGHT_STORAGE_KEY);
    if (savedCaught) {
      try {
        const parsed = JSON.parse(savedCaught);
        if (Array.isArray(parsed)) {
          parsed.forEach((id) => {
            const num = Number(id);
            if (!isNaN(num) && num > 0) caughtSet.add(num);
          });
        }
      } catch (err) {
        console.warn("Error parsing unified caught storage:", err);
      }
    }

    const savedFav = localStorage.getItem(FAV_STORAGE_KEY);
    if (savedFav) {
      try {
        const parsed = JSON.parse(savedFav);
        if (Array.isArray(parsed)) {
          parsed.forEach((id) => {
            const num = Number(id);
            if (!isNaN(num) && num > 0) favSet.add(num);
          });
        }
      } catch (err) {
        console.warn("Error parsing unified favorites storage:", err);
      }
    }

    // 2. Scan for and migrate legacy individual keys
    const legacyKeysToRemove = [];
    let hadLegacyCaught = false;
    let hadLegacyFav = false;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;

      if (key.startsWith("caught_")) {
        legacyKeysToRemove.push(key);
        if (localStorage.getItem(key) === "true") {
          const id = Number(key.slice(7));
          if (!isNaN(id) && id > 0) {
            caughtSet.add(id);
            hadLegacyCaught = true;
          }
        }
      } else if (key.startsWith("fav_")) {
        legacyKeysToRemove.push(key);
        if (localStorage.getItem(key) === "true") {
          const id = Number(key.slice(4));
          if (!isNaN(id) && id > 0) {
            favSet.add(id);
            hadLegacyFav = true;
          }
        }
      }
    }

    // 3. Clean up legacy keys
    if (legacyKeysToRemove.length > 0) {
      legacyKeysToRemove.forEach((key) => localStorage.removeItem(key));
    }

    // 4. Persist unified representations if migrations took place
    if (hadLegacyCaught || (!savedCaught && caughtSet.size > 0)) {
      persistCaught();
    }
    if (hadLegacyFav || (!savedFav && favSet.size > 0)) {
      persistFavorites();
    }
  } catch (err) {
    console.error("Storage initialization error:", err);
  }
}

function persistCaught() {
  try {
    const list = Array.from(caughtSet).sort((a, b) => a - b);
    localStorage.setItem(CAUGHT_STORAGE_KEY, JSON.stringify(list));
  } catch (err) {
    console.error("Failed to persist caught Pokémon to localStorage:", err);
  }
}

function persistFavorites() {
  try {
    const list = Array.from(favSet).sort((a, b) => a - b);
    localStorage.setItem(FAV_STORAGE_KEY, JSON.stringify(list));
  } catch (err) {
    console.error("Failed to persist favorite Pokémon to localStorage:", err);
  }
}

// Run initial migration and load immediately on module evaluation
initializeAndMigrateStorage();

// ==========================================
// CAUGHT POKÉMON API
// ==========================================

export function isPokemonCaught(id) {
  const num = Number(id);
  return !isNaN(num) && caughtSet.has(num);
}

export function setPokemonCaught(id, isCaught) {
  const num = Number(id);
  if (isNaN(num) || num <= 0) return false;

  if (isCaught) {
    caughtSet.add(num);
  } else {
    caughtSet.delete(num);
  }
  persistCaught();
  return isCaught;
}

export function togglePokemonCaught(id) {
  const num = Number(id);
  if (isNaN(num) || num <= 0) return false;

  const newState = !caughtSet.has(num);
  if (newState) {
    caughtSet.add(num);
  } else {
    caughtSet.delete(num);
  }
  persistCaught();
  return newState;
}

export function getCaughtIds() {
  return Array.from(caughtSet).sort((a, b) => a - b);
}

export function getCaughtCount() {
  return caughtSet.size;
}

export function clearAllCaught() {
  caughtSet.clear();
  try {
    localStorage.setItem(CAUGHT_STORAGE_KEY, JSON.stringify([]));
  } catch (err) {
    console.error("Failed to clear caught storage:", err);
  }
}

// ==========================================
// FAVORITE POKÉMON API
// ==========================================

export function isPokemonFavorite(id) {
  const num = Number(id);
  return !isNaN(num) && favSet.has(num);
}

export function setPokemonFavorite(id, isFav) {
  const num = Number(id);
  if (isNaN(num) || num <= 0) return false;

  if (isFav) {
    favSet.add(num);
  } else {
    favSet.delete(num);
  }
  persistFavorites();
  return isFav;
}

export function togglePokemonFavorite(id) {
  const num = Number(id);
  if (isNaN(num) || num <= 0) return false;

  const newState = !favSet.has(num);
  if (newState) {
    favSet.add(num);
  } else {
    favSet.delete(num);
  }
  persistFavorites();
  return newState;
}

export function getFavoriteIds() {
  return Array.from(favSet).sort((a, b) => a - b);
}

export function getFavoriteCount() {
  return favSet.size;
}

export function clearAllFavorites() {
  favSet.clear();
  try {
    localStorage.setItem(FAV_STORAGE_KEY, JSON.stringify([]));
  } catch (err) {
    console.error("Failed to clear favorites storage:", err);
  }
}
