import { ILLMProvider, LLMMessage, ToolDefinition } from '../../interfaces/ILLMProvider.js';
import { IQuoteEngine } from '../../interfaces/IQuoteEngine.js';
import { ILeadRepository } from '../../domain/repositories/ILeadRepository.js';
import { IConversationRepository } from '../../domain/repositories/IConversationRepository.js';
import { Conversation } from '../../domain/entities/Conversation.js';
import { Lead } from '../../domain/entities/Lead.js';
import { LeadScore, Money } from '../../domain/value_objects/index.js';
import { AgentDefinition } from '../../interfaces/IAgentFactory.js';
import { logger } from '../../shared/logger/ConsoleLogger.js';
import { AppConfig } from '../../shared/config/AppConfig.js';
import nodemailer from 'nodemailer';

const MAX_TOOL_ROUNDS = 5; // Prevent infinite tool loops

export class LLMOrchestrator {
  constructor(
    private llm: ILLMProvider,
    private quoteEngine: IQuoteEngine,
    private leadRepo: ILeadRepository,
    private convRepo: IConversationRepository,
  ) {}

  async run(
    agent: AgentDefinition,
    conversation: Conversation,
    userText: string,
  ): Promise<{ replyText: string; updatedConversation: Conversation; leadGenerated: boolean }> {
    // 1. Add user message
    const userMsg = { sender: 'user' as const, text: userText, timestamp: new Date().toISOString() };
    conversation.messages.push(userMsg);

    // 2. Build LLM message history (keep last 20 to control token usage)
    const history: LLMMessage[] = conversation.messages.slice(-20).map((m) => ({
      role: m.sender === 'user' ? 'user' : 'assistant',
      content: m.text,
    }));

    const messages: LLMMessage[] = [
      { role: 'system', content: agent.systemPrompt },
      ...history,
    ];

    let leadGenerated = false;
    let finalText = '';

    // 3. Agentic loop — keep calling until LLM finishes or tool limit reached
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await this.llm.complete(messages, this._buildTools(), AppConfig.groq.temperature);

      if (response.finishReason === 'stop') {
        finalText = response.text || '';
        break;
      }

      if (response.finishReason === 'tool_calls') {
        // Add assistant "intent" to messages
        messages.push({
          role: 'assistant',
          content: JSON.stringify({ tool_calls: response.toolCalls }),
        });

        // Execute each tool call
        for (const toolCall of response.toolCalls) {
          logger.info(`[LLMOrchestrator] Tool called: ${toolCall.name}`, toolCall.arguments);
          const toolResult = await this._executeTool(toolCall.name, toolCall.arguments, conversation);

          if (toolCall.name === 'registrar_prospecto_calificado') {
            leadGenerated = true;
            await this._saveLeadAndNotify(toolCall.arguments as any, conversation);
          }

          messages.push({
            role: 'tool',
            name: toolCall.name,
            tool_call_id: toolCall.id,
            content: JSON.stringify(toolResult),
          });
        }
        continue;
      }
    }

    if (!finalText) {
      finalText = 'Tuve un problema técnico. Un asesor de O3 Energy te contactará pronto. 🙏';
    }

    // 4. Save bot reply to conversation
    conversation.messages.push({ sender: 'bot', text: finalText, timestamp: new Date().toISOString() });
    conversation.lastMessageAt = new Date().toISOString();
    if (leadGenerated) conversation.state.phase = 'LEAD_GENERATED';

