/** 
 * Generates an HTML card string for a single normalized Pokémon object. 
*/
export function createPokemonCard(pokemon) {
    const formattedId = `#${String(pokemon.id).padStart(3, '0')}`;

    const typeBadges = pokemon.types
        .map(type => `<span class="type-badge type-${type}">${type}</span>`).join('');

    return `
        <article class="pokemon-card" data-id="${pokemon.id}>
            <span class="card-id">${formattedId}</span>
            <img src="${pokemon.image}" alt="${pokemon.name}" class="card-image" loading="lazy">
            <h3>${pokemon.name}</h3>
            <div class="card-types"> 
                ${typeBadges} 
            </div>
            <div> 
                <p>HP: ${pokemon.stats.hp || 'N/A'}</p> 
                <p>ATK: ${pokemon.stats.attack || 'N/A'}</p> 
                <p>DEF: ${pokemon.stats.defense || 'N/A'}</p>
            </div>
            <button class="add-team-btn" data-id="${pokemon.id}">+ Add to Team</button>
        </article>
    `;
}

/**
 * Renders one or multiple Pokemon cards into a DOM container.
 */
export function renderPokemonGrid(pokemonList, containerElement) {
    const list = Array.isArray(pokemonList) ? pokemonList : [pokemonList];
    containerElement.innerHTML = '';

    const cardsHTML = list
        .map(pokemon => createPokemonCard(pokemon))
        .join('');

    containerElement.innerHTML = cardsHTML;
}

/**
 * Displays an error message inside the target container.
 */
export function renderError(message, containerElement) {
    containerElement.innerHTML = `
        <div class="error-card">
            <p class="error-message"> ⚠️ ${message}</p>
        </div>
    `;
}

/**
 * Generates HTML for a compact Team Member card.
 * @param {Object} pokemon - Normalized Pokemon object
 * @returns {string} HTML markup string
 */
export function createTeamCard(pokemon) {
    return `
        <div class="team-card" data-id="${pokemon.name}" class="team-card-image">
            <img src="${pokemon.image}" alt="${pokemon.name}" class="team-card-image">
            <span class="team-card-name">${pokemon.name}</span>
            <button class="remove-btn" data-id="${pokemon.id}">&times;</button>
        </div>
    `;
}

/** 
 * Renders the team cards and updates team count.
 * @param {Array} team - Array of team Pokémon objects
 * @param {HTMLElement} gridElement - Container element for team (#team-grid)
 * @param {HTMLElement} countElement - Span element for count (#team-count) 
 */
export function renderTeamGrid(team, gridElement, countElement) {
    // 1. Update counter text (e.g., "3")
    if (countElement) {
        countElement.textContent = team.length;
    }

    // 2. If team is empty, display empty slot prompt
    if (team.length === 0) {
        gridElement.innerHTML = `
            <div class="team-empty-state">
                <p>No Pokemon in your team yet. Search and click "+ Add to Team"!</p>
            </div>
        `;
        return;
    }

    // 3. Render team cards
    gridElement.innerHTML = team.map(pokemon => createTeamCard(pokemon)).join('');
}
