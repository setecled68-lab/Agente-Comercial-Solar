/**
 * LLMProvider.ts — Microservicio de IA con Fallback Automático
 * 
 * Arquitectura: Groq (primario) → Gemini (fallback)
 * Reglas: HRU (zero hardcoding), SSD (API keys solo en env vars), MCP (JSON estructurado)
 * 
 * Si GROQ_API_KEY está activa y sin cuota agotada → usa Groq (LLaMA 3.3 70B)
 * Si Groq falla por cualquier razón → intenta Gemini si GEMINI_API_KEY está disponible
 * Si ambos fallan → error descriptivo sin exponer keys
 */

export interface LLMMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface LLMResult {
  text: string;
  provider: 'groq' | 'gemini';
}

// ────────────────────────────────────────────────────────────────────────────────
// PROVIDER: GROQ (LLaMA 3.3 70B) — PRIMARIO
// ────────────────────────────────────────────────────────────────────────────────
async function callGroq(
  systemInstruction: string,
  messages: LLMMessage[],
  temperature = 0.7
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY no configurada en variables de entorno.');

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'openai/gpt-oss-120b',
      temperature,
      messages: [
        { role: 'system', content: systemInstruction },
        ...messages,
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.json() as any;
    throw new Error(`Groq error ${response.status}: ${err?.error?.message || response.statusText}`);
  }

  const data = await response.json() as any;
  return data.choices?.[0]?.message?.content ?? '';
}

// ────────────────────────────────────────────────────────────────────────────────
// PROVIDER: GEMINI (gemini-1.5-flash) — FALLBACK
// ────────────────────────────────────────────────────────────────────────────────
async function callGemini(
  systemInstruction: string,
  messages: LLMMessage[],
  temperature = 0.7
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY no configurada. Fallback no disponible.');

  const contents = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents,
        generationConfig: { temperature },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.json() as any;
    throw new Error(`Gemini error ${response.status}: ${err?.error?.message || response.statusText}`);
  }

  const data = await response.json() as any;
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

// ────────────────────────────────────────────────────────────────────────────────
// ORQUESTADOR PRINCIPAL — Groq primero, Gemini como red de seguridad
// ────────────────────────────────────────────────────────────────────────────────
export async function callLLM(
  systemInstruction: string,
  messages: LLMMessage[],
  temperature = 0.7
): Promise<LLMResult> {
  // Intento 1: Groq (proveedor principal del cliente)
  try {
    const text = await callGroq(systemInstruction, messages, temperature);
    console.log('[LLMProvider] ✅ Respuesta generada con Groq (LLaMA 3.3 70B)');
    return { text, provider: 'groq' };
  } catch (groqErr: any) {
    console.warn(`[LLMProvider] ⚠️ Groq falló: ${groqErr.message}. Intentando fallback a Gemini...`);
  }

  // Intento 2: Gemini (fallback por si el cliente reactiva la suscripción)
  try {
    const text = await callGemini(systemInstruction, messages, temperature);
    console.log('[LLMProvider] ✅ Respuesta generada con Gemini (fallback activado)');
    return { text, provider: 'gemini' };
  } catch (geminiErr: any) {
    console.error(`[LLMProvider] ❌ Ambos proveedores fallaron. Gemini: ${geminiErr.message}`);
    throw new Error(
      'El motor de IA no está disponible en este momento. Por favor verifica las API Keys en las variables de entorno del servidor.'
    );
  }
}
