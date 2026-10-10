// ==========================================
// APPLICATION ENTRY POINT
// ==========================================

import {
  fetchPokemon,
  getPokemonListByType,
  fetchPokemonBatch,
  fetchFullPokedexDirectory,
  GEN_RANGES,
  isItemInGenRange,
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
  getFilteredMoves,
  getPokemonFlavorText,
  renderError,
} from "./ui.js";
import { getTeam, addToTeam, removeFromTeam, clearTeam } from "./team.js";
import { startNewRound, handleGuess } from "./minigame.js";

// ==========================================
// DOM REFERENCES
// ==========================================

// --- Search, Filter & Main Grid ---
const searchInput = document.getElementById("search-input");
const filterExpandBtn = document.getElementById("filter-expand-btn");
const filterDrawer = document.getElementById("filter-drawer");
const activeFilterIndicator = document.getElementById("active-filter-indicator");
const gridContainer = document.getElementById("pokemon-grid");
const spriteToggleInput = document.getElementById("sprite-toggle-input");
const toggleModeText = document.getElementById("toggle-mode-text");

// --- Pokémon Detail Modal ---
const modalOverlay = document.getElementById("pokemon-modal");
const modalContent = document.getElementById("modal-content");
const modalCloseBtn = document.getElementById("modal-close-btn");

// --- Team Builder Modal ---
const teamModal = document.getElementById("team-modal");
const teamCloseBtn = document.getElementById("team-close-btn");
const teamGrid = document.getElementById("team-grid");
const teamCount = document.getElementById("team-count");
const clearTeamBtn = document.getElementById("clear-team-btn");

// --- Scanner / Camera Modal ---
const scannerModal = document.getElementById("scanner-modal");
const scannerCloseBtn = document.getElementById("scanner-close-btn");
const scannerVideo = document.getElementById("scanner-video");
const scannerCanvas = document.getElementById("scanner-canvas");
const scannerStatus = document.getElementById("scanner-status");
const captureScanBtn = document.getElementById("capture-scan-btn");
const imageUploadInput = document.getElementById("image-upload-input");

// --- Minigame Modal ---
const gameModal = document.getElementById("game-modal");
const gameCloseBtn = document.getElementById("game-close-btn");
const gameImg = document.getElementById("game-pokemon-img");
const gameOptions = document.getElementById("game-options");
const gameFeedback = document.getElementById("game-feedback");
const nextPokemonBtn = document.getElementById("next-pokemon-btn");
const streakCount = document.getElementById("streak-count");
const highscoreCount = document.getElementById("highscore-count");

// --- Favorites Modal ---
const navFavoritesBtn = document.getElementById("nav-favorites-btn");
const favoritesModal = document.getElementById("favorites-modal");
const favoritesCloseBtn = document.getElementById("favorites-close-btn");
const favoritesGrid = document.getElementById("favorites-grid");
const favoritesCount = document.getElementById("favorites-count");

// --- Caught & PC Storage Modal ---
const navCaughtBtn = document.getElementById("nav-caught-btn");
const caughtModal = document.getElementById("caught-modal");
const caughtCloseBtn = document.getElementById("caught-close-btn");
const caughtGrid = document.getElementById("caught-grid");
const caughtBoxGrid = document.getElementById("caught-box-grid");
const caughtCount = document.getElementById("caught-count");
const caughtProgressFill = document.getElementById("caught-progress-fill");
const caughtProgressPercent = document.getElementById("caught-progress-percent");
const clearCaughtBtn = document.getElementById("clear-caught-btn");

