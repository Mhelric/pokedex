const BASE_URL = "https://pokeapi.co/api/v2/pokemon";

// transforms the messy raw data fetched from POKEAPI into an object that has the properties that we need [id, name, type, img, height, weight & stats]
export function normalizePokemonData(rawData) {
    return {
        id: rawData.id,
        name: rawData.name,
        types: rawData.types.map(t => t.type.name),
        image: rawData.sprites.other['official-artwork'].front_default
        || rawData.sprites.front_default,
        height: rawData.height,
        weight: rawData.weight,
        stats: rawData.stats.reduce((acc, stat) => {
            acc[stat.stat.name] = stat.base_stat;
            return acc;
        }, {})
    }
}

//fetch function to get a Pokemon via its name or ID
export async function fetchPokemon(nameOrId) {
    try {
        const pokemonNameOrId = String(nameOrId).toLowerCase().trim();

        const response = await fetch(`${BASE_URL}/${pokemonNameOrId}`);

        if(!response.ok) {
            throw new Error(`Pokemon "${nameOrId}" not found.`);
        }

        const rawData = await response.json();

        return normalizePokemonData(rawData);


    } catch(error) {
        console.error('API ErrorL', error.message);
        throw error;
    }
}