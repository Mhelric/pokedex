// ==========================================
// TEAM BUILDER STATE & STORAGE
// ==========================================

import { getCachedPokemon, fetchPokemonSummary } from "./api.js";

const STORAGE_KEY = "pokedex_team";

// In-memory team state stores numeric Pokémon IDs only
let teamIds = loadTeamIdsFromStorage();

/**
 * Retrieves and validates team IDs from localStorage, migrating legacy full objects.
 */
function loadTeamIdsFromStorage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return [];

    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];

    let migrated = false;
    const ids = [];

    for (const item of parsed) {
      const id = typeof item === "object" && item !== null ? Number(item.id) : Number(item);
      if (typeof item === "object" && item !== null) migrated = true;
      if (!isNaN(id) && id > 0 && !ids.includes(id) && ids.length < 6) {
        ids.push(id);
      }
    }

    if (migrated) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    }
    return ids;
  } catch (error) {
    console.error("Error reading team from storage:", error);
    return [];
  }
}

/**
 * Syncs the current team IDs to localStorage.
 */
function saveTeamToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(teamIds));
  } catch (error) {
    console.error("Error saving team to storage:", error);
  }
}

/**
 * Returns raw array of team member IDs.
 */
export function getTeamIds() {
  return [...teamIds];
}

/**
 * Hydrates any uncached team IDs via fetchPokemonSummary and returns summary objects.
 */
export async function hydrateTeam(signal = null) {
  const results = await Promise.all(
    teamIds.map((id) =>
      fetchPokemonSummary(id, signal).catch((err) => {
        if (err.name === "AbortError") throw err;
        console.warn(`Could not hydrate team member ${id}:`, err);
        return null;
      })
    )
  );
  return results.filter(Boolean);
}

/**
 * Returns an array of hydrated Pokémon summaries currently available in cache.
 */
export function getTeam() {
  return teamIds.map((id) => getCachedPokemon(id)).filter(Boolean);
}

/**
 * Adds a Pokémon by object or ID if the team is below 6 members and no duplicates exist.
 */
export function addToTeam(pokemonOrId) {
  const id = typeof pokemonOrId === "object" ? Number(pokemonOrId.id) : Number(pokemonOrId);
  const name =
    (typeof pokemonOrId === "object" && pokemonOrId.name) ||
    getCachedPokemon(id)?.name ||
    `#${id}`;

  if (teamIds.length >= 6) {
    return { success: false, message: "Your team is full! (Max 6 Pokémon)" };
  }

  if (teamIds.includes(id)) {
    return { success: false, message: `${name} is already in your team!` };
  }

  teamIds = [...teamIds, id];
  saveTeamToStorage();

  return { success: true, message: `Added ${name} to your team!` };
}

/**
 * Removes a Pokémon from the team by ID.
 */
export function removeFromTeam(pokemonId) {
  const numId = Number(pokemonId);
  teamIds = teamIds.filter((id) => id !== numId);
  saveTeamToStorage();
}

/**
 * Clears all members from the team.
 */
export function clearTeam() {
  teamIds = [];
  saveTeamToStorage();
}