/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import nodemailer from 'nodemailer';
import fs from 'fs';
import firebaseConfig from './firebase-applet-config.json';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- FIREBASE ADMINISTRATION INITIALIZATION ---
let db: any = null;
let isInMemory = false;

// Fallback in-memory DB in case Firestore experiences configuration or local preview restrictions
const inMemoryChats: Record<string, any> = {};
const inMemoryLeads: Record<string, any> = {};

try {
  const serviceAccountPath = path.join(process.cwd(), 'firebase-service-account.json');
  const hasServiceAccount = fs.existsSync(serviceAccountPath);
  const hasEnvCredentials = !!process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (hasServiceAccount || hasEnvCredentials) {
    if (hasServiceAccount) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccountPath),
        projectId: firebaseConfig.projectId,
      });
      console.log('Firebase Admin SDK initialized using firebase-service-account.json');
    } else {
      admin.initializeApp({
        projectId: firebaseConfig.projectId,
      });
      console.log('Firebase Admin SDK initialized using GOOGLE_APPLICATION_CREDENTIALS');
    }
    
    // Connect to the specific database ID or fall back to standard
    const dbId = firebaseConfig.firestoreDatabaseId;
    db = dbId && dbId !== '(default)'
      ? getFirestore(dbId)
      : getFirestore();
    
    console.log(`Firebase Admin SDK connected successfully. Database ID: ${dbId || '(default)'}`);
  } else {
    console.warn('No Firebase credentials found (firebase-service-account.json or GOOGLE_APPLICATION_CREDENTIALS missing). Falling back to in-memory mode.');
    isInMemory = true;
  }
} catch (error) {
  console.warn('Firebase Admin SDK failed to initialize. Falling back to in-memory mode:', error);
  isInMemory = true;
}

// Helper to access chats collection
async function getChatDoc(phone: string): Promise<any> {
  if (isInMemory) {
    if (!inMemoryChats[phone]) {
      inMemoryChats[phone] = {
        id: phone,
        phone,
        nombre: 'Cliente',
        bot_disabled: false,
        messages: [],
        last_message_at: new Date().toISOString(),
      };
    }
    return inMemoryChats[phone];
  } else {
    const docRef = db.collection('chats').doc(phone);
    const doc = await docRef.get();
    if (!doc.exists) {
      const newChat = {
        phone,
        nombre: 'Cliente',
        bot_disabled: false,
        messages: [],
        last_message_at: new Date().toISOString(),
      };
      await docRef.set(newChat);
      return { id: phone, ...newChat };
    }
    return { id: doc.id, ...doc.data() };
  }
}

async function updateChatDoc(phone: string, data: any): Promise<void> {
  if (isInMemory) {
    inMemoryChats[phone] = { ...inMemoryChats[phone], ...data };
  } else {
    await db.collection('chats').doc(phone).set(data, { merge: true });
  }
}

async function createQualifiedLead(lead: any): Promise<void> {
  const leadId = lead.id || `lead_${Date.now()}`;
  if (isInMemory) {
    inMemoryLeads[leadId] = {
      ...lead,
      id: leadId,
      status: 'pending_review',
      created_at: new Date().toISOString(),
    };
  } else {
    await db.collection('qualified_leads').doc(leadId).set({
      ...lead,
      status: 'pending_review',
      created_at: new Date().toISOString(),
    });
  }
}

