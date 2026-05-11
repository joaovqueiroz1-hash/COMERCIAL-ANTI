import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchAlunoLogado, fetchAlunoById, fetchSprintsForAluno, fetchSprintTarefas,
  fetchMateriaisAluno, fetchEventosAluno, marcarTarefaConcluida,
} from "@/lib/api";
import type { Material, Evento } from "@/lib/api";
import {
  CheckCircle2, Lock, Star, Trophy,
  FileText, Video, Link2, BookOpen, ExternalLink,
  Clock, Loader2, CalendarClock, AlertTriangle, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

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
        "group flex flex-col gap-3 p-4 rounded-xl border bg-card hover:bg-secondary/40 transition-all duration-200 hover:border-primary/40 cursor-pointer",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border", meta.bg, meta.color)}>
          {meta.icon}
        </div>
        <ExternalLink size={13} className="text-muted-foreground/40 group-hover:text-primary mt-0.5 shrink-0 transition-colors" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors">
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
  const { aluno_id } = useParams();
  const [aluno, setAluno] = useState<any>(null);
  const [sprints, setSprints] = useState<any[]>([]);
  const [tarefas, setTarefas] = useState<any[]>([]);
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroMaterial, setFiltroMaterial] = useState<TipoFiltro>('todos');
  const [concluindo, setConcluindo] = useState<string | null>(null);
  const [linkModal, setLinkModal] = useState<string | null>(null);
  const [linkEntrega, setLinkEntrega] = useState("");

  const isAdminOrGestor = profile && ['admin', 'gestor', 'equipe'].includes(profile.perfil);

  const loadData = useCallback(async () => {
    if (!profile) return;
    try {
      let targetAluno = null;
      if (aluno_id && isAdminOrGestor) {
        targetAluno = await fetchAlunoById(aluno_id);
      } else {
        targetAluno = await fetchAlunoLogado(profile.id);
      }
      
      setAluno(targetAluno);
      if (targetAluno) {
        const [sprintsData, tarefasData, materiaisData, eventosData] = await Promise.all([
          fetchSprintsForAluno(targetAluno.id),
          fetchSprintTarefas(targetAluno.id),
          fetchMateriaisAluno(targetAluno.id),
          fetchEventosAluno(targetAluno.id),
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
  }, [profile, aluno_id, isAdminOrGestor]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleMarcarConcluida(tarefaId: string, link?: string) {
    setConcluindo(tarefaId);
    setLinkModal(null);
    setLinkEntrega("");
    try {
      await marcarTarefaConcluida(tarefaId, link || null);
      setTarefas(prev => prev.map(t => t.id === tarefaId ? { ...t, concluida: true, link_entrega: link || null } : t));
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
  const xpMeta = aluno.premio_xp_meta ?? 1000;
  const premioTitulo = aluno.premio_titulo ?? "Viagem de Comemoração Surpresa";
  const premioDescricao = aluno.premio_descricao ?? null;
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
              <span className="gold-gradient-text">
                {profile?.nome.split(" ")[0]}
              </span>
            </h1>
            <p className="text-muted-foreground mt-2 text-sm max-w-xl">
              Sua base do Business Club. Acompanhe seus Sprints, acesse materiais e acumule XP para destravar{' '}
              <span className="font-semibold text-foreground">{premioTitulo}</span>!
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
          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-40 h-40 bg-primary/6 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
            <div className="relative z-10 p-5 md:p-6 flex flex-col md:flex-row items-center gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Lock size={13} className="text-primary/50" />
                  <h2 className="text-xs font-bold text-white/60 uppercase tracking-widest">O Prêmio</h2>
                </div>
                <p className="text-sm text-zinc-400 mb-5">
                  {premioDescricao ? (
                    premioDescricao
                  ) : (
                    <>
                      Acumule{" "}
                      <span className="text-white/90 font-semibold">{xpMeta} XP</span>{" "}
                      cumprindo todos os Sprints para conquistar:{" "}
                      <strong className="text-white/90">{premioTitulo}</strong>.
                    </>
                  )}
                </p>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px] font-bold uppercase tracking-wider">
                    <span className="text-emerald-400">{xpAtual} XP</span>
                    <span className="text-zinc-500">{xpMeta} XP</span>
                  </div>
                  <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary/60 to-primary transition-all duration-1000 ease-out"
                      style={{ width: `${progressViagem}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-right text-zinc-600 font-medium">
                    {progressViagem}% Destravado
                  </p>
                </div>
              </div>

              <div className="w-28 h-28 shrink-0 flex items-center justify-center">
                {progressViagem >= 100 ? (
                  <div className="w-24 h-24 bg-primary/20 rounded-full flex flex-col items-center justify-center border-2 border-primary text-primary animate-pulse shadow-[0_0_30px_hsl(29_16%_33%_/_0.3)]">
                    <Trophy size={36} className="mb-1" />
                    <span className="text-[9px] font-bold uppercase tracking-widest">Desbloqueado!</span>
                  </div>
                ) : (
                  <div className="w-24 h-24 bg-zinc-950 border border-dashed border-zinc-700 rounded-full flex flex-col items-center justify-center text-zinc-500 relative overflow-hidden">
                    <Lock size={22} className="mb-1 relative z-10" />
                    <span className="text-[9px] font-bold uppercase tracking-widest relative z-10 text-center leading-tight px-2">O Prêmio</span>
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
            <section className="bg-card rounded-2xl border border-border p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-foreground">Módulo de Execução</h3>
                <div className="flex items-center gap-2 bg-secondary rounded-full px-3 py-1">
                  <span className="text-xs text-emerald-600 font-bold">{concluidas}/{totalTarefas}</span>
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
                          <div className="bg-secondary p-3 rounded-lg border border-border flex items-center justify-center gap-2 text-xs text-muted-foreground">
                            <Lock size={12} /> Conclua o Sprint anterior para desbloquear
                          </div>
                        )}

                        {isUnlocked && minhasTarefas.length === 0 && (
                          <div className="bg-secondary p-3 rounded-lg border border-border text-xs text-muted-foreground text-center">
                            Nenhuma meta alocada neste Sprint ainda.
                          </div>
                        )}

                        {isUnlocked && minhasTarefas.length > 0 && (
                          <div className="space-y-2 mt-2">
                            {minhasTarefas.map(tarefa => (
                              <div
                                key={tarefa.id}
                                className="flex items-center justify-between bg-secondary p-3 rounded-lg border border-border gap-3"
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
                                    <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/40 shrink-0" />
                                  )}
                                  <div className="min-w-0">
                                    <span className={cn(
                                      "text-sm block truncate",
                                      tarefa.aprovada_por_equipe ? "text-muted-foreground line-through" : "text-foreground",
                                    )}>
                                      {tarefa.titulo}
                                    </span>
                                    {tarefa.concluida && !tarefa.aprovada_por_equipe && (
                                      <p className="text-[10px] text-amber-400 mt-0.5 flex items-center gap-1">
                                        <Clock size={9} /> Aguardando validação
                                      </p>
                                    )}
                                    {tarefa.prazo && !tarefa.aprovada_por_equipe && (
                                      <p className="text-[10px] text-muted-foreground mt-0.5">
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
                                      onClick={() => { setLinkModal(tarefa.id); setLinkEntrega(""); }}
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
              <section className="bg-card rounded-2xl border border-border p-6">
                <h3 className="text-lg font-bold text-foreground mb-4">Seu Status</h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider mb-1">Fase Atual da Mentoria</p>
                    <p className="text-sm font-semibold text-foreground">{aluno.fase_atual}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider mb-1">Evolução Geral</p>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${progresso}%` }} />
                      </div>
                      <span className="text-xs font-bold text-emerald-600 w-8 text-right">{progresso}%</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between bg-secondary/60 rounded-lg p-3 mt-2">
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
                        : "text-muted-foreground hover:text-foreground hover:bg-foreground/5",
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
              <div className="bg-secondary/40 rounded-2xl border border-dashed border-border p-12 text-center">
                <BookOpen size={32} className="text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm font-medium">
                  {filtroMaterial === 'todos'
                    ? 'Nenhum material disponível ainda. A equipe está preparando seus conteúdos.'
                    : `Nenhum ${TIPO_META[filtroMaterial]?.label ?? filtroMaterial} disponível.`}
                </p>
              </div>
            ) : filtroMaterial === 'todos' ? (
              <div className="space-y-6">
                {(() => {
                  const pastas = Array.from(new Set(materiaisFiltrados.map(m => (m as any).pasta || null)));
                  const grupos: (string | null)[] = [null, ...pastas.filter(Boolean) as string[]];
                  return grupos.map(pasta => {
                    const grupo = materiaisFiltrados.filter(m => ((m as any).pasta || null) === pasta);
                    if (grupo.length === 0) return null;
                    return (
                      <div key={pasta ?? "__sem__"}>
                        {pasta && (
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                              📁 {pasta}
                            </span>
                            <div className="flex-1 h-px bg-border" />
                            <span className="text-[10px] text-muted-foreground">{grupo.length}</span>
                          </div>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                          {grupo.map(m => (
                            <MaterialCard key={m.id} material={m as any} />
                          ))}
                        </div>
                      </div>
                    );
                  });
                })()}
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

      {/* ── Modal: Entregar Tarefa ─────────────────────────────────────────── */}
      <Dialog open={!!linkModal} onOpenChange={open => { if (!open) { setLinkModal(null); setLinkEntrega(""); } }}>
        <DialogContent className="bg-card border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="text-primary" size={18} /> Entregar Tarefa
            </DialogTitle>
            <DialogDescription>
              Cole um link do Google Docs, Notion, Drive ou qualquer URL com sua entrega. O link é opcional — você pode entregar sem ele.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label className="text-xs text-muted-foreground uppercase mb-2 block">Link da Entrega (opcional)</Label>
              <Input
                type="url"
                value={linkEntrega}
                onChange={e => setLinkEntrega(e.target.value)}
                className="bg-secondary border-border"
                placeholder="https://docs.google.com/..."
              />
            </div>
            <div className="flex gap-2">
              <Button
                className="flex-1 h-11 font-bold"
                disabled={concluindo === linkModal}
                onClick={() => linkModal && handleMarcarConcluida(linkModal, linkEntrega)}
              >
                {concluindo === linkModal
                  ? <Loader2 size={16} className="animate-spin" />
                  : linkEntrega ? 'Entregar com Link' : 'Entregar sem Link'}
              </Button>
              <Button variant="outline" className="border-border" onClick={() => { setLinkModal(null); setLinkEntrega(""); }}>
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
