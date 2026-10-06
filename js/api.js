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

// ==========================================
// TYPE EFFECTIVENESS CHART
// Attacking Type -> Defending Type Multiplier Matrix
// ==========================================
const TYPE_CHART = {
  normal: { rock: 0.5, ghost: 0, steel: 0.5 },
  fire: { fire: 0.5, water: 0.5, grass: 2, ice: 2, bug: 2, rock: 0.5, dragon: 0.5, steel: 2 },
  water: { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
  grass: { fire: 0.5, water: 2, grass: 0.5, poison: 0.5, ground: 2, flying: 0.5, bug: 0.5, rock: 2, dragon: 0.5, steel: 0.5 },
  electric: { water: 2, grass: 0.5, electric: 0.5, ground: 0, flying: 2, dragon: 0.5 },
  ice: { fire: 0.5, water: 0.5, grass: 2, ice: 0.5, ground: 2, flying: 2, dragon: 2, steel: 0.5 },
  fighting: { normal: 2, ice: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, rock: 2, ghost: 0, dark: 2, steel: 2, fairy: 0.5 },
  poison: { grass: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0, fairy: 2 },
  ground: { fire: 2, grass: 0.5, electric: 2, poison: 2, flying: 0, bug: 0.5, rock: 2, steel: 2 },
  flying: { grass: 2, electric: 0.5, fighting: 2, bug: 2, rock: 0.5, steel: 0.5 },
  psychic: { fighting: 2, poison: 2, psychic: 0.5, dark: 0, steel: 0.5 },
  bug: { fire: 0.5, grass: 2, fighting: 0.5, poison: 0.5, flying: 0.5, psychic: 2, ghost: 0.5, dark: 2, steel: 0.5, fairy: 0.5 },
  rock: { fire: 2, ice: 2, fighting: 0.5, ground: 0.5, flying: 2, bug: 2, steel: 0.5 },
  ghost: { normal: 0, psychic: 2, ghost: 2, dark: 0.5 },
  dragon: { dragon: 2, steel: 0.5, fairy: 0 },
  steel: { fire: 0.5, water: 0.5, electric: 0.5, ice: 2, rock: 2, steel: 0.5, fairy: 2 },
  fairy: { fire: 0.5, fighting: 2, poison: 0.5, dragon: 2, dark: 2, steel: 0.5 },
  dark: { fighting: 0.5, psychic: 2, ghost: 2, dark: 0.5, fairy: 0.5 }
};

/**
 * Calculates weaknesses and resistances for a given set of Pokémon types.
 */
export function getTypeMatchups(pokemonTypes) {
  const ALL_TYPES = Object.keys(TYPE_CHART);
  const weaknesses = [];
  const resistances = [];

  ALL_TYPES.forEach((attacker) => {
    let multiplier = 1;
    pokemonTypes.forEach((defType) => {
      const lowerDef = defType.toLowerCase();
      if (TYPE_CHART[attacker] && TYPE_CHART[attacker][lowerDef] !== undefined) {
        multiplier *= TYPE_CHART[attacker][lowerDef];
      }
    });

    if (multiplier > 1) {
      weaknesses.push({ type: attacker, multiplier });
    } else if (multiplier < 1) {
      resistances.push({ type: attacker, multiplier });
    }
  });

  return { weaknesses, resistances };
}

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
  let genus = "";

  if (speciesData) {
    if (speciesData.flavor_text_entries) {
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

    if (speciesData.genera) {
      const englishGenus = speciesData.genera.find(
        (g) => g.language.name === "en"
      );
      if (englishGenus) {
        genus = englishGenus.genus; // e.g., "Mouse Pokémon"
      }
    }
  }

  const speciesName = speciesData?.name || rawData.species?.name || "";

  return {
    id: rawData.id,
    name: formatPokemonName(rawData.name, speciesName),
    genus: genus || "Pokémon",
    height: rawData.height ? (rawData.height / 10).toFixed(1) + " m" : "N/A",
    weight: rawData.weight ? (rawData.weight / 10).toFixed(1) + " kg" : "N/A",
    animatedImage: animatedImage || officialArtwork,
    officialArtwork: officialArtwork,
    image: animatedImage || officialArtwork,
    types: rawData.types?.map((t) => t.type.name) || [],
    stats: {
      hp: rawData.stats?.find((s) => s.stat.name === "hp")?.base_stat || 0,
      attack: rawData.stats?.find((s) => s.stat.name === "attack")?.base_stat || 0,
      defense: rawData.stats?.find((s) => s.stat.name === "defense")?.base_stat || 0,
      spAtk: rawData.stats?.find((s) => s.stat.name === "special-attack")?.base_stat || 0,
      spDef: rawData.stats?.find((s) => s.stat.name === "special-defense")?.base_stat || 0,
      speed: rawData.stats?.find((s) => s.stat.name === "speed")?.base_stat || 0,
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
 * Fetches all Pokémon entries belonging to a specific type from PokéAPI.
 * Returns an array of objects with Pokémon names and numeric IDs.
 */
export async function getPokemonListByType(typeName) {
  const response = await fetch(`https://pokeapi.co/api/v2/type/${typeName.toLowerCase()}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${typeName} type Pokémon.`);
  }

  const data = await response.json();
  return data.pokemon.map((entry) => {
    const urlParts = entry.pokemon.url.split("/").filter(Boolean);
    const id = parseInt(urlParts[urlParts.length - 1], 10);
    return { name: entry.pokemon.name, id };
  });
}

/**
 * Fetches a slice/chunk of Pokémon from an array of items (10 at a time).
 */
export async function fetchPokemonBatch(items, startIndex, batchSize = 10) {
  const slice = items.slice(startIndex, startIndex + batchSize);
  const promises = slice.map((item) => {
    const identifier = typeof item === "object" ? item.name : item;
    return fetchPokemon(identifier).catch((err) => {
      console.warn(`Skipped Pokémon ${identifier}:`, err);
      return null;
    });
  });

  const results = await Promise.all(promises);
  const validPokemon = results.filter(Boolean);

  const nextIndex = startIndex + batchSize;
  return {
    pokemonList: validPokemon,
    nextIndex: nextIndex,
    hasMore: nextIndex < items.length
  };
}
