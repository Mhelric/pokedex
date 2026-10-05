const BASE_URL = "https://pokeapi.co/api/v2/pokemon";

// transforms the messy raw data fetched from POKEAPI into an object that has the properties that we need [id, name, type, img, height, weight & stats]
export function normalizePokemonData(rawData) {
  return {
    id: rawData.id,
    name: rawData.name,
    image:
      rawData.sprites?.other?.['official-artwork']?.front_default ||
      rawData.sprites?.front_default,
    types: rawData.types?.map((t) => t.type.name) || [],
    stats: {
      hp: rawData.stats?.find((s) => s.stat.name === 'hp')?.base_stat || 0,
      attack: rawData.stats?.find((s) => s.stat.name === 'attack')?.base_stat || 0,
      defense: rawData.stats?.find((s) => s.stat.name === 'defense')?.base_stat || 0,
    },
    // Extract audio cry URL (prefer latest, fallback to legacy)
    cry: rawData.cries?.latest || rawData.cries?.legacy || null,
  };
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
        console.error('API Error', error.message);
        throw error;
    }
}