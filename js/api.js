//API JS

const BASE_URL = "https://pokeapi.co/api/v2/pokemon";

// Transforms messy raw PokéAPI data into a clean object
export function normalizePokemonData(rawData, speciesData = null) {
  let description = "No Pokédex description available.";

  if (speciesData && speciesData.flavor_text_entries) {
    const englishEntry = speciesData.flavor_text_entries.find(
      (entry) => entry.language.name === "en"
    );

    if (englishEntry) {
      // Clean up special control characters (\f, \n, \r) returned by PokéAPI
      description = englishEntry.flavor_text
        .replace(/[\f\n\r]/g, " ")
        .replace(/\s+/g, " ");
    }
  }

  return {
    id: rawData.id,
    name: rawData.name,
    image:
      rawData.sprites?.other?.["official-artwork"]?.front_default ||
      rawData.sprites?.front_default,
    types: rawData.types.map((t) => t.type.name),
    stats: {
      hp: rawData.stats.find((s) => s.stat.name === "hp")?.base_stat || 0,
      attack: rawData.stats.find((s) => s.stat.name === "attack")?.base_stat || 0,
      defense: rawData.stats.find((s) => s.stat.name === "defense")?.base_stat || 0,
    },
    cry: rawData.cries?.latest || rawData.cries?.legacy || null,
    description: description,
  };
}

// Fetches main Pokémon data AND species flavor text
export async function fetchPokemon(nameOrId) {
  try {
    const pokemonNameOrId = String(nameOrId).toLowerCase().trim();

    // 1. Fetch main Pokémon data
    const response = await fetch(`${BASE_URL}/${pokemonNameOrId}`);
    if (!response.ok) {
      throw new Error(`Pokémon "${nameOrId}" not found.`);
    }
    const rawData = await response.json();

    // 2. Fetch species data for description/flavor text
    let speciesData = null;
    try {
      const speciesRes = await fetch(
        `https://pokeapi.co/api/v2/pokemon-species/${rawData.id}`
      );
      if (speciesRes.ok) {
        speciesData = await speciesRes.json();
      }
    } catch (speciesErr) {
      console.warn("Could not fetch species data:", speciesErr);
    }

    // 3. Return normalized data with speciesData attached
    return normalizePokemonData(rawData, speciesData);
  } catch (error) {
    console.error("API Error:", error.message);
    throw error;
  }
}