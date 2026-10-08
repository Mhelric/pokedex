// ==========================================
// UI RENDERING MODULE
// Generates dynamic HTML components for cards, grids, modal, and team synergy
// ==========================================

import { getTypeMatchups } from "./api.js";

/**
 * Calculates cumulative team defensive coverage across all active squad members.
 */
function getTeamSynergy(teamList) {
  const weaknessCounts = {};
  const resistanceCounts = {};

  teamList.forEach((pokemon) => {
    const { weaknesses, resistances } = getTypeMatchups(pokemon.types);

    weaknesses.forEach((w) => {
      weaknessCounts[w.type] = (weaknessCounts[w.type] || 0) + 1;
    });

    resistances.forEach((r) => {
      resistanceCounts[r.type] = (resistanceCounts[r.type] || 0) + 1;
    });
  });

  return { weaknessCounts, resistanceCounts };
}

/**
 * Builds HTML string for a main Pokédex card (with species genus, no standalone cry button).
 */
export function createPokemonCard(pokemon, useAnimated = true) {
  const formattedId = `#${String(pokemon.id).padStart(3, "0")}`;
  const typeBadges = pokemon.types
    .map((type) => `<span class="type-badge type-${type}">${type}</span>`)
    .join("");

  const displayImage = useAnimated
    ? pokemon.animatedImage || pokemon.officialArtwork
    : pokemon.officialArtwork;

  return `
    <article class="pokemon-card" data-id="${pokemon.id}">
      <span class="card-id">${formattedId}</span>
      <img src="${displayImage}" alt="${pokemon.name}" class="card-image" loading="lazy" />
      <h3 class="pokemon-name">${pokemon.name}</h3>
      <p class="pokemon-genus">${pokemon.genus}</p>
      
      <div class="card-types">
        ${typeBadges}
      </div>

      <div class="card-stats">
        <p>HP: ${pokemon.stats.hp}</p>
        <p>ATK: ${pokemon.stats.attack}</p>
        <p>DEF: ${pokemon.stats.defense}</p>
      </div>

      <p class="pokemon-description">"${pokemon.description}"</p>

      <div class="card-actions">
        <button class="add-team-btn" data-id="${pokemon.id}">+ Add to Team</button>
      </div>
    </article>
  `;
}

/**
 * Renders an array of Pokémon into the grid container.
 */
export function renderPokemonGrid(pokemonList, containerElement, useAnimated = true, append = false) {
  if (!append) {
    containerElement.innerHTML = "";
  }

  if (!pokemonList || pokemonList.length === 0) {
    if (!append) {
      containerElement.innerHTML = `<p class="status-message">No Pokémon found.</p>`;
    }
    return;
  }

  const cardsHtml = pokemonList
    .map((pokemon) => createPokemonCard(pokemon, useAnimated))
    .join("");

  if (append) {
    const scrollLoader = document.getElementById("scroll-loader");
    if (scrollLoader) scrollLoader.remove();
    containerElement.insertAdjacentHTML("beforeend", cardsHtml);
  } else {
    containerElement.innerHTML = cardsHtml;
  }
}

/**
 * Builds full detail modal dialog:
 * Mobile: Stacked view with clean matchup pills.
 * Desktop: Side-by-side layout with speaker cry button and single top-right Pokédex accent.
 */
