// api/scan.js

import { CANONICAL_SPECIES } from "./_species.js";

let speciesCache = null;
const ipHits = new Map(); // In-memory rate limiting stub. In production, use Upstash / Vercel KV.

// Species aliases for common abbreviations, punctuation differences, or gender distinctions
const SPECIES_ALIASES = {
  "nidoran": "nidoran-m",
  "nidoran-f": "nidoran-f",
  "nidoran-m": "nidoran-m",
  "nidoran-female": "nidoran-f",
  "nidoran-male": "nidoran-m",
  "farfetchd": "farfetchd",
  "sirfetchd": "sirfetchd",
  "mr-mime": "mr-mime",
  "mime-jr": "mime-jr",
  "mr-rime": "mr-rime",
  "great-tusk": "great-tusk",
  "scream-tail": "scream-tail",
  "brute-bonnet": "brute-bonnet",
  "flutter-mane": "flutter-mane",
  "slither-wing": "slither-wing",
  "sandy-shocks": "sandy-shocks",
  "iron-treads": "iron-treads",
  "iron-bundle": "iron-bundle",
  "iron-hands": "iron-hands",
  "iron-jugulis": "iron-jugulis",
  "iron-moth": "iron-moth",
  "iron-thorns": "iron-thorns",
  "roaring-moon": "roaring-moon",
  "iron-valiant": "iron-valiant",
  "walking-wake": "walking-wake",
  "iron-leaves": "iron-leaves",
  "gouging-fire": "gouging-fire",
  "raging-bolt": "raging-bolt",
  "iron-boulder": "iron-boulder",
  "iron-crown": "iron-crown",
  "wo-chien": "wo-chien",
  "chien-pao": "chien-pao",
  "ting-lu": "ting-lu",
  "chi-yu": "chi-yu",
  "type-null": "type-null",
  "tapu-koko": "tapu-koko",
  "tapu-lele": "tapu-lele",
  "tapu-bulu": "tapu-bulu",
  "tapu-fini": "tapu-fini"
};

/**
 * Returns known Pokémon species names.
 * Immediately uses CANONICAL_SPECIES without cold-start blocking.
 * Lazily refreshes speciesCache in the background if newer species exist.
 */
async function getSpeciesNames() {
  if (speciesCache && speciesCache.size > 0) return speciesCache;

  // Use the canonical offline set immediately
  speciesCache = new Set(CANONICAL_SPECIES);

  // Background non-blocking fetch to catch any future PokeAPI updates
  fetch("https://pokeapi.co/api/v2/pokemon-species?limit=2000")
    .then(async (res) => {
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.results)) {
          data.results.forEach((r) => speciesCache.add(r.name.toLowerCase()));
        }
      }
    })
    .catch(() => {
      // Offline or network error: silently ignored since canonical set is already populated
    });

  return speciesCache;
}

