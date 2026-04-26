import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { fetchAlunoLogado, fetchSprints, fetchSprintTarefas } from "@/lib/api";
import { CheckCircle2, ChevronDown, ChevronRight, Lock, Plane, Star, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

export default function PortalAluno() {
  const { profile } = useAuth();
  const [aluno, setAluno] = useState<any>(null);
  const [sprints, setSprints] = useState<any[]>([]);
  const [tarefas, setTarefas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
     async function loadData() {
        if (!profile) return;
        try {
           const logado = await fetchAlunoLogado(profile.id);
           setAluno(logado);
           if (logado) {
              const [sprintsData, tarefasData] = await Promise.all([
                 fetchSprints(),
                 fetchSprintTarefas(logado.id)
              ]);
              setSprints(sprintsData || []);
              setTarefas(tarefasData || []);
           }
        } catch (e) {
           console.error(e);
        } finally {
           setLoading(false);
        }
     }
     loadData();
  }, [profile]);

  if (loading) return <AppLayout><div className="flex justify-center mt-20"><div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" /></div></AppLayout>;
  if (!aluno) return <AppLayout><div className="p-10 text-center">Nenhum vínculo de aluno encontrado. Contate o suporte.</div></AppLayout>;

  const totalTarefas = tarefas.length;
  const concluidas = tarefas.filter(t => t.concluida && t.aprovada_por_equipe).length;
  const progresso = totalTarefas > 0 ? Math.round((concluidas / totalTarefas) * 100) : 0;
  
  // Meta Viagem
  const xpMetaViagem = 1000;
  const xpAtual = aluno.pontuacao_total || 0;
  const progressViagem = Math.min(100, Math.round((xpAtual / xpMetaViagem) * 100));

  return (
    <AppLayout>
      <div className="flex flex-col h-full bg-background overflow-hidden relative">
        <header className="px-6 py-8 border-b border-border/40 relative overflow-hidden">
          <div className="absolute inset-0 gold-gradient opacity-5 mix-blend-overlay"></div>
          <div className="relative z-10">
             <h1 className="text-3xl font-bold text-foreground">
               Bem-vindo(a), <span className="gold-gradient bg-clip-text text-transparent">{profile?.nome.split(' ')[0]}</span>
             </h1>
             <p className="text-muted-foreground mt-2 text-sm max-w-xl">
               Esta é a sua base do Business Club. Acompanhe a sua evolução nos Sprints e acumule pontos para destravar a viagem exclusiva de encerramento!
             </p>
          </div>
        </header>
        
        <main className="flex-1 p-6 overflow-y-auto space-y-8">
          {/* Sessão Gamificação Principal (A Viagem) */}
          <div className="bg-gradient-to-br from-zinc-900 to-black rounded-2xl border border-primary/20 overflow-hidden relative">
             <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
             <div className="relative z-10 p-6 md:p-8 flex flex-col md:flex-row items-center gap-8">
                <div className="flex-1">
                   <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary">
                         <Plane size={20} />
                      </div>
                      <h2 className="text-xl font-bold text-white uppercase tracking-widest">O Grande Prêmio</h2>
                   </div>
                   <p className="text-sm text-muted-foreground mb-6">
                      Bata {xpMetaViagem} XP ao longo de 1 ano cumprindo todos os Sprints com consistência para garantir sua <strong>Viagem de Comemoração Surpresa</strong>. O destino é secreto, a experiência será inesquecível.
                   </p>
                   
                   <div className="space-y-2">
                       <div className="flex justify-between text-xs font-bold uppercase tracking-wider">
                          <span className="text-emerald-400">{xpAtual} XP</span>
                          <span className="text-muted-foreground">{xpMetaViagem} XP</span>
                       </div>
                       <div className="h-4 w-full bg-zinc-800 rounded-full overflow-hidden">
                          <div 
                             className="h-full bg-gradient-to-r from-primary/50 to-primary transition-all duration-1000 ease-out relative"
                             style={{ width: `${progressViagem}%` }}
                          >
                             <div className="absolute top-0 right-0 bottom-0 w-4 bg-white/20 blur-[2px]"></div>
                          </div>
                       </div>
                       <p className="text-[10px] text-right text-muted-foreground font-medium">{progressViagem}% Destravado</p>
                   </div>
                </div>

                <div className="w-40 h-40 shrink-0 relative flex items-center justify-center">
                   {progressViagem >= 100 ? (
                      <div className="w-32 h-32 bg-primary/20 rounded-full flex flex-col items-center justify-center border-4 border-primary text-primary animate-pulse shadow-[0_0_50px_rgba(212,175,55,0.5)]">
                         <Trophy size={48} className="mb-2" />
                         <span className="text-[10px] font-bold uppercase tracking-widest">Desbloqueado</span>
                      </div>
                   ) : (
                      <div className="w-32 h-32 bg-zinc-900 border-2 border-dashed border-border rounded-full flex flex-col items-center justify-center text-muted-foreground/30 relative overflow-hidden">
                         <Lock size={32} className="mb-2 relative z-10" />
                         <span className="text-[10px] font-bold uppercase tracking-widest relative z-10">Mistery Trip</span>
                         <div className="absolute inset-0 bg-primary/10" style={{ transform: `translateY(${100 - progressViagem}%)` }}></div>
                      </div>
                   )}
                </div>
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             {/* Trilha de Sprints */}
             <section className="bg-zinc-900/40 rounded-2xl border border-border/40 p-6">
                <h3 className="text-lg font-bold text-foreground mb-6 flex items-center gap-2">
                   Módulo de Execução (Sprints)
                </h3>
                <div className="space-y-6">
                   {sprints.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Os Sprints estão sendo estruturados pela equipe.</p>
                   ) : (
                      sprints.map((sprint, idx) => {
                         const minhasTarefas = tarefas.filter(t => t.sprint_id === sprint.id);
                         const isUnlocked = idx === 0 || tarefas.some(t => t.sprint_id === sprints[idx - 1]?.id && t.concluida);
                         
                         return (
                            <div key={sprint.id} className={cn("relative pl-6 border-l-2", isUnlocked ? "border-primary" : "border-border")}>
                               <div className={cn("absolute left-0 top-0 -translate-x-1/2 w-4 h-4 rounded-full border-4 bg-background", isUnlocked ? "border-primary" : "border-border")}></div>
                               <h4 className={cn("font-bold mb-1", isUnlocked ? "text-foreground" : "text-muted-foreground")}>{sprint.titulo}</h4>
                               {sprint.descricao && <p className="text-xs text-muted-foreground mb-3">{sprint.descricao}</p>}
                               
                               {isUnlocked && minhasTarefas.length > 0 && (
                                  <div className="space-y-2 mt-2">
                                     {minhasTarefas.map(tarefa => (
                                        <div key={tarefa.id} className="flex items-center justify-between bg-black/20 p-3 rounded-lg border border-white/5">
                                           <div className="flex items-center gap-3">
                                              {tarefa.concluida ? (
                                                 <CheckCircle2 size={16} className={tarefa.aprovada_por_equipe ? "text-emerald-500" : "text-warning"} />
                                              ) : (
                                                 <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30"></div>
                                              )}
                                              <div>
                                                 <span className={cn("text-sm", tarefa.concluida ? "text-muted-foreground line-through" : "text-white")}>{tarefa.titulo}</span>
                                                 {tarefa.concluida && !tarefa.aprovada_por_equipe && (
                                                    <p className="text-[10px] text-warning mt-0.5">Aguardando validação da equipe</p>
                                                 )}
                                              </div>
                                           </div>
                                           <div className="flex items-center gap-1 bg-white/5 px-2 py-1 rounded text-[10px] text-emerald-400 font-bold">
                                              <Star size={10} /> +{tarefa.xp_recompensa} XP
                                           </div>
                                        </div>
                                     ))}
                                  </div>
                               )}
                               {isUnlocked && minhasTarefas.length === 0 && (
                                  <div className="bg-black/20 p-3 rounded-lg border border-white/5 text-xs text-muted-foreground text-center">
                                     Nenhuma meta alocada neste Sprint ainda.
                                  </div>
                               )}
                               {!isUnlocked && (
                                  <div className="bg-black/20 p-3 rounded-lg border border-white/5 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                                     <Lock size={12} /> Desbloqueado ao concluir o Sprint anterior
                                  </div>
                               )}
                            </div>
                         )
                      })
                   )}
                </div>
             </section>

             {/* Outras Infos (Materiais) */}
             <div className="space-y-6">
                <section className="bg-zinc-900/40 rounded-2xl border border-border/40 p-6">
                   <h3 className="text-lg font-bold text-foreground mb-4">Materiais e Pastas</h3>
                   <div className="bg-black/20 rounded-xl border border-dashed border-border/50 p-8 text-center">
                      <p className="text-muted-foreground text-sm">Seu repositório central está vazio.<br/>A equipe ainda não anexou arquivos à sua conta.</p>
                   </div>
                </section>

                <section className="bg-zinc-900/40 rounded-2xl border border-border/40 p-6">
                   <h3 className="text-lg font-bold text-foreground mb-1">Status do Aluno</h3>
                   <div className="mt-4 space-y-4">
                      <div>
                         <p className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider mb-1">Fase Atual da Mentoria</p>
                         <p className="text-sm font-medium gold-gradient bg-clip-text text-transparent">{aluno.fase_atual}</p>
                      </div>
                      <div>
                         <p className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider mb-1">Evolução Geral</p>
                         <div className="flex items-center gap-3">
                            <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                               <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${progresso}%` }}></div>
                            </div>
                            <span className="text-xs font-bold text-emerald-500">{progresso}%</span>
                         </div>
                      </div>
                   </div>
                </section>
             </div>
          </div>

        </main>
      </div>
    </AppLayout>
  );
}
