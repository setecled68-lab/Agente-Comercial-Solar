export const AppConfig = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  tenant: {
    defaultId: 'o3energy_mexico',
  },
  meta: {
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || 'O3_ENERGY_MEXICO_TOKEN',
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
  },
  groq: {
    apiKey: process.env.GROQ_API_KEY || '',
    model: 'openai/gpt-oss-120b',
    temperature: 0.7,
  },
  smtp: {
    server: process.env.SMTP_SERVER || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SENDER_EMAIL || 'alertas@o3energy.mx',
    pass: process.env.SENDER_PASSWORD || '',
    salesEmail: process.env.SALES_EMAIL || 'ventas@o3energy.mx',
  }
};