async function sendSalesEmailNotification(lead: any, phone: string): Promise<boolean> {
  const senderEmail = process.env.SENDER_EMAIL || 'alertas@o3energy.mx';
  const senderPassword = process.env.SENDER_PASSWORD;
  const salesEmail = process.env.SALES_EMAIL || 'ventas@o3energy.mx';
  const smtpServer = process.env.SMTP_SERVER || 'smtp.gmail.com';
  const smtpPort = parseInt(process.env.SMTP_PORT || '587');

  const subject = `🔥 Nuevo Lead Calificado: ${lead.nombre || 'Cliente'} (${lead.monto_recibo || 'Sin monto'})`;
  const bodyHtml = `
    <div style="font-family: sans-serif; max-width: 600px; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); margin: 0 auto;">
      <div style="background-color: #ea580c; color: white; padding: 24px; text-align: center;">
        <h1 style="margin: 0; font-size: 20px;">🔥 ¡Nuevo Lead Calificado Detectado!</h1>
        <p style="margin: 4px 0 0 0; font-size: 14px; opacity: 0.9;">O3 Energy Sales Automation AI</p>
      </div>
      <div style="padding: 24px; color: #334155;">
        <p>Se ha calificado de forma totalmente autónoma un nuevo interesado en sistemas solares:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 10px 0; font-weight: bold; color: #64748b; width: 180px;">Nombre del Cliente:</td>
            <td style="padding: 10px 0; color: #0f172a; font-weight: 600;">${lead.nombre}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 10px 0; font-weight: bold; color: #64748b;">WhatsApp (Teléfono):</td>
            <td style="padding: 10px 0; color: #0f172a; font-family: monospace;">+${phone}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 10px 0; font-weight: bold; color: #64748b;">Gasto Promedio CFE:</td>
            <td style="padding: 10px 0; color: #ea580c; font-weight: bold;">${lead.monto_recibo}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 10px 0; font-weight: bold; color: #64748b;">Sistema Propuesto:</td>
            <td style="padding: 10px 0; color: #0f172a;">${lead.sistema_estimado}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 10px 0; font-weight: bold; color: #64748b;">Presupuesto Estimado:</td>
            <td style="padding: 10px 0; color: #ea580c; font-weight: bold;">${lead.costo_estimado}</td>
          </tr>
        </table>
        
        <div style="text-align: center; margin-top: 28px; margin-bottom: 16px;">
          <a href="https://wa.me/${phone}" style="background-color: #ea580c; color: white; padding: 12px 24px; border-radius: 12px; text-decoration: none; font-weight: bold; display: inline-block;">
            💬 Atender de inmediato en WhatsApp
          </a>
        </div>
      </div>
      <div style="background-color: #f8fafc; padding: 16px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #f1f5f9;">
        Este es un mensaje automatizado generado por el bot de Inteligencia Artificial de O3 Energy México.
      </div>
    </div>
  `;

  if (!process.env.SENDER_EMAIL || !process.env.SENDER_PASSWORD) {
    console.log(`\n======================================================`);
    console.log(`[SMTP SIMULACIÓN] Se detectó un nuevo lead calificado.`);
    console.log(`[SMTP SIMULACIÓN] Destinatario: ${salesEmail}`);
    console.log(`[SMTP SIMULACIÓN] Asunto: ${subject}`);
    console.log(`[SMTP SIMULACIÓN] (Para envíos reales, configure SENDER_EMAIL y SENDER_PASSWORD en Configuración)`);
    console.log(`======================================================\n`);
    return true;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtpServer,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: senderEmail,
        pass: senderPassword,
      },
    });

    const info = await transporter.sendMail({
      from: `"Alertas O3 Energy AI" <${senderEmail}>`,
      to: salesEmail,
      subject: subject,
      html: bodyHtml,
    });

    console.log(`[SMTP EXITO] Correo de notificación enviado con ID: ${info.messageId}`);
    return true;
  } catch (err) {
    console.error(`[SMTP ERROR] Error enviando correo de notificación:`, err);
    return false;
  }
}

// --- SEND REAL WHATSAPP MESSAGE VIA META CLOUD API ---
async function sendWhatsAppMessage(phone: string, text: string): Promise<boolean> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    console.log(`\n======================================================`);
    console.log(`[WHATSAPP SIMULACIÓN] Enviando mensaje a +${phone}`);
    console.log(`[WHATSAPP SIMULACIÓN] Texto: ${text}`);
    console.log(`[WHATSAPP SIMULACIÓN] (Para envíos reales, configure WHATSAPP_ACCESS_TOKEN y WHATSAPP_PHONE_NUMBER_ID en .env)`);
    console.log(`======================================================\n`);
    return true;
  }

  try {
    const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: phone,
        type: 'text',
        text: {
          preview_url: false,
          body: text,
        },
      }),
    });

    const data = await response.json();
    if (response.ok) {
      console.log(`[WHATSAPP EXITO] Mensaje enviado a +${phone}. Message ID: ${data.messages?.[0]?.id}`);
      return true;
    } else {
      console.error(`[WHATSAPP ERROR] Fallo al enviar mensaje a +${phone}:`, data);
      return false;
    }
  } catch (err) {
    console.error(`[WHATSAPP EXCEPCION] Error al enviar mensaje de WhatsApp:`, err);
    return false;
  }
}