// PC Summary / Slide Drawer Elements
const pcSlideDrawer = document.getElementById("pc-slide-drawer");
const pcDrawerBackdrop = document.getElementById("pc-drawer-backdrop");
const pcDrawerCloseBtn = document.getElementById("pc-drawer-close-btn");
const pcSummaryEmpty = document.getElementById("pc-summary-empty");
const pcSummaryContent = document.getElementById("pc-summary-content");
const pcMonId = document.getElementById("pc-mon-id");
const pcMonSprite = document.getElementById("pc-mon-sprite");
const pcMonArtwork = document.getElementById("pc-mon-artwork");
const pcMonName = document.getElementById("pc-mon-name");
const pcMonGenus = document.getElementById("pc-mon-genus");
const pcMonTypes = document.getElementById("pc-mon-types");
const pcMonHp = document.getElementById("pc-mon-hp");
const pcMonAtk = document.getElementById("pc-mon-atk");
const pcMonDef = document.getElementById("pc-mon-def");
const pcOpenDetailsBtn = document.getElementById("pc-open-details-btn");
const pcUnmarkBtn = document.getElementById("pc-unmark-btn");

// --- Bottom Navigation ---
const navTeamBtn = document.getElementById("nav-team-btn");
const navScanBtn = document.getElementById("nav-scan-btn");
const navGameBtn = document.getElementById("nav-game-btn");

// ==========================================
// GLOBAL STATE
// ==========================================

const fetchedCache = new Map();
let currentActivePokemon = null;
let activeSelectedBoxPokemon = null;

let currentModalGame = "scarlet-violet";
let currentMoveCategory = "level-up";
let useAnimatedSprites = localStorage.getItem("sprite_mode") === "animated";

let currentDisplayedPokemon = [];
let pokedexDirectory = [];
let searchDebounceTimer = null;
let backgroundAbortController = null;

let activeType = "all";
let activeType2 = "all";
let activeGen = "all";

let scrollState = {
  active: false,
  fullList: [],
  currentIndex: 0,
  loading: false,
  hasMore: false,
};

let currentActiveCry = null;
let activePokemonForVoice = null;

// ==========================================
// CORE UTILITIES & BACKGROUND CONTROLLERS
// ==========================================

function abortBackgroundOperations() {
  if (backgroundAbortController) {
    backgroundAbortController.abort();
    backgroundAbortController = null;
  }
  scrollState.loading = false;
  setSearchLoading(false);
}

function createBackgroundSignal() {
  abortBackgroundOperations();
  backgroundAbortController = new AbortController();
  return backgroundAbortController.signal;
}

function setSearchLoading(isLoading) {
  const searchWrapper = document.querySelector(".search-box-wrapper");
  if (!searchWrapper) return;

  let spinner = document.getElementById("search-input-spinner");
  if (isLoading) {
    if (!spinner) {
      spinner = document.createElement("div");
      spinner.id = "search-input-spinner";
      spinner.className = "input-spinner";
      searchWrapper.appendChild(spinner);
    }
  } else {
    if (spinner) spinner.remove();
  }
}

function debounce(func, delay = 350) {
  return (...args) => {
    setSearchLoading(true);
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => func(...args), delay);
  };
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

// ==========================================
// AUDIO & SPEECH SYNTHESIS
// ==========================================

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

