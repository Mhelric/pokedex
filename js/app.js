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

// Header Switch DOM References
const spriteToggleInput = document.getElementById("sprite-toggle-input");
const toggleModeText = document.getElementById("toggle-mode-text");

// Modal Overlays
const modalOverlay = document.getElementById("pokemon-modal");
const modalContent = document.getElementById("modal-content");
const modalCloseBtn = document.getElementById("modal-close-btn");

const teamModal = document.getElementById("team-modal");
const teamCloseBtn = document.getElementById("team-close-btn");

const gameModal = document.getElementById("game-modal");
const gameCloseBtn = document.getElementById("game-close-btn");

// Scanner DOM References
const scannerModal = document.getElementById("scanner-modal");
const scannerCloseBtn = document.getElementById("scanner-close-btn");
const scannerVideo = document.getElementById("scanner-video");
const scannerCanvas = document.getElementById("scanner-canvas");
const scannerStatus = document.getElementById("scanner-status");
const captureScanBtn = document.getElementById("capture-scan-btn");
const imageUploadInput = document.getElementById("image-upload-input");

// Bottom Nav Bar Controls
const navTeamBtn = document.getElementById("nav-team-btn");
const navScanBtn = document.getElementById("nav-scan-btn");
const navGameBtn = document.getElementById("nav-game-btn");

// Mini-game DOM References
const gameImg = document.getElementById("game-pokemon-img");
const gameOptions = document.getElementById("game-options");
const gameFeedback = document.getElementById("game-feedback");
const nextPokemonBtn = document.getElementById("next-pokemon-btn");
const streakCount = document.getElementById("streak-count");
const highscoreCount = document.getElementById("highscore-count");

// --- Global State ---
const fetchedCache = new Map();

// Default mode is Official Artwork (false = artwork, true = animated GIF)
let useAnimatedSprites = localStorage.getItem("sprite_mode") === "animated";
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

// --- Pokédex Robotic Voice & Audio State ---
let currentActiveCry = null;
let activePokemonForVoice = null;

function stopPokedexAudio() {
  if (currentActiveCry) {
    currentActiveCry.pause();
    currentActiveCry.currentTime = 0;
    currentActiveCry = null;
  }
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
  updateVoiceWaveUI(false);
}

function updateVoiceWaveUI(isSpeaking) {
  const bar = document.getElementById("modal-voice-indicator");
  const label = document.getElementById("modal-voice-status");
  if (!bar || !label) return;

  if (isSpeaking) {
    bar.classList.add("speaking");
    label.textContent = "Speaking... (Click to mute)";
  } else {
    bar.classList.remove("speaking");
    label.textContent = "Play Pokédex Voice";
  }
}

