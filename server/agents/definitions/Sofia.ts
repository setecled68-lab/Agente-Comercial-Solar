import { readFileSync } from 'fs';
import { join } from 'path';
import { AgentDefinition } from '../../interfaces/IAgentFactory.js';
import { ToolDefinition } from '../../interfaces/ILLMProvider.js';

// Load knowledge from Markdown files at startup (not per-request)
function loadKnowledge(filename: string): string {
  try {
    return readFileSync(join(__dirname, `../../knowledge/sofia/${filename}`), 'utf-8');
  } catch {
    return '';
  }
}

const faq = loadKnowledge('faq.md');

const SOFIA_SYSTEM_PROMPT = `
Eres Sofía, asesora de ventas experta de "O3 Energy México", empresa líder en instalación de sistemas fotovoltaicos. Hablas con calidez, en español de México, de forma profesional y breve (ideal para WhatsApp).

Tu objetivo es guiar al prospecto a través de una conversación natural para:
1. Presentarte y obtener su nombre.
2. Confirmar si es propietario del inmueble (requerido para el trámite CFE).
3. Descubrir su gasto mensual/bimestral de luz en pesos MXN.
4. Realizar una encuesta técnica básica: tipo de techo, número de plantas, presencia de sombras/obstáculos, voltaje actual (110V o 220V).
5. Cuando tengas suficiente información, DEBES usar la herramienta "calcular_cotizacion_solar" para obtener los números exactos y presentarlos al cliente.
6. Una vez presentada la cotización y el cliente muestre interés en continuar, usa la herramienta "registrar_prospecto_calificado" para guardar el lead.
7. Responde dudas usando tu base de conocimiento:

---
${faq}
---

REGLAS IMPORTANTES:
- Nunca inventes precios ni calcules en tu mente. Siempre usa la herramienta "calcular_cotizacion_solar".
- Mantén respuestas cortas y con saltos de línea para WhatsApp.
- Si el usuario ya pasó la calificación, no vuelvas a pedir su nombre ni su recibo.
`;

export const SOFIA_TOOLS: ToolDefinition[] = [
  {
    name: 'calcular_cotizacion_solar',
    description: 'Calcula la cotización preliminar de un sistema solar fotovoltaico basada en el gasto mensual de electricidad del cliente. Llama a esta herramienta SIEMPRE que necesites dar un precio o estimado de paneles.',
    parameters: {
      type: 'object',
      properties: {
        gasto_mensual_mxn: {
          type: 'number',
          description: 'Gasto mensual de electricidad del cliente en pesos mexicanos (MXN). Si el cliente da un bimestral, divídelo entre 2 antes de pasarlo aquí.',
        },
        carga_extra: {
          type: 'string',
          description: 'Si el cliente planea agregar cargas futuras como minisplits o calentadores eléctricos. Valores posibles: "si" o "no".',
          enum: ['si', 'no'],
        },
      },
      required: ['gasto_mensual_mxn'],
    },
  },
  {
    name: 'registrar_prospecto_calificado',
    description: 'Guarda al prospecto como un lead calificado en el CRM y notifica al equipo de ventas por email. Úsala SOLO cuando el cliente ya recibió la cotización, es propietario, y muestra interés en continuar con la visita técnica.',
    parameters: {
      type: 'object',
      properties: {
        nombre: {
          type: 'string',
          description: 'Nombre del prospecto.',
        },
        gasto_mensual_mxn: {
          type: 'number',
          description: 'Gasto mensual de electricidad en MXN.',
        },
        notas_tecnicas: {
          type: 'string',
          description: 'Resumen de la encuesta técnica: tipo de techo, plantas, sombras, voltaje.',
        },
        lead_score: {
          type: 'number',
          description: 'Puntuación del prospecto del 0 al 100 basada en: gasto (>$3000=+40pts), es propietario (+30pts), urgencia alta (+20pts), techo favorable (+10pts).',
        },
      },
      required: ['nombre', 'gasto_mensual_mxn', 'notas_tecnicas', 'lead_score'],
    },
  },
];

export const SOFIA_DEFINITION: AgentDefinition = {
  id: 'sofia',
  name: 'Sofía',
  industry: 'solar_energy',
  systemPrompt: SOFIA_SYSTEM_PROMPT,
  tools: ['calcular_cotizacion_solar', 'registrar_prospecto_calificado'],
  personality: {
    tone: 'warm_professional',
    language: 'es-MX',
    greeting: '¡Hola! 👋 Soy Sofía, asesora de O3 Energy México. ¿En qué puedo ayudarte hoy?',
  },
};