function speakPokemonEntry(pokemon, explicitDescription = null) {
  if (!("speechSynthesis" in window)) return;

  window.speechSynthesis.cancel();

  const descriptionToRead = explicitDescription || getPokemonFlavorText(pokemon, currentModalGame);
  const cleanDescription = (descriptionToRead || "")
    .replace(/["\n\r\f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const typesText = pokemon.types.join(" and ");
  const textToRead = `${pokemon.name}. ${pokemon.genus}. ${typesText} type. ${cleanDescription}`;

  const utterance = new SpeechSynthesisUtterance(textToRead);
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

  utterance.pitch = 1.15;
  utterance.rate = 1.0;

  utterance.onstart = () => updateVoiceWaveUI(true);
  utterance.onend = () => updateVoiceWaveUI(false);
  utterance.onerror = () => updateVoiceWaveUI(false);

  window.speechSynthesis.speak(utterance);
}

function playPokemonCryAndSpeak(pokemon, explicitDescription = null) {
  stopPokedexAudio();
  activePokemonForVoice = pokemon;

  if (pokemon.cry) {
    currentActiveCry = new Audio(pokemon.cry);
    currentActiveCry.volume = 0.6;

    currentActiveCry.onended = () => {
      speakPokemonEntry(pokemon, explicitDescription);
    };

    currentActiveCry.play().catch(() => {
      speakPokemonEntry(pokemon, explicitDescription);
    });
  } else {
    speakPokemonEntry(pokemon, explicitDescription);
  }
}

// ==========================================
// GRID, TEAM & FILTER CONTROLLERS
// ==========================================

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

function refreshFilterIndicator() {
  if (activeFilterIndicator) {
    if (activeType !== "all" || activeType2 !== "all" || activeGen !== "all") {
      activeFilterIndicator.classList.remove("hidden");
    } else {
      activeFilterIndicator.classList.add("hidden");
    }
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

async function loadScrollBatch(isFirstBatch = false) {
  if (!scrollState.active || scrollState.loading || !scrollState.hasMore) return;

  scrollState.loading = true;
  const signal = createBackgroundSignal();

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
      24,
      signal
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
    if (error.name === "AbortError") return;
    const scrollLoader = document.getElementById("scroll-loader");
    if (scrollLoader) scrollLoader.remove();
    console.error("Scroll load error:", error);
  } finally {
    scrollState.loading = false;
  }
}

async function applyCombinedFilters() {
  abortBackgroundOperations();
  refreshFilterIndicator();
  scrollState.active = false;
  gridContainer.innerHTML = `
    <div class="search-loader-container">
      <div class="pokeball-spinner"></div>
      <span class="search-loader-text">Filtering Pokédex...</span>
    </div>
  `;

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
      listToBatch = listToBatch.filter((item) => {
        const pokeItem = typeof item === "object" ? { ...item, id: Number(item.id) } : Number(item);
        return isItemInGenRange(pokeItem, activeGen);
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
    if (error.name === "AbortError") return;
    gridContainer.innerHTML = `<p class="error-msg">❌ ${error.message}</p>`;
  }
}

// ==========================================
// MODAL CONTROLLERS & DATA DISPLAY
// ==========================================

async function openPokemonModal(identifier) {
  abortBackgroundOperations();

  modalContent.innerHTML = `<div class="modal-loading-state"><p>Loading complete Pokédex data...</p></div>`;
  modalOverlay.classList.remove("hidden");

  try {
    const numId = Number(identifier);
    let fullPokemon =
      (!isNaN(numId) && fetchedCache.get(numId)) ||
      fetchedCache.get(String(identifier).toLowerCase());

    if (!fullPokemon) {
      fullPokemon = await fetchPokemon(identifier);
      fetchedCache.set(fullPokemon.id, fullPokemon);
      fetchedCache.set(fullPokemon.rawName.toLowerCase(), fullPokemon);
    }
    currentActivePokemon = fullPokemon;

    renderPokemonModal(fullPokemon, modalContent, currentModalGame);
    playPokemonCryAndSpeak(fullPokemon);
  } catch (err) {
    if (err.name === "AbortError") return;
    renderError(`Could not load Pokémon details: ${err.message}`, modalContent);
  }
}

function updateMovepoolTable() {
  if (!currentActivePokemon) return;
  const tbody = document.getElementById("modal-moves-body");
  if (!tbody) return;

  const filteredMoves = getFilteredMoves(
    currentActivePokemon,
    currentModalGame,
    currentMoveCategory
  );

  if (filteredMoves.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" class="empty-note">No moves found for this category in the selected generation.</td></tr>`;
    return;
  }

  tbody.innerHTML = filteredMoves
    .map(
      (m) => `
      <tr class="move-row">
        <td class="move-level">${m.level === 0 ? "Evo" : m.level}</td>
        <td class="move-name">${m.name}</td>
        <td class="move-type"><span class="badge-subtle">Learned</span></td>
      </tr>
    `
    )
    .join("");
}

async function renderCollectionModal(prefix, container, countElem) {
  if (!container) return;
  abortBackgroundOperations();
  const signal = createBackgroundSignal();

  const targetIds = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith(`${prefix}_`) && localStorage.getItem(key) === "true") {
      const id = Number(key.replace(`${prefix}_`, ""));
      if (!isNaN(id)) targetIds.push(id);
    }
  }

  targetIds.sort((a, b) => a - b);
  if (countElem) countElem.textContent = targetIds.length;

  if (targetIds.length === 0) {
    container.innerHTML = `<div class="modal-empty-state">No Pokémon recorded yet.</div>`;
    return;
  }

  container.innerHTML = `<p class="loading-msg">Loading entries...</p>`;

  try {
    const { pokemonList } = await fetchPokemonBatch(targetIds, 0, targetIds.length, signal);
    pokemonList.forEach((p) => fetchedCache.set(p.id, p));
    renderPokemonGrid(pokemonList, container, useAnimatedSprites, false);
  } catch (err) {
    if (err.name !== "AbortError") {
      container.innerHTML = `<p class="error-msg">Failed to load entries.</p>`;
    }
  }
}

function updateCaughtProgress(totalCaught) {
  const percent = ((totalCaught / 1025) * 100).toFixed(1);
  if (caughtProgressFill) {
    caughtProgressFill.style.width = `${Math.min(100, percent)}%`;
  }
  if (caughtProgressPercent) {
    caughtProgressPercent.textContent = `${percent}%`;
  }
}

// ==========================================
// PC STORAGE BOX & DRAWER SYSTEM
// ==========================================

function closePCDrawer() {
  if (pcSlideDrawer) pcSlideDrawer.classList.remove("open");
  if (pcDrawerBackdrop) pcDrawerBackdrop.classList.add("hidden");
  if (caughtBoxGrid) {
    caughtBoxGrid.querySelectorAll(".pc-box-slot").forEach((s) => s.classList.remove("active"));
  }
  activeSelectedBoxPokemon = null;
}

function openPCDrawer(pokemon) {
  if (!pokemon) return;
  activeSelectedBoxPokemon = pokemon;

  if (pcMonId) pcMonId.textContent = `#${String(pokemon.id).padStart(3, "0")}`;
  if (pcMonName) pcMonName.textContent = pokemon.name;
  if (pcMonGenus) pcMonGenus.textContent = pokemon.genus || "Pokémon";

  const artworkSrc =
    pokemon.officialArtwork ||
    pokemon.image ||
    `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokemon.id}.png`;
  if (pcMonArtwork) pcMonArtwork.src = artworkSrc;

  const spriteSrc =
    pokemon.sprite ||
    `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemon.id}.png`;
  if (pcMonSprite) pcMonSprite.src = spriteSrc;

  if (pcMonTypes) {
    pcMonTypes.innerHTML = (pokemon.types || [])
      .map((t) => `<span class="type-badge type-${t}">${t}</span>`)
      .join("");
  }

  if (pcMonHp) pcMonHp.textContent = pokemon.stats?.hp || "-";
  if (pcMonAtk) pcMonAtk.textContent = pokemon.stats?.attack || "-";
  if (pcMonDef) pcMonDef.textContent = pokemon.stats?.defense || "-";

  if (pcSlideDrawer) pcSlideDrawer.classList.add("open");
  if (pcDrawerBackdrop) pcDrawerBackdrop.classList.remove("hidden");

  if (pcSummaryEmpty) pcSummaryEmpty.classList.add("hidden");
  if (pcSummaryContent) pcSummaryContent.classList.remove("hidden");
}

async function renderPCStorageBox() {
  if (!caughtBoxGrid) return;
  closePCDrawer();
  abortBackgroundOperations();
  const signal = createBackgroundSignal();

  const caughtIds = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith("caught_") && localStorage.getItem(key) === "true") {
      const id = Number(key.replace("caught_", ""));
      if (!isNaN(id)) caughtIds.push(id);
    }
  }

  caughtIds.sort((a, b) => a - b);
  if (caughtCount) caughtCount.textContent = caughtIds.length;
  updateCaughtProgress(caughtIds.length);

  if (caughtIds.length === 0) {
    caughtBoxGrid.innerHTML = `<p class="status-message" style="grid-column: 1 / -1;">No Pokémon caught yet.</p>`;
    if (pcSummaryContent) pcSummaryContent.classList.add("hidden");
    if (pcSummaryEmpty) pcSummaryEmpty.classList.remove("hidden");
    return;
  }

  caughtBoxGrid.innerHTML = `<p class="loading-msg" style="grid-column: 1 / -1;">Loading caught Pokémon...</p>`;

  try {
    const { pokemonList } = await fetchPokemonBatch(caughtIds, 0, caughtIds.length, signal);
    pokemonList.forEach((p) => fetchedCache.set(p.id, p));

    caughtBoxGrid.innerHTML = pokemonList
      .map((p) => {
        const sprite =
          p.sprite ||
          `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${p.id}.png`;
        return `
          <div class="pc-box-slot" data-id="${p.id}" title="${p.name} (#${p.id})">
            <img src="${sprite}" alt="${p.name}" class="pc-pixel-sprite" loading="lazy" />
          </div>
        `;
      })
      .join("");
  } catch (err) {
    if (err.name !== "AbortError") {
      caughtBoxGrid.innerHTML = `<p class="error-msg" style="grid-column: 1 / -1;">Error loading Pokémon.</p>`;
    }
  }
}

