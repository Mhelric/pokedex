// ==========================================
// POKÉAPI SERVICE
// Handles fetching, transforming & registry index
// ==========================================

const BASE_URL = "https://pokeapi.co/api/v2/pokemon";
const SPECIES_URL = "https://pokeapi.co/api/v2/pokemon-species";

export const GEN_RANGES = {
  all: { start: 1, end: 1025 },
  1: { start: 1, end: 151 },
  2: { start: 152, end: 251 },
  3: { start: 252, end: 386 },
  4: { start: 387, end: 493 },
  5: { start: 494, end: 649 },
  6: { start: 650, end: 721 },
  7: { start: 722, end: 809 },
  8: { start: 810, end: 905 },
  9: { start: 906, end: 1025 },
};

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

export function formatPokemonName(name, speciesName = "") {
  if (!name) return "";

  const capitalize = (str) =>
    str
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");

  const lowerName = name.toLowerCase();
  const base = speciesName ? speciesName.toLowerCase() : lowerName.split("-")[0];
  const capBase = capitalize(base);

  // 1. Battle Gimmicks & Megas & Gigantamax & Primals
  if (lowerName.includes("-mega")) {
    const suffix = lowerName.split("-mega")[1]?.replace(/^-/, "");
    const suffixFormatted = suffix ? ` ${capitalize(suffix)}` : "";
    return `Mega ${capBase}${suffixFormatted}`;
  }
  if (lowerName.includes("-gmax")) return `Gigantamax ${capBase}`;
  if (lowerName.includes("-primal")) return `Primal ${capBase}`;

  // 2. Regional Forms (Front-loaded)
  if (lowerName.includes("-alola")) return `Alolan ${capBase}`;
  if (lowerName.includes("-galar-zen")) return `Galarian ${capBase} (Zen Mode)`;
  if (lowerName.includes("-galar")) return `Galarian ${capBase}`;
  if (lowerName.includes("-hisui")) return `Hisuian ${capBase}`;
  if (lowerName.includes("-paldea")) return `Paldean ${capBase}`;

  // 3. Castform & Rotom
  if (lowerName === "castform-sunny") return "Castform (Sunny Form)";
  if (lowerName === "castform-rainy") return "Castform (Rainy Form)";
  if (lowerName === "castform-snowy") return "Castform (Snowy Form)";
  if (lowerName === "rotom-heat") return "Rotom (Heat)";
  if (lowerName === "rotom-wash") return "Rotom (Wash)";
  if (lowerName === "rotom-frost") return "Rotom (Frost)";
  if (lowerName === "rotom-fan") return "Rotom (Fan)";
  if (lowerName === "rotom-mow") return "Rotom (Mow)";

  // 4. Deoxys & Sinnoh Origins
  if (lowerName === "deoxys-attack") return "Deoxys (Attack Forme)";
  if (lowerName === "deoxys-defense") return "Deoxys (Defense Forme)";
  if (lowerName === "deoxys-speed") return "Deoxys (Speed Forme)";
  if (lowerName === "dialga-origin") return "Dialga (Origin Forme)";
  if (lowerName === "palkia-origin") return "Palkia (Origin Forme)";
  if (lowerName === "giratina-origin") return "Giratina (Origin Forme)";
  if (lowerName === "shaymin-sky") return "Shaymin (Sky Forme)";

  // 5. Gen 5-9 Specific Form Names
  if (lowerName === "darmanitan-zen") return "Darmanitan (Zen Mode)";
  if (lowerName === "kyurem-black") return "Black Kyurem";
  if (lowerName === "kyurem-white") return "White Kyurem";
  if (lowerName === "keldeo-resolute") return "Keldeo (Resolute Form)";
  if (lowerName === "meloetta-pirouette") return "Meloetta (Pirouette Forme)";
  if (lowerName === "greninja-ash") return "Ash-Greninja";
  if (lowerName === "aegislash-blade") return "Aegislash (Blade Forme)";
  if (lowerName === "zygarde-10") return "Zygarde (10% Forme)";
  if (lowerName === "zygarde-complete") return "Zygarde (Complete Forme)";
  if (lowerName === "wishiwashi-school") return "Wishiwashi (School Form)";
  if (lowerName === "minior-meteor") return "Minior (Meteor Form)";
  if (lowerName === "mimikyu-busted") return "Mimikyu (Busted Form)";
  if (lowerName === "necrozma-dusk") return "Dusk Mane Necrozma";
  if (lowerName === "necrozma-dawn") return "Dawn Wings Necrozma";
  if (lowerName === "necrozma-ultra") return "Ultra Necrozma";
  if (lowerName === "cramorant-gulping") return "Cramorant (Gulping Form)";
  if (lowerName === "cramorant-gorging") return "Cramorant (Gorging Form)";
  if (lowerName === "toxtricity-low-key") return "Toxtricity (Low Key Form)";
  if (lowerName === "eiscue-noice") return "Eiscue (Noice Face)";
  if (lowerName === "morpeko-hangry") return "Morpeko (Hangry Mode)";
  if (lowerName === "zacian-crowned") return "Zacian (Crowned Sword)";
  if (lowerName === "zamazenta-crowned") return "Zamazenta (Crowned Shield)";
  if (lowerName === "eternatus-eternamax") return "Eternamax Eternatus";
  if (lowerName === "urshifu-rapid-strike") return "Urshifu (Rapid Strike)";
  if (lowerName === "calyrex-ice") return "Ice Rider Calyrex";
  if (lowerName === "calyrex-shadow") return "Shadow Rider Calyrex";
  if (lowerName === "palafin-hero") return "Palafin (Hero Form)";
  if (lowerName === "ogerpon-wellspring-mask") return "Ogerpon (Wellspring Mask)";
  if (lowerName === "ogerpon-hearthflame-mask") return "Ogerpon (Hearthflame Mask)";
  if (lowerName === "ogerpon-cornerstone-mask") return "Ogerpon (Cornerstone Mask)";
  if (lowerName === "terapagos-terastal") return "Terapagos (Terastal Form)";
  if (lowerName === "terapagos-stellar") return "Terapagos (Stellar Form)";

  // Pikachu Cap & Cosplay
  if (lowerName === "pikachu-rock-star") return "Rock Star Pikachu";
  if (lowerName === "pikachu-belle") return "Pikachu Belle";
  if (lowerName === "pikachu-pop-star") return "Pop Star Pikachu";
  if (lowerName === "pikachu-phd") return "Pikachu, Ph.D.";
  if (lowerName === "pikachu-libre") return "Pikachu Libre";
  if (lowerName === "pikachu-cosplay") return "Cosplay Pikachu";
  if (lowerName.endsWith("-cap")) {
    const capRegion = lowerName.replace("pikachu-", "").replace("-cap", "");
    return `${capitalize(capRegion)} Cap Pikachu`;
  }

  // Partner & Significant Battle Variants
  if (lowerName === "pikachu-starter") return "Partner Pikachu";
  if (lowerName === "eevee-starter") return "Partner Eevee";
  if (lowerName === "greninja-battle-bond") return "Greninja (Battle Bond)";
  if (lowerName === "wormadam-sandy") return "Wormadam (Sandy Cloak)";
  if (lowerName === "wormadam-trash") return "Wormadam (Trash Cloak)";
  if (lowerName === "meowstic-female") return "Meowstic (Female)";
  if (lowerName === "lycanroc-midnight") return "Lycanroc (Midnight Form)";
  if (lowerName === "lycanroc-dusk") return "Lycanroc (Dusk Form)";
  if (lowerName === "oricorio-pom-pom") return "Oricorio (Pom-Pom Style)";
  if (lowerName === "oricorio-pau") return "Oricorio (Pa'u Style)";
  if (lowerName === "oricorio-sensu") return "Oricorio (Sensu Style)";

  // Fallback for hyphenated varieties
  if (speciesName && lowerName.startsWith(base + "-")) {
    const formSuffix = lowerName.slice(base.length + 1);
    return `${capBase} (${capitalize(formSuffix)})`;
  }

  return capitalize(name);
}

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
        genus = englishGenus.genus;
      }
    }
  }

  const speciesName = speciesData?.name || rawData.species?.name || "";

  return {
    id: rawData.id,
    name: formatPokemonName(rawData.name, speciesName),
    rawName: rawData.name,
    speciesName: speciesName || rawData.name,
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
      const speciesIdentifier = rawData.species?.name || rawData.id;
      const speciesRes = await fetch(`${SPECIES_URL}/${speciesIdentifier}`);
      if (speciesRes.ok) {
        speciesData = await speciesRes.json();
      }
    } catch (e) {}

    return normalizePokemonData(rawData, speciesData);
  } catch (error) {
    console.error("API Error:", error.message);
    throw error;
  }
}

