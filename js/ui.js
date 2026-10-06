// ==========================================
// DOM RENDERING TEMPLATES
// ==========================================

/**
 * Builds HTML string for a main Pokédex card.
 */
export function createPokemonCard(pokemon, useAnimated = true) {
  const formattedId = `#${String(pokemon.id).padStart(3, "0")}`;

  const typeBadges = pokemon.types
    .map((type) => `<span class="type-badge type-${type}">${type}</span>`)
    .join("");

  const cryButtonHtml = pokemon.cry
    ? `<button class="cry-btn" data-cry="${pokemon.cry}" title="Play Cry">🔊</button>`
    : "";

  const displayImage = useAnimated
    ? pokemon.animatedImage || pokemon.officialArtwork
    : pokemon.officialArtwork;

  return `
    <article class="pokemon-card" data-id="${pokemon.id}">
      <span class="card-id">${formattedId}</span>
      <img src="${displayImage}" alt="${pokemon.name}" class="card-image" loading="lazy" />
      <h3 class="pokemon-name">${pokemon.name}</h3>

      <div class="card-types">
        ${typeBadges}
      </div>

      <div class="card-stats">
        <p>HP: ${pokemon.stats.hp || "N/A"}</p>
        <p>ATK: ${pokemon.stats.attack || "N/A"}</p>
        <p>DEF: ${pokemon.stats.defense || "N/A"}</p>
      </div>

      <p class="pokemon-description">"${pokemon.description}"</p>

      <div class="card-actions">
        ${cryButtonHtml}
        <button class="add-team-btn" data-id="${pokemon.id}">+ Add to Team</button>
      </div>
    </article>
  `;
}

/**
 * Injects multiple Pokémon cards into a container.
 */
export function renderPokemonGrid(
  pokemonList,
  containerElement,
  useAnimated = true,
  append = false
) {
  const list = Array.isArray(pokemonList) ? pokemonList : [pokemonList];
  const html = list.map((p) => createPokemonCard(p, useAnimated)).join("");

  if (append) {
    // Remove any loading indicator at the bottom before appending new cards
    const scrollLoader = containerElement.querySelector("#scroll-loader");
    if (scrollLoader) scrollLoader.remove();

    // STACK new cards onto existing grid
    containerElement.insertAdjacentHTML("beforeend", html);
  } else {
    // Replace whole grid (for initial gen pick, search, or type filter)
    containerElement.innerHTML = html;
  }
}


/**
 * Builds HTML markup for a compact team roster card.
 */
export function createTeamCard(pokemon) {
  return `
    <div class="team-card" data-id="${pokemon.id}">
      <img src="${pokemon.image}" alt="${pokemon.name}" class="team-card-image" />
      <span class="team-card-name">${pokemon.name}</span>
      <button class="remove-btn" data-id="${pokemon.id}" title="Remove">&times;</button>
    </div>
  `;
}

/**
 * Updates the team roster UI container and member count.
 */
export function renderTeamGrid(team, gridElement, countElement) {
  if (countElement) {
    countElement.textContent = team.length;
  }

  if (team.length === 0) {
    gridElement.innerHTML = `
      <div class="team-empty-state">
        <p>No Pokémon in your team yet. Search and click "+ Add to Team"!</p>
      </div>
    `;
    return;
  }

  gridElement.innerHTML = team.map((pokemon) => createTeamCard(pokemon)).join("");
}

/**
 * Renders an inline error notice.
 */
export function renderError(message, containerElement) {
  containerElement.innerHTML = `
    <div class="error-card">
      <p class="error-message">⚠️ ${message}</p>
    </div>
  `;
}