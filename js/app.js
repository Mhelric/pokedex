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