export function renderPokemonModal(pokemon, containerElement) {
  const formattedId = `#${String(pokemon.id).padStart(3, "0")}`;
  const typeBadges = pokemon.types
    .map((type) => `<span class="type-badge type-${type}">${type}</span>`)
    .join("");

  // Calculate Type Matchups
  const { weaknesses, resistances } = getTypeMatchups(pokemon.types);

  const formatMultiplier = (m) => {
    if (m === 4) return "4×";
    if (m === 2) return "2×";
    if (m === 0.5) return "½×";
    if (m === 0.25) return "¼×";
    if (m === 0) return "0×";
    return `${m}×`;
  };

  const formatDetailPill = (item, isWeak) => `
    <div class="matchup-pill ${isWeak ? 'weak' : 'resist'}">
      <span class="type-dot type-${item.type}"></span>
      <span class="pill-name">${item.type}</span>
      <span class="pill-multiplier">${formatMultiplier(item.multiplier)}</span>
    </div>
  `;

  const weaknessBadgesHtml = weaknesses.length > 0
    ? weaknesses.map((w) => formatDetailPill(w, true)).join("")
    : `<span class="none-text">None</span>`;

  const resistanceBadgesHtml = resistances.length > 0
    ? resistances.map((r) => formatDetailPill(r, false)).join("")
    : `<span class="none-text">None</span>`;

  containerElement.innerHTML = `
    <!-- Single Red Top-Right Accent (Bottom-left removed to avoid covering content) -->
    <div class="modal-corner-decor top-right"></div>

    <!-- Top Section: Stacked on Mobile, Side-by-Side on Desktop -->
    <div class="modal-top-layout">
      <div class="modal-image-container">
        <img src="${pokemon.officialArtwork || pokemon.image}" alt="${pokemon.name}" class="modal-image" />
      </div>

      <div class="modal-header-info">
        <span class="modal-card-id">${formattedId}</span>
        <div class="modal-title-row">
          <h2 class="modal-title">${pokemon.name}</h2>
          ${pokemon.cry ? `<button class="modal-cry-btn" id="modal-play-cry" title="Play Cry" type="button">🔊</button>` : ''}
        </div>
        <p class="pokemon-genus">${pokemon.genus}</p>
        <div class="card-types">${typeBadges}</div>
      </div>
    </div>

    <!-- Bottom Section: Description, Measurements, Matchups & Stats -->
    <div class="modal-bottom-details">
      <p class="pokemon-description">"${pokemon.description}"</p>

      <!-- Interactive Voice Wave Indicator -->
      <div id="modal-voice-indicator" class="pokedex-voice-bar" title="Click to Stop / Replay Pokédex Voice">
        <div class="voice-wave">
          <span></span><span></span><span></span><span></span>
        </div>
        <span class="voice-label" id="modal-voice-status">Pokédex Voice</span>
      </div>
      
      <div class="modal-measurements">
        <span>Height: <strong>${pokemon.height}</strong></span> | 
        <span>Weight: <strong>${pokemon.weight}</strong></span>
      </div>

      <!-- Type Weaknesses & Resistances Section -->
      <div class="modal-matchups">
        <div class="matchup-group">
          <h4>Weaknesses</h4>
          <div class="matchup-badges">${weaknessBadgesHtml}</div>
        </div>
        <div class="matchup-group">
          <h4>Resistances & Immunities</h4>
          <div class="matchup-badges">${resistanceBadgesHtml}</div>
        </div>
      </div>

      <!-- Base Stats -->
      <div class="full-stats">
        <h4>Base Stats</h4>
        <div class="stat-bar-group"><label>HP (${pokemon.stats.hp})</label><progress value="${pokemon.stats.hp}" max="255"></progress></div>
        <div class="stat-bar-group"><label>Attack (${pokemon.stats.attack})</label><progress value="${pokemon.stats.attack}" max="255"></progress></div>
        <div class="stat-bar-group"><label>Defense (${pokemon.stats.defense})</label><progress value="${pokemon.stats.defense}" max="255"></progress></div>
        <div class="stat-bar-group"><label>Sp. Atk (${pokemon.stats.spAtk})</label><progress value="${pokemon.stats.spAtk}" max="255"></progress></div>
        <div class="stat-bar-group"><label>Sp. Def (${pokemon.stats.spDef})</label><progress value="${pokemon.stats.spDef}" max="255"></progress></div>
        <div class="stat-bar-group"><label>Speed (${pokemon.stats.speed})</label><progress value="${pokemon.stats.speed}" max="255"></progress></div>
      </div>
    </div>
  `;

  // Attach audio playback listener to speaker button
  const cryBtn = containerElement.querySelector("#modal-play-cry");
  if (cryBtn && pokemon.cry) {
    cryBtn.addEventListener("click", () => {
      const audio = new Audio(pokemon.cry);
      audio.volume = 0.6;
      audio.play().catch((err) => console.error("Audio playback error:", err));
    });
  }
}

