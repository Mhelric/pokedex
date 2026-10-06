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

// Mini-game DOM References
const gameImg = document.getElementById("game-pokemon-img");
const gameOptions = document.getElementById("game-options");
const gameFeedback = document.getElementById("game-feedback");
const nextPokemonBtn = document.getElementById("next-pokemon-btn");
const streakCount = document.getElementById("streak-count");
const highscoreCount = document.getElementById("highscore-count");

// --- Global State ---
const fetchedCache = new Map();
let useAnimatedSprites = localStorage.getItem("sprite_mode") !== "artwork";

// Track currently displayed cards for sprite mode toggling
let currentDisplayedPokemon = [];

// Global Active Filter State
let activeType = "all";
let activeGen = "all";

// Generation Infinite Scroll State
let genScrollState = {
  active: false,
  currentId: 0,
  endId: 0,
  loading: false,
  hasMore: false
};

// --- Team UI Helper ---
function updateTeamUI() {
  renderTeamGrid(getTeam(), teamGrid, teamCount);
}

// --- Toggle Button Helpers ---
function updateToggleBtnText() {
  if (spriteToggleBtn) {
    spriteToggleBtn.textContent = useAnimatedSprites
      ? "Mode: Animated GIFs"
      : "Mode: Official Artwork";
  }
}

// Re-renders the EXACT cards currently on screen when toggling artwork mode
function reRenderGrid() {
  if (currentDisplayedPokemon.length > 0) {
    renderPokemonGrid(currentDisplayedPokemon, gridContainer, useAnimatedSprites, false);
  }
}

// --- Custom Dropdown Setup ---
function setupCustomDropdown(dropdownId, onSelectCallback) {
  const dropdown = document.getElementById(dropdownId);
  if (!dropdown) return;

  const trigger = dropdown.querySelector(".dropdown-trigger");
  const label = dropdown.querySelector(".trigger-label");
  const options = dropdown.querySelectorAll(".dropdown-option");

  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    document.querySelectorAll(".custom-dropdown").forEach((d) => {
      if (d !== dropdown) d.classList.remove("open");
    });
    dropdown.classList.toggle("open");
  });

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

// Close dropdowns when clicking anywhere outside
document.addEventListener("click", () => {
  document.querySelectorAll(".custom-dropdown").forEach((d) => d.classList.remove("open"));
});

