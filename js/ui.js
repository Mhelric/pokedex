/** 
 * Generates an HTML card string for a single normalized Pokémon object. 
*/
export function createPokemonCard(pokemon) {
    const formattedId = `#${String(pokemon.id).padStart(3, '0')}`;

    const typeBadges = pokemon.types
        .map(type => `<span class="type-badge type-${type}">${type}</span>`).join(' ');

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