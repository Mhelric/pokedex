// api/scan.js

let speciesCache = null;
const ipHits = new Map(); // In-memory rate limiting stub. In production, use Upstash / Vercel KV.

async function getSpeciesNames() {
  if (speciesCache) return speciesCache;
  try {
    const res = await fetch("https://pokeapi.co/api/v2/pokemon-species?limit=2000");
    if (res.ok) {
      const data = await res.json();
      speciesCache = new Set(data.results.map((r) => r.name.toLowerCase()));
      return speciesCache;
    }
  } catch (err) {
    console.warn("Failed to precache species list:", err);
  }
  return new Set();
}

export default async function handler(req, res) {
  if (req.method === "HEAD") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Security check: Origin / Referer
  const origin = req.headers.origin || req.headers.referer || "";
  const host = req.headers.host || "";
  if (origin && host && !origin.includes(host) && !origin.includes("localhost")) {
    return res.status(403).json({ error: "Forbidden origin" });
  }

  // Rate limiting (max 15 scans per minute per IP)
  const clientIp = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket.remoteAddress || "local";
  const now = Date.now();
  const windowMs = 60 * 1000;
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
      "nintendo", "game", "freak", "scarlet", "violet", "sword", "shield"
    ]);

    let detectedPokemon = null;

    // Scan n-grams (2-word phrases like "mr mime" or "iron valiant", then single words)
    for (const text of candidateTexts) {
      const words = text
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .split(/\s+/)
        .filter((w) => w && !stopWords.has(w) && !/^\d+$/.test(w)); // Ignore purely numeric tokens

      // 2-word n-grams
      for (let i = 0; i < words.length - 1; i++) {
        const biGram = `${words[i]}-${words[i + 1]}`;
        if (knownSpecies.has(biGram)) {
          detectedPokemon = biGram;
          break;
        }
      }
      if (detectedPokemon) break;

      // 1-word tokens
      for (const word of words) {
        if (word.length > 2 && knownSpecies.has(word)) {
          detectedPokemon = word;
          break;
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