// ==========================================
// APPLICATION ENTRY POINT
// ==========================================

import { 
  fetchPokemon, 
  fetchPokemonForms, 
  getPokemonListByType,
  fetchPokemonBatch,
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
let activeType = "all";   // Type 1
let activeType2 = "all";  // Type 2
let activeGen = "all";    // Generation

// Unified Infinite Scroll State
let scrollState = {
  active: false,
  fullList: [],      // Target array of IDs or names to fetch
  currentIndex: 0,
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

// --- Custom Dropdown Setup with Dynamic Type Colors ---
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

      // Reset base classes on trigger
      trigger.className = "dropdown-trigger";

      // Dynamically assign type color class if a specific element type is chosen
      if (value !== "all" && value !== "none" && isNaN(value)) {
        trigger.classList.add(`type-${value.toLowerCase()}`);
      }

      onSelectCallback(value);
    });
  });
}

// Close dropdowns when clicking anywhere outside
document.addEventListener("click", () => {
  document.querySelectorAll(".custom-dropdown").forEach((d) => d.classList.remove("open"));
});

// --- Unified Batch Loader for Infinite Scroll ---
async function loadScrollBatch(isFirstBatch = false) {
  if (!scrollState.active || scrollState.loading || !scrollState.hasMore) return;

  scrollState.loading = true;

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
    const { pokemonList, nextIndex, hasMore } = await fetchPokemonBatch(
      scrollState.fullList,
      scrollState.currentIndex,
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

    scrollState.currentIndex = nextIndex;
    scrollState.hasMore = hasMore;
  } catch (error) {
    const scrollLoader = document.getElementById("scroll-loader");
    if (scrollLoader) scrollLoader.remove();
    console.error("Scroll load error:", error);
  } finally {
    scrollState.loading = false;
  }
}

// --- Combined Filter Logic ---
async function applyCombinedFilters() {
  scrollState.active = false; // Reset current infinite scroll session

  gridContainer.innerHTML = `<p class="loading-msg">Filtering Pokédex...</p>`;

  try {
    let listToBatch = [];

    // Case 1: Primary Type selected
    if (activeType !== "all") {
      const type1List = await getPokemonListByType(activeType);

      // Case 1a: Secondary Type is specific (and different from Type 1)
      if (activeType2 !== "all" && activeType2 !== "none" && activeType2 !== activeType) {
        const type2List = await getPokemonListByType(activeType2);
        const type2Ids = new Set(type2List.map((p) => p.id));
        
        // Find Pokémon that have BOTH Type 1 AND Type 2
        listToBatch = type1List.filter((p) => type2Ids.has(p.id));

      } else {
        // Type 1 only
        listToBatch = type1List;
      }

    } else if (activeType2 !== "all" && activeType2 !== "none") {
      // Case 2: Only Secondary Type selected
      listToBatch = await getPokemonListByType(activeType2);

    } else {
      // Case 3: All Types selected -> Generate full range of IDs
      const range = GEN_RANGES[activeGen];
      listToBatch = [];
      for (let id = range.start; id <= range.end; id++) {
        listToBatch.push(id);
      }
    }

    // Filter by Generation ID range if a specific generation is selected
    if (activeGen !== "all") {
      const range = GEN_RANGES[activeGen];
      listToBatch = listToBatch.filter((p) => {
        const id = typeof p === "object" ? p.id : p;
        return id >= range.start && id <= range.end;
      });
    }

    if (listToBatch.length === 0) {
      gridContainer.innerHTML = `<p class="status-message">No matching Pokémon found.</p>`;
      return;
    }

    // Initialize unified scroll state
    scrollState = {
      active: true,
      fullList: listToBatch,
      currentIndex: 0,
      loading: false,
      hasMore: true
    };

    gridContainer.innerHTML = "";
    
    // Fetch initial 10 cards
    await loadScrollBatch(true);

    // If pure-type filtering is requested (e.g. Electric + Electric or Type 2 == 'none')
    if (activeType2 === "none" || (activeType !== "all" && activeType === activeType2)) {
      currentDisplayedPokemon = currentDisplayedPokemon.filter((p) => p.types.length === 1);
      renderPokemonGrid(currentDisplayedPokemon, gridContainer, useAnimatedSprites, false);
    }

  } catch (error) {
    gridContainer.innerHTML = `<p class="error-msg">❌ ${error.message}</p>`;
  }
}

// --- Infinite Scroll Event Listener ---
window.addEventListener("scroll", () => {
  if (!scrollState.active || !scrollState.hasMore || scrollState.loading) return;

  const scrollPosition = window.innerHeight + window.scrollY;
  const threshold = document.body.offsetHeight - 350;

  if (scrollPosition >= threshold) {
    loadScrollBatch(false);
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

  setupCustomDropdown("type2-dropdown", (selectedType2) => {
    activeType2 = selectedType2;
    applyCombinedFilters();
  });

  setupCustomDropdown("gen-dropdown", (selectedGen) => {
    activeGen = selectedGen;
    applyCombinedFilters();
  });

  // Initial page load
  await applyCombinedFilters();

  // 🎬 Trigger Pokéball slicing open animation
  triggerPokeballOpening();
});

// Search Form Handler
if (searchForm) {
  searchForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const query = searchInput.value.trim();
    if (!query) return;

    // Stop Infinite Scroll session on search
    scrollState.active = false;

    // Reset Dropdown Labels, Active Filter States, and Button Trigger Colors
    activeType = "all";
    activeType2 = "all";
    activeGen = "all";

    document.querySelectorAll(".dropdown-trigger").forEach((t) => {
      t.className = "dropdown-trigger";
    });

    const typeLabel = document.querySelector("#type-dropdown .trigger-label");
    const type2Label = document.querySelector("#type2-dropdown .trigger-label");
    const genLabel = document.querySelector("#gen-dropdown .trigger-label");

    if (typeLabel) typeLabel.textContent = "Type 1: All";
    if (type2Label) type2Label.textContent = "Type 2: Any";
    if (genLabel) genLabel.textContent = "All Generations";

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

// --- Pokeball Opening Animation Helper ---
function triggerPokeballOpening() {
  const overlay = document.getElementById("pokeball-overlay");
  if (!overlay) return;

  // Short pause so user sees the Pokéball splash before it slices open
  setTimeout(() => {
    overlay.classList.add("open");
    setTimeout(() => {
      overlay.classList.add("opened");
    }, 800); // Matches CSS transition duration
  }, 500);
}
