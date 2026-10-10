// ==========================================
// POKÉAPI SERVICE
// Handles fetching, transforming & registry index
// ==========================================

const BASE_URL = "https://pokeapi.co/api/v2/pokemon";
const SPECIES_URL = "https://pokeapi.co/api/v2/pokemon-species";

export const GEN_RANGES = {
  all: { start: 1, end: 100000 },
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

  // Paldean Tauros Breeds
  if (lowerName === "tauros-paldea-combat-breed") return "Paldean Tauros (Combat Breed)";
  if (lowerName === "tauros-paldea-blaze-breed") return "Paldean Tauros (Blaze Breed)";
  if (lowerName === "tauros-paldea-aqua-breed") return "Paldean Tauros (Aqua Breed)";

  // Specific Regional & Special Edge Cases
  if (lowerName === "farfetchd-galar") return "Galarian Farfetch'd";
  if (lowerName === "mr-mime-galar") return "Galarian Mr. Mime";
  if (lowerName === "darmanitan-galar-zen") return "Galarian Darmanitan (Zen Mode)";
  if (lowerName === "greninja-ash") return "Ash-Greninja";
  if (lowerName === "basculin-white-striped") return "White-Striped Basculin";
  if (lowerName === "ursaluna-bloodmoon") return "Bloodmoon Ursaluna";

  // Standard Regional Forms
  if (lowerName.endsWith("-alola")) {
    const rootName = lowerName.replace("-alola", "");
    return `Alolan ${capitalize(rootName)}`;
  }
  if (lowerName.endsWith("-galar")) {
    const rootName = lowerName.replace("-galar", "");
    return `Galarian ${capitalize(rootName)}`;
  }
  if (lowerName.endsWith("-paldea")) {
    const rootName = lowerName.replace("-paldea", "");
    return `Paldean ${capitalize(rootName)}`;
  }
  if (lowerName.endsWith("-hisui")) {
    const rootName = lowerName.replace("-hisui", "");
    return `Hisuian ${capitalize(rootName)}`;
  }

  // Battle Gimmicks & Megas
  if (lowerName.includes("-mega")) {
    const suffix = lowerName.split("-mega")[1]?.replace(/^-/, "");
    const suffixFormatted = suffix ? ` ${capitalize(suffix)}` : "";
    return `Mega ${capBase}${suffixFormatted}`;
  }
  if (lowerName.includes("-gmax")) return `Gigantamax ${capBase}`;
  if (lowerName.includes("-primal")) return `Primal ${capBase}`;

  // Species fallback
  if (speciesName && lowerName.startsWith(base + "-")) {
    const formSuffix = lowerName.slice(base.length + 1);
    return `${capBase} (${capitalize(formSuffix)})`;
  }

  return capitalize(name);
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

function parseEvolutionDetails(detailsList) {
  if (!detailsList || detailsList.length === 0) return "";

  return detailsList
    .map((d) => {
      const parts = [];

      if (d.trigger?.name === "level-up") {
        if (d.min_level) parts.push(`Level ${d.min_level}`);
        if (d.min_happiness) parts.push(`High Friendship`);
        if (d.known_move) parts.push(`Knows ${formatPokemonName(d.known_move.name)}`);
        if (d.held_item) parts.push(`Hold ${formatPokemonName(d.held_item.name)}`);
        if (d.time_of_day) parts.push(`(${d.time_of_day})`);
        if (d.location) parts.push(`at ${formatPokemonName(d.location.name)}`);
        if (parts.length === 0) parts.push("Level up");
      } else if (d.trigger?.name === "use-item") {
        parts.push(d.item ? `Use ${formatPokemonName(d.item.name)}` : "Use item");
      } else if (d.trigger?.name === "trade") {
        parts.push(d.held_item ? `Trade holding ${formatPokemonName(d.held_item.name)}` : "Trade");
      } else if (d.trigger?.name === "shed") {
        parts.push("Open slot & Poké Ball");
      } else if (d.trigger?.name) {
        parts.push(formatPokemonName(d.trigger.name));
      }

      return parts.join(" ");
    })
    .filter(Boolean)
    .join(" / ");
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
  // Kanto
  venusaur: [{ name: "venusaur-mega", displayName: "Mega Venusaur", trigger: "Venusaurite", id: 10033 }],
  charizard: [
    { name: "charizard-mega-x", displayName: "Mega Charizard X", trigger: "Charizardite X", id: 10034 },
    { name: "charizard-mega-y", displayName: "Mega Charizard Y", trigger: "Charizardite Y", id: 10035 }
  ],
  blastoise: [{ name: "blastoise-mega", displayName: "Mega Blastoise", trigger: "Blastoisinite", id: 10036 }],
  beedrill: [{ name: "beedrill-mega", displayName: "Mega Beedrill", trigger: "Beedrillite", id: 10090 }],
  pidgeot: [{ name: "pidgeot-mega", displayName: "Mega Pidgeot", trigger: "Pidgeotite", id: 10073 }],
  clefable: [{ name: "clefable-mega", displayName: "Mega Clefable", trigger: "Clefablite", id: "clefable-mega" }],
  victreebel: [{ name: "victreebel-mega", displayName: "Mega Victreebel", trigger: "Victreebelite", id: "victreebel-mega" }],
  alakazam: [{ name: "alakazam-mega", displayName: "Mega Alakazam", trigger: "Alakazite", id: 10037 }],
  slowbro: [{ name: "slowbro-mega", displayName: "Mega Slowbro", trigger: "Slowbronite", id: 10071 }],
  gengar: [{ name: "gengar-mega", displayName: "Mega Gengar", trigger: "Gengarite", id: 10038 }],
  kangaskhan: [{ name: "kangaskhan-mega", displayName: "Mega Kangaskhan", trigger: "Kangaskhanite", id: 10039 }],
  starmie: [{ name: "starmie-mega", displayName: "Mega Starmie", trigger: "Starminite", id: "starmie-mega" }],
  pinsir: [{ name: "pinsir-mega", displayName: "Mega Pinsir", trigger: "Pinsirite", id: 10040 }],
  gyarados: [{ name: "gyarados-mega", displayName: "Mega Gyarados", trigger: "Gyaradosite", id: 10041 }],
  aerodactyl: [{ name: "aerodactyl-mega", displayName: "Mega Aerodactyl", trigger: "Aerodactylite", id: 10042 }],
  dragonite: [{ name: "dragonite-mega", displayName: "Mega Dragonite", trigger: "Dragonitite", id: "dragonite-mega" }],
  mewtwo: [
    { name: "mewtwo-mega-x", displayName: "Mega Mewtwo X", trigger: "Mewtwonite X", id: 10043 },
    { name: "mewtwo-mega-y", displayName: "Mega Mewtwo Y", trigger: "Mewtwonite Y", id: 10044 }
  ],

  // Johto
  meganium: [{ name: "meganium-mega", displayName: "Mega Meganium", trigger: "Meganiumite", id: "meganium-mega" }],
  feraligatr: [{ name: "feraligatr-mega", displayName: "Mega Feraligatr", trigger: "Feraligatrite", id: "feraligatr-mega" }],
  ampharos: [{ name: "ampharos-mega", displayName: "Mega Ampharos", trigger: "Ampharosite", id: 10045 }],
  steelix: [{ name: "steelix-mega", displayName: "Mega Steelix", trigger: "Steelixite", id: 10072 }],
  scizor: [{ name: "scizor-mega", displayName: "Mega Scizor", trigger: "Scizorite", id: 10046 }],
  heracross: [{ name: "heracross-mega", displayName: "Mega Heracross", trigger: "Heracronite", id: 10047 }],
  skarmory: [{ name: "skarmory-mega", displayName: "Mega Skarmory", trigger: "Skarmorite", id: "skarmory-mega" }],
  houndoom: [{ name: "houndoom-mega", displayName: "Mega Houndoom", trigger: "Houndoominite", id: 10048 }],
  tyranitar: [{ name: "tyranitar-mega", displayName: "Mega Tyranitar", trigger: "Tyranitarite", id: 10049 }],

  // Hoenn
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
  absol: [{ name: "absol-mega", displayName: "Mega Absol", trigger: "Absolite", id: 10057 }],
  glalie: [{ name: "glalie-mega", displayName: "Mega Glalie", trigger: "Glalitite", id: 10074 }],
  salamence: [{ name: "salamence-mega", displayName: "Mega Salamence", trigger: "Salamencite", id: 10089 }],
  metagross: [{ name: "metagross-mega", displayName: "Mega Metagross", trigger: "Metagrossite", id: 10076 }],
  latias: [{ name: "latias-mega", displayName: "Mega Latias", trigger: "Latiasite", id: 10062 }],
  latios: [{ name: "latios-mega", displayName: "Mega Latios", trigger: "Latiosite", id: 10063 }],
  kyogre: [{ name: "kyogre-primal", displayName: "Primal Kyogre", trigger: "Blue Orb Reversion", id: 10077 }],
  groudon: [{ name: "groudon-primal", displayName: "Primal Groudon", trigger: "Red Orb Reversion", id: 10078 }],
  rayquaza: [{ name: "rayquaza-mega", displayName: "Mega Rayquaza", trigger: "Knows Dragon Ascent", id: 10079 }],

  // Sinnoh
  lopunny: [{ name: "lopunny-mega", displayName: "Mega Lopunny", trigger: "Lopunnite", id: 10088 }],
  garchomp: [{ name: "garchomp-mega", displayName: "Mega Garchomp", trigger: "Garchompite", id: 10058 }],
  lucario: [{ name: "lucario-mega", displayName: "Mega Lucario", trigger: "Lucarionite", id: 10059 }],
  abomasnow: [{ name: "abomasnow-mega", displayName: "Mega Abomasnow", trigger: "Abomasite", id: 10060 }],
  gallade: [{ name: "gallade-mega", displayName: "Mega Gallade", trigger: "Galladite", id: 10068 }],
  froslass: [{ name: "froslass-mega", displayName: "Mega Froslass", trigger: "Froslassite", id: "froslass-mega" }],

  // Unova
  emboar: [{ name: "emboar-mega", displayName: "Mega Emboar", trigger: "Emboarite", id: "emboar-mega" }],
  excadrill: [{ name: "excadrill-mega", displayName: "Mega Excadrill", trigger: "Excadrillite", id: "excadrill-mega" }],
  scolipede: [{ name: "scolipede-mega", displayName: "Mega Scolipede", trigger: "Scolipedite", id: "scolipede-mega" }],
  audino: [{ name: "audino-mega", displayName: "Mega Audino", trigger: "Audinite", id: 10069 }],
  chandelure: [{ name: "chandelure-mega", displayName: "Mega Chandelure", trigger: "Chandelurite", id: "chandelure-mega" }],

  // Kalos
  chesnaught: [{ name: "chesnaught-mega", displayName: "Mega Chesnaught", trigger: "Chesnaughtite", id: "chesnaught-mega" }],
  delphox: [{ name: "delphox-mega", displayName: "Mega Delphox", trigger: "Delphoxite", id: "delphox-mega" }],
  greninja: [
    { name: "greninja-ash", displayName: "Ash-Greninja", trigger: "Battle Bond (Needs KO in battle)", id: 10117 },
    { name: "greninja-mega", displayName: "Mega Greninja", trigger: "Greninjite", id: "greninja-mega" }
  ],
  malamar: [{ name: "malamar-mega", displayName: "Mega Malamar", trigger: "Malamarite", id: "malamar-mega" }],
  barbaracle: [{ name: "barbaracle-mega", displayName: "Mega Barbaracle", trigger: "Barbaraclite", id: "barbaracle-mega" }],
  hawlucha: [{ name: "hawlucha-mega", displayName: "Mega Hawlucha", trigger: "Hawluchanite", id: "hawlucha-mega" }],
  diancie: [{ name: "diancie-mega", displayName: "Mega Diancie", trigger: "Diancite", id: 10075 }]
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
    { speciesName: "typhlosion-hisui", displayName: "Hisuian Typhlosion", id: 10237, requirement: "Level 36 in Hisui" }
  ],
  dewott: [
    { speciesName: "samurott-hisui", displayName: "Hisuian Samurott", id: 10236, requirement: "Level 36 in Hisui" }
  ],
  dartrix: [
    { speciesName: "decidueye-hisui", displayName: "Hisuian Decidueye", id: 10244, requirement: "Level 36 in Hisui" }
  ],
  petilil: [
    { speciesName: "lilligant-hisui", displayName: "Hisuian Lilligant", id: 10238, requirement: "Sun Stone in Hisui" }
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
  "zorua-hisui": [{ name: "zorua-hisui", id: 10239 }, { name: "zoroark-hisui", id: 10240, req: "Level 30" }],
  "zoroark-hisui": [{ name: "zorua-hisui", id: 10239 }, { name: "zoroark-hisui", id: 10240, req: "Level 30" }],
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
    customImage: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${current.id}.png`,
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
            customImage: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${sibling.id}.png`,
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

export function normalizePokemonData(rawData, speciesData = null, evolutionData = null) {
  const animatedImage =
    rawData.sprites?.other?.showdown?.front_default ||
    rawData.sprites?.versions?.["generation-v"]?.["black-white"]?.animated?.front_default;

  const officialArtwork =
    rawData.sprites?.other?.["official-artwork"]?.front_default ||
    rawData.sprites?.front_default;

  let description = "No Pokédex description available.";
  let genus = "";
  const flavorTextEntries = [];

  if (speciesData) {
    if (speciesData.flavor_text_entries) {
      speciesData.flavor_text_entries.forEach((entry) => {
        if (entry.language.name === "en") {
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

      if (flavorTextEntries.length > 0) {
        description = flavorTextEntries[flavorTextEntries.length - 1].flavorText;
      }
    }

    if (speciesData.genera) {
      const englishGenus = speciesData.genera.find((g) => g.language.name === "en");
      if (englishGenus) genus = englishGenus.genus;
    }
  }

  const speciesName = speciesData?.name || rawData.species?.name || "";

  const stats = {
    hp: rawData.stats?.find((s) => s.stat.name === "hp")?.base_stat || 0,
    attack: rawData.stats?.find((s) => s.stat.name === "attack")?.base_stat || 0,
    defense: rawData.stats?.find((s) => s.stat.name === "defense")?.base_stat || 0,
    spAtk: rawData.stats?.find((s) => s.stat.name === "special-attack")?.base_stat || 0,
    spDef: rawData.stats?.find((s) => s.stat.name === "special-defense")?.base_stat || 0,
    speed: rawData.stats?.find((s) => s.stat.name === "speed")?.base_stat || 0,
  };

  const statBounds = {
    hp: calculateStatBounds("hp", stats.hp),
    attack: calculateStatBounds("attack", stats.attack),
    defense: calculateStatBounds("defense", stats.defense),
    spAtk: calculateStatBounds("special-attack", stats.spAtk),
    spDef: calculateStatBounds("special-defense", stats.spDef),
    speed: calculateStatBounds("speed", stats.speed),
  };

  const evYieldList = [];
  rawData.stats?.forEach((s) => {
    if (s.effort > 0) {
      evYieldList.push(`${s.effort} ${formatPokemonName(s.stat.name)}`);
    }
  });

  const abilities = (rawData.abilities || []).map((a) => ({
    name: formatPokemonName(a.ability.name),
    rawName: a.ability.name,
    isHidden: a.is_hidden,
    slot: a.slot,
    url: a.ability.url,
  }));

  const heldItems = (rawData.held_items || []).map((h) => ({
    name: formatPokemonName(h.item.name),
    rarity: h.version_details?.[0]?.rarity || 5,
  }));

  const catchRate = speciesData?.capture_rate ?? null;
  const baseFriendship = speciesData?.base_happiness ?? null;
  const baseExp = rawData.base_experience ?? null;
  const growthRate = speciesData?.growth_rate?.name ? formatPokemonName(speciesData.growth_rate.name) : "Medium";
  const eggGroups = speciesData?.egg_groups?.map((g) => formatPokemonName(g.name)) || ["Undiscovered"];
  const genderRate = speciesData?.gender_rate ?? -1;
  const hatchCounter = speciesData?.hatch_counter ?? null;

  const varieties = (speciesData?.varieties || []).map((v) => {
    const vUrlParts = v.pokemon.url.split("/").filter(Boolean);
    const formId = vUrlParts[vUrlParts.length - 1];
    return {
      name: formatPokemonName(v.pokemon.name, speciesName),
      rawName: v.pokemon.name,
      id: formId,
      image: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${formId}.png`,
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
    stats,
    statBounds,
    cry: rawData.cries?.latest || rawData.cries?.legacy || null,
    description,
    flavorTextEntries,
    abilities,
    evYield: evYieldList.length > 0 ? evYieldList.join(", ") : "None",
    catchRate: catchRate !== null ? `${catchRate} (${Math.round((catchRate / 255) * 100)}% with PokéBall)` : "N/A",
    baseFriendship: baseFriendship !== null ? `${baseFriendship} (normal)` : "N/A",
    baseExp: baseExp ? `${baseExp}` : "N/A",
    growthRate,
    heldItems,
    eggGroups,
    genderRate,
    hatchCounter: hatchCounter !== null ? `${hatchCounter * 256} steps (${hatchCounter} cycles)` : "N/A",
    varieties,
    moves,
    evolutionTree: finalEvolutionTree,
  };
}

export async function fetchPokemon(nameOrId, signal = null) {
  try {
    const cleanQuery = String(nameOrId).toLowerCase().trim().replace(/\s+/g, "-");
    const response = await fetch(`${BASE_URL}/${cleanQuery}`, { signal });
    if (!response.ok) {
      throw new Error(`Pokémon "${nameOrId}" not found.`);
    }

    const rawData = await response.json();
    let speciesData = null;
    let evolutionData = null;

    try {
      const speciesIdentifier = rawData.species?.name || rawData.id;
      const speciesRes = await fetch(`${SPECIES_URL}/${speciesIdentifier}`, { signal });
      if (speciesRes.ok) {
        speciesData = await speciesRes.json();
        if (speciesData.evolution_chain?.url) {
          const evoRes = await fetch(speciesData.evolution_chain.url, { signal });
          if (evoRes.ok) {
            evolutionData = await evoRes.json();
          }
        }
      }
    } catch (e) {
      if (e.name === "AbortError") throw e;
      console.warn("Could not fetch species data:", e);
    }

    return normalizePokemonData(rawData, speciesData, evolutionData);
  } catch (error) {
    if (error.name === "AbortError") {
      throw error;
    }
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
          return validVarieties.map((rawData) => normalizePokemonData(rawData, speciesData));
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

export async function fetchPokemonBatch(items, startIndex, batchSize = 30, signal = null) {
  const slice = items.slice(startIndex, startIndex + batchSize);
  const promises = slice.map((item) => {
    const identifier = typeof item === "object" ? item.name : item;
    return fetchPokemon(identifier, signal).catch((err) => {
      if (err.name === "AbortError") throw err;
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

export function isItemInGenRange(pokemonItem, activeGen) {
  if (activeGen === "all") return true;
  const range = GEN_RANGES[activeGen];
  if (!range) return true;

  const id = typeof pokemonItem === "object" ? pokemonItem.id : Number(pokemonItem);
  if (id && id <= 1025) {
    return id >= range.start && id <= range.end;
  }

  const name = typeof pokemonItem === "object" ? pokemonItem.name : String(pokemonItem);
  const specialMatch = SPECIAL_FORM_REGISTRY.find((entry) => entry.name === name);
  if (specialMatch) {
    if (activeGen === "7" && specialMatch.tags.includes("alola")) return true;
    if (activeGen === "8" && (specialMatch.tags.includes("galar") || specialMatch.tags.includes("gmax"))) return true;
    if (activeGen === "9" && specialMatch.tags.includes("paldea")) return true;
    if (activeGen === "6" && specialMatch.tags.includes("mega")) return true;
  }

  return false;
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

export async function fetchFullPokedexDirectory() {
  try {
    const res = await fetch("https://pokeapi.co/api/v2/pokemon?limit=100000");
    const data = await res.json();

    const baseList = data.results.map((p) => {
      const urlParts = p.url.split("/").filter(Boolean);
      const pokeId = parseInt(urlParts[urlParts.length - 1], 10);
      return {
        id: pokeId,
        name: p.name,
        baseSpecies: p.name.split("-")[0].toLowerCase(),
        displayName: formatPokemonName(p.name),
        forms: [],
      };
    });

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