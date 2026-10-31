// ==========================================
// POKÉAPI SERVICE
// Handles fetching, transforming & registry index
// ==========================================

const API = "https://pokeapi.co/api/v2";
const BASE_URL = `${API}/pokemon`;
const SPECIES_URL = `${API}/pokemon-species`;

const DIRECTORY_CACHE_KEY = "pokedex_directory_v2";
const DIRECTORY_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

export const fetchedCache = new Map();
const inFlightRequests = new Map();

export function getCachedPokemon(nameOrId) {
  if (nameOrId === null || nameOrId === undefined) return null;
  const num = Number(nameOrId);
  if (!isNaN(num) && fetchedCache.has(num)) {
    return fetchedCache.get(num);
  }
  const key = String(nameOrId).toLowerCase().trim();
  return fetchedCache.get(key) || null;
}

export function setCachedPokemon(pokemon) {
  if (!pokemon) return;
  if (pokemon.id) {
    fetchedCache.set(Number(pokemon.id), pokemon);
  }
  if (pokemon.rawName) {
    fetchedCache.set(pokemon.rawName.toLowerCase(), pokemon);
  }
  if (pokemon.name) {
    fetchedCache.set(pokemon.name.toLowerCase(), pokemon);
  }
}

function sleep(ms, signal = null) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      return reject(signal.reason || new DOMException("Aborted", "AbortError"));
    }
    const timer = setTimeout(resolve, ms);
    if (signal) {
      signal.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
          reject(signal.reason || new DOMException("Aborted", "AbortError"));
        },
        { once: true }
      );
    }
  });
}

