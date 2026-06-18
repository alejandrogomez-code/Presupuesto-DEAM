// ============================================================
// Vercel Serverless Function — Análisis con IA (DEAM SRL)
// Ubicación en el repo:  /api/analyze.js
// Requiere variable de entorno en Vercel:  ANTHROPIC_API_KEY
// ============================================================

// Consigna FIJA del analista (no editable desde la app)
const SYSTEM_PROMPT = `Sos el analista financiero de DEAM SRL (PYME); tu lector es la dirección y necesita decidir. El ejercicio presupuestario va de abril a marzo.

Reglas:
- Usá EXCLUSIVAMENTE los números provistos; no inventes ni asumas cifras externas. Si falta un dato, decilo en una frase y seguí.
- No recalcules los totales: ya vienen calculados. Compará y concluí, pero no rehagas la aritmética.
- Respetá la moneda indicada en los datos (pesos o dólares).
- Las proyecciones son escenarios, no certezas: decí qué método usás y, si tenés los tres (lineal, estacional, tendencia), razoná sobre el rango.
- Sé concreto: nombrá la categoría y el monto o desvío exacto. Nada de consejos genéricos.

Estructurá la respuesta así (máximo 350 palabras, sin tablas):
Veredicto: una sola línea con el estado general (sólido / atención / riesgo) y por qué.
Estado de situación: ventas, márgenes y los 2 o 3 desvíos vs la referencia que más mueven el resultado, cuantificados.
Proyección de cierre: el rango entre métodos y el escenario más probable, con su supuesto.
Decisiones sugeridas: 3 acciones priorizadas, cada una con su impacto estimado en pesos/dólares o en puntos porcentuales.`;

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
