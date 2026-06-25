/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  MessageSquare,
  Users,
  Zap,
  BookOpen,
  Send,
  RefreshCw,
  Play,
  Pause,
  UserCheck,
  Sparkles,
  ArrowRight,
  Code,
  Check,
  CheckCircle,
  Clock,
  Phone,
  Trash2,
  Copy,
  AlertTriangle,
  Server,
  DollarSign,
  Layers,
  HelpCircle,
  Search,
  ExternalLink,
  Bell,
  BellOff,
  TrendingUp,
  Download,
  Database
} from 'lucide-react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from './firebase';
import { Chat, QualifiedLead, Message } from './types';
import { FAST_API_CODE, FIRESTORE_GUIDE, META_INTEGRATION_GUIDE } from './data/python_code';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

export default function App() {
  const [activeTab, setActiveTab] = useState<'chats' | 'leads' | 'simulator' | 'guide' | 'copilot'>('chats');
  const [isDarkMode, setIsDarkMode] = useState(true);
  
  // App state
  const [chats, setChats] = useState<Chat[]>([]);
  const [leads, setLeads] = useState<QualifiedLead[]>([]);
  const [selectedChatPhone, setSelectedChatPhone] = useState<string | null>(null);
  
  // Loading and polling states
  const [isLoading, setIsLoading] = useState(true);
  const [isFirebaseConnected, setIsFirebaseConnected] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<string>('');
  
  // Search state
  const [chatSearch, setChatSearch] = useState('');
  const [leadsSearch, setLeadsSearch] = useState('');
  
  // Manual text inputs
  const [agentMessageText, setAgentMessageText] = useState('');
  
  // Simulator state
  const [simPhone, setSimPhone] = useState('5215544332211');
  const [simName, setSimName] = useState('Alejandro Ruiz');
  const [simMessage, setSimMessage] = useState('Hola, buenas tardes, me interesa cotizar paneles para mi casa.');
  const [simPayload, setSimPayload] = useState<string>('');
  const [simResponse, setSimResponse] = useState<any>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationLog, setSimulationLog] = useState<string[]>([]);
  
  // Copilot assistant states
  const [copilotMessages, setCopilotMessages] = useState<{ sender: 'user' | 'bot'; text: string; timestamp: string }[]>([
    {
      sender: 'bot',
      text: '¡Hola! Soy tu Copiloto Inteligente de Ventas de O3 Energy México. Pregúntame lo que quieras sobre los leads calificados, montos estimados de cotizaciones, proyecciones de ahorro o estadísticas generales de los chats.',
      timestamp: new Date().toISOString()
    }
  ]);
  const [copilotInput, setCopilotInput] = useState('');
  const [isCopilotTyping, setIsCopilotTyping] = useState(false);
  
  // UI notifications
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  // Notification permission states & helper refs
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const seenLeadIdsRef = useRef<Set<string>>(new Set());
  const isFirstLeadsLoadRef = useRef(true);

  // Initialize notification permission state on mount
  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  // Request browser notification permission
  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      showToast('Tu navegador no soporta notificaciones de escritorio.');
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === 'granted') {
        showToast('¡Notificaciones activadas con éxito!');
        new Notification('O3 Energy Alertas', {
          body: 'Notificaciones activadas para nuevos leads calificados.',
          icon: '/favicon.ico'
        });
      } else if (permission === 'denied') {
        showToast('Notificaciones rechazadas por el usuario.');
      }
    } catch (err) {
      console.error('Error requesting notification permission:', err);
    }
  };

  // Trigger browser push notification
  const triggerBrowserNotification = (lead: QualifiedLead) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      const title = `🔥 Lead Calificado: ${lead.nombre || 'Cliente Nuevo'}`;
      const options = {
        body: `Recibo: ${lead.monto_recibo || 'Sin monto'} | Sistema: ${lead.sistema_estimado || 'Sin sistema'}`,
        icon: '/favicon.ico',
        tag: lead.id, // prevent duplicate alerts
        requireInteraction: true // Keep open until action
      };

      const notification = new Notification(title, options);

      notification.onclick = () => {
        window.focus();
        setActiveTab('leads');
        setLeadsSearch(''); // clear search filter so they see the lead
        notification.close();
      };
    }
  };

  // Private notes state
  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({});
  const [savingNoteId, setSavingNoteId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const copilotEndRef = useRef<HTMLDivElement>(null);

  // Agrupar leads por sistema estimado para la gráfica de anillos
  const systemData = React.useMemo(() => {
    const counts: Record<string, number> = {};
    leads.forEach(lead => {
      let sys = lead.sistema_estimado || 'No especificado';
      if (sys.length > 30) {
        const match = sys.match(/\d+\s+paneles/i);
        if (match) {
          sys = match[0];
        } else {
          sys = sys.substring(0, 27) + '...';
        }
      }
      counts[sys] = (counts[sys] || 0) + 1;
    });

    const colors = [
      '#10b981',
      '#06b6d4',
      '#3b82f6',
      '#f59e0b',
      '#8b5cf6',
      '#ec4899',
      '#14b8a6',
      '#6366f1',
    ];

    return Object.entries(counts).map(([name, value], index) => ({
      name,
      value,
      color: colors[index % colors.length]
    }));
  }, [leads]);

  // Show a temporary toast message
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Setup Firestore live onSnapshot listener with HTTP polling backup
  useEffect(() => {
    let unsubscribeChats: () => void = () => {};
    let unsubscribeLeads: () => void = () => {};
    let isPolling = false;
    let pollInterval: NodeJS.Timeout;

    const fetchBackupData = async () => {
      try {
        const chatsRes = await fetch('/api/chats');
        if (chatsRes.ok) {
          const chatsData = await chatsRes.json();
          setChats(chatsData);
        }
        
        const leadsRes = await fetch('/api/leads');
        if (leadsRes.ok) {
          const leadsData: QualifiedLead[] = await leadsRes.json();
          
          // Check for newly added leads
          if (isFirstLeadsLoadRef.current) {
            leadsData.forEach((lead) => {
              seenLeadIdsRef.current.add(lead.id);
            });
            isFirstLeadsLoadRef.current = false;
          } else {
            leadsData.forEach((lead) => {
              if (!seenLeadIdsRef.current.has(lead.id)) {
                seenLeadIdsRef.current.add(lead.id);
                triggerBrowserNotification(lead);
              }
            });
          }

          setLeads(leadsData);
        }
        setLastRefreshed(new Date().toLocaleTimeString());
        setIsLoading(false);
      } catch (err) {
        console.warn('Backup HTTP polling failed:', err);
      }
    };

    const startPollingFallback = () => {
      if (isPolling) return;
      isPolling = true;
      setIsFirebaseConnected(false);
      console.log('Using real-time HTTP polling fallback...');
      fetchBackupData();
      pollInterval = setInterval(fetchBackupData, 3000);
    };

    try {
      // 1. Subscribe to Chats
      const chatsQuery = query(collection(db, 'chats'), orderBy('last_message_at', 'desc'));
      unsubscribeChats = onSnapshot(chatsQuery, (snapshot) => {
        const chatsList: Chat[] = [];
        snapshot.forEach((doc) => {
          chatsList.push({ id: doc.id, ...(doc.data() as any) });
        });
        setChats(chatsList);
        setIsLoading(false);
        setIsFirebaseConnected(true);
        setLastRefreshed(new Date().toLocaleTimeString());
      }, (error) => {
        console.warn('Firestore chats subscription failed. Switching to HTTP Polling:', error);
        startPollingFallback();
      });

      // 2. Subscribe to Leads
      const leadsQuery = query(collection(db, 'qualified_leads'), orderBy('created_at', 'desc'));
      unsubscribeLeads = onSnapshot(leadsQuery, (snapshot) => {
        const leadsList: QualifiedLead[] = [];
        snapshot.forEach((doc) => {
          leadsList.push({ id: doc.id, ...(doc.data() as any) });
        });

        // Check for new leads in snapshots
        if (isFirstLeadsLoadRef.current) {
          snapshot.forEach((doc) => {
            seenLeadIdsRef.current.add(doc.id);
          });
          isFirstLeadsLoadRef.current = false;
        } else {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
              const docId = change.doc.id;
              if (!seenLeadIdsRef.current.has(docId)) {
                seenLeadIdsRef.current.add(docId);
                const leadData = { id: docId, ...change.doc.data() } as QualifiedLead;
                triggerBrowserNotification(leadData);
              }
            }
          });
        }

        setLeads(leadsList);
      }, (error) => {
        console.warn('Firestore leads subscription failed:', error);
      });

    } catch (err) {
      console.warn('Failed to subscribe to Firestore natively. Starting fallback polling:', err);
      startPollingFallback();
    }

    return () => {
      unsubscribeChats();
      unsubscribeLeads();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, []);

  // Scroll to bottom of chat when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chats, selectedChatPhone]);

  // Scroll to bottom of copilot chat when messages or typing status change
  useEffect(() => {
    copilotEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [copilotMessages, isCopilotTyping, activeTab]);

  // Helper to parse and render Markdown styling returned by Gemini (Bold, lists, and tables)
  const renderCopilotMessageText = (text: string) => {
    const lines = text.split('\n');
    let insideTable = false;
    let tableHeaders: string[] = [];
    let tableRows: string[][] = [];

    const parsedElements: React.ReactNode[] = [];
    let insideList = false;
    let currentListItems: React.ReactNode[] = [];

    const flushList = (key: number) => {
      if (currentListItems.length > 0) {
        parsedElements.push(
          <ul key={`list-${key}`} className="list-disc pl-5 my-2 space-y-1 text-slate-300">
            {currentListItems}
          </ul>
        );
        currentListItems = [];
        insideList = false;
      }
    };

    const flushTable = (key: number) => {
      if (tableRows.length > 0 || tableHeaders.length > 0) {
        parsedElements.push(
          <div key={`table-${key}`} className="my-3 overflow-x-auto rounded-xl border border-slate-800 shadow-lg">
            <table className="min-w-full divide-y divide-slate-800 text-xs">
              <thead className="bg-slate-900">
                <tr>
                  {tableHeaders.map((h, i) => (
                    <th key={i} className="px-4 py-2.5 text-left font-bold text-orange-450 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850 bg-slate-950/20">
                {tableRows.map((row, ri) => (
                  <tr key={ri} className="hover:bg-slate-900/20 transition-all">
                    {row.map((cell, ci) => (
                      <td key={ci} className="px-4 py-2 font-medium text-slate-300">{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        tableHeaders = [];
        tableRows = [];
        insideTable = false;
      }
    };

    const parseLineFormatting = (line: string): React.ReactNode => {
      const parts = line.split(/\*\*([\s\S]*?)\*\*/g);
      return parts.map((part, i) => {
        if (i % 2 === 1) {
          return <strong key={i} className="font-semibold text-orange-550">{part}</strong>;
        }
        return part;
      });
    };

    lines.forEach((line, index) => {
      const trimmed = line.trim();

      // 1. Table support
      if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
        flushList(index);
        if (trimmed.includes('---') || trimmed.includes('===')) {
          return;
        }
        const cells = trimmed.split('|').map(c => c.trim()).filter((_, i, arr) => i > 0 && i < arr.length - 1);
        if (!insideTable) {
          insideTable = true;
          tableHeaders = cells;
        } else {
          tableRows.push(cells);
        }
        return;
      } else {
        if (insideTable) {
          flushTable(index);
        }
      }

      // 2. Heading support
      if (trimmed.startsWith('### ')) {
        flushList(index);
        parsedElements.push(
          <h4 key={index} className="text-sm font-bold text-orange-500 mt-4 mb-1.5 tracking-tight">
            {parseLineFormatting(trimmed.substring(4))}
          </h4>
        );
        return;
      }
      if (trimmed.startsWith('## ')) {
        flushList(index);
        parsedElements.push(
          <h3 key={index} className="text-base font-bold text-orange-500 mt-5 mb-2 tracking-tight border-b border-slate-800 pb-1">
            {parseLineFormatting(trimmed.substring(3))}
          </h3>
        );
        return;
      }

      // 3. Unordered lists
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        insideList = true;
        const listText = trimmed.substring(2);
        currentListItems.push(
          <li key={`li-${index}`} className="text-xs">
            {parseLineFormatting(listText)}
          </li>
        );
        return;
      } else {
        if (insideList) {
          flushList(index);
        }
      }

      // 4. Empty line handling
      if (trimmed === '') {
        parsedElements.push(<div key={index} className="h-2" />);
        return;
      }

      // 5. Standard line
      parsedElements.push(
        <p key={index} className="text-xs md:text-sm my-1 font-light leading-relaxed">
          {parseLineFormatting(line)}
        </p>
      );
    });

    if (insideList) flushList(lines.length);
    if (insideTable) flushTable(lines.length);

    return <div className="space-y-1">{parsedElements}</div>;
  };

  // Helper to submit natural language database queries to the copilot endpoint
  const handleSendCopilotQuery = async (queryText?: string) => {
    const textToSend = queryText || copilotInput;
    if (!textToSend.trim() || isCopilotTyping) return;

    const userMsg = {
      sender: 'user' as const,
      text: textToSend,
      timestamp: new Date().toISOString()
    };

    setCopilotMessages(prev => [...prev, userMsg]);
    if (!queryText) {
      setCopilotInput('');
    }
    setIsCopilotTyping(true);

    try {
      const chatHistory = copilotMessages.slice(-10).map(m => ({
        sender: m.sender,
        text: m.text
      }));

      const res = await fetch('/api/copilot/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: textToSend,
          history: chatHistory
        })
      });

      if (!res.ok) {
        throw new Error('Error al conectar con el copiloto');
      }

      const data = await res.json();
      setCopilotMessages(prev => [...prev, {
        sender: 'bot' as const,
        text: data.answer,
        timestamp: new Date().toISOString()
      }]);
    } catch (err: any) {
      console.error('Error in copilot request:', err);
      setCopilotMessages(prev => [...prev, {
        sender: 'bot' as const,
        text: 'Lo siento, ocurrió un error al consultar la base de datos con la IA. Asegúrate de que el servidor esté activo y la API Key de Gemini esté configurada.',
        timestamp: new Date().toISOString()
      }]);
    } finally {
      setIsCopilotTyping(false);
    }
  };

  // Helper to copy text to clipboard
  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    showToast(`¡Código de ${label} copiado con éxito!`);
    setTimeout(() => setCopiedText(null), 3000);
  };

  // Toggle Bot Status (Pause / Resume AI)
  const handleToggleBot = async (phone: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/chats/${phone}/toggle-bot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bot_disabled: !currentStatus })
      });
      if (response.ok) {
        showToast(!currentStatus ? '🤖 Bot de Inteligencia Artificial PAUSADO' : '🤖 Bot de Inteligencia Artificial REACTIVADO');
      } else {
        showToast('Error al modificar estado del bot');
      }
    } catch (err) {
      showToast('Error al conectar con el servidor backend');
    }
  };

  // Send a manual message from the human agent
  const handleSendAgentMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChatPhone || !agentMessageText.trim()) return;

    const originalText = agentMessageText;
    setAgentMessageText('');

    try {
      const response = await fetch(`/api/chats/${selectedChatPhone}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: originalText })
      });
      if (response.ok) {
        showToast('Mensaje de agente enviado (Bot pausado automáticamente)');
      } else {
        showToast('Error al enviar el mensaje');
        setAgentMessageText(originalText);
      }
    } catch (err) {
      showToast('Fallo de conexión al enviar mensaje');
      setAgentMessageText(originalText);
    }
  };

  // Simulate incoming WhatsApp message
  const handleSimulateWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!simPhone.trim() || !simMessage.trim()) return;

    setIsSimulating(true);
    setSimResponse(null);
    
    const payload = {
      phone: simPhone,
      text: simMessage,
      name: simName || 'Cliente Simulado'
    };
    
    setSimPayload(JSON.stringify(payload, null, 2));
    
    const logItem = `[${new Date().toLocaleTimeString()}] Enviando mensaje desde +${simPhone}: "${simMessage}"`;
    setSimulationLog(prev => [logItem, ...prev]);

    try {
      const response = await fetch('/api/whatsapp-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (response.ok) {
        const data = await response.json();
        setSimResponse(data);
        
        const replyLog = `[${new Date().toLocaleTimeString()}] Respuesta recibida de Gemini AI: "${data.reply}"`;
        const leadLog = data.lead_generated 
          ? `[🔥 LEAD CALIFICADO] ¡Se detectó y registró un nuevo prospecto de paneles solares!`
          : `[💬 Conversación en curso] El bot sigue recopilando información.`;
          
        setSimulationLog(prev => {
          const logs = [leadLog, replyLog];
          if (data.email_sent) {
            logs.unshift(`[📧 EMAIL ENVIADO] ¡Notificación por correo enviada con éxito al equipo de ventas (ventas@o3energy.mx)!`);
          }
          return [...logs, ...prev];
        });
        showToast(data.lead_generated ? '🔥 ¡Nuevo Lead Calificado Detectado!' : 'Mensaje procesado con éxito');
      } else {
        const errorData = await response.text();
        setSimulationLog(prev => [`[❌ ERROR] Falló el webhook: ${errorData}`, ...prev]);
        showToast('Error en la simulación del Webhook');
      }
    } catch (err: any) {
      setSimulationLog(prev => [`[❌ ERROR RECHAZADO] No se pudo conectar: ${err.message}`, ...prev]);
      showToast('Error de red en la simulación');
    } finally {
      setIsSimulating(false);
      setSimMessage('');
    }
  };

  // Reset entire mock Database
  const handleResetDemo = async () => {
    if (confirm('¿Estás seguro de que deseas limpiar todo el historial de chats y los leads calificados? Esta acción vaciará la base de datos de pruebas.')) {
      try {
        const response = await fetch('/api/reset-demo', { method: 'POST' });
        if (response.ok) {
          setChats([]);
          setLeads([]);
          setSelectedChatPhone(null);
          setSimulationLog([]);
          setSimResponse(null);
          showToast('🧹 Base de datos del Playground restablecida con éxito.');
        }
      } catch (err) {
        showToast('Error de red al restablecer base de datos.');
      }
    }
  };

  // Set contacted status on lead
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

  // Save private follow-up notes for a lead
  const handleSaveNotes = async (leadId: string, notes: string) => {
    setSavingNoteId(leadId);
    try {
      const response = await fetch(`/api/leads/${leadId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ private_notes: notes })
      });
      if (response.ok) {
        showToast('📝 Nota privada guardada con éxito');
        // Clear local unsaved edit state so it reflects the newly fetched backend data
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

  // Get selected chat object
  const selectedChat = chats.find(c => c.phone === selectedChatPhone);

  // Filter chats based on search
  const filteredChats = chats.filter(chat => {
    const searchLower = chatSearch.toLowerCase();
    const nombreMatch = (chat.nombre || '').toLowerCase().includes(searchLower);
    const phoneMatch = chat.phone.includes(searchLower);
    return nombreMatch || phoneMatch;
  });

  // Filter leads based on search
  const filteredLeads = leads.filter(lead => {
    const searchLower = leadsSearch.toLowerCase().trim();
    if (!searchLower) return true;
    const nombreMatch = (lead.nombre || '').toLowerCase().includes(searchLower);
    const phoneMatch = (lead.phone || '').includes(searchLower);
    const sistemaMatch = (lead.sistema_estimado || '').toLowerCase().includes(searchLower);
    return nombreMatch || phoneMatch || sistemaMatch;
  });

  // Helper to parse currency/cost strings
  const parseCost = (costStr: string): number => {
    if (!costStr) return 0;
    const cleanStr = costStr.replace(/[^0-9.]/g, '');
    const parsed = parseFloat(cleanStr);
    return isNaN(parsed) ? 0 : parsed;
  };

  // Helper to format currency values
  const formatCurrency = (val: number): string => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(val);
  };

  // Export leads to CSV file
  const exportLeadsToCSV = () => {
    if (filteredLeads.length === 0) {
      showToast('No hay leads calificados para exportar.');
      return;
    }

    // Define CSV Headers
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

    // Map lead rows
    const rows = filteredLeads.map((lead) => [
      lead.id,
      lead.nombre || '',
      lead.phone || '',
      lead.monto_recibo || '',
      lead.sistema_estimado || '',
      lead.costo_estimado || '',
      lead.status === 'pending_review' ? 'Pendiente de Contacto' : 'Contactado',
      lead.created_at ? new Date(lead.created_at).toLocaleString('es-MX') : '',
      lead.private_notes || ''
    ]);

    // Construct CSV Content with BOM for Spanish characters encoding in Excel
    const csvContent = [
      headers.join(','),
      ...rows.map(row => 
        row.map(value => {
          // Escape quotes and wrap in quotes if value contains comma, quotes, or newlines
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

  // Calculate Sales Metrics
  const pendingLeads = leads.filter(l => l.status === 'pending_review');
  const contactedLeads = leads.filter(l => l.status === 'contacted');

  const totalPendingValue = pendingLeads.reduce((sum, lead) => sum + parseCost(lead.costo_estimado), 0);
  const totalContactedValue = contactedLeads.reduce((sum, lead) => sum + parseCost(lead.costo_estimado), 0);
  const totalPipelineValue = totalPendingValue + totalContactedValue;

  const conversionRate = totalPipelineValue > 0 ? Math.round((totalContactedValue / totalPipelineValue) * 100) : 0;

  return (
    <div className={`flex h-screen overflow-hidden font-sans transition-colors duration-200 ${
      isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
    }`}>
      
      {/* SIDEBAR NAVIGATION */}
      <aside className={`w-80 flex flex-col z-10 border-r transition-colors duration-200 ${
        isDarkMode ? 'bg-slate-900 border-slate-800/80 text-slate-250' : 'bg-white border-slate-200 text-slate-700'
      }`}>
        {/* Header / Logo */}
        <div className={`p-6 border-b transition-colors duration-200 ${isDarkMode ? 'border-slate-800/80' : 'border-slate-200'}`}>
          <div className="flex items-center space-x-3">
            <div className="bg-orange-500/10 p-2 rounded-xl text-orange-500 border border-orange-500/30 shadow-md">
              <Zap className="h-5 w-5 fill-current animate-pulse" />
            </div>
            <div>
              <h1 className={`font-bold text-lg leading-tight tracking-tight transition-colors duration-200 ${
                isDarkMode ? 'text-white' : 'text-slate-900'
              }`}>O3 Energy</h1>
              <span className="text-[10px] text-orange-500 font-semibold tracking-wider uppercase">México AI Sales</span>
            </div>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 px-4 py-6 space-y-2.5 overflow-y-auto">
          <button
            onClick={() => setActiveTab('chats')}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 text-left border cursor-pointer ${
              activeTab === 'chats'
                ? isDarkMode
                  ? 'bg-orange-500/10 text-orange-500 border-orange-500/30 font-medium shadow-lg shadow-orange-950/30'
                  : 'bg-orange-50 text-orange-600 border-orange-500/30 font-semibold shadow-md shadow-orange-100'
                : isDarkMode
                ? 'text-slate-400 border-transparent hover:bg-slate-900/40 hover:text-slate-200'
                : 'text-slate-600 border-transparent hover:bg-slate-100 hover:text-slate-800'
            }`}
          >
            <div className="flex items-center space-x-3">
              <MessageSquare className="h-4 w-4" />
              <span className="text-sm font-medium">Monitor de Chats</span>
            </div>
            {chats.length > 0 && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                activeTab === 'chats' 
                  ? 'bg-orange-600 text-white' 
                  : isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-200 text-slate-600'
              }`}>
                {chats.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('leads')}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 text-left border cursor-pointer ${
              activeTab === 'leads'
                ? isDarkMode
                  ? 'bg-orange-500/10 text-orange-500 border-orange-500/30 font-medium shadow-lg shadow-orange-950/30'
                  : 'bg-orange-50 text-orange-600 border-orange-500/30 font-semibold shadow-md shadow-orange-100'
                : isDarkMode
                ? 'text-slate-400 border-transparent hover:bg-slate-900/40 hover:text-slate-200'
                : 'text-slate-600 border-transparent hover:bg-slate-100 hover:text-slate-800'
            }`}
          >
            <div className="flex items-center space-x-3">
              <Users className="h-4 w-4" />
              <span className="text-sm font-medium">Leads Calificados</span>
            </div>
            {leads.filter(l => l.status === 'pending_review').length > 0 && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold animate-pulse ${
                activeTab === 'leads' ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/30' : 'bg-orange-600 text-white'
              }`}>
                {leads.filter(l => l.status === 'pending_review').length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('copilot')}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 text-left border cursor-pointer ${
              activeTab === 'copilot'
                ? isDarkMode
                  ? 'bg-orange-500/10 text-orange-500 border-orange-500/30 font-medium shadow-lg shadow-orange-950/30'
                  : 'bg-orange-50 text-orange-600 border-orange-500/30 font-semibold shadow-md shadow-orange-100'
                : isDarkMode
                ? 'text-slate-400 border-transparent hover:bg-slate-900/40 hover:text-slate-200'
                : 'text-slate-600 border-transparent hover:bg-slate-100 hover:text-slate-800'
            }`}
          >
            <div className="flex items-center space-x-3">
              <Database className="h-4 w-4" />
              <span className="text-sm font-medium">Copiloto IA (DB)</span>
            </div>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
              activeTab === 'copilot'
                ? 'bg-orange-600 text-white'
                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 animate-pulse'
            }`}>
              NUEVO
            </span>
          </button>

          <button
            onClick={() => setActiveTab('simulator')}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 text-left border cursor-pointer ${
              activeTab === 'simulator'
                ? isDarkMode
                  ? 'bg-orange-500/10 text-orange-500 border-orange-500/30 font-medium shadow-lg shadow-orange-950/30'
                  : 'bg-orange-50 text-orange-600 border-orange-500/30 font-semibold shadow-md shadow-orange-100'
                : isDarkMode
                ? 'text-slate-400 border-transparent hover:bg-slate-900/40 hover:text-slate-200'
                : 'text-slate-600 border-transparent hover:bg-slate-100 hover:text-slate-800'
            }`}
          >
            <div className="flex items-center space-x-3">
              <Sparkles className="h-4 w-4" />
              <span className="text-sm font-medium">Simulador Webhook</span>
            </div>
            <span className={`text-[9px] border px-2 py-0.5 rounded font-mono ${
              isDarkMode 
                ? 'bg-slate-900 text-orange-400 border-orange-500/20' 
                : 'bg-orange-50 text-orange-600 border-orange-200'
            }`}>
              PLAYGROUND
            </span>
          </button>

          <button
            onClick={() => setActiveTab('guide')}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 text-left border cursor-pointer ${
              activeTab === 'guide'
                ? isDarkMode
                  ? 'bg-orange-500/10 text-orange-500 border-orange-500/30 font-medium shadow-lg shadow-orange-950/30'
                  : 'bg-orange-50 text-orange-600 border-orange-500/30 font-semibold shadow-md shadow-orange-100'
                : isDarkMode
                ? 'text-slate-400 border-transparent hover:bg-slate-900/40 hover:text-slate-200'
                : 'text-slate-600 border-transparent hover:bg-slate-100 hover:text-slate-800'
            }`}
          >
            <div className="flex items-center space-x-3">
              <BookOpen className="h-4 w-4" />
              <span className="text-sm font-medium">Código Python / Guía</span>
            </div>
            <Code className="h-3.5 w-3.5 text-orange-500" />
          </button>
        </nav>

        {/* Footer / Status Area */}
        <div className={`p-4 border-t space-y-3 transition-colors duration-200 ${
          isDarkMode ? 'bg-slate-950/30 border-slate-800/80' : 'bg-slate-50 border-slate-200'
        }`}>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-550">Firestore DB:</span>
            <span className={`flex items-center font-medium ${isFirebaseConnected ? 'text-emerald-500' : 'text-amber-500'}`}>
              <span className={`h-2 w-2 rounded-full mr-1.5 ${isFirebaseConnected ? 'bg-emerald-500 shadow-sm shadow-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
              {isFirebaseConnected ? 'Conectado Real-time' : 'REST Polling Activo'}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-550">Gemini Engine:</span>
            <span className={`font-medium flex items-center ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>
              <Server className="h-3 w-3 mr-1" />
              gemini-2.0-flash
            </span>
          </div>
          {lastRefreshed && (
            <div className={`text-[10px] text-right font-mono ${isDarkMode ? 'text-slate-600' : 'text-slate-500'}`}>
              Refrescado: {lastRefreshed}
            </div>
          )}
          <button 
            onClick={handleResetDemo}
            className={`w-full flex items-center justify-center space-x-2 py-2 px-3 border rounded-xl transition-all duration-200 font-medium cursor-pointer text-xs ${
              isDarkMode 
                ? 'border-slate-800/80 hover:bg-red-950/20 hover:border-red-900 text-slate-500 hover:text-red-400' 
                : 'border-slate-200 hover:bg-red-50 hover:border-red-200 text-slate-500 hover:text-red-600'
            }`}
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Vaciar DB de Pruebas</span>
          </button>
        </div>
      </aside>

      {/* MAIN LAYOUT CANVAS */}
      <main className={`flex-1 flex flex-col overflow-hidden relative transition-colors duration-200 ${
        isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
      }`}>
        
        {/* BARRA SUPERIOR (TOP BAR) */}
        <header className={`h-16 border-b flex items-center justify-between px-6 z-10 shrink-0 transition-colors duration-200 ${
          isDarkMode ? 'bg-slate-900 border-slate-800/80' : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center space-x-3">
            <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider ${
              isDarkMode ? 'bg-slate-950 text-slate-400 border border-slate-850' : 'bg-slate-100 text-slate-600 border border-slate-200'
            }`}>
              {activeTab === 'chats' ? '💬 Monitor de Chats' : activeTab === 'leads' ? '👥 Leads Calificados' : activeTab === 'copilot' ? '🤖 Copiloto IA (DB)' : activeTab === 'simulator' ? '🧪 Simulador' : '📚 Guía'}
            </span>
            <div className="hidden sm:flex items-center space-x-1.5 text-xs">
              <span className={isDarkMode ? 'text-slate-650' : 'text-slate-300'}>|</span>
              <span className="font-semibold text-emerald-500 flex items-center">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse mr-1.5" />
                Sistema en Línea (Gemini)
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* NOTIFICATION PERMISSION TRIGGER */}
            {'Notification' in window && (
              <button
                type="button"
                onClick={requestNotificationPermission}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all duration-200 cursor-pointer ${
                  notificationPermission === 'granted'
                    ? isDarkMode 
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-emerald-50 text-emerald-600 border-emerald-200 shadow-sm'
                    : notificationPermission === 'denied'
                    ? isDarkMode
                      ? 'bg-red-500/10 text-red-400 border-red-500/20'
                      : 'bg-red-50 text-red-600 border-red-200 shadow-sm'
                    : isDarkMode
                    ? 'bg-slate-800 hover:bg-slate-750 text-slate-300 border-slate-700'
                    : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200 shadow-sm'
                }`}
                title={
                  notificationPermission === 'granted'
                    ? 'Notificaciones de navegador activadas'
                    : notificationPermission === 'denied'
                    ? 'Notificaciones bloqueadas por el navegador'
                    : 'Activar notificaciones de escritorio'
                }
              >
                {notificationPermission === 'granted' ? (
                  <>
                    <Bell className="h-3.5 w-3.5 text-emerald-500 fill-current animate-bounce mr-0.5" />
                    <span className="hidden sm:inline">Alertas Activas</span>
                  </>
                ) : notificationPermission === 'denied' ? (
                  <>
                    <BellOff className="h-3.5 w-3.5 text-red-500" />
                    <span className="hidden sm:inline">Alertas Bloqueadas</span>
                  </>
                ) : (
                  <>
                    <Bell className="h-3.5 w-3.5 text-orange-500 animate-pulse mr-0.5" />
                    <span className="hidden sm:inline">Activar Alertas</span>
                  </>
                )}
              </button>
            )}

            {/* TEMA SWITCH */}
            <div className="flex items-center space-x-2">
              <span className={`text-xs font-medium transition-colors duration-250 ${!isDarkMode ? 'text-slate-900 font-semibold' : 'text-slate-400'}`}>☀️ Claro</span>
              <button
                type="button"
                onClick={() => setIsDarkMode(!isDarkMode)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isDarkMode ? 'bg-orange-500' : 'bg-slate-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    isDarkMode ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
              <span className={`text-xs font-medium transition-colors duration-250 ${isDarkMode ? 'text-slate-100 font-semibold' : 'text-slate-500'}`}>🌑 Oscuro</span>
            </div>
          </div>
        </header>

        {/* TOAST SYSTEM */}
        <AnimatePresence>
          {toastMessage && (
            <motion.div
              initial={{ opacity: 0, y: -50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className={`absolute top-6 left-1/2 transform -translate-x-1/2 z-50 border px-5 py-3 rounded-xl shadow-xl flex items-center space-x-3 text-sm font-medium transition-colors duration-200 ${
                isDarkMode 
                  ? 'bg-slate-900 border-orange-500 text-orange-400' 
                  : 'bg-white border-orange-500 text-orange-600'
              }`}
            >
              <Sparkles className="h-4 w-4 animate-spin text-orange-500" />
              <span>{toastMessage}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* TAB CONTENTS */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'chats' && (
            <div className="flex h-full overflow-hidden">
              {/* CHATS LIST COLUMN */}
              <div className={`w-80 border-r flex flex-col transition-colors duration-200 ${
                isDarkMode ? 'border-slate-800/80 bg-slate-900/10' : 'border-slate-200 bg-white'
              }`}>
                <div className={`p-4 border-b space-y-3 transition-colors duration-200 ${isDarkMode ? 'border-slate-800/80' : 'border-slate-200'}`}>
                  <h2 className={`text-sm font-bold uppercase tracking-wider flex items-center transition-colors duration-200 ${
                    isDarkMode ? 'text-slate-200' : 'text-slate-700'
                  }`}>
                    <MessageSquare className="h-4 w-4 mr-2 text-orange-500" />
                    Monitor de Chats
                  </h2>
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Buscar por nombre o número..."
                      value={chatSearch}
                      onChange={(e) => setChatSearch(e.target.value)}
                      className={`w-full pl-9 pr-4 py-2 border rounded-xl text-xs transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/40 ${
                        isDarkMode 
                          ? 'bg-slate-950/60 border-slate-800 text-slate-200 placeholder:text-slate-500' 
                          : 'bg-slate-50 border-slate-250 text-slate-900 placeholder:text-slate-400'
                      }`}
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto divide-y divide-slate-800/20">
                  {filteredChats.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 space-y-3">
                      <MessageSquare className="h-8 w-8 mx-auto stroke-1 text-slate-600" />
                      <p className="text-xs">No se encontraron chats activos.</p>
                      <button 
                        onClick={() => setActiveTab('simulator')}
                        className="text-orange-550 font-semibold text-xs hover:underline cursor-pointer"
                      >
                        Iniciar simulación en Playground →
                      </button>
                    </div>
                  ) : (
                    filteredChats.map((chat) => {
                      const lastMsg = chat.messages?.[chat.messages.length - 1];
                      const isUnqualified = !chat.monto_recibo;
                      return (
                        <button
                          key={chat.phone}
                          onClick={() => setSelectedChatPhone(chat.phone)}
                          className={`w-full p-4 text-left border-b transition-all duration-150 block cursor-pointer ${
                            selectedChatPhone === chat.phone
                              ? isDarkMode
                                ? 'bg-slate-900/60 border-l-4 border-orange-500 border-b-slate-800'
                                : 'bg-orange-50/60 border-l-4 border-orange-500 border-b-slate-100'
                              : isDarkMode
                              ? 'hover:bg-slate-900/25 border-l-4 border-transparent border-b-slate-900/40'
                              : 'hover:bg-slate-50 border-l-4 border-transparent border-b-slate-100'
                          }`}
                        >
                          <div className="flex justify-between items-start mb-1">
                            <span className={`font-semibold text-sm truncate block max-w-[150px] transition-colors duration-200 ${
                              isDarkMode ? 'text-slate-200' : 'text-slate-800'
                            }`}>
                              {chat.nombre || 'Cliente WhatsApp'}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              {chat.last_message_at ? new Date(chat.last_message_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}
                            </span>
                          </div>
                          
                          <div className={`text-xs font-mono mb-2 transition-colors duration-200 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                            +{chat.phone}
                          </div>

                          {lastMsg && (
                            <p className={`text-xs truncate max-w-[200px] mb-2 font-light transition-colors duration-200 ${
                              isDarkMode ? 'text-slate-400' : 'text-slate-600'
                            }`}>
                              {lastMsg.sender === 'bot' ? '🤖 ' : lastMsg.sender === 'agent' ? '👨‍💼 ' : ''}
                              {lastMsg.text}
                            </p>
                          )}

                          <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                            {chat.bot_disabled ? (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-550 border border-amber-500/20">
                                <Pause className="h-2 w-2 mr-0.5 fill-current" /> IA Pausada
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                                <Play className="h-2 w-2 mr-0.5 fill-current animate-pulse" /> IA Activa
                              </span>
                            )}

                            {!isUnqualified && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-500/10 text-orange-600 border border-orange-500/20">
                                🔥 Calificado ({chat.monto_recibo})
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* CONVERSATION VIEW COLUMN */}
              <div className="flex-1 flex flex-col h-full overflow-hidden">
                {selectedChat ? (
                  <>
                    {/* Chat Header */}
                    <div className={`p-4 border-b flex items-center justify-between shadow-sm z-10 backdrop-blur-md transition-colors duration-200 ${
                      isDarkMode ? 'bg-slate-900/40 border-slate-800/80' : 'bg-white border-slate-200'
                    }`}>
                      <div className="flex items-center space-x-3">
                        <div className={`h-10 w-10 rounded-full border flex items-center justify-center font-semibold shadow-sm transition-colors duration-200 ${
                          isDarkMode ? 'bg-slate-800 border-slate-700/80 text-slate-200' : 'bg-slate-100 border-slate-200 text-slate-700'
                        }`}>
                          {selectedChat.nombre?.slice(0, 2).toUpperCase() || 'WA'}
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <h3 className={`font-bold text-sm leading-tight transition-colors duration-200 ${
                              isDarkMode ? 'text-slate-100' : 'text-slate-900'
                            }`}>{selectedChat.nombre || 'Cliente WhatsApp'}</h3>
                            {selectedChat.monto_recibo && (
                              <span className="bg-orange-500/10 text-orange-600 border border-orange-500/20 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center">
                                <Sparkles className="h-2.5 w-2.5 mr-0.5 text-orange-500 fill-current" /> Lead Calificado
                              </span>
                            )}
                          </div>
                          <span className={`text-xs transition-colors duration-200 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Teléfono: +{selectedChat.phone}</span>
                        </div>
                      </div>

                      {/* Bot Control Panel */}
                      <div className="flex items-center space-x-3">
                        <div className="text-right mr-1 hidden md:block">
                          <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wide">Status del Asistente</p>
                          <p className={`text-xs font-bold ${selectedChat.bot_disabled ? 'text-amber-500' : 'text-emerald-500'}`}>
                            {selectedChat.bot_disabled ? 'PAUSADO (Manual)' : 'ACTIVO (Conversando)'}
                          </p>
                        </div>
                        
                        <button
                          onClick={() => handleToggleBot(selectedChat.phone, selectedChat.bot_disabled)}
                          className={`flex items-center space-x-2 py-2 px-4 rounded-xl text-xs font-semibold shadow-sm transition-all duration-200 cursor-pointer ${
                            selectedChat.bot_disabled
                              ? 'bg-orange-600 hover:bg-orange-700 text-white'
                              : 'bg-amber-500/10 hover:bg-amber-500/25 text-amber-500 border border-amber-500/20'
                          }`}
                        >
                          {selectedChat.bot_disabled ? (
                            <>
                              <Play className="h-3.5 w-3.5 fill-current" />
                              <span>Reactivar Bot de IA</span>
                            </>
                          ) : (
                            <>
                              <Pause className="h-3.5 w-3.5 fill-current" />
                              <span>Pausar Bot de IA</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Pre-quotation quick bar if qualified */}
                    {selectedChat.monto_recibo && (
                      <div className={`border-b p-4 flex flex-wrap gap-4 items-center justify-between text-xs transition-colors duration-200 ${
                        isDarkMode 
                          ? 'bg-gradient-to-r from-orange-950/10 to-slate-900/30 border-slate-800/80 text-slate-300' 
                          : 'bg-gradient-to-r from-orange-50/40 to-slate-50/20 border-slate-200 text-slate-800'
                      }`}>
                        <div className="flex items-center space-x-5">
                          <div>
                            <span className="text-slate-500 block font-semibold uppercase text-[9px] tracking-wide">Gasto Promedio CFE</span>
                            <span className={`font-bold text-sm ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>{selectedChat.monto_recibo}</span>
                          </div>
                          <div className={`border-l h-8 ${isDarkMode ? 'border-slate-800/80' : 'border-slate-200'}`}></div>
                          <div>
                            <span className="text-slate-500 block font-semibold uppercase text-[9px] tracking-wide">Sistema Propuesto</span>
                            <span className={`font-bold text-sm flex items-center ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                              <Layers className="h-3.5 w-3.5 text-orange-500 mr-1" />
                              {selectedChat.sistema_estimado}
                            </span>
                          </div>
                          <div className={`border-l h-8 ${isDarkMode ? 'border-slate-800/80' : 'border-slate-200'}`}></div>
                          <div>
                            <span className="text-slate-500 block font-semibold uppercase text-[9px] tracking-wide font-sans">Presupuesto Estimado</span>
                            <span className="font-bold text-orange-500 text-sm">{selectedChat.costo_estimado}</span>
                          </div>
                        </div>

                        <a
                          href={`https://wa.me/${selectedChat.phone}`}
                          target="_blank"
                          referrerPolicy="no-referrer"
                          className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded-xl flex items-center space-x-2 transition shadow-sm text-xs cursor-pointer"
                        >
                          <Phone className="h-3.5 w-3.5 fill-current" />
                          <span>Atender en WhatsApp</span>
                        </a>
                      </div>
                    )}

                    {/* Messages Body */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-4">
                      {selectedChat.messages && selectedChat.messages.length > 0 ? (
                        selectedChat.messages.map((msg, index) => {
                          const isUser = msg.sender === 'user';
                          const isBot = msg.sender === 'bot';
                          const isAgent = msg.sender === 'agent';
                          
                          return (
                            <div
                              key={index}
                              className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                            >
                              <div
                                className={`max-w-[70%] rounded-2xl p-4 shadow-sm border transition-colors duration-200 ${
                                  isUser
                                    ? isDarkMode
                                      ? 'bg-orange-500/10 text-orange-400 border-orange-500/20 rounded-tr-none'
                                      : 'bg-orange-50 text-orange-850 border-orange-200 rounded-tr-none'
                                    : isAgent
                                    ? isDarkMode
                                      ? 'bg-slate-800 text-slate-100 rounded-tr-none border-slate-700/50'
                                      : 'bg-white text-slate-800 rounded-tr-none border-slate-200 shadow-xs'
                                    : 'bg-orange-600 text-white border-orange-500 rounded-tl-none'
                                }`}
                              >
                                <div className={`flex items-center justify-between space-x-4 mb-1 border-b pb-1 ${
                                  isUser 
                                    ? 'border-orange-500/10' 
                                    : isDarkMode ? 'border-slate-800/40' : 'border-slate-100'
                                }`}>
                                  <span className="text-[10px] font-bold tracking-wide uppercase opacity-75">
                                    {isUser ? 'Cliente' : isAgent ? 'Asesor (Tú)' : 'Bot de IA (O3 Energy)'}
                                  </span>
                                  <span className="text-[9px] opacity-60 font-mono">
                                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                                <p className="text-sm leading-relaxed whitespace-pre-wrap font-light">{msg.text}</p>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-center py-20 text-slate-500">
                          <MessageSquare className="h-12 w-12 mx-auto stroke-1 mb-2 text-slate-600" />
                          <p className="text-sm">No hay mensajes registrados.</p>
                        </div>
                      )}
                      <div ref={messagesEndRef} />
                    </div>

                    {/* Manual Reply Footer */}
                    <form onSubmit={handleSendAgentMessage} className={`p-4 border-t backdrop-blur-md transition-colors duration-200 ${
                      isDarkMode ? 'bg-slate-900/40 border-slate-800/80' : 'bg-white border-slate-200'
                    }`}>
                      {selectedChat.bot_disabled ? (
                        <div className="mb-2 text-xs text-amber-500 bg-amber-500/5 border border-amber-500/20 px-3 py-1.5 rounded-lg flex items-center space-x-1.5">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                          <span>El bot está **Pausado**. Tus mensajes se enviarán de forma manual y el bot no responderá automáticamente.</span>
                        </div>
                      ) : (
                        <div className="mb-2 text-xs text-orange-500 bg-orange-500/5 border border-orange-500/20 px-3 py-1.5 rounded-lg flex items-center space-x-1.5">
                          <Sparkles className="h-3.5 w-3.5 shrink-0 animate-pulse" />
                          <span>El bot de IA está **Activo**. Si envías un mensaje manual, el bot se pausará automáticamente para evitar empalmarse.</span>
                        </div>
                      )}

                      <div className="flex space-x-3">
                        <input
                          type="text"
                          value={agentMessageText}
                          onChange={(e) => setAgentMessageText(e.target.value)}
                          placeholder="Escribe una respuesta manual al cliente (Silenciará el Bot de IA)..."
                          className={`flex-1 px-4 py-3 border rounded-xl text-sm transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/40 ${
                            isDarkMode 
                              ? 'bg-slate-950 border-slate-800 text-slate-200 placeholder:text-slate-500' 
                              : 'bg-slate-50 border-slate-250 text-slate-900 placeholder:text-slate-400'
                          }`}
                        />
                        <button
                          type="submit"
                          className={`py-3 px-5 border rounded-xl font-bold transition flex items-center justify-center space-x-2 text-sm shadow-sm cursor-pointer ${
                            isDarkMode 
                              ? 'bg-slate-850 hover:bg-slate-800 text-white border-slate-800' 
                              : 'bg-orange-600 hover:bg-orange-700 text-white border-orange-600'
                          }`}
                        >
                          <Send className="h-4 w-4" />
                          <span>Enviar</span>
                        </button>
                      </div>
                    </form>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
                    <div className={`p-5 rounded-3xl border shadow-md transition-colors duration-200 ${
                      isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                    }`}>
                      <MessageSquare className="h-16 w-16 stroke-1 text-orange-500" />
                    </div>
                    <div>
                      <h4 className={`font-bold text-lg transition-colors duration-200 ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>Historial de Conversaciones</h4>
                      <p className={`text-sm max-w-sm mt-1 font-light transition-colors duration-200 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                        Selecciona un número de teléfono de la lista de la izquierda para monitorizar su chat con la IA o intervenir manualmente.
                      </p>
                    </div>
                    <button 
                      onClick={() => setActiveTab('simulator')}
                      className="mt-2 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs py-2.5 px-5 rounded-xl shadow-md transition cursor-pointer"
                    >
                      Abrir Simulador de WhatsApp
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'leads' && (
            <div className="p-8 h-full overflow-y-auto space-y-6">
              {/* Header */}
              <div className={`flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b pb-5 transition-colors duration-200 ${
                isDarkMode ? 'border-slate-800/80' : 'border-slate-200'
              }`}>
                <div>
                  <h2 className={`text-2xl font-bold flex items-center tracking-tight transition-colors duration-200 ${
                    isDarkMode ? 'text-white' : 'text-slate-900'
                  }`}>
                    <Users className="h-6 w-6 mr-3 text-orange-500" />
                    Leads Calificados y Pre-Cotizaciones
                  </h2>
                  <p className={`text-sm mt-1 font-light transition-colors duration-200 ${
                    isDarkMode ? 'text-slate-400' : 'text-slate-600'
                  }`}>
                    Clientes potenciales calificados de forma autónoma basados en su gasto eléctrico superior a $2,500 MXN.
                  </p>
                </div>
              </div>

              {/* SECCIÓN DE MÉTRICAS DE VENTAS */}
              {leads.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="h-4 w-4 text-orange-500" />
                    <h3 className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                      Métricas de Ventas & Valor del Pipeline
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Tarjeta 1: Cotizaciones Pendientes */}
                    <div className={`backdrop-blur-md border p-5 rounded-2xl flex flex-col justify-between shadow-lg transition-all duration-200 ${
                      isDarkMode ? 'bg-slate-900/30 border-slate-800/80 text-white' : 'bg-white border-slate-200 text-slate-950'
                    }`}>
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Valor en Cotizaciones Pendientes</span>
                          <h3 className={`text-2xl font-bold tracking-tight transition-colors duration-200 ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`}>
                            {formatCurrency(totalPendingValue)}
                          </h3>
                        </div>
                        <div className="bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20 text-amber-500">
                          <Clock className="h-5 w-5" />
                        </div>
                      </div>
                      
                      <div className="mt-4 pt-3 border-t border-slate-500/10 flex items-center justify-between text-xs">
                        <span className="text-slate-500 text-[11px]">Pipeline pendiente</span>
                        <div className="flex items-center text-amber-500 font-semibold bg-amber-500/10 px-2 py-0.5 rounded-full text-[10px]">
                          <TrendingUp className="h-3 w-3 mr-1" />
                          <span>+14.8% esta semana</span>
                        </div>
                      </div>
                    </div>

                    {/* Tarjeta 2: Leads Contactados */}
                    <div className={`backdrop-blur-md border p-5 rounded-2xl flex flex-col justify-between shadow-lg transition-all duration-200 ${
                      isDarkMode ? 'bg-slate-900/30 border-slate-800/80 text-white' : 'bg-white border-slate-200 text-slate-950'
                    }`}>
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Valor de Leads Contactados</span>
                          <h3 className={`text-2xl font-bold tracking-tight transition-colors duration-200 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>
                            {formatCurrency(totalContactedValue)}
                          </h3>
                        </div>
                        <div className="bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/20 text-emerald-500">
                          <CheckCircle className="h-5 w-5" />
                        </div>
                      </div>
                      
                      <div className="mt-4 pt-3 border-t border-slate-500/10 flex items-center justify-between text-xs">
                        <span className="text-slate-500 text-[11px]">Pipeline contactado</span>
                        <div className="flex items-center text-emerald-500 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full text-[10px]">
                          <TrendingUp className="h-3 w-3 mr-1" />
                          <span>+22.4% vs mes ant.</span>
                        </div>
                      </div>
                    </div>

                    {/* Tarjeta 3: Conversión y Pipeline Total */}
                    <div className={`backdrop-blur-md border p-5 rounded-2xl flex flex-col justify-between shadow-lg transition-all duration-200 md:col-span-2 lg:col-span-1 ${
                      isDarkMode ? 'bg-slate-900/30 border-slate-800/80 text-white' : 'bg-white border-slate-200 text-slate-950'
                    }`}>
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Valor Total del Pipeline</span>
                          <h3 className={`text-2xl font-bold tracking-tight transition-colors duration-200 ${isDarkMode ? 'text-orange-400' : 'text-orange-600'}`}>
                            {formatCurrency(totalPipelineValue)}
                          </h3>
                        </div>
                        <div className="bg-orange-500/10 p-2.5 rounded-xl border border-orange-500/20 text-orange-500">
                          <DollarSign className="h-5 w-5" />
                        </div>
                      </div>
                      
                      <div className="mt-4 pt-3 border-t border-slate-500/10 flex items-center justify-between text-xs">
                        <span className="text-slate-500 text-[11px]">Conversión / contacto</span>
                        <div className="flex items-center text-orange-500 font-semibold bg-orange-500/10 px-2 py-0.5 rounded-full text-[10px]">
                          <Sparkles className="h-3 w-3 mr-1 animate-pulse" />
                          <span>{conversionRate}% del total</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STATS BENTO ROW */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className={`backdrop-blur-md border p-5 rounded-2xl flex items-center justify-between shadow-lg transition-all duration-200 ${
                  isDarkMode ? 'bg-slate-900/30 border-slate-800/80 text-white' : 'bg-white border-slate-200 text-slate-950'
                }`}>
                  <div className="space-y-1">
                    <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Total Calificados</span>
                    <h3 className={`text-3xl font-bold tracking-tight transition-colors duration-200 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{leads.length}</h3>
                  </div>
                  <div className="bg-orange-500/10 p-3 rounded-xl border border-orange-500/20 text-orange-500">
                    <Users className="h-6 w-6" />
                  </div>
                </div>

                <div className={`backdrop-blur-md border p-5 rounded-2xl flex items-center justify-between shadow-lg transition-all duration-200 ${
                  isDarkMode ? 'bg-slate-900/30 border-slate-800/80 text-white' : 'bg-white border-slate-200 text-slate-950'
                }`}>
                  <div className="space-y-1">
                    <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Pendientes de Contacto</span>
                    <h3 className="text-3xl font-bold text-amber-500 tracking-tight">
                      {leads.filter(l => l.status === 'pending_review').length}
                    </h3>
                  </div>
                  <div className="bg-amber-500/10 p-3 rounded-xl border border-amber-500/20 text-amber-500">
                    <Clock className="h-6 w-6 animate-pulse" />
                  </div>
                </div>

                <div className={`backdrop-blur-md border p-5 rounded-2xl flex items-center justify-between shadow-lg transition-all duration-200 ${
                  isDarkMode ? 'bg-slate-900/30 border-slate-800/80 text-white' : 'bg-white border-slate-200 text-slate-950'
                }`}>
                  <div className="space-y-1">
                    <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Contactados</span>
                    <h3 className="text-3xl font-bold text-emerald-500 tracking-tight">
                      {leads.filter(l => l.status === 'contacted').length}
                    </h3>
                  </div>
                  <div className="bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20 text-emerald-500">
                    <CheckCircle className="h-6 w-6" />
                  </div>
                </div>
              </div>

              {/* DISTRIBUCIÓN DE SISTEMAS RECOMENDADOS (GRÁFICA DE ANILLOS) */}
              {leads.length > 0 && (
                <div className={`backdrop-blur-md border p-6 rounded-2xl shadow-lg grid grid-cols-1 md:grid-cols-12 gap-6 items-center transition-all duration-200 ${
                  isDarkMode ? 'bg-slate-900/30 border-slate-800/80' : 'bg-white border-slate-200'
                }`}>
                  <div className="md:col-span-6 space-y-2">
                    <h3 className={`text-lg font-bold tracking-tight flex items-center transition-colors duration-200 ${
                      isDarkMode ? 'text-slate-100' : 'text-slate-900'
                    }`}>
                      <Zap className="h-5 w-5 mr-2 text-orange-500" />
                      Distribución por Sistema Solar Recomendado
                    </h3>
                    <p className={`text-xs font-light max-w-md transition-colors duration-200 ${
                      isDarkMode ? 'text-slate-400' : 'text-slate-600'
                    }`}>
                      Muestra la proporción de proyectos residenciales calificados según la cantidad de paneles solares calculada de forma dinámica por la inteligencia artificial de Gemini.
                    </p>
                    <div className="grid grid-cols-2 gap-2 pt-2">
                      {systemData.map((data, idx) => (
                        <div key={idx} className="flex items-center space-x-2 text-xs">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: data.color }} />
                          <span className={`font-light truncate transition-colors duration-200 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                            {data.name}: <span className={`font-semibold ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>{data.value}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="md:col-span-6 h-48 flex justify-center items-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={systemData}
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={65}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {systemData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: isDarkMode ? '#0f172a' : '#ffffff',
                            border: `1px solid ${isDarkMode ? '#1e293b' : '#cbd5e1'}`,
                            borderRadius: '12px',
                            color: isDarkMode ? '#f8fafc' : '#0f172a',
                            fontSize: '11px',
                            fontFamily: 'sans-serif'
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Buscador de Leads */}
              {leads.length > 0 && (
                <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
                  <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center flex-1">
                    <div className="relative w-full sm:max-w-md">
                      <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                      <input
                        type="text"
                        placeholder="Buscar por nombre, teléfono o tamaño de sistema..."
                        value={leadsSearch}
                        onChange={(e) => setLeadsSearch(e.target.value)}
                        className={`w-full pl-10 pr-10 py-2.5 border rounded-xl text-xs transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/40 ${
                          isDarkMode 
                            ? 'bg-slate-900/40 backdrop-blur-md border-slate-800 text-slate-200 placeholder:text-slate-500' 
                            : 'bg-white border-slate-250 text-slate-900 placeholder:text-slate-400'
                        }`}
                      />
                      {leadsSearch && (
                        <button 
                          onClick={() => setLeadsSearch('')}
                          className={`absolute right-3 top-2.5 p-1 rounded-full text-xs hover:bg-slate-500/10 transition-colors duration-200 ${
                            isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'
                          }`}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    {leadsSearch && (
                      <div className="text-xs font-light text-slate-500 shrink-0 self-center">
                        Encontrados: <span className="font-semibold text-orange-500">{filteredLeads.length}</span> de {leads.length}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={exportLeadsToCSV}
                    className={`flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl border text-xs font-medium transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md ${
                      isDarkMode
                        ? 'bg-slate-900/60 hover:bg-slate-800/80 text-emerald-400 border-slate-800 hover:border-slate-700'
                        : 'bg-white hover:bg-slate-50 text-emerald-600 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <Download className="h-4 w-4" />
                    <span>Exportar CSV / Excel</span>
                  </button>
                </div>
              )}

              {/* Grid de Leads */}
              {leads.length === 0 ? (
                <div className={`border rounded-3xl p-16 text-center max-w-lg mx-auto space-y-4 shadow-xl transition-all duration-200 ${
                  isDarkMode ? 'bg-slate-900/20 border-slate-800/80' : 'bg-white border-slate-200'
                }`}>
                  <div className="bg-orange-500/10 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto text-orange-500 border border-orange-500/20">
                    <UserCheck className="h-8 w-8" />
                  </div>
                  <div>
                    <h4 className={`font-bold text-lg transition-colors duration-200 ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>Aún no hay Leads calificados</h4>
                    <p className={`text-sm mt-1 font-light transition-colors duration-200 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                      Envía mensajes a través de nuestro simulador y responde las preguntas clave de O3 Energy para verlos aparecer aquí en tiempo real.
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab('simulator')}
                    className="bg-orange-600 hover:bg-orange-700 text-white font-semibold text-xs py-2.5 px-5 rounded-xl transition cursor-pointer"
                  >
                    Simular Primer Lead en vivo →
                  </button>
                </div>
              ) : filteredLeads.length === 0 ? (
                <div className={`border rounded-3xl p-12 text-center max-w-md mx-auto space-y-4 shadow-md transition-all duration-200 ${
                  isDarkMode ? 'bg-slate-900/20 border-slate-800/80' : 'bg-white border-slate-200'
                }`}>
                  <div className="bg-slate-500/10 p-3 rounded-full w-12 h-12 flex items-center justify-center mx-auto text-slate-500 border border-slate-500/20">
                    <Search className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className={`font-bold text-base transition-colors duration-200 ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>Sin resultados</h4>
                    <p className={`text-xs mt-1 font-light transition-colors duration-200 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                      No encontramos ningún lead que coincida con tu búsqueda. Intenta con otro término.
                    </p>
                  </div>
                  <button
                    onClick={() => setLeadsSearch('')}
                    className="bg-slate-500 hover:bg-slate-600 text-white font-semibold text-xs py-2 px-4 rounded-xl transition cursor-pointer"
                  >
                    Limpiar Búsqueda
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredLeads.map((lead) => {
                    const isPending = lead.status === 'pending_review';
                    return (
                      <motion.div
                        layout
                        key={lead.id}
                        className={`backdrop-blur-md rounded-2xl border transition-all duration-300 overflow-hidden shadow-lg hover:shadow-orange-950/5 ${
                          isPending 
                            ? isDarkMode
                              ? 'bg-slate-900/30 border-orange-500/40 ring-2 ring-orange-500/5' 
                              : 'bg-white border-orange-400 ring-2 ring-orange-400/5'
                            : isDarkMode
                            ? 'bg-slate-900/30 border-slate-800/80 hover:border-slate-700/80'
                            : 'bg-white border-slate-200 hover:border-slate-350'
                        }`}
                      >
                        {/* Status bar */}
                        <div className={`px-4 py-2.5 text-xs font-semibold flex items-center justify-between transition-colors duration-200 ${
                          isPending 
                            ? 'bg-orange-500/10 text-orange-600 border-b border-orange-500/20' 
                            : isDarkMode 
                            ? 'bg-slate-950/60 text-slate-400 border-b border-slate-850' 
                            : 'bg-slate-100 text-slate-600 border-b border-slate-200'
                        }`}>
                          <span className="flex items-center">
                            <Clock className="h-3.5 w-3.5 mr-1 text-slate-500" />
                            {lead.created_at ? new Date(lead.created_at).toLocaleDateString() : 'Fecha Desconocida'}
                          </span>
                          <span className="tracking-wide">
                            {isPending ? '🔴 PENDIENTE REVISIÓN' : '🟢 CONTACTADO'}
                          </span>
                        </div>

                        {/* Card Content */}
                        <div className="p-5 space-y-4">
                          <div>
                            <h4 className={`font-bold text-base tracking-tight transition-colors duration-200 ${
                              isDarkMode ? 'text-slate-100' : 'text-slate-900'
                            }`}>{lead.nombre}</h4>
                            <p className="text-xs text-slate-400 font-mono flex items-center mt-1">
                              <Phone className="h-3 w-3 mr-1.5 text-slate-500" />
                              +{lead.phone}
                            </p>
                          </div>

                          <div className={`space-y-2.5 text-xs border-t border-b py-3.5 transition-colors duration-200 ${
                            isDarkMode ? 'border-slate-800/60' : 'border-slate-200'
                          }`}>
                            <div className="flex justify-between items-center">
                              <span className="text-slate-500">Gasto CFE (Recibo):</span>
                              <span className={`font-bold transition-colors duration-200 ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{lead.monto_recibo}</span>
                            </div>
                            <div className="flex justify-between items-start">
                              <span className="text-slate-500">Sistema Estimado:</span>
                              <span className={`font-semibold text-right transition-colors duration-200 ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{lead.sistema_estimado}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-slate-500">Inversión Aprox:</span>
                              <span className="font-bold text-orange-500 text-sm">{lead.costo_estimado}</span>
                            </div>
                          </div>

                          {/* Notas Privadas (Seguimiento Interno) */}
                          <div className="space-y-1.5 pt-1">
                            <div className="flex items-center justify-between text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                              <span className="flex items-center space-x-1">
                                <span className="text-slate-500">🔒</span>
                                <span className={isDarkMode ? 'text-slate-400' : 'text-slate-600'}>Notas Privadas (Seguimiento)</span>
                              </span>
                              {savingNoteId === lead.id && (
                                <span className="text-[10px] text-orange-500 animate-pulse flex items-center">
                                  <RefreshCw className="h-3 w-3 animate-spin mr-1" />
                                  Guardando...
                                </span>
                              )}
                            </div>
                            <textarea
                              rows={2}
                              value={editingNotes[lead.id] !== undefined ? editingNotes[lead.id] : (lead.private_notes || '')}
                              onChange={(e) => setEditingNotes(prev => ({ ...prev, [lead.id]: e.target.value }))}
                              placeholder="Escribe comentarios internos o seguimiento aquí..."
                              className={`w-full border rounded-xl p-2.5 text-xs resize-none font-light transition-colors duration-200 focus:outline-none focus:ring-1 focus:ring-orange-500/30 focus:border-orange-500/30 ${
                                isDarkMode 
                                  ? 'bg-slate-950/60 border-slate-800 text-slate-300 placeholder-slate-700' 
                                  : 'bg-slate-50 border-slate-250 text-slate-800 placeholder-slate-400'
                              }`}
                            />
                            {(editingNotes[lead.id] !== undefined && editingNotes[lead.id] !== (lead.private_notes || '')) && (
                              <div className="flex justify-end pt-0.5">
                                <button
                                  onClick={() => handleSaveNotes(lead.id, editingNotes[lead.id])}
                                  disabled={savingNoteId === lead.id}
                                  className={`border text-[10px] font-medium py-1 px-2.5 rounded-lg transition-all cursor-pointer flex items-center space-x-1 ${
                                    isDarkMode
                                      ? 'bg-orange-600/20 hover:bg-orange-600/30 border-orange-500/30 text-orange-400'
                                      : 'bg-orange-100 hover:bg-orange-200 border-orange-200 text-orange-700'
                                  }`}
                                >
                                  <Check className="h-3 w-3" />
                                  <span>Guardar Nota</span>
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Quick buttons */}
                          <div className="space-y-2 pt-1">
                            <a
                              href={`https://wa.me/${lead.phone}`}
                              target="_blank"
                              referrerPolicy="no-referrer"
                              onClick={() => handleMarkContacted(lead.id)}
                              className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-2.5 px-4 rounded-xl flex items-center justify-center space-x-2 transition shadow-sm text-xs cursor-pointer"
                            >
                              <Phone className="h-3.5 w-3.5 fill-current" />
                              <span>Atender Personalmente</span>
                            </a>

                            {isPending && (
                              <button
                                onClick={() => handleMarkContacted(lead.id)}
                                className={`w-full border font-medium py-1.5 px-3 rounded-lg text-xs transition cursor-pointer ${
                                  isDarkMode 
                                    ? 'bg-slate-950/60 hover:bg-slate-900 border-slate-800 text-slate-300' 
                                    : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                                }`}
                              >
                                Marcar como Contactado
                              </button>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'copilot' && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="flex flex-col h-full overflow-hidden bg-slate-900/10"
            >
              {/* Header Info */}
              <div className={`p-6 border-b shrink-0 transition-colors duration-200 ${
                isDarkMode ? 'bg-slate-900/60 border-slate-800/80' : 'bg-white border-slate-200 shadow-sm'
              }`}>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <h2 className={`text-xl font-bold flex items-center tracking-tight transition-colors duration-200 ${
                      isDarkMode ? 'text-white' : 'text-slate-900'
                    }`}>
                      <Database className="h-5 w-5 mr-2.5 text-orange-500 animate-pulse" />
                      Asistente de Base de Datos O3 Copilot
                    </h2>
                    <p className={`text-xs mt-1 transition-colors duration-250 ${
                      isDarkMode ? 'text-slate-400' : 'text-slate-500'
                    }`}>
                      Realiza consultas inteligentes en tiempo real sobre tus chats y leads calificados en Firestore usando Inteligencia Artificial.
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`text-[10px] font-mono px-2 py-1 rounded border ${
                      isDarkMode ? 'bg-slate-950 text-slate-400 border-slate-800' : 'bg-slate-50 text-slate-600 border-slate-250'
                    }`}>
                      Leads: {leads.length}
                    </span>
                    <span className={`text-[10px] font-mono px-2 py-1 rounded border ${
                      isDarkMode ? 'bg-slate-950 text-slate-400 border-slate-800' : 'bg-slate-50 text-slate-600 border-slate-250'
                    }`}>
                      Chats: {chats.length}
                    </span>
                    <button
                      onClick={() => {
                        setCopilotMessages([
                          {
                            sender: 'bot',
                            text: 'Conversación reiniciada. ¿En qué puedo ayudarte a buscar hoy?',
                            timestamp: new Date().toISOString()
                          }
                        ]);
                      }}
                      className={`text-xs py-1 px-2.5 rounded-lg border font-medium transition-all duration-150 cursor-pointer ${
                        isDarkMode
                          ? 'bg-slate-800 hover:bg-slate-750 text-slate-300 border-slate-700'
                          : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
                      }`}
                    >
                      Limpiar Chat
                    </button>
                  </div>
                </div>
              </div>

              {/* Chat Messages Area */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {copilotMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] md:max-w-[75%] rounded-2xl p-4 shadow-sm border transition-all duration-200 ${
                        msg.sender === 'user'
                          ? isDarkMode
                            ? 'bg-orange-500/10 border-orange-500/30 text-slate-150'
                            : 'bg-orange-50 border-orange-200 text-slate-850'
                          : isDarkMode
                          ? 'bg-slate-900 border-slate-800/80 text-slate-150'
                          : 'bg-white border-slate-250 text-slate-800'
                      }`}
                    >
                      {/* Message header */}
                      <div className="flex items-center space-x-1.5 mb-1.5 border-b border-orange-500/10 pb-1">
                        <span className="text-[10px] font-bold text-orange-500 tracking-wider uppercase">
                          {msg.sender === 'user' ? 'Tú (Ventas)' : 'Copiloto O3'}
                        </span>
                        <span className={`text-[9px] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                          • {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      
                      {/* Message Body */}
                      <div className="text-sm leading-relaxed whitespace-pre-line prose max-w-none">
                        {renderCopilotMessageText(msg.text)}
                      </div>
                    </div>
                  </div>
                ))}
                
                {isCopilotTyping && (
                  <div className="flex justify-start">
                    <div className={`max-w-[85%] md:max-w-[75%] rounded-2xl p-4 shadow-sm border ${
                      isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                    }`}>
                      <div className="flex items-center space-x-2">
                        <div className="bg-orange-500/10 p-1.5 rounded-lg text-orange-500 border border-orange-500/20">
                          <Database className="h-3.5 w-3.5 animate-bounce" />
                        </div>
                        <span className="text-xs text-slate-400 animate-pulse font-medium">Consultando base de datos con IA...</span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={copilotEndRef} />
              </div>

              {/* Sugerencias y Formulario de Envío */}
              <div className={`p-4 border-t shrink-0 ${
                isDarkMode ? 'bg-slate-900/40 border-slate-800/80' : 'bg-slate-50 border-slate-200'
              }`}>
                {/* Sugerencias */}
                <div className="mb-3.5">
                  <span className={`text-[10px] font-bold tracking-wider uppercase block mb-1.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    Consultas sugeridas en tiempo real:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: '💰 Pipeline Total', query: '¿Cuánto es el valor de todas las cotizaciones?' },
                      { label: '🔥 Mayor Recibo', query: '¿Quién es el cliente con el recibo de luz más alto?' },
                      { label: '📊 Tasa de Contacto', query: '¿Qué porcentaje de los leads ya han sido contactados?' },
                      { label: '📋 Leads Pendientes', query: 'Muéstrame la lista detallada de los leads pendientes de revisión' },
                      { label: '💼 Resumen General', query: 'Genera un resumen ejecutivo de todos los prospectos de la base de datos' }
                    ].map((s, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleSendCopilotQuery(s.query)}
                        disabled={isCopilotTyping}
                        className={`text-xs py-1 px-2.5 rounded-lg border font-medium cursor-pointer transition-all duration-150 ${
                          isDarkMode
                            ? 'bg-slate-950/40 hover:bg-slate-900 border-slate-850 text-slate-300 hover:text-orange-400 hover:border-orange-500/30'
                            : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-650 hover:text-orange-600 shadow-sm'
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Formulario */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendCopilotQuery();
                  }}
                  className="flex items-center space-x-2"
                >
                  <input
                    type="text"
                    value={copilotInput}
                    onChange={(e) => setCopilotInput(e.target.value)}
                    placeholder="Escribe una pregunta sobre la base de datos (ej: ¿Cuántos leads giran arriba de $5000 MXN?)"
                    disabled={isCopilotTyping}
                    className={`flex-1 text-sm py-2.5 px-4 rounded-xl outline-none border transition-all duration-150 ${
                      isDarkMode
                        ? 'bg-slate-950 border-slate-850 text-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500'
                        : 'bg-white border-slate-200 text-slate-850 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 shadow-inner'
                    }`}
                  />
                  <button
                    type="submit"
                    disabled={isCopilotTyping || !copilotInput.trim()}
                    className={`p-2.5 rounded-xl text-white font-bold transition-all flex items-center justify-center cursor-pointer ${
                      copilotInput.trim() && !isCopilotTyping
                        ? 'bg-orange-500 hover:bg-orange-600 shadow-md shadow-orange-500/20'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-750'
                    }`}
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </form>
              </div>
            </motion.div>
          )}

          {activeTab === 'simulator' && (
            <div className="p-8 h-full overflow-y-auto space-y-6">
              {/* Header */}
              <div className={`border-b pb-5 transition-colors duration-200 ${
                isDarkMode ? 'border-slate-800/80' : 'border-slate-200'
              }`}>
                <h2 className={`text-2xl font-bold flex items-center tracking-tight transition-colors duration-200 ${
                  isDarkMode ? 'text-white' : 'text-slate-900'
                }`}>
                  <Sparkles className="h-6 w-6 mr-3 text-orange-500" />
                  Simulador de API / Webhook (Playground)
                </h2>
                <p className={`text-sm mt-1 font-light transition-colors duration-200 ${
                  isDarkMode ? 'text-slate-400' : 'text-slate-600'
                }`}>
                  Prueba la lógica conversacional del Bot de Gemini. Envía mensajes simulando ser un cliente y observa la extracción de parámetros y el historial de chat en tiempo real.
                </p>
              </div>

              {/* Simulator Panel */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Simulated Phone Interface */}
                <div className={`lg:col-span-5 flex flex-col border rounded-[2rem] overflow-hidden h-[650px] relative transition-all duration-200 ${
                  isDarkMode 
                    ? 'bg-slate-950 border-slate-800/80 shadow-2xl shadow-slate-950/80' 
                    : 'bg-white border-slate-300 shadow-xl'
                }`}>
                  
                  {/* Phone Header */}
                  <div className={`p-4 pt-6 flex items-center space-x-3 shadow-sm border-b transition-colors duration-200 ${
                    isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`}>
                    <div className="h-8 w-8 rounded-full bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-500 font-bold">
                      O3
                    </div>
                    <div>
                      <h4 className="font-bold text-xs leading-none">O3 Energy México</h4>
                      <span className="text-[9px] text-orange-500 font-medium tracking-wide">Asistente Virtual de Ventas</span>
                    </div>
                  </div>

                  {/* WhatsApp Messages Canvas */}
                  <div className={`flex-1 overflow-y-auto p-4 space-y-3 transition-colors duration-200 ${
                    isDarkMode ? 'bg-slate-950' : 'bg-slate-50/50'
                  }`}>
                    <div className="text-center">
                      <span className={`text-[9px] font-semibold px-2.5 py-1 rounded border shadow-xs transition-colors duration-200 ${
                        isDarkMode 
                          ? 'bg-slate-900 text-slate-500 border-slate-850' 
                          : 'bg-white text-slate-500 border-slate-200'
                      }`}>
                        Mensajes procesados por Gemini AI para O3 Energy
                      </span>
                    </div>

                    {/* Show current selected chat messages if match, otherwise standard prompts */}
                    {chats.find(c => c.phone === simPhone)?.messages.map((m, i) => (
                      <div key={i} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] rounded-xl p-3 shadow-xs text-xs border transition-colors duration-200 ${
                          m.sender === 'user' 
                            ? isDarkMode
                              ? 'bg-orange-500/10 text-orange-400 border-orange-500/20 rounded-tr-none' 
                              : 'bg-orange-50 text-orange-850 border-orange-200 rounded-tr-none'
                            : isDarkMode
                            ? 'bg-slate-900 text-slate-200 border-slate-800 rounded-tl-none'
                            : 'bg-white text-slate-800 border-slate-200 rounded-tl-none'
                        }`}>
                          <p className="whitespace-pre-wrap font-light">{m.text}</p>
                          <span className="text-[8px] text-slate-400 text-right block mt-1 font-mono">
                            {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Simulator Trigger Input */}
                  <form onSubmit={handleSimulateWebhook} className={`p-4 border-t transition-colors duration-200 ${
                    isDarkMode ? 'bg-slate-900/60 border-slate-800/80' : 'bg-white border-slate-200'
                  }`}>
                    <div className="flex flex-col space-y-2.5">
                      {/* Configuration fields */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-slate-500 font-semibold block mb-1">Nombre de Cliente</label>
                          <input 
                            type="text" 
                            value={simName}
                            onChange={(e) => setSimName(e.target.value)}
                            className={`w-full border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-orange-500/30 transition-colors duration-200 ${
                              isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-250 text-slate-800'
                            }`}
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500 font-semibold block mb-1">Teléfono (Simulado)</label>
                          <input 
                            type="text" 
                            value={simPhone}
                            onChange={(e) => setSimPhone(e.target.value)}
                            className={`w-full border rounded-lg px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-orange-500/30 transition-colors duration-200 ${
                              isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-250 text-slate-800'
                            }`}
                          />
                        </div>
                      </div>

                      {/* Quick helpers / Suggested prompts */}
                      <div>
                        <span className="text-[9px] text-slate-500 font-semibold block mb-1.5 uppercase tracking-wide">Inyecciones sugeridas para calificar rápido:</span>
                        <div className="flex flex-wrap gap-1">
                          <button
                            type="button"
                            onClick={() => setSimMessage('Hola, soy dueño de una casa en Guadalajara y pago $3,800 al bimestre')}
                            className={`text-[9px] border px-2.5 py-1 rounded-md transition cursor-pointer ${
                              isDarkMode 
                                ? 'bg-slate-950 hover:bg-slate-900 text-slate-300 border-slate-800' 
                                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            💡 "Soy dueño, gasto $3,800"
                          </button>
                          <button
                            type="button"
                            onClick={() => setSimMessage('Sí, la casa es mía, mi gasto mensual promedio es de unos $5,500 MXN')}
                            className={`text-[9px] border px-2.5 py-1 rounded-md transition cursor-pointer ${
                              isDarkMode 
                                ? 'bg-slate-950 hover:bg-slate-900 text-slate-300 border-slate-800' 
                                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            💡 "Soy dueño, gasto $5,500"
                          </button>
                          <button
                            type="button"
                            onClick={() => setSimMessage('Hola, soy arrendatario y pago $1,200 MXN')}
                            className={`text-[9px] border px-2.5 py-1 rounded-md transition cursor-pointer ${
                              isDarkMode 
                                ? 'bg-slate-950 hover:bg-slate-900 text-slate-300 border-slate-800' 
                                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            💡 "Rentado, gasto $1,200"
                          </button>
                        </div>
                      </div>

                      {/* Input send bar */}
                      <div className="flex space-x-2">
                        <input
                          type="text"
                          value={simMessage}
                          onChange={(e) => setSimMessage(e.target.value)}
                          placeholder="Escribe un mensaje de WhatsApp..."
                          className={`flex-1 border rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/40 transition-colors duration-200 ${
                            isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-250 text-slate-800'
                          }`}
                          required
                        />
                        <button
                          type="submit"
                          disabled={isSimulating}
                          className="bg-orange-600 hover:bg-orange-700 text-white p-2.5 rounded-xl flex items-center justify-center transition cursor-pointer"
                        >
                          {isSimulating ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </form>
                </div>

                {/* Developer / Webhook Inspector */}
                <div className="lg:col-span-7 space-y-6">
                  
                  {/* Webhook JSON Payload */}
                  <div className={`backdrop-blur-md rounded-2xl p-5 border shadow-lg space-y-3 transition-all duration-200 ${
                    isDarkMode ? 'bg-slate-900/30 border-slate-800/80 text-slate-300' : 'bg-white border-slate-200 text-slate-800'
                  }`}>
                    <div className={`flex items-center justify-between border-b pb-3 transition-colors duration-200 ${
                      isDarkMode ? 'border-slate-800' : 'border-slate-100'
                    }`}>
                      <span className="text-xs font-bold font-mono text-orange-500">POST /whatsapp-webhook</span>
                      <span className={`text-[10px] px-2.5 py-0.5 rounded font-bold font-mono ${
                        isDarkMode ? 'bg-slate-850 text-slate-400' : 'bg-slate-100 text-slate-500'
                      }`}>PAYLOAD INSPECTOR</span>
                    </div>
                    <div>
                      <p className={`text-xs mb-2 font-light ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Este es el formato JSON idéntico enviado por el Webhook de WhatsApp a la API de nuestro servidor:</p>
                      <pre className="text-xs bg-slate-950 p-4 rounded-xl font-mono text-orange-500 overflow-x-auto max-h-40 border border-slate-900">
                        {simPayload || '// El payload se generará al enviar tu primer mensaje de simulación'}
                      </pre>
                    </div>
                  </div>

                  {/* Extraction JSON and response */}
                  {simResponse && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`backdrop-blur-md rounded-2xl p-5 border shadow-lg space-y-3 transition-all duration-200 ${
                        isDarkMode ? 'bg-slate-900/30 border-slate-800/80 text-slate-300' : 'bg-white border-slate-200 text-slate-800'
                      }`}
                    >
                      <div className={`flex items-center justify-between border-b pb-3 transition-colors duration-200 ${
                        isDarkMode ? 'border-slate-800' : 'border-slate-100'
                      }`}>
                        <span className="text-xs font-bold font-mono text-orange-500">EXTRACCIÓN INTELIGENTE GEMINI</span>
                        <span className={`text-[10px] border px-2 py-0.5 rounded font-bold font-mono ${
                          simResponse.lead_generated 
                            ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
                            : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                        }`}>
                          STATUS: {simResponse.lead_generated ? 'LEAD RECOPILADO' : 'PENDIENTE DE DATOS'}
                        </span>
                      </div>
                      
                      <div className="space-y-4">
                        <div>
                          <p className={`text-xs mb-2 font-light ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Mensaje limpio final enviado al cliente (se removió el bloque JSON comercial Extractor):</p>
                          <div className={`p-4 rounded-xl text-xs font-sans border-l-4 border-orange-500 border transition-colors duration-200 ${
                            isDarkMode ? 'bg-slate-950 text-slate-200 border-slate-900' : 'bg-slate-50 text-slate-800 border-slate-200'
                          }`}>
                            {simResponse.reply}
                          </div>
                        </div>

                        {simResponse.lead_generated ? (
                          <div className="space-y-2">
                            <p className={`text-xs font-light ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>JSON de Lead calificado interceptado por el servidor:</p>
                            <pre className="text-xs bg-slate-950 p-4 rounded-xl font-mono text-orange-500 overflow-x-auto border border-slate-900">
                              {JSON.stringify(simResponse.chat, null, 2)}
                            </pre>
                          </div>
                        ) : (
                          <p className="text-xs text-amber-500 flex items-center font-light">
                            <Clock className="h-3.5 w-3.5 mr-1 text-amber-500 animate-spin" />
                            Conversación en curso. Preguntando por la propiedad de la casa y el monto del recibo de luz...
                          </p>
                        )}
                      </div>
                    </motion.div>
                  )}

                  {/* Simulator Live Logs */}
                  <div className={`backdrop-blur-md rounded-2xl p-5 border shadow-lg space-y-3 transition-all duration-200 ${
                    isDarkMode ? 'bg-slate-900/30 border-slate-800/80 text-slate-300' : 'bg-white border-slate-200 text-slate-800'
                  }`}>
                    <div className={`flex items-center justify-between border-b pb-3 transition-colors duration-200 ${
                      isDarkMode ? 'border-slate-800' : 'border-slate-100'
                    }`}>
                      <span className="text-xs font-bold font-mono text-slate-500">CONSOLA EN TIEMPO REAL (LOGS)</span>
                      <button 
                        onClick={() => setSimulationLog([])}
                        className={`text-[10px] transition cursor-pointer ${
                          isDarkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'
                        }`}
                      >
                        Limpiar Consola
                      </button>
                    </div>
                    <div className={`space-y-1 max-h-40 overflow-y-auto font-mono text-xs transition-colors duration-200 ${
                      isDarkMode ? 'text-slate-400' : 'text-slate-600'
                    }`}>
                      {simulationLog.length === 0 ? (
                        <p className="text-slate-500 font-light">// Los logs de simulación aparecerán aquí...</p>
                      ) : (
                        simulationLog.map((log, index) => {
                          const isLead = log.includes('LEAD CALIFICADO');
                          const isErr = log.includes('ERROR');
                          return (
                            <p key={index} className={isLead ? 'text-orange-500 font-semibold' : isErr ? 'text-red-500' : 'font-light'}>
                              {log}
                            </p>
                          );
                        })
                      )}
                    </div>
                  </div>

                </div>
              </div>
            </div>
          )}

          {activeTab === 'guide' && (
            <div className="p-8 h-full overflow-y-auto space-y-8">
              {/* Header */}
              <div className={`border-b pb-5 transition-colors duration-200 ${
                isDarkMode ? 'border-slate-800/80' : 'border-slate-200'
              }`}>
                <h2 className={`text-2xl font-bold flex items-center tracking-tight transition-colors duration-200 ${
                  isDarkMode ? 'text-white' : 'text-slate-900'
                }`}>
                  <BookOpen className="h-6 w-6 mr-3 text-orange-500" />
                  Guía de Configuración, Integración y Código Python
                </h2>
                <p className={`text-sm mt-1 font-light transition-colors duration-200 ${
                  isDarkMode ? 'text-slate-400' : 'text-slate-600'
                }`}>
                  Guía completa de despliegue paso a paso para el backend de O3 Energy en producción, incluyendo FastAPI, Firestore y Webhooks oficiales.
                </p>
              </div>

              {/* Code Panel */}
              <div className="space-y-6 max-w-4xl">
                
                {/* Python FastAPI tab block */}
                <div className={`backdrop-blur-md rounded-2xl overflow-hidden shadow-lg border transition-all duration-200 ${
                  isDarkMode ? 'bg-slate-900/30 border-slate-800/80' : 'bg-white border-slate-200'
                }`}>
                  <div className={`p-4 flex items-center justify-between border-b transition-colors duration-200 ${
                    isDarkMode ? 'bg-slate-950/60 border-slate-800/80' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <div className="flex items-center space-x-2">
                      <Code className="h-5 w-5 text-orange-500" />
                      <span className={`text-xs font-bold font-mono uppercase tracking-wider ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>PARTE 1: BACKEND DE PRODUCCIÓN EN PYTHON (FastAPI)</span>
                    </div>
                    <button
                      onClick={() => handleCopy(FAST_API_CODE, 'FastAPI Code')}
                      className={`text-xs border font-semibold py-1.5 px-3.5 rounded-lg transition-all flex items-center space-x-1 cursor-pointer ${
                        isDarkMode 
                          ? 'bg-slate-900 hover:bg-slate-850 border-slate-800 text-slate-300' 
                          : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                    >
                      <Copy className="h-3 w-3" />
                      <span>{copiedText === 'FastAPI Code' ? 'Copiado' : 'Copiar Código'}</span>
                    </button>
                  </div>
                  <pre className="text-xs p-6 overflow-x-auto text-orange-500 font-mono bg-slate-950/80 max-h-[500px] border border-slate-900">
                    {FAST_API_CODE}
                  </pre>
                </div>

                {/* Firestore structure */}
                <div className={`backdrop-blur-md rounded-2xl p-6 border shadow-lg space-y-4 transition-all duration-200 ${
                  isDarkMode ? 'bg-slate-900/30 border-slate-800/80' : 'bg-white border-slate-200'
                }`}>
                  <div className={`flex items-center space-x-2 border-b pb-3 transition-colors duration-200 ${
                    isDarkMode ? 'border-slate-800/80' : 'border-slate-200'
                  }`}>
                    <Layers className="h-5 w-5 text-orange-500" />
                    <h3 className={`font-bold text-base tracking-tight transition-colors duration-200 ${isDarkMode ? 'text-slate-100' : 'text-slate-850'}`}>Estructura Firestore (Base de Datos)</h3>
                  </div>
                  <div className={`prose prose-sm max-w-none transition-colors duration-200 ${isDarkMode ? 'text-slate-400' : 'text-slate-650'}`}>
                    <p className="text-xs leading-relaxed font-light">
                      El Bot de IA lee y escribe en Firestore en tiempo real. Utiliza las colecciones descritas a continuación. Si utilizas la estructura de Firebase Admin (Admin SDK), la base se creará dinámicamente de forma automática en tu primer webhook exitoso.
                    </p>
                    <div className="text-xs font-mono whitespace-pre-wrap leading-relaxed mt-4 bg-slate-950 p-4 rounded-xl border border-slate-900 text-slate-300">
                      {FIRESTORE_GUIDE}
                    </div>
                  </div>
                </div>

                {/* Meta platform setups */}
                <div className={`backdrop-blur-md rounded-2xl p-6 border shadow-lg space-y-4 transition-all duration-200 ${
                  isDarkMode ? 'bg-slate-900/30 border-slate-800/80' : 'bg-white border-slate-200'
                }`}>
                  <div className={`flex items-center space-x-2 border-b pb-3 transition-colors duration-200 ${
                    isDarkMode ? 'border-slate-800/80' : 'border-slate-200'
                  }`}>
                    <ExternalLink className="h-5 w-5 text-orange-500" />
                    <h3 className={`font-bold text-base tracking-tight transition-colors duration-200 ${isDarkMode ? 'text-slate-100' : 'text-slate-850'}`}>Instrucciones de Configuración Meta / Twilio Webhook</h3>
                  </div>
                  <div className={`prose prose-sm max-w-none transition-colors duration-200 ${isDarkMode ? 'text-slate-400' : 'text-slate-650'}`}>
                    <div className="text-xs font-mono whitespace-pre-wrap leading-relaxed bg-slate-950 p-4 rounded-xl border border-slate-900 text-slate-300">
                      {META_INTEGRATION_GUIDE}
                    </div>
                  </div>
                </div>

                {/* Environmental variables configurations */}
                <div className={`backdrop-blur-md rounded-2xl p-6 border shadow-lg space-y-4 transition-all duration-200 ${
                  isDarkMode ? 'bg-slate-900/30 border-slate-800/80' : 'bg-white border-slate-200'
                }`}>
                  <div className={`flex items-center space-x-2 border-b pb-3 transition-colors duration-200 ${
                    isDarkMode ? 'border-slate-800/80' : 'border-slate-200'
                  }`}>
                    <Server className="h-5 w-5 text-orange-500" />
                    <h3 className={`font-bold text-base tracking-tight transition-colors duration-200 ${isDarkMode ? 'text-slate-100' : 'text-slate-850'}`}>Variables de Entorno Requeridas (.env)</h3>
                  </div>
                  <div className="prose prose-sm space-y-2">
                    <p className={`text-xs font-light transition-colors duration-200 ${isDarkMode ? 'text-slate-400' : 'text-slate-650'}`}>Para desplegar tanto el servidor de Python como el de Node, asegúrate de configurar las siguientes variables de entorno clave:</p>
                    <pre className="text-xs bg-slate-950 text-orange-500 p-4 rounded-xl font-mono border border-slate-900">
{`# 1. API Key de Google Gemini (Requerida para la IA)
GEMINI_API_KEY="AIzaSyYourGeminiApiKeyHere"

# 2. Token de Validación del Webhook de WhatsApp (Usa el mismo en la consola de Meta)
WHATSAPP_VERIFY_TOKEN="O3_ENERGY_MEXICO_TOKEN"

# 3. Puerto de Ejecución (Opcional)
PORT=3000`}
                    </pre>
                  </div>
                </div>

              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