// --- GEMINI CLIENT LAZY INITIALIZATION ---
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('CRITICAL: GEMINI_API_KEY environment variable is missing.');
      throw new Error('GEMINI_API_KEY is not configured in the environment variables. Please add it via the Settings menu.');
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// --- O3 ENERGY ASSISTANT PROMPT ---
const SYSTEM_INSTRUCTION = `
Eres un asesor de ventas experto e inteligente de "O3 Energy México", una empresa líder de ingeniería en energía solar enfocada en instalar sistemas fotovoltaicos de alta calidad para hogares y comercios. Tu objetivo es calificar y orientar con calidez a los interesados en reducir su recibo de luz en México.

Sigue rigurosamente estas pautas en español de México, manteniendo un tono profesional, amable y de confianza:

1. **Objetivos de Calificación (Descubrimiento)**:
   - Sé cálido e inicia saludando amigablemente.
   - Pregunta de forma natural el nombre del usuario si aún no lo tienes.
   - Descubre sutilmente si el usuario es el dueño de la propiedad o casa (los paneles requieren la aprobación del propietario).
   - Descubre de cuánto es su gasto o recibo de electricidad promedio, ya sea al mes o al bimestre (monto en pesos mexicanos MXN).

2. **REGLA DE COTIZACIÓN (Gasto mayor a $2,500 MXN)**:
   - Si el gasto del usuario es superior a $2,500 MXN mensuales/bimestrales, debes calcular una estimación rápida:
     - Por ejemplo, si gasta aproximadamente $3,000 MXN bimestrales, dile que se estima un sistema de 4 a 6 paneles solares con un costo aproximado de $80,000 MXN y un retorno de inversión a unos 3 años (ahorrando hasta el 95% de su recibo). Adapta proporcionalmente el costo y cantidad si gastan más.
     - Es un requerimiento OBLIGATORIO y estricto que enfatices textualmente la siguiente advertencia para evitar falsas expectativas comerciales:
       "Este es solo un presupuesto preliminar de arranque, ya que para la cotización real y final se requiere una visita técnica sin costo en su sitio para evaluar la inclinación del techo, sombras y trayectoria eléctrica."

3. **REGLA DE SALIDA (Generación del lead calificado)**:
   - En el momento en que hayas obtenido las respuestas clave (nombre o "Cliente Interesado", monto de recibo y la confirmación de ser dueño/interesado en pre-cotizar) y le hayas presentado la pre-cotización, debes adjuntar OBLIGATORIAMENTE al final absoluto de tu mensaje el siguiente bloque JSON en este formato de tag:
     [QUALIFIED_LEAD: {"nombre": "Nombre del cliente", "monto_recibo": "$X,XXX MXN", "sistema_estimado": "X paneles", "costo_estimado": "$XX,XXX MXN"}]
   - No muestres ni menciones este bloque JSON explícitamente en el diálogo de forma conversacional. Solo colócalo al final exacto de tu respuesta.

Mantén tus respuestas relativamente cortas, fáciles de leer en WhatsApp, usando viñetas donde sea conveniente y usando saltos de línea claros.
`;

// Helper to extract lead from Gemini response
function extractQualifiedLead(text: string): { cleanText: string; leadData: any | null } {
  // Matches [QUALIFIED_LEAD: { ... }]
  const match = text.match(/\[QUALIFIED_LEAD:\s*(\{.*?\})\s*\]/s);
  if (match) {
    try {
      const jsonStr = match[1].trim();
      const leadData = JSON.parse(jsonStr);
      const cleanText = text.replace(match[0], '').trim();
      return { cleanText, leadData };
    } catch (e) {
      console.error('Error parsing lead JSON tag from Gemini:', e);
    }
  }
  return { cleanText: text, leadData: null };
}

// --- API ENDPOINTS ---

// Webhook validation for Meta (GET)
app.get(['/whatsapp-webhook', '/api/whatsapp-webhook'], (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'O3_ENERGY_MEXICO_TOKEN';

  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('Webhook verified successfully!');
      return res.status(200).send(challenge);
    } else {
      return res.sendStatus(403);
    }
  }
  return res.status(200).send('O3 Energy Webhook Service Active. Please send a POST request.');
});

