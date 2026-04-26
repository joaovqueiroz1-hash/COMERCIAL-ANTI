import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  fetchAlunos, fetchLeads, fetchSprintTarefas,
  aprovarTarefa, rejeitarTarefa,
  fetchTodosMateriais, createMaterial, deleteMaterial,
  fetchSprints,
} from "@/lib/api";
import type { Material } from "@/lib/api";
import {
  Users, Award, PlusCircle, GraduationCap, Loader2,
  CheckCircle2, XCircle, Clock, BookOpen, Video,
  FileText, Link2, Trash2, Globe, UserCheck, ChevronRight,
  Star,
} from "lucide-react";
import { getInitials } from "@/lib/types";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { createClient } from "@supabase/supabase-js";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

// Cliente secundário — cria conta sem deslogar o admin atual
const adminAuthClient = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  { auth: { persistSession: false } },
);

// ── constantes ────────────────────────────────────────────────────────────────

type ActiveTab = "alunos" | "conteudos";
type TipoMaterial = "video" | "pdf" | "documento" | "link";

const TIPO_META: Record<TipoMaterial, { icon: React.ReactNode; label: string; color: string }> = {
  video:     { icon: <Video size={14} />,    label: "Vídeo",     color: "text-red-400" },
  pdf:       { icon: <FileText size={14} />, label: "PDF",       color: "text-orange-400" },
  documento: { icon: <BookOpen size={14} />, label: "Documento", color: "text-blue-400" },
  link:      { icon: <Link2 size={14} />,    label: "Link",      color: "text-emerald-400" },
};

// ── componente principal ──────────────────────────────────────────────────────

