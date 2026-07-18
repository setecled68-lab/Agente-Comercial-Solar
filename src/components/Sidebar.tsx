import React from 'react';
import { MessageSquare, Users, Database, Sparkles, Server, Trash2, X } from 'lucide-react';
import { Chat, QualifiedLead } from '../types';

interface SidebarProps {
  isDarkMode: boolean;
  activeTab: string;
  setActiveTab: (tab: 'chats' | 'leads' | 'simulator' | 'guide' | 'copilot') => void;
  chats: Chat[];
  leads: QualifiedLead[];
  isFirebaseConnected: boolean;
  lastRefreshed: string | null;
  handleResetDemo: () => Promise<void>;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (val: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isDarkMode,
  activeTab,
  setActiveTab,
  chats,
  leads,
  isFirebaseConnected,
  lastRefreshed,
  handleResetDemo,
  isMobileMenuOpen,
  setIsMobileMenuOpen
}) => {
  return (
    <>
      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 md:hidden transition-opacity" 
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
      
      <aside className={`fixed inset-y-0 left-0 z-50 w-80 flex flex-col border-r transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        } ${
          isDarkMode ? 'bg-slate-900 border-slate-800/80 text-slate-250' : 'bg-white border-slate-200 text-slate-700'
      }`}>
        {/* Header / Logo */}
        <div className={`p-6 border-b transition-colors duration-200 flex justify-between items-center ${isDarkMode ? 'border-slate-800/80' : 'border-slate-200'}`}>
          <div className="flex-shrink-0 bg-white/5 p-3 rounded-xl border border-white/5 shadow-sm w-full flex justify-center items-center relative">
            <img src="/images/logo-o3.png" alt="O3 Energy Logo" className="h-16 w-auto object-contain" />
            <button 
              onClick={() => setIsMobileMenuOpen(false)}
              className="absolute right-2 top-2 p-1.5 rounded-lg md:hidden hover:bg-slate-800 hover:text-white text-slate-400 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 px-4 py-6 space-y-2.5 overflow-y-auto">
          <button
            onClick={() => { setActiveTab('chats'); setIsMobileMenuOpen(false); }}
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
            onClick={() => { setActiveTab('leads'); setIsMobileMenuOpen(false); }}
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
            onClick={() => { setActiveTab('copilot'); setIsMobileMenuOpen(false); }}
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
            onClick={() => { setActiveTab('simulator'); setIsMobileMenuOpen(false); }}
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
    </>
  );
};
