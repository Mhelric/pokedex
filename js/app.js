// ==========================================
// APPLICATION ENTRY POINT
// ==========================================

import { 
  fetchPokemon, 
  fetchPokemonForms, 
  fetchPokemonByType, 
  fetchPokemonRange,
  GEN_RANGES 
} from "./api.js";
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
const typeSelectDropdown = document.getElementById('type-select-dropdown');

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

/**
 * Custom Dropdown Component Setup
 * - Opens/toggles menu on trigger click
 * - Closes when an option is selected or when clicking anywhere outside
 * - Menu stays open on mouseleave (per user preference)
 */
function setupCustomDropdown(dropdownId, onSelectCallback) {
  const dropdown = document.getElementById(dropdownId);
  if (!dropdown) return;

  const trigger = dropdown.querySelector(".dropdown-trigger");
  const label = dropdown.querySelector(".trigger-label");
  const options = dropdown.querySelectorAll(".dropdown-option");

  // 1. Toggle open state on click
  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    // Close any other open custom dropdowns
    document.querySelectorAll(".custom-dropdown").forEach((d) => {
      if (d !== dropdown) d.classList.remove("open");
    });
    dropdown.classList.toggle("open");
  });

  // 2. Handle option selection
  options.forEach((opt) => {
    opt.addEventListener("click", () => {
      options.forEach((o) => o.classList.remove("active"));
      opt.classList.add("active");

      const value = opt.dataset.value;
      label.textContent = opt.textContent;
      dropdown.classList.remove("open");

      onSelectCallback(value);
    });
  });
}

// 3. Close open custom dropdowns when clicking anywhere outside
document.addEventListener("click", () => {
  document.querySelectorAll(".custom-dropdown").forEach((d) => d.classList.remove("open"));
});

// Initialize Type Dropdown
setupCustomDropdown("type-dropdown", async (selectedType) => {
  gridContainer.innerHTML = `<p class="loading-msg">Loading ${selectedType.toUpperCase()} Pokémon...</p>`;
  try {
    const pokemonList = await fetchPokemonByType(selectedType, 20);
    pokemonList.forEach((p) => fetchedCache.set(p.id, p));
    renderPokemonGrid(pokemonList, gridContainer, useAnimatedSprites);
  } catch (error) {
    gridContainer.innerHTML = `<p class="error-msg">❌ ${error.message}</p>`;
  }
});

// Infinite Scroll State for Generations
let genScrollState = {
  active: false,
  currentId: 0,
  endId: 0,
  loading: false,
  hasMore: false
};

/**
 * Loads a batch of 10 Pokémon
 * @param {boolean} isFirstBatch - If true, replaces the grid; if false, appends/stacks.
 */
async function loadGenBatch(isFirstBatch = false) {
  if (!genScrollState.active || genScrollState.loading || !genScrollState.hasMore) return;

  genScrollState.loading = true;

  // Add loader at the bottom when scrolling
  if (!isFirstBatch) {
    let scrollLoader = document.getElementById("scroll-loader");
    if (!scrollLoader) {
      scrollLoader = document.createElement("p");
      scrollLoader.id = "scroll-loader";
      scrollLoader.className = "loading-msg";
      scrollLoader.textContent = "Loading more Pokémon...";
      gridContainer.appendChild(scrollLoader);
    }
  }

  try {
    const { pokemonList, nextStartId, hasMore } = await fetchPokemonRange(
      genScrollState.currentId,
      genScrollState.endId,
      10
    );

    // Cache items
    pokemonList.forEach((p) => fetchedCache.set(p.id, p));

    // Render:
    // isFirstBatch = true  => append = false (replaces initial "Loading..." message)
    // isFirstBatch = false => append = true  (STACKS next 10 onto existing cards)
    renderPokemonGrid(pokemonList, gridContainer, useAnimatedSprites, !isFirstBatch);

    genScrollState.currentId = nextStartId;
    genScrollState.hasMore = hasMore;
  } catch (error) {
    const scrollLoader = document.getElementById("scroll-loader");
    if (scrollLoader) scrollLoader.remove();
    console.error("Scroll load error:", error);
  } finally {
    genScrollState.loading = false;
  }
}

// Global Scroll Listener
window.addEventListener("scroll", () => {
  if (!genScrollState.active || !genScrollState.hasMore || genScrollState.loading) return;

  const scrollPosition = window.innerHeight + window.scrollY;
  const threshold = document.body.offsetHeight - 350;

  if (scrollPosition >= threshold) {
    loadGenBatch(false); // Append next 10 cards
  }
});

// Generation Dropdown Listener
setupCustomDropdown("gen-dropdown", async (selectedGen) => {
  if (selectedGen === "all") {
    genScrollState.active = false;
    gridContainer.innerHTML = '<p class="loading-msg">Loading Pokédex...</p>';
    const defaultList = await Promise.all(
      Array.from({ length: 20 }, (_, i) => fetchPokemon(i + 1))
    );
    renderPokemonGrid(defaultList, gridContainer, useAnimatedSprites, false);
    return;
  }

  const range = GEN_RANGES[selectedGen];
  if (!range) return;

  // Reset scroll state for selected generation
  genScrollState = {
    active: true,
    currentId: range.start,
    endId: range.end,
    loading: false,
    hasMore: true
  };

  gridContainer.innerHTML = `<p class="loading-msg">Loading Generation ${selectedGen}... </p>`;

  // Load first 10 cards (isFirstBatch = true resets loading text and renders first 10)
  await loadGenBatch(true);
});

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