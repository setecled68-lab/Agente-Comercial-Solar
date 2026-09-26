import React from 'react';
import { MessageSquare, Search, Bot, Phone, Send, UserCheck, AlertTriangle, ChevronLeft, Play, Pause, Layers, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Chat } from '../types';

interface ChatsViewProps {
  isDarkMode: boolean;
  chats: Chat[];
  chatSearch: string;
  setChatSearch: (val: string) => void;
  selectedChatPhone: string | null;
  setSelectedChatPhone: (val: string | null) => void;
  agentMessageText: string;
  setAgentMessageText: (val: string) => void;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  showToast: (msg: string) => void;
  setActiveTab: (tab: 'chats' | 'leads' | 'simulator' | 'guide' | 'copilot') => void;
}

export const ChatsView: React.FC<ChatsViewProps> = ({
  isDarkMode,
  chats,
  chatSearch,
  setChatSearch,
  selectedChatPhone,
  setSelectedChatPhone,
  agentMessageText,
  setAgentMessageText,
  messagesEndRef,
  showToast,
  setActiveTab
}) => {

  const handleToggleBot = async (phone: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/chats/${phone}/toggle-bot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botDisabled: !currentStatus })
      });
      if (response.ok) {
        showToast(!currentStatus ? '­ƒñû Bot de Inteligencia Artificial PAUSADO' : '­ƒñû Bot de Inteligencia Artificial REACTIVADO');
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
        showToast('Mensaje de agente enviado (Bot pausado autom├íticamente)');
      } else {
        showToast('Error al enviar el mensaje');
        setAgentMessageText(originalText);
      }
    } catch (err) {
      showToast('Fallo de conexi├│n al enviar mensaje');
      setAgentMessageText(originalText);
    }
  };


  const selectedChat = chats.find(c => c.phone === selectedChatPhone);
  
  const filteredChats = chats.filter(chat => {
    const searchLower = chatSearch.toLowerCase();
    const nombreMatch = (chat.nombre || '').toLowerCase().includes(searchLower);
    const phoneMatch = chat.phone.includes(searchLower);
    return nombreMatch || phoneMatch;
  });

  return (
    <div className="flex h-full overflow-hidden">
              {/* CHATS LIST COLUMN */}
              <div className={`${selectedChatPhone ? "hidden md:flex" : "flex"} w-full md:w-80 border-r flex-col transition-colors duration-200 ${
                isDarkMode ? 'border-white/10 bg-white/5 backdrop-blur-sm' : 'border-slate-200/60 bg-white/70'
              }`}>
                <div className={`p-4 border-b space-y-3 transition-colors duration-200 ${isDarkMode ? 'border-white/10' : 'border-slate-200/60'}`}>
                  <h2 className={`text-sm font-bold uppercase tracking-wider flex items-center transition-colors duration-200 ${
                    isDarkMode ? 'text-slate-200' : 'text-slate-700'
                  }`}>
                    <MessageSquare className="h-4 w-4 mr-2 text-amber-400" />
                    Monitor de Chats
                  </h2>
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Buscar por nombre o n├║mero..."
                      value={chatSearch}
                      onChange={(e) => setChatSearch(e.target.value)}
                      className={`w-full pl-9 pr-4 py-2 border rounded-xl text-xs transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-amber-400/20 focus:border-amber-400/40 ${
                        isDarkMode 
                          ? 'bg-white/5 border-white/10 text-slate-200 placeholder:text-slate-500' 
                          : 'bg-white/60 border-slate-300/60 text-slate-900 placeholder:text-slate-400'
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
                        className="text-amber-400 font-semibold text-xs hover:underline cursor-pointer"
                      >
                        Iniciar simulaci├│n en Playground ÔåÆ
                      </button>
                    </div>
                  ) : (
                    filteredChats.map((chat) => {
                      const lastMsg = chat.messages?.[chat.messages.length - 1];
                      const isUnqualified = !chat.montoRecibo;
                      return (
                        <button
                          key={chat.phone}
                          onClick={() => setSelectedChatPhone(chat.phone)}
                          className={`w-full p-4 text-left border-b transition-all duration-150 block cursor-pointer ${
                            selectedChatPhone === chat.phone
                              ? isDarkMode
                                ? 'bg-amber-400/10 border-l-4 border-amber-400 border-b-white/10 rounded-r-xl'
                                : 'bg-amber-50/60 border-l-4 border-amber-400 border-b-slate-100'
                              : isDarkMode
                              ? 'hover:bg-white/5 border-l-4 border-transparent border-b-white/5 rounded-r-xl'
                              : 'hover:bg-slate-50/80 border-l-4 border-transparent border-b-slate-100/60 rounded-r-xl'
                          }`}
                        >
                          <div className="flex justify-between items-start mb-1">
                            <span className={`font-semibold text-sm truncate block max-w-[150px] transition-colors duration-200 ${
                              isDarkMode ? 'text-slate-200' : 'text-slate-800'
                            }`}>
                              {chat.nombre || 'Cliente WhatsApp'}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              {chat.lastMessageAt ? new Date(chat.lastMessageAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}
                            </span>
                          </div>
                          
                          <div className={`text-xs font-mono mb-2 transition-colors duration-200 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                            +{chat.phone}
                          </div>

                          {lastMsg && (
                            <p className={`text-xs truncate max-w-[200px] mb-2 font-light transition-colors duration-200 ${
                              isDarkMode ? 'text-slate-400' : 'text-slate-600'
                            }`}>
                              {lastMsg.sender === 'bot' ? '­ƒñû ' : lastMsg.sender === 'agent' ? '­ƒæ¿ÔÇì­ƒÆ╝ ' : ''}
                              {lastMsg.text}
                            </p>
                          )}

                          <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                            {chat.botDisabled ? (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-550 border border-amber-500/20">
                                <Pause className="h-2 w-2 mr-0.5 fill-current" /> IA Pausada
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                                <Play className="h-2 w-2 mr-0.5 fill-current animate-pulse" /> IA Activa
                              </span>
                            )}

                            {!isUnqualified && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-400/10 text-amber-500 border border-amber-400/20">
                                ­ƒöÑ Calificado ({chat.montoRecibo})
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
              <div className={`${!selectedChatPhone ? "hidden md:flex" : "flex"} flex-1 flex-col h-full overflow-hidden`}>
                {selectedChat ? (
                  <>
                    {/* Chat Header */}
                    <div className={`p-4 border-b flex items-center justify-between shadow-sm z-10 backdrop-blur-md transition-colors duration-200 ${
                      isDarkMode ? 'bg-white/5 border-white/10 backdrop-blur-xl' : 'bg-white/80 border-slate-200/60 backdrop-blur-xl'
                    }`}>
                      <div className="flex items-center space-x-3">
                        <div className={`h-10 w-10 rounded-full border flex items-center justify-center font-semibold shadow-sm transition-colors duration-200 ${
                          isDarkMode ? 'bg-white/10 border-white/20 text-slate-200' : 'bg-slate-100 border-slate-200/60 text-slate-700'
                        }`}>
                          {selectedChat.nombre?.slice(0, 2).toUpperCase() || 'WA'}
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <h3 className={`font-bold text-sm leading-tight transition-colors duration-200 ${
                              isDarkMode ? 'text-slate-100' : 'text-slate-900'
                            }`}>{selectedChat.nombre || 'Cliente WhatsApp'}</h3>
                            {selectedChat.montoRecibo && (
                              <span className="bg-amber-400/10 text-amber-500 border border-amber-400/20 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center">
                                <Sparkles className="h-2.5 w-2.5 mr-0.5 text-amber-400 fill-current" /> Lead Calificado
                              </span>
                            )}
                          </div>
                          <span className={`text-xs transition-colors duration-200 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Tel├®fono: +{selectedChat.phone}</span>
                        </div>
                      </div>

                      {/* Bot Control Panel */}
                      <div className="flex items-center space-x-3">
                        <div className="text-right mr-1 hidden md:block">
                          <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wide">Status del Asistente</p>
                          <p className={`text-xs font-bold ${selectedChat.botDisabled ? 'text-amber-500' : 'text-emerald-500'}`}>
                            {selectedChat.botDisabled ? 'PAUSADO (Manual)' : 'ACTIVO (Conversando)'}
                          </p>
                        </div>
                        
                        <button
                          onClick={() => handleToggleBot(selectedChat.phone, selectedChat.botDisabled)}
                          className={`flex items-center space-x-2 py-2 px-4 rounded-xl text-xs font-semibold shadow-sm transition-all duration-200 cursor-pointer ${
                            selectedChat.botDisabled
                              ? 'bg-amber-500 hover:bg-amber-600 text-white'
                              : 'bg-amber-500/10 hover:bg-amber-500/25 text-amber-500 border border-amber-500/20'
                          }`}
                        >
                          {selectedChat.botDisabled ? (
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
                    {selectedChat.montoRecibo && (
                      <div className={`border-b p-4 flex flex-wrap gap-4 items-center justify-between text-xs transition-colors duration-200 ${
                        isDarkMode 
                          ? 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10' 
                          : 'bg-white/60 border-slate-200/60 text-slate-800 hover:bg-white/80'
                      }`}>
                        <div className="flex items-center space-x-5">
                          <div>
                            <span className="text-slate-500 block font-semibold uppercase text-[9px] tracking-wide">Gasto Promedio CFE</span>
                            <span className={`font-bold text-sm ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>{selectedChat.montoRecibo}</span>
                          </div>
                          <div className={`border-l h-8 ${isDarkMode ? 'border-white/10' : 'border-slate-200/60'}`}></div>
                          <div>
                            <span className="text-slate-500 block font-semibold uppercase text-[9px] tracking-wide">Sistema Propuesto</span>
                            <span className={`font-bold text-sm flex items-center ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                              <Layers className="h-3.5 w-3.5 text-amber-400 mr-1" />
                              {selectedChat.sistemaEstimado}
                            </span>
                          </div>
                          <div className={`border-l h-8 ${isDarkMode ? 'border-white/10' : 'border-slate-200/60'}`}></div>
                          <div>
                            <span className="text-slate-500 block font-semibold uppercase text-[9px] tracking-wide font-sans">Presupuesto Estimado</span>
                            <span className="font-bold text-amber-400 text-sm">{selectedChat.costoEstimado}</span>
                          </div>
                        </div>

                        <a
                          href={`https://wa.me/${selectedChat.phone}`}
                          target="_blank"
                          referrerPolicy="no-referrer"
                          className="bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-white font-bold py-2.5 px-4 rounded-xl flex items-center space-x-2 shadow-md shadow-amber-500/20 transition text-xs cursor-pointer"
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
                                className={`max-w-[72%] rounded-2xl p-4 shadow-md border transition-colors duration-200 ${
                                  isUser
                                    ? isDarkMode
                                      ? 'bg-amber-400/10 text-amber-300 border-amber-400/20 rounded-tr-none'
                                      : 'bg-amber-50 text-amber-700 border-amber-200 rounded-tr-none'
                                    : isAgent
                                    ? isDarkMode
                                      ? 'bg-slate-800 text-slate-100 rounded-tr-none border-slate-700/50'
                                      : 'bg-white text-slate-800 rounded-tr-none border-slate-200 shadow-xs'
                                    : 'bg-amber-500 text-white border-amber-400 rounded-tl-none'
                                }`}
                              >
                                <div className={`flex items-center justify-between space-x-4 mb-1 border-b pb-1 ${
                                  isUser 
                                    ? 'border-amber-400/10' 
                                    : isDarkMode ? 'border-slate-800/40' : 'border-slate-100'
                                }`}>
                                  <span className="text-[10px] font-bold tracking-wide uppercase opacity-75">
                                    {isUser ? 'Cliente' : isAgent ? 'Asesor (T├║)' : 'Bot de IA (O3 Energy)'}
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
                      isDarkMode ? 'bg-white/5 border-white/10 backdrop-blur-xl' : 'bg-white/80 border-slate-200/60 backdrop-blur-xl'
                    }`}>
                      {selectedChat.botDisabled ? (
                        <div className="mb-2 text-xs text-amber-500 bg-amber-500/5 border border-amber-500/20 px-3 py-1.5 rounded-lg flex items-center space-x-1.5">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                          <span>El bot est├í **Pausado**. Tus mensajes se enviar├ín de forma manual y el bot no responder├í autom├íticamente.</span>
                        </div>
                      ) : (
                        <div className="mb-2 text-xs text-amber-400 bg-amber-400/5 border border-amber-400/20 px-3 py-1.5 rounded-lg flex items-center space-x-1.5">
                          <Sparkles className="h-3.5 w-3.5 shrink-0 animate-pulse" />
                          <span>El bot de IA est├í **Activo**. Si env├¡as un mensaje manual, el bot se pausar├í autom├íticamente para evitar empalmarse.</span>
                        </div>
                      )}

                      <div className="flex space-x-3">
                        <input
                          type="text"
                          value={agentMessageText}
                          onChange={(e) => setAgentMessageText(e.target.value)}
                          placeholder="Escribe una respuesta manual al cliente (Silenciar├í el Bot de IA)..."
                          className={`flex-1 px-4 py-3 border rounded-xl text-sm transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-amber-400/20 focus:border-amber-400/40 ${
                            isDarkMode 
                              ? 'bg-slate-950 border-slate-800 text-slate-200 placeholder:text-slate-500' 
                              : 'bg-white/60 border-slate-300/60 text-slate-900 placeholder:text-slate-400'
                          }`}
                        />
                        <button
                          type="submit"
                          className={`py-3 px-5 border rounded-xl font-bold transition flex items-center justify-center space-x-2 text-sm shadow-sm cursor-pointer ${
                            isDarkMode 
                              ? 'bg-slate-850 hover:bg-slate-800 text-white border-slate-800' 
                              : 'bg-amber-500 hover:bg-amber-600 text-white border-amber-500'
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
                      <MessageSquare className="h-16 w-16 stroke-1 text-amber-400" />
                    </div>
                    <div>
                      <h4 className={`font-bold text-lg transition-colors duration-200 ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>Historial de Conversaciones</h4>
                      <p className={`text-sm max-w-sm mt-1 font-light transition-colors duration-200 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                        Selecciona un n├║mero de tel├®fono de la lista de la izquierda para monitorizar su chat con la IA o intervenir manualmente.
                      </p>
                    </div>
                    <button 
                      onClick={() => setActiveTab('simulator')}
                      className="mt-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs py-2.5 px-5 rounded-xl shadow-md transition cursor-pointer"
                    >
                      Abrir Simulador de WhatsApp
                    </button>
                  </div>
                )}
              </div>
            </div>
  );
};

