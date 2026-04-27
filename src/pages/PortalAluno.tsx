import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchAlunoLogado, fetchSprints, fetchSprintTarefas,
  fetchMateriaisAluno, fetchEventosAluno, marcarTarefaConcluida,
} from "@/lib/api";
import type { Material, Evento } from "@/lib/api";
import {
  CheckCircle2, Lock, Plane, Star, Trophy,
  FileText, Video, Link2, BookOpen, ExternalLink,
  Clock, Loader2, CalendarClock, AlertTriangle, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

// ── tipos locais ──────────────────────────────────────────────────────────────

type TipoFiltro = 'todos' | 'video' | 'pdf' | 'documento' | 'link';

const TIPO_META: Record<string, { icon: React.ReactNode; label: string; color: string; bg: string }> = {
  video:     { icon: <Video size={16} />,    label: 'Vídeo',     color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/20' },
  pdf:       { icon: <FileText size={16} />, label: 'PDF',       color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20' },
  documento: { icon: <BookOpen size={16} />, label: 'Documento', color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/20' },
  link:      { icon: <Link2 size={16} />,    label: 'Link',      color: 'text-emerald-400',bg: 'bg-emerald-500/10 border-emerald-500/20' },
};

// ── componentes auxiliares ────────────────────────────────────────────────────

function MaterialCard({ material }: { material: Material & { sprints?: { titulo: string } | null } }) {
  const meta = TIPO_META[material.tipo] ?? TIPO_META.link;
  return (
    <a
      href={material.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "group flex flex-col gap-3 p-4 rounded-xl border bg-zinc-900/60 hover:bg-zinc-900 transition-all duration-200 hover:border-primary/40 cursor-pointer",
        meta.bg,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border", meta.bg, meta.color)}>
          {meta.icon}
        </div>
        <ExternalLink size={13} className="text-muted-foreground/40 group-hover:text-muted-foreground mt-0.5 shrink-0 transition-colors" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground leading-snug line-clamp-2 group-hover:text-white transition-colors">
          {material.titulo}
        </p>
        {material.descricao && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{material.descricao}</p>
        )}
      </div>

      <div className="flex items-center justify-between pt-1 border-t border-white/5">
        <span className={cn("text-[10px] font-bold uppercase tracking-wider", meta.color)}>
          {meta.label}
        </span>
        {material.sprints?.titulo && (
          <span className="text-[10px] text-muted-foreground/60 truncate max-w-[120px]">
            {material.sprints.titulo}
          </span>
        )}
        {!material.aluno_id && (
          <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-primary/30 text-primary/70">
            Global
          </Badge>
        )}
      </div>
    </a>
  );
}

// ── página principal ──────────────────────────────────────────────────────────

export default function PortalAluno() {
  const { profile } = useAuth();
  const [aluno, setAluno] = useState<any>(null);
  const [sprints, setSprints] = useState<any[]>([]);
  const [tarefas, setTarefas] = useState<any[]>([]);
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroMaterial, setFiltroMaterial] = useState<TipoFiltro>('todos');
  const [concluindo, setConcluindo] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!profile) return;
    try {
      const logado = await fetchAlunoLogado(profile.id);
      setAluno(logado);
      if (logado) {
        const [sprintsData, tarefasData, materiaisData, eventosData] = await Promise.all([
          fetchSprints(),
          fetchSprintTarefas(logado.id),
          fetchMateriaisAluno(logado.id),
          fetchEventosAluno(logado.id),
        ]);
        setSprints(sprintsData || []);
        setTarefas(tarefasData || []);
        setMateriais((materiaisData || []) as Material[]);
        setEventos((eventosData || []) as Evento[]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleMarcarConcluida(tarefaId: string) {
    setConcluindo(tarefaId);
    try {
      await marcarTarefaConcluida(tarefaId);
      setTarefas(prev => prev.map(t => t.id === tarefaId ? { ...t, concluida: true } : t));
      toast({ title: 'Entrega enviada!', description: 'Aguardando validação da equipe para ganhar os XP.' });
    } catch {
      toast({ title: 'Erro ao registrar entrega.', variant: 'destructive' });
    } finally {
      setConcluindo(null);
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="flex justify-center mt-20">
          <Loader2 className="animate-spin text-primary" size={32} />
        </div>
      </AppLayout>
    );
  }

  if (!aluno) {
    return (
      <AppLayout>
        <div className="p-10 text-center text-muted-foreground">
          Nenhum vínculo de aluno encontrado. Contate o suporte.
        </div>
      </AppLayout>
    );
  }

  // ── highlight: próximo evento e próximo prazo ────────────────────────────────
  const proximoEvento = eventos.length > 0 ? eventos[0] : null; // já vêm ordenados por data_hora asc
  const proximaTarefa = tarefas
    .filter(t => !t.concluida && t.prazo)
    .sort((a, b) => new Date(a.prazo).getTime() - new Date(b.prazo).getTime())[0] ?? null;

  const TIPO_EVENTO_COLOR: Record<string, string> = {
    reuniao:    '#6366f1',
    evento:     '#f59e0b',
    checkpoint: '#10b981',
    aula:       '#3b82f6',
    entrega:    '#f43f5e',
  };
  const TIPO_EVENTO_LABEL: Record<string, string> = {
    reuniao:    'Reunião',
    evento:     'Evento',
    checkpoint: 'Checkpoint',
    aula:       'Aula',
    entrega:    'Entrega',
  };

  function diasRestantes(iso: string) {
    const diff = Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return 'Atrasado';
    if (diff === 0) return 'Hoje';
    if (diff === 1) return 'Amanhã';
    return `em ${diff} dias`;
  }

  // ── métricas ────────────────────────────────────────────────────────────────
  const totalTarefas = tarefas.length;
  const concluidas = tarefas.filter(t => t.concluida && t.aprovada_por_equipe).length;
  const progresso = totalTarefas > 0 ? Math.round((concluidas / totalTarefas) * 100) : 0;
  const xpMeta = 1000;
  const xpAtual = aluno.pontuacao_total || 0;
  const progressViagem = Math.min(100, Math.round((xpAtual / xpMeta) * 100));

  // ── filtro de materiais ─────────────────────────────────────────────────────
  const materiaisFiltrados = filtroMaterial === 'todos'
    ? materiais
    : materiais.filter(m => m.tipo === filtroMaterial);

  const FILTROS: { key: TipoFiltro; label: string }[] = [
    { key: 'todos',     label: 'Todos' },
    { key: 'video',     label: 'Vídeos' },
    { key: 'pdf',       label: 'PDFs' },
    { key: 'documento', label: 'Documentos' },
    { key: 'link',      label: 'Links' },
  ];

  return (
    <AppLayout>
      <div className="flex flex-col h-full bg-background overflow-hidden relative">

        {/* ── Cabeçalho ─────────────────────────────────────────────────── */}
        <header className="px-6 py-8 border-b border-border/40 relative overflow-hidden shrink-0">
          <div className="absolute inset-0 gold-gradient opacity-5 mix-blend-overlay" />
          <div className="relative z-10">
            <h1 className="text-3xl font-bold text-foreground">
              Bem-vindo(a),{" "}
              <span className="gold-gradient bg-clip-text text-transparent">
                {profile?.nome.split(" ")[0]}
              </span>
            </h1>
            <p className="text-muted-foreground mt-2 text-sm max-w-xl">
              Sua base do Business Club. Acompanhe seus Sprints, acesse materiais e acumule XP para destravar a viagem exclusiva!
            </p>
          </div>
        </header>

        <main className="flex-1 p-6 overflow-y-auto space-y-8">

          {/* ── Cards de Destaque ─────────────────────────────────────── */}
          {(proximoEvento || proximaTarefa) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Próximo Evento */}
              {proximoEvento ? (
                <div
                  className="relative overflow-hidden rounded-2xl border p-5 flex items-start gap-4"
                  style={{
                    backgroundColor: TIPO_EVENTO_COLOR[proximoEvento.tipo] + '12',
                    borderColor: TIPO_EVENTO_COLOR[proximoEvento.tipo] + '40',
                  }}
                >
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: TIPO_EVENTO_COLOR[proximoEvento.tipo] + '25' }}
                  >
                    <CalendarClock size={20} style={{ color: TIPO_EVENTO_COLOR[proximoEvento.tipo] }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-0.5">
                      Próxima Reunião / Evento
                    </p>
                    <p className="text-sm font-bold text-foreground truncate">{proximoEvento.titulo}</p>
                    <p
                      className="text-xs font-semibold mt-1"
                      style={{ color: TIPO_EVENTO_COLOR[proximoEvento.tipo] }}
                    >
                      {TIPO_EVENTO_LABEL[proximoEvento.tipo]} · {diasRestantes(proximoEvento.data_hora)}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {new Date(proximoEvento.data_hora).toLocaleDateString('pt-BR', {
                        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <div
                    className="absolute -bottom-4 -right-4 w-20 h-20 rounded-full opacity-10"
                    style={{ backgroundColor: TIPO_EVENTO_COLOR[proximoEvento.tipo] }}
                  />
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border/40 p-5 flex items-center justify-center text-center">
                  <p className="text-xs text-muted-foreground">Nenhum evento próximo agendado.</p>
                </div>
              )}

              {/* Próximo Prazo */}
              {proximaTarefa ? (() => {
                const dias = proximaTarefa.prazo
                  ? Math.ceil((new Date(proximaTarefa.prazo).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                  : null;
                const urgente = dias !== null && dias <= 3;
                const cor = urgente ? '#f43f5e' : '#f59e0b';
                return (
                  <div
                    className="relative overflow-hidden rounded-2xl border p-5 flex items-start gap-4"
                    style={{ backgroundColor: cor + '12', borderColor: cor + '40' }}
                  >
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: cor + '25' }}
                    >
                      {urgente
                        ? <AlertTriangle size={20} style={{ color: cor }} />
                        : <Zap size={20} style={{ color: cor }} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-0.5">
                        Próximo Prazo
                      </p>
                      <p className="text-sm font-bold text-foreground truncate">{proximaTarefa.titulo}</p>
                      <p className="text-xs font-semibold mt-1" style={{ color: cor }}>
                        {urgente ? '⚠ Urgente · ' : ''}{diasRestantes(proximaTarefa.prazo)}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {new Date(proximaTarefa.prazo).toLocaleDateString('pt-BR', {
                          day: '2-digit', month: 'short', year: 'numeric',
                        })}
                      </p>
                    </div>
                    <div
                      className="absolute -bottom-4 -right-4 w-20 h-20 rounded-full opacity-10"
                      style={{ backgroundColor: cor }}
                    />
                  </div>
                );
              })() : (
                <div className="rounded-2xl border border-dashed border-border/40 p-5 flex items-center justify-center text-center">
                  <p className="text-xs text-muted-foreground">Nenhuma tarefa com prazo pendente.</p>
                </div>
              )}
            </div>
          )}

          {/* ── Widget Grande Prêmio ───────────────────────────────────── */}
          <div className="bg-gradient-to-br from-zinc-900 to-black rounded-2xl border border-primary/20 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
            <div className="relative z-10 p-6 md:p-8 flex flex-col md:flex-row items-center gap-8">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary">
                    <Plane size={20} />
                  </div>
                  <h2 className="text-xl font-bold text-white uppercase tracking-widest">O Grande Prêmio</h2>
                </div>
                <p className="text-sm text-muted-foreground mb-6">
                  Bata{" "}
                  <span className="text-white font-semibold">{xpMeta} XP</span>{" "}
                  cumprindo todos os Sprints com consistência para garantir sua{" "}
                  <strong className="text-white">Viagem de Comemoração Surpresa</strong>.
                  O destino é secreto, a experiência será inesquecível.
                </p>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-bold uppercase tracking-wider">
                    <span className="text-emerald-400">{xpAtual} XP</span>
                    <span className="text-muted-foreground">{xpMeta} XP</span>
                  </div>
                  <div className="h-4 w-full bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary/50 to-primary transition-all duration-1000 ease-out relative"
                      style={{ width: `${progressViagem}%` }}
                    >
                      <div className="absolute top-0 right-0 bottom-0 w-4 bg-white/20 blur-[2px]" />
                    </div>
                  </div>
                  <p className="text-[10px] text-right text-muted-foreground font-medium">
                    {progressViagem}% Destravado
                  </p>
                </div>
              </div>

              <div className="w-40 h-40 shrink-0 relative flex items-center justify-center">
                {progressViagem >= 100 ? (
                  <div className="w-32 h-32 bg-primary/20 rounded-full flex flex-col items-center justify-center border-4 border-primary text-primary animate-pulse shadow-[0_0_50px_rgba(212,175,55,0.5)]">
                    <Trophy size={48} className="mb-2" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Desbloqueado!</span>
                  </div>
                ) : (
                  <div className="w-32 h-32 bg-zinc-900 border-2 border-dashed border-border rounded-full flex flex-col items-center justify-center text-muted-foreground/30 relative overflow-hidden">
                    <Lock size={32} className="mb-2 relative z-10" />
                    <span className="text-[10px] font-bold uppercase tracking-widest relative z-10">Mystery Trip</span>
                    <div
                      className="absolute inset-0 bg-primary/10 transition-all duration-1000"
                      style={{ transform: `translateY(${100 - progressViagem}%)` }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Grade Principal ────────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* ── Trilha de Sprints ──────────────────────────────────── */}
            <section className="bg-zinc-900/40 rounded-2xl border border-border/40 p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-foreground">Módulo de Execução</h3>
                <div className="flex items-center gap-2 bg-zinc-800/60 rounded-full px-3 py-1">
                  <span className="text-xs text-emerald-400 font-bold">{concluidas}/{totalTarefas}</span>
                  <span className="text-xs text-muted-foreground">aprovadas</span>
                </div>
              </div>

              <div className="space-y-6">
                {sprints.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Os Sprints estão sendo estruturados pela equipe.</p>
                ) : (
                  sprints.map((sprint, idx) => {
                    const minhasTarefas = tarefas.filter(t => t.sprint_id === sprint.id);
                    const sprintAnterior = idx > 0 ? sprints[idx - 1] : null;
                    const isUnlocked = idx === 0 || tarefas.some(
                      t => t.sprint_id === sprintAnterior?.id && t.aprovada_por_equipe
                    );

                    return (
                      <div
                        key={sprint.id}
                        className={cn("relative pl-6 border-l-2", isUnlocked ? "border-primary" : "border-border")}
                      >
                        <div className={cn(
                          "absolute left-0 top-0 -translate-x-1/2 w-4 h-4 rounded-full border-4 bg-background",
                          isUnlocked ? "border-primary" : "border-border",
                        )} />

                        <h4 className={cn("font-bold mb-1", isUnlocked ? "text-foreground" : "text-muted-foreground")}>
                          {sprint.titulo}
                        </h4>
                        {sprint.descricao && (
                          <p className="text-xs text-muted-foreground mb-3">{sprint.descricao}</p>
                        )}

                        {!isUnlocked && (
                          <div className="bg-black/20 p-3 rounded-lg border border-white/5 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                            <Lock size={12} /> Conclua o Sprint anterior para desbloquear
                          </div>
                        )}

                        {isUnlocked && minhasTarefas.length === 0 && (
                          <div className="bg-black/20 p-3 rounded-lg border border-white/5 text-xs text-muted-foreground text-center">
                            Nenhuma meta alocada neste Sprint ainda.
                          </div>
                        )}

                        {isUnlocked && minhasTarefas.length > 0 && (
                          <div className="space-y-2 mt-2">
                            {minhasTarefas.map(tarefa => (
                              <div
                                key={tarefa.id}
                                className="flex items-center justify-between bg-black/20 p-3 rounded-lg border border-white/5 gap-3"
                              >
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                  {tarefa.concluida ? (
                                    <CheckCircle2
                                      size={16}
                                      className={cn(
                                        "shrink-0",
                                        tarefa.aprovada_por_equipe ? "text-emerald-500" : "text-amber-400",
                                      )}
                                    />
                                  ) : (
                                    <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />
                                  )}
                                  <div className="min-w-0">
                                    <span className={cn(
                                      "text-sm block truncate",
                                      tarefa.aprovada_por_equipe ? "text-muted-foreground line-through" : "text-white",
                                    )}>
                                      {tarefa.titulo}
                                    </span>
                                    {tarefa.concluida && !tarefa.aprovada_por_equipe && (
                                      <p className="text-[10px] text-amber-400 mt-0.5 flex items-center gap-1">
                                        <Clock size={9} /> Aguardando validação
                                      </p>
                                    )}
                                    {tarefa.prazo && !tarefa.aprovada_por_equipe && (
                                      <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                                        Prazo: {new Date(tarefa.prazo).toLocaleDateString('pt-BR')}
                                      </p>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  <div className="flex items-center gap-1 bg-white/5 px-2 py-1 rounded text-[10px] text-emerald-400 font-bold">
                                    <Star size={10} /> +{tarefa.xp_recompensa} XP
                                  </div>
                                  {!tarefa.concluida && (
                                    <button
                                      onClick={() => handleMarcarConcluida(tarefa.id)}
                                      disabled={concluindo === tarefa.id}
                                      className="text-[10px] font-bold px-2 py-1 rounded bg-primary/20 text-primary hover:bg-primary/30 transition-colors disabled:opacity-50 whitespace-nowrap"
                                    >
                                      {concluindo === tarefa.id
                                        ? <Loader2 size={10} className="animate-spin" />
                                        : 'Entregar'}
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </section>

            {/* ── Coluna Direita ─────────────────────────────────────── */}
            <div className="space-y-6">
              {/* Status do Aluno */}
              <section className="bg-zinc-900/40 rounded-2xl border border-border/40 p-6">
                <h3 className="text-lg font-bold text-foreground mb-4">Seu Status</h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider mb-1">Fase Atual da Mentoria</p>
                    <p className="text-sm font-medium gold-gradient bg-clip-text text-transparent">{aluno.fase_atual}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider mb-1">Evolução Geral</p>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${progresso}%` }} />
                      </div>
                      <span className="text-xs font-bold text-emerald-500 w-8 text-right">{progresso}%</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between bg-black/20 rounded-lg p-3 mt-2">
                    <div>
                      <p className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">XP Total</p>
                      <p className="text-2xl font-bold text-primary mt-0.5">{xpAtual}</p>
                    </div>
                    <Star size={32} className="text-primary/30" />
                  </div>
                </div>
              </section>
            </div>
          </div>

          {/* ── Biblioteca de Conteúdo ─────────────────────────────────────── */}
          <section>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <h3 className="text-xl font-bold text-foreground">Biblioteca de Conteúdo</h3>
              <div className="flex items-center gap-1 flex-wrap">
                {FILTROS.map(f => (
                  <button
                    key={f.key}
                    onClick={() => setFiltroMaterial(f.key)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                      filtroMaterial === f.key
                        ? "bg-primary text-primary-foreground shadow"
                        : "text-muted-foreground hover:text-foreground hover:bg-white/5",
                    )}
                  >
                    {f.label}
                    {f.key !== 'todos' && (
                      <span className="ml-1 opacity-50">
                        ({materiais.filter(m => m.tipo === f.key).length})
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {materiaisFiltrados.length === 0 ? (
              <div className="bg-zinc-900/30 rounded-2xl border border-dashed border-border/50 p-12 text-center">
                <BookOpen size={32} className="text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm font-medium">
                  {filtroMaterial === 'todos'
                    ? 'Nenhum material disponível ainda. A equipe está preparando seus conteúdos.'
                    : `Nenhum ${TIPO_META[filtroMaterial]?.label ?? filtroMaterial} disponível.`}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {materiaisFiltrados.map(m => (
                  <MaterialCard key={m.id} material={m as any} />
                ))}
              </div>
            )}
          </section>

        </main>
      </div>
    </AppLayout>
  );
}