// Incoming Webhook (POST) - Supports Meta Cloud, Twilio and Custom formats
app.post(['/whatsapp-webhook', '/api/whatsapp-webhook'], async (req, res) => {
  let phone = '';
  let text = '';
  let name = 'Cliente O3';

  const body = req.body;

  // 1. Meta / Facebook Cloud API Payload
  if (body.entry && body.entry[0]?.changes?.[0]?.value) {
    const val = body.entry[0].changes[0].value;
    if (val.messages?.[0]) {
      const msg = val.messages[0];
      phone = msg.from;
      text = msg.text?.body || msg.button?.text || '';
      name = val.contacts?.[0]?.profile?.name || 'Cliente WhatsApp';
    }
  }
  // 2. Twilio Webhook Form/JSON Payload
  else if (body.From && body.Body) {
    phone = body.From.replace('whatsapp:', '');
    text = body.Body;
    name = body.ProfileName || 'Cliente Twilio';
  }
  // 3. Custom / Playground API Payload
  else if (body.phone && body.text) {
    phone = body.phone;
    text = body.text;
    name = body.name || 'Cliente Simulado';
  }

  if (!phone || !text) {
    return res.status(400).json({ error: 'Faltan parámetros requeridos (teléfono o texto)' });
  }

  // Sanitize phone number
  phone = phone.replace(/\+/g, '').replace(/\s+/g, '');

  try {
    const chatData = await getChatDoc(phone);
    
    // Register the user's incoming message
    const userMessage = {
      sender: 'user' as const,
      text: text,
      timestamp: new Date().toISOString()
    };
    
    const updatedMessages = [...(chatData.messages || []), userMessage];
    
    // Default chat structure updates
    let updatedChat = {
      ...chatData,
      nombre: chatData.nombre === 'Cliente' && name !== 'Cliente O3' ? name : chatData.nombre,
      messages: updatedMessages,
      last_message_at: new Date().toISOString()
    };

    // If bot is disabled, do not reply with Gemini. Just save and reply 200.
    if (chatData.bot_disabled) {
      await updateChatDoc(phone, updatedChat);
      return res.status(200).json({
        status: 'received',
        message: 'Bot disabled. Handled manually.',
        chat: updatedChat
      });
    }

    // Call Gemini API with entire history
    let replyText = '';
    try {
      const ai = getGeminiClient();
      
      // Map history to Google Gen AI schema (user/model roles)
      const chatHistory = updatedMessages.map(m => ({
        role: m.sender === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }]
      }));

      const result = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: chatHistory,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          temperature: 0.7,
        }
      });

      replyText = result.text || 'Disculpa, tuve un problema procesando tu consulta. ¿Me lo puedes repetir?';
    } catch (aiErr: any) {
      console.error('Gemini API call failed:', aiErr);
      replyText = 'Hola, soy el asistente automatizado de O3 Energy México. En este momento estoy experimentando un mantenimiento técnico, pero un asesor humano te atenderá muy pronto.';
    }

    // Check for QUALIFIED_LEAD block
    const { cleanText, leadData } = extractQualifiedLead(replyText);
    let emailSent = false;

    // If qualified, save to leads and update chat fields
    if (leadData) {
      const leadId = `lead_${phone}`;
      const newLead = {
        id: leadId,
        nombre: leadData.nombre || updatedChat.nombre,
        phone: phone,
        monto_recibo: leadData.monto_recibo || '',
        sistema_estimado: leadData.sistema_estimado || '',
        costo_estimado: leadData.costo_estimado || '',
      };
      
      await createQualifiedLead(newLead);
      emailSent = await sendSalesEmailNotification(newLead, phone);

      // Enrich chat document details
      updatedChat.nombre = leadData.nombre || updatedChat.nombre;
      updatedChat.monto_recibo = leadData.monto_recibo;
      updatedChat.sistema_estimado = leadData.sistema_estimado;
      updatedChat.costo_estimado = leadData.costo_estimado;
    }

    // Save bot reply
    const botMessage = {
      sender: 'bot' as const,
      text: cleanText,
      timestamp: new Date().toISOString()
    };
    updatedChat.messages.push(botMessage);

    await updateChatDoc(phone, updatedChat);

    // Send the reply physically to the user's WhatsApp if credentials are configured
    await sendWhatsAppMessage(phone, cleanText);

    return res.status(200).json({
      status: 'success',
      reply: cleanText,
      lead_generated: !!leadData,
      email_sent: emailSent,
      chat: updatedChat
    });

  } catch (err: any) {
    console.error('Webhook error processing:', err);
    return res.status(500).json({ error: err.message });
  }
});

