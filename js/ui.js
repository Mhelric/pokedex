// ==========================================
// UI RENDERING MODULE
// Generates dynamic HTML components for cards, grids, modal, and team synergy
// ==========================================

import { getTypeMatchups, formatPokemonName } from "./api.js";

export const GAME_VERSIONS = [
  { value: "scarlet-violet", label: "Scarlet / Violet (Gen 9)", keyMatch: ["scarlet", "violet"] },
  { value: "sword-shield", label: "Sword / Shield (Gen 8)", keyMatch: ["sword", "shield"] },
  { value: "sun-moon", label: "Sun / Moon (Gen 7)", keyMatch: ["sun", "moon", "ultra-sun", "ultra-moon"] },
  { value: "x-y", label: "X / Y (Gen 6)", keyMatch: ["x", "y", "omega-ruby", "alpha-sapphire"] },
  { value: "black-white", label: "Black / White (Gen 5)", keyMatch: ["black", "white", "black-2", "white-2"] },
  { value: "diamond-pearl", label: "Diamond / Pearl (Gen 4)", keyMatch: ["diamond", "pearl", "platinum", "heartgold", "soulsilver"] },
  { value: "ruby-sapphire", label: "Ruby / Sapphire (Gen 3)", keyMatch: ["ruby", "sapphire", "emerald", "firered", "leafgreen"] },
  { value: "gold-silver", label: "Gold / Silver / Crystal (Gen 2)", keyMatch: ["gold", "silver", "crystal"] },
  { value: "red-blue", label: "Red / Blue / Yellow (Gen 1)", keyMatch: ["red", "blue", "yellow"] },
];

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
 * Builds standard centered evolution branches or delegates to Eevee's custom layout.
 */
