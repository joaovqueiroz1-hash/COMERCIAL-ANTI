import { useState, useEffect, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { fetchLeads, fetchRecentWhatsAppContacts, fetchWhatsAppMessages, fetchZApiConfigGlobally, createWhatsAppMessage, createLead } from "@/lib/api";
import { Lead, WhatsAppMessage } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { sendTextMessage, ZApiConfig, normalizePhone, getChats, getMessages, ZApiMessage } from "@/lib/zapi";
import { Loader2, Send, Search, Check, CheckCheck, Clock, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { normalizeWhatsAppKey } from "@/lib/whatsapp-utils";

export type ContactItem = {
  id: string; // lead id or phone for unknowns
  name: string;
  phone: string;
  isLead: boolean;
  leadData?: Lead;
  lastMessageAt?: string;
};

export default function WhatsAppCRM() {
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<ContactItem[]>([]);
  const [selectedContact, setSelectedContact] = useState<ContactItem | null>(null);
  const selectedContactRef = useRef<ContactItem | null>(null);

  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [zapiConfig, setZapiConfig] = useState<ZApiConfig | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Mantém a ref atualizada para usar no event listener global sem precisar recriá-lo
  useEffect(() => {
    selectedContactRef.current = selectedContact;
  }, [selectedContact]);

  useEffect(() => {
    async function loadData() {
      try {
        const [loadedLeads, recentMessages, cfg] = await Promise.all([
          fetchLeads(),
          fetchRecentWhatsAppContacts(),
          fetchZApiConfigGlobally()
        ]);
        
        const contactMap = new Map<string, ContactItem>();

        // 1. Add Leads
        loadedLeads.forEach(lead => {
          if (lead.whatsapp) {
            const cleanPhone = lead.whatsapp.replace(/\D/g, '');
            contactMap.set(cleanPhone, {
              id: lead.id,
              name: lead.nome_completo,
              phone: lead.whatsapp,
              isLead: true,
              leadData: lead
            });
          }
        });

        // 2. Add Recent Unknowns
        recentMessages?.forEach(msg => {
          const cleanPhone = msg.phone.replace(/\D/g, '');
          
          const existingKey = Array.from(contactMap.keys()).find(k => 
             k === cleanPhone || k === '55' + cleanPhone || '55' + k === cleanPhone
          );

          if (!existingKey) {
             if (cleanPhone.length >= 10) {
               contactMap.set(cleanPhone, {
                 id: cleanPhone,
                 name: msg.sender_name || 'Contato Desconhecido',
                 phone: msg.phone,
                 isLead: false,
                 lastMessageAt: msg.timestamp
               });
             }
          } else {
             const existing = contactMap.get(existingKey)!;
             if (!existing.lastMessageAt || new Date(msg.timestamp) > new Date(existing.lastMessageAt)) {
               existing.lastMessageAt = msg.timestamp;
             }
          }
        });

        // Add any remaining leads that don't have WhatsApp just to show them
        loadedLeads.forEach(lead => {
           if (!lead.whatsapp) {
             contactMap.set(lead.id, {
                id: lead.id,
                name: lead.nome_completo,
                phone: '',
                isLead: true,
                leadData: lead
             });
           }
        });

        const contactsList = Array.from(contactMap.values()).sort((a,b) => {
           if (a.lastMessageAt && b.lastMessageAt) {
              return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
           }
           if (a.lastMessageAt) return -1;
           if (b.lastMessageAt) return 1;
           return (a.name || '').localeCompare(b.name || '');
        });

        setContacts(contactsList);
        setFilteredContacts(contactsList);
        
        if (cfg) {
           setZapiConfig({
             instanceId: cfg.instance_id,
             token: cfg.token,
             clientToken: cfg.client_token || ''
           });
        }
      } catch (err) {
        console.error("Erro ao carregar dados", err);
        toast.error("Erro ao carregar contatos ou configuração Z-API");
      } finally {
        setLoading(false);
      }
    }
    loadData();

    // Inscrição Global para novas mensagens (atualiza sidebar e chat ativo)
    const channel = supabase.channel('global_whatsapp_messages')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'whatsapp_messages' }, 
        (payload) => {
          const newMsg = (payload.new || payload.old) as WhatsAppMessage;
          if (!newMsg || !newMsg.phone) return;

          const cleanNewPhone = newMsg.phone.replace(/\D/g, '');
          
          if (!cleanNewPhone) return;

          // Atualiza lista de contatos (Sidebar)
          setContacts(prev => {
             const existingIdx = prev.findIndex(c => {
                const cPhone = c.phone ? c.phone.replace(/\D/g, '') : '';
                return cPhone === cleanNewPhone || cPhone === '55' + cleanNewPhone || '55' + cPhone === cleanNewPhone;
             });
             
             if (existingIdx >= 0) {
                // Remove existing and prepend to top
                const existing = prev[existingIdx];
                const updated = { ...existing, lastMessageAt: newMsg.timestamp, name: existing.isLead ? existing.name : (newMsg.sender_name || existing.name) };
                const newArr = [...prev];
                newArr.splice(existingIdx, 1);
                return [updated, ...newArr];
             } else {
                // Add new unknown
                const newContact: ContactItem = {
                   id: cleanNewPhone,
                   name: newMsg.sender_name || 'Contato Desconhecido',
                   phone: newMsg.phone,
                   isLead: false,
                   lastMessageAt: newMsg.timestamp
                };
                return [newContact, ...prev];
             }
          });

          // Atualiza mensagens do chat aberto (se aplicável)
          const currentSelected = selectedContactRef.current;
          if (currentSelected && currentSelected.phone) {
             const currentClean = currentSelected.phone.replace(/\D/g, '');
             if (currentClean === cleanNewPhone || currentClean === '55' + cleanNewPhone || '55' + currentClean === cleanNewPhone) {
                setMessages(prevMsgs => {
                   if (prevMsgs.find(m => m.message_id === newMsg.message_id)) return prevMsgs;
                   return [...prevMsgs, newMsg].sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
                });
             }
          }
        }
      ).subscribe();

    return () => {
      supabase.removeChannel(channel);
    }
  }, []);

  useEffect(() => {
    if (searchTerm) {
      setFilteredContacts(contacts.filter(c => 
        (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
        (c.phone && c.phone.replace(/\D/g, '').includes(searchTerm.replace(/\D/g, '')))
      ));
    } else {
      setFilteredContacts(contacts);
    }
  }, [searchTerm, contacts]);

  useEffect(() => {
    if (selectedContact && selectedContact.phone) {
      loadMessages(selectedContact.phone);
    } else {
      setMessages([]);
    }
  }, [selectedContact]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // --- BACKGROUND SYNC (FALLBACK PARA QUANDO O WEBHOOK FALHA) ---
  useEffect(() => {
    if (!zapiConfig) return;

    let isSyncing = false;

    const syncMessages = async () => {
      if (isSyncing) return;
      isSyncing = true;
      try {
        // 1. Puxar chats recentes caso o webhook não esteja funcionando bem
        const remoteChats = await getChats(zapiConfig, 1);
        
        if (remoteChats && remoteChats.length > 0) {
          setContacts(prev => {
            let hasNewContacts = false;
            const newContacts = [...prev];
            
            remoteChats.forEach(chat => {
              const cleanPhone = chat.phone.replace(/\D/g, '');
              if (!cleanPhone || cleanPhone.length < 10) return;

              const existingIdx = newContacts.findIndex(c => {
                 const cPhone = c.phone ? c.phone.replace(/\D/g, '') : '';
                 return cPhone === cleanPhone || cPhone === '55' + cleanPhone || '55' + cPhone === cleanPhone;
              });

              if (existingIdx === -1) {
                const newContact: ContactItem = {
                    id: cleanPhone,
                    name: chat.name || 'Contato Desconhecido',
                    phone: chat.phone,
                    isLead: false,
                    lastMessageAt: new Date().toISOString()
                 };
                 newContacts.unshift(newContact);
                 hasNewContacts = true;
              }
            });
            
            return hasNewContacts ? newContacts : prev;
          });
        }

        // 2. Sincronizar mensagens do chat atual selecionado
        const currentSelected = selectedContactRef.current;
        if (currentSelected && currentSelected.phone) {
           const remoteMsgs = await getMessages(zapiConfig, currentSelected.phone, 1);
           
           if (remoteMsgs && remoteMsgs.length > 0) {
             setMessages(prev => {
                let hasNew = false;
                const merged = [...prev];
                
                remoteMsgs.forEach(rm => {
                   if (!rm.messageId) return;
                   const isDuplicate = merged.find(m => m.message_id === rm.messageId);
                   
                   // Focamos em mensagens textuais simples para o CRM
                   if (!isDuplicate && rm.text?.message) {
                      hasNew = true;
                      
                      const newMsg: WhatsAppMessage = {
                         id: rm.messageId,
                         lead_id: currentSelected.isLead ? currentSelected.id : null,
                         phone: rm.phone || currentSelected.phone,
                         message_id: rm.messageId,
                         text_content: rm.text.message,
                         from_me: rm.fromMe,
                         status: rm.status || 'recebido',
                         sender_name: rm.senderName || '',
                         timestamp: rm.momment ? new Date(rm.momment).toISOString() : new Date().toISOString(),
                         created_at: new Date().toISOString()
                      };
  
                      merged.push(newMsg);
                      
                      // Salvar no banco silenciosamente usando a API do lib/api
                      createWhatsAppMessage({
                         lead_id: currentSelected.isLead ? currentSelected.id : null,
                         phone: rm.phone || currentSelected.phone,
                         message_id: rm.messageId,
                         text_content: rm.text.message,
                         from_me: rm.fromMe,
                         status: rm.status || 'recebido',
                         sender_name: rm.senderName || '',
                         timestamp: rm.momment ? new Date(rm.momment).toISOString() : new Date().toISOString()
                      }).catch(() => {});
                   }
                });
                
                if (hasNew) {
                   return merged.sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
                }
                return prev;
             });
           }
        }
      } catch (err) {
        console.warn("Erro silencioso no background sync:", err);
      } finally {
        isSyncing = false;
      }
    };

    // Roda no primeiro mount e a cada 10 segundos
    syncMessages();
    const interval = setInterval(syncMessages, 10000);
    return () => clearInterval(interval);
  }, [zapiConfig]);

  async function loadMessages(phone: string) {
    try {
      const msgs = await fetchWhatsAppMessages(phone);
      setMessages(msgs);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao carregar mensagens.");
    }
  }

  const handleSend = async () => {
    if (!inputText.trim() || !selectedContact || !selectedContact.phone) return;
    if (!zapiConfig) {
      toast.error("Z-API não configurado. Vá em Configurações para conectar.");
      return;
    }

    setSending(true);
    const textMsg = inputText.trim();
    setInputText("");

    try {
      const phone = normalizePhone(selectedContact.phone);
      
      const res = await sendTextMessage(zapiConfig, {
        phone,
        message: textMsg
      });

      const savedMsg = await createWhatsAppMessage({
        lead_id: selectedContact.isLead ? selectedContact.id : null,
        phone: phone,
        message_id: res.messageId || res.id || `local-${Date.now()}`,
        text_content: textMsg,
        from_me: true,
        status: "enviado",
        timestamp: new Date().toISOString()
      });

      setMessages(prev => [...prev, savedMsg]);
    } catch (e: any) {
      toast.error(e.message || "Erro ao enviar mensagem");
    } finally {
      setSending(false);
    }
  };

  const handleCreateLead = async () => {
     if (!selectedContact) return;
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

       // Atualiza a lista e o contato selecionado
       const updatedContact: ContactItem = {
          ...selectedContact,
          id: createdLead.id,
          isLead: true,
          name: createdLead.nome_completo,
          leadData: createdLead
       };

       setContacts(prev => prev.map(c => c.id === selectedContact.id ? updatedContact : c));
       setSelectedContact(updatedContact);
       
     } catch (err) {
       console.error(err);
       toast.error("Erro ao converter para Lead.");
     }
  };

  const getStatusIcon = (status: string | null | undefined) => {
    switch ((status || '').toLowerCase()) {
      case 'entregue':
      case 'lida':
        return <CheckCheck size={12} className={(status || '').toLowerCase() === 'lida' ? "text-blue-500" : "text-muted-foreground"} />;
      case 'enviado':
        return <Check size={12} className="text-muted-foreground" />;
      default:
        return <Clock size={12} className="text-muted-foreground" />;
    }
  };

  return (
    <AppLayout title="WhatsApp Realtime CRM" subtitle="Gerencie conversas com leads e novos contatos">
      <div className="flex h-[calc(100vh-140px)] gap-4 px-4 pb-4 w-full max-w-[1400px] mx-auto">
        
        {/* Sidebar de Leads/Contatos */}
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
                 ⚠️ API do WhatsApp não detectada. Configure a integração em <br />Configurações → Z-API.
               </div>
            )}
          </div>
          
          <div className="flex-1 overflow-y-auto w-full">
            {loading ? (
              <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" /></div>
            ) : filteredContacts.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">Nenhuma conversa encontrada.</div>
            ) : (
              <ul className="w-full">
                {filteredContacts.map(contact => (
                  <li 
                    key={contact.id} 
                    className={`p-4 border-b border-border/50 cursor-pointer transition-colors ${selectedContact?.id === contact.id ? 'bg-primary/5 border-l-2 border-l-primary' : 'hover:bg-secondary/50'}`}
                    onClick={() => setSelectedContact(contact)}
                  >
                    <div className="flex items-center justify-between">
                       <div className="font-medium text-sm text-foreground truncate max-w-[70%]">{contact.name}</div>
                       {!contact.isLead && (
                          <span className="text-[10px] bg-red-500/10 text-red-500 px-1.5 py-0.5 rounded border border-red-500/20 whitespace-nowrap">Desconhecido</span>
                       )}
                       {contact.isLead && contact.leadData?.status_pipeline && (
                          <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded max-w-[30%] truncate">{(contact.leadData.status_pipeline || '').replace('_',' ')}</span>
                       )}
                    </div>
                    
                    <div className="text-xs text-muted-foreground mt-1 flex justify-between items-center">
                      <span className="truncate">{contact.phone ? normalizeWhatsAppKey(contact.phone) : 'Sem número'}</span>
                      {contact.lastMessageAt && (
                        <span>{new Date(contact.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      )}
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
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold ${
                    selectedContact.isLead ? 'bg-primary/20 text-primary' : 'bg-red-500/20 text-red-400'
                  }`}>
                    {(selectedContact.name || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground text-sm">{selectedContact.name}</h3>
                      {!selectedContact.isLead && (
                        <span className="text-[10px] bg-red-500/10 text-red-500 px-1.5 py-0.5 rounded hidden sm:inline-block">Não é Lead</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {selectedContact.phone ? normalizeWhatsAppKey(selectedContact.phone) : 'Sem número'}
                    </p>
                  </div>
                </div>
                
                {/* Actions */}
                {!selectedContact.isLead && selectedContact.phone && (
                   <button 
                     onClick={handleCreateLead}
                     className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
                   >
                     <UserPlus size={14} />
                     <span className="hidden sm:inline">Adicionar Lead</span>
                   </button>
                )}
              </div>

              {/* Messages Map */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[url('https://i.pinimg.com/236x/8c/98/99/8c98994518b575bfd8c949e91d20548b.jpg')] bg-cover bg-center" style={{ backgroundColor: 'rgba(11,20,26,0.95)', backgroundBlendMode: 'overlay' }}>
                {!selectedContact.phone && (
                   <div className="text-center p-4 bg-secondary/80 text-sm text-muted-foreground rounded-lg max-w-sm mx-auto">
                     Este lead não possui um número de WhatsApp cadastrado.
                   </div>
                )}
                
                {messages.map((msg) => {
                  const isMe = msg.from_me;
                  return (
                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] rounded-lg p-2.5 shadow-sm relative text-sm ${
                        isMe ? 'bg-[#005c4b] text-[#e9edef] rounded-tr-none' : 'bg-[#202c33] text-[#e9edef] rounded-tl-none'
                      }`}>
                        <div className="whitespace-pre-wrap break-words pr-8 pb-3">{msg.text_content}</div>
                        <div className="absolute bottom-1 right-2 flex items-center gap-1 text-[10px] text-white/60">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {isMe && getStatusIcon(msg.status)}
                        </div>
                      </div>
                    </div>
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
              <h3 className="text-xl font-medium text-foreground mb-2">WhatsApp CRM Realtime</h3>
              <p className="max-w-md">Selecione uma conversa na lista lateral para iniciar ou continuar o atendimento.</p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
