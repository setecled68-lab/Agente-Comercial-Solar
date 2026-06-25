/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const FAST_API_CODE = `from fastapi import FastAPI, Request, HTTPException
import re
import json
import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import firebase_admin
from firebase_admin import credentials, firestore
from google import genai
from google.genai import types

app = FastAPI(title="O3 Energy México Sales Automation Webhook")

# 1. INITIALIZE FIREBASE ADMIN SDK
# Reemplaza 'serviceAccountKey.json' con la ruta a tu archivo de credenciales de Firebase
try:
    cred = credentials.Certificate("serviceAccountKey.json")
    firebase_admin.initialize_app(cred)
except Exception:
    # Intenta inicializar usando credenciales por defecto de Google Cloud
    firebase_admin.initialize_app()

db = firestore.client()

# ENVIAR ALERTA POR CORREO ELECTRÓNICO AL EQUIPO DE VENTAS
def send_sales_email_notification(lead_data: dict, phone: str):
    smtp_server = os.environ.get("SMTP_SERVER", "smtp.gmail.com")
    try:
        smtp_port = int(os.environ.get("SMTP_PORT", "587"))
    except Exception:
        smtp_port = 587
    sender_email = os.environ.get("SENDER_EMAIL", "alertas@o3energy.mx")
    sender_password = os.environ.get("SENDER_PASSWORD")
    sales_email = os.environ.get("SALES_EMAIL", "ventas@o3energy.mx")

    subject = f"🔥 Nuevo Lead Calificado: {lead_data.get('nombre', 'Cliente')} ({lead_data.get('monto_recibo', 'Sin monto')})"
    
    body = f"""
    <html>
    <body style="font-family: sans-serif; color: #334155; line-height: 1.5; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden;">
        <div style="background-color: #ea580c; color: white; padding: 24px; text-align: center;">
            <h1 style="margin: 0; font-size: 20px;">🔥 ¡Nuevo Lead Calificado Detectado!</h1>
            <p style="margin: 4px 0 0 0; font-size: 14px; opacity: 0.9;">O3 Energy Sales Automation AI</p>
        </div>
        <div style="padding: 24px;">
            <p>Se ha calificado de forma autónoma un nuevo interesado en paneles solares:</p>
            <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
                <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 10px 0; font-weight: bold; color: #64748b; width: 180px;">Nombre:</td>
                    <td style="padding: 10px 0; color: #0f172a; font-weight: 600;">{lead_data.get('nombre', 'Cliente')}</td>
                </tr>
                <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 10px 0; font-weight: bold; color: #64748b;">WhatsApp:</td>
                    <td style="padding: 10px 0; color: #0f172a; font-family: monospace;">+{phone}</td>
                </tr>
                <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 10px 0; font-weight: bold; color: #64748b;">Recibo CFE:</td>
                    <td style="padding: 10px 0; color: #ea580c; font-weight: bold;">{lead_data.get('monto_recibo', 'No especificado')}</td>
                </tr>
                <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 10px 0; font-weight: bold; color: #64748b;">Sistema Estimado:</td>
                    <td style="padding: 10px 0; color: #0f172a;">{lead_data.get('sistema_estimado', 'No especificado')}</td>
                </tr>
                <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 10px 0; font-weight: bold; color: #64748b;">Costo Estimado:</td>
                    <td style="padding: 10px 0; color: #ea580c; font-weight: bold;">{lead_data.get('costo_estimado', 'No especificado')}</td>
                </tr>
            </table>
            <div style="text-align: center; margin: 28px 0 16px 0;">
                <a href="https://wa.me/{phone}" style="background-color: #ea580c; color: white; padding: 12px 24px; border-radius: 12px; text-decoration: none; font-weight: bold; display: inline-block;">
                    💬 Atender de inmediato en WhatsApp
                </a>
            </div>
        </div>
        <div style="background-color: #f8fafc; padding: 16px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #f1f5f9;">
            Este es un correo automático generado por O3 Energy Sales Automation AI.
        </div>
    </body>
    </html>
    """

    msg = MIMEMultipart()
    msg['From'] = sender_email
    msg['To'] = sales_email
    msg['Subject'] = subject
    msg.attach(MIMEText(body, 'html'))

    try:
        if not sender_email or not sender_password:
            print(f"[SMTP SIMULACIÓN] Correo enviado a {sales_email} - Asunto: {subject}")
            return True
            
        server = smtplib.SMTP(smtp_server, smtp_port)
        server.starttls()
        server.login(sender_email, sender_password)
        server.sendmail(sender_email, sales_email, msg.as_string())
        server.quit()
        print("Correo enviado exitosamente al equipo de ventas.")
        return True
    except Exception as e:
        print(f"Error al enviar correo electrónico de notificación: {e}")
        return False

db = firestore.client()

# 2. INITIALIZE GEMINI CLIENT
# Asegúrate de configurar la variable de entorno GEMINI_API_KEY
gemini_api_key = os.environ.get("GEMINI_API_KEY")
if not gemini_api_key:
    raise ValueError("GEMINI_API_KEY no configurada como variable de entorno")

ai = genai.Client(api_key=gemini_api_key)

SYSTEM_INSTRUCTION = """
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
"""

def extract_qualified_lead(text: str):
    # Regex para buscar [QUALIFIED_LEAD: { ... }]
    match = re.search(r'\\[QUALIFIED_LEAD:\\s*(\\{.*?\\})\\s*\\]', text, re.DOTALL)
    if match:
        try:
            json_str = match.group(1).strip()
            lead_data = json.loads(json_str)
            clean_text = text.replace(match.group(0), "").strip()
            return clean_text, lead_data
        except Exception as e:
            print(f"Error parseando JSON de lead: {e}")
    return text, None

@app.post("/whatsapp-webhook")
async def whatsapp_webhook(request: Request):
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Formato JSON inválido")

    phone = None
    text = None
    name = "Cliente O3"

    # --- 1. DETECTAR PAYLOAD DE FACEBOOK WHATSAPP CLOUD API ---
    if "entry" in body and isinstance(body["entry"], list) and len(body["entry"]) > 0:
        entry = body["entry"][0]
        if "changes" in entry and len(entry["changes"]) > 0:
            change = entry["changes"][0]
            val = change.get("value", {})
            if "messages" in val and len(val["messages"]) > 0:
                msg = val["messages"][0]
                phone = msg.get("from")
                text = msg.get("text", {}).get("body", msg.get("button", {}).get("text", ""))
                contacts = val.get("contacts", [])
                if len(contacts) > 0:
                    name = contacts[0].get("profile", {}).get("name", "Cliente WhatsApp")

    # --- 2. DETECTAR PAYLOAD DE TWILIO ---
    elif "From" in body and "Body" in body:
        phone = body["From"].replace("whatsapp:", "")
        text = body["Body"]
        name = body.get("ProfileName", "Cliente Twilio")

    # --- 3. DETECTAR PAYLOAD PERSONALIZADO / SIMULADOR ---
    elif "phone" in body and "text" in body:
        phone = body["phone"]
        text = body["text"]
        name = body.get("name", "Cliente Simulado")

    if not phone or not text:
        raise HTTPException(status_code=400, detail="No se pudo extraer teléfono o mensaje")

    # Sanitizar número de teléfono (quitar '+' y espacios)
    phone = phone.replace("+", "").replace(" ", "")

    # Obtener referencia al chat en Firestore
    chat_ref = db.collection("chats").document(phone)
    chat_doc = chat_ref.get()

    if chat_doc.exists:
        chat_data = chat_doc.to_dict()
    else:
        chat_data = {
            "phone": phone,
            "nombre": name,
            "bot_disabled": False,
            "messages": [],
            "last_message_at": ""
        }

    # Agregar mensaje del usuario a la lista
    user_msg = {
        "sender": "user",
        "text": text,
        "timestamp": firestore.SERVER_TIMESTAMP
    }
    chat_data["messages"].append(user_msg)
    chat_data["last_message_at"] = firestore.SERVER_TIMESTAMP
    if chat_data.get("nombre") == "Cliente" and name != "Cliente O3":
        chat_data["nombre"] = name

    # Si el bot de IA está pausado, solo guardamos el mensaje recibido y terminamos
    if chat_data.get("bot_disabled", False):
        chat_ref.set(chat_data)
        return {"status": "received", "message": "Bot pausado, atención manual activada"}

    # --- INVOCAR A GEMINI API CON HISTORIAL ---
    # Convertir el historial al formato oficial de Google Gen AI
    contents = []
    # Usar los últimos 12 mensajes como contexto para optimizar tokens
    recent_messages = chat_data["messages"][-12:]
    for m in recent_messages:
        role = "user" if m["sender"] == "user" else "model"
        contents.append(
            types.Content(
                role=role,
                parts=[types.Part.from_text(text=m["text"])]
            )
        )

    try:
        response = ai.models.generate_content(
            model='gemini-2.0-flash',
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_INSTRUCTION,
                temperature=0.7
            )
        )
        reply_text = response.text or "Lo siento, ¿podrías repetir eso?"
    except Exception as e:
        print(f"Error invocando API de Gemini: {e}")
        reply_text = "Hola, en este momento el servicio automatizado de O3 Energy presenta inconvenientes. Un asesor técnico te atenderá enseguida."

    # Extraer el bloque del lead calificado si está presente
    clean_reply, lead_data = extract_qualified_lead(reply_text)

    # Si califica como Lead, guardarlo en la colección qualified_leads
    if lead_data:
        lead_ref = db.collection("qualified_leads").document(f"lead_{phone}")
        lead_ref.set({
            "nombre": lead_data.get("nombre", chat_data["nombre"]),
            "phone": phone,
            "monto_recibo": lead_data.get("monto_recibo", ""),
            "sistema_estimado": lead_data.get("sistema_estimado", ""),
            "costo_estimado": lead_data.get("costo_estimado", ""),
            "status": "pending_review",
            "created_at": firestore.SERVER_TIMESTAMP
        })
        
        # Enviar notificación automática por correo electrónico al equipo de ventas
        send_sales_email_notification({
            "nombre": lead_data.get("nombre", chat_data["nombre"]),
            "monto_recibo": lead_data.get("monto_recibo", ""),
            "sistema_estimado": lead_data.get("sistema_estimado", ""),
            "costo_estimado": lead_data.get("costo_estimado", "")
        }, phone)

        # Enriquecer datos rápidos del chat
        chat_data["nombre"] = lead_data.get("nombre", chat_data["nombre"])
        chat_data["monto_recibo"] = lead_data.get("monto_recibo")
        chat_data["sistema_estimado"] = lead_data.get("sistema_estimado")
        chat_data["costo_estimado"] = lead_data.get("costo_estimado")

    # Agregar respuesta del Bot
    bot_msg = {
        "sender": "bot",
        "text": clean_reply,
        "timestamp": firestore.SERVER_TIMESTAMP
    }
    chat_data["messages"].append(bot_msg)

    # Guardar estado final del chat en Firestore
    chat_ref.set(chat_data)

    return {
        "status": "success",
        "reply": clean_reply,
        "lead_generated": lead_data is not None
    }

# Webhook para validación inicial de Meta (Verificación del Webhook)
@app.get("/whatsapp-webhook")
async def verify_webhook(request: Request):
    params = request.query_params
    mode = params.get("hub.mode")
    token = params.get("hub.verify_token")
    challenge = params.get("hub.challenge")

    # Verifica con tu Token Personalizado definido en la consola de Meta
    VERIFY_TOKEN = os.environ.get("WHATSAPP_VERIFY_TOKEN", "O3_ENERGY_MEXICO_TOKEN")

    if mode and token:
        if mode == "subscribe" and token == VERIFY_TOKEN:
            from fastapi.responses import Response
            return Response(content=challenge, media_type="text/plain")
        else:
            raise HTTPException(status_code=403, detail="Token de verificación inválido")
    return {"message": "Webhook O3 Energy activo"}
`;