// --- Generation Batch Loader for Infinite Scroll ---
async function loadGenBatch(isFirstBatch = false) {
  if (!genScrollState.active || genScrollState.loading || !genScrollState.hasMore) return;

  genScrollState.loading = true;

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

    pokemonList.forEach((p) => fetchedCache.set(p.id, p));

    // Update currently displayed cards list
    if (isFirstBatch) {
      currentDisplayedPokemon = [...pokemonList];
    } else {
      currentDisplayedPokemon = [...currentDisplayedPokemon, ...pokemonList];
    }

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

// --- Combined Filter Logic ---
async function applyCombinedFilters() {
  genScrollState.active = false; // Reset infinite scroll state

  gridContainer.innerHTML = `<p class="loading-msg">Filtering Pokédex...</p>`;

  try {
    let results = [];

    if (activeGen !== "all" && activeType !== "all") {
      // Both Specific Generation and Type selected: fetch gen range, then filter by type
      const range = GEN_RANGES[activeGen];
      const genList = [];
      for (let id = range.start; id <= range.end; id++) {
        const p = fetchedCache.get(id) || await fetchPokemon(id);
        fetchedCache.set(p.id, p);
        genList.push(p);
      }
      results = genList.filter((p) => p.types.includes(activeType.toLowerCase()));

      currentDisplayedPokemon = results;
      renderPokemonGrid(results, gridContainer, useAnimatedSprites, false);

      if (results.length === 0) {
        gridContainer.innerHTML = `<p class="status-message">No ${activeType.toUpperCase()} Pokémon found in Generation ${activeGen}.</p>`;
      }

    } else if (activeType === "all") {
      // "All Types" selected (works for "All Generations" OR specific Gens 1–9):
      // Enables Infinite Scroll across the target range (1 to 1025 for "all")
      const range = GEN_RANGES[activeGen];
      genScrollState = {
        active: true,
        currentId: range.start,
        endId: range.end,
        loading: false,
        hasMore: true
      };
      gridContainer.innerHTML = "";
      await loadGenBatch(true);

    } else if (activeType !== "all") {
      // Type filter across all generations
      results = await fetchPokemonByType(activeType, 30);
      results.forEach((p) => fetchedCache.set(p.id, p));

      currentDisplayedPokemon = results;
      renderPokemonGrid(results, gridContainer, useAnimatedSprites, false);
    }
  } catch (error) {
    gridContainer.innerHTML = `<p class="error-msg">❌ ${error.message}</p>`;
  }
}

// --- Infinite Scroll Event Listener ---
window.addEventListener("scroll", () => {
  if (!genScrollState.active || !genScrollState.hasMore || genScrollState.loading) return;

  const scrollPosition = window.innerHeight + window.scrollY;
  const threshold = document.body.offsetHeight - 350;

  if (scrollPosition >= threshold) {
    loadGenBatch(false);
  }
});

// --- Mini-game Initializer ---
function initMinigameRound() {
  if (nextPokemonBtn) nextPokemonBtn.style.display = "none";
  startNewRound(gameImg, gameOptions, gameFeedback, streakCount, highscoreCount);
}

// ==========================================
// INITIALIZATION & EVENT LISTENERS
// ==========================================
document.addEventListener("DOMContentLoaded", async () => {
  updateTeamUI();
  initMinigameRound();
  updateToggleBtnText();

  // Initialize Custom Dropdowns
  setupCustomDropdown("type-dropdown", (selectedType) => {
    activeType = selectedType;
    applyCombinedFilters();
  });

  setupCustomDropdown("gen-dropdown", (selectedGen) => {
    activeGen = selectedGen;
    applyCombinedFilters();
  });

  // Initial page load: Starts infinite scroll batching from #001 through #1025
  await applyCombinedFilters();
});

// Search Form Handler
if (searchForm) {
  searchForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const query = searchInput.value.trim();
    if (!query) return;

    // Stop Infinite Scroll session on search
    genScrollState.active = false;

    // Reset Dropdown Labels & Active Filter States
    activeType = "all";
    activeGen = "all";
    const typeLabel = document.querySelector("#type-dropdown .trigger-label");
    const genLabel = document.querySelector("#gen-dropdown .trigger-label");
    if (typeLabel) typeLabel.textContent = "🌐 All Types";
    if (genLabel) genLabel.textContent = "🏛️ All Generations";

    gridContainer.innerHTML = '<p class="loading-msg">Searching Pokédex...</p>';

    try {
      const results = await fetchPokemonForms(query);
      currentDisplayedPokemon = results;
      results.forEach((p) => fetchedCache.set(p.id, p));
      renderPokemonGrid(results, gridContainer, useAnimatedSprites);
    } catch (error) {
      gridContainer.innerHTML = `<p class="error-msg">❌ ${error.message}</p>`;
    }
  });
}

// Main Grid Clicks (Cry Audio & Team Builder)
gridContainer.addEventListener("click", (e) => {
  if (e.target.classList.contains("cry-btn")) {
    const cryUrl = e.target.dataset.cry;
    if (cryUrl) {
      const audio = new Audio(cryUrl);
      audio.volume = 0.6;
      audio.play().catch((err) => console.error("Audio playback error:", err));
    }
  }

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

// Team Drawer Interactions
teamGrid.addEventListener("click", (e) => {
  if (e.target.classList.contains("remove-btn")) {
    const pokemonId = Number(e.target.dataset.id);
    removeFromTeam(pokemonId);
    updateTeamUI();
  }
});

if (clearTeamBtn) {
  clearTeamBtn.addEventListener("click", () => {
    clearTeam();
    updateTeamUI();
  });
}

// Mini-game Interactions
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

if (nextPokemonBtn) {
  nextPokemonBtn.addEventListener("click", initMinigameRound);
}

// Sprite Toggle Listener
if (spriteToggleBtn) {
  spriteToggleBtn.addEventListener("click", () => {
    useAnimatedSprites = !useAnimatedSprites;
    localStorage.setItem("sprite_mode", useAnimatedSprites ? "animated" : "artwork");
    updateToggleBtnText();
    reRenderGrid();
  });
}
