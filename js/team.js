// ==========================================
// TEAM BUILDER STATE & STORAGE
// ==========================================

const STORAGE_KEY = "pokedex_team";

// In-memory team state loaded initially
let team = loadTeamFromStorage();

/**
 * Retrieves and validates team data from localStorage.
 */
function loadTeamFromStorage() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return [];

  try {
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed)
      ? parsed.filter((item) => item !== null && typeof item === "object")
      : [];
  } catch (error) {
    console.error("Error reading team from storage:", error);
    return [];
  }
}

/**
 * Syncs the current team state to localStorage.
 */
function saveTeamToStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(team));
}

/**
 * Returns an immutable copy of the active team.
 */
export function getTeam() {
  return [...team];
}

/**
 * Adds a Pokémon if the team is below 6 members and no duplicates exist.
 */
export function addToTeam(pokemon) {
  if (team.length >= 6) {
    return { success: false, message: "Your team is full! (Max 6 Pokémon)" };
  }

  const isDuplicate = team.some((p) => p.id === pokemon.id);
  if (isDuplicate) {
    return { success: false, message: `${pokemon.name} is already in your team!` };
  }

  team = [...team, pokemon];
  saveTeamToStorage();

  return { success: true, message: `Added ${pokemon.name} to your team!` };
}

/**
 * Removes a Pokémon from the team by ID.
 */
export function removeFromTeam(pokemonId) {
  team = team.filter((p) => p.id !== pokemonId);
  saveTeamToStorage();
}

/**
 * Clears all members from the team.
 */
export function clearTeam() {
  team = [];
  saveTeamToStorage();
}