export const FIRESTORE_GUIDE = `### 🗄️ Estructura de Colecciones en Firestore

El sistema utiliza dos colecciones principales en Firestore para organizar el flujo de conversación y de conversión de ventas de paneles solares:

---

#### 1. Colección: \`chats\`
Almacena el historial conversacional de todos los clientes que interactúan con la cuenta de WhatsApp Business.
- **ID del Documento**: Número de teléfono sanitizado (ej: \`5215512345678\`).

\`\`\`json
{
  "phone": "5215512345678",
  "nombre": "Sofia Ramos",
  "bot_disabled": false,       // true si el bot de IA fue "Pausado" para atención humana
  "monto_recibo": "$4,200 MXN", // Extraído automáticamente por Gemini
  "sistema_estimado": "6 a 8 paneles solares",
  "costo_estimado": "$95,000 MXN",
  "last_message_at": "2026-06-25T21:11:00.000Z",
  "messages": [
    {
      "sender": "user",
      "text": "Hola, buenas tardes, me interesa cotizar paneles",
      "timestamp": "2026-06-25T21:05:00.000Z"
    },
    {
      "sender": "bot",
      "text": "¡Hola! Qué gusto saludarte. Soy el asesor virtual de O3 Energy México... ¿Me podrías decir tu nombre y si eres dueño de la propiedad?",
      "timestamp": "2026-06-25T21:05:15.000Z"
    },
    {
      "sender": "user",
      "text": "Sí, soy Sofia Ramos, es mi casa. Pago unos 4200 de luz al bimestre",
      "timestamp": "2026-06-25T21:06:10.000Z"
    }
  ]
}
\`\`\`

---

#### 2. Colección: \`qualified_leads\`
Almacena exclusivamente los leads que han sido calificados con éxito por el bot de Inteligencia Artificial de Gemini.
- **ID del Documento**: Prefijo de lead + Teléfono (ej: \`lead_5215512345678\`).

\`\`\`json
{
  "id": "lead_5215512345678",
  "nombre": "Sofia Ramos",
  "phone": "5215512345678",
  "monto_recibo": "$4,200 MXN",
  "sistema_estimado": "6 a 8 paneles solares",
  "costo_estimado": "$95,000 MXN",
  "status": "pending_review",   // "pending_review" o "contacted"
  "created_at": "2026-06-25T21:11:05.000Z"
}
\`\`\`
`;