async function fetchJsonWithRetry(url, maxRetries = 3) {
  let attempt = 0;
  while (true) {
    try {
      const response = await fetch(url);
      if (response.status === 429 || response.status >= 500) {
        const err = new Error(`HTTP ${response.status} for ${url}`);
        err.status = response.status;
        err.retryable = true;
        throw err;
      }
      if (!response.ok) {
        const err = new Error(`HTTP ${response.status} for ${url}`);
        err.status = response.status;
        err.retryable = false;
        throw err;
      }
      return await response.json();
    } catch (err) {
      const isNetworkError = err instanceof TypeError || err.retryable === true;
      if (!isNetworkError || attempt >= maxRetries) {
        throw err;
      }
      const delayMs = 300 * Math.pow(2, attempt) + Math.floor(Math.random() * 100);
      attempt++;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

/**
 * Memoizes the in-flight/resolved JSON promise per URL (deletes on failure)
 * and checks signal?.throwIfAborted() before and after awaiting so aborting
 * one caller never cancels a shared network request.
 */
export async function getJSON(url, signal = null) {
  signal?.throwIfAborted?.();

  let promise = inFlightRequests.get(url);
  if (!promise) {
    promise = fetchJsonWithRetry(url, 3).catch((err) => {
      inFlightRequests.delete(url);
      throw err;
    });
    inFlightRequests.set(url, promise);
  }

  const data = await promise;
  signal?.throwIfAborted?.();
  return data;
}

/**
 * Normalizes a string for accent-insensitive, punctuation-insensitive search.
 * Converts ♀ -> "f" and ♂ -> "m" before stripping non-alphanumerics so
 * "nidoran♀", "farfetch'd", "mr. mime", and "flabébé" match cleanly.
 */
export function normalizeSearchString(str) {
  if (!str) return "";
  return String(str)
    .toLowerCase()
    .replace(/♀/g, "f")
    .replace(/♂/g, "m")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Maps raw.githubusercontent.com sprite URLs to the jsDelivr CDN mirror
 * to prevent connection timeouts on restricted networks.
 */
export function fixSpriteUrl(url) {
  if (!url || typeof url !== "string") return url;
  return url.replace(
    "https://raw.githubusercontent.com/PokeAPI/sprites/master/",
    "https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/"
  );
}

export const MAX_POKEMON_ID = 1025;

export const GEN_RANGES = {
  all: { start: 1, end: MAX_POKEMON_ID },
  1: { start: 1, end: 151 },
  2: { start: 152, end: 251 },
  3: { start: 252, end: 386 },
  4: { start: 387, end: 493 },
  5: { start: 494, end: 649 },
  6: { start: 650, end: 721 },
  7: { start: 722, end: 809 },
  8: { start: 810, end: 905 },
  9: { start: 906, end: MAX_POKEMON_ID },
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

export function formatPokemonName(name, speciesName = "", canonicalBaseName = "") {
  if (!name) return "";

  const capitalize = (str) =>
    str
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");

  const lowerName = name.toLowerCase();
  const baseSlug = speciesName
    ? speciesName.toLowerCase()
    : inferBaseSpeciesSlug(lowerName);
  const displayBase = canonicalBaseName || capitalize(baseSlug);

  if (lowerName === baseSlug && canonicalBaseName) {
    return canonicalBaseName;
  }

  // Paldean Tauros Breeds
  if (lowerName === "tauros-paldea-combat-breed") return `Paldean ${displayBase} (Combat Breed)`;
  if (lowerName === "tauros-paldea-blaze-breed") return `Paldean ${displayBase} (Blaze Breed)`;
  if (lowerName === "tauros-paldea-aqua-breed") return `Paldean ${displayBase} (Aqua Breed)`;

  // Specific Regional & Special Edge Cases
  if (lowerName === "farfetchd-galar") return "Galarian Farfetch'd";
  if (lowerName === "mr-mime-galar") return "Galarian Mr. Mime";
  if (lowerName === "darmanitan-galar-zen") return `Galarian ${displayBase} (Zen Mode)`;
  if (lowerName === "greninja-ash") return "Ash-Greninja";
  if (lowerName === "basculin-white-striped") return `White-Striped ${displayBase}`;
  if (lowerName === "ursaluna-bloodmoon") return `Bloodmoon ${displayBase}`;

  // Standard Regional Forms
  if (lowerName.endsWith("-alola")) return `Alolan ${displayBase}`;
  if (lowerName.endsWith("-galar")) return `Galarian ${displayBase}`;
  if (lowerName.endsWith("-paldea")) return `Paldean ${displayBase}`;
  if (lowerName.endsWith("-hisui")) return `Hisuian ${displayBase}`;

  // Battle Gimmicks & Megas
  if (lowerName.includes("-mega")) {
    const suffix = lowerName.split("-mega")[1]?.replace(/^-/, "");
    const suffixFormatted = suffix ? ` ${capitalize(suffix)}` : "";
    return `Mega ${displayBase}${suffixFormatted}`;
  }
  if (lowerName.includes("-gmax")) return `Gigantamax ${displayBase}`;
  if (lowerName.includes("-primal")) return `Primal ${displayBase}`;

  // Species fallback for form suffixes
  if (baseSlug && lowerName.startsWith(baseSlug + "-")) {
    const formSuffix = lowerName.slice(baseSlug.length + 1);
    return `${displayBase} (${capitalize(formSuffix)})`;
  }

  return canonicalBaseName || capitalize(name);
}

export function calculateStatBounds(statName, base) {
  if (statName === "hp") {
    if (base === 1) return { min: 1, max: 1 };
    const min = Math.floor(((2 * base + 0 + 0) * 100) / 100) + 100 + 10;
    const max = Math.floor(((2 * base + 31 + 63) * 100) / 100) + 100 + 10;
    return { min, max };
  }
  const min = Math.floor((Math.floor(((2 * base + 0 + 0) * 100) / 100) + 5) * 0.9);
  const max = Math.floor((Math.floor(((2 * base + 31 + 63) * 100) / 100) + 5) * 1.1);
  return { min, max };
}

export function parseEvolutionDetails(detailsList) {
  if (!detailsList || detailsList.length === 0) return "";

  const uniqueConditions = new Set();

  detailsList.forEach((d) => {
    const parts = [];
    const triggerName = d.trigger?.name || "";

    if (triggerName === "level-up") {
      if (d.min_level) parts.push(`Level ${d.min_level}`);
      if (d.min_happiness) parts.push("High Friendship");
      if (d.min_affection) parts.push(`Affection ${d.min_affection}+`);
      if (d.known_move) parts.push(`Knows ${formatPokemonName(d.known_move.name)}`);
      if (d.known_move_type) parts.push(`Knows ${formatPokemonName(d.known_move_type.name)}-type move`);
      if (d.held_item) parts.push(`Hold ${formatPokemonName(d.held_item.name)}`);
      if (d.time_of_day) parts.push(`(${d.time_of_day})`);
      if (d.location) parts.push(`at ${formatPokemonName(d.location.name)}`);
      if (parts.length === 0) parts.push("Level up");
    } else if (triggerName === "use-item") {
      parts.push(d.item ? `Use ${formatPokemonName(d.item.name)}` : "Use item");
      if (d.time_of_day) parts.push(`(${d.time_of_day})`);
    } else if (triggerName === "trade") {
      if (d.trade_species) {
        parts.push(`Trade for ${formatPokemonName(d.trade_species.name)}`);
      } else if (d.held_item) {
        parts.push(`Trade holding ${formatPokemonName(d.held_item.name)}`);
      } else {
        parts.push("Trade");
      }
    } else if (triggerName === "shed") {
      parts.push("Open slot & Poké Ball");
    } else if (triggerName) {
      parts.push(formatPokemonName(triggerName));
    }

    // Shared modifier conditions applicable across triggers
    if (d.gender === 1) parts.push("(Female)");
    else if (d.gender === 2) parts.push("(Male)");

    if (d.party_species) {
      parts.push(`with ${formatPokemonName(d.party_species.name)} in party`);
    }
    if (d.party_type) {
      parts.push(`with ${formatPokemonName(d.party_type.name)}-type in party`);
    }
    if (d.relative_physical_stats === 1) {
      parts.push("(Atk > Def)");
    } else if (d.relative_physical_stats === -1) {
      parts.push("(Atk < Def)");
    } else if (d.relative_physical_stats === 0) {
      parts.push("(Atk = Def)");
    }
    if (d.needs_overworld_rain) {
      parts.push("in Rain");
    }
    if (d.turn_upside_down) {
      parts.push("(Hold console upside down)");
    }

    const text = parts.join(" ").trim();
    if (text) uniqueConditions.add(text);
  });

  return Array.from(uniqueConditions).join(" / ");
}

function parseEvolutionChain(chainNode) {
  const result = {
    speciesName: chainNode.species.name,
    speciesUrl: chainNode.species.url,
    evolutionRequirement: parseEvolutionDetails(chainNode.evolution_details),
    evolvesTo: [],
    battleForms: []
  };

  if (chainNode.evolves_to && chainNode.evolves_to.length > 0) {
    result.evolvesTo = chainNode.evolves_to.map(parseEvolutionChain);
  }

  return result;
}

// ==========================================
// BATTLE FORMS & GIMMICKS REGISTRY (Megas, Primals, Battle Bond)
// Separated from standard evolution stages
// ==========================================
export const BATTLE_FORMS_REGISTRY = {
  // Gen 1 (Kanto)
  venusaur: [{ name: "venusaur-mega", displayName: "Mega Venusaur", trigger: "Venusaurite", id: 10033 }],
  charizard: [
    { name: "charizard-mega-x", displayName: "Mega Charizard X", trigger: "Charizardite X", id: 10034 },
    { name: "charizard-mega-y", displayName: "Mega Charizard Y", trigger: "Charizardite Y", id: 10035 }
  ],
  blastoise: [{ name: "blastoise-mega", displayName: "Mega Blastoise", trigger: "Blastoisinite", id: 10036 }],
  beedrill: [{ name: "beedrill-mega", displayName: "Mega Beedrill", trigger: "Beedrillite", id: 10090 }],
  pidgeot: [{ name: "pidgeot-mega", displayName: "Mega Pidgeot", trigger: "Pidgeotite", id: 10073 }],
  raichu: [
    { name: "raichu-mega-x", displayName: "Mega Raichu X", trigger: "Raichunite X", id: "raichu-mega-x", baseSpecies: "raichu" },
    { name: "raichu-mega-y", displayName: "Mega Raichu Y", trigger: "Raichunite Y", id: "raichu-mega-y", baseSpecies: "raichu" }
  ],
  clefable: [{ name: "clefable-mega", displayName: "Mega Clefable", trigger: "Clefablite", id: "clefable-mega", baseSpecies: "clefable" }],
  victreebel: [{ name: "victreebel-mega", displayName: "Mega Victreebel", trigger: "Victreebelite", id: "victreebel-mega", baseSpecies: "victreebel" }],
  alakazam: [{ name: "alakazam-mega", displayName: "Mega Alakazam", trigger: "Alakazite", id: 10037 }],
  slowbro: [{ name: "slowbro-mega", displayName: "Mega Slowbro", trigger: "Slowbronite", id: 10071 }],
  gengar: [{ name: "gengar-mega", displayName: "Mega Gengar", trigger: "Gengarite", id: 10038 }],
  kangaskhan: [{ name: "kangaskhan-mega", displayName: "Mega Kangaskhan", trigger: "Kangaskhanite", id: 10039 }],
  starmie: [{ name: "starmie-mega", displayName: "Mega Starmie", trigger: "Starminite", id: "starmie-mega", baseSpecies: "starmie" }],
  pinsir: [{ name: "pinsir-mega", displayName: "Mega Pinsir", trigger: "Pinsirite", id: 10040 }],
  gyarados: [{ name: "gyarados-mega", displayName: "Mega Gyarados", trigger: "Gyaradosite", id: 10041 }],
  aerodactyl: [{ name: "aerodactyl-mega", displayName: "Mega Aerodactyl", trigger: "Aerodactylite", id: 10042 }],
  dragonite: [{ name: "dragonite-mega", displayName: "Mega Dragonite", trigger: "Dragoninite", id: "dragonite-mega", baseSpecies: "dragonite" }],
  mewtwo: [
    { name: "mewtwo-mega-x", displayName: "Mega Mewtwo X", trigger: "Mewtwonite X", id: 10043 },
    { name: "mewtwo-mega-y", displayName: "Mega Mewtwo Y", trigger: "Mewtwonite Y", id: 10044 }
  ],

  // Gen 2 (Johto)
  meganium: [{ name: "meganium-mega", displayName: "Mega Meganium", trigger: "Meganiumite", id: "meganium-mega", baseSpecies: "meganium" }],
  feraligatr: [{ name: "feraligatr-mega", displayName: "Mega Feraligatr", trigger: "Feraligite", id: "feraligatr-mega", baseSpecies: "feraligatr" }],
  ampharos: [{ name: "ampharos-mega", displayName: "Mega Ampharos", trigger: "Ampharosite", id: 10045 }],
  steelix: [{ name: "steelix-mega", displayName: "Mega Steelix", trigger: "Steelixite", id: 10072 }],
  scizor: [{ name: "scizor-mega", displayName: "Mega Scizor", trigger: "Scizorite", id: 10046 }],
  heracross: [{ name: "heracross-mega", displayName: "Mega Heracross", trigger: "Heracronite", id: 10047 }],
  skarmory: [{ name: "skarmory-mega", displayName: "Mega Skarmory", trigger: "Skarmorite", id: "skarmory-mega", baseSpecies: "skarmory" }],
  houndoom: [{ name: "houndoom-mega", displayName: "Mega Houndoom", trigger: "Houndoominite", id: 10048 }],
  tyranitar: [{ name: "tyranitar-mega", displayName: "Mega Tyranitar", trigger: "Tyranitarite", id: 10049 }],

  // Gen 3 (Hoenn)
  sceptile: [{ name: "sceptile-mega", displayName: "Mega Sceptile", trigger: "Sceptilite", id: 10065 }],
  blaziken: [{ name: "blaziken-mega", displayName: "Mega Blaziken", trigger: "Blazikenite", id: 10050 }],
  swampert: [{ name: "swampert-mega", displayName: "Mega Swampert", trigger: "Swampertite", id: 10064 }],
  gardevoir: [{ name: "gardevoir-mega", displayName: "Mega Gardevoir", trigger: "Gardevoirite", id: 10051 }],
  sableye: [{ name: "sableye-mega", displayName: "Mega Sableye", trigger: "Sablenite", id: 10066 }],
  mawile: [{ name: "mawile-mega", displayName: "Mega Mawile", trigger: "Mawilite", id: 10052 }],
  aggron: [{ name: "aggron-mega", displayName: "Mega Aggron", trigger: "Aggronite", id: 10053 }],
  medicham: [{ name: "medicham-mega", displayName: "Mega Medicham", trigger: "Medichamite", id: 10054 }],
  manectric: [{ name: "manectric-mega", displayName: "Mega Manectric", trigger: "Manectite", id: 10055 }],
  sharpedo: [{ name: "sharpedo-mega", displayName: "Mega Sharpedo", trigger: "Sharpedonite", id: 10070 }],
  camerupt: [{ name: "camerupt-mega", displayName: "Mega Camerupt", trigger: "Cameruptite", id: 10087 }],
  altaria: [{ name: "altaria-mega", displayName: "Mega Altaria", trigger: "Altarianite", id: 10067 }],
  banette: [{ name: "banette-mega", displayName: "Mega Banette", trigger: "Banettite", id: 10056 }],
  absol: [
    { name: "absol-mega", displayName: "Mega Absol", trigger: "Absolite", id: 10057 },
    { name: "absol-mega-z", displayName: "Mega Absol Z", trigger: "Absolite Z", id: "absol-mega-z", baseSpecies: "absol" }
  ],
  glalie: [{ name: "glalie-mega", displayName: "Mega Glalie", trigger: "Glalitite", id: 10074 }],
  chimecho: [{ name: "chimecho-mega", displayName: "Mega Chimecho", trigger: "Chimechite", id: "chimecho-mega", baseSpecies: "chimecho" }],
  salamence: [{ name: "salamence-mega", displayName: "Mega Salamence", trigger: "Salamencite", id: 10089 }],
  metagross: [{ name: "metagross-mega", displayName: "Mega Metagross", trigger: "Metagrossite", id: 10076 }],
  latias: [{ name: "latias-mega", displayName: "Mega Latias", trigger: "Latiasite", id: 10062 }],
  latios: [{ name: "latios-mega", displayName: "Mega Latios", trigger: "Latiosite", id: 10063 }],
  kyogre: [{ name: "kyogre-primal", displayName: "Primal Kyogre", trigger: "Blue Orb Reversion", id: 10077 }],
  groudon: [{ name: "groudon-primal", displayName: "Primal Groudon", trigger: "Red Orb Reversion", id: 10078 }],
  rayquaza: [{ name: "rayquaza-mega", displayName: "Mega Rayquaza", trigger: "Knows Dragon Ascent", id: 10079 }],

  // Gen 4 (Sinnoh)
  staraptor: [{ name: "staraptor-mega", displayName: "Mega Staraptor", trigger: "Staraptite", id: "staraptor-mega", baseSpecies: "staraptor" }],
  lopunny: [{ name: "lopunny-mega", displayName: "Mega Lopunny", trigger: "Lopunnite", id: 10088 }],
  garchomp: [
    { name: "garchomp-mega", displayName: "Mega Garchomp", trigger: "Garchompite", id: 10058 },
    { name: "garchomp-mega-z", displayName: "Mega Garchomp Z", trigger: "Garchompite Z", id: "garchomp-mega-z", baseSpecies: "garchomp" }
  ],
  lucario: [
    { name: "lucario-mega", displayName: "Mega Lucario", trigger: "Lucarionite", id: 10059 },
    { name: "lucario-mega-z", displayName: "Mega Lucario Z", trigger: "Lucarionite Z", id: "lucario-mega-z", baseSpecies: "lucario" }
  ],
  abomasnow: [{ name: "abomasnow-mega", displayName: "Mega Abomasnow", trigger: "Abomasite", id: 10060 }],
  gallade: [{ name: "gallade-mega", displayName: "Mega Gallade", trigger: "Galladite", id: 10068 }],
  froslass: [{ name: "froslass-mega", displayName: "Mega Froslass", trigger: "Froslassite", id: "froslass-mega", baseSpecies: "froslass" }],
  heatran: [{ name: "heatran-mega", displayName: "Mega Heatran", trigger: "Heatranite", id: "heatran-mega", baseSpecies: "heatran" }],
  darkrai: [{ name: "darkrai-mega", displayName: "Mega Darkrai", trigger: "Darkranite", id: "darkrai-mega", baseSpecies: "darkrai" }],

  // Gen 5 (Unova)
  emboar: [{ name: "emboar-mega", displayName: "Mega Emboar", trigger: "Emboarite", id: "emboar-mega", baseSpecies: "emboar" }],
  excadrill: [{ name: "excadrill-mega", displayName: "Mega Excadrill", trigger: "Excadrite", id: "excadrill-mega", baseSpecies: "excadrill" }],
  scolipede: [{ name: "scolipede-mega", displayName: "Mega Scolipede", trigger: "Scolipite", id: "scolipede-mega", baseSpecies: "scolipede" }],
  audino: [{ name: "audino-mega", displayName: "Mega Audino", trigger: "Audinite", id: 10069 }],
  scrafty: [{ name: "scrafty-mega", displayName: "Mega Scrafty", trigger: "Scraftinite", id: "scrafty-mega", baseSpecies: "scrafty" }],
  eelektross: [{ name: "eelektross-mega", displayName: "Mega Eelektross", trigger: "Eelektrossite", id: "eelektross-mega", baseSpecies: "eelektross" }],
  chandelure: [{ name: "chandelure-mega", displayName: "Mega Chandelure", trigger: "Chandelurite", id: "chandelure-mega", baseSpecies: "chandelure" }],
  golurk: [{ name: "golurk-mega", displayName: "Mega Golurk", trigger: "Golurkite", id: "golurk-mega", baseSpecies: "golurk" }],

  // Gen 6 (Kalos)
  chesnaught: [{ name: "chesnaught-mega", displayName: "Mega Chesnaught", trigger: "Chesnaughtite", id: "chesnaught-mega", baseSpecies: "chesnaught" }],
  delphox: [{ name: "delphox-mega", displayName: "Mega Delphox", trigger: "Delphoxite", id: "delphox-mega", baseSpecies: "delphox" }],
  greninja: [
    { name: "greninja-ash", displayName: "Ash-Greninja", trigger: "Battle Bond", id: 10117 },
    { name: "greninja-mega", displayName: "Mega Greninja", trigger: "Greninjite", id: "greninja-mega", baseSpecies: "greninja" }
  ],
  pyroar: [{ name: "pyroar-mega", displayName: "Mega Pyroar", trigger: "Pyroarite", id: "pyroar-mega", baseSpecies: "pyroar" }],
  floette: [{ name: "floette-eternal-mega", displayName: "Mega Floette (Eternal)", trigger: "Floettite", id: "floette-eternal-mega", baseSpecies: "floette" }],
  meowstic: [{ name: "meowstic-mega", displayName: "Mega Meowstic", trigger: "Meowsticite", id: "meowstic-mega", baseSpecies: "meowstic" }],
  malamar: [{ name: "malamar-mega", displayName: "Mega Malamar", trigger: "Malamarite", id: "malamar-mega", baseSpecies: "malamar" }],
  barbaracle: [{ name: "barbaracle-mega", displayName: "Mega Barbaracle", trigger: "Barbaracite", id: "barbaracle-mega", baseSpecies: "barbaracle" }],
  dragalge: [{ name: "dragalge-mega", displayName: "Mega Dragalge", trigger: "Dragalgite", id: "dragalge-mega", baseSpecies: "dragalge" }],
  hawlucha: [{ name: "hawlucha-mega", displayName: "Mega Hawlucha", trigger: "Hawluchanite", id: "hawlucha-mega", baseSpecies: "hawlucha" }],
  diancie: [{ name: "diancie-mega", displayName: "Mega Diancie", trigger: "Diancite", id: 10075 }],
  zygarde: [{ name: "zygarde-mega", displayName: "Mega Zygarde", trigger: "Zygardite", id: "zygarde-mega", baseSpecies: "zygarde" }],

  // Gen 7 (Alola)
  crabominable: [{ name: "crabominable-mega", displayName: "Mega Crabominable", trigger: "Crabominite", id: "crabominable-mega", baseSpecies: "crabominable" }],
  golisopod: [{ name: "golisopod-mega", displayName: "Mega Golisopod", trigger: "Golisopite", id: "golisopod-mega", baseSpecies: "golisopod" }],
  drampa: [{ name: "drampa-mega", displayName: "Mega Drampa", trigger: "Drampanite", id: "drampa-mega", baseSpecies: "drampa" }],
  magearna: [
    { name: "magearna-mega", displayName: "Mega Magearna", trigger: "Magearnite", id: "magearna-mega", baseSpecies: "magearna" },
    { name: "magearna-original-mega", displayName: "Mega Magearna (Original)", trigger: "Magearnite", id: "magearna-original-mega", baseSpecies: "magearna" }
  ],
  zeraora: [{ name: "zeraora-mega", displayName: "Mega Zeraora", trigger: "Zeraorite", id: "zeraora-mega", baseSpecies: "zeraora" }],

  // Gen 8 (Galar)
  falinks: [{ name: "falinks-mega", displayName: "Mega Falinks", trigger: "Falinksite", id: "falinks-mega", baseSpecies: "falinks" }],

  // Gen 9 (Paldea)
  scovillain: [{ name: "scovillain-mega", displayName: "Mega Scovillain", trigger: "Scovillainite", id: "scovillain-mega", baseSpecies: "scovillain" }],
  tatsugiri: [
    { name: "tatsugiri-curly-mega", displayName: "Mega Tatsugiri (Curly)", trigger: "Tatsugirinite", id: "tatsugiri-curly-mega", baseSpecies: "tatsugiri" },
    { name: "tatsugiri-droopy-mega", displayName: "Mega Tatsugiri (Droopy)", trigger: "Tatsugirinite", id: "tatsugiri-droopy-mega", baseSpecies: "tatsugiri" },
    { name: "tatsugiri-stretchy-mega", displayName: "Mega Tatsugiri (Stretchy)", trigger: "Tatsugirinite", id: "tatsugiri-stretchy-mega", baseSpecies: "tatsugiri" }
  ],
  glimmora: [{ name: "glimmora-mega", displayName: "Mega Glimmora", trigger: "Glimmoranite", id: "glimmora-mega", baseSpecies: "glimmora" }],
  baxcalibur: [{ name: "baxcalibur-mega", displayName: "Mega Baxcalibur", trigger: "Baxcalibrite", id: "baxcalibur-mega", baseSpecies: "baxcalibur" }]
};

// ==========================================
// REGIONAL PRE-EVO SIBLING INJECTIONS
// Parallel branches added to pre-evos without overwriting regular evos
// ==========================================
export const SIBLING_EVO_INJECTIONS = {
  pikachu: [
    { speciesName: "raichu-alola", displayName: "Alolan Raichu", id: 10100, requirement: "Thunder Stone in Alola" }
  ],
  exeggcute: [
    { speciesName: "exeggutor-alola", displayName: "Alolan Exeggutor", id: 10114, requirement: "Leaf Stone in Alola" }
  ],
  cubone: [
    { speciesName: "marowak-alola", displayName: "Alolan Marowak", id: 10115, requirement: "Level 28 at Night in Alola" }
  ],
  koffing: [
    { speciesName: "weezing-galar", displayName: "Galarian Weezing", id: 10167, requirement: "Level 35 in Galar" }
  ],
  "mime-jr": [
    { speciesName: "mr-mime-galar", displayName: "Galarian Mr. Mime", id: 10168, requirement: "Level up with Mimic in Galar" }
  ],
  quilava: [
    { speciesName: "typhlosion-hisui", displayName: "Hisuian Typhlosion", id: 10233, requirement: "Level 36 in Hisui" }
  ],
  dewott: [
    { speciesName: "samurott-hisui", displayName: "Hisuian Samurott", id: 10236, requirement: "Level 36 in Hisui" }
  ],
  dartrix: [
    { speciesName: "decidueye-hisui", displayName: "Hisuian Decidueye", id: 10244, requirement: "Level 36 in Hisui" }
  ],
  petilil: [
    { speciesName: "lilligant-hisui", displayName: "Hisuian Lilligant", id: 10237, requirement: "Sun Stone in Hisui" }
  ],
  rufflet: [
    { speciesName: "braviary-hisui", displayName: "Hisuian Braviary", id: 10240, requirement: "Level 54 in Hisui" }
  ],
  bergmite: [
    { speciesName: "avalugg-hisui", displayName: "Hisuian Avalugg", id: 10243, requirement: "Level 37 in Hisui" }
  ],
  sliggoo: [
    { speciesName: "goodra-hisui", displayName: "Hisuian Goodra", id: 10242, requirement: "Level 50 in Rain (Hisui)" }
  ],
  scyther: [
    { speciesName: "kleavor", displayName: "Kleavor", id: 900, requirement: "Black Augurite" }
  ],
  stantler: [
    { speciesName: "wyrdeer", displayName: "Wyrdeer", id: 899, requirement: "Psyshield Bash Agile 20×" }
  ],
  ursaring: [
    { speciesName: "ursaluna", displayName: "Ursaluna", id: 901, requirement: "Peat Block under Full Moon" }
  ]
};

// ==========================================
// DEDICATED REGIONAL EVOLUTION CHAINS
// ==========================================
export const ISOLATED_REGIONAL_TREES = {
  // Alolan forms
  "rattata-alola": [{ name: "rattata-alola", id: 10091 }, { name: "raticate-alola", id: 10092, req: "Level 20 at Night" }],
  "raticate-alola": [{ name: "rattata-alola", id: 10091 }, { name: "raticate-alola", id: 10092, req: "Level 20 at Night" }],
  "sandshrew-alola": [{ name: "sandshrew-alola", id: 10101 }, { name: "sandslash-alola", id: 10102, req: "Ice Stone" }],
  "sandslash-alola": [{ name: "sandshrew-alola", id: 10101 }, { name: "sandslash-alola", id: 10102, req: "Ice Stone" }],
  "vulpix-alola": [{ name: "vulpix-alola", id: 10103 }, { name: "ninetales-alola", id: 10104, req: "Ice Stone" }],
  "ninetales-alola": [{ name: "vulpix-alola", id: 10103 }, { name: "ninetales-alola", id: 10104, req: "Ice Stone" }],
  "diglett-alola": [{ name: "diglett-alola", id: 10105 }, { name: "dugtrio-alola", id: 10106, req: "Level 26" }],
  "dugtrio-alola": [{ name: "diglett-alola", id: 10105 }, { name: "dugtrio-alola", id: 10106, req: "Level 26" }],
  "meowth-alola": [{ name: "meowth-alola", id: 10107 }, { name: "persian-alola", id: 10108, req: "High Friendship" }],
  "persian-alola": [{ name: "meowth-alola", id: 10107 }, { name: "persian-alola", id: 10108, req: "High Friendship" }],
  "geodude-alola": [{ name: "geodude-alola", id: 10109 }, { name: "graveler-alola", id: 10110, req: "Level 25" }, { name: "golem-alola", id: 10111, req: "Trade" }],
  "graveler-alola": [{ name: "geodude-alola", id: 10109 }, { name: "graveler-alola", id: 10110, req: "Level 25" }, { name: "golem-alola", id: 10111, req: "Trade" }],
  "golem-alola": [{ name: "geodude-alola", id: 10109 }, { name: "graveler-alola", id: 10110, req: "Level 25" }, { name: "golem-alola", id: 10111, req: "Trade" }],
  "grimer-alola": [{ name: "grimer-alola", id: 10112 }, { name: "muk-alola", id: 10113, req: "Level 38" }],
  "muk-alola": [{ name: "grimer-alola", id: 10112 }, { name: "muk-alola", id: 10113, req: "Level 38" }],

  // Galarian forms
  "meowth-galar": [{ name: "meowth-galar", id: 10161 }, { name: "perrserker", id: 863, req: "Level 28" }],
  "perrserker": [{ name: "meowth-galar", id: 10161 }, { name: "perrserker", id: 863, req: "Level 28" }],
  "ponyta-galar": [{ name: "ponyta-galar", id: 10162 }, { name: "rapidash-galar", id: 10163, req: "Level 40" }],
  "rapidash-galar": [{ name: "ponyta-galar", id: 10162 }, { name: "rapidash-galar", id: 10163, req: "Level 40" }],
  "farfetchd-galar": [{ name: "farfetchd-galar", id: 10166 }, { name: "sirfetchd", id: 865, req: "3 Crits in 1 Battle" }],
  "sirfetchd": [{ name: "farfetchd-galar", id: 10166 }, { name: "sirfetchd", id: 865, req: "3 Crits in 1 Battle" }],
  "corsola-galar": [{ name: "corsola-galar", id: 10173 }, { name: "cursola", id: 864, req: "Level 38" }],
  "cursola": [{ name: "corsola-galar", id: 10173 }, { name: "cursola", id: 864, req: "Level 38" }],
  "zigzagoon-galar": [{ name: "zigzagoon-galar", id: 10174 }, { name: "linoone-galar", id: 10175, req: "Level 20" }, { name: "obstagoon", id: 862, req: "Level 35 at Night" }],
  "linoone-galar": [{ name: "zigzagoon-galar", id: 10174 }, { name: "linoone-galar", id: 10175, req: "Level 20" }, { name: "obstagoon", id: 862, req: "Level 35 at Night" }],
  "obstagoon": [{ name: "zigzagoon-galar", id: 10174 }, { name: "linoone-galar", id: 10175, req: "Level 20" }, { name: "obstagoon", id: 862, req: "Level 35 at Night" }],
  "darumaka-galar": [{ name: "darumaka-galar", id: 10176 }, { name: "darmanitan-galar", id: 10177, req: "Ice Stone" }],
  "darmanitan-galar": [{ name: "darumaka-galar", id: 10176 }, { name: "darmanitan-galar", id: 10177, req: "Ice Stone" }],
  "yamask-galar": [{ name: "yamask-galar", id: 10179 }, { name: "runerigus", id: 867, req: "Take 49+ dmg & visit Stone Arch" }],
  "runerigus": [{ name: "yamask-galar", id: 10179 }, { name: "runerigus", id: 867, req: "Take 49+ dmg & visit Stone Arch" }],
  "mr-rime": [{ name: "mime-jr", id: 439 }, { name: "mr-mime-galar", id: 10168, req: "Level up with Mimic" }, { name: "mr-rime", id: 866, req: "Level 42" }],

  // Paldean forms
  "wooper-paldea": [{ name: "wooper-paldea", id: 10253 }, { name: "clodsire", id: 980, req: "Level 20" }],
  "clodsire": [{ name: "wooper-paldea", id: 10253 }, { name: "clodsire", id: 980, req: "Level 20" }],

  // Hisuian forms
  "growlithe-hisui": [{ name: "growlithe-hisui", id: 10229 }, { name: "arcanine-hisui", id: 10230, req: "Fire Stone" }],
  "arcanine-hisui": [{ name: "growlithe-hisui", id: 10229 }, { name: "arcanine-hisui", id: 10230, req: "Fire Stone" }],
  "voltorb-hisui": [{ name: "voltorb-hisui", id: 10231 }, { name: "electrode-hisui", id: 10232, req: "Leaf Stone" }],
  "electrode-hisui": [{ name: "voltorb-hisui", id: 10231 }, { name: "electrode-hisui", id: 10232, req: "Leaf Stone" }],
  "qwilfish-hisui": [{ name: "qwilfish-hisui", id: 10234 }, { name: "overqwil", id: 904, req: "Barb Barrage Strong 20×" }],
  "overqwil": [{ name: "qwilfish-hisui", id: 10234 }, { name: "overqwil", id: 904, req: "Barb Barrage Strong 20×" }],
  "sneasel-hisui": [{ name: "sneasel-hisui", id: 10235 }, { name: "sneasler", id: 903, req: "Razor Claw (Day)" }],
  "sneasler": [{ name: "sneasel-hisui", id: 10235 }, { name: "sneasler", id: 903, req: "Razor Claw (Day)" }],
  "zorua-hisui": [{ name: "zorua-hisui", id: 10238 }, { name: "zoroark-hisui", id: 10239, req: "Level 30" }],
  "zoroark-hisui": [{ name: "zorua-hisui", id: 10238 }, { name: "zoroark-hisui", id: 10239, req: "Level 30" }],
  "sliggoo-hisui": [{ name: "goomy", id: 704 }, { name: "sliggoo-hisui", id: 10241, req: "Level 40 in Hisui" }, { name: "goodra-hisui", id: 10242, req: "Level 50 in Rain" }],
  "goodra-hisui": [{ name: "goomy", id: 704 }, { name: "sliggoo-hisui", id: 10241, req: "Level 40 in Hisui" }, { name: "goodra-hisui", id: 10242, req: "Level 50 in Rain" }],
  "basculin-white-striped": [
    { name: "basculin-white-striped", id: 10247 },
    { name: "basculegion-male", id: 902, req: "Lose 294+ recoil HP" }
  ]
};

function buildLinearChainNode(steps, index = 0) {
  if (index >= steps.length) return null;
  const current = steps[index];
  const node = {
    speciesName: current.name,
    displayName: formatPokemonName(current.name),
    speciesUrl: String(current.id),
    customImage: `https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/pokemon/other/official-artwork/${current.id}.png`,
    evolutionRequirement: current.req || "",
    evolvesTo: [],
    battleForms: BATTLE_FORMS_REGISTRY[current.name.toLowerCase()] || []
  };
  const next = buildLinearChainNode(steps, index + 1);
  if (next) node.evolvesTo = [next];
  return node;
}

export function buildCompleteEvolutionTree(rawName, baseParsedChain) {
  const lowerName = rawName.toLowerCase();

  // 1. Isolated dedicated regional line check
  if (ISOLATED_REGIONAL_TREES[lowerName]) {
    return buildLinearChainNode(ISOLATED_REGIONAL_TREES[lowerName]);
  }

  // 2. Standard chain traversal with parallel sibling injections and battleForms attachment
  function processChainNode(node) {
    if (!node) return null;
    const cleanKey = node.speciesName.toLowerCase();

    // Attach battle forms (Megas, Primals, Ash-Greninja)
    node.battleForms = BATTLE_FORMS_REGISTRY[cleanKey] || [];

    // Inject regional parallel branches as siblings
    const extraSiblings = SIBLING_EVO_INJECTIONS[cleanKey] || [];
    if (extraSiblings.length > 0) {
      extraSiblings.forEach((sibling) => {
        const alreadyExists = node.evolvesTo.some(
          (c) => c.speciesName.toLowerCase() === sibling.speciesName.toLowerCase()
        );
        if (!alreadyExists) {
          node.evolvesTo.push({
            speciesName: sibling.speciesName,
            displayName: sibling.displayName,
            speciesUrl: String(sibling.id),
            customImage: `https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/pokemon/other/official-artwork/${sibling.id}.png`,
            evolutionRequirement: sibling.requirement,
            evolvesTo: [],
            battleForms: BATTLE_FORMS_REGISTRY[sibling.speciesName.toLowerCase()] || []
          });
        }
      });
    }

    if (node.evolvesTo && node.evolvesTo.length > 0) {
      node.evolvesTo.forEach(processChainNode);
    }

    return node;
  }

  return processChainNode(baseParsedChain);
}

function getEnglishSpeciesName(speciesData) {
  if (!speciesData?.names) return "";
  const enEntry = speciesData.names.find((n) => n.language?.name === "en");
  return enEntry ? enEntry.name : "";
}

function getFriendshipLabel(val) {
  if (val === 0) return "lowest";
  if (val < 50) return "low";
  if (val <= 70) return "normal";
  if (val < 100) return "high";
  return "very high";
}

export function normalizePokemonSummary(rawData, speciesData = null) {
  const animatedImage =
    fixSpriteUrl(
      rawData.sprites?.other?.showdown?.front_default ||
      rawData.sprites?.versions?.["generation-v"]?.["black-white"]?.animated?.front_default
    );

  const officialArtwork =
    rawData.sprites?.other?.["official-artwork"]?.front_default ||
    rawData.sprites?.front_default;

  const shinyArtwork =
    rawData.sprites?.other?.["official-artwork"]?.front_shiny ||
    rawData.sprites?.front_shiny ||
    `https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/pokemon/other/official-artwork/shiny/${rawData.id}.png`;

  const pixelSprite =
    rawData.sprites?.front_default ||
    `https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/pokemon/${rawData.id}.png`;

  let description = "No Pokédex description available.";
  let genus = "";
  let generation = null;

  if (speciesData?.generation?.url) {
    const genParts = speciesData.generation.url.split("/").filter(Boolean);
    const parsedGen = parseInt(genParts[genParts.length - 1], 10);
    if (!isNaN(parsedGen)) generation = parsedGen;
  }

  if (speciesData) {
    if (speciesData.flavor_text_entries) {
      const englishEntries = speciesData.flavor_text_entries.filter(
        (entry) => entry.language?.name === "en"
      );
      if (englishEntries.length > 0) {
        const lastEntry = englishEntries[englishEntries.length - 1];
        description = lastEntry.flavor_text
          .replace(/[\f\n\r]/g, " ")
          .replace(/\s+/g, " ")
          .trim();
      }
    }

    if (speciesData.genera) {
      const englishGenus = speciesData.genera.find((g) => g.language?.name === "en");
      if (englishGenus) genus = englishGenus.genus;
    }
  }

  const speciesName = speciesData?.name || rawData.species?.name || "";
  const canonicalBaseName = getEnglishSpeciesName(speciesData);

  const stats = {
    hp: rawData.stats?.find((s) => s.stat.name === "hp")?.base_stat || 0,
    attack: rawData.stats?.find((s) => s.stat.name === "attack")?.base_stat || 0,
    defense: rawData.stats?.find((s) => s.stat.name === "defense")?.base_stat || 0,
    spAtk: rawData.stats?.find((s) => s.stat.name === "special-attack")?.base_stat || 0,
    spDef: rawData.stats?.find((s) => s.stat.name === "special-defense")?.base_stat || 0,
    speed: rawData.stats?.find((s) => s.stat.name === "speed")?.base_stat || 0,
  };

  const abilities = (rawData.abilities || []).map((a) => ({
    name: formatPokemonName(a.ability.name),
    rawName: a.ability.name,
    isHidden: a.is_hidden,
    slot: a.slot,
    url: a.ability.url,
  }));

  return {
    id: rawData.id,
    name: formatPokemonName(rawData.name, speciesName, canonicalBaseName),
    rawName: rawData.name,
    speciesName: speciesName || rawData.name,
    generation,
    genus: genus || "Pokémon",
    height: rawData.height ? (rawData.height / 10).toFixed(1) + " m" : "N/A",
    weight: rawData.weight ? (rawData.weight / 10).toFixed(1) + " kg" : "N/A",
    animatedImage: animatedImage || officialArtwork,
    officialArtwork,
    shinyArtwork,
    sprite: pixelSprite,
    image: animatedImage || officialArtwork,
    types: rawData.types?.map((t) => t.type.name) || [],
    stats,
    abilities,
    cry: rawData.cries?.latest || rawData.cries?.legacy || null,
    description,
    isDetailed: false,
  };
}

export function normalizePokemonData(rawData, speciesData = null, evolutionData = null) {
  const summary = normalizePokemonSummary(rawData, speciesData);
  const canonicalBaseName = getEnglishSpeciesName(speciesData);

  const flavorTextEntries = [];
  if (speciesData?.flavor_text_entries) {
    speciesData.flavor_text_entries.forEach((entry) => {
      if (entry.language?.name === "en") {
        const cleanText = entry.flavor_text
          .replace(/[\f\n\r]/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        flavorTextEntries.push({
          version: entry.version.name,
          flavorText: cleanText,
        });
      }
    });
  }

  const statBounds = {
    hp: calculateStatBounds("hp", summary.stats.hp),
    attack: calculateStatBounds("attack", summary.stats.attack),
    defense: calculateStatBounds("defense", summary.stats.defense),
    spAtk: calculateStatBounds("special-attack", summary.stats.spAtk),
    spDef: calculateStatBounds("special-defense", summary.stats.spDef),
    speed: calculateStatBounds("speed", summary.stats.speed),
  };

  const evYieldList = [];
  rawData.stats?.forEach((s) => {
    if (s.effort > 0) {
      evYieldList.push(`${s.effort} ${formatPokemonName(s.stat.name)}`);
    }
  });

  const heldItems = (rawData.held_items || []).map((h) => ({
    name: formatPokemonName(h.item.name),
    rarity: h.version_details?.[0]?.rarity ?? null,
  }));

  const catchRate = speciesData?.capture_rate ?? null;
  const baseFriendship = speciesData?.base_happiness ?? null;
  const baseExp = rawData.base_experience ?? null;
  const growthRate = speciesData?.growth_rate?.name
    ? formatPokemonName(speciesData.growth_rate.name)
    : "Medium";
  const eggGroups =
    speciesData?.egg_groups?.map((g) => formatPokemonName(g.name)) || ["Undiscovered"];
  const genderRate = speciesData?.gender_rate ?? -1;
  const hatchCounter = speciesData?.hatch_counter ?? null;

  const varieties = (speciesData?.varieties || []).map((v) => {
    const vUrlParts = v.pokemon.url.split("/").filter(Boolean);
    const formId = vUrlParts[vUrlParts.length - 1];
    return {
      name: formatPokemonName(v.pokemon.name, summary.speciesName, canonicalBaseName),
      rawName: v.pokemon.name,
      id: formId,
      image: `https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/pokemon/other/official-artwork/${formId}.png`,
      isDefault: v.is_default,
    };
  });

  const moves = (rawData.moves || []).map((m) => {
    const versions = m.version_group_details.map((vg) => ({
      versionGroup: vg.version_group.name,
      learnMethod: vg.move_learn_method.name,
      levelLearned: vg.level_learned_at,
    }));

    return {
      name: formatPokemonName(m.move.name),
      rawName: m.move.name,
      versions,
    };
  });

  const parsedBaseTree = evolutionData ? parseEvolutionChain(evolutionData.chain) : null;
  const finalEvolutionTree = buildCompleteEvolutionTree(rawData.name, parsedBaseTree);

  const catchPct =
    catchRate !== null ? Math.round(((catchRate / 765) * 100) * 10) / 10 : null;

  return {
    ...summary,
    statBounds,
    flavorTextEntries,
    evYield: evYieldList.length > 0 ? evYieldList.join(", ") : "None",
    catchRate:
      catchRate !== null
        ? `${catchRate} (~${catchPct}% with Poké Ball at full HP)`
        : "N/A",
    baseFriendship:
      baseFriendship !== null
        ? `${baseFriendship} (${getFriendshipLabel(baseFriendship)})`
        : "N/A",
    baseExp: baseExp !== null ? `${baseExp}` : "N/A",
    growthRate,
    heldItems,
    eggGroups,
    genderRate,
    hatchCounter:
      hatchCounter !== null
        ? `${hatchCounter * 255} steps (${hatchCounter} cycles)`
        : "N/A",
    varieties,
    moves,
    evolutionTree: finalEvolutionTree,
    isDetailed: true,
  };
}

/**
 * Lightweight fetch for the mini-game (fetches only /pokemon/{id} if not already cached).
 */
export async function fetchPokemonMinigame(nameOrId, signal = null) {
  const cached = getCachedPokemon(nameOrId);
  if (cached) return cached;

  const cleanQuery = encodeURIComponent(
    String(nameOrId).toLowerCase().trim().replace(/\s+/g, "-")
  );
  const rawData = await getJSON(`${BASE_URL}/${cleanQuery}`, signal);
  const animatedImage =
    fixSpriteUrl(
      rawData.sprites?.other?.showdown?.front_default ||
      rawData.sprites?.versions?.["generation-v"]?.["black-white"]?.animated?.front_default
    );
  const officialArtwork =
    rawData.sprites?.other?.["official-artwork"]?.front_default ||
    rawData.sprites?.front_default;

  return {
    id: rawData.id,
    name: formatPokemonName(rawData.name, rawData.species?.name || ""),
    rawName: rawData.name,
    officialArtwork: officialArtwork || animatedImage,
    image: officialArtwork || animatedImage,
    cry: rawData.cries?.latest || rawData.cries?.legacy || null,
  };
}

/**
 * Fetches summary data (pokemon + species) for grid, team, favorites, PC box, and scanner.
 */
export async function fetchPokemonSummary(nameOrId, signal = null) {
  const cached = getCachedPokemon(nameOrId);
  if (cached) {
    signal?.throwIfAborted?.();
    return cached;
  }

  try {
    const cleanQuery = encodeURIComponent(
      String(nameOrId).toLowerCase().trim().replace(/\s+/g, "-")
    );
    const rawData = await getJSON(`${BASE_URL}/${cleanQuery}`, signal);
    let speciesData = null;

    try {
      const speciesIdentifier = encodeURIComponent(rawData.species?.name || rawData.id);
      speciesData = await getJSON(`${SPECIES_URL}/${speciesIdentifier}`, signal);
    } catch (e) {
      if (e.name === "AbortError") throw e;
      console.warn("Could not fetch species data:", e);
    }

    const summary = normalizePokemonSummary(rawData, speciesData);
    setCachedPokemon(summary);
    return summary;
  } catch (error) {
    if (error.name === "AbortError") throw error;
    console.error("API Summary Error:", error.message);
    throw error;
  }
}

/**
 * Fetches complete detail data (including evolution chain, moves, varieties, training/breeding)
 * when the detail modal opens.
 */
export async function fetchPokemonDetail(nameOrId, signal = null) {
  const cached = getCachedPokemon(nameOrId);
  if (cached && cached.isDetailed) {
    signal?.throwIfAborted?.();
    return cached;
  }

  try {
    const cleanQuery = encodeURIComponent(
      String(nameOrId).toLowerCase().trim().replace(/\s+/g, "-")
    );
    const rawData = await getJSON(`${BASE_URL}/${cleanQuery}`, signal);
    let speciesData = null;
    let evolutionData = null;

    try {
      const speciesIdentifier = encodeURIComponent(rawData.species?.name || rawData.id);
      speciesData = await getJSON(`${SPECIES_URL}/${speciesIdentifier}`, signal);
      if (speciesData?.evolution_chain?.url) {
        evolutionData = await getJSON(speciesData.evolution_chain.url, signal);
      }
    } catch (e) {
      if (e.name === "AbortError") throw e;
      console.warn("Could not fetch species/evolution data:", e);
    }

    const detailed = normalizePokemonData(rawData, speciesData, evolutionData);
    setCachedPokemon(detailed);
    return detailed;
  } catch (error) {
    if (error.name === "AbortError") throw error;
    console.error("API Detail Error:", error.message);
    throw error;
  }
}

// Alias kept for backward compatibility if any external caller imports fetchPokemon
export const fetchPokemon = fetchPokemonDetail;

let secondaryTypeIdsCache = null;

export async function getPokemonListByType(typeName, slot = null, excludeForms = true, signal = null) {
  const safeType = encodeURIComponent(String(typeName).toLowerCase().trim());
  const data = await getJSON(`${API}/type/${safeType}`, signal);
  let entries = data.pokemon;

  if (slot !== null) {
    entries = entries.filter((entry) => entry.slot === slot);
  }

  const results = entries.map((entry) => {
    const urlParts = entry.pokemon.url.split("/").filter(Boolean);
    const id = parseInt(urlParts[urlParts.length - 1], 10);
    return { name: entry.pokemon.name, id, slot: entry.slot };
  });

  if (excludeForms) {
    return results.filter((p) => p.id < 10000);
  }
  return results;
}

export async function getAllSecondaryTypeIds(signal = null) {
  if (secondaryTypeIdsCache) return secondaryTypeIdsCache;

  const ALL_TYPES = Object.keys(TYPE_CHART);
  const requests = ALL_TYPES.map(async (type) => {
    try {
      const list = await getPokemonListByType(type, 2, true, signal);
      return list.map((p) => p.id);
    } catch (err) {
      if (err.name === "AbortError") throw err;
      return [];
    }
  });

  const idArrays = await Promise.all(requests);
  secondaryTypeIdsCache = new Set(idArrays.flat());
  return secondaryTypeIdsCache;
}

/**
 * Fetches a slice of Pokémon summaries with concurrency limited to 8 workers,
 * automatic retry with exponential backoff (via getJSON), and returns a `failed` list.
 */
export async function fetchPokemonBatch(
  items,
  startIndex,
  batchSize = 30,
  signal = null,
  concurrency = 8
) {
  const slice = items.slice(startIndex, startIndex + batchSize);
  const results = new Array(slice.length).fill(null);
  const failed = [];
  let cursor = 0;

  async function worker() {
    while (cursor < slice.length) {
      signal?.throwIfAborted?.();
      const idx = cursor++;
      const item = slice[idx];
      const identifier = typeof item === "object" ? item.name || item.id : item;

      try {
        const mon = await fetchPokemonSummary(identifier, signal);
        results[idx] = mon;
      } catch (err) {
        if (err.name === "AbortError" || signal?.aborted) throw err;
        console.warn(`Failed to load Pokémon ${identifier}:`, err);
        failed.push(identifier);
      }
    }
  }

  const workerCount = Math.min(concurrency, slice.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  const validPokemon = results.filter(Boolean);
  const nextIndex = startIndex + batchSize;

  return {
    pokemonList: validPokemon,
    failed,
    nextIndex,
    hasMore: nextIndex < items.length,
  };
}

export function getFormOrSpeciesGen(pokemon) {
  // 1. Prefer explicit species generation if available on normalized data
  if (typeof pokemon === "object" && pokemon !== null && pokemon.generation) {
    return Number(pokemon.generation);
  }

  const name = (typeof pokemon === "object" ? pokemon.rawName || pokemon.name : String(pokemon)).toLowerCase();

  // 2. Name-based form heuristics
  if (name.includes("-alola")) return 7;
  if (name.includes("-galar") || name.includes("-hisui")) return 8;
  if (name.includes("-paldea")) return 9;
  if (name.includes("-mega") || name.includes("-primal")) return 6;
  if (name.includes("-gmax")) return 8;

  // 3. Fallback by National Dex ID range (numeric gens 1..9 only)
  const id = typeof pokemon === "object" ? Number(pokemon.id) : Number(pokemon);
  if (!isNaN(id)) {
    for (let gen = 1; gen <= 9; gen++) {
      const range = GEN_RANGES[gen];
      if (range && id >= range.start && id <= range.end) {
        return gen;
      }
    }
  }

  return 1;
}

export function isItemInGenRange(item, targetGen) {
  if (targetGen === "all") return true;
  const numGen = Number(targetGen);
  return getFormOrSpeciesGen(item) === numGen;
}

/**
 * COMPREHENSIVE SPECIAL & REGIONAL FORMS REGISTRY
 */
export const SPECIAL_FORM_REGISTRY = [
  // --- Alolan Forms ---
  { name: "rattata-alola", base: "rattata", tags: ["alola", "alolan", "regional"] },
  { name: "raticate-alola", base: "raticate", tags: ["alola", "alolan", "regional"] },
  { name: "raichu-alola", base: "raichu", tags: ["alola", "alolan", "regional"] },
  { name: "sandshrew-alola", base: "sandshrew", tags: ["alola", "alolan", "regional"] },
  { name: "sandslash-alola", base: "sandslash", tags: ["alola", "alolan", "regional"] },
  { name: "vulpix-alola", base: "vulpix", tags: ["alola", "alolan", "regional"] },
  { name: "ninetales-alola", base: "ninetales", tags: ["alola", "alolan", "regional"] },
  { name: "diglett-alola", base: "diglett", tags: ["alola", "alolan", "regional"] },
  { name: "dugtrio-alola", base: "dugtrio", tags: ["alola", "alolan", "regional"] },
  { name: "meowth-alola", base: "meowth", tags: ["alola", "alolan", "regional"] },
  { name: "persian-alola", base: "persian", tags: ["alola", "alolan", "regional"] },
  { name: "geodude-alola", base: "geodude", tags: ["alola", "alolan", "regional"] },
  { name: "graveler-alola", base: "graveler", tags: ["alola", "alolan", "regional"] },
  { name: "golem-alola", base: "golem", tags: ["alola", "alolan", "regional"] },
  { name: "grimer-alola", base: "grimer", tags: ["alola", "alolan", "regional"] },
  { name: "muk-alola", base: "muk", tags: ["alola", "alolan", "regional"] },
  { name: "exeggutor-alola", base: "exeggutor", tags: ["alola", "alolan", "regional"] },
  { name: "marowak-alola", base: "marowak", tags: ["alola", "alolan", "regional"] },

  // --- Galarian Forms ---
  { name: "meowth-galar", base: "meowth", tags: ["galar", "galarian", "regional"] },
  { name: "ponyta-galar", base: "ponyta", tags: ["galar", "galarian", "regional"] },
  { name: "rapidash-galar", base: "rapidash", tags: ["galar", "galarian", "regional"] },
  { name: "slowpoke-galar", base: "slowpoke", tags: ["galar", "galarian", "regional"] },
  { name: "slowbro-galar", base: "slowbro", tags: ["galar", "galarian", "regional"] },
  { name: "farfetchd-galar", base: "farfetchd", tags: ["galar", "galarian", "regional"] },
  { name: "weezing-galar", base: "weezing", tags: ["galar", "galarian", "regional"] },
  { name: "mr-mime-galar", base: "mr-mime", tags: ["galar", "galarian", "regional"] },
  { name: "articuno-galar", base: "articuno", tags: ["galar", "galarian", "regional"] },
  { name: "zapdos-galar", base: "zapdos", tags: ["galar", "galarian", "regional"] },
  { name: "moltres-galar", base: "moltres", tags: ["galar", "galarian", "regional"] },
  { name: "slowking-galar", base: "slowking", tags: ["galar", "galarian", "regional"] },
  { name: "corsola-galar", base: "corsola", tags: ["galar", "galarian", "regional"] },
  { name: "zigzagoon-galar", base: "zigzagoon", tags: ["galar", "galarian", "regional"] },
  { name: "linoone-galar", base: "linoone", tags: ["galar", "galarian", "regional"] },
  { name: "darumaka-galar", base: "darumaka", tags: ["galar", "galarian", "regional"] },
  { name: "darmanitan-galar", base: "darmanitan", tags: ["galar", "galarian", "regional"] },
  { name: "yamask-galar", base: "yamask", tags: ["galar", "galarian", "regional"] },
  { name: "stunfisk-galar", base: "stunfisk", tags: ["galar", "galarian", "regional"] },

  // --- Paldean Forms ---
  { name: "wooper-paldea", base: "wooper", tags: ["paldea", "paldean", "regional"] },
  { name: "tauros-paldea-combat-breed", base: "tauros", tags: ["paldea", "paldean", "combat", "regional"] },
  { name: "tauros-paldea-blaze-breed", base: "tauros", tags: ["paldea", "paldean", "blaze", "regional"] },
  { name: "tauros-paldea-aqua-breed", base: "tauros", tags: ["paldea", "paldean", "aqua", "regional"] },

  // --- Hisuian Forms ---
  { name: "growlithe-hisui", base: "growlithe", tags: ["hisui", "hisuian", "regional"] },
  { name: "arcanine-hisui", base: "arcanine", tags: ["hisui", "hisuian", "regional"] },
  { name: "voltorb-hisui", base: "voltorb", tags: ["hisui", "hisuian", "regional"] },
  { name: "electrode-hisui", base: "electrode", tags: ["hisui", "hisuian", "regional"] },
  { name: "typhlosion-hisui", base: "typhlosion", tags: ["hisui", "hisuian", "regional"] },
  { name: "qwilfish-hisui", base: "qwilfish", tags: ["hisui", "hisuian", "regional"] },
  { name: "sneasel-hisui", base: "sneasel", tags: ["hisui", "hisuian", "regional"] },
  { name: "samurott-hisui", base: "samurott", tags: ["hisui", "hisuian", "regional"] },
  { name: "lilligant-hisui", base: "lilligant", tags: ["hisui", "hisuian", "regional"] },
  { name: "zorua-hisui", base: "zorua", tags: ["hisui", "hisuian", "regional"] },
  { name: "zoroark-hisui", base: "zoroark", tags: ["hisui", "hisuian", "regional"] },
  { name: "braviary-hisui", base: "braviary", tags: ["hisui", "hisuian", "regional"] },
  { name: "sliggoo-hisui", base: "sliggoo", tags: ["hisui", "hisuian", "regional"] },
  { name: "goodra-hisui", base: "goodra", tags: ["hisui", "hisuian", "regional"] },
  { name: "avalugg-hisui", base: "avalugg", tags: ["hisui", "hisuian", "regional"] },
  { name: "decidueye-hisui", base: "decidueye", tags: ["hisui", "hisuian", "regional"] },

  // --- Battle Bond ---
  { name: "greninja-ash", base: "greninja", tags: ["battle-bond", "ash-greninja", "special"] },

  // --- Megas & Primals ---
  { name: "venusaur-mega", base: "venusaur", tags: ["mega"] },
  { name: "charizard-mega-x", base: "charizard", tags: ["mega"] },
  { name: "charizard-mega-y", base: "charizard", tags: ["mega"] },
  { name: "blastoise-mega", base: "blastoise", tags: ["mega"] },
  { name: "beedrill-mega", base: "beedrill", tags: ["mega"] },
  { name: "pidgeot-mega", base: "pidgeot", tags: ["mega"] },
  { name: "alakazam-mega", base: "alakazam", tags: ["mega"] },
  { name: "slowbro-mega", base: "slowbro", tags: ["mega"] },
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
  { name: "kyogre-primal", base: "kyogre", tags: ["primal"] },
  { name: "groudon-primal", base: "groudon", tags: ["primal"] },

  // --- Gigantamax ---
  { name: "venusaur-gmax", base: "venusaur", tags: ["gmax", "dynamax"] },
  { name: "charizard-gmax", base: "charizard", tags: ["gmax", "dynamax"] },
  { name: "blastoise-gmax", base: "blastoise", tags: ["gmax", "dynamax"] },
  { name: "butterfree-gmax", base: "butterfree", tags: ["gmax", "dynamax"] },
  { name: "pikachu-gmax", base: "pikachu", tags: ["gmax", "dynamax"] },
  { name: "meowth-gmax", base: "meowth", tags: ["gmax", "dynamax"] },
  { name: "machamp-gmax", base: "machamp", tags: ["gmax", "dynamax"] },
  { name: "gengar-gmax", base: "gengar", tags: ["gmax", "dynamax"] },
  { name: "kingler-gmax", base: "kingler", tags: ["gmax", "dynamax"] },
  { name: "lapras-gmax", base: "lapras", tags: ["gmax", "dynamax"] },
  { name: "eevee-gmax", base: "eevee", tags: ["gmax", "dynamax"] },
  { name: "snorlax-gmax", base: "snorlax", tags: ["gmax", "dynamax"] },
  { name: "garbodor-gmax", base: "garbodor", tags: ["gmax", "dynamax"] },
  { name: "melmetal-gmax", base: "melmetal", tags: ["gmax", "dynamax"] },
  { name: "rillaboom-gmax", base: "rillaboom", tags: ["gmax", "dynamax"] },
  { name: "cinderace-gmax", base: "cinderace", tags: ["gmax", "dynamax"] },
  { name: "inteleon-gmax", base: "inteleon", tags: ["gmax", "dynamax"] },
  { name: "corviknight-gmax", base: "corviknight", tags: ["gmax", "dynamax"] },
  { name: "orbeetle-gmax", base: "orbeetle", tags: ["gmax", "dynamax"] },
  { name: "drednaw-gmax", base: "drednaw", tags: ["gmax", "dynamax"] },
  { name: "coalossal-gmax", base: "coalossal", tags: ["gmax", "dynamax"] },
  { name: "flapple-gmax", base: "flapple", tags: ["gmax", "dynamax"] },
  { name: "appletun-gmax", base: "appletun", tags: ["gmax", "dynamax"] },
  { name: "sandaconda-gmax", base: "sandaconda", tags: ["gmax", "dynamax"] },
  { name: "toxtricity-gmax", base: "toxtricity", tags: ["gmax", "dynamax"] },
  { name: "centiskorch-gmax", base: "centiskorch", tags: ["gmax", "dynamax"] },
  { name: "hatterene-gmax", base: "hatterene", tags: ["gmax", "dynamax"] },
  { name: "grimmsnarl-gmax", base: "grimmsnarl", tags: ["gmax", "dynamax"] },
  { name: "alcremie-gmax", base: "alcremie", tags: ["gmax", "dynamax"] },
  { name: "copperajah-gmax", base: "copperajah", tags: ["gmax", "dynamax"] },
  { name: "duraludon-gmax", base: "duraludon", tags: ["gmax", "dynamax"] },
  { name: "urshifu-single-strike-gmax", base: "urshifu", tags: ["gmax", "dynamax"] },
  { name: "urshifu-rapid-strike-gmax", base: "urshifu", tags: ["gmax", "dynamax"] },
];

const HYPHENATED_BASE_SPECIES = new Set([
  "nidoran-f",
  "nidoran-m",
  "mr-mime",
  "ho-oh",
  "mime-jr",
  "porygon-z",
  "type-null",
  "jangmo-o",
  "hakamo-o",
  "kommo-o",
  "tapu-koko",
  "tapu-lele",
  "tapu-bulu",
  "tapu-fini",
  "mr-rime",
  "great-tusk",
  "scream-tail",
  "brute-bonnet",
  "flutter-mane",
  "slither-wing",
  "sandy-shocks",
  "iron-treads",
  "iron-bundle",
  "iron-hands",
  "iron-jugulis",
  "iron-moth",
  "iron-thorns",
  "wo-chien",
  "chien-pao",
  "ting-lu",
  "chi-yu",
  "roaring-moon",
  "iron-valiant",
  "walking-wake",
  "iron-leaves",
  "gouging-fire",
  "raging-bolt",
  "iron-boulder",
  "iron-crown",
]);

export function inferBaseSpeciesSlug(rawName, knownBaseSpeciesSet = HYPHENATED_BASE_SPECIES) {
  const lower = String(rawName || "").toLowerCase();
  if (knownBaseSpeciesSet.has(lower)) return lower;

  for (const hyphenBase of HYPHENATED_BASE_SPECIES) {
    if (lower === hyphenBase || lower.startsWith(hyphenBase + "-")) {
      return hyphenBase;
    }
  }

  const parts = lower.split("-");
  if (parts.length >= 2) {
    const twoPart = `${parts[0]}-${parts[1]}`;
    if (knownBaseSpeciesSet.has(twoPart)) return twoPart;
  }

  return parts[0];
}

export function deriveFormTagsFromName(rawName, baseSpecies = "") {
  const lower = String(rawName || "").toLowerCase();
  const tags = new Set();

  if (lower.includes("-alola")) {
    tags.add("alola");
    tags.add("alolan");
    tags.add("regional");
  }
  if (lower.includes("-galar")) {
    tags.add("galar");
    tags.add("galarian");
    tags.add("regional");
  }
  if (lower.includes("-hisui")) {
    tags.add("hisui");
    tags.add("hisuian");
    tags.add("regional");
  }
  if (lower.includes("-paldea")) {
    tags.add("paldea");
    tags.add("paldean");
    tags.add("regional");
  }
  if (lower.includes("-mega")) {
    tags.add("mega");
  }
  if (lower.includes("-gmax")) {
    tags.add("gmax");
    tags.add("dynamax");
    tags.add("gigantamax");
  }
  if (lower.includes("-primal")) {
    tags.add("primal");
  }
  if (lower === "greninja-ash") {
    tags.add("battle-bond");
    tags.add("ash-greninja");
    tags.add("special");
  }

  if (baseSpecies && lower.startsWith(baseSpecies + "-")) {
    const suffixParts = lower.slice(baseSpecies.length + 1).split("-");
    suffixParts.forEach((p) => {
      if (p) tags.add(p);
    });
  }

  return Array.from(tags);
}

let inMemoryDirectory = null;

export async function fetchFullPokedexDirectory(signal = null) {
  // 1. In-memory cache hit
  if (Array.isArray(inMemoryDirectory) && inMemoryDirectory.length > 0) {
    return inMemoryDirectory;
  }

  // 1. Check versioned localStorage cache with TTL
  try {
    const rawCache = localStorage.getItem(DIRECTORY_CACHE_KEY);
    if (rawCache) {
      const parsed = JSON.parse(rawCache);
      if (
        parsed &&
        parsed.timestamp &&
        Date.now() - parsed.timestamp < DIRECTORY_CACHE_TTL &&
        Array.isArray(parsed.data) &&
        parsed.data.length > 0
      ) {
        inMemoryDirectory = parsed.data;
        return inMemoryDirectory;
      }
    }
  } catch (e) {
    console.warn("Could not read directory cache from localStorage:", e);
  }

  // 3. Fast offline-ready fallback: load bundled static directory JSON
  try {
    const staticRes = await fetch("./data/pokedex_directory.json", { signal });
    if (staticRes.ok) {
      const bundledData = await staticRes.json();
      if (Array.isArray(bundledData) && bundledData.length > 0) {
        inMemoryDirectory = bundledData;
        try {
          localStorage.setItem(
            DIRECTORY_CACHE_KEY,
            JSON.stringify({ timestamp: Date.now(), data: bundledData })
          );
        } catch (e) {
          console.warn("Could not write directory cache to localStorage:", e);
        }
        return inMemoryDirectory;
      }
    }
  } catch (staticErr) {
    if (staticErr.name === "AbortError") throw staticErr;
    console.warn("Bundled directory fetch failed, falling back to PokéAPI:", staticErr);
  }

  // 4. Remote PokéAPI fallback
  try {
    const data = await getJSON(`${BASE_URL}?limit=100000`, signal);

    const specialFormsMap = new Map(
      SPECIAL_FORM_REGISTRY.map((item) => [item.name.toLowerCase(), item])
    );

    const baseSpeciesSet = new Set(HYPHENATED_BASE_SPECIES);
    for (const p of data.results || []) {
      const urlParts = p.url.split("/").filter(Boolean);
      const pokeId = parseInt(urlParts[urlParts.length - 1], 10);
      if (pokeId >= 1 && pokeId <= MAX_POKEMON_ID) {
        baseSpeciesSet.add(p.name.toLowerCase());
      }
    }

    const directory = [];
    const seenIds = new Set();
    const seenNames = new Set();

    // Ingest official PokéAPI entries only (no fake 10000+ or 20000+ IDs)
    for (const p of data.results || []) {
      const lowerName = p.name.toLowerCase();
      const urlParts = p.url.split("/").filter(Boolean);
      const pokeId = parseInt(urlParts[urlParts.length - 1], 10);

      if (isNaN(pokeId) || seenIds.has(pokeId) || seenNames.has(lowerName)) continue;
      seenIds.add(pokeId);
      seenNames.add(lowerName);

      const specialMeta = specialFormsMap.get(lowerName);
      const baseSpecies = specialMeta
        ? specialMeta.base.toLowerCase()
        : inferBaseSpeciesSlug(lowerName, baseSpeciesSet);

      const derivedTags = deriveFormTagsFromName(lowerName, baseSpecies);
      const combinedTags = specialMeta
        ? Array.from(new Set([...specialMeta.tags, ...derivedTags]))
        : derivedTags;

      directory.push({
        id: pokeId,
        name: p.name,
        baseSpecies,
        displayName: formatPokemonName(p.name, baseSpecies),
        forms: combinedTags,
      });
    }

    try {
      localStorage.setItem(
        DIRECTORY_CACHE_KEY,
        JSON.stringify({ timestamp: Date.now(), data: directory })
      );
    } catch (e) {
      console.warn("Could not write directory cache to localStorage:", e);
    }

    inMemoryDirectory = directory;
    return directory;
  } catch (err) {
    if (err.name === "AbortError") throw err;
    console.error("Failed to load directory:", err);
    return [];
  }
}