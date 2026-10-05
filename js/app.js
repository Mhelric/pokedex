import { fetchPokemon } from "./api.js";
import { renderError, renderPokemonGrid } from "./ui.js";

// 1. Grab DOM Elements
const searchForm = document.getElementById('search-form');
const searchInput = document.getElementById('search-input');
const gridContainer = document.getElementById('pokemon-grid');

// 2. Set up Form Submit Listener
searchForm.addEventListener('submit', async (event) => {
    // Prevent default form browser reload
    event.preventDefault();

    const query = searchInput.value.trim();
    if (!query) return;

    // Show loading state
    gridContainer.innerHTML = `<div class="loading"><p>Searching for "${query}"...</p></div>`;

    try {
        // Fetch data from API
        const pokemon = await fetchPokemon(query);
        // Render card
        renderPokemonGrid(pokemon, gridContainer);
    } catch (error) {
        // Render error card if not found
        renderError(error.message, gridContainer);
    }
});

// Default Pokemon IDs or names to display on initial load
const INITIAL_POKEMON = ['charizard', 'pikachu', 'mewtwo', 'bulbasaur', 'eevee', 'greninja'];

/**
 * Loads the initial set of default Pokemon concurrently using Promise.all
 */
async function loadInitialPokemon() {
    gridContainer.innerHTML = `<div class="loading"><p>Catching initial Pokemon...</p></div>`;

    try {
        // Fire all fetch promises concurrently
        const pokemonPromises = INITIAL_POKEMON.map(name => fetchPokemon(name));

        // Wait for all fetches to resolve
        const pokemonList = await Promise.all(pokemonPromises);

        // Render the array of cards into the grid
        renderPokemonGrid(pokemonList, gridContainer);
    } catch (error) {
        renderError("Failed to load initial Pokemon.", gridContainer);
    }
}

// Trigger initial load on page startup
document.addEventListener('DOMContentLoaded', loadInitialPokemon);