function speakPokemonEntry(pokemon) {
  if (!("speechSynthesis" in window)) return;

  window.speechSynthesis.cancel();

  const cleanDescription = (pokemon.description || "")
    .replace(/["\n\r\f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const typesText = pokemon.types.join(" and ");
  const textToRead = `${pokemon.name}. ${pokemon.genus}. ${typesText} type. ${cleanDescription}`;

  const utterance = new SpeechSynthesisUtterance(textToRead);

  // Select an English voice and configure pitch & rate for a friendly robotic feel
  const voices = window.speechSynthesis.getVoices();
  const selectedVoice =
    voices.find(
      (v) =>
        v.lang.startsWith("en") &&
        (v.name.includes("Google") ||
          v.name.includes("Natural") ||
          v.name.includes("Samantha"))
    ) || voices.find((v) => v.lang.startsWith("en"));

  if (selectedVoice) {
    utterance.voice = selectedVoice;
  }

  utterance.pitch = 1.15; // Slightly elevated pitch for friendly tech feel
  utterance.rate = 1.0;   // Clear, measured cadence

  utterance.onstart = () => updateVoiceWaveUI(true);
  utterance.onend = () => updateVoiceWaveUI(false);
  utterance.onerror = () => updateVoiceWaveUI(false);

  window.speechSynthesis.speak(utterance);
}

function playPokemonCryAndSpeak(pokemon) {
  stopPokedexAudio();
  activePokemonForVoice = pokemon;

  if (pokemon.cry) {
    currentActiveCry = new Audio(pokemon.cry);
    currentActiveCry.volume = 0.6;

    currentActiveCry.onended = () => {
      speakPokemonEntry(pokemon);
    };

    currentActiveCry.play().catch(() => {
      // In case browser autoplay restricts audio, fallback directly to speech
      speakPokemonEntry(pokemon);
    });
  } else {
    speakPokemonEntry(pokemon);
  }
}

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

function showTeamToast(message) {
  let toast = document.getElementById("team-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "team-toast";
    toast.className = "team-toast";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => {
    toast.classList.remove("show");
  }, 1800);
}

function updateTeamUI() {
  renderTeamGrid(getTeam(), teamGrid, teamCount);
}

function updateToggleSwitchUI() {
  if (spriteToggleInput) {
    spriteToggleInput.checked = useAnimatedSprites;
  }
  if (toggleModeText) {
    toggleModeText.textContent = useAnimatedSprites ? "Animated GIFs" : "Official Artwork";
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

      if (value !== "all" && isNaN(value)) {
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

      if (activeType2 !== "all" && activeType2 !== activeType) {
        const type2List = await getPokemonListByType(activeType2);
        const type2Ids = new Set(type2List.map((p) => p.id));
        listToBatch = type1List.filter((p) => type2Ids.has(p.id));
      } else {
        listToBatch = type1List;
      }
    } else if (activeType2 !== "all") {
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
  } catch (error) {
    gridContainer.innerHTML = `<p class="error-msg">❌ ${error.message}</p>`;
  }
}

// --- Instant Search Handler ---
async function handleInstantSearch(query) {
  const cleanQuery = query.toLowerCase().trim();

  if (!cleanQuery) {
    applyCombinedFilters();
    return;
  }

  if (pokedexDirectory.length === 0) {
    pokedexDirectory = await fetchFullPokedexDirectory();
  }

  scrollState.active = false;
  gridContainer.innerHTML = '<p class="loading-msg">Searching Pokédex...</p>';

  const formKeywords = new Set([
    "mega", "gmax", "dynamax", "gigantamax", "primal",
    "alola", "alolan", "galar", "galarian", "hisui", "hisuian",
    "paldea", "paldean", "origin", "therian", "crowned", "hero"
  ]);
  const isKeywordSearch = formKeywords.has(cleanQuery);

  const directMatches = pokedexDirectory.filter((item) => {
    const idMatch = String(item.id) === cleanQuery;
    const formMatch = item.forms && item.forms.some((tag) => tag.includes(cleanQuery));
    const nameMatch = item.name.toLowerCase().includes(cleanQuery);
    const displayMatch = item.displayName.toLowerCase().includes(cleanQuery);
    const baseMatch = item.baseSpecies && item.baseSpecies.toLowerCase().includes(cleanQuery);

    return idMatch || formMatch || nameMatch || displayMatch || baseMatch;
  });

  let fullResults = [];

  if (isKeywordSearch) {
    fullResults = directMatches.filter((item) => {
      const hasTag = item.forms && item.forms.some((tag) => tag.includes(cleanQuery));
      const hasName =
        item.displayName.toLowerCase().includes(cleanQuery) ||
        item.name.toLowerCase().includes(cleanQuery);
      return hasTag || hasName;
    });
  } else {
    const matchedBaseSpecies = new Set();
    directMatches.forEach((item) => {
      if (item.baseSpecies && item.baseSpecies.toLowerCase().includes(cleanQuery)) {
        matchedBaseSpecies.add(item.baseSpecies.toLowerCase());
      }
    });

    fullResults = pokedexDirectory.filter((item) => {
      if (directMatches.includes(item)) return true;
      if (item.baseSpecies && matchedBaseSpecies.has(item.baseSpecies.toLowerCase())) {
        return true;
      }
      return false;
    });
  }

  if (fullResults.length === 0) {
    gridContainer.innerHTML = `<p class="status-message">No Pokémon found matching "${query}".</p>`;
    return;
  }

  fullResults.sort((a, b) => {
    const aLower = a.displayName.toLowerCase();
    const bLower = b.displayName.toLowerCase();

    const aStartsWith = aLower.startsWith(cleanQuery);
    const bStartsWith = bLower.startsWith(cleanQuery);

    if (aStartsWith && !bStartsWith) return -1;
    if (!aStartsWith && bStartsWith) return 1;

    if (a.baseSpecies === b.baseSpecies) {
      return a.id - b.id;
    }

    return 0;
  });

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

// Infinite Grid Scroll Handler
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
  // Preload synthesis voices in Chromium browsers
  if ("speechSynthesis" in window) {
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.getVoices();
    };
  }

  updateTeamUI();
  updateToggleSwitchUI();

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

  fetchFullPokedexDirectory().then((dir) => {
    pokedexDirectory = dir;
  });

  await applyCombinedFilters();
  triggerPokeballOpening();
});

// Live Search Input
if (searchInput) {
  searchInput.addEventListener(
    "input",
    debounce((e) => {
      handleInstantSearch(e.target.value);
    }, 200)
  );
}

if (searchForm) {
  searchForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (searchInput) {
      handleInstantSearch(searchInput.value);
    }
  });
}

