//TEAM JS

// Storage key for localStorage
const STORAGE_KEY = 'pokedex_team';

// In-memory team array loaded from storage on initial script run
let team = loadTeamFromStorage();

/**
 * Loads saved team array from localStorage, filtering out any invalid/null items.
 * @returns {Array} Array of saved Pokémon objects
 */
function loadTeamFromStorage() {
    const saved = localStorage.getItem(STORAGE_KEY); 
    if (!saved) return [];

    try {
        const parsed = JSON.parse(saved);
        // Ensure it's an array and remove any nuyll or invalid entries
        return Array.isArray(parsed) 
            ? parsed.filter(item => item !== null && typeof item === 'object') 
            : [];
    } catch (error) {
        console.error("Error reading team from storage:", error);
        return [];
    }
}

/**
 * Saves current in-memory team array into localStorage.
 */
function saveTeamToStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(team));
}

/**
 * Returns a shallow copy of the current team.
 * @returns {Array}
 */
export function getTeam() { 
    return [...team]; // Spread copy prevents accidental direct mutation 
}

/**
 * Adds a Pokémon to the team if team < 6 and not duplicate.
 * @param {Object} pokemon - Normalized Pokemon object
 * @returns {Object} Result status and feedback message
 */
export function addToTeam(pokemon) {
    // 1. Check max capacity limit
    if (team.length >= 6) {
        return { success: false, message: "Your team is full! (Max 6 Pokémon)" };
    }
    
    // 2. Check for duplicates using .some()
    const isDuplicate = team.some(p => p.id === pokemon.id);
    if (isDuplicate) {
        return { success: false, message: `${pokemon.name} is already in your team!` };
    }

    // 3. Add to array immutably and persist to storage 
    team = [...team, pokemon]; 
    saveTeamToStorage();

    return { success: true, message: `Added ${pokemon.name} to your team!` };
}

/**
 * Removes a Pokémon from the team by ID.
 * @param {number} pokemonId
 */
export function removeFromTeam(pokemonId) {
    team = team.filter(p => p.id !== pokemonId);
    saveTeamToStorage();
}

/**
 * Clears all members from the team.
 */
export function clearTeam() {
    team = [];
    saveTeamToStorage();
}