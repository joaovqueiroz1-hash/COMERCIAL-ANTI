import { useState, useEffect, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { fetchLeads, fetchWhatsAppMessages, fetchZApiConfigGlobally, createWhatsAppMessage } from "@/lib/api";
import { Lead, WhatsAppMessage } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { sendTextMessage, ZApiConfig, normalizePhone } from "@/lib/zapi";
import { Loader2, Send, Search, Check, CheckCheck, Clock } from "lucide-react";
import { toast } from "sonner";
import { normalizeWhatsAppKey } from "@/lib/whatsapp-utils";

export default function WhatsAppCRM() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<Lead[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [zapiConfig, setZapiConfig] = useState<ZApiConfig | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [loadedLeads, cfg] = await Promise.all([
          fetchLeads(),
          fetchZApiConfigGlobally()
        ]);
        setLeads(loadedLeads);
        setFilteredLeads(loadedLeads);
        
        if (cfg) {
           setZapiConfig({
             instanceId: cfg.instance_id,
             token: cfg.token,
             clientToken: cfg.client_token || ''
           });
        }
      } catch (err) {
        console.error("Erro ao carregar dados", err);
        toast.error("Erro ao carregar leads ou configuração Z-API");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  useEffect(() => {
    if (searchTerm) {
      setFilteredLeads(leads.filter(l => 
        l.nome_completo.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (l.whatsapp && l.whatsapp.includes(searchTerm))
      ));
    } else {
      setFilteredLeads(leads);
    }
  }, [searchTerm, leads]);

  useEffect(() => {
    if (selectedLead && selectedLead.whatsapp) {
      loadMessages(selectedLead.whatsapp);
      
      const channel = supabase.channel('whatsapp_messages_changes')
        .on('postgres_changes', 
          { event: 'INSERT', schema: 'public', table: 'whatsapp_messages' }, 
          (payload) => {
            const cleanPhoneParam = selectedLead.whatsapp ? selectedLead.whatsapp.replace(/\D/g, '') : '';
            if (!cleanPhoneParam) return;
            
            const newMsg = payload.new as WhatsAppMessage;
            if (newMsg.phone.includes(cleanPhoneParam) || (cleanPhoneParam.startsWith('55') && newMsg.phone.includes(cleanPhoneParam.substring(2)))) {
              setMessages(prev => {
                if (prev.find(m => m.message_id === newMsg.message_id)) return prev;
                return [...prev, newMsg].sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
              });
            }
          }
        ).subscribe();

      return () => {
        supabase.removeChannel(channel);
      }
    } else {
      setMessages([]);
    }
  }, [selectedLead]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadMessages(whatsapp: string) {
    try {
      const msgs = await fetchWhatsAppMessages(whatsapp);
      setMessages(msgs);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao carregar mensagens.");
    }
  }

  const handleSend = async () => {
    if (!inputText.trim() || !selectedLead || !selectedLead.whatsapp) return;
    if (!zapiConfig) {
      toast.error("Z-API não configurado. Vá em Configurações para conectar sua instância.");
      return;
    }

    setSending(true);
    const textMsg = inputText.trim();
    setInputText("");

    try {
      const phone = normalizePhone(selectedLead.whatsapp);
      
      // Envia usando a função proxy (chamando API externa com os dados ZAPI configurados globalmente)
      const res = await sendTextMessage(zapiConfig, {
        phone,
        message: textMsg
      });

      // Salva de forma otimista no Supabase (com uuid gerado localmente pelo Postgres via backend, ou podemos inserir)
      // O webhook Z-API vai receber de novo se quisermos? Se Z-API confirmar, a gente insere agora com from_me = true:
      const savedMsg = await createWhatsAppMessage({
        lead_id: selectedLead.id,
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

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'entregue':
      case 'lida':
        return <CheckCheck size={12} className={status.toLowerCase() === 'lida' ? "text-blue-500" : "text-muted-foreground"} />;
      case 'enviado':
        return <Check size={12} className="text-muted-foreground" />;
      default:
        return <Clock size={12} className="text-muted-foreground" />;
    }
  };

  return (
    <AppLayout title="WhatsApp Realtime CRM" subtitle="Gerencie conversas centralizadas e integradas diretamente no CRM">
      <div className="flex h-[calc(100vh-140px)] gap-4 px-4 pb-4 w-full max-w-[1400px] mx-auto">
        
        {/* Sidebar de Leads */}
        <div className="w-1/3 min-w-[300px] max-w-[400px] card-premium flex flex-col overflow-hidden bg-background">
          <div className="p-4 border-b border-border">
            <h3 className="font-semibold text-sm mb-3">Seus Leads</h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <input 
                type="text" 
                placeholder="Buscar lead ou WhatsApp..."
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
            ) : filteredLeads.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">Nenhum lead encontrado.</div>
            ) : (
              <ul className="w-full">
                {filteredLeads.map(lead => (
                  <li 
                    key={lead.id} 
                    className={`p-4 border-b border-border/50 cursor-pointer transition-colors ${selectedLead?.id === lead.id ? 'bg-primary/5 border-l-2 border-l-primary' : 'hover:bg-secondary/50'}`}
                    onClick={() => setSelectedLead(lead)}
                  >
                    <div className="font-medium text-sm text-foreground truncate">{lead.nome_completo}</div>
                    <div className="text-xs text-muted-foreground mt-1 truncate">
                      {lead.whatsapp ? normalizeWhatsAppKey(lead.whatsapp) : 'Sem número'} | {lead.status_pipeline}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 card-premium flex flex-col bg-[#0b141a]">
          {selectedLead ? (
            <>
              {/* Header */}
              <div className="h-16 px-4 bg-secondary/80 border-b border-border flex items-center justify-between shadow-sm z-10">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                    {selectedLead.nome_completo.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground text-sm">{selectedLead.nome_completo}</h3>
                    <p className="text-xs text-muted-foreground">
                      {selectedLead.whatsapp ? normalizeWhatsAppKey(selectedLead.whatsapp) : 'Sem número'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Messages Map */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[url('https://i.pinimg.com/236x/8c/98/99/8c98994518b575bfd8c949e91d20548b.jpg')] bg-cover bg-center" style={{ backgroundColor: 'rgba(11,20,26,0.95)', backgroundBlendMode: 'overlay' }}>
                {!selectedLead.whatsapp && (
                   <div className="text-center p-4 bg-secondary/80 text-sm text-muted-foreground rounded-lg max-w-sm mx-auto">
                     Este lead não possui um número de WhatsApp cadastrado. Atualize o lead para enviar mensagens.
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
                  disabled={sending || !selectedLead.whatsapp}
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
                  disabled={sending || !inputText.trim() || !selectedLead.whatsapp}
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
              <p className="max-w-md">Selecione um lead na lista lateral para iniciar uma nova conversa ou continuar uma já existente sem sair do CRM.</p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
