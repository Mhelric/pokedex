// ==========================================
// APPLICATION ENTRY POINT
// ==========================================

import {
  fetchPokemon,
  fetchPokemonForms,
  getPokemonListByType,
  fetchPokemonBatch,
  fetchFullPokedexDirectory,
  GEN_RANGES,
} from "./api.js";
import {
  startCameraStream,
  stopCameraStream,
  captureAndScanFrame,
  scanUploadedFile,
} from "./scanner.js";
import {
  renderPokemonGrid,
  renderTeamGrid,
  renderPokemonModal,
  renderError,
} from "./ui.js";
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

// Modal DOM References
const modalOverlay = document.getElementById("pokemon-modal");
const modalContent = document.getElementById("modal-content");
const modalCloseBtn = document.getElementById("modal-close-btn");

// Scanner DOM References
const cameraScanBtn = document.getElementById("camera-scan-btn");
const scannerModal = document.getElementById("scanner-modal");
const scannerCloseBtn = document.getElementById("scanner-close-btn");
const scannerVideo = document.getElementById("scanner-video");
const scannerCanvas = document.getElementById("scanner-canvas");
const scannerStatus = document.getElementById("scanner-status");
const captureScanBtn = document.getElementById("capture-scan-btn");
const imageUploadInput = document.getElementById("image-upload-input");

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
let currentDisplayedPokemon = [];

// Directory & Live Search State
let pokedexDirectory = [];
let searchDebounceTimer = null;

// Global Active Filter State
let activeType = "all";
let activeType2 = "all";
let activeGen = "all";

// Unified Infinite Scroll State
let scrollState = {
  active: false,
  fullList: [],
  currentIndex: 0,
  loading: false,
  hasMore: false,
};

// --- Helpers ---
function debounce(func, delay = 200) {
  return (...args) => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => func(...args), delay);
  };
}

function triggerPokeballOpening() {
  const overlay = document.getElementById("pokeball-overlay");
  if (!overlay) return;

  setTimeout(() => {
    overlay.classList.add("open");
    setTimeout(() => {
      overlay.classList.add("opened");
    }, 800);
  }, 500);
}

function updateTeamUI() {
  renderTeamGrid(getTeam(), teamGrid, teamCount);
}

function closeModal() {
  if (modalOverlay) modalOverlay.classList.add("hidden");
}

if (modalCloseBtn) modalCloseBtn.addEventListener("click", closeModal);
if (modalOverlay) {
  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) closeModal();
  });
}

function updateToggleBtnText() {
  if (spriteToggleBtn) {
    spriteToggleBtn.textContent = useAnimatedSprites
      ? "Mode: Animated GIFs"
      : "Mode: Official Artwork";
  }
}

function reRenderGrid() {
  if (currentDisplayedPokemon.length > 0) {
    renderPokemonGrid(currentDisplayedPokemon, gridContainer, useAnimatedSprites, false);
  }
}

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

      trigger.className = "dropdown-trigger";

      if (value !== "all" && value !== "none" && isNaN(value)) {
        trigger.classList.add(`type-${value.toLowerCase()}`);
      }

      onSelectCallback(value);
    });
  });
}

document.addEventListener("click", () => {
  document.querySelectorAll(".custom-dropdown").forEach((d) => d.classList.remove("open"));
});

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

async function applyCombinedFilters() {
  scrollState.active = false;
  gridContainer.innerHTML = '<p class="loading-msg">Filtering Pokédex...</p>';

  try {
    let listToBatch = [];

    if (activeType !== "all") {
      const type1List = await getPokemonListByType(activeType);

      if (activeType2 !== "all" && activeType2 !== "none" && activeType2 !== activeType) {
        const type2List = await getPokemonListByType(activeType2);
        const type2Ids = new Set(type2List.map((p) => p.id));
        listToBatch = type1List.filter((p) => type2Ids.has(p.id));
      } else {
        listToBatch = type1List;
      }
    } else if (activeType2 !== "all" && activeType2 !== "none") {
      listToBatch = await getPokemonListByType(activeType2);
    } else {
      const range = GEN_RANGES[activeGen];
      listToBatch = [];
      for (let id = range.start; id <= range.end; id++) {
        listToBatch.push(id);
      }
    }

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

    scrollState = {
      active: true,
      fullList: listToBatch,
      currentIndex: 0,
      loading: false,
      hasMore: true,
    };

    gridContainer.innerHTML = "";
    await loadScrollBatch(true);

    if (activeType2 === "none" || (activeType !== "all" && activeType === activeType2)) {
      currentDisplayedPokemon = currentDisplayedPokemon.filter((p) => p.types.length === 1);
      renderPokemonGrid(currentDisplayedPokemon, gridContainer, useAnimatedSprites, false);
    }
  } catch (error) {
    gridContainer.innerHTML = `<p class="error-msg">❌ ${error.message}</p>`;
  }
}