export async function fetchPokemonForms(nameOrId) {
  try {
    const cleanQuery = String(nameOrId).toLowerCase().trim().replace(/\s+/g, "-");

    const speciesRes = await fetch(`${SPECIES_URL}/${cleanQuery}`);
    if (speciesRes.ok) {
      const speciesData = await speciesRes.json();

      if (speciesData.varieties && speciesData.varieties.length > 0) {
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

    const single = await fetchPokemon(nameOrId);
    return [single];
  } catch (error) {
    console.error("API Error in fetchPokemonForms:", error.message);
    const single = await fetchPokemon(nameOrId);
    return [single];
  }
}

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
    hasMore: nextIndex < items.length,
  };
}

/**
 * MASTER SPECIAL FORMS REGISTRY
 * All Megas, Primals, Gigantamax, Regional Variants & Battle Transformations.
 */
const SPECIAL_FORM_REGISTRY = [
  // --- Mega Evolutions ---
  { name: "venusaur-mega", base: "venusaur", tags: ["mega"] },
  { name: "charizard-mega-x", base: "charizard", tags: ["mega"] },
  { name: "charizard-mega-y", base: "charizard", tags: ["mega"] },
  { name: "blastoise-mega", base: "blastoise", tags: ["mega"] },
  { name: "alakazam-mega", base: "alakazam", tags: ["mega"] },
  { name: "gengar-mega", base: "gengar", tags: ["mega"] },
  { name: "kangaskhan-mega", base: "kangaskhan", tags: ["mega"] },
  { name: "pinsir-mega", base: "pinsir", tags: ["mega"] },
  { name: "gyarados-mega", base: "gyarados", tags: ["mega"] },
  { name: "aerodactyl-mega", base: "aerodactyl", tags: ["mega"] },
  { name: "mewtwo-mega-x", base: "mewtwo", tags: ["mega"] },
  { name: "mewtwo-mega-y", base: "mewtwo", tags: ["mega"] },
  { name: "ampharos-mega", base: "ampharos", tags: ["mega"] },
  { name: "steelix-mega", base: "steelix", tags: ["mega"] },
  { name: "scizor-mega", base: "scizor", tags: ["mega"] },
  { name: "heracross-mega", base: "heracross", tags: ["mega"] },
  { name: "houndoom-mega", base: "houndoom", tags: ["mega"] },
  { name: "tyranitar-mega", base: "tyranitar", tags: ["mega"] },
  { name: "sceptile-mega", base: "sceptile", tags: ["mega"] },
  { name: "blaziken-mega", base: "blaziken", tags: ["mega"] },
  { name: "swampert-mega", base: "swampert", tags: ["mega"] },
  { name: "gardevoir-mega", base: "gardevoir", tags: ["mega"] },
  { name: "sableye-mega", base: "sableye", tags: ["mega"] },
  { name: "mawile-mega", base: "mawile", tags: ["mega"] },
  { name: "aggron-mega", base: "aggron", tags: ["mega"] },
  { name: "medicham-mega", base: "medicham", tags: ["mega"] },
  { name: "manectric-mega", base: "manectric", tags: ["mega"] },
  { name: "sharpedo-mega", base: "sharpedo", tags: ["mega"] },
  { name: "camerupt-mega", base: "camerupt", tags: ["mega"] },
  { name: "altaria-mega", base: "altaria", tags: ["mega"] },
  { name: "banette-mega", base: "banette", tags: ["mega"] },
  { name: "absol-mega", base: "absol", tags: ["mega"] },
  { name: "glalie-mega", base: "glalie", tags: ["mega"] },
  { name: "salamence-mega", base: "salamence", tags: ["mega"] },
  { name: "metagross-mega", base: "metagross", tags: ["mega"] },
  { name: "latias-mega", base: "latias", tags: ["mega"] },
  { name: "latios-mega", base: "latios", tags: ["mega"] },
  { name: "rayquaza-mega", base: "rayquaza", tags: ["mega"] },
  { name: "lopunny-mega", base: "lopunny", tags: ["mega"] },
  { name: "garchomp-mega", base: "garchomp", tags: ["mega"] },
  { name: "lucario-mega", base: "lucario", tags: ["mega"] },
  { name: "abomasnow-mega", base: "abomasnow", tags: ["mega"] },
  { name: "gallade-mega", base: "gallade", tags: ["mega"] },
  { name: "audino-mega", base: "audino", tags: ["mega"] },
  { name: "diancie-mega", base: "diancie", tags: ["mega"] },

  // --- Primals ---
  { name: "kyogre-primal", base: "kyogre", tags: ["primal"] },
  { name: "groudon-primal", base: "groudon", tags: ["primal"] },

  // --- Gigantamax / Dynamax ---
  { name: "charizard-gmax", base: "charizard", tags: ["gmax", "dynamax", "gigantamax"] },
  { name: "pikachu-gmax", base: "pikachu", tags: ["gmax", "dynamax", "gigantamax"] },
  { name: "eevee-gmax", base: "eevee", tags: ["gmax", "dynamax", "gigantamax"] },
  { name: "meowth-gmax", base: "meowth", tags: ["gmax", "dynamax", "gigantamax"] },
  { name: "snorlax-gmax", base: "snorlax", tags: ["gmax", "dynamax", "gigantamax"] },
  { name: "butterfree-gmax", base: "butterfree", tags: ["gmax", "dynamax", "gigantamax"] },
  { name: "machamp-gmax", base: "machamp", tags: ["gmax", "dynamax", "gigantamax"] },
  { name: "gengar-gmax", base: "gengar", tags: ["gmax", "dynamax", "gigantamax"] },
  { name: "kingler-gmax", base: "kingler", tags: ["gmax", "dynamax", "gigantamax"] },
  { name: "lapras-gmax", base: "lapras", tags: ["gmax", "dynamax", "gigantamax"] },
  { name: "garbodor-gmax", base: "garbodor", tags: ["gmax", "dynamax", "gigantamax"] },
  { name: "corviknight-gmax", base: "corviknight", tags: ["gmax", "dynamax", "gigantamax"] },
  { name: "orbeetle-gmax", base: "orbeetle", tags: ["gmax", "dynamax", "gigantamax"] },
  { name: "drednaw-gmax", base: "drednaw", tags: ["gmax", "dynamax", "gigantamax"] },
  { name: "coalossal-gmax", base: "coalossal", tags: ["gmax", "dynamax", "gigantamax"] },
  { name: "flapple-gmax", base: "flapple", tags: ["gmax", "dynamax", "gigantamax"] },
  { name: "appletun-gmax", base: "appletun", tags: ["gmax", "dynamax", "gigantamax"] },
  { name: "sandaconda-gmax", base: "sandaconda", tags: ["gmax", "dynamax", "gigantamax"] },
  { name: "toxtricity-amped-gmax", base: "toxtricity", tags: ["gmax", "dynamax", "gigantamax"] },
  { name: "centiskorch-gmax", base: "centiskorch", tags: ["gmax", "dynamax", "gigantamax"] },
  { name: "hatterene-gmax", base: "hatterene", tags: ["gmax", "dynamax", "gigantamax"] },
  { name: "grimmsnarl-gmax", base: "grimmsnarl", tags: ["gmax", "dynamax", "gigantamax"] },
  { name: "alcremie-gmax", base: "alcremie", tags: ["gmax", "dynamax", "gigantamax"] },
  { name: "copperajah-gmax", base: "copperajah", tags: ["gmax", "dynamax", "gigantamax"] },
  { name: "duraludon-gmax", base: "duraludon", tags: ["gmax", "dynamax", "gigantamax"] },
  { name: "urshifu-single-strike-gmax", base: "urshifu", tags: ["gmax", "dynamax", "gigantamax"] },
  { name: "urshifu-rapid-strike-gmax", base: "urshifu", tags: ["gmax", "dynamax", "gigantamax"] },
  { name: "venusaur-gmax", base: "venusaur", tags: ["gmax", "dynamax", "gigantamax"] },
  { name: "blastoise-gmax", base: "blastoise", tags: ["gmax", "dynamax", "gigantamax"] },
  { name: "rillaboom-gmax", base: "rillaboom", tags: ["gmax", "dynamax", "gigantamax"] },
  { name: "cinderace-gmax", base: "cinderace", tags: ["gmax", "dynamax", "gigantamax"] },
  { name: "inteleon-gmax", base: "inteleon", tags: ["gmax", "dynamax", "gigantamax"] },

  // --- Castform & Deoxys ---
  { name: "castform-sunny", base: "castform", tags: ["sunny", "fire"] },
  { name: "castform-rainy", base: "castform", tags: ["rainy", "water"] },
  { name: "castform-snowy", base: "castform", tags: ["snowy", "ice", "hail"] },
  { name: "deoxys-attack", base: "deoxys", tags: ["attack"] },
  { name: "deoxys-defense", base: "deoxys", tags: ["defense"] },
  { name: "deoxys-speed", base: "deoxys", tags: ["speed"] },

  // --- Rotom Appliances ---
  { name: "rotom-heat", base: "rotom", tags: ["heat", "microwave", "fire"] },
  { name: "rotom-wash", base: "rotom", tags: ["wash", "washing machine", "water"] },
  { name: "rotom-frost", base: "rotom", tags: ["frost", "refrigerator", "ice"] },
  { name: "rotom-fan", base: "rotom", tags: ["fan", "flying"] },
  { name: "rotom-mow", base: "rotom", tags: ["mow", "lawnmower", "grass"] },

  // --- Sinnoh Origins & Formes ---
  { name: "dialga-origin", base: "dialga", tags: ["origin"] },
  { name: "palkia-origin", base: "palkia", tags: ["origin"] },
  { name: "giratina-origin", base: "giratina", tags: ["origin"] },
  { name: "shaymin-sky", base: "shaymin", tags: ["sky"] },

  // --- Gen 5: Darmanitan, Kyurem, Keldeo, Meloetta, Therians ---
  { name: "darmanitan-zen", base: "darmanitan", tags: ["zen", "mode"] },
  { name: "darmanitan-galar", base: "darmanitan", tags: ["galar", "galarian"] },
  { name: "darmanitan-galar-zen", base: "darmanitan", tags: ["galar", "galarian", "zen"] },
  { name: "kyurem-black", base: "kyurem", tags: ["black"] },
  { name: "kyurem-white", base: "kyurem", tags: ["white"] },
  { name: "keldeo-resolute", base: "keldeo", tags: ["resolute"] },
  { name: "meloetta-pirouette", base: "meloetta", tags: ["pirouette"] },
  { name: "tornadus-therian", base: "tornadus", tags: ["therian"] },
  { name: "thundurus-therian", base: "thundurus", tags: ["therian"] },
  { name: "landorus-therian", base: "landorus", tags: ["therian"] },
  { name: "enamorus-therian", base: "enamorus", tags: ["therian"] },

  // --- Gen 6: Ash-Greninja, Aegislash, Zygarde ---
  { name: "greninja-ash", base: "greninja", tags: ["ash", "battle bond"] },
  { name: "aegislash-blade", base: "aegislash", tags: ["blade", "stance"] },
  { name: "zygarde-10", base: "zygarde", tags: ["10%"] },
  { name: "zygarde-complete", base: "zygarde", tags: ["complete", "100%"] },

  // --- Gen 7: Wishiwashi, Minior, Mimikyu, Necrozma ---
  { name: "wishiwashi-school", base: "wishiwashi", tags: ["school"] },
  { name: "minior-meteor", base: "minior", tags: ["meteor", "core"] },
  { name: "mimikyu-busted", base: "mimikyu", tags: ["busted"] },
  { name: "necrozma-dusk", base: "necrozma", tags: ["dusk", "mane", "solgaleo"] },
  { name: "necrozma-dawn", base: "necrozma", tags: ["dawn", "wings", "lunala"] },
  { name: "necrozma-ultra", base: "necrozma", tags: ["ultra"] },

  // --- Gen 8: Cramorant, Toxtricity, Eiscue, Morpeko, Zacian/Zamazenta, Calyrex, Urshifu ---
  { name: "cramorant-gulping", base: "cramorant", tags: ["gulping"] },
  { name: "cramorant-gorging", base: "cramorant", tags: ["gorging"] },
  { name: "toxtricity-low-key", base: "toxtricity", tags: ["low-key", "punk"] },
  { name: "eiscue-noice", base: "eiscue", tags: ["noice"] },
  { name: "morpeko-hangry", base: "morpeko", tags: ["hangry"] },
  { name: "zacian-crowned", base: "zacian", tags: ["crowned", "sword"] },
  { name: "zamazenta-crowned", base: "zamazenta", tags: ["crowned", "shield"] },
  { name: "eternatus-eternamax", base: "eternatus", tags: ["eternamax"] },
  { name: "urshifu-rapid-strike", base: "urshifu", tags: ["rapid"] },
  { name: "calyrex-ice", base: "calyrex", tags: ["ice", "rider"] },
  { name: "calyrex-shadow", base: "calyrex", tags: ["shadow", "rider"] },

  // --- Gen 9: Palafin, Ogerpon, Terapagos ---
  { name: "palafin-hero", base: "palafin", tags: ["hero", "zero to hero"] },
  { name: "ogerpon-wellspring-mask", base: "ogerpon", tags: ["wellspring", "water", "mask"] },
  { name: "ogerpon-hearthflame-mask", base: "ogerpon", tags: ["hearthflame", "fire", "mask"] },
  { name: "ogerpon-cornerstone-mask", base: "ogerpon", tags: ["cornerstone", "rock", "mask"] },
  { name: "terapagos-terastal", base: "terapagos", tags: ["terastal"] },
  { name: "terapagos-stellar", base: "terapagos", tags: ["stellar"] },

  // --- Alolan Forms ---
  { name: "rattata-alola", base: "rattata", tags: ["alola", "alolan"] },
  { name: "raticate-alola", base: "raticate", tags: ["alola", "alolan"] },
  { name: "raichu-alola", base: "raichu", tags: ["alola", "alolan"] },
  { name: "sandshrew-alola", base: "sandshrew", tags: ["alola", "alolan"] },
  { name: "sandslash-alola", base: "sandslash", tags: ["alola", "alolan"] },
  { name: "vulpix-alola", base: "vulpix", tags: ["alola", "alolan"] },
  { name: "ninetales-alola", base: "ninetales", tags: ["alola", "alolan"] },
  { name: "diglett-alola", base: "diglett", tags: ["alola", "alolan"] },
  { name: "dugtrio-alola", base: "dugtrio", tags: ["alola", "alolan"] },
  { name: "meowth-alola", base: "meowth", tags: ["alola", "alolan"] },
  { name: "persian-alola", base: "persian", tags: ["alola", "alolan"] },
  { name: "geodude-alola", base: "geodude", tags: ["alola", "alolan"] },
  { name: "graveler-alola", base: "graveler", tags: ["alola", "alolan"] },
  { name: "golem-alola", base: "golem", tags: ["alola", "alolan"] },
  { name: "grimer-alola", base: "grimer", tags: ["alola", "alolan"] },
  { name: "muk-alola", base: "muk", tags: ["alola", "alolan"] },
  { name: "exeggutor-alola", base: "exeggutor", tags: ["alola", "alolan"] },
  { name: "marowak-alola", base: "marowak", tags: ["alola", "alolan"] },

  // --- Galarian Forms ---
  { name: "meowth-galar", base: "meowth", tags: ["galar", "galarian"] },
  { name: "ponyta-galar", base: "ponyta", tags: ["galar", "galarian"] },
  { name: "rapidash-galar", base: "rapidash", tags: ["galar", "galarian"] },
  { name: "slowpoke-galar", base: "slowpoke", tags: ["galar", "galarian"] },
  { name: "slowbro-galar", base: "slowbro", tags: ["galar", "galarian"] },
  { name: "farfetchd-galar", base: "farfetchd", tags: ["galar", "galarian"] },
  { name: "weezing-galar", base: "weezing", tags: ["galar", "galarian"] },
  { name: "mr-mime-galar", base: "mr-mime", tags: ["galar", "galarian"] },
  { name: "articuno-galar", base: "articuno", tags: ["galar", "galarian"] },
  { name: "zapdos-galar", base: "zapdos", tags: ["galar", "galarian"] },
  { name: "moltres-galar", base: "moltres", tags: ["galar", "galarian"] },
  { name: "slowking-galar", base: "slowking", tags: ["galar", "galarian"] },
  { name: "corsola-galar", base: "corsola", tags: ["galar", "galarian"] },
  { name: "zigzagoon-galar", base: "zigzagoon", tags: ["galar", "galarian"] },
  { name: "linoone-galar", base: "linoone", tags: ["galar", "galarian"] },
  { name: "yamask-galar", base: "yamask", tags: ["galar", "galarian"] },
  { name: "stunfisk-galar", base: "stunfisk", tags: ["galar", "galarian"] },

  // --- Hisuian Forms ---
  { name: "growlithe-hisui", base: "growlithe", tags: ["hisui", "hisuian"] },
  { name: "arcanine-hisui", base: "arcanine", tags: ["hisui", "hisuian"] },
  { name: "voltorb-hisui", base: "voltorb", tags: ["hisui", "hisuian"] },
  { name: "electrode-hisui", base: "electrode", tags: ["hisui", "hisuian"] },
  { name: "typhlosion-hisui", base: "typhlosion", tags: ["hisui", "hisuian"] },
  { name: "qwilfish-hisui", base: "qwilfish", tags: ["hisui", "hisuian"] },
  { name: "sneasel-hisui", base: "sneasel", tags: ["hisui", "hisuian"] },
  { name: "samurott-hisui", base: "samurott", tags: ["hisui", "hisuian"] },
  { name: "lilligant-hisui", base: "lilligant", tags: ["hisui", "hisuian"] },
  { name: "zorua-hisui", base: "zorua", tags: ["hisui", "hisuian"] },
  { name: "zoroark-hisui", base: "zoroark", tags: ["hisui", "hisuian"] },
  { name: "braviary-hisui", base: "braviary", tags: ["hisui", "hisuian"] },
  { name: "sliggoo-hisui", base: "sliggoo", tags: ["hisui", "hisuian"] },
  { name: "goodra-hisui", base: "goodra", tags: ["hisui", "hisuian"] },
  { name: "avalugg-hisui", base: "avalugg", tags: ["hisui", "hisuian"] },
  { name: "decidueye-hisui", base: "decidueye", tags: ["hisui", "hisuian"] },

  // --- Paldean Forms ---
  { name: "wooper-paldea", base: "wooper", tags: ["paldea", "paldean"] },
  { name: "tauros-paldea-combat-breed", base: "tauros", tags: ["paldea", "paldean", "combat"] },
  { name: "tauros-paldea-blaze-breed", base: "tauros", tags: ["paldea", "paldean", "blaze"] },
  { name: "tauros-paldea-aqua-breed", base: "tauros", tags: ["paldea", "paldean", "aqua"] },

  // --- Pikachu Cap & Cosplay Forms ---
  { name: "pikachu-rock-star", base: "pikachu", tags: ["rock star", "costume", "cosplay"] },
  { name: "pikachu-belle", base: "pikachu", tags: ["belle", "costume", "cosplay"] },
  { name: "pikachu-pop-star", base: "pikachu", tags: ["pop star", "costume", "cosplay"] },
  { name: "pikachu-phd", base: "pikachu", tags: ["phd", "ph.d", "costume", "cosplay"] },
  { name: "pikachu-libre", base: "pikachu", tags: ["libre", "costume", "cosplay", "lucha"] },
  { name: "pikachu-cosplay", base: "pikachu", tags: ["cosplay", "costume"] },
  { name: "pikachu-original-cap", base: "pikachu", tags: ["cap", "hat", "original", "kanto", "ash"] },
  { name: "pikachu-hoenn-cap", base: "pikachu", tags: ["cap", "hat", "hoenn", "ash"] },
  { name: "pikachu-sinnoh-cap", base: "pikachu", tags: ["cap", "hat", "sinnoh", "ash"] },
  { name: "pikachu-unova-cap", base: "pikachu", tags: ["cap", "hat", "unova", "ash"] },
  { name: "pikachu-kalos-cap", base: "pikachu", tags: ["cap", "hat", "kalos", "ash"] },
  { name: "pikachu-alola-cap", base: "pikachu", tags: ["cap", "hat", "alola", "ash"] },
  { name: "pikachu-partner-cap", base: "pikachu", tags: ["cap", "hat", "partner", "ash"] },
  { name: "pikachu-world-cap", base: "pikachu", tags: ["cap", "hat", "world", "journeys", "ash"] },

  // --- Partner Starters & Battle Transformations ---
  { name: "pikachu-starter", base: "pikachu", tags: ["starter", "lets go"] },
  { name: "eevee-starter", base: "eevee", tags: ["starter", "lets go"] },
  { name: "greninja-battle-bond", base: "greninja", tags: ["battle bond", "ash"] },

  // --- Alternate Typing & Stat Variants ---
  { name: "wormadam-sandy", base: "wormadam", tags: ["sandy", "ground"] },
  { name: "wormadam-trash", base: "wormadam", tags: ["trash", "steel"] },
  { name: "meowstic-female", base: "meowstic", tags: ["female"] },
  { name: "lycanroc-midnight", base: "lycanroc", tags: ["midnight"] },
  { name: "lycanroc-dusk", base: "lycanroc", tags: ["dusk"] },
  { name: "oricorio-pom-pom", base: "oricorio", tags: ["pom-pom", "electric"] },
  { name: "oricorio-pau", base: "oricorio", tags: ["pau", "psychic"] },
  { name: "oricorio-sensu", base: "oricorio", tags: ["sensu", "ghost"] },
];

export async function fetchFullPokedexDirectory() {
  try {
    const res = await fetch("https://pokeapi.co/api/v2/pokemon?limit=1025");
    const data = await res.json();

    const baseList = data.results.map((p, idx) => ({
      id: idx + 1,
      name: p.name,
      baseSpecies: p.name.toLowerCase(),
      displayName: formatPokemonName(p.name),
      forms: [],
    }));

    const formEntries = SPECIAL_FORM_REGISTRY.map((item, idx) => ({
      id: 10000 + idx,
      name: item.name,
      baseSpecies: item.base.toLowerCase(),
      displayName: formatPokemonName(item.name, item.base),
      forms: item.tags,
    }));

    return [...baseList, ...formEntries];
  } catch (err) {
    console.error("Failed to load directory:", err);
    return [];
  }
}