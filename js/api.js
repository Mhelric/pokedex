// ==========================================
// POKÉAPI SERVICE
// Handles fetching and transforming Pokémon data
// ==========================================

const BASE_URL = "https://pokeapi.co/api/v2/pokemon";
const SPECIES_URL = "https://pokeapi.co/api/v2/pokemon-species";

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

  // Check if this is an alternate form of a base species
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
  // Animated sprite preference (fallback to official artwork or static sprite)
  const animatedImage =
    rawData.sprites?.other?.showdown?.front_default ||
    rawData.sprites?.versions?.["generation-v"]?.["black-white"]?.animated?.front_default;

  const officialArtwork =
    rawData.sprites?.other?.["official-artwork"]?.front_default ||
    rawData.sprites?.front_default;

  // Extract English Pokédex description
  let description = "No Pokédex description available.";
  if (speciesData?.flavor_text_entries) {
    const englishEntry = speciesData.flavor_text_entries.find(
      (entry) => entry.language.name === "en"
    );
    if (englishEntry) {
      // Remove page breaks and irregular whitespace
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
    let response = await fetch(`${BASE_URL}/${cleanQuery}`);

    // If direct lookup fails, try matching by species name
    if (!response.ok) {
      const speciesRes = await fetch(`${SPECIES_URL}/${cleanQuery}`);
      if (speciesRes.ok) {
        const speciesData = await speciesRes.json();
        const defaultVariety =
          speciesData.varieties?.find((v) => v.is_default)?.pokemon?.name ||
          speciesData.varieties?.[0]?.pokemon?.name;

        if (defaultVariety) {
          response = await fetch(`${BASE_URL}/${defaultVariety}`);
        }
      }
    }

    if (!response.ok) {
      throw new Error(`Pokémon "${nameOrId}" not found.`);
    }

    const rawData = await response.json();
    let speciesData = null;

    // Fetch species data for Pokédex flavor text
    try {
      const speciesIdentifier = rawData.species?.name || rawData.id;
      const speciesRes = await fetch(`${SPECIES_URL}/${speciesIdentifier}`);
      if (speciesRes.ok) {
        speciesData = await speciesRes.json();
      }
    } catch {
      // Non-fatal if species text fails
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

        // If the species has multiple form entries, load them in parallel
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
    } catch {
      // Non-fatal, fallback to single lookup
    }

    // Default fallback to single entity fetch
    const single = await fetchPokemon(nameOrId);
    return [single];
  } catch (error) {
    console.error("API Error in fetchPokemonForms:", error.message);
    throw error;
  }
}