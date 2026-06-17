// API route for Groq (Логос + Эмоция) and Google Gemini (Судья)
// Groq: https://console.groq.com — free, no card
// Gemini: https://aistudio.google.com — free, Google account

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { role, system, userMessage } = req.body;

  // Judge uses Gemini, debaters use Groq
  if (role === "judge") {
    return handleGemini(req, res, system, userMessage);
  } else {
    return handleGroq(req, res, system, userMessage);
  }
}

// ── Groq (Логос и Эмоция) ─────────────────────────────────────────────────
async function handleGroq(req, res, system, userMessage) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "GROQ_API_KEY не задан. Получи бесплатно на console.groq.com и добавь в Vercel → Settings → Environment Variables"
    });
  }

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: 300,
        messages: [
          { role: "system", content: system },
          { role: "user", content: userMessage },
        ],
      }),
    });
    const data = await response.json();
    if (data.error) return res.status(400).json({ error: data.error.message });
    const text = data.choices?.[0]?.message?.content || "";
    return res.status(200).json({ text });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// ── Google Gemini (Судья) ──────────────────────────────────────────────────
async function handleGemini(req, res, system, userMessage) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // Fallback: use Groq as judge too if no Gemini key
    return handleGroq(req, res, system, userMessage);
  }

  try {
    const prompt = `${system}\n\nЗадача: ${userMessage}`;
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 400 },
        }),
      }
    );
    const data = await response.json();
    if (data.error) return res.status(400).json({ error: data.error.message });
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    return res.status(200).json({ text });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