export const META_INTEGRATION_GUIDE = `### 📲 Configuración del Webhook en Meta (WhatsApp Business API)

Para conectar tu API de WhatsApp Cloud en vivo a este servidor de automatización de ventas, sigue estos pasos:

#### Paso 1: Obtener la URL de tu Webhook
Una vez desplegado tu servidor (ya sea la versión Python en tu infraestructura o la versión Node en esta plataforma), la URL del webhook será:
\`\`\`text
https://TU-DOMINIO.com/whatsapp-webhook
\`\`\`

#### Paso 2: Configurar en el Portal de Desarrolladores de Meta
1. Ve a la consola de [Meta for Developers](https://developers.facebook.com/) y selecciona tu aplicación.
2. En el menú de la izquierda, agrega o haz clic en **WhatsApp** y luego ve a **Configuración de la API** o **Configuración**.
3. Busca la sección **Webhooks** y haz clic en **Editar**.
4. Introduce los siguientes valores:
   - **URL de devolución (Callback URL)**: \`https://TU-DOMINIO.com/whatsapp-webhook\`
   - **Token de verificación**: Introduce el valor de tu variable \`WHATSAPP_VERIFY_TOKEN\` (si no lo configuraste, el valor por defecto en el código es \`O3_ENERGY_MEXICO_TOKEN\`).
5. Haz clic en **Guardar y Verificar**. Meta enviará una solicitud \`GET\` a tu webhook. El código responderá automáticamente con el reto para validar la conexión.

#### Paso 3: Suscribirse a Campos del Mensaje
1. En la misma pantalla de Webhooks de WhatsApp, desplázate hasta encontrar la tabla de campos disponibles.
2. Busca el campo llamado **messages** (Mensajes).
3. Haz clic en el botón **Suscribirse** al lado de este campo.
4. ¡Listo! A partir de ahora, cada mensaje entrante activará tu bot de Gemini en tiempo real.
`;