export default async function handler(req, res) {
  if (req.method === "HEAD") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Security check: Origin / Referer validation
  const origin = req.headers.origin || req.headers.referer || "";
  const host = req.headers.host || "";
  const isDev =
    process.env.NODE_ENV !== "production" ||
    host.includes("localhost") ||
    host.includes("127.0.0.1") ||
    host.includes("0.0.0.0");

  if (!isDev) {
    if (!origin) {
      return res.status(403).json({ error: "Forbidden: Origin or Referer header required" });
    }
    const originHost = (origin.replace(/^https?:\/\//, "").split("/")[0] || "").split(":")[0];
    const expectedHost = host.split(":")[0];
    if (originHost !== expectedHost && !originHost.endsWith(".vercel.app")) {
      return res.status(403).json({ error: "Forbidden origin" });
    }
  } else {
    // In local dev, allow localhost/127.0.0.1, but reject external mismatches if an origin is provided
    if (
      origin &&
      host &&
      !origin.includes("localhost") &&
      !origin.includes("127.0.0.1") &&
      !origin.includes(host)
    ) {
      return res.status(403).json({ error: "Forbidden origin" });
    }
  }

  // Rate limiting (max 15 scans per minute per IP)
  const clientIp =
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    "local";
  const now = Date.now();
  const windowMs = 60 * 1000;

  // Prune expired IPs if cache grows large to prevent memory leaks
  if (ipHits.size > 500) {
    for (const [ip, timestamps] of ipHits.entries()) {
      const active = timestamps.filter((t) => now - t < windowMs);
      if (active.length === 0) {
        ipHits.delete(ip);
      } else {
        ipHits.set(ip, active);
      }
    }
  }

  const history = (ipHits.get(clientIp) || []).filter((time) => now - time < windowMs);
  if (history.length >= 15) {
    return res.status(429).json({ error: "Scan limit exceeded. Please wait a minute." });
  }
  history.push(now);
  ipHits.set(clientIp, history);

  try {
    const { image } = req.body || {};
    if (!image || typeof image !== "string") {
      return res.status(400).json({ error: "Valid base64 image data is required." });
    }

    // Payload size cap: max 1.5MB base64
    if (image.length > 1.5 * 1024 * 1024) {
      return res.status(413).json({ error: "Image exceeds 1.5MB limit." });
    }

    // Validate prefix
    const dataUrlMatch = image.match(/^data:image\/(jpeg|png|webp);base64,/);
    if (!dataUrlMatch) {
      return res.status(400).json({ error: "Image must be a valid JPEG, PNG, or WebP base64 data URL." });
    }

    const serpApiKey = process.env.SERPAPI_KEY;
    if (!serpApiKey) {
      return res.status(500).json({ error: "SERPAPI_KEY environment variable is missing." });
    }

    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
    const imageBuffer = Buffer.from(base64Data, "base64");

    // Upload to SerpApi
    const formData = new FormData();
    formData.append("image", new Blob([imageBuffer], { type: "image/jpeg" }), "scan.jpg");
    formData.append("api_key", serpApiKey);

    const uploadResponse = await fetch("https://serpapi.com/image", {
      method: "POST",
      body: formData,
    });

    if (!uploadResponse.ok) {
      throw new Error(`SerpApi image upload failed with status ${uploadResponse.status}`);
    }

    const uploadData = await uploadResponse.json();
    const imageId = uploadData.image_id;
    if (!imageId) {
      throw new Error("Failed to obtain image_id from SerpApi.");
    }

    // Search Google Lens
    const lensUrl = `https://serpapi.com/search.json?engine=google_lens&image_id=${encodeURIComponent(
      imageId
    )}&hl=en&api_key=${serpApiKey}`;

    const lensResponse = await fetch(lensUrl);
    if (!lensResponse.ok) {
      throw new Error(`Google Lens search failed with status ${lensResponse.status}`);
    }

    const lensData = await lensResponse.json();
    const candidateTexts = [];

    if (lensData.knowledge_graph?.title) {
      candidateTexts.push(lensData.knowledge_graph.title);
    }
    if (Array.isArray(lensData.visual_matches)) {
      lensData.visual_matches.slice(0, 12).forEach((item) => {
        if (item.title) candidateTexts.push(item.title);
      });
    }

    const knownSpecies = await getSpeciesNames();
    const stopWords = new Set([
      "pokemon", "the", "card", "plush", "plushie", "figure", "toy", "gx", "ex",
      "vmax", "vstar", "tcg", "holo", "rare", "ultra", "shiny", "edition", "series",
      "nintendo", "game", "freak", "scarlet", "violet", "sword", "shield", "pocket",
      "monsters", "japan", "japanese", "english", "mint", "graded", "promo"
    ]);

    let detectedPokemon = null;

    // Scan n-grams (2-word phrases like "mr mime" or "iron valiant", then single words)
    for (const text of candidateTexts) {
      const words = text
        .toLowerCase()
        .replace(/♀/g, " female")
        .replace(/♂/g, " male")
        .replace(/[^a-z0-9\s-]/g, "")
        .split(/\s+/)
        .filter((w) => w && !stopWords.has(w) && !/^\d+$/.test(w)); // Ignore purely numeric tokens

      // 2-word n-grams
      for (let i = 0; i < words.length - 1; i++) {
        const biGram = `${words[i]}-${words[i + 1]}`;
        const matched = SPECIES_ALIASES[biGram] || (knownSpecies.has(biGram) ? biGram : null);
        if (matched) {
          detectedPokemon = matched;
          break;
        }
      }
      if (detectedPokemon) break;

      // 1-word tokens
      for (const word of words) {
        if (word.length > 2) {
          const matched = SPECIES_ALIASES[word] || (knownSpecies.has(word) ? word : null);
          if (matched) {
            detectedPokemon = matched;
            break;
          }
        }
      }
      if (detectedPokemon) break;
    }

    if (!detectedPokemon) {
      return res.status(200).json({ pokemon: "none" });
    }

    return res.status(200).json({ pokemon: detectedPokemon });
  } catch (error) {
    console.error("Reverse Image Search Error:", error);
    return res.status(500).json({ error: error.message || "Reverse Image Search failed" });
  }
}