// Replace handleInstantSearch in js/app.js

async function handleInstantSearch(query) {
  const cleanQuery = query.toLowerCase().trim();

  // If query cleared, restore standard dropdown filtering
  if (!cleanQuery) {
    applyCombinedFilters();
    return;
  }

  // Ensure directory loaded
  if (pokedexDirectory.length === 0) {
    pokedexDirectory = await fetchFullPokedexDirectory();
  }

  scrollState.active = false;
  gridContainer.innerHTML = '<p class="loading-msg">Searching Pokédex...</p>';

  // Reserved modifier keywords representing specific forms/states
  const FORM_KEYWORDS = new Set([
    "mega", "gmax", "dynamax", "gigantamax", "primal",
    "alola", "alolan", "galar", "galarian", "hisui", "hisuian",
    "paldea", "paldean", "origin", "therian", "zen", "sky", "resolute",
    "black", "white", "crowned", "hero", "blade", "school", "ultra",
    "sunny", "rainy", "snowy", "wash", "heat", "frost", "fan", "mow",
    "attack", "defense", "speed", "pirouette", "ash", "busted", "meteor",
    "gulping", "gorging", "hangry", "noice", "mask", "wellspring",
    "hearthflame", "cornerstone", "terastal", "stellar", "eternamax"
  ]);

  const isFormKeywordSearch = FORM_KEYWORDS.has(cleanQuery);

  let fullResults = [];

  if (isFormKeywordSearch) {
    // 1. FORM KEYWORD SEARCH: Only return Pokémon variants matching that form or tag
    // (e.g. typing "wash" only returns Rotom Wash, "mega" only returns Mega forms)
    fullResults = pokedexDirectory.filter((item) => {
      const formMatch = item.forms && item.forms.some((tag) => tag.includes(cleanQuery));
      const displayMatch = item.displayName.toLowerCase().includes(cleanQuery);
      const nameMatch = item.name.toLowerCase().includes(cleanQuery);
      return formMatch || displayMatch || nameMatch;
    });
  } else {
    // 2. MON / SPECIES SEARCH: Find matches by name, ID, or base species
    const directMatches = pokedexDirectory.filter((item) => {
      const idMatch = String(item.id) === cleanQuery;
      const nameMatch = item.name.toLowerCase().includes(cleanQuery);
      const displayMatch = item.displayName.toLowerCase().includes(cleanQuery);
      const baseMatch = item.baseSpecies && item.baseSpecies.toLowerCase().includes(cleanQuery);
      return idMatch || nameMatch || displayMatch || baseMatch;
    });

    // If searching a species (e.g. "castform", "rotom", "deoxys", "ogerpon"),
    // expand so the base form and ALL its alternate forms show together!
    const matchedBases = new Set();
    directMatches.forEach((item) => {
      if (item.baseSpecies && (item.baseSpecies === cleanQuery || cleanQuery.length >= 3)) {
        matchedBases.add(item.baseSpecies.toLowerCase());
      }
    });

    fullResults = pokedexDirectory.filter((item) => {
      if (directMatches.includes(item)) return true;
      if (item.baseSpecies && matchedBases.has(item.baseSpecies.toLowerCase())) {
        return true;
      }
      return false;
    });
  }

  if (fullResults.length === 0) {
    gridContainer.innerHTML = `<p class="status-message">No Pokémon found matching "${query}".</p>`;
    return;
  }

  // 3. Prioritize items starting with query
  fullResults.sort((a, b) => {
    const aLower = a.displayName.toLowerCase();
    const bLower = b.displayName.toLowerCase();

    const aStartsWith = aLower.startsWith(cleanQuery);
    const bStartsWith = bLower.startsWith(cleanQuery);

    if (aStartsWith && !bStartsWith) return -1;
    if (!aStartsWith && bStartsWith) return 1;

    // Display base species before forms
    if (a.baseSpecies === b.baseSpecies) {
      return a.id - b.id;
    }

    return 0;
  });

  // Unique names only
  const seen = new Set();
  const uniqueNames = [];
  for (const item of fullResults) {
    if (!seen.has(item.name)) {
      seen.add(item.name);
      uniqueNames.push(item.name);
    }
  }

  scrollState = {
    active: true,
    fullList: uniqueNames,
    currentIndex: 0,
    loading: false,
    hasMore: true,
  };

  gridContainer.innerHTML = "";
  await loadScrollBatch(true);
}

