// ============================================================
// Vercel Serverless Function — Análisis con IA (DEAM SRL)
// Ubicación en el repo:  /api/analyze.js
// Requiere variable de entorno en Vercel:  ANTHROPIC_API_KEY
// ============================================================

// Consigna FIJA del analista (no editable desde la app)
const SYSTEM_PROMPT = `Sos un analista financiero senior de la empresa DEAM SRL.
Trabajás sobre un presupuesto de egresos cuyo ejercicio va de abril a marzo.
Con los datos que te paso (siempre numéricos y ya calculados), redactá un análisis
profesional, claro y conciso en español rioplatense, sin inventar datos que no estén.

Estructurá la respuesta exactamente con estos títulos:
Estado de situación: 3-5 frases sobre ventas, márgenes, utilidades y los desvíos más relevantes vs la referencia.
Proyección a corto plazo: qué se espera en los próximos meses según el ritmo actual (run-rate).
Proyección a mediano plazo: cómo cerraría el ejercicio si se mantiene la tendencia.
Riesgos y recomendaciones: 3 a 5 puntos accionables y concretos.

Usá montos en pesos cuando ayude, sé directo, no más de 380 palabras y no uses tablas.`;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Método no permitido" });
    return;
  }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    res.status(500).json({ error: "Falta la variable ANTHROPIC_API_KEY en Vercel." });
    return;
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const data = (body.data || "").toString().slice(0, 8000);

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1200,
        system: SYSTEM_PROMPT,
        messages: [
          { role: "user", content: `Datos del ejercicio:\n${data}\n\nGenerá el análisis siguiendo la estructura indicada.` },
        ],
      }),
    });

    const j = await r.json();
    if (!r.ok) {
      res.status(r.status).json({ error: j?.error?.message || "Error de la API de IA." });
      return;
    }
    const text = (j.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    res.status(200).json({ text });
  } catch (e) {
    res.status(500).json({ error: "Error procesando la solicitud: " + String(e) });
  }
}
