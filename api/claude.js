// Vercel serverless function: the only place the Anthropic key lives.
// Vercel > Settings > Environment Variables:
//   ANTHROPIC_API_KEY  required
//   ACCESS_CODE        recommended (the code you give family and friends)
//   ANTHROPIC_MODEL    optional, defaults to claude-sonnet-5-5

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
const hits = new Map(); // best-effort rate limit per IP

function limited(ip) {
  const now = Date.now(), win = 60 * 60 * 1000, max = 60;
  const arr = (hits.get(ip) || []).filter((t) => now - t < win);
  arr.push(now); hits.set(ip, arr);
  return arr.length > max;
}

function parseJson(text) {
  const clean = text.replace(/\x60\x60\x60json\s*|\x60\x60\x60/g, "").trim();
  try { return JSON.parse(clean); } catch (_) {}
  const a = clean.indexOf("{"), b = clean.lastIndexOf("}");
  if (a >= 0 && b > a) return JSON.parse(clean.slice(a, b + 1));
  throw new Error("La respuesta no vino en formato JSON");
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Solo POST" });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: "Falta ANTHROPIC_API_KEY en Vercel" });
  if (process.env.ACCESS_CODE && req.headers["x-access-code"] !== process.env.ACCESS_CODE) {
    return res.status(401).json({ error: "Codigo de acceso invalido" });
  }
  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "x";
  if (limited(ip)) return res.status(429).json({ error: "Demasiadas solicitudes. Espera un rato." });

  const body = req.body || {};
  const prompt = body.prompt, json = body.json;
  if (typeof prompt !== "string" || !prompt.trim() || prompt.length > 20000) {
    return res.status(400).json({ error: "Texto vacio o demasiado largo" });
  }

  try {
    const payload = { model: MODEL, max_tokens: 4000, messages: [{ role: "user", content: prompt }] };
    if (json) payload.system = "Responde unicamente con JSON valido, sin texto adicional ni bloques de codigo.";
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      const detail = await r.text();
      return res.status(502).json({ error: "Anthropic " + r.status + ": " + detail.slice(0, 180) });
    }
    const data = await r.json();
    const text = (data.content || []).map((b) => b.text || "").join("");
    return res.status(200).json(json ? { data: parseJson(text) } : { text: text });
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
};
