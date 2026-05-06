import { useState, useEffect, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { fetchAlunos, fetchAlunoLogado, fetchChatInterno, enviaMensagemInterna } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, User as UserIcon, Loader2, ArrowLeft } from "lucide-react";
import { getInitials } from "@/lib/types";

export default function InternalChat() {
  const { profile } = useAuth();
  const isAluno = profile?.perfil === "aluno";

  const [alunos, setAlunos] = useState<any[]>([]);
  const [alunoSelecionado, setAlunoSelecionado] = useState<any | null>(null);
  
  const [mensagens, setMensagens] = useState<any[]>([]);
  const [texto, setTexto] = useState("");
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);

  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  // 1. Carga Inicial
  useEffect(() => {
     async function load() {
        if (!profile) return;
        
        if (isAluno) {
           const logado = await fetchAlunoLogado(profile.id);
           if (logado) {
              setAlunoSelecionado(logado);
              await carregaMensagens(logado.id);
           }
        } else {
           const lista = await fetchAlunos();
           setAlunos(lista || []);
        }
        setLoading(false);
     }
     load();
  }, [profile, isAluno]);

  // 2. Quando seleciona um aluno, carrega o histórico
  useEffect(() => {
     if (alunoSelecionado && !isAluno) {
        carregaMensagens(alunoSelecionado.id);
     }
  }, [alunoSelecionado, isAluno]);

  async function carregaMensagens(alunoId: string) {
     const msgs = await fetchChatInterno(alunoId);
     setMensagens(msgs || []);
     scrollToBottom();
  }

  // 3. Realtime Listener
  useEffect(() => {
     if (!alunoSelecionado) return;

     const canal = supabase.channel('chat_interno_realtime')
       .on(
         'postgres_changes',
         { event: 'INSERT', schema: 'public', table: 'mensagens_internas', filter: `aluno_id=eq.${alunoSelecionado.id}` },
         (payload) => {
            // Buscamos o profile do remetente para exibir o nome bonito
            supabase.from('profiles').select('nome, perfil').eq('id', payload.new.remetente_id).single()
              .then(({ data }) => {
                 setMensagens(prev => [...prev, { ...payload.new, profiles: data }]);
                 scrollToBottom();
              });
         }
       )
       .subscribe();

     return () => {
        supabase.removeChannel(canal);
     };
  }, [alunoSelecionado]);

  function scrollToBottom() {
     setTimeout(() => {
        endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth" });
     }, 100);
  }

  async function handleSend(e: React.FormEvent) {
     e.preventDefault();
     if (!texto.trim() || !profile || !alunoSelecionado) return;

     setEnviando(true);
     try {
        await enviaMensagemInterna(alunoSelecionado.id, profile.id, texto.trim());
        setTexto("");
     } catch (e) {
        console.error(e);
     } finally {
        setEnviando(false);
     }
  }

  if (loading) {
     return <AppLayout><div className="flex justify-center mt-20"><Loader2 className="animate-spin text-primary" size={32} /></div></AppLayout>;
  }

  return (
    <AppLayout hideLayoutPadding>
      <div className="flex h-full bg-background overflow-hidden relative">
        
        {/* SIDEBAR EQUIPE */}
        {!isAluno && (
          <div className={`w-full md:w-80 flex-shrink-0 border-r border-border/40 bg-zinc-900/30 flex flex-col absolute md:relative z-20 h-full transition-transform ${alunoSelecionado ? '-translate-x-full md:translate-x-0' : 'translate-x-0'}`}>
             <div className="p-4 border-b border-border/40 bg-zinc-900/80 backdrop-blur-md">
                <h2 className="font-bold text-foreground">Alunos Ativos</h2>
                <p className="text-xs text-muted-foreground mt-1">Selecione para abrir o chat</p>
             </div>
             <div className="flex-1 overflow-y-auto w-full">
                {alunos.length === 0 ? (
                   <p className="text-sm p-4 text-muted-foreground text-center">Nenhum aluno matriculado.</p>
                ) : (
                   alunos.map(aluno => (
                      <div 
                        key={aluno.id} 
                        onClick={() => setAlunoSelecionado(aluno)}
                        className={`flex items-center gap-3 p-4 cursor-pointer border-b border-border/20 transition-colors ${alunoSelecionado?.id === aluno.id ? 'bg-primary/10 border-l-2 border-l-primary' : 'hover:bg-white/5'}`}
                      >
                         <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-primary font-bold text-sm shrink-0">
                           {getInitials(aluno.profiles?.nome || aluno.leads?.nome_completo || "?")}
                         </div>
                         <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-foreground truncate">{aluno.profiles?.nome || aluno.leads?.nome_completo}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{aluno.fase_atual}</p>
                         </div>
                      </div>
                   ))
                )}
             </div>
          </div>
        )}

        {/* ÁREA DE CHAT */}
        <div className="flex-1 flex flex-col h-full w-full bg-background/50">
           {!alunoSelecionado ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                 <div className="w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center mb-4">
                    <UserIcon size={24} className="text-muted-foreground" />
                 </div>
                 <h3 className="text-xl font-bold text-white mb-2">Canal Único de Atendimento</h3>
                 <p className="text-muted-foreground max-w-md">Selecione um aluno na lista ao lado para iniciar ou continuar o suporte.</p>
              </div>
           ) : (
              <>
                 <header className="px-4 py-3 sm:px-6 sm:py-4 border-b border-border/40 bg-zinc-900/90 backdrop-blur flex items-center gap-3">
                    {!isAluno && (
                       <button onClick={() => setAlunoSelecionado(null)} className="md:hidden p-2 -ml-2 text-muted-foreground hover:text-white">
                          <ArrowLeft size={20} />
                       </button>
                    )}
                    <div className="w-10 h-10 rounded-full gold-gradient flex items-center justify-center text-primary-foreground font-bold shrink-0">
                       {isAluno ? 'EQ' : getInitials(alunoSelecionado.profiles?.nome || alunoSelecionado.leads?.nome_completo || "?")}
                    </div>
                    <div>
                       <h2 className="font-bold text-foreground text-sm sm:text-base">
                          {isAluno ? 'Mentoria Business Club' : alunoSelecionado.profiles?.nome || alunoSelecionado.leads?.nome_completo}
                       </h2>
                       <p className="text-xs text-emerald-500 font-medium tracking-wide">
                          {isAluno ? 'Online' : alunoSelecionado.fase_atual}
                       </p>
                    </div>
                 </header>

                 <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4" style={{ scrollBehavior: 'smooth' }}>
                    <div className="text-center py-4">
                       <p className="text-[10px] text-white/60 uppercase tracking-widest font-semibold bg-zinc-900/50 inline-block px-3 py-1 rounded-full border border-white/10">Início da Conversa</p>
                    </div>

                    {mensagens.map(msg => {
                       const ehMeu = msg.remetente_id === profile?.id;
                       const nomeRemetente = msg.profiles?.nome ?? 'Equipe';
                       return (
                         <div key={msg.id} className={`flex flex-col ${ehMeu ? 'items-end' : 'items-start'} max-w-full`}>
                            {!ehMeu && (
                               <span className="text-[10px] text-muted-foreground mb-1 ml-1">
                                  {nomeRemetente}
                               </span>
                            )}
                            <div className={`relative px-4 py-3 max-w-[85%] sm:max-w-[70%] rounded-2xl text-sm shadow-sm ${
                               ehMeu
                               ? 'bg-primary text-primary-foreground rounded-br-none'
                               : 'bg-zinc-800 text-white border border-white/10 rounded-bl-none'
                            }`}>
                               {msg.mensagem}
                            </div>
                            <span className="text-[9px] text-muted-foreground/60 mt-1">
                               {new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                         </div>
                       )
                    })}
                    <div ref={endOfMessagesRef} />
                 </div>

                 <div className="p-4 bg-zinc-900/90 border-t border-border/40 backdrop-blur">
                    <form onSubmit={handleSend} className="max-w-4xl mx-auto flex items-end gap-2 relative">
                       <Input 
                         value={texto}
                         onChange={e => setTexto(e.target.value)}
                         placeholder="Digite uma mensagem..."
                         className="flex-1 bg-black/40 border-white/10 h-12 rounded-xl pl-4 pr-12 text-sm text-white placeholder:text-white/40 focus-visible:ring-1 focus-visible:ring-primary backdrop-blur-sm"
                       />
                       <Button 
                         type="submit" 
                         disabled={!texto.trim() || enviando}
                         className="h-12 w-12 rounded-xl gold-gradient shrink-0 px-0 disabled:opacity-50"
                       >
                         {enviando ? <Loader2 size={18} className="animate-spin text-primary-foreground" /> : <Send size={18} className="text-primary-foreground -ml-1 mt-1" />}
                       </Button>
                    </form>
                 </div>
              </>
           )}
        </div>

      </div>
    </AppLayout>
  );
}
