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
  botDisabled: boolean;
  montoRecibo?: string;
  sistemaEstimado?: string;
  costoEstimado?: string;
  lastMessageAt: string;
  messages: Message[];
}

export interface QualifiedLead {
  id: string;
  nombre: string;
  phone: string;
  montoRecibo?: string;
  sistemaEstimado?: string;
  costoEstimado?: string;
  status: 'pending_review' | 'contacted';
  createdAt: string;
  privateNotes?: string;
}