// Top-Right Header Switch Change Event
if (spriteToggleInput) {
  spriteToggleInput.addEventListener("change", (e) => {
    useAnimatedSprites = e.target.checked;
    localStorage.setItem("sprite_mode", useAnimatedSprites ? "animated" : "artwork");
    updateToggleSwitchUI();
    reRenderGrid();
  });
}

// --- Bottom Navigation Actions ---
if (navTeamBtn) {
  navTeamBtn.addEventListener("click", () => {
    updateTeamUI();
    teamModal.classList.remove("hidden");
  });
}

if (navScanBtn) {
  navScanBtn.addEventListener("click", () => {
    if (scannerModal) {
      scannerModal.classList.remove("hidden");
      startCameraStream(scannerVideo, scannerStatus);
    }
  });
}

if (navGameBtn) {
  navGameBtn.addEventListener("click", () => {
    initMinigameRound();
    gameModal.classList.remove("hidden");
  });
}

// --- Modal Close Handlers ---
if (teamCloseBtn) {
  teamCloseBtn.addEventListener("click", () => teamModal.classList.add("hidden"));
}
if (teamModal) {
  teamModal.addEventListener("click", (e) => {
    if (e.target === teamModal) teamModal.classList.add("hidden");
  });
}

if (gameCloseBtn) {
  gameCloseBtn.addEventListener("click", () => gameModal.classList.add("hidden"));
}
if (gameModal) {
  gameModal.addEventListener("click", (e) => {
    if (e.target === gameModal) gameModal.classList.add("hidden");
  });
}

if (modalCloseBtn) {
  modalCloseBtn.addEventListener("click", () => {
    stopPokedexAudio();
    modalOverlay.classList.add("hidden");
  });
}
if (modalOverlay) {
  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) {
      stopPokedexAudio();
      modalOverlay.classList.add("hidden");
    }
  });
}

function closeScanner() {
  stopCameraStream();
  if (scannerModal) scannerModal.classList.add("hidden");
}

if (scannerCloseBtn) scannerCloseBtn.addEventListener("click", closeScanner);
if (scannerModal) {
  scannerModal.addEventListener("click", (e) => {
    if (e.target === scannerModal) closeScanner();
  });
}

// --- Interactive Pokédex Voice Bar Listener (Play/Pause/Replay) ---
if (modalContent) {
  modalContent.addEventListener("click", (e) => {
    const voiceBar = e.target.closest("#modal-voice-indicator");
    if (!voiceBar || !activePokemonForVoice) return;

    if (
      window.speechSynthesis.speaking ||
      (currentActiveCry && !currentActiveCry.paused)
    ) {
      stopPokedexAudio();
    } else {
      speakPokemonEntry(activePokemonForVoice);
    }
  });
}

// --- Card and Roster Event Listeners ---
gridContainer.addEventListener("click", (e) => {
  if (e.target.classList.contains("add-team-btn")) {
    const pokemonId = Number(e.target.dataset.id);
    const pokemon = fetchedCache.get(pokemonId);

    if (pokemon) {
      const result = addToTeam(pokemon);
      if (result.success) {
        const card = e.target.closest(".pokemon-card");
        if (card) {
          card.classList.remove("anim-team-added");
          void card.offsetWidth; // Force CSS reflow
          card.classList.add("anim-team-added");
        }
        showTeamToast(`Added ${pokemon.name.toUpperCase()} to your team!`);
        updateTeamUI();
      } else {
        showTeamToast(result.message);
      }
    }
    return;
  }

  const card = e.target.closest(".pokemon-card");
  if (card) {
    const pokemonId = Number(card.dataset.id);
    const pokemon = fetchedCache.get(pokemonId);

    if (pokemon) {
      renderPokemonModal(pokemon, modalContent);
      modalOverlay.classList.remove("hidden");
      playPokemonCryAndSpeak(pokemon);
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

// Scanner Actions
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
        renderPokemonModal(scannedPokemon, modalContent);
        modalOverlay.classList.remove("hidden");
        playPokemonCryAndSpeak(scannedPokemon);
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
        renderPokemonModal(scannedPokemon, modalContent);
        modalOverlay.classList.remove("hidden");
        playPokemonCryAndSpeak(scannedPokemon);
      }, 1000);
    }
  });
}