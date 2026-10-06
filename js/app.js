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
import { 
  startCameraStream, 
  stopCameraStream, 
  captureAndScanFrame,
  scanUploadedFile
} from "./scanner.js";
import { renderPokemonGrid, renderTeamGrid, renderPokemonModal, renderError } from "./ui.js";
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

// --- Pokeball Opening Animation Helper ---
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

// --- Team UI Helper ---
function updateTeamUI() {
  renderTeamGrid(getTeam(), teamGrid, teamCount);
}

// --- Modal Close Helper ---
function closeModal() {
  if (modalOverlay) modalOverlay.classList.add("hidden");
}

if (modalCloseBtn) modalCloseBtn.addEventListener("click", closeModal);
if (modalOverlay) {
  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) closeModal();
  });
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
  scrollState.active = false;

  gridContainer.innerHTML = `<p class="loading-msg">Filtering Pokédex...</p>`;

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
      hasMore: true
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

// --- Infinite Scroll Listener (Listens to gridContainer internal scroll) ---
gridContainer.addEventListener("scroll", () => {
  if (!scrollState.active || !scrollState.hasMore || scrollState.loading) return;

  const scrollPosition = gridContainer.scrollTop + gridContainer.clientHeight;
  const threshold = gridContainer.scrollHeight - 150;

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

  await applyCombinedFilters();

  // 🎬 Trigger Pokéball slicing opening animation
  triggerPokeballOpening();
});

// Search Form Handler
if (searchForm) {
  searchForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const query = searchInput.value.trim();
    if (!query) return;

    scrollState.active = false;

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

// Main Grid Clicks (Card Click: Play Cry + Open Detail Modal | Team Builder)
gridContainer.addEventListener("click", (e) => {
  // Handle Add to Team button
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

  // Handle Card Click (Plays Cry + Opens Detail Modal)
  const card = e.target.closest(".pokemon-card");
  if (card) {
    const pokemonId = Number(card.dataset.id);
    const pokemon = fetchedCache.get(pokemonId);

    if (pokemon) {
      // 1. Play Pokémon Cry Audio
      if (pokemon.cry) {
        const audio = new Audio(pokemon.cry);
        audio.volume = 0.6;
        audio.play().catch((err) => console.error("Audio playback error:", err));
      }

      // 2. Open Detailed Pokédex View Modal
      renderPokemonModal(pokemon, modalContent);
      modalOverlay.classList.remove("hidden");
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

// --- Open Scanner Modal ---
if (cameraScanBtn) {
  cameraScanBtn.addEventListener("click", () => {
    if (scannerModal) {
      scannerModal.classList.remove("hidden");
      startCameraStream(scannerVideo, scannerStatus);
    }
  });
}

// --- Close Scanner Modal ---
function closeScanner() {
  stopCameraStream();
  if (scannerModal) scannerModal.classList.add("hidden");
}

if (scannerCloseBtn) scannerCloseBtn.addEventListener("click", closeScanner);

// --- Capture & AI Scan Camera Frame ---
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
        // Play Audio Cry & Open Pokédex Detail Modal
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

// --- Upload Photo AI Scanner ---
if (imageUploadInput) {
  imageUploadInput.addEventListener("change", async (e) => {
    const file = e.target.files;
    if (!file) return;

    scannerStatus.textContent = `Uploading ${file.name} to AI classifier...`;

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
