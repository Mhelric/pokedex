// api/scan.js

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { image } = req.body;
  if (!image) {
    return res.status(400).json({ error: 'Image data is required' });
  }

  const serpApiKey = process.env.SERPAPI_KEY;
  if (!serpApiKey) {
    return res.status(500).json({ error: 'SERPAPI_KEY environment variable is missing.' });
  }

  try {
    // 1. Convert base64 data URL into binary Buffer
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');

    // 2. Upload image to SerpApi's upload service to obtain an image_id
    const formData = new FormData();
    formData.append('image', new Blob([imageBuffer], { type: 'image/jpeg' }), 'scan.jpg');
    formData.append('api_key', serpApiKey);

    const uploadRes = await fetch('https://serpapi.com/image', {
      method: 'POST',
      body: formData,
    });

    if (!uploadRes.ok) {
      throw new Error(`SerpApi image upload failed with status ${uploadRes.status}`);
    }

    const uploadData = await uploadRes.json();
    const imageId = uploadData.image_id;

    if (!imageId) {
      throw new Error('Could not obtain an image_id from SerpApi upload.');
    }

    // 3. Search Google Lens via SerpApi
    const lensUrl = `https://serpapi.com/search.json?engine=google_lens&image_id=${encodeURIComponent(
      imageId
    )}&hl=en&api_key=${serpApiKey}`;

    const lensRes = await fetch(lensUrl);
    if (!lensRes.ok) {
      throw new Error(`Google Lens search failed with status ${lensRes.status}`);
    }

    const lensData = await lensRes.json();

    // 4. Collect textual candidates from Knowledge Graph and Visual Matches
    const candidateTexts = [];

    if (lensData.knowledge_graph?.title) {
      candidateTexts.push(lensData.knowledge_graph.title);
    }

    if (Array.isArray(lensData.visual_matches)) {
      lensData.visual_matches.slice(0, 10).forEach((item) => {
        if (item.title) candidateTexts.push(item.title);
      });
    }

    // 5. Filter common boilerplate words and count keyword frequency
    const stopWords = new Set([
      'pokemon', 'the', 'card', 'plush', 'plushie', 'figure', 'toy', 'gx', 'ex',
      'vmax', 'vstar', 'tcg', 'holo', 'rare', 'ultra', 'shiny', 'edition', 'series',
      'nintendo', 'game', 'freak', 'scarlet', 'violet', 'sword', 'shield'
    ]);

    const wordCounts = {};
    candidateTexts.forEach((text) => {
      const words = text
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .split(/\s+/);

      words.forEach((w) => {
        if (w.length > 2 && !stopWords.has(w)) {
          wordCounts[w] = (wordCounts[w] || 0) + 1;
        }
      });
    });

    // Sort keywords from most frequent to least frequent
    const sortedWords = Object.keys(wordCounts).sort((a, b) => wordCounts[b] - wordCounts[a]);

    // 6. Verify top keywords against PokéAPI
    let detectedPokemon = null;

    for (const word of sortedWords.slice(0, 6)) {
      try {
        const pokeCheck = await fetch(`https://pokeapi.co/api/v2/pokemon/${word}`);
        if (pokeCheck.ok) {
          detectedPokemon = word;
          break;
        }
      } catch (err) {
        // Continue checking next candidate
      }
    }

    if (!detectedPokemon) {
      return res.status(200).json({ pokemon: 'none' });
    }

    return res.status(200).json({ pokemon: detectedPokemon });
  } catch (error) {
    console.error('Reverse Image Search Error:', error);
    return res.status(500).json({ error: error.message || 'Reverse search processing failed' });
  }
}