/**
 * Renders the 6-slot team drawer items along with a modern, compact synergy breakdown.
 */
export function renderTeamGrid(teamList, containerElement, countElement) {
  if (countElement) {
    countElement.textContent = teamList.length;
  }

  if (teamList.length === 0) {
    containerElement.innerHTML = `
      <div class="team-empty-state">
        <p class="empty-icon">⚪</p>
        <p class="empty-title">Your team is empty</p>
        <p class="empty-subtitle">Tap <strong>+ Add to Team</strong> on any Pokémon card to build your roster.</p>
      </div>
    `;
    return;
  }

  const { weaknessCounts, resistanceCounts } = getTeamSynergy(teamList);

  // Group weaknesses (>= 2 members) and resistances (>= 2 members)
  const sharedWeaknesses = Object.entries(weaknessCounts)
    .filter(([_, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1]);

  const topResistances = Object.entries(resistanceCounts)
    .filter(([_, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1]);

  const formatPill = (type, count, isWeak) => `
    <div class="synergy-pill ${isWeak ? 'weakness-pill' : 'resistance-pill'}">
      <span class="type-dot type-${type}"></span>
      <span class="pill-name">${type}</span>
      <span class="pill-count">${count}×</span>
    </div>
  `;

  const weaknessBadges = sharedWeaknesses.length > 0
    ? sharedWeaknesses.map(([type, count]) => formatPill(type, count, true)).join("")
    : `<p class="synergy-empty-note">No shared team weaknesses ✨</p>`;

  const resistanceBadges = topResistances.length > 0
    ? topResistances.map(([type, count]) => formatPill(type, count, false)).join("")
    : `<p class="synergy-empty-note">No shared team resistances</p>`;

  const teamCardsHtml = teamList
    .map(
      (pokemon) => `
      <div class="team-card">
        <button class="remove-btn" data-id="${pokemon.id}" title="Remove ${pokemon.name}" aria-label="Remove">&times;</button>
        <div class="team-card-avatar">
          <img src="${pokemon.officialArtwork || pokemon.image}" alt="${pokemon.name}" class="team-card-image" />
        </div>
        <span class="team-card-name">${pokemon.name}</span>
      </div>
    `
    )
    .join("");

  containerElement.innerHTML = `
    <!-- Top Pokemon Roster -->
    <div class="team-cards-wrapper">
      ${teamCardsHtml}
    </div>

    <!-- Modern Synergy Overview -->
    <section class="team-synergy-container">
      <div class="synergy-header">
        <h3 class="synergy-title">Defensive Synergy</h3>
        <span class="synergy-subtitle">Analysis across 2+ squad members</span>
      </div>

      <div class="synergy-columns">
        <div class="synergy-card">
          <div class="synergy-card-header">
            <span class="status-indicator alert"></span>
            <h4>Shared Weaknesses</h4>
          </div>
          <div class="synergy-pills-wrap">
            ${weaknessBadges}
          </div>
        </div>

        <div class="synergy-card">
          <div class="synergy-card-header">
            <span class="status-indicator safe"></span>
            <h4>Key Resistances</h4>
          </div>
          <div class="synergy-pills-wrap">
            ${resistanceBadges}
          </div>
        </div>
      </div>
    </section>
  `;
}

/**
 * Displays error state messages inside a container.
 */
export function renderError(message, containerElement) {
  containerElement.innerHTML = `<p class="error-message">❌ ${message}</p>`;
}