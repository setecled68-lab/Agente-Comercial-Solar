import { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Chat, QualifiedLead } from '../types';

interface UseFirebaseProps {
  onNewLeadNotification: (lead: QualifiedLead) => void;
}

export function useFirebase({ onNewLeadNotification }: UseFirebaseProps) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [leads, setLeads] = useState<QualifiedLead[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isFirebaseConnected, setIsFirebaseConnected] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<string>('');

  const seenLeadIdsRef = useRef<Set<string>>(new Set());
  const isFirstLeadsLoadRef = useRef(true);

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
          
          if (isFirstLeadsLoadRef.current) {
            leadsData.forEach((lead) => {
              seenLeadIdsRef.current.add(lead.id);
            });
            isFirstLeadsLoadRef.current = false;
          } else {
            leadsData.forEach((lead) => {
              if (!seenLeadIdsRef.current.has(lead.id)) {
                seenLeadIdsRef.current.add(lead.id);
                onNewLeadNotification(lead);
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
      const chatsQuery = query(collection(db, 'tenants/o3energy_mexico/chats'), orderBy('lastMessageAt', 'desc'));
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

      const leadsQuery = query(collection(db, 'tenants/o3energy_mexico/qualified_leads'), orderBy('createdAt', 'desc'));
      unsubscribeLeads = onSnapshot(leadsQuery, (snapshot) => {
        const leadsList: QualifiedLead[] = [];
        snapshot.forEach((doc) => {
          leadsList.push({ id: doc.id, ...(doc.data() as any) });
        });

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
                onNewLeadNotification(leadData);
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
  }, [onNewLeadNotification]);

  return {
    chats,
    setChats,
    leads,
    setLeads,
    isLoading,
    isFirebaseConnected,
    lastRefreshed
  };
}