export default function GestaoOperacional() {
  const { profile } = useAuth();

  // ── dados base ───────────────────────────────────────────────────────────
  const [alunos, setAlunos] = useState<any[]>([]);
  const [leadsFechados, setLeadsFechados] = useState<any[]>([]);
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [sprints, setSprints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // ── tab ──────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<ActiveTab>("alunos");

  // ── detalhe do aluno (Sheet) ─────────────────────────────────────────────
  const [alunoDetalhes, setAlunoDetalhes] = useState<any | null>(null);
  const [tarefasDetalhe, setTarefasDetalhe] = useState<any[]>([]);
  const [loadingTarefas, setLoadingTarefas] = useState(false);
  const [aprovando, setAprovando] = useState<string | null>(null);

  // ── matrícula ────────────────────────────────────────────────────────────
  const [openMatricula, setOpenMatricula] = useState(false);
  const [targetLead, setTargetLead] = useState<any | null>(null);
  const [senhaAluno, setSenhaAluno] = useState("");
  const [matriculando, setMatriculando] = useState(false);

  // ── add material ─────────────────────────────────────────────────────────
  const [openAddMaterial, setOpenAddMaterial] = useState(false);
  const [novoMaterial, setNovoMaterial] = useState({
    titulo: "", descricao: "", tipo: "link" as TipoMaterial, url: "",
    aluno_id: "__global__", sprint_id: "__none__",
  });
  const [savingMaterial, setSavingMaterial] = useState(false);
  const [deletingMaterial, setDeletingMaterial] = useState<string | null>(null);

  // ── carga inicial ─────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    try {
      const [alunosData, leadsData, materiaisData, sprintsData] = await Promise.all([
        fetchAlunos(),
        fetchLeads(),
        fetchTodosMateriais(),
        fetchSprints(),
      ]);
      const listaAlunos = alunosData || [];
      setAlunos(listaAlunos);
      setLeadsFechados(
        (leadsData || []).filter(
          l => l.status_pipeline === "fechado" && !listaAlunos.some(a => a.lead_id === l.id),
        ),
      );
      setMateriais((materiaisData || []) as Material[]);
      setSprints(sprintsData || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── detalhe do aluno ──────────────────────────────────────────────────────

  async function abrirDetalhe(aluno: any) {
    setAlunoDetalhes(aluno);
    setLoadingTarefas(true);
    try {
      const data = await fetchSprintTarefas(aluno.id);
      setTarefasDetalhe(data || []);
    } finally {
      setLoadingTarefas(false);
    }
  }

  async function handleAprovar(tarefaId: string, alunoId: string, xp: number) {
    setAprovando(tarefaId);
    try {
      await aprovarTarefa(tarefaId, alunoId, xp);
      setTarefasDetalhe(prev => prev.map(t =>
        t.id === tarefaId ? { ...t, aprovada_por_equipe: true, concluida: true } : t,
      ));
      setAlunos(prev => prev.map(a =>
        a.id === alunoId ? { ...a, pontuacao_total: (a.pontuacao_total || 0) + xp } : a,
      ));
      toast({ title: `+${xp} XP concedidos!`, description: "Tarefa aprovada com sucesso." });
    } catch {
      toast({ title: "Erro ao aprovar tarefa.", variant: "destructive" });
    } finally {
      setAprovando(null);
    }
  }

  async function handleRejeitar(tarefaId: string) {
    setAprovando(tarefaId);
    try {
      await rejeitarTarefa(tarefaId);
      setTarefasDetalhe(prev => prev.map(t =>
        t.id === tarefaId ? { ...t, concluida: false, aprovada_por_equipe: false } : t,
      ));
      toast({ title: "Entrega devolvida para revisão." });
    } catch {
      toast({ title: "Erro ao rejeitar tarefa.", variant: "destructive" });
    } finally {
      setAprovando(null);
    }
  }

  // ── matrícula ─────────────────────────────────────────────────────────────

  const handleMatricular = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetLead?.email) {
      toast({ title: "Lead sem e-mail", description: "Edite o lead no CRM e adicione o e-mail antes de matricular.", variant: "destructive" });
      return;
    }
    if (senhaAluno.length < 6) {
      toast({ title: "Senha muito curta", description: "Mínimo de 6 caracteres." });
      return;
    }
    setMatriculando(true);
    try {
      const email = targetLead.email.trim();
      const { data: signUpData, error: sErr } = await adminAuthClient.auth.signUp({
        email,
        password: senhaAluno,
        options: { data: { nome: targetLead.nome_completo, perfil: "aluno" } },
      });

      if (sErr) throw sErr;

      const profileId = signUpData?.user?.id;
      if (!profileId) throw new Error("Resposta vazia ao criar credencial.");

      await supabase.from("profiles").upsert({
        id: profileId, nome: targetLead.nome_completo, email, perfil: "aluno", ativo: true,
      });
      const { error: alErr } = await supabase.from("alunos").insert({
        lead_id: targetLead.id, profile_id: profileId, fase_atual: "Onboarding", pontuacao_total: 0,
      });
      if (alErr) throw alErr;

      toast({ title: "Aluno matriculado!", description: `Acesso criado para ${email}.` });
      setOpenMatricula(false);
      setSenhaAluno("");
      setTargetLead(null);
      loadData();
    } catch (err: any) {
      toast({ title: "Falha na matrícula", description: err.message, variant: "destructive" });
    } finally {
      setMatriculando(false);
    }
  };

  // ── materiais ─────────────────────────────────────────────────────────────

  function resetNovoMaterial() {
    setNovoMaterial({ titulo: "", descricao: "", tipo: "link", url: "", aluno_id: "__global__", sprint_id: "__none__" });
  }

  async function handleSalvarMaterial(e: React.FormEvent) {
    e.preventDefault();
    if (!novoMaterial.titulo || !novoMaterial.url) return;
    setSavingMaterial(true);
    try {
      await createMaterial({
        titulo: novoMaterial.titulo,
        descricao: novoMaterial.descricao || null,
        tipo: novoMaterial.tipo,
        url: novoMaterial.url,
        aluno_id: novoMaterial.aluno_id === "__global__" ? null : novoMaterial.aluno_id,
        sprint_id: novoMaterial.sprint_id === "__none__" ? null : novoMaterial.sprint_id,
        criado_por: profile?.id ?? null,
      });
      toast({ title: "Material adicionado!" });
      setOpenAddMaterial(false);
      resetNovoMaterial();
      const fresh = await fetchTodosMateriais();
      setMateriais((fresh || []) as Material[]);
    } catch {
      toast({ title: "Erro ao salvar material.", variant: "destructive" });
    } finally {
      setSavingMaterial(false);
    }
  }

  async function handleDeletarMaterial(id: string) {
    setDeletingMaterial(id);
    try {
      await deleteMaterial(id);
      setMateriais(prev => prev.filter(m => m.id !== id));
      toast({ title: "Material removido." });
    } catch {
      toast({ title: "Erro ao remover material.", variant: "destructive" });
    } finally {
      setDeletingMaterial(null);
    }
  }

  // ── agrupamento de tarefas por sprint ─────────────────────────────────────

  const sprintsComTarefas = sprints.map(s => ({
    ...s,
    tarefas: tarefasDetalhe.filter(t => t.sprint_id === s.id),
  })).filter(s => s.tarefas.length > 0);

  const pendentesAprovacao = tarefasDetalhe.filter(t => t.concluida && !t.aprovada_por_equipe);

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <AppLayout>
      <div className="flex flex-col h-full bg-background/50 overflow-hidden">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <header className="px-6 py-5 border-b border-border/40 bg-zinc-900/20 backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Gestão Operacional</h1>
            <p className="text-muted-foreground mt-0.5 text-sm">Acompanhamento de alunos, validação de entregas e biblioteca de conteúdo.</p>
          </div>
          <div className="flex items-center gap-2">
            {leadsFechados.length > 0 && (
              <span className="text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-full">
                {leadsFechados.length} aguardando matrícula
              </span>
            )}
            <Button
              onClick={() => leadsFechados.length > 0 ? (() => { setTargetLead(leadsFechados[0]); setOpenMatricula(true); })() : setOpenMatricula(true)}
              size="sm"
              className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
            >
              <PlusCircle size={15} /> Matricular Aluno
            </Button>
          </div>
        </header>

        {/* ── Tabs ────────────────────────────────────────────────────────── */}
        <div className="px-6 pt-4 border-b border-border/20 shrink-0">
          <nav className="flex gap-1">
            {([
              { key: "alunos", label: "Alunos", icon: <Users size={14} /> },
              { key: "conteudos", label: "Biblioteca de Conteúdo", icon: <BookOpen size={14} /> },
            ] as { key: ActiveTab; label: string; icon: React.ReactNode }[]).map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all -mb-px",
                  activeTab === tab.key
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.icon} {tab.label}
                {tab.key === "alunos" && alunos.length > 0 && (
                  <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">
                    {alunos.length}
                  </span>
                )}
                {tab.key === "conteudos" && materiais.length > 0 && (
                  <span className="text-[10px] bg-zinc-700 text-muted-foreground px-1.5 py-0.5 rounded-full">
                    {materiais.length}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        <main className="flex-1 p-6 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center mt-20">
              <Loader2 className="animate-spin text-primary" size={32} />
            </div>
          ) : (
            <>
              {/* ══ TAB: ALUNOS ══════════════════════════════════════════════ */}
              {activeTab === "alunos" && (
                <div className="space-y-8">

                  {/* Aguardando Matrícula */}
                  {leadsFechados.length > 0 && (
                    <section>
                      <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                        <GraduationCap className="text-amber-400" size={20} />
                        Aguardando Matrícula
                        <span className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full">
                          {leadsFechados.length}
                        </span>
                      </h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {leadsFechados.map(lead => (
                          <div key={lead.id} className="bg-amber-500/5 border border-amber-500/20 p-4 rounded-xl flex items-center justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <h3 className="font-bold text-amber-300 truncate">{lead.nome_completo}</h3>
                              <p className="text-xs text-muted-foreground truncate">
                                {lead.email || "⚠️ Sem e-mail cadastrado"}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              onClick={() => { setTargetLead(lead); setOpenMatricula(true); }}
                              className="bg-amber-500 hover:bg-amber-400 text-black font-bold whitespace-nowrap"
                            >
                              Matricular
                            </Button>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Alunos Ativos */}
                  <section>
                    <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                      <UserCheck className="text-primary" size={20} />
                      Alunos Ativos
                    </h2>
                    {alunos.length === 0 ? (
                      <div className="bg-zinc-900/30 rounded-2xl border border-border/40 p-10 text-center">
                        <Users size={32} className="text-muted-foreground/20 mx-auto mb-3" />
                        <h3 className="text-lg font-bold text-white mb-1">Nenhum Aluno Ativo</h3>
                        <p className="text-muted-foreground text-sm max-w-md mx-auto">
                          Feche vendas no CRM e matricule os alunos aqui.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {alunos.map(aluno => (
                          <button
                            key={aluno.id}
                            onClick={() => abrirDetalhe(aluno)}
                            className="bg-zinc-900 border border-border/40 p-5 rounded-xl hover:border-primary/50 hover:bg-zinc-900/80 transition-all text-left group w-full"
                          >
                            <div className="flex items-center gap-4 mb-4">
                              <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center font-bold text-lg text-primary shrink-0">
                                {getInitials(aluno.profiles?.nome || aluno.leads?.nome_completo || "?")}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-foreground truncate">
                                  {aluno.profiles?.nome || aluno.leads?.nome_completo}
                                </h3>
                                <p className="text-xs text-muted-foreground truncate">
                                  {aluno.leads?.whatsapp || aluno.profiles?.email}
                                </p>
                              </div>
                            </div>
                            <div className="flex justify-between items-center bg-black/20 p-3 rounded-lg mb-3">
                              <div>
                                <p className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider mb-0.5">Fase</p>
                                <p className="text-sm font-medium gold-gradient bg-clip-text text-transparent">{aluno.fase_atual}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider mb-0.5 flex items-center gap-1 justify-end">
                                  <Award size={9} /> XP
                                </p>
                                <p className="text-sm font-bold text-emerald-400">{aluno.pontuacao_total} pts</p>
                              </div>
                            </div>
                            <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground group-hover:text-primary transition-colors">
                              <span>Ver entregas e validar</span>
                              <ChevronRight size={14} />
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </section>
                </div>
              )}

              {/* ══ TAB: CONTEÚDOS ═══════════════════════════════════════════ */}
              {activeTab === "conteudos" && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-bold text-foreground">Biblioteca de Conteúdo</h2>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        Materiais globais ficam visíveis para todos os alunos. Materiais individuais só para o aluno selecionado.
                      </p>
                    </div>
                    <Button onClick={() => { resetNovoMaterial(); setOpenAddMaterial(true); }} className="gap-2">
                      <PlusCircle size={15} /> Adicionar Material
                    </Button>
                  </div>

                  {materiais.length === 0 ? (
                    <div className="bg-zinc-900/30 rounded-2xl border border-dashed border-border/40 p-12 text-center">
                      <BookOpen size={32} className="text-muted-foreground/20 mx-auto mb-3" />
                      <h3 className="text-lg font-bold text-white mb-1">Nenhum material cadastrado</h3>
                      <p className="text-muted-foreground text-sm">Adicione vídeos, PDFs, documentos e links para seus alunos.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {materiais.map(m => {
                        const meta = TIPO_META[m.tipo as TipoMaterial] ?? TIPO_META.link;
                        const alunoNome = (m as any).alunos?.profiles?.nome;
                        return (
                          <div
                            key={m.id}
                            className="flex items-center gap-4 p-4 bg-zinc-900/50 rounded-xl border border-border/30 hover:border-border/60 transition-colors"
                          >
                            <div className={cn("w-9 h-9 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0", meta.color)}>
                              {meta.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-foreground truncate">{m.titulo}</p>
                              {m.descricao && (
                                <p className="text-xs text-muted-foreground truncate">{m.descricao}</p>
                              )}
                              <div className="flex items-center gap-2 mt-1">
                                <span className={cn("text-[10px] font-bold uppercase tracking-wide", meta.color)}>{meta.label}</span>
                                {m.aluno_id ? (
                                  <span className="text-[10px] text-amber-400/70 flex items-center gap-1">
                                    <UserCheck size={9} /> {alunoNome || "Aluno específico"}
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-primary/70 flex items-center gap-1">
                                    <Globe size={9} /> Todos os alunos
                                  </span>
                                )}
                                {(m as any).sprints?.titulo && (
                                  <span className="text-[10px] text-muted-foreground/60">• {(m as any).sprints.titulo}</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <a
                                href={m.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-white/5 transition-colors"
                              >
                                Abrir
                              </a>
                              <button
                                onClick={() => handleDeletarMaterial(m.id)}
                                disabled={deletingMaterial === m.id}
                                className="text-muted-foreground/40 hover:text-destructive transition-colors p-1 rounded hover:bg-destructive/10 disabled:opacity-50"
                              >
                                {deletingMaterial === m.id
                                  ? <Loader2 size={14} className="animate-spin" />
                                  : <Trash2 size={14} />}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* ═════════════════════════════════════════════════════════════════════
          SHEET: Detalhe do Aluno (entregas + aprovação)
      ═════════════════════════════════════════════════════════════════════ */}
      <Sheet open={!!alunoDetalhes} onOpenChange={open => !open && setAlunoDetalhes(null)}>
        <SheetContent side="right" className="w-full sm:max-w-xl bg-zinc-950 border-border/40 overflow-y-auto flex flex-col gap-0 p-0">
          {alunoDetalhes && (
            <>
              {/* Header do sheet */}
              <SheetHeader className="px-6 py-5 border-b border-border/30 bg-zinc-900/60 shrink-0">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full gold-gradient flex items-center justify-center text-primary-foreground font-bold text-lg shrink-0">
                    {getInitials(alunoDetalhes.profiles?.nome || alunoDetalhes.leads?.nome_completo || "?")}
                  </div>
                  <div>
                    <SheetTitle className="text-foreground">
                      {alunoDetalhes.profiles?.nome || alunoDetalhes.leads?.nome_completo}
                    </SheetTitle>
                    <SheetDescription className="text-xs">
                      {alunoDetalhes.fase_atual} •{" "}
                      <span className="text-emerald-400 font-bold">{alunoDetalhes.pontuacao_total} XP</span>
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              {/* Alertas de pendentes */}
              {pendentesAprovacao.length > 0 && (
                <div className="px-6 py-3 bg-amber-500/10 border-b border-amber-500/20 shrink-0">
                  <p className="text-xs text-amber-400 font-bold flex items-center gap-1.5">
                    <Clock size={12} />
                    {pendentesAprovacao.length} entrega{pendentesAprovacao.length > 1 ? "s" : ""} aguardando validação
                  </p>
                </div>
              )}

              {/* Corpo */}
              <div className="flex-1 px-6 py-5 overflow-y-auto space-y-6">
                {loadingTarefas ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="animate-spin text-primary" size={24} />
                  </div>
                ) : tarefasDetalhe.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground text-sm">
                    Nenhuma tarefa alocada para este aluno ainda.
                  </div>
                ) : (
                  sprintsComTarefas.map(sprint => (
                    <div key={sprint.id}>
                      <h4 className="text-xs uppercase tracking-widest text-muted-foreground/60 font-bold mb-3">
                        {sprint.titulo}
                      </h4>
                      <div className="space-y-2">
                        {sprint.tarefas.map((tarefa: any) => (
                          <div
                            key={tarefa.id}
                            className={cn(
                              "p-4 rounded-xl border transition-colors",
                              tarefa.aprovada_por_equipe
                                ? "bg-emerald-500/5 border-emerald-500/20"
                                : tarefa.concluida
                                ? "bg-amber-500/5 border-amber-500/20"
                                : "bg-zinc-900/40 border-border/30",
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-3 flex-1 min-w-0">
                                {tarefa.aprovada_por_equipe ? (
                                  <CheckCircle2 size={16} className="text-emerald-500 mt-0.5 shrink-0" />
                                ) : tarefa.concluida ? (
                                  <Clock size={16} className="text-amber-400 mt-0.5 shrink-0" />
                                ) : (
                                  <div className="w-4 h-4 rounded-full border-2 border-border mt-0.5 shrink-0" />
                                )}
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-foreground">{tarefa.titulo}</p>
                                  <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                                    <Star size={9} className="text-emerald-400" />
                                    {tarefa.xp_recompensa} XP
                                    {tarefa.prazo && (
                                      <span className="ml-1">• Prazo: {new Date(tarefa.prazo).toLocaleDateString("pt-BR")}</span>
                                    )}
                                  </p>
                                </div>
                              </div>

                              {/* Ações */}
                              {tarefa.concluida && !tarefa.aprovada_por_equipe && (
                                <div className="flex items-center gap-2 shrink-0">
                                  <button
                                    onClick={() => handleAprovar(tarefa.id, alunoDetalhes.id, tarefa.xp_recompensa)}
                                    disabled={aprovando === tarefa.id}
                                    className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors disabled:opacity-50"
                                  >
                                    {aprovando === tarefa.id ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}
                                    Aprovar
                                  </button>
                                  <button
                                    onClick={() => handleRejeitar(tarefa.id)}
                                    disabled={aprovando === tarefa.id}
                                    className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors disabled:opacity-50"
                                  >
                                    <XCircle size={11} /> Devolver
                                  </button>
                                </div>
                              )}
                              {tarefa.aprovada_por_equipe && (
                                <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-wide shrink-0">Aprovado</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* ═════════════════════════════════════════════════════════════════════
          DIALOG: Matrícula
      ═════════════════════════════════════════════════════════════════════ */}
      <Dialog open={openMatricula} onOpenChange={setOpenMatricula}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <GraduationCap className="text-emerald-500" />
              {targetLead ? `Matricular: ${targetLead.nome_completo}` : "Matricular Aluno"}
            </DialogTitle>
            <DialogDescription>
              Cria acesso ao Portal do Aluno e registra o vínculo de mentoria.
            </DialogDescription>
          </DialogHeader>

          {!targetLead ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Selecione um lead fechado para matricular:</p>
              {leadsFechados.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum lead fechado pendente de matrícula.
                </p>
              ) : (
                leadsFechados.map(lead => (
                  <button
                    key={lead.id}
                    onClick={() => setTargetLead(lead)}
                    className="w-full text-left p-3 rounded-lg border border-border/40 hover:border-primary/40 hover:bg-primary/5 transition-all"
                  >
                    <p className="font-semibold text-sm text-foreground">{lead.nome_completo}</p>
                    <p className="text-xs text-muted-foreground">{lead.email || "Sem e-mail"}</p>
                  </button>
                ))
              )}
            </div>
          ) : (
            <form onSubmit={handleMatricular} className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground uppercase mb-2 block">E-mail</Label>
                <div className="px-3 py-2 bg-secondary/50 rounded-md text-sm text-foreground opacity-70">
                  {targetLead.email || "—"}
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground uppercase mb-2 block">Senha Inicial</Label>
                <Input
                  type="password"
                  value={senhaAluno}
                  onChange={e => setSenhaAluno(e.target.value)}
                  className="bg-zinc-900 border-border h-11"
                  placeholder="Mínimo 6 caracteres"
                  required
                />
              </div>
              <Button
                type="submit"
                disabled={matriculando || !targetLead.email}
                className="w-full h-11 bg-emerald-500 hover:bg-emerald-600 text-white font-bold"
              >
                {matriculando ? <Loader2 size={16} className="animate-spin" /> : "Confirmar e Criar Acesso"}
              </Button>
              {!targetLead.email && (
                <p className="text-xs text-destructive text-center">
                  Edite o lead no CRM e adicione o e-mail primeiro.
                </p>
              )}
              <button
                type="button"
                onClick={() => setTargetLead(null)}
                className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                ← Escolher outro lead
              </button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ═════════════════════════════════════════════════════════════════════
          DIALOG: Adicionar Material
      ═════════════════════════════════════════════════════════════════════ */}
      <Dialog open={openAddMaterial} onOpenChange={setOpenAddMaterial}>
        <DialogContent className="bg-card border-border sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <PlusCircle className="text-primary" size={18} />
              Adicionar Material
            </DialogTitle>
            <DialogDescription>
              Materiais globais ficam visíveis para todos os alunos automaticamente.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSalvarMaterial} className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground uppercase mb-2 block">Título *</Label>
              <Input
                value={novoMaterial.titulo}
                onChange={e => setNovoMaterial(p => ({ ...p, titulo: e.target.value }))}
                className="bg-zinc-900 border-border"
                placeholder="Ex: Aula 01 — Fundamentos de Gestão"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground uppercase mb-2 block">Tipo *</Label>
                <Select
                  value={novoMaterial.tipo}
                  onValueChange={v => setNovoMaterial(p => ({ ...p, tipo: v as TipoMaterial }))}
                >
                  <SelectTrigger className="bg-zinc-900 border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="video">Vídeo</SelectItem>
                    <SelectItem value="pdf">PDF</SelectItem>
                    <SelectItem value="documento">Documento</SelectItem>
                    <SelectItem value="link">Link</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground uppercase mb-2 block">Visibilidade</Label>
                <Select
                  value={novoMaterial.aluno_id}
                  onValueChange={v => setNovoMaterial(p => ({ ...p, aluno_id: v }))}
                >
                  <SelectTrigger className="bg-zinc-900 border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__global__">Todos os Alunos</SelectItem>
                    {alunos.map(a => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.profiles?.nome || a.leads?.nome_completo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground uppercase mb-2 block">Sprint (Opcional)</Label>
              <Select
                value={novoMaterial.sprint_id}
                onValueChange={v => setNovoMaterial(p => ({ ...p, sprint_id: v }))}
              >
                <SelectTrigger className="bg-zinc-900 border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhum</SelectItem>
                  {sprints.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.titulo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground uppercase mb-2 block">URL / Link *</Label>
              <Input
                value={novoMaterial.url}
                onChange={e => setNovoMaterial(p => ({ ...p, url: e.target.value }))}
                className="bg-zinc-900 border-border"
                placeholder="https://..."
                type="url"
                required
              />
            </div>

            <div>
              <Label className="text-xs text-muted-foreground uppercase mb-2 block">Descrição (opcional)</Label>
              <Textarea
                value={novoMaterial.descricao}
                onChange={e => setNovoMaterial(p => ({ ...p, descricao: e.target.value }))}
                className="bg-zinc-900 border-border resize-none"
                rows={2}
                placeholder="Breve descrição do conteúdo..."
              />
            </div>

            <Button type="submit" disabled={savingMaterial} className="w-full h-11 font-bold">
              {savingMaterial ? <Loader2 size={16} className="animate-spin" /> : "Salvar Material"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