// Grid Scroll Handler
gridContainer.addEventListener("scroll", () => {
  if (!scrollState.active || !scrollState.hasMore || scrollState.loading) return;

  const scrollPosition = gridContainer.scrollTop + gridContainer.clientHeight;
  const threshold = gridContainer.scrollHeight - 150;

  if (scrollPosition >= threshold) {
    loadScrollBatch(false);
  }
});

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

  // Load directory immediately into memory
  pokedexDirectory = await fetchFullPokedexDirectory();

  await applyCombinedFilters();
  triggerPokeballOpening();
});

// Real-time As-You-Type Input Listener
if (searchInput) {
  searchInput.addEventListener(
    "input",
    debounce((e) => {
      handleInstantSearch(e.target.value);
    }, 200)
  );
}

// Form Submit Interceptor
if (searchForm) {
  searchForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (searchInput) {
      handleInstantSearch(searchInput.value);
    }
  });
}

// Card and Team Clicks
gridContainer.addEventListener("click", (e) => {
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
    return;
  }

  const card = e.target.closest(".pokemon-card");
  if (card) {
    const pokemonId = Number(card.dataset.id);
    const pokemon = fetchedCache.get(pokemonId);

    if (pokemon) {
      if (pokemon.cry) {
        const audio = new Audio(pokemon.cry);
        audio.volume = 0.6;
        audio.play().catch((err) => console.error("Audio playback error:", err));
      }

      renderPokemonModal(pokemon, modalContent);
      modalOverlay.classList.remove("hidden");
    }
  }
});

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

if (spriteToggleBtn) {
  spriteToggleBtn.addEventListener("click", () => {
    useAnimatedSprites = !useAnimatedSprites;
    localStorage.setItem("sprite_mode", useAnimatedSprites ? "animated" : "artwork");
    updateToggleBtnText();
    reRenderGrid();
  });
}

if (cameraScanBtn) {
  cameraScanBtn.addEventListener("click", () => {
    if (scannerModal) {
      scannerModal.classList.remove("hidden");
      startCameraStream(scannerVideo, scannerStatus);
    }
  });
}

function closeScanner() {
  stopCameraStream();
  if (scannerModal) scannerModal.classList.add("hidden");
}

if (scannerCloseBtn) scannerCloseBtn.addEventListener("click", closeScanner);

if (captureScanBtn) {
  captureScanBtn.addEventListener("click", async () => {
    const scannedPokemon = await captureAndScanFrame(
      scannerVideo,
      scannerCanvas,
      scannerStatus
    );

    if (scannedPokemon) {
      setTimeout(() => {
        closeScanner();
        if (scannedPokemon.cry) {
          const audio = new Audio(scannedPokemon.cry);
          audio.volume = 0.6;
          audio.play().catch((e) => console.error(e));
        }
        renderPokemonModal(scannedPokemon, modalContent);
        modalOverlay.classList.remove("hidden");
      }, 1000);
    }
  });
}

if (imageUploadInput) {
  imageUploadInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    scannerStatus.textContent = `Uploading ${file.name} to Lens scanner...`;

    const scannedPokemon = await scanUploadedFile(file, scannerStatus);

    if (scannedPokemon) {
      setTimeout(() => {
        closeScanner();
        if (scannedPokemon.cry) {
          const audio = new Audio(scannedPokemon.cry);
          audio.volume = 0.6;
          audio.play().catch((err) => console.error(err));
        }
        renderPokemonModal(scannedPokemon, modalContent);
        modalOverlay.classList.remove("hidden");
      }, 1000);
    }
  });
}