// ==========================================
// SCANNER UTILITIES
// ==========================================

function closeScanner() {
  stopCameraStream();
  if (scannerModal) scannerModal.classList.add("hidden");
}

// ==========================================
// INITIALIZATION & EVENT LISTENERS
// ==========================================

document.addEventListener("DOMContentLoaded", async () => {
  if ("speechSynthesis" in window) {
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.getVoices();
    };
  }

  updateTeamUI();
  updateToggleSwitchUI();
  refreshFilterIndicator();

  if (filterExpandBtn && filterDrawer) {
    filterExpandBtn.addEventListener("click", () => {
      filterDrawer.classList.toggle("collapsed");
      filterExpandBtn.classList.toggle("active");
    });
  }

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

document.addEventListener("click", () => {
  document.querySelectorAll(".custom-dropdown").forEach((d) => d.classList.remove("open"));
});

// --- Main Grid Infinite Scroll ---
if (gridContainer) {
  gridContainer.addEventListener("scroll", () => {
    if (
      gridContainer.scrollTop + gridContainer.clientHeight >=
      gridContainer.scrollHeight - 350
    ) {
      loadScrollBatch(false);
    }
  });
}

// --- Live Search ---
if (searchInput) {
  searchInput.addEventListener(
    "input",
    debounce(async (e) => {
      const cleanQuery = e.target.value.toLowerCase().trim();
      if (!cleanQuery) {
        setSearchLoading(false);
        applyCombinedFilters();
        return;
      }

      abortBackgroundOperations();
      const signal = createBackgroundSignal();

      if (pokedexDirectory.length === 0) {
        pokedexDirectory = await fetchFullPokedexDirectory();
      }

      scrollState.active = false;
      gridContainer.innerHTML = `
        <div class="search-loader-container">
          <div class="pokeball-spinner"></div>
          <span class="search-loader-text">Searching Pokédex...</span>
        </div>
      `;

      const directMatches = pokedexDirectory.filter((item) => {
        const idMatch = String(item.id) === cleanQuery;
        const formMatch = item.forms && item.forms.some((tag) => tag.includes(cleanQuery));
        const nameMatch = item.name.toLowerCase().includes(cleanQuery);
        const displayMatch = item.displayName.toLowerCase().includes(cleanQuery);
        const baseMatch = item.baseSpecies && item.baseSpecies.toLowerCase().includes(cleanQuery);
        return idMatch || formMatch || nameMatch || displayMatch || baseMatch;
      });

      if (directMatches.length === 0) {
        setSearchLoading(false);
        gridContainer.innerHTML = `<p class="status-message">No Pokémon found matching "${e.target.value}".</p>`;
        return;
      }

      const uniqueNames = [...new Set(directMatches.map((m) => m.name))];
      scrollState = {
        active: true,
        fullList: uniqueNames,
        currentIndex: 0,
        loading: false,
        hasMore: true,
      };

      gridContainer.innerHTML = "";
      try {
        const { pokemonList, nextIndex, hasMore } = await fetchPokemonBatch(
          uniqueNames,
          0,
          uniqueNames.length,
          signal
        );
        pokemonList.forEach((p) => {
          fetchedCache.set(p.id, p);
          fetchedCache.set(p.rawName.toLowerCase(), p);
        });
        currentDisplayedPokemon = [...pokemonList];
        renderPokemonGrid(pokemonList, gridContainer, useAnimatedSprites, false);
        scrollState.currentIndex = nextIndex;
        scrollState.hasMore = hasMore;
      } catch (err) {
        if (err.name === "AbortError") return;
        console.error("Search batch error:", err);
      } finally {
        setSearchLoading(false);
      }
    }, 350)
  );
}

// --- Sprite Mode Switch ---
if (spriteToggleInput) {
  spriteToggleInput.addEventListener("change", (e) => {
    useAnimatedSprites = e.target.checked;
    localStorage.setItem("sprite_mode", useAnimatedSprites ? "animated" : "artwork");
    updateToggleSwitchUI();
    reRenderGrid();
  });
}

// --- Main Grid Card Event Delegations ---
if (gridContainer) {
  gridContainer.addEventListener("click", (e) => {
    // 1. Caught / Identified Toggle
    const caughtBtn = e.target.closest(".caught-btn");
    if (caughtBtn) {
      e.stopPropagation();
      const pokeId = caughtBtn.dataset.id;
      const isCaught = localStorage.getItem(`caught_${pokeId}`) === "true";
      localStorage.setItem(`caught_${pokeId}`, (!isCaught).toString());
      caughtBtn.classList.toggle("active", !isCaught);
      caughtBtn.title = !isCaught ? "Identified / Caught" : "Mark Caught";
      showTeamToast(!isCaught ? "Marked as Caught! 🎯" : "Removed from Caught list");
      return;
    }

    // 2. Favorite / Love Toggle
    const favBtn = e.target.closest(".fav-btn");
    if (favBtn) {
      e.stopPropagation();
      const pokeId = favBtn.dataset.id;
      const isFav = localStorage.getItem(`fav_${pokeId}`) === "true";
      localStorage.setItem(`fav_${pokeId}`, (!isFav).toString());
      favBtn.classList.toggle("active", !isFav);
      favBtn.title = !isFav ? "Favorited" : "Favorite";
      const icon = favBtn.querySelector("i");
      if (icon) {
        icon.className = !isFav ? "fa-solid fa-heart" : "fa-regular fa-heart";
      }
      showTeamToast(!isFav ? "Added to Favorites! ❤️" : "Removed from Favorites");
      return;
    }

    // 3. Add to Team
    if (e.target.classList.contains("add-team-btn")) {
      const pokemonId = Number(e.target.dataset.id);
      const pokemon = fetchedCache.get(pokemonId);

      if (pokemon) {
        const result = addToTeam(pokemon);
        if (result.success) {
          const card = e.target.closest(".pokemon-card");
          if (card) {
            card.classList.remove("anim-team-added");
            void card.offsetWidth;
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

    // 4. Open Modal Card View
    const card = e.target.closest(".pokemon-card");
    if (card) {
      const pokemonId = Number(card.dataset.id);
      openPokemonModal(pokemonId);
    }
  });
}

// --- Detail Modal Interactive Delegations ---
if (modalContent) {
  modalContent.addEventListener("click", (e) => {
    // 1. Game / Gen Selector Accordion
    const gameToggleBtn = e.target.closest("#game-selector-toggle");
    if (gameToggleBtn) {
      const drawer = modalContent.querySelector("#game-drawer");
      const targetSection = modalContent.querySelector("#game-selector-section");

      if (drawer) {
        const willOpen = drawer.classList.contains("collapsed");
        drawer.classList.toggle("collapsed");
        gameToggleBtn.classList.toggle("active", willOpen);
        gameToggleBtn.setAttribute("aria-expanded", willOpen.toString());

        if (willOpen && targetSection) {
          setTimeout(() => {
            targetSection.scrollIntoView({
              behavior: "smooth",
              block: "start",
            });
          }, 80);
        }
      }
      return;
    }

    // 2. Game Version Pill Selection
    const gamePill = e.target.closest(".game-pill-btn");
    if (gamePill) {
      modalContent.querySelectorAll(".game-pill-btn").forEach((p) => p.classList.remove("active"));
      gamePill.classList.add("active");

      currentModalGame = gamePill.dataset.game;

      if (currentActivePokemon) {
        const newFlavorText = getPokemonFlavorText(currentActivePokemon, currentModalGame);
        const flavorElem = document.getElementById("modal-flavor-text");
        if (flavorElem) {
          flavorElem.textContent = `"${newFlavorText}"`;
        }

        updateMovepoolTable();
        speakPokemonEntry(currentActivePokemon, newFlavorText);
      }
      return;
    }

    // 3. Movepool Category Tabs
    const tabBtn = e.target.closest(".tab-btn");
    if (tabBtn) {
      modalContent.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      tabBtn.classList.add("active");
      currentMoveCategory = tabBtn.dataset.category;
      updateMovepoolTable();
      return;
    }

    // 4. Variety / Form Switcher
    const varietyCard = e.target.closest(".variety-card-item");
    if (varietyCard) {
      const targetName = varietyCard.dataset.name;
      if (targetName && (!currentActivePokemon || currentActivePokemon.rawName !== targetName)) {
        openPokemonModal(targetName);
      }
      return;
    }

    // 5. Evolution Tree Nodes
    const evoNode = e.target.closest(".evo-node");
    if (evoNode) {
      const evoTarget = evoNode.dataset.species;
      if (
        evoTarget &&
        (!currentActivePokemon ||
          (currentActivePokemon.rawName.toLowerCase() !== evoTarget.toLowerCase() &&
            currentActivePokemon.speciesName.toLowerCase() !== evoTarget.toLowerCase()))
      ) {
        openPokemonModal(evoTarget);
      }
      return;
    }

    // 6. Voice Wave Play / Stop
    const voiceBar = e.target.closest("#modal-voice-indicator");
    if (voiceBar && activePokemonForVoice) {
      if (window.speechSynthesis.speaking || (currentActiveCry && !currentActiveCry.paused)) {
        stopPokedexAudio();
      } else {
        const text = getPokemonFlavorText(activePokemonForVoice, currentModalGame);
        speakPokemonEntry(activePokemonForVoice, text);
      }
    }
  });
}

// --- Navigation Buttons ---
if (navTeamBtn) {
  navTeamBtn.addEventListener("click", () => {
    updateTeamUI();
    teamModal.classList.remove("hidden");
  });
}

if (navFavoritesBtn) {
  navFavoritesBtn.addEventListener("click", () => {
    favoritesModal.classList.remove("hidden");
    renderCollectionModal("fav", favoritesGrid, favoritesCount);
  });
}

if (navCaughtBtn) {
  navCaughtBtn.addEventListener("click", () => {
    caughtModal.classList.remove("hidden");
    if (caughtBoxGrid) {
      renderPCStorageBox();
    } else {
      renderCollectionModal("caught", caughtGrid, caughtCount).then(() => {
        const count = Number(caughtCount?.textContent || 0);
        updateCaughtProgress(count);
      });
    }
  });
}

if (navScanBtn) {
  navScanBtn.addEventListener("click", () => {
    abortBackgroundOperations();
    if (scannerModal) {
      scannerModal.classList.remove("hidden");
      startCameraStream(scannerVideo, scannerStatus);
    }
  });
}

if (navGameBtn) {
  navGameBtn.addEventListener("click", () => {
    abortBackgroundOperations();
    if (nextPokemonBtn) nextPokemonBtn.style.display = "none";
    startNewRound(gameImg, gameOptions, gameFeedback, streakCount, highscoreCount);
    gameModal.classList.remove("hidden");
  });
}

// --- Team Modal Listeners ---
if (teamGrid) {
  teamGrid.addEventListener("click", (e) => {
    if (e.target.classList.contains("remove-btn")) {
      const pokemonId = Number(e.target.dataset.id);
      removeFromTeam(pokemonId);
      updateTeamUI();
    }
  });
}

if (clearTeamBtn) {
  clearTeamBtn.addEventListener("click", () => {
    clearTeam();
    updateTeamUI();
  });
}

// --- PC Storage Grid & Drawer Events ---
if (caughtBoxGrid) {
  caughtBoxGrid.addEventListener("click", (e) => {
    const slot = e.target.closest(".pc-box-slot");
    if (!slot) return;

    caughtBoxGrid.querySelectorAll(".pc-box-slot").forEach((s) => s.classList.remove("active"));
    slot.classList.add("active");

    const pokemonId = Number(slot.dataset.id);
    const pokemon = fetchedCache.get(pokemonId);
    if (pokemon) {
      openPCDrawer(pokemon);
    }
  });
}

if (pcDrawerCloseBtn) pcDrawerCloseBtn.addEventListener("click", closePCDrawer);
if (pcDrawerBackdrop) pcDrawerBackdrop.addEventListener("click", closePCDrawer);

if (pcUnmarkBtn) {
  pcUnmarkBtn.addEventListener("click", () => {
    if (!activeSelectedBoxPokemon) return;

    const id = activeSelectedBoxPokemon.id;
    const name = activeSelectedBoxPokemon.name;

    localStorage.setItem(`caught_${id}`, "false");
    showTeamToast(`Released ${name.toUpperCase()} from Caught list!`);

    closePCDrawer();
    renderPCStorageBox();
    reRenderGrid();
  });
}

if (pcOpenDetailsBtn) {
  pcOpenDetailsBtn.addEventListener("click", () => {
    if (!activeSelectedBoxPokemon) return;
    openPokemonModal(activeSelectedBoxPokemon.id);
  });
}

if (clearCaughtBtn) {
  clearCaughtBtn.addEventListener("click", () => {
    if (!confirm("Are you sure you want to clear your caught list?")) return;
    Object.keys(localStorage)
      .filter((k) => k.startsWith("caught_"))
      .forEach((k) => localStorage.removeItem(k));
    closePCDrawer();
    renderPCStorageBox();
    reRenderGrid();
  });
}

// --- Minigame Listeners ---
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
  nextPokemonBtn.addEventListener("click", () => {
    nextPokemonBtn.style.display = "none";
    startNewRound(gameImg, gameOptions, gameFeedback, streakCount, highscoreCount);
  });
}

// --- Scanner / Lens Listeners ---
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
        openPokemonModal(scannedPokemon.id);
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
        openPokemonModal(scannedPokemon.id);
      }, 1000);
    }
  });
}

