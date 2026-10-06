// ==========================================
// POKÉAPI SERVICE
// Handles fetching and transforming Pokémon data
// ==========================================

const BASE_URL = "https://pokeapi.co/api/v2/pokemon";
const SPECIES_URL = "https://pokeapi.co/api/v2/pokemon-species";

// Generation boundaries in PokéAPI
export const GEN_RANGES = {
  all: { start: 1, end: 1025 }, // All Generations (#001–#1025)
  1: { start: 1, end: 151 },    // Gen 1: Kanto (151)
  2: { start: 152, end: 251 },  // Gen 2: Johto (100)
  3: { start: 252, end: 386 },  // Gen 3: Hoenn (135)
  4: { start: 387, end: 493 },  // Gen 4: Sinnoh (107)
  5: { start: 494, end: 649 },  // Gen 5: Unova (156)
  6: { start: 650, end: 721 },  // Gen 6: Kalos (72)
  7: { start: 722, end: 809 },  // Gen 7: Alola (88)
  8: { start: 810, end: 905 },  // Gen 8: Galar (96)
  9: { start: 906, end: 1025 }  // Gen 9: Paldea (120)
};

/**
 * Capitalizes hyphenated names and handles alternate form labels.
 * Example: "deoxys-attack" -> "Deoxys (Attack)"
 */
export function formatPokemonName(name, speciesName = "") {
  if (!name) return "";

  const capitalize = (str) =>
    str
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join("-");

  if (speciesName && name.toLowerCase().startsWith(speciesName.toLowerCase() + "-")) {
    const baseFormatted = capitalize(speciesName);
    const formSuffix = name.slice(speciesName.length + 1);
    return `${baseFormatted} (${capitalize(formSuffix)})`;
  }

  return capitalize(name);
}

/**
 * Standardizes raw API responses into a clean, predictable object for the UI.
 */
export function normalizePokemonData(rawData, speciesData = null) {
  const animatedImage =
    rawData.sprites?.other?.showdown?.front_default ||
    rawData.sprites?.versions?.["generation-v"]?.["black-white"]?.animated?.front_default;

  const officialArtwork =
    rawData.sprites?.other?.["official-artwork"]?.front_default ||
    rawData.sprites?.front_default;

  let description = "No Pokédex description available.";
  if (speciesData?.flavor_text_entries) {
    const englishEntry = speciesData.flavor_text_entries.find(
      (entry) => entry.language.name === "en"
    );
    if (englishEntry) {
      description = englishEntry.flavor_text
        .replace(/[\f\n\r]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }
  }

  const speciesName = speciesData?.name || rawData.species?.name || "";

  return {
    id: rawData.id,
    name: formatPokemonName(rawData.name, speciesName),
    animatedImage: animatedImage || officialArtwork,
    officialArtwork: officialArtwork,
    image: animatedImage || officialArtwork,
    types: rawData.types?.map((t) => t.type.name) || [],
    stats: {
      hp: rawData.stats?.find((s) => s.stat.name === "hp")?.base_stat || 0,
      attack: rawData.stats?.find((s) => s.stat.name === "attack")?.base_stat || 0,
      defense: rawData.stats?.find((s) => s.stat.name === "defense")?.base_stat || 0,
    },
    cry: rawData.cries?.latest || rawData.cries?.legacy || null,
    description: description,
  };
}

/**
 * Fetches a single Pokémon by ID or name.
 */
export async function fetchPokemon(nameOrId) {
  try {
    const cleanQuery = String(nameOrId).toLowerCase().trim().replace(/\s+/g, "-");

    const response = await fetch(`${BASE_URL}/${cleanQuery}`);
    if (!response.ok) {
      throw new Error(`Pokémon "${nameOrId}" not found.`);
    }

    const rawData = await response.json();

    let speciesData = null;
    try {
      const speciesRes = await fetch(`${SPECIES_URL}/${rawData.id}`);
      if (speciesRes.ok) {
        speciesData = await speciesRes.json();
      }
    } catch (e) {
      // Fallback: Default description will be used if species fetch is throttled
    }

    return normalizePokemonData(rawData, speciesData);
  } catch (error) {
    console.error("API Error:", error.message);
    throw error;
  }
}

/**
 * Searches for all regional/form varieties belonging to a species.
 */
export async function fetchPokemonForms(nameOrId) {
  try {
    const cleanQuery = String(nameOrId).toLowerCase().trim().replace(/\s+/g, "-");

    try {
      const speciesRes = await fetch(`${SPECIES_URL}/${cleanQuery}`);
      if (speciesRes.ok) {
        const speciesData = await speciesRes.json();

        if (speciesData.varieties?.length > 0) {
          const rawVarieties = await Promise.all(
            speciesData.varieties.map(async (v) => {
              const res = await fetch(v.pokemon.url);
              return res.ok ? res.json() : null;
            })
          );

          const validVarieties = rawVarieties.filter(Boolean);
          if (validVarieties.length > 0) {
            return validVarieties.map((rawData) =>
              normalizePokemonData(rawData, speciesData)
            );
          }
        }
      }
    } catch {}

    const single = await fetchPokemon(nameOrId);
    return [single];
  } catch (error) {
    console.error("API Error in fetchPokemonForms:", error.message);
    throw error;
  }
}

/**
 * Fetches Pokémon matching a specific element type (e.g. 'fire', 'water').
 */
export async function fetchPokemonByType(typeName, limit = 30) {
  if (typeName === "all") {
    const promises = Array.from({ length: limit }, (_, i) => fetchPokemon(i + 1));
    return Promise.all(promises);
  }

  const response = await fetch(`https://pokeapi.co/api/v2/type/${typeName.toLowerCase()}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${typeName} type Pokémon.`);
  }

  const data = await response.json();
  const entries = data.pokemon.slice(0, limit);

  return Promise.all(entries.map((entry) => fetchPokemon(entry.pokemon.name)));
}

/**
 * Fetches a slice/chunk of Pokémon by ID range (10 at a time).
 */
export async function fetchPokemonRange(startId, endId, limit = 10) {
  const actualEnd = Math.min(startId + limit - 1, endId);
  const promises = [];

  for (let id = startId; id <= actualEnd; id++) {
    promises.push(
      fetchPokemon(id).catch((err) => {
        console.warn(`Skipped Pokémon #${id}:`, err);
        return null;
      })
    );
  }

  const results = await Promise.all(promises);
  const validPokemon = results.filter(Boolean);

  return {
    pokemonList: validPokemon,
    nextStartId: actualEnd + 1,
    hasMore: actualEnd < endId
  };
}