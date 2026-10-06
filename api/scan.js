// api/scan.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { image } = req.body;
  if (!image) {
    return res.status(400).json({ error: 'Image data is required' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY environment variable is missing.' });
  }

  const base64Data = image.replace(/^data:image\/\w+;base64,/, '');

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  inline_data: {
                    mime_type: 'image/jpeg',
                    data: base64Data,
                  },
                },
                {
                  text: 'Identify the Pokémon in this image. Respond ONLY with the single lowercase English name of the Pokémon (e.g., pikachu, charizard, bulbasaur). Do not include punctuation, extra words, or explanations. If no Pokémon is present, respond with "none".',
                },
              ],
            },
          ],
        }),
      }
    );

    const data = await response.json();
    const resultText =
      data.candidates?.[0]?.content?.parts?.[0]?.text?.trim().toLowerCase() || 'none';
    const cleanPokemonName = resultText.replace(/[^a-z0-9-]/g, '');

    return res.status(200).json({ pokemon: cleanPokemonName });
  } catch (error) {
    console.error('Gemini Vision API Error:', error);
    return res.status(500).json({ error: 'Failed to analyze image with Gemini Vision AI.' });
  }
}