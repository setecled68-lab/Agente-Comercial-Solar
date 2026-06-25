/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Message {
  sender: 'user' | 'bot' | 'agent';
  text: string;
  timestamp: string; // ISO String for uniform parsing
}

export interface Chat {
  id: string; // Phone number as ID
  phone: string;
  nombre?: string;
  bot_disabled: boolean;
  monto_recibo?: string;
  sistema_estimado?: string;
  costo_estimado?: string;
  last_message_at: string;
  messages: Message[];
}

export interface QualifiedLead {
  id: string;
  nombre: string;
  phone: string;
  monto_recibo: string;
  sistema_estimado: string;
  costo_estimado: string;
  status: 'pending_review' | 'contacted';
  created_at: string;
  private_notes?: string;
}