// --- General Modal Closure Handlers ---
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

if (teamCloseBtn) teamCloseBtn.addEventListener("click", () => teamModal.classList.add("hidden"));
if (teamModal) teamModal.addEventListener("click", (e) => { if (e.target === teamModal) teamModal.classList.add("hidden"); });

if (gameCloseBtn) gameCloseBtn.addEventListener("click", () => gameModal.classList.add("hidden"));
if (gameModal) gameModal.addEventListener("click", (e) => { if (e.target === gameModal) gameModal.classList.add("hidden"); });

if (favoritesCloseBtn) favoritesCloseBtn.addEventListener("click", () => favoritesModal.classList.add("hidden"));
if (favoritesModal) {
  favoritesModal.addEventListener("click", (e) => {
    if (e.target === favoritesModal) favoritesModal.classList.add("hidden");
  });
}

if (caughtCloseBtn) {
  caughtCloseBtn.addEventListener("click", () => {
    closePCDrawer();
    caughtModal.classList.add("hidden");
  });
}
if (caughtModal) {
  caughtModal.addEventListener("click", (e) => {
    if (e.target === caughtModal) {
      closePCDrawer();
      caughtModal.classList.add("hidden");
    }
  });
}

if (scannerCloseBtn) scannerCloseBtn.addEventListener("click", closeScanner);
if (scannerModal) scannerModal.addEventListener("click", (e) => { if (e.target === scannerModal) closeScanner(); });