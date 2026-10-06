// ==========================================
// UI RENDERING MODULE
// Generates dynamic HTML components for cards, grids, and modal
// ==========================================

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
 * Builds full detail modal dialog: Image, name, species & types on the top-left,
 * with description, height/weight, and base stats below all of it.
 */
export function renderPokemonModal(pokemon, containerElement) {
  const formattedId = `#${String(pokemon.id).padStart(3, "0")}`;
  const typeBadges = pokemon.types
    .map((type) => `<span class="type-badge type-${type}">${type}</span>`)
    .join("");

  containerElement.innerHTML = `
    <!-- Top Section: Image and Metadata on the Left -->
    <div class="modal-top-layout">
      <div class="modal-left-profile">
        <img src="${pokemon.officialArtwork || pokemon.image}" alt="${pokemon.name}" class="modal-image" />
        <span class="card-id">${formattedId}</span>
        <h2 class="modal-title">${pokemon.name}</h2>
        <p class="pokemon-genus">${pokemon.genus}</p>
        <div class="card-types">${typeBadges}</div>
      </div>
    </div>

    <!-- Bottom Section: Description, Measurements & Stats below all of it -->
    <div class="modal-bottom-details">
      <p class="pokemon-description">"${pokemon.description}"</p>
      
      <div class="modal-measurements">
        <span>Height: <strong>${pokemon.height}</strong></span> | 
        <span>Weight: <strong>${pokemon.weight}</strong></span>
      </div>

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
}

/**
 * Renders the 6-slot team drawer items.
 */
export function renderTeamGrid(teamList, containerElement, countElement) {
  if (countElement) {
    countElement.textContent = teamList.length;
  }

  if (teamList.length === 0) {
    containerElement.innerHTML = `
      <p class="team-empty-state">Your team is empty. Click "+ Add to Team" on any Pokémon card!</p>
    `;
    return;
  }

  containerElement.innerHTML = teamList
    .map(
      (pokemon) => `
      <div class="team-card">
        <button class="remove-btn" data-id="${pokemon.id}" title="Remove from team">&times;</button>
        <img src="${pokemon.image}" alt="${pokemon.name}" class="team-card-image" />
        <span class="team-card-name">${pokemon.name}</span>
      </div>
    `
    )
    .join("");
}

/**
 * Displays error state messages inside a container.
 */
export function renderError(message, containerElement) {
  containerElement.innerHTML = `<p class="error-message">❌ ${message}</p>`;
}