    return { replyText: finalText, updatedConversation: conversation, leadGenerated };
  }

  // ─── Tool Definitions exposed to Groq ─────────────────────────────────────
  private _buildTools(): ToolDefinition[] {
    return [
      {
        name: 'calcular_cotizacion_solar',
        description: 'Calcula la cotización preliminar de un sistema solar. SIEMPRE usa esta herramienta para dar precios, nunca calcules tú mismo.',
        parameters: {
          type: 'object',
          properties: {
            gasto_mensual_mxn: { type: 'number', description: 'Gasto mensual de electricidad en pesos MXN.' },
            carga_extra: { type: 'string', description: 'Si planea agregar cargas futuras.', enum: ['si', 'no'] },
          },
          required: ['gasto_mensual_mxn'],
        },
      },
      {
        name: 'registrar_prospecto_calificado',
        description: 'Guarda al prospecto en el CRM. Úsala SOLO cuando el cliente ya recibió la cotización y quiere continuar.',
        parameters: {
          type: 'object',
          properties: {
            nombre: { type: 'string', description: 'Nombre del prospecto.' },
            gasto_mensual_mxn: { type: 'number', description: 'Gasto mensual en MXN.' },
            notas_tecnicas: { type: 'string', description: 'Resumen del techo, plantas, sombras, voltaje.' },
            lead_score: { type: 'number', description: 'Puntuación 0-100.' },
          },
          required: ['nombre', 'gasto_mensual_mxn', 'notas_tecnicas', 'lead_score'],
        },
      },
    ];
  }

  // ─── Tool Executor ─────────────────────────────────────────────────────────
  private async _executeTool(name: string, args: Record<string, unknown>, conv: Conversation): Promise<unknown> {
    if (name === 'calcular_cotizacion_solar') {
      const monthly = args.gasto_mensual_mxn as number;
      const extraLoad = args.carga_extra === 'si';
      const quote = this.quoteEngine.calculate(monthly, extraLoad);
      // Update ConversationState with quote data
      conv.state.monthlyBill = monthly;
      conv.state.phase = 'QUOTATION';
      conv.montoRecibo = new Money(monthly).format();
      conv.sistemaEstimado = quote.systemDescription;
      conv.costoEstimado = quote.costFormatted;
      return quote;
    }

    if (name === 'registrar_prospecto_calificado') {
      const score = new LeadScore(args.lead_score as number);
      conv.state.leadScore = score.value;
      conv.state.phase = 'LEAD_GENERATED';
      return { status: 'ok', message: 'Prospecto registrado exitosamente.' };
    }

    return { error: `Unknown tool: ${name}` };
  }

  // ─── Lead Persistence + Email ─────────────────────────────────────────────
  private async _saveLeadAndNotify(args: any, conv: Conversation): Promise<void> {
    const monthly = args.gasto_mensual_mxn as number;
    const quote = this.quoteEngine.calculate(monthly, false);
    const score = new LeadScore(args.lead_score ?? 50);

    const lead: Lead = {
      id: `lead_${conv.tenantId}_${conv.phone}`,
      tenantId: conv.tenantId,
      phone: conv.phone,
      nombre: args.nombre || conv.nombre,
      montoRecibo: new Money(monthly).format(),
      sistemaEstimado: quote.systemDescription,
      costoEstimado: quote.costFormatted,
      roiAnios: `${quote.roiYears} años`,
      leadScore: score.value,
      notasTecnicas: args.notas_tecnicas,
      status: 'pending_review',
      createdAt: new Date().toISOString(),
    };

    await this.leadRepo.save(lead);
    logger.info('[LLMOrchestrator] Lead saved', { leadId: lead.id, score: score.value, label: score.label });
    await this._sendEmailAlert(lead);
  }

  private async _sendEmailAlert(lead: Lead): Promise<void> {
    const cfg = AppConfig.smtp;
    if (!cfg.pass) {
      logger.info('[LLMOrchestrator] SMTP not configured — skipping email alert', { leadId: lead.id });
      return;
    }
    try {
      const t = nodemailer.createTransport({
        host: cfg.server, port: cfg.port, secure: cfg.port === 465,
        auth: { user: cfg.user, pass: cfg.pass },
      });
      await t.sendMail({
        from: `"Alertas O3 Energy AI" <${cfg.user}>`,
        to: cfg.salesEmail,
        subject: `🔥 Lead #${lead.leadScore}/100 — ${lead.nombre} | ${lead.montoRecibo}/mes`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:auto;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden">
            <div style="background:#ea580c;color:white;padding:24px;text-align:center">
              <h1 style="margin:0">🔥 ¡Nuevo Lead Calificado!</h1>
              <p style="margin:4px 0 0;opacity:.9">Score: ${lead.leadScore}/100 — ${lead.leadScore >= 70 ? 'CALIENTE 🔥' : 'TIBIO ⚠️'}</p>
            </div>
            <div style="padding:24px;color:#334155">
              <table style="width:100%;border-collapse:collapse">
                <tr><td style="padding:8px 0;font-weight:bold;color:#64748b">Nombre:</td><td>${lead.nombre}</td></tr>
                <tr><td style="padding:8px 0;font-weight:bold;color:#64748b">WhatsApp:</td><td>+${lead.phone}</td></tr>
                <tr><td style="padding:8px 0;font-weight:bold;color:#64748b">Gasto CFE:</td><td style="color:#ea580c;font-weight:bold">${lead.montoRecibo}/mes</td></tr>
                <tr><td style="padding:8px 0;font-weight:bold;color:#64748b">Sistema:</td><td>${lead.sistemaEstimado}</td></tr>
                <tr><td style="padding:8px 0;font-weight:bold;color:#64748b">Costo est.:</td><td style="color:#ea580c;font-weight:bold">${lead.costoEstimado}</td></tr>
                <tr><td style="padding:8px 0;font-weight:bold;color:#64748b">ROI:</td><td>${lead.roiAnios}</td></tr>
                <tr><td style="padding:8px 0;font-weight:bold;color:#64748b">Notas técnicas:</td><td>${lead.notasTecnicas}</td></tr>
              </table>
              <div style="text-align:center;margin-top:24px">
                <a href="https://wa.me/${lead.phone}" style="background:#ea580c;color:white;padding:12px 24px;border-radius:12px;text-decoration:none;font-weight:bold">💬 Atender en WhatsApp</a>
              </div>
            </div>
          </div>`,
      });
      logger.info('[LLMOrchestrator] Email alert sent', { to: cfg.salesEmail });
    } catch (err: any) {
      logger.error('[LLMOrchestrator] Email send failed', { error: err.message });
    }
  }
}