function buildEvolutionTreeHtml(evoNode, currentRawName) {
  if (!evoNode) return `<p class="empty-note">No evolution data available.</p>`;

  // Check if root is Eevee with its 8 branched evolutions
  if (evoNode.speciesName.toLowerCase() === "eevee" && evoNode.evolvesTo && evoNode.evolvesTo.length >= 8) {
    return buildEeveeCircularEvolutionHtml(evoNode, currentRawName);
  }

  const isCurrent = evoNode.speciesName.toLowerCase() === currentRawName.toLowerCase();
  const speciesId = evoNode.speciesUrl.split("/").filter(Boolean).pop();
  const artworkUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${speciesId}.png`;

  const nodeCard = `
    <div class="evo-node ${isCurrent ? 'active' : ''}" data-species="${evoNode.speciesName}">
      <div class="evo-avatar-wrap">
        <img 
          src="${artworkUrl}" 
          alt="${evoNode.speciesName}" 
          class="evo-img" 
          loading="lazy" 
          onerror="this.src='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${speciesId}.png'"
        />
      </div>
      <span class="evo-name">${formatPokemonName(evoNode.speciesName)}</span>
    </div>
  `;

  if (evoNode.evolvesTo && evoNode.evolvesTo.length > 0) {
    const branches = evoNode.evolvesTo
      .map((child) => {
        const triggerDesc = child.evolutionRequirement || "Level up";
        return `
          <div class="evo-branch-item">
            <div class="evo-connector">
              <span class="evo-trigger-badge">${triggerDesc}</span>
              <span class="evo-arrow">➜</span>
            </div>
            ${buildEvolutionTreeHtml(child, currentRawName)}
          </div>
        `;
      })
      .join("");

    return `
      <div class="evo-group">
        ${nodeCard}
        <div class="evo-branches-wrap">
          ${branches}
        </div>
      </div>
    `;
  }

  return `<div class="evo-group final">${nodeCard}</div>`;
}

/**
 * Renders Eevee and its 8 evolutions cleanly in a responsive structured layout.
 */
function buildEeveeCircularEvolutionHtml(eeveeNode, currentRawName) {
  const isEeveeActive = currentRawName.toLowerCase() === "eevee";
  const eeveeId = eeveeNode.speciesUrl.split("/").filter(Boolean).pop();

  const childrenHtml = eeveeNode.evolvesTo.map((child) => {
    const childId = child.speciesUrl.split("/").filter(Boolean).pop();
    const isCurrent = child.speciesName.toLowerCase() === currentRawName.toLowerCase();
    const triggerDesc = child.evolutionRequirement || "Special";

    return `
      <div class="evo-branch-card evo-node ${isCurrent ? 'active' : ''}" data-species="${child.speciesName}">
        <div class="evo-avatar-wrap">
          <img 
            src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${childId}.png" 
            alt="${child.speciesName}" 
            class="evo-img" 
            loading="lazy" 
            onerror="this.src='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${childId}.png'"
          />
        </div>
        <span class="evo-name">${formatPokemonName(child.speciesName)}</span>
        <span class="evo-trigger-badge">${triggerDesc}</span>
      </div>
    `;
  }).join("");

  return `
    <div class="eevee-grid-wrapper">
      <div class="eevee-root-container">
        <div class="evo-node ${isEeveeActive ? 'active' : ''}" data-species="eevee">
          <div class="evo-avatar-wrap">
            <img 
              src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${eeveeId}.png" 
              alt="Eevee" 
              class="evo-img" 
            />
          </div>
          <span class="evo-name">Eevee</span>
        </div>
      </div>
      <div class="eevee-branches-grid">
        ${childrenHtml}
      </div>
    </div>
  `;
}

export function getFilteredMoves(pokemon, selectedVersion, methodCategory) {
  if (!pokemon.moves || pokemon.moves.length === 0) return [];

  const matchedGameObj = GAME_VERSIONS.find((g) => g.value === selectedVersion);
  const matchedKeys = matchedGameObj ? matchedGameObj.keyMatch : [selectedVersion];

  return pokemon.moves
    .map((m) => {
      let detail = m.versions.find((v) =>
        matchedKeys.some((k) => v.versionGroup.includes(k))
      );

      if (!detail && m.versions.length > 0) {
        detail = m.versions[m.versions.length - 1];
      }

      if (!detail) return null;

      let category = "level-up";
      if (detail.learnMethod === "machine") category = "machine";
      else if (detail.learnMethod === "egg") category = "egg";
      else if (detail.learnMethod === "tutor") category = "tutor";

      if (category !== methodCategory) return null;

      return {
        name: m.name,
        level: detail.levelLearned || "-",
        method: detail.learnMethod,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (typeof a.level === "number" && typeof b.level === "number") {
        return a.level - b.level;
      }
      return 0;
    });
}

export function getPokemonFlavorText(pokemon, selectedVersion) {
  if (!pokemon.flavorTextEntries || pokemon.flavorTextEntries.length === 0) {
    return pokemon.description || "No Pokédex description available.";
  }

  const matchedGame = GAME_VERSIONS.find((g) => g.value === selectedVersion);
  if (matchedGame) {
    const found = pokemon.flavorTextEntries.find((entry) =>
      matchedGame.keyMatch.some((k) => entry.version === k || entry.version.includes(k))
    );
    if (found) return found.flavorText;
  }

  return pokemon.flavorTextEntries[pokemon.flavorTextEntries.length - 1].flavorText;
}

export function renderPokemonModal(pokemon, containerElement, selectedGame = "scarlet-violet") {
  const formattedId = `#${String(pokemon.id).padStart(3, "0")}`;
  const typeBadges = pokemon.types
    .map((type) => `<span class="type-badge type-${type}">${type}</span>`)
    .join("");

  const currentFlavorText = getPokemonFlavorText(pokemon, selectedGame);

  const { weaknesses, resistances } = getTypeMatchups(pokemon.types);
  const formatMultiplier = (m) => (m === 4 ? "4×" : m === 2 ? "2×" : m === 0.5 ? "½×" : m === 0.25 ? "¼×" : m === 0 ? "0×" : `${m}×`);

  const weaknessBadgesHtml = weaknesses.length > 0
    ? weaknesses.map((w) => `
        <div class="matchup-pill weak">
          <span class="type-dot type-${w.type}"></span>
          <span class="pill-name">${w.type}</span>
          <span class="pill-multiplier">${formatMultiplier(w.multiplier)}</span>
        </div>
      `).join("")
    : `<span class="none-text">None</span>`;

  const resistanceBadgesHtml = resistances.length > 0
    ? resistances.map((r) => `
        <div class="matchup-pill resist">
          <span class="type-dot type-${r.type}"></span>
          <span class="pill-name">${r.type}</span>
          <span class="pill-multiplier">${formatMultiplier(r.multiplier)}</span>
        </div>
      `).join("")
    : `<span class="none-text">None</span>`;

  const abilitiesHtml = (pokemon.abilities || [])
    .map(
      (a) => `
      <div class="ability-card ${a.isHidden ? 'hidden-ability' : ''}">
        <div class="ability-title-row">
          <span class="ability-name">${a.name}</span>
          <span class="ability-badge">${a.isHidden ? 'Hidden' : 'Standard'}</span>
        </div>
      </div>
    `
    )
    .join("");

  const statRowsHtml = [
    { label: "HP", val: pokemon.stats.hp, bounds: pokemon.statBounds.hp },
    { label: "Attack", val: pokemon.stats.attack, bounds: pokemon.statBounds.attack },
    { label: "Defense", val: pokemon.stats.defense, bounds: pokemon.statBounds.defense },
    { label: "Sp. Atk", val: pokemon.stats.spAtk, bounds: pokemon.statBounds.spAtk },
    { label: "Sp. Def", val: pokemon.stats.spDef, bounds: pokemon.statBounds.spDef },
    { label: "Speed", val: pokemon.stats.speed, bounds: pokemon.statBounds.speed },
  ]
    .map((s) => {
      const pct = Math.min(100, Math.round((s.val / 255) * 100));
      return `
      <div class="stat-calc-row">
        <span class="stat-name">${s.label}</span>
        <strong class="stat-val">${s.val}</strong>
        <div class="stat-meter-track">
          <div class="stat-meter-bar" style="width: ${pct}%"></div>
        </div>
        <span class="stat-bound min">${s.bounds.min}</span>
        <span class="stat-bound max">${s.bounds.max}</span>
      </div>
    `;
    })
    .join("");

  const bst = Object.values(pokemon.stats).reduce((acc, c) => acc + c, 0);

  const varietiesHtml = (pokemon.varieties || [])
    .map(
      (v) => `
      <div class="variety-card-item ${v.rawName === pokemon.rawName ? 'active' : ''}" data-name="${v.rawName}">
        <div class="variety-thumb-wrap">
          <img src="${v.image}" alt="${v.name}" class="variety-thumb-img" loading="lazy" />
        </div>
        <span class="variety-card-label">${v.name}</span>
      </div>
    `
    )
    .join("");

  const evolutionChainHtml = pokemon.evolutionTree
    ? buildEvolutionTreeHtml(pokemon.evolutionTree, pokemon.speciesName)
    : `<p class="empty-note">This Pokémon does not evolve.</p>`;

  const levelUpMoves = getFilteredMoves(pokemon, selectedGame, "level-up");
  const moveRowsHtml = levelUpMoves.length > 0
    ? levelUpMoves.map((m) => `
        <tr class="move-row">
          <td class="move-level">${m.level === 0 ? "Evo" : m.level}</td>
          <td class="move-name">${m.name}</td>
          <td class="move-type"><span class="badge-subtle">Learned</span></td>
        </tr>
      `).join("")
    : `<tr><td colspan="3" class="empty-note">No level up moves recorded for this generation.</td></tr>`;

  let genderRatioHtml = `<span class="gender-genderless">Genderless</span>`;
  if (pokemon.genderRate !== -1) {
    const femalePct = (pokemon.genderRate / 8) * 100;
    const malePct = 100 - femalePct;
    genderRatioHtml = `
      <div class="gender-ratio-bar">
        <span class="male-text">♂ ${malePct}%</span>
        <div class="gender-track">
          <div class="gender-fill-male" style="width: ${malePct}%"></div>
          <div class="gender-fill-female" style="width: ${femalePct}%"></div>
        </div>
        <span class="female-text">♀ ${femalePct}%</span>
      </div>
    `;
  }

  const versionButtonsHtml = GAME_VERSIONS.map(
    (g) => `
      <button 
        type="button" 
        class="game-pill-btn ${g.value === selectedGame ? 'active' : ''}" 
        data-game="${g.value}">
        ${g.label}
      </button>
    `
  ).join("");

  containerElement.innerHTML = `
    <div class="modal-corner-decor top-right"></div>

    <!-- Centered Header Section -->
    <div class="modal-top-layout">
      <div class="modal-image-container">
        <img src="${pokemon.officialArtwork || pokemon.image}" alt="${pokemon.name}" class="modal-image" />
      </div>

      <div class="modal-header-info">
        <span class="modal-card-id">${formattedId}</span>
        <div class="modal-title-row">
          <h2 class="modal-title">${pokemon.name}</h2>
          ${pokemon.cry ? `<button class="modal-cry-btn" id="modal-play-cry" title="Play Cry" type="button">🔊</button>` : ""}
        </div>
        <p class="pokemon-genus">${pokemon.genus}</p>
        <div class="card-types">${typeBadges}</div>
      </div>
    </div>

    <div class="modal-bottom-details">
      <!-- Pokedex Description & Audio Wave -->
      <section class="detail-section entry-section">
        <p class="pokemon-description" id="modal-flavor-text">"${currentFlavorText}"</p>
        <div id="modal-voice-indicator" class="pokedex-voice-bar" title="Play / Stop Pokédex Voice">
          <div class="voice-wave"><span></span><span></span><span></span><span></span></div>
          <span class="voice-label" id="modal-voice-status">Pokédex Voice</span>
        </div>
      </section>

      <!-- Forms with Artwork -->
      ${pokemon.varieties && pokemon.varieties.length > 1 ? `
        <section class="detail-section forms-section">
          <h4 class="section-title">Forms & Gimmicks</h4>
          <div class="varieties-artwork-grid" id="modal-variety-chips">
            ${varietiesHtml}
          </div>
        </section>
      ` : ""}

      <!-- Abilities Section -->
      <section class="detail-section abilities-section">
        <h4 class="section-title">Abilities</h4>
        <div class="abilities-list">
          ${abilitiesHtml}
        </div>
      </section>

      <!-- Defensive Type Matchups -->
      <section class="detail-section matchups-section">
        <h4 class="section-title">Defensive Type Matchups</h4>
        <div class="modal-matchups">
          <div class="matchup-group">
            <span class="sub-label">Weaknesses</span>
            <div class="matchup-badges">${weaknessBadgesHtml}</div>
          </div>
          <div class="matchup-group">
            <span class="sub-label">Resistances & Immunities</span>
            <div class="matchup-badges">${resistanceBadgesHtml}</div>
          </div>
        </div>
      </section>

      <!-- Base & Min/Max Stats -->
      <section class="detail-section stats-section">
        <div class="section-title-row">
          <h4 class="section-title">Stats</h4>
          <span class="bst-tag">BST: <strong>${bst}</strong></span>
        </div>
        <div class="stat-calc-header">
          <span>Stat</span>
          <span>Base</span>
          <span class="meter-col"></span>
          <span class="bound-title">Min (Lv 100)</span>
          <span class="bound-title">Max (Lv 100)</span>
        </div>
        <div class="stats-calc-table">
          ${statRowsHtml}
        </div>
        <p class="stat-legend-note">Min: 0 IVs, 0 EVs, Hindering Nature | Max: 31 IVs, 252 EVs, Beneficial Nature</p>
      </section>

      <!-- Evolution Tree -->
      <section class="detail-section evolution-section">
        <h4 class="section-title">Evolution Chain</h4>
        <div class="evolution-tree-container" id="modal-evo-tree">
          ${evolutionChainHtml}
        </div>
      </section>

      <!-- Training & Breeding Double Column -->
      <div class="modal-two-columns">
        <section class="detail-section">
          <h4 class="section-title">Training</h4>
          <ul class="data-list">
            <li><span>EV Yield:</span> <strong>${pokemon.evYield}</strong></li>
            <li><span>Catch Rate:</span> <strong>${pokemon.catchRate}</strong></li>
            <li><span>Base Friendship:</span> <strong>${pokemon.baseFriendship}</strong></li>
            <li><span>Base Exp:</span> <strong>${pokemon.baseExp}</strong></li>
            <li><span>Growth Rate:</span> <strong>${pokemon.growthRate}</strong></li>
            <li>
              <span>Held Items:</span> 
              <strong>
                ${pokemon.heldItems.length > 0 ? pokemon.heldItems.map((h) => `${h.name} (${h.rarity}%)`).join(", ") : "None"}
              </strong>
            </li>
          </ul>
        </section>

        <section class="detail-section">
          <h4 class="section-title">Breeding</h4>
          <ul class="data-list">
            <li><span>Egg Groups:</span> <strong>${pokemon.eggGroups.join(", ")}</strong></li>
            <li><span>Hatch Steps:</span> <strong>${pokemon.hatchCounter}</strong></li>
            <li><span>Gender Ratio:</span> <div class="val-inline">${genderRatioHtml}</div></li>
          </ul>
        </section>
      </div>

      <!-- Moves & Movepool Section -->
      <section class="detail-section moves-section">
        <div class="movepool-header">
          <h4 class="section-title">Movepool</h4>
          <div class="movepool-tabs" id="movepool-category-tabs">
            <button class="tab-btn active" data-category="level-up" type="button">Level Up</button>
            <button class="tab-btn" data-category="machine" type="button">TM / HM</button>
            <button class="tab-btn" data-category="egg" type="button">Egg</button>
            <button class="tab-btn" data-category="tutor" type="button">Tutor</button>
          </div>
        </div>

        <div class="table-scroll-wrap">
          <table class="moves-table">
            <thead>
              <tr>
                <th style="width: 20%;">Lvl</th>
                <th style="width: 55%;">Move</th>
                <th style="width: 25%;">Method</th>
              </tr>
            </thead>
            <tbody id="modal-moves-body">
              ${moveRowsHtml}
            </tbody>
          </table>
        </div>
      </section>

      <!-- Polished Game / Generation Selector at Card Bottom -->
      <section class="detail-section game-selector-bottom-card">
        <div class="game-selector-header">
          <h4 class="section-title">Game / Generation Setting</h4>
          <span class="game-selector-hint">Updates entry text, abilities & generation movepools</span>
        </div>
        <div class="game-pills-container" id="modal-game-pills">
          ${versionButtonsHtml}
        </div>
      </section>
    </div>
  `;

  const cryBtn = containerElement.querySelector("#modal-play-cry");
  if (cryBtn && pokemon.cry) {
    cryBtn.addEventListener("click", () => {
      const audio = new Audio(pokemon.cry);
      audio.volume = 0.6;
      audio.play().catch((err) => console.error("Audio playback error:", err));
    });
  }
}

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
    <div class="team-cards-wrapper">
      ${teamCardsHtml}
    </div>

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

export function renderError(message, containerElement) {
  containerElement.innerHTML = `<p class="error-message">❌ ${message}</p>`;
}