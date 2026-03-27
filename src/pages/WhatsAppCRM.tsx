import React, { useState, useEffect, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { fetchLeads, fetchZApiConfigGlobally, createLead, createWhatsAppMessage } from "@/lib/api";
import { Lead } from "@/lib/api";
import { sendTextMessage, ZApiConfig, normalizePhone, getChats, getMessages, ZApiMessage, ZApiChat } from "@/lib/zapi";
import { Loader2, Send, Search, Check, CheckCheck, Clock, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { normalizeWhatsAppKey, cleanWhatsAppNumber } from "@/lib/whatsapp-utils";

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
  
  const [messages, setMessages] = useState<ZApiMessage[]>([]);
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

  // Carregar Configuração Inicial
  useEffect(() => {
    async function init() {
      try {
        const cfg = await fetchZApiConfigGlobally();
        if (cfg) {
           setZapiConfig({
             instanceId: cfg.instance_id,
             token: cfg.token,
             clientToken: cfg.client_token || ''
           });
        }
      } catch (err) {
        console.error("Erro cfg:", err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  // Polling Master de Contatos (Barra Lateral) e Mensagens (Chat)
  useEffect(() => {
    if (!zapiConfig) return;

    let isSyncing = false;

    const performSync = async () => {
      if (isSyncing) return;
      isSyncing = true;
      try {
        // 1. Carregar Chats Reais da Z-API e Leads do Banco
        const [remoteChats, leads] = await Promise.all([
          getChats(zapiConfig, 1).catch(() => [] as ZApiChat[]),
          fetchLeads().catch(() => [] as Lead[])
        ]);

        const mergedContacts = new Map<string, ChatContact>();

        // Mapear Leads primeiro
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
                lastMessageTime: 0
              });
            }
          }
        });

        // Mapear Chats da Z-API (Sobrescrevendo ou Adicionando)
        remoteChats.forEach(chat => {
          if (!chat.phone) return;
          const cleanPhone = cleanWhatsAppNumber(chat.phone);
          if (!cleanPhone || cleanPhone.length < 8) return;

          // Se ja temos como Lead (as vezes o lead ta sem 55 no banco, vamos tentar buscar flexivel)
          const existingKey = Array.from(mergedContacts.keys()).find(k => 
             k === cleanPhone || k === '55' + cleanPhone || '55' + k === cleanPhone
          );

          if (existingKey) {
            const existing = mergedContacts.get(existingKey)!;
            existing.lastMessageTime = Date.now(); // Simplificando, ele subiu no topo
            // Vamos garantir que o nome seja o do Lead se existir
          } else {
            // Novo Contato Desconhecido
            mergedContacts.set(cleanPhone, {
              id: cleanPhone,
              phone: chat.phone,
              name: safeString(chat.name) || 'Contato Desconhecido',
              isLead: false,
              leadId: null,
              leadStatus: null,
              lastMessageTime: Date.now() // topo da lista
            });
          }
        });

        // Transforma o Map em array e ordena (recentes primeiro, depois os nomes)
        const sorted = Array.from(mergedContacts.values()).sort((a,b) => {
           if (a.lastMessageTime !== b.lastMessageTime) {
             return b.lastMessageTime - a.lastMessageTime;
           }
           return safeString(a.name).localeCompare(safeString(b.name));
        });

        setContacts(sorted);

        // 2. Se houver chat aberto, sincronizar as mensagens dele!
        const currentContact = selectedContactRef.current;
        if (currentContact && currentContact.phone) {
           const msgs = await getMessages(zapiConfig, currentContact.phone, 1).catch(() => [] as ZApiMessage[]);
           
           if (msgs && msgs.length > 0) {
              // Z-API retorna as mensagens ordenadas mais recentes primeiro por padrão
              // Vamos garantir a ordem cronológica para exibição
              const validMsgs = msgs.filter(m => m.messageId && m.text?.message); // apenas textuais
              const sortedMsgs = validMsgs.sort((a,b) => (a.momment || 0) - (b.momment || 0));
              setMessages(sortedMsgs);
              
              // SALVAMENTO SILENCIOSO: enviamos p/ o Supabase para histórico global
              // usando promessa sem await para não travar a UI
              validMsgs.forEach(m => {
                 createWhatsAppMessage({
                    lead_id: currentContact.isLead ? currentContact.leadId : null,
                    phone: currentContact.phone,
                    message_id: m.messageId,
                    text_content: m.text!.message,
                    from_me: m.fromMe,
                    sender_name: safeString(m.senderName),
                    timestamp: m.momment ? new Date(m.momment).toISOString() : new Date().toISOString(),
                    status: safeString(m.status) || 'recebido'
                 }).catch(() => {});
              });
           }
        }
      } catch (err) {
        console.warn("Erro no sync master", err);
      } finally {
        isSyncing = false;
      }
    };

    performSync(); // Primeira passada
    const t = setInterval(performSync, 8000); // Pollin frequente a cada 8s como um app real
    return () => clearInterval(t);
  }, [zapiConfig]);

  // Filtro de Busca
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

  // Atualizar auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!inputText.trim() || !selectedContact || !selectedContact.phone || !zapiConfig) return;

    setSending(true);
    const textMsg = inputText.trim();
    setInputText(""); // UI otimista limpa logo
    const phone = normalizePhone(selectedContact.phone);

    try {
      const res = await sendTextMessage(zapiConfig, {
        phone,
        message: textMsg
      });

      // Adicionar mensagem localmente antes do prox sync (Otimista)
      const fakeMsg: ZApiMessage = {
         messageId: res.messageId || `local-${Date.now()}`,
         phone: phone,
         fromMe: true,
         momment: Date.now(),
         status: 'enviado',
         text: { message: textMsg },
         type: 'texto'
      };
      
      setMessages(prev => [...prev, fakeMsg]);

      // Salva no banco tbm
      await createWhatsAppMessage({
        lead_id: selectedContact.isLead ? selectedContact.leadId : null,
        phone: phone,
        message_id: fakeMsg.messageId,
        text_content: textMsg,
        from_me: true,
        status: "enviado",
        timestamp: new Date().toISOString()
      }).catch(e => console.warn("Supabase save fail", e));

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

       // Atualiza a vista atual imediatamente
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
    if (s === 'lida') return <CheckCheck size={12} className="text-blue-500" />;
    if (s === 'entregue' || s === 'received') return <CheckCheck size={12} className="text-muted-foreground" />;
    if (s === 'enviado' || s === 'sent') return <Check size={12} className="text-muted-foreground" />;
    return <Clock size={12} className="text-muted-foreground" />;
  };

  const firstLetter = (str: any) => {
    const s = safeString(str).trim();
    if (!s) return 'U';
    return s.charAt(0).toUpperCase();
  };

  return (
    <AppLayout title="WhatsApp Realtime CRM" subtitle="CRM Funcional - Espelho exato das suas conversas">
      <div className="flex h-[calc(100vh-140px)] gap-4 px-4 pb-4 w-full max-w-[1400px] mx-auto">
        
        {/* Sidebar */}
        <div className="w-1/3 min-w-[300px] max-w-[400px] card-premium flex flex-col overflow-hidden bg-background">
          <div className="p-4 border-b border-border">
            <h3 className="font-semibold text-sm mb-3">Conversas Ativas</h3>
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
                 ⚠️ Conecte a Z-API em Configurações.
               </div>
            )}
          </div>
          
          <div className="flex-1 overflow-y-auto w-full">
            {loading ? (
              <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" /></div>
            ) : filteredContacts.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">O CRM está vazio. Nenhuma conversa ou Lead encontrado.</div>
            ) : (
              <ul className="w-full">
                {filteredContacts.map(c => (
                  <li 
                    key={c.id + c.phone} 
                    className={`p-4 border-b border-border/50 cursor-pointer transition-colors ${selectedContact?.id === c.id ? 'bg-primary/5 border-l-2 border-l-primary' : 'hover:bg-secondary/50'}`}
                    onClick={() => setSelectedContact(c)}
                  >
                    <div className="flex items-center justify-between gap-2">
                       <div className="font-medium text-sm text-foreground truncate">{c.name || 'Sem nome'}</div>
                       {!c.isLead && (
                          <span className="text-[10px] bg-red-500/10 text-red-500 px-1.5 py-0.5 rounded border border-red-500/20 whitespace-nowrap shrink-0">Desconhecido</span>
                       )}
                       {c.isLead && c.leadStatus && (
                          <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded shrink-0 max-w-[30%] truncate">{c.leadStatus}</span>
                       )}
                    </div>
                    
                    <div className="text-xs text-muted-foreground mt-1 flex justify-between items-center">
                      <span className="truncate">{c.phone ? normalizeWhatsAppKey(c.phone) : 'Sem telefone'}</span>
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
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[url('https://i.pinimg.com/236x/8c/98/99/8c98994518b575bfd8c949e91d20548b.jpg')] bg-cover bg-center" style={{ backgroundColor: 'rgba(11,20,26,0.95)', backgroundBlendMode: 'overlay' }}>
                {!selectedContact.phone && (
                   <div className="text-center p-4 bg-secondary/80 text-sm text-muted-foreground rounded-lg max-w-sm mx-auto">
                     Este contato não possui um número de WhatsApp cadastrado.
                   </div>
                )}
                
                {messages.map((msg, i) => {
                  const isMe = msg.fromMe;
                  const date = msg.momment ? new Date(msg.momment) : new Date();
                  const timeString = isNaN(date.getTime()) ? '' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  
                  return (
                    <div key={msg.messageId || `msg-${i}`} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] rounded-lg p-2.5 shadow-sm relative text-sm ${
                        isMe ? 'bg-[#005c4b] text-[#e9edef] rounded-tr-none' : 'bg-[#202c33] text-[#e9edef] rounded-tl-none'
                      }`}>
                        <div className="whitespace-pre-wrap break-words pr-8 pb-3">{msg.text?.message || ''}</div>
                        <div className="absolute bottom-1 right-2 flex items-center gap-1 text-[10px] text-white/60">
                          {timeString}
                          {isMe && renderStatusIcon(msg.status)}
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
              <h3 className="text-xl font-medium text-foreground mb-2">WhatsApp CRM Master</h3>
              <p className="max-w-md">Selecione uma conversa na lista lateral para visualizar ou enviar mensagens.</p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
