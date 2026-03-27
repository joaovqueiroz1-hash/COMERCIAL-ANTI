import React, { useState, useEffect, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { fetchLeads, fetchZApiConfigGlobally, createLead, createWhatsAppMessage, fetchWhatsAppMessages, fetchRecentWhatsAppContacts } from "@/lib/api";
import { Lead, WhatsAppMessage } from "@/lib/api";
import { sendTextMessage, ZApiConfig, normalizePhone, getChats, getMessages, ZApiMessage, ZApiChat } from "@/lib/zapi";
import { Loader2, Send, Search, Check, CheckCheck, Clock, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { normalizeWhatsAppKey, cleanWhatsAppNumber } from "@/lib/whatsapp-utils";
import { supabase } from "@/integrations/supabase/client";

// Helper super seguro para evitar qualquer bug de tela preta
const safeString = (s: any) => (s || '').toString();

type ChatContact = {
  id: string; // telefone limpo ou id do lead
  phone: string;
  name: string;
  isLead: boolean;
  leadId: string | null;
  leadStatus: string | null;
  lastMessageTime: number;
};

export default function WhatsAppCRM() {
  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<ChatContact[]>([]);
  const [selectedContact, setSelectedContact] = useState<ChatContact | null>(null);
  
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [zapiConfig, setZapiConfig] = useState<ZApiConfig | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const selectedContactRef = useRef<ChatContact | null>(null);

  useEffect(() => {
    selectedContactRef.current = selectedContact;
  }, [selectedContact]);

  // 1. Carregar Configuração e Estado Inicial Único
  useEffect(() => {
    async function init() {
      try {
        setLoading(true);
        const cfg = await fetchZApiConfigGlobally();
        if (cfg) {
           setZapiConfig({
             instanceId: cfg.instance_id,
             token: cfg.token,
             clientToken: cfg.client_token || ''
           });
        }

        // Busca assíncrona dos Leads e Interações recentes na base
        const [leads, recentMessages] = await Promise.all([
          fetchLeads().catch(() => [] as Lead[]),
          fetchRecentWhatsAppContacts().catch(() => [] as any[])
        ]);

        const mergedContacts = new Map<string, ChatContact>();

        // 1.1 Mapear Leads primeiro (assim eles sempre terão "isLead: true")
        leads.forEach(lead => {
          if (lead.whatsapp) {
            const cleanPhone = cleanWhatsAppNumber(lead.whatsapp);
            if (cleanPhone) {
              mergedContacts.set(cleanPhone, {
                id: cleanPhone,
                phone: lead.whatsapp,
                name: safeString(lead.nome_completo) || 'Lead sem Nome',
                isLead: true,
                leadId: lead.id,
                leadStatus: safeString(lead.status_pipeline).replace('_', ' '),
                lastMessageTime: new Date(lead.created_at || 0).getTime() // base time
              });
            }
          }
        });

        // 1.2 Mapear Chats Recentes (Supabase whatsapp_messages)
        // Isso traz todos os telefones que interagiram, sejam leads ou não.
        recentMessages.forEach((msg) => {
          if (!msg.phone) return;
          const cleanPhone = cleanWhatsAppNumber(msg.phone);
          if (!cleanPhone || cleanPhone.length < 8) return;

          const msgTime = new Date(msg.timestamp).getTime();

          const existingKey = Array.from(mergedContacts.keys()).find(k => 
             k === cleanPhone || k === '55' + cleanPhone || '55' + k === cleanPhone
          );

          if (existingKey) {
            const existing = mergedContacts.get(existingKey)!;
            // Atualiza lastMessageTime se a mensagem atual for mais recente
            if (msgTime > existing.lastMessageTime) {
              existing.lastMessageTime = msgTime;
            }
          } else {
            // Contato novo desconhecido
            mergedContacts.set(cleanPhone, {
              id: cleanPhone,
              phone: msg.phone,
              name: safeString(msg.sender_name) || 'Contato Desconhecido',
              isLead: false,
              leadId: null,
              leadStatus: null,
              lastMessageTime: msgTime
            });
          }
        });

        // 1.3 Ordenar os contatos (Recência > Nome)
        const sorted = Array.from(mergedContacts.values()).sort((a,b) => {
           if (a.lastMessageTime !== b.lastMessageTime) {
             return b.lastMessageTime - a.lastMessageTime;
           }
           return safeString(a.name).localeCompare(safeString(b.name));
        });

        setContacts(sorted);

      } catch (err) {
        console.error("Erro na inicialização do CRM:", err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  // 2. Filtro de Busca da Barra Lateral
  useEffect(() => {
    if (searchTerm) {
      const term = safeString(searchTerm).toLowerCase();
      const numTerm = safeString(searchTerm).replace(/\D/g, '');
      setFilteredContacts(contacts.filter(c => 
        safeString(c.name).toLowerCase().includes(term) || 
        (c.phone && safeString(c.phone).replace(/\D/g, '').includes(numTerm))
      ));
    } else {
      setFilteredContacts(contacts);
    }
  }, [searchTerm, contacts]);

  // 3. Atualizar auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 4. Carregar Histórico do Banco ao Clicar num Contato
  useEffect(() => {
    if (!selectedContact || !selectedContact.phone) {
      setMessages([]);
      return;
    }

    async function loadHistory() {
      try {
        const dbMsgs = await fetchWhatsAppMessages(selectedContact!.phone);
        setMessages(dbMsgs || []);
      } catch (err) {
        console.error("Erro ao carregar histórico local:", err);
        setMessages([]);
      }
    }
    
    loadHistory();
  }, [selectedContact]);

  // 4.5 Fallback Polling Master de Contatos (Z-API)
  useEffect(() => {
    if (!zapiConfig) return;

    let isSyncing = false;
    const syncChats = async () => {
       if (isSyncing) return;
       isSyncing = true;
       try {
          const remoteChats = await getChats(zapiConfig, 1).catch(() => [] as ZApiChat[]);
          if (!remoteChats || remoteChats.length === 0) return;

          setContacts(prev => {
             let updated = [...prev];
             let hasChanges = false;
             
             remoteChats.forEach((chat, index) => {
                const cleanPhone = cleanWhatsAppNumber(chat.phone);
                if (!cleanPhone || cleanPhone.length < 8) return;
                
                const existingIdx = updated.findIndex(c => c.id === cleanPhone);
                const pseudoTime = Date.now() - (index * 1000); // Força recência pela ordem da API

                if (existingIdx >= 0) {
                   if (updated[existingIdx].lastMessageTime < pseudoTime) {
                      updated[existingIdx] = { ...updated[existingIdx], lastMessageTime: pseudoTime };
                      hasChanges = true;
                   }
                } else {
                   updated.push({
                      id: cleanPhone,
                      phone: chat.phone,
                      name: safeString(chat.name) || 'Contato Desconhecido',
                      isLead: false,
                      leadId: null,
                      leadStatus: null,
                      lastMessageTime: pseudoTime
                   });
                   hasChanges = true;
                }
             });
             
             if (hasChanges) {
                return updated.sort((a,b) => b.lastMessageTime - a.lastMessageTime);
             }
             return prev;
          });
       } catch(e) {} finally { isSyncing = false; }
    };

    const t = setInterval(syncChats, 12000);
    syncChats();
    return () => clearInterval(t);
  }, [zapiConfig]);

  // 4.6 Fallback Polling Mensagens Z-API
  useEffect(() => {
    if (!zapiConfig || !selectedContact || !selectedContact.phone) return;

    let isFetching = false;
    const fetchZapiMsgs = async () => {
       if (isFetching) return;
       isFetching = true;
       try {
          const phoneToFetch = normalizePhone(selectedContact.phone);
          const zMsgs = await getMessages(zapiConfig, phoneToFetch, 1).catch((err) => {
             console.error("Z-API getMessages ERRO:", err);
             return [] as ZApiMessage[];
          });
          if (zMsgs && zMsgs.length > 0) {
             const formatted = zMsgs.map(m => {
                 const mId = m.messageId || (m as any).id || (m as any).message_id || `msg-${Date.now()}-${Math.random()}`;
                 return {
                     id: mId,
                     message_id: mId,
                     phone: selectedContact.phone,
                     text_content: m.text?.message || (m as any).message || (m.type === 'image' || m.type === 'Image' ? '📷 Imagem' : m.type === 'audio' || m.type === 'Audio' ? '🎤 Áudio' : m.type ? `📎 Arquivo (${m.type})` : 'Mensagem Indefinida'),
                     from_me: !!m.fromMe,
                     sender_name: safeString(m.senderName) || (m.fromMe ? 'Você' : selectedContact.name),
                     timestamp: m.momment ? new Date(m.momment).toISOString() : new Date().toISOString(),
                     status: safeString(m.status) || 'recebido'
                 };
             }) as WhatsAppMessage[];
             
             setMessages(prev => {
                const merged = [...prev];
                let hasChange = false;
                formatted.forEach(fm => {
                   const idx = merged.findIndex(x => x.message_id === fm.message_id);
                   if (idx === -1) { merged.push(fm); hasChange = true; }
                   else if (merged[idx].status !== fm.status) { merged[idx] = fm; hasChange = true; }
                });
                if (hasChange) {
                   // Salva silenciosamente no DB
                   formatted.forEach(m => {
                      if (!prev.find(x => x.message_id === m.message_id)) {
                         createWhatsAppMessage(m).catch(()=>{});
                      }
                   });
                   return merged.sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
                }
                return prev;
             });
          }
       } catch (e) {} finally { isFetching = false; }
    };

    const t = setInterval(fetchZapiMsgs, 5000);
    fetchZapiMsgs();
    return () => clearInterval(t);
  }, [selectedContact, zapiConfig]);

  // 5. SUPABASE REALTIME MASTER
  // Esta inscrição única vai ouvir por todas as mensagens (envio ou recebimento)
  // que cairem no Supabase. O Webhook salvará aqui. Se nós enviarmos, salvamos aqui.
  useEffect(() => {
    const channel = supabase.channel('global_crm_messages')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'whatsapp_messages' },
        (payload) => {
           const newMsg = (payload.new || payload.old) as WhatsAppMessage;
           if (!newMsg || !newMsg.phone) return;

           const cleanNewMsgPhone = cleanWhatsAppNumber(newMsg.phone);
           const msgTime = new Date(newMsg.timestamp).getTime();

           // 5.1 Bubble up: Atualizar a ordem dos Contatos na Barra Lateral
           setContacts(prevContacts => {
              let updatedContacts = [...prevContacts];
              
              const existingIndex = updatedContacts.findIndex(c => {
                 const cleanC = cleanWhatsAppNumber(c.phone);
                 return cleanC === cleanNewMsgPhone || '55' + cleanC === cleanNewMsgPhone || cleanC === '55' + cleanNewMsgPhone;
              });

              if (existingIndex >= 0) {
                 // Contato existe: atualiza timestamp e traz pro topo do array de mem
                 const updatedContact = { ...updatedContacts[existingIndex] };
                 if (msgTime > updatedContact.lastMessageTime) {
                    updatedContact.lastMessageTime = msgTime;
                 }
                 // Se foi recebida de alguém desconhecido que já tá lá, talvez pegar o sender_name
                 if (!updatedContact.isLead && newMsg.sender_name && newMsg.sender_name !== 'Você') {
                    updatedContact.name = newMsg.sender_name;
                 }
                 updatedContacts[existingIndex] = updatedContact;
              } else {
                 // Contato é novo! Veio do webhook para um numero q nao tinhamos cacheado
                 updatedContacts.push({
                    id: cleanNewMsgPhone,
                    phone: newMsg.phone,
                    name: safeString(newMsg.sender_name) || 'Contato Desconhecido',
                    isLead: false,
                    leadId: null,
                    leadStatus: null,
                    lastMessageTime: msgTime
                 });
              }

              // Reordena
              return updatedContacts.sort((a,b) => b.lastMessageTime - a.lastMessageTime);
           });

           // 5.2 Se a mensagem pertence ao contato aberto, atualiza a tela do Chat
           const currentContact = selectedContactRef.current;
           if (currentContact && currentContact.phone) {
              const cleanCurrent = cleanWhatsAppNumber(currentContact.phone);
              if (cleanNewMsgPhone === cleanCurrent || '55' + cleanNewMsgPhone === cleanCurrent || cleanNewMsgPhone === '55' + cleanCurrent) {
                 setMessages(prev => {
                    const exists = prev.find(m => m.message_id === newMsg.message_id || m.id === newMsg.id);
                    if (exists) {
                       if (payload.event !== 'INSERT') {
                          return prev.map(m => (m.message_id === newMsg.message_id || m.id === newMsg.id) ? newMsg : m);
                       }
                       return prev; // já inserido pela ação de enviar otimista
                    }
                    const updated = [...prev, newMsg];
                    return updated.sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
                 });
              }
           }
        }
      ).subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // 6. Enviar Mensagem (UI Otimista + ZAPI + DB)
  const handleSend = async () => {
    if (!inputText.trim() || !selectedContact || !selectedContact.phone || !zapiConfig) return;

    setSending(true);
    const textMsg = inputText.trim();
    setInputText(""); // UI Otimista: limpa imediatamente
    const phoneToUse = normalizePhone(selectedContact.phone);

    try {
      // 6.1 Disparar para Z-API
      const res = await sendTextMessage(zapiConfig, {
        phone: phoneToUse,
        message: textMsg
      });

      const messageId = res.messageId || res.id || `local-${Date.now()}`;
      const now = new Date().toISOString();

      // 6.2 Adicionar localmente e instantaneamente na tela do chat e persistir no banco
      const fakeMsg: WhatsAppMessage = {
         id: messageId,
         lead_id: selectedContact.isLead ? selectedContact.leadId : null,
         phone: phoneToUse,
         message_id: messageId,
         text_content: textMsg,
         from_me: true,
         status: "enviado",
         sender_name: "Você",
         timestamp: now,
         created_at: now
      } as any;
      
      setMessages(prev => [...prev, fakeMsg]);

      // 6.3 Atualizar a barra lateral pra pular esse cara lá em cima
      setContacts(prev => {
         const list = [...prev];
         const idx = list.findIndex(c => c.id === selectedContact.id);
         if (idx >= 0) {
            list[idx] = { ...list[idx], lastMessageTime: new Date().getTime() };
         }
         return list.sort((a,b) => b.lastMessageTime - a.lastMessageTime);
      });

      // 6.4 Persistir no banco real. E vai disparar o realtime (que ja lidamos via deduplicador 'exists')
      await createWhatsAppMessage({
        lead_id: selectedContact.isLead ? selectedContact.leadId : null,
        phone: phoneToUse,
        message_id: messageId,
        text_content: textMsg,
        from_me: true,
        status: "enviado",
        timestamp: now,
        sender_name: "Você"
      });

    } catch (e: any) {
      toast.error(e.message || "Erro ao enviar mensagem");
    } finally {
      setSending(false);
    }
  };

  const handleCreateLead = async () => {
     if (!selectedContact || selectedContact.isLead) return;
     try {
       const newLeadName = selectedContact.name && selectedContact.name !== 'Contato Desconhecido' 
                            ? selectedContact.name : 'Novo Lead do WhatsApp';
       
       const createdLead = await createLead({
          nome_completo: newLeadName,
          whatsapp: selectedContact.phone,
          status_pipeline: 'novo_lead',
          prioridade: 'media',
          origem: 'WhatsApp'
       } as any);

       toast.success("Lead criado com sucesso!");

       const updated: ChatContact = { ...selectedContact, isLead: true, leadId: createdLead.id, leadStatus: 'novo lead', name: createdLead.nome_completo };
       setSelectedContact(updated);
       setContacts(prev => prev.map(c => c.id === updated.id ? updated : c));
       
     } catch (err) {
       console.error(err);
       toast.error("Erro ao converter para Lead.");
     }
  };

  const renderStatusIcon = (status: string | null | undefined) => {
    const s = safeString(status).toLowerCase();
    if (s === 'lida' || s === 'read') return <CheckCheck size={12} className="text-blue-500" />;
    if (s === 'entregue' || s === 'received') return <CheckCheck size={12} className="text-muted-foreground" />;
    if (s === 'enviado' || s === 'sent') return <Check size={12} className="text-muted-foreground" />;
    return <Clock size={12} className="text-muted-foreground" />;
  };

  const firstLetter = (str: any) => {
    const s = safeString(str).trim();
    if (!s) return 'U';
    return s.charAt(0).toUpperCase();
  };

  // Prepara datas e headers para dias
  const isSameDay = (d1: Date, d2: Date) => {
     return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
  };

  const formatDateLabel = (date: Date) => {
     const today = new Date();
     const yesterday = new Date(today);
     yesterday.setDate(yesterday.getDate() - 1);

     if (isSameDay(date, today)) return "Hoje";
     if (isSameDay(date, yesterday)) return "Ontem";
     return date.toLocaleDateString('pt-BR');
  };

  return (
    <AppLayout title="WhatsApp CRM" subtitle="Gerenciamento de conversas Realtime por Webhooks nativos">
      <div className="flex h-[calc(100vh-140px)] gap-4 px-4 pb-4 w-full max-w-[1400px] mx-auto">
        
        {/* Sidebar */}
        <div className="w-1/3 min-w-[300px] max-w-[400px] card-premium flex flex-col overflow-hidden bg-background">
          <div className="p-4 border-b border-border">
            <h3 className="font-semibold text-sm mb-3">Conversas</h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <input 
                type="text" 
                placeholder="Buscar nome ou número..."
                className="w-full bg-secondary border border-border rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-primary/50"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            {!zapiConfig && !loading && (
               <div className="mt-3 bg-red-500/10 border border-red-500/20 text-red-500 text-xs p-2 rounded">
                 ⚠️ Conecte a Z-API no menu Configurações.
               </div>
            )}
          </div>
          
          <div className="flex-1 overflow-y-auto w-full custom-scrollbar">
            {loading ? (
              <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" /></div>
            ) : filteredContacts.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">Você não possui contatos ou leads registrados no banco local.</div>
            ) : (
              <ul className="w-full">
                {filteredContacts.map(c => (
                  <li 
                    key={c.id + c.phone} 
                    className={`p-3 border-b border-border/50 cursor-pointer transition-colors ${selectedContact?.id === c.id ? 'bg-primary/5 border-l-2 border-l-primary' : 'hover:bg-secondary/50'} relative group`}
                    onClick={() => setSelectedContact(c)}
                  >
                    <div className="flex items-center gap-3">
                       {/* Avatar */}
                       <div className={`h-10 w-10 shrink-0 rounded-full flex items-center justify-center font-bold text-sm ${
                          c.isLead ? 'bg-primary/20 text-primary' : 'bg-red-500/20 text-red-400'
                       }`}>
                         {firstLetter(c.name)}
                       </div>
                       
                       <div className="flex-1 min-w-0">
                         <div className="flex items-center justify-between gap-2">
                           <div className="font-medium text-[13px] text-foreground truncate">{c.name || 'Sem nome'}</div>
                           <span className="text-[10px] text-muted-foreground shrink-0">
                               {c.lastMessageTime > 0 ? formatDateLabel(new Date(c.lastMessageTime)) : ''}
                           </span>
                         </div>
                         <div className="text-[11px] text-muted-foreground mt-0.5 flex justify-between items-center w-full">
                           <span className="truncate">{c.phone ? normalizeWhatsAppKey(c.phone) : 'Sem telefone'}</span>
                           {c.isLead && c.leadStatus ? (
                             <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded ml-2 truncate max-w-[80px]">{c.leadStatus}</span>
                           ) : !c.isLead ? (
                             <span className="text-[9px] bg-red-500/10 text-red-500 px-1.5 py-0.5 rounded ml-2 truncate max-w-[80px]">Não é Lead</span>
                           ) : null}
                         </div>
                       </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 card-premium flex flex-col bg-[#0b141a]">
          {selectedContact ? (
            <>
              {/* Header */}
              <div className="h-16 px-4 bg-secondary/80 border-b border-border flex items-center justify-between shadow-sm z-10">
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 shrink-0 rounded-full flex items-center justify-center font-bold ${
                    selectedContact.isLead ? 'bg-primary/20 text-primary' : 'bg-red-500/20 text-red-400'
                  }`}>
                    {firstLetter(selectedContact.name)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground text-sm truncate">{selectedContact.name || 'Sem Nome'}</h3>
                      {!selectedContact.isLead && (
                        <span className="text-[10px] bg-red-500/10 text-red-500 px-1.5 py-0.5 rounded shrink-0 hidden sm:inline-block">Não é Lead</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {selectedContact.phone ? normalizeWhatsAppKey(selectedContact.phone) : 'Sem número'}
                    </p>
                  </div>
                </div>
                
                {/* Actions */}
                {!selectedContact.isLead && selectedContact.phone && (
                   <button 
                     onClick={handleCreateLead}
                     className="flex items-center gap-2 px-3 py-1.5 shrink-0 text-xs font-medium bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
                   >
                     <UserPlus size={14} />
                     <span className="hidden sm:inline">Tornar Lead</span>
                   </button>
                )}
              </div>

              {/* Messages Map */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[url('https://i.pinimg.com/236x/8c/98/99/8c98994518b575bfd8c949e91d20548b.jpg')] bg-cover bg-center custom-scrollbar" style={{ backgroundColor: 'rgba(11,20,26,0.95)', backgroundBlendMode: 'overlay' }}>
                {!selectedContact.phone && (
                   <div className="text-center p-4 bg-secondary/80 text-sm text-muted-foreground rounded-lg max-w-sm mx-auto">
                     Este contato não possui um número de WhatsApp cadastrado.
                   </div>
                )}
                
                {messages.length === 0 && selectedContact.phone && (
                   <div className="text-center p-3 text-xs text-muted-foreground rounded-lg w-max mx-auto shadow-sm">
                     Não há mensagens processadas pelo banco para este contato.
                     <br /> As próximas mensagens que enviarem aparecerão aqui automaticamente via Webhook.
                   </div>
                )}
                
                {messages.map((msg, i) => {
                  const isMe = msg.from_me;
                  const date = msg.timestamp ? new Date(msg.timestamp) : new Date();
                  const timeString = isNaN(date.getTime()) ? '' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  
                  // Label Data se mudou dia
                  let showDateLabel = false;
                  if (i === 0) showDateLabel = true;
                  else {
                    const prevDate = new Date(messages[i-1].timestamp);
                    if (!isSameDay(date, prevDate)) showDateLabel = true;
                  }

                  return (
                    <React.Fragment key={msg.id || msg.message_id || `msg-${i}`}>
                      {showDateLabel && (
                        <div className="flex justify-center my-4">
                           <span className="text-[11px] bg-[#202c33] text-gray-300 px-3 py-1 rounded-lg border border-border shadow-sm">
                             {formatDateLabel(date)}
                           </span>
                        </div>
                      )}
                      <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] rounded-lg p-2.5 shadow-sm relative text-sm ${
                          isMe ? 'bg-[#005c4b] text-[#e9edef] rounded-tr-none' : 'bg-[#202c33] text-[#e9edef] rounded-tl-none'
                        }`}>
                          <div className="whitespace-pre-wrap break-words pr-8 pb-3">{safeString(msg.text_content)}</div>
                          <div className="absolute bottom-1 right-2 flex items-center gap-1 text-[10px] text-white/50">
                            {timeString}
                            {isMe && renderStatusIcon(msg.status)}
                          </div>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-3 bg-[#202c33] border-t border-border flex items-end gap-2">
                <textarea
                  className="flex-1 bg-[#2a3942] text-[#e9edef] border-transparent rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 min-h-[44px] max-h-[120px] resize-none"
                  placeholder="Digite uma mensagem..."
                  value={inputText}
                  disabled={sending || !selectedContact.phone}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  rows={1}
                  autoFocus
                />
                <button
                  onClick={handleSend}
                  disabled={sending || !inputText.trim() || !selectedContact.phone}
                  className="h-11 w-11 rounded-full bg-primary flex items-center justify-center text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed shrink-0 transition-colors"
                >
                  {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} className="translate-x-[1.5px]" />}
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8 text-center bg-[#0b141a]">
              <div className="w-24 h-24 mb-6 rounded-full bg-primary/10 flex items-center justify-center">
                 <Send className="h-10 w-10 text-primary opacity-80" />
              </div>
              <h3 className="text-xl font-medium text-foreground mb-2">WhatsApp Web Realtime</h3>
              <p className="max-w-md">Selecione uma conversa na lista lateral. Suas mensagens agora fluem em tempo real via nativo e sem atrasos.</p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
