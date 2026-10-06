// ==========================================
// APPLICATION ENTRY POINT
// ==========================================

import { fetchPokemon, fetchPokemonForms } from "./api.js";
import { renderPokemonGrid, renderTeamGrid, renderError } from "./ui.js";
import { getTeam, addToTeam, removeFromTeam, clearTeam } from "./team.js";
import { startNewRound, handleGuess } from "./minigame.js";

// --- DOM References ---
const searchForm = document.getElementById("search-form");
const searchInput = document.getElementById("search-input");
const gridContainer = document.getElementById("pokemon-grid");
const teamGrid = document.getElementById("team-grid");
const teamCount = document.getElementById("team-count");
const clearTeamBtn = document.getElementById("clear-team-btn");
const spriteToggleBtn = document.getElementById("sprite-toggle-btn");

// Mini-game references
const gameImg = document.getElementById("game-pokemon-img");
const gameOptions = document.getElementById("game-options");
const gameFeedback = document.getElementById("game-feedback");
const nextPokemonBtn = document.getElementById("next-pokemon-btn");
const streakCount = document.getElementById("streak-count");
const highscoreCount = document.getElementById("highscore-count");

// In-memory cache for fast lookup when adding to team
const fetchedCache = new Map();

// Sprite mode toggle state
let useAnimatedSprites = localStorage.getItem("sprite_mode") !== "artwork";

// --- Team Helpers ---
function updateTeamUI() {
  renderTeamGrid(getTeam(), teamGrid, teamCount);
}

// --- Toggle Helpers ---
function updateToggleBtnText() {
  if (spriteToggleBtn) {
    spriteToggleBtn.textContent = useAnimatedSprites
      ? "Mode: Animated GIFs"
      : "Mode: Official Artwork";
  }
}

function reRenderGrid() {
  const cachedList = Array.from(fetchedCache.values());
  if (cachedList.length > 0) {
    renderPokemonGrid(cachedList, gridContainer, useAnimatedSprites);
  }
}

// --- Mini-game Initializer ---
function initMinigameRound() {
  if (nextPokemonBtn) nextPokemonBtn.style.display = "none";
  startNewRound(gameImg, gameOptions, gameFeedback, streakCount, highscoreCount);
}

// ==========================================
// EVENT LISTENERS & INITIALIZATION
// ==========================================

document.addEventListener("DOMContentLoaded", async () => {
  // 1. Initialize Team UI from storage
  updateTeamUI();

  // 2. Initialize Mini-game
  initMinigameRound();

  // 3. Initialize Sprite Toggle UI
  updateToggleBtnText();

  // 4. Load initial showcase cards
  const INITIAL_POKEMON = ["charizard", "pikachu", "mewtwo", "bulbasaur", "eevee", "greninja"];
  try {
    const pokemonList = await Promise.all(INITIAL_POKEMON.map((name) => fetchPokemon(name)));
    pokemonList.forEach((p) => fetchedCache.set(p.id, p));
    renderPokemonGrid(pokemonList, gridContainer, useAnimatedSprites);
  } catch (err) {
    renderError("Failed to load initial Pokémon.", gridContainer);
  }
});

// Search form submit
if (searchForm) {
  searchForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const query = searchInput.value.trim();
    if (!query) return;

    gridContainer.innerHTML = '<p class="status-message">Searching Pokédex...</p>';

    try {
      const results = await fetchPokemonForms(query);
      results.forEach((p) => fetchedCache.set(p.id, p));
      renderPokemonGrid(results, gridContainer, useAnimatedSprites);
    } catch (error) {
      gridContainer.innerHTML = `<p class="error-message">❌ ${error.message}</p>`;
    }
  });
}

// Main grid clicks (Audio cry & Add to Team delegation)
gridContainer.addEventListener("click", (e) => {
  // Play cry
  if (e.target.classList.contains("cry-btn")) {
    const cryUrl = e.target.dataset.cry;
    if (cryUrl) {
      const audio = new Audio(cryUrl);
      audio.volume = 0.6;
      audio.play().catch((err) => console.error("Audio playback error:", err));
    }
  }

  // Add to team
  if (e.target.classList.contains("add-team-btn")) {
    const pokemonId = Number(e.target.dataset.id);
    const pokemon = fetchedCache.get(pokemonId);

    if (pokemon) {
      const result = addToTeam(pokemon);
      if (result.success) {
        updateTeamUI();
      } else {
        alert(result.message);
      }
    }
  }
});

// Remove item from team drawer
teamGrid.addEventListener("click", (e) => {
  if (e.target.classList.contains("remove-btn")) {
    const pokemonId = Number(e.target.dataset.id);
    removeFromTeam(pokemonId);
    updateTeamUI();
  }
});

// Clear team button
if (clearTeamBtn) {
  clearTeamBtn.addEventListener("click", () => {
    clearTeam();
    updateTeamUI();
  });
}

// Mini-game option click
if (gameOptions) {
  gameOptions.addEventListener("click", (e) => {
    if (e.target.classList.contains("option-btn")) {
      handleGuess(
        e.target.dataset.name,
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

// Mini-game next round
if (nextPokemonBtn) {
  nextPokemonBtn.addEventListener("click", initMinigameRound);
}

// Sprite toggle button
if (spriteToggleBtn) {
  spriteToggleBtn.addEventListener("click", () => {
    useAnimatedSprites = !useAnimatedSprites;
    localStorage.setItem("sprite_mode", useAnimatedSprites ? "animated" : "artwork");
    updateToggleBtnText();
    reRenderGrid();
  });
}