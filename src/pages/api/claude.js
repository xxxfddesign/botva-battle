export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { role, system, userMessage } = req.body;
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "GROQ_API_KEY не задан в Vercel → Settings → Environment Variables"
    });
  }

  // Модели: судья использует более умную модель для точного JSON
  const model = role === "judge"
    ? "llama-3.3-70b-versatile"
    : "llama-3.3-70b-versatile";

  // Для судьи включаем JSON mode — гарантирует валидный JSON!
  const extraParams = role === "judge"
    ? { response_format: { type: "json_object" } }
    : {};

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: role === "judge" ? 400 : 300,
        messages: [
          { role: "system", content: system },
          { role: "user", content: userMessage },
        ],
        ...extraParams,
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