// GET active chats
app.get('/api/chats', async (req, res) => {
  try {
    if (isInMemory) {
      return res.json(Object.values(inMemoryChats));
    } else {
      const snapshot = await db.collection('chats').orderBy('last_message_at', 'desc').get();
      const chatsList = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
      return res.json(chatsList);
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST to manually send a message or simulate bot toggle
app.post('/api/chats/:phone/toggle-bot', async (req, res) => {
  const { phone } = req.params;
  const { bot_disabled } = req.body;
  try {
    const chat = await getChatDoc(phone);
    chat.bot_disabled = bot_disabled;
    await updateChatDoc(phone, chat);
    return res.json({ success: true, chat });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST human agent message
app.post('/api/chats/:phone/message', async (req, res) => {
  const { phone } = req.params;
  const { text } = req.body;
  
  if (!text) {
    return res.status(400).json({ error: 'Text is required' });
  }

  try {
    const chat = await getChatDoc(phone);
    
    const agentMsg = {
      sender: 'agent' as const,
      text,
      timestamp: new Date().toISOString()
    };
    
    chat.messages.push(agentMsg);
    chat.last_message_at = new Date().toISOString();
    // Automatically mute bot if human steps in, to avoid collision
    chat.bot_disabled = true;

    await updateChatDoc(phone, chat);

    // Send the manual message physically to the user's WhatsApp if credentials are configured
    await sendWhatsAppMessage(phone, text);

    return res.json({ success: true, chat });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET qualified leads
app.get('/api/leads', async (req, res) => {
  try {
    if (isInMemory) {
      return res.json(Object.values(inMemoryLeads));
    } else {
      const snapshot = await db.collection('qualified_leads').orderBy('created_at', 'desc').get();
      const leadsList = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
      return res.json(leadsList);
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST copilot query - database analysis chatbot
app.post('/api/copilot/query', async (req, res) => {
  const { question, history } = req.body;
  if (!question) {
    return res.status(400).json({ error: 'Falta la pregunta del usuario' });
  }

  try {
    // 1. Fetch current database data
    let leadsList: any[] = [];
    let chatsList: any[] = [];

    if (isInMemory) {
      leadsList = Object.values(inMemoryLeads);
      chatsList = Object.values(inMemoryChats).map((chat: any) => ({
        id: chat.id,
        phone: chat.phone,
        nombre: chat.nombre,
        bot_disabled: chat.bot_disabled,
        monto_recibo: chat.monto_recibo,
        sistema_estimado: chat.sistema_estimado,
        costo_estimado: chat.costo_estimado,
        message_count: chat.messages ? chat.messages.length : 0,
        last_message_at: chat.last_message_at
      }));
    } else {
      const leadsSnap = await db.collection('qualified_leads').orderBy('created_at', 'desc').get();
      leadsList = leadsSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));

      const chatsSnap = await db.collection('chats').orderBy('last_message_at', 'desc').get();
      chatsList = chatsSnap.docs.map((doc: any) => {
        const data = doc.data();
        return {
          id: doc.id,
          phone: data.phone,
          nombre: data.nombre,
          bot_disabled: data.bot_disabled,
          monto_recibo: data.monto_recibo,
          sistema_estimado: data.sistema_estimado,
          costo_estimado: data.costo_estimado,
          message_count: data.messages ? data.messages.length : 0,
          last_message_at: data.last_message_at
        };
      });
    }

    // 2. Build the context for Gemini
    const databaseContext = {
      qualified_leads: leadsList,
      chats_metadata: chatsList,
      current_time: new Date().toISOString(),
      metadata: {
        total_leads: leadsList.length,
        total_chats: chatsList.length,
        pending_leads: leadsList.filter((l: any) => l.status === 'pending_review').length,
        contacted_leads: leadsList.filter((l: any) => l.status === 'contacted').length,
      }
    };

    // 3. Initialize Gemini Client
    const ai = getGeminiClient();

    // 4. Set up system instruction with raw database data
    const systemInstruction = `
Eres el Copiloto Inteligente de Base de Datos de Ventas de "O3 Energy México". Tu objetivo es asistir al equipo interno de ventas y administración a buscar, filtrar, calcular, resumir y analizar los leads calificados e historiales de chats que se van alimentando en tiempo real.

Tienes acceso completo e inmediato a los siguientes datos estructurados del sistema en formato JSON:
${JSON.stringify(databaseContext, null, 2)}

Instrucciones para tus respuestas:
1. Responde con precisión analítica, basándote ÚNICAMENTE en los datos estructurados provistos arriba.
2. Si te preguntan totales de prospectos, sumas de dinero (pipeline de ventas de leads calificados o contactados), conversiones, o promedios, haz las operaciones matemáticas correctas y explica detalladamente tu cálculo.
3. Si el usuario te pregunta por un prospecto o cliente en particular por su nombre o teléfono, búscalo en "qualified_leads" o "chats_metadata" y dale un resumen detallado de sus características.
4. Siempre que menciones montos de dinero, dales el formato elegante de pesos mexicanos (ej. $15,000 MXN).
5. Usa formato Markdown de forma abundante y organizada para estructurar tus respuestas (tablas, listas, negritas, bloques de código, etc.) para que sean muy fáciles de leer y profesionales.
6. Si la base de datos está vacía, indícalo amablemente y sugiéreles usar el Simulador del Webhook de WhatsApp para generar leads de prueba de forma interactiva.
7. Mantén siempre un tono profesional, servicial, motivador y sumamente claro.
`;

    // 5. Structure conversation content
    const contents: any[] = [];
    if (history && Array.isArray(history)) {
      history.forEach((msg: any) => {
        contents.push({
          role: msg.sender === 'user' ? 'user' : 'model',
          parts: [{ text: msg.text }]
        });
      });
    }
    contents.push({
      role: 'user',
      parts: [{ text: question }]
    });

    const result = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: contents,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.1, // very low temperature for strict factual accuracy
      }
    });

    const answer = result.text || 'Disculpa, no logré procesar tu solicitud de búsqueda en la base de datos.';
    return res.json({ answer });

  } catch (err: any) {
    console.error('Error in Copilot query API:', err);
    return res.status(500).json({ error: err.message || 'Error interno del servidor en el chatbot copiloto.' });
  }
});

// Delete lead / mock endpoints for demo purposes
app.post('/api/leads/:id/contacted', async (req, res) => {
  const { id } = req.params;
  try {
    if (isInMemory) {
      if (inMemoryLeads[id]) {
        inMemoryLeads[id].status = 'contacted';
      }
      return res.json({ success: true });
    } else {
      await db.collection('qualified_leads').doc(id).update({ status: 'contacted' });
      return res.json({ success: true });
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Update private notes for follow-up tracking
app.post('/api/leads/:id/notes', async (req, res) => {
  const { id } = req.params;
  const { private_notes } = req.body;
  try {
    if (isInMemory) {
      if (inMemoryLeads[id]) {
        inMemoryLeads[id].private_notes = private_notes;
      }
      return res.json({ success: true, private_notes });
    } else {
      await db.collection('qualified_leads').doc(id).set({ private_notes }, { merge: true });
      return res.json({ success: true, private_notes });
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Clear all database entries (useful for resetting the playground in one-click)
app.post('/api/reset-demo', async (req, res) => {
  try {
    if (isInMemory) {
      Object.keys(inMemoryChats).forEach(k => delete inMemoryChats[k]);
      Object.keys(inMemoryLeads).forEach(k => delete inMemoryLeads[k]);
    } else {
      // Clear Firestore collections
      const chatsSnap = await db.collection('chats').get();
      for (const doc of chatsSnap.docs) {
        await doc.ref.delete();
      }
      const leadsSnap = await db.collection('qualified_leads').get();
      for (const doc of leadsSnap.docs) {
        await doc.ref.delete();
      }
    }
    return res.json({ success: true, message: 'Playground database reset successfully.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// --- VITE DEV AND PROD ROUTING ---
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server executing successfully on http://localhost:${PORT}`);
  });
}

startServer();
