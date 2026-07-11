import { Lead } from '../entities/Lead.js';

export interface ILeadRepository {
  save(lead: Lead): Promise<void>;
  findAll(tenantId: string): Promise<Lead[]>;
  updateStatus(tenantId: string, leadId: string, status: Lead['status']): Promise<void>;
  updateNotes(tenantId: string, leadId: string, notes: string): Promise<void>;
}
