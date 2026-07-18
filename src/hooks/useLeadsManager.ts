import { useState } from 'react';
import { QualifiedLead } from '../types';

interface UseLeadsManagerProps {
  showToast: (msg: string) => void;
}

export function useLeadsManager({ showToast }: UseLeadsManagerProps) {
  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({});
  const [savingNoteId, setSavingNoteId] = useState<string | null>(null);

  const handleMarkContacted = async (leadId: string) => {
    try {
      const response = await fetch(`/api/leads/${leadId}/contacted`, { method: 'POST' });
      if (response.ok) {
        showToast('Marcar como Contactado exitoso');
      }
    } catch (err) {
      showToast('Error de red al marcar lead');
    }
  };

  const handleSaveNotes = async (leadId: string, notes: string) => {
    setSavingNoteId(leadId);
    try {
      const response = await fetch(`/api/leads/${leadId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ privateNotes: notes })
      });
      if (response.ok) {
        showToast('📝 Nota privada guardada con éxito');
        setEditingNotes(prev => {
          const copy = { ...prev };
          delete copy[leadId];
          return copy;
        });
      } else {
        showToast('Error al guardar la nota privada');
      }
    } catch (err) {
      showToast('Error de red al guardar la nota');
    } finally {
      setSavingNoteId(null);
    }
  };

  const exportLeadsToCSV = (filteredLeads: QualifiedLead[]) => {
    if (filteredLeads.length === 0) {
      showToast('No hay leads calificados para exportar.');
      return;
    }

    const headers = [
      'ID',
      'Nombre',
      'Teléfono',
      'Monto Recibo',
      'Sistema Estimado',
      'Costo Estimado (MXN)',
      'Estado',
      'Fecha Creación',
      'Notas Privadas'
    ];

    const rows = filteredLeads.map((lead) => [
      lead.id,
      lead.nombre || '',
      lead.phone || '',
      lead.montoRecibo || '',
      lead.sistemaEstimado || '',
      lead.costoEstimado || '',
      lead.status === 'pending_review' ? 'Pendiente de Contacto' : 'Contactado',
      lead.createdAt ? new Date(lead.createdAt).toLocaleString('es-MX') : '',
      lead.privateNotes || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => 
        row.map(value => {
          const escaped = String(value).replace(/"/g, '""');
          return `"${escaped}"`;
        }).join(',')
      )
    ].join('\n');

    try {
      const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `O3_Energy_Leads_Calificados_${new Date().toISOString().slice(0, 10)}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('¡Leads exportados a CSV con éxito!');
    } catch (err) {
      console.error('Error exporting leads:', err);
      showToast('Error al exportar leads a CSV.');
    }
  };

  return {
    editingNotes,
    setEditingNotes,
    savingNoteId,
    handleMarkContacted,
    handleSaveNotes,
    exportLeadsToCSV
  };
}
