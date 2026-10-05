import { fetchPokemon } from "./api.js";
import { renderError, renderPokemonGrid } from "./ui.js";

const gridContainer = document.getElementById('pokemon-grid');

async function testUI() {
    try {
        const pokemon = await fetchPokemon('hydreigon');
        renderPokemonGrid(pokemon, gridContainer);
    } catch (error) {
        renderError(error.message, gridContainer);
    }
}

testUI();