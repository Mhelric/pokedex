import { fetchPokemon } from "./api.js";
import { renderPokemonGrid, renderTeamGrid, renderError } from "./ui.js";
import { getTeam, addToTeam, removeFromTeam, clearTeam } from './team.js';
import { startNewRound, handleGuess } from './minigame.js';

// DOM Elements
const searchForm = document.getElementById('search-form');
const searchInput = document.getElementById('search-input');
const gridContainer = document.getElementById('pokemon-grid');
const teamGrid = document.getElementById('team-grid'); 
const teamCount = document.getElementById('team-count'); 
const clearTeamBtn = document.getElementById('clear-team-btn');
// Mini-Game DOM Elements
const gameImg = document.getElementById('game-pokemon-img');
const gameOptions = document.getElementById('game-options');
const gameFeedback = document.getElementById('game-feedback');
const nextPokemonBtn = document.getElementById('next-pokemon-btn');
const streakCount = document.getElementById('streak-count');
const highscoreCount = document.getElementById('highscore-count');

// Temporary in-memory cache of fetched pokémon objects so we can add them to team easily 
const fetchedCache = new Map();

// Helper to refresh Team UI 
function updateTeamUI() { 
    renderTeamGrid(getTeam(), teamGrid, teamCount); 
}

// 1. Initial Page Load 
document.addEventListener('DOMContentLoaded', async () =>{   
    updateTeamUI(); // Load saved team from localStorage immediately 

    // Load initial 6 pokemon into main grid 
    const INITIAL_POKEMON = ['charizard', 'pikachu', 'mewtwo', 'bulbasaur', 'eevee', 'greninja']; 
    
    try { 
        const pokemonList = await Promise.all(INITIAL_POKEMON.map(name => fetchPokemon(name))); 
        pokemonList.forEach(p => fetchedCache.set(p.id, p));
        renderPokemonGrid(pokemonList, gridContainer); 
    } catch (err) { 
        renderError("Failed to load initial Pokémon.", gridContainer); 
    } 
});

// 2. Search Form Event Listener
searchForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const query = searchInput.value.trim();
    if (!query) return;

    gridContainer.innerHTML = `<div class="loading"><p>Searching for "${query}"...</p></div>`;

    try {
        const pokemon = await fetchPokemon(query);
        fetchedCache.set(pokemon.id, pokemon);
        renderPokemonGrid(pokemon, gridContainer);
    } catch (error) {
        renderError(error.message, gridContainer);
    }
});

// 3. Event Delegation: Add to Team from Main Grid 
gridContainer.addEventListener('click', (e) => { 
    if (e.target.classList.contains('cry-btn')) {
        const cryUrl = e.target.dataset.cry;
        if (cryUrl) {
            const audio = new Audio(cryUrl);
            audio.volume = 0.6; // Adjust volume (0.0 to 1.0)
            audio.play().catch(err => console.error("Audio playback error:",err));
        }
    }

    if (e.target.classList.contains('add-team-btn')) { 
        const pokemonId = Number(e.target.dataset.id); 
        const pokemon = fetchedCache.get(pokemonId); 
        
        if (pokemon) { 
            const result = addToTeam(pokemon); 
            if (result.success) { 
                updateTeamUI(); 
            } else { 
                alert(result.message); // Alert user if team full or duplicate 
            } 
        } 
    } 
}); 

// 4. Event Delegation: Remove from Team Drawer 
teamGrid.addEventListener('click', (e) => { 
    if (e.target.classList.contains('remove-btn')) { 
        const pokemonId = Number(e.target.dataset.id);
        removeFromTeam(pokemonId); 
        updateTeamUI(); 
    } 
}); 
        
// 5. Clear Team Button Listener 
if (clearTeamBtn) { 
    clearTeamBtn.addEventListener('click', () => { 
        clearTeam(); 
        updateTeamUI(); 
    }); 
}

// Helper to trigger a new round
function initMinigameRound() {
  if (nextPokemonBtn) nextPokemonBtn.style.display = 'none';
  startNewRound(gameImg, gameOptions, gameFeedback, streakCount, highscoreCount);
}

// Event Delegation for Guess Buttons
if (gameOptions) {
  gameOptions.addEventListener('click', (e) => {
    if (e.target.classList.contains('option-btn')) {
      const selectedName = e.target.dataset.name;
      handleGuess(
        selectedName,
        gameImg,
        gameFeedback,
        gameOptions,
        nextPokemonBtn,
        streakCount,
        highscoreCount
      );
    }
  });
}

// Next Button Listener
if (nextPokemonBtn) {
  nextPokemonBtn.addEventListener('click', initMinigameRound);
}

// Start first round on DOM load
document.addEventListener('DOMContentLoaded', () => {
  initMinigameRound();
});