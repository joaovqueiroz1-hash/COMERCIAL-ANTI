import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  fetchAlunos, fetchLeads, fetchSprintTarefas, fetchSprints,
  aprovarTarefa, rejeitarTarefa,
  fetchTodosMateriais, createMaterial, deleteMaterial,
  fetchTodosEventos, createEvento, deleteEvento,
  createSprint, deleteSprint, createSprintTarefa, deleteSprintTarefa,
} from "@/lib/api";
import type { Material, Evento } from "@/lib/api";
import {
  Users, Award, PlusCircle, GraduationCap, Loader2,
  CheckCircle2, XCircle, Clock, BookOpen, Video,
  FileText, Link2, Trash2, Globe, UserCheck, ChevronRight,
  Star, Calendar, Zap, Layers, LayoutTemplate,
  MapPin, KeyRound, UserMinus,
} from "lucide-react";
import { getInitials } from "@/lib/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { createClient } from "@supabase/supabase-js";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

const adminAuthClient = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  { auth: { persistSession: false } },
);

// ── constantes ────────────────────────────────────────────────────────────────
type ActiveTab = "alunos" | "sprints" | "eventos" | "conteudos";
type TipoMaterial = "video" | "pdf" | "documento" | "link";
type TipoEvento = "reuniao" | "evento" | "checkpoint" | "aula" | "entrega";

const TIPO_MATERIAL_META: Record<TipoMaterial, { icon: React.ReactNode; label: string; color: string }> = {
  video:     { icon: <Video size={14} />,    label: "Vídeo",     color: "text-red-400" },
  pdf:       { icon: <FileText size={14} />, label: "PDF",       color: "text-orange-400" },
  documento: { icon: <BookOpen size={14} />, label: "Documento", color: "text-blue-400" },
  link:      { icon: <Link2 size={14} />,    label: "Link",      color: "text-emerald-400" },
};

const TIPO_EVENTO_META: Record<TipoEvento, { label: string; color: string; bg: string }> = {
  reuniao:    { label: "Reunião",     color: "text-blue-400",   bg: "bg-blue-500/10 border-blue-500/20" },
  aula:       { label: "Aula",        color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20" },
  checkpoint: { label: "Checkpoint",  color: "text-amber-400",  bg: "bg-amber-500/10 border-amber-500/20" },
  evento:     { label: "Evento",      color: "text-emerald-400",bg: "bg-emerald-500/10 border-emerald-500/20" },
  entrega:    { label: "Entrega",     color: "text-red-400",    bg: "bg-red-500/10 border-red-500/20" },
};

// Template de 12 sprints para 1 ano de mentoria em marketing/negócios
const TEMPLATE_SPRINTS = [
  { titulo: "Sprint 1 — Diagnóstico & Base",          descricao: "Análise profunda do negócio, definição de metas anuais e baseline de KPIs.", ordem: 1 },
  { titulo: "Sprint 2 — Posicionamento & Identidade", descricao: "Proposta de valor, diferencial competitivo, identidade visual e comunicação verbal.", ordem: 2 },
  { titulo: "Sprint 3 — Estratégia de Conteúdo",      descricao: "Calendário editorial, temas-pilar, formatos e fluxo de produção.", ordem: 3 },
  { titulo: "Sprint 4 — Produção de Conteúdo I",      descricao: "Criação dos primeiros ativos, ferramentas, processos e primeiros resultados.", ordem: 4 },
  { titulo: "Sprint 5 — Funil de Vendas",             descricao: "Jornada do cliente, captação de leads, qualificação e conversão.", ordem: 5 },
  { titulo: "Sprint 6 — Tráfego & Aquisição",         descricao: "Meta Ads, Google Ads, SEO e geração orgânica de leads qualificados.", ordem: 6 },
  { titulo: "Sprint 7 — Revisão Semestral",           descricao: "Análise de resultados dos 6 primeiros meses e ajuste estratégico do segundo semestre.", ordem: 7 },
  { titulo: "Sprint 8 — Produção de Conteúdo II",     descricao: "Escala da produção, automações, delegação, SOPs e sistemas editoriais.", ordem: 8 },
  { titulo: "Sprint 9 — Comunidade & Relacionamento", descricao: "Estratégias de engajamento, nutrição de audiência e programas de fidelização.", ordem: 9 },
  { titulo: "Sprint 10 — Gestão & Processos",         descricao: "OKRs, gestão de time, cultura, indicadores financeiros e dashboard de KPIs.", ordem: 10 },
  { titulo: "Sprint 11 — Expansão & Novos Canais",    descricao: "Novos mercados, parcerias estratégicas, produtos digitais e novas fontes de receita.", ordem: 11 },
  { titulo: "Sprint 12 — Consolidação & Celebração",  descricao: "Resultados anuais, aprendizados, próxima fase e celebração do Grande Prêmio.", ordem: 12 },
];

// ── componente principal ──────────────────────────────────────────────────────
export default function GestaoOperacional() {
  const { profile } = useAuth();

  const [alunos,       setAlunos]       = useState<any[]>([]);
  const [leadsFechados,setLeadsFechados]= useState<any[]>([]);
  const [materiais,    setMateriais]    = useState<Material[]>([]);
  const [sprints,      setSprints]      = useState<any[]>([]);
  const [eventos,      setEventos]      = useState<Evento[]>([]);
  const [loading,      setLoading]      = useState(true);

  const [activeTab, setActiveTab] = useState<ActiveTab>("alunos");

  // ── detalhe aluno ─────────────────────────────────────────────────────────
  const [alunoDetalhes,   setAlunoDetalhes]   = useState<any | null>(null);
  const [tarefasDetalhe,  setTarefasDetalhe]  = useState<any[]>([]);
  const [loadingTarefas,  setLoadingTarefas]  = useState(false);
  const [aprovando,       setAprovando]       = useState<string | null>(null);

  // ── matrícula ─────────────────────────────────────────────────────────────
  const [openMatricula, setOpenMatricula] = useState(false);
  const [targetLead,    setTargetLead]    = useState<any | null>(null);
  const [senhaAluno,    setSenhaAluno]    = useState("");
  const [matriculando,  setMatriculando]  = useState(false);

  // ── aluno: excluir / resetar senha ───────────────────────────────────────
  const [excluindo,       setExcluindo]       = useState(false);
  const [resetandoSenha,  setResetandoSenha]  = useState(false);
  const [confirmDelete,   setConfirmDelete]   = useState(false);

  // ── sprint + tarefa ───────────────────────────────────────────────────────
  const [openCriarSprint,  setOpenCriarSprint]  = useState(false);
  const [openCriarTarefa,  setOpenCriarTarefa]  = useState(false);
  const [savingSprint,     setSavingSprint]     = useState(false);
  const [savingTarefa,     setSavingTarefa]     = useState(false);
  const [importandoTemplate, setImportandoTemplate] = useState(false);
  const [novoSprint, setNovoSprint] = useState({ titulo: "", descricao: "" });
  const [novaTarefa, setNovaTarefa] = useState({
    sprint_id: "", aluno_id: "__todos__", titulo: "", xp_recompensa: 50, prazo: "",
  });

  // ── eventos ───────────────────────────────────────────────────────────────
  const [openCriarEvento, setOpenCriarEvento] = useState(false);
  const [savingEvento,    setSavingEvento]    = useState(false);
  const [novoEvento, setNovoEvento] = useState({
    titulo: "", descricao: "", data_hora: "", tipo: "reuniao" as TipoEvento,
    aluno_id: "__todos__", sprint_id: "__none__",
  });

  // ── material ──────────────────────────────────────────────────────────────
  const [openAddMaterial, setOpenAddMaterial] = useState(false);
  const [novoMaterial,    setNovoMaterial]    = useState({
    titulo: "", descricao: "", tipo: "link" as TipoMaterial, url: "",
    aluno_id: "__global__", sprint_id: "__none__",
  });
  const [savingMaterial,   setSavingMaterial]   = useState(false);
  const [deletingMaterial, setDeletingMaterial] = useState<string | null>(null);

  // ── carga ─────────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    // Promise.allSettled garante que leads/alunos carregam mesmo se tabelas novas ainda não existirem
    const [alunosRes, leadsRes, materiaisRes, sprintsRes, eventosRes] = await Promise.allSettled([
      fetchAlunos(), fetchLeads(), fetchTodosMateriais(), fetchSprints(), fetchTodosEventos(),
    ]);
    const listaAlunos = alunosRes.status === "fulfilled" ? (alunosRes.value || []) : [];
    const listaLeads  = leadsRes.status  === "fulfilled" ? (leadsRes.value  || []) : [];
    setAlunos(listaAlunos);
    setLeadsFechados(listaLeads.filter(
      l => l.status_pipeline === "fechado" && !listaAlunos.some((a: any) => a.lead_id === l.id),
    ));
    if (materiaisRes.status === "fulfilled") setMateriais((materiaisRes.value || []) as Material[]);
    if (sprintsRes.status  === "fulfilled") setSprints(sprintsRes.value || []);
    if (eventosRes.status  === "fulfilled") setEventos((eventosRes.value || []) as Evento[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── detalhe aluno ─────────────────────────────────────────────────────────
  async function abrirDetalhe(aluno: any) {
    setAlunoDetalhes(aluno);
    setLoadingTarefas(true);
    try { setTarefasDetalhe(await fetchSprintTarefas(aluno.id) || []); }
    finally { setLoadingTarefas(false); }
  }

  async function handleAprovar(tarefaId: string, alunoId: string, xp: number) {
    setAprovando(tarefaId);
    try {
      await aprovarTarefa(tarefaId, alunoId, xp);
      setTarefasDetalhe(prev => prev.map(t => t.id === tarefaId ? { ...t, aprovada_por_equipe: true, concluida: true } : t));
      setAlunos(prev => prev.map(a => a.id === alunoId ? { ...a, pontuacao_total: (a.pontuacao_total || 0) + xp } : a));
      toast({ title: `+${xp} XP concedidos!` });
    } catch { toast({ title: "Erro ao aprovar.", variant: "destructive" }); }
    finally { setAprovando(null); }
  }

  async function handleRejeitar(tarefaId: string) {
    setAprovando(tarefaId);
    try {
      await rejeitarTarefa(tarefaId);
      setTarefasDetalhe(prev => prev.map(t => t.id === tarefaId ? { ...t, concluida: false, aprovada_por_equipe: false } : t));
      toast({ title: "Entrega devolvida para revisão." });
    } catch { toast({ title: "Erro.", variant: "destructive" }); }
    finally { setAprovando(null); }
  }

  // ── matrícula ─────────────────────────────────────────────────────────────
  const handleMatricular = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetLead?.email) { toast({ title: "Lead sem e-mail.", variant: "destructive" }); return; }
    if (senhaAluno.length < 6) { toast({ title: "Mínimo 6 caracteres." }); return; }
    setMatriculando(true);
    try {
      const { data: signUpData, error: sErr } = await adminAuthClient.auth.signUp({
        email: targetLead.email.trim(), password: senhaAluno,
        options: { data: { nome: targetLead.nome_completo, perfil: "aluno" } },
      });
      if (sErr && !sErr.message.includes("already registered")) throw sErr;
      const pid = signUpData?.user?.id;
      if (!pid) throw new Error("Usuário já cadastrado com outro perfil ou resposta vazia.");

      // Auto-confirma o e-mail para que o aluno possa logar imediatamente
      // Requer a função confirm_user_signup no Supabase (inclusa no SQL de migração)
      await (supabase as any).rpc("confirm_user_signup", { user_id: pid }).catch(() => {
        // Silencia se a função ainda não foi criada; admin deve rodar a migration SQL
      });

      await supabase.from("profiles").upsert({
        id: pid, nome: targetLead.nome_completo,
        email: targetLead.email.trim(), perfil: "aluno", ativo: true,
      });
      const { error: alErr } = await (supabase as any).from("alunos").insert({
        lead_id: targetLead.id, profile_id: pid,
        fase_atual: "Onboarding", pontuacao_total: 0,
      });
      if (alErr) throw alErr;
      toast({ title: "Aluno matriculado!", description: `Acesso criado para ${targetLead.email.trim()}` });
      setOpenMatricula(false); setSenhaAluno(""); setTargetLead(null);
      loadData();
    } catch (err: any) { toast({ title: "Falha na matrícula", description: err.message, variant: "destructive" }); }
    finally { setMatriculando(false); }
  };

  // ── aluno: resetar senha ──────────────────────────────────────────────────
  async function handleResetarSenha() {
    const email = alunoDetalhes?.profiles?.email;
    if (!email) return;
    setResetandoSenha(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/portal`,
      });
      if (error) throw error;
      toast({ title: "Email de redefinição enviado!", description: `Link enviado para ${email}` });
    } catch (err: any) {
      toast({ title: "Erro ao enviar email", description: err.message, variant: "destructive" });
    } finally { setResetandoSenha(false); }
  }

  // ── aluno: excluir ────────────────────────────────────────────────────────
  async function handleExcluirAluno() {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setExcluindo(true);
    try {
      const { error } = await (supabase as any).from("alunos").delete().eq("id", alunoDetalhes.id);
      if (error) throw error;
      toast({ title: "Aluno removido do sistema." });
      setAlunoDetalhes(null);
      setConfirmDelete(false);
      loadData();
    } catch (err: any) {
      toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" });
    } finally { setExcluindo(false); }
  }

  // ── sprints ───────────────────────────────────────────────────────────────
  async function handleCriarSprint(e: React.FormEvent) {
    e.preventDefault();
    if (!novoSprint.titulo) return;
    setSavingSprint(true);
    try {
      const newS = await createSprint(novoSprint.titulo, novoSprint.descricao || undefined, sprints.length + 1);
      setSprints(prev => [...prev, newS]);
      toast({ title: "Sprint criado!" });
      setOpenCriarSprint(false); setNovoSprint({ titulo: "", descricao: "" });
    } catch { toast({ title: "Erro ao criar sprint.", variant: "destructive" }); }
    finally { setSavingSprint(false); }
  }

  async function handleImportarTemplate() {
    setImportandoTemplate(true);
    try {
      let created = 0;
      for (const s of TEMPLATE_SPRINTS) {
        const exists = sprints.some(x => x.titulo === s.titulo);
        if (!exists) { await createSprint(s.titulo, s.descricao, s.ordem); created++; }
      }
      const fresh = await fetchSprints();
      setSprints(fresh || []);
      toast({ title: `${created} sprint(s) importados!`, description: created === 0 ? "Todos já existiam." : undefined });
    } catch { toast({ title: "Erro ao importar.", variant: "destructive" }); }
    finally { setImportandoTemplate(false); }
  }

  async function handleCriarTarefa(e: React.FormEvent) {
    e.preventDefault();
    if (!novaTarefa.sprint_id || !novaTarefa.titulo) return;
    setSavingTarefa(true);
    try {
      const targets = novaTarefa.aluno_id === "__todos__" ? alunos : alunos.filter(a => a.id === novaTarefa.aluno_id);
      for (const aluno of targets) {
        await createSprintTarefa({
          sprint_id: novaTarefa.sprint_id,
          aluno_id: aluno.id,
          titulo: novaTarefa.titulo,
          xp_recompensa: novaTarefa.xp_recompensa,
          prazo: novaTarefa.prazo || undefined,
        });
      }
      toast({ title: `Tarefa criada para ${targets.length} aluno(s)!` });
      setOpenCriarTarefa(false);
      setNovaTarefa({ sprint_id: "", aluno_id: "__todos__", titulo: "", xp_recompensa: 50, prazo: "" });
    } catch { toast({ title: "Erro ao criar tarefa.", variant: "destructive" }); }
    finally { setSavingTarefa(false); }
  }

  async function handleDeletarSprint(id: string) {
    try { await deleteSprint(id); setSprints(prev => prev.filter(s => s.id !== id)); toast({ title: "Sprint removido." }); }
    catch { toast({ title: "Erro ao remover.", variant: "destructive" }); }
  }

  // ── eventos ───────────────────────────────────────────────────────────────
  async function handleCriarEvento(e: React.FormEvent) {
    e.preventDefault();
    if (!novoEvento.titulo || !novoEvento.data_hora) return;
    setSavingEvento(true);
    try {
      const ev = await createEvento({
        titulo: novoEvento.titulo, descricao: novoEvento.descricao || null,
        data_hora: new Date(novoEvento.data_hora).toISOString(),
        tipo: novoEvento.tipo,
        aluno_id: novoEvento.aluno_id === "__todos__" ? null : novoEvento.aluno_id,
        sprint_id: novoEvento.sprint_id === "__none__" ? null : novoEvento.sprint_id,
        criado_por: profile?.id ?? null,
      });
      setEventos(prev => [...prev, ev].sort((a, b) => new Date(a.data_hora).getTime() - new Date(b.data_hora).getTime()));
      toast({ title: "Evento criado!" });
      setOpenCriarEvento(false);
      setNovoEvento({ titulo: "", descricao: "", data_hora: "", tipo: "reuniao", aluno_id: "__todos__", sprint_id: "__none__" });
    } catch { toast({ title: "Erro ao criar evento.", variant: "destructive" }); }
    finally { setSavingEvento(false); }
  }

  async function handleDeletarEvento(id: string) {
    try { await deleteEvento(id); setEventos(prev => prev.filter(e => e.id !== id)); toast({ title: "Evento removido." }); }
    catch { toast({ title: "Erro.", variant: "destructive" }); }
  }

  // ── materiais ─────────────────────────────────────────────────────────────
  async function handleSalvarMaterial(e: React.FormEvent) {
    e.preventDefault();
    if (!novoMaterial.titulo || !novoMaterial.url) return;
    setSavingMaterial(true);
    try {
      await createMaterial({
        titulo: novoMaterial.titulo, descricao: novoMaterial.descricao || null,
        tipo: novoMaterial.tipo, url: novoMaterial.url,
        aluno_id: novoMaterial.aluno_id === "__global__" ? null : novoMaterial.aluno_id,
        sprint_id: novoMaterial.sprint_id === "__none__" ? null : novoMaterial.sprint_id,
        criado_por: profile?.id ?? null,
      });
      toast({ title: "Material adicionado!" });
      setOpenAddMaterial(false);
      setNovoMaterial({ titulo: "", descricao: "", tipo: "link", url: "", aluno_id: "__global__", sprint_id: "__none__" });
      setMateriais((await fetchTodosMateriais() || []) as Material[]);
    } catch { toast({ title: "Erro ao salvar.", variant: "destructive" }); }
    finally { setSavingMaterial(false); }
  }

  async function handleDeletarMaterial(id: string) {
    setDeletingMaterial(id);
    try { await deleteMaterial(id); setMateriais(prev => prev.filter(m => m.id !== id)); toast({ title: "Removido." }); }
    catch { toast({ title: "Erro.", variant: "destructive" }); }
    finally { setDeletingMaterial(null); }
  }

  // ── helpers para sheet ────────────────────────────────────────────────────
  const sprintsComTarefas = sprints.map(s => ({
    ...s, tarefas: tarefasDetalhe.filter(t => t.sprint_id === s.id),
  })).filter(s => s.tarefas.length > 0);
  const pendentesAprovacao = tarefasDetalhe.filter(t => t.concluida && !t.aprovada_por_equipe);

  const TABS: { key: ActiveTab; label: string; icon: React.ReactNode }[] = [
    { key: "alunos",    label: "Alunos",        icon: <Users size={14} /> },
    { key: "sprints",   label: "Sprints & Tarefas", icon: <Layers size={14} /> },
    { key: "eventos",   label: "Eventos & Reuniões",icon: <Calendar size={14} /> },
    { key: "conteudos", label: "Biblioteca",    icon: <BookOpen size={14} /> },
  ];

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <AppLayout title="Gestão Operacional">
      <div className="flex flex-col h-full -m-4 md:-m-6 overflow-hidden">

        {/* Header */}
        <header className="px-6 py-5 border-b border-border/40 bg-zinc-900/20 shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Gestão Operacional</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Alunos, sprints, eventos e biblioteca de conteúdo.</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {leadsFechados.length > 0 && (
              <span className="text-xs font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-1 rounded-full">
                {leadsFechados.length} aguardando matrícula
              </span>
            )}
            <Button size="sm" onClick={() => { setOpenCriarSprint(true); setActiveTab("sprints"); }} variant="outline" className="gap-1.5 border-border">
              <Zap size={13} /> Novo Sprint
            </Button>
            <Button size="sm" onClick={() => { setOpenCriarEvento(true); setActiveTab("eventos"); }} variant="outline" className="gap-1.5 border-border">
              <Calendar size={13} /> Novo Evento
            </Button>
            <Button size="sm" onClick={() => setOpenMatricula(true)} className="gap-1.5">
              <PlusCircle size={13} /> Matricular
            </Button>
          </div>
        </header>

        {/* Tabs */}
        <div className="px-6 pt-4 border-b border-border/20 shrink-0 flex gap-1 overflow-x-auto">
          {TABS.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={cn("flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all -mb-px whitespace-nowrap",
                activeTab === tab.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
              )}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        <main className="flex-1 p-6 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center mt-20"><Loader2 className="animate-spin text-primary" size={32} /></div>
          ) : (
            <>
              {/* ══ ALUNOS ═══════════════════════════════════════════════════ */}
              {activeTab === "alunos" && (
                <div className="space-y-8">
                  {leadsFechados.length > 0 && (
                    <section>
                      <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                        <GraduationCap className="text-primary" size={20} /> Aguardando Matrícula
                        <span className="text-xs bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full">{leadsFechados.length}</span>
                      </h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {leadsFechados.map((lead, idx) => {
                          const isDark = idx % 2 !== 0;
                          return (
                            <div key={lead.id} className={`${isDark ? 'card-dark' : 'bg-primary/5 border border-primary/20'} p-4 rounded-xl flex items-center justify-between gap-3`}>
                              <div className="flex-1 min-w-0">
                                <h3 className={`font-bold truncate ${isDark ? 'text-white' : 'text-foreground'}`}>{lead.nome_completo}</h3>
                                <p className={`text-xs truncate ${isDark ? 'text-white/50' : 'text-muted-foreground'}`}>{lead.email || "⚠️ Sem e-mail"}</p>
                              </div>
                              <Button size="sm" onClick={() => { setTargetLead(lead); setOpenMatricula(true); }} className="gold-gradient text-primary-foreground font-bold whitespace-nowrap">Matricular</Button>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  )}
                  <section>
                    <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2"><UserCheck className="text-primary" size={20} /> Alunos Ativos</h2>
                    {alunos.length === 0 ? (
                      <div className="bg-zinc-900/30 rounded-2xl border border-border/40 p-10 text-center">
                        <Users size={32} className="text-muted-foreground/20 mx-auto mb-3" />
                        <p className="text-muted-foreground text-sm">Nenhum aluno ativo ainda.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {alunos.map(aluno => (
                          <button key={aluno.id} onClick={() => abrirDetalhe(aluno)}
                            className="bg-zinc-900 border border-border/40 p-5 rounded-xl hover:border-primary/50 text-left group w-full transition-all">
                            <div className="flex items-center gap-4 mb-4">
                              <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center font-bold text-lg text-primary shrink-0">
                                {getInitials(aluno.profiles?.nome || aluno.leads?.nome_completo || "?")}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-foreground truncate">{aluno.profiles?.nome || aluno.leads?.nome_completo}</h3>
                                <p className="text-xs text-muted-foreground truncate">{aluno.leads?.whatsapp || aluno.profiles?.email}</p>
                              </div>
                            </div>
                            <div className="flex justify-between items-center bg-black/20 p-3 rounded-lg mb-3">
                              <div>
                                <p className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider mb-0.5">Fase</p>
                                <p className="text-sm font-medium gold-gradient bg-clip-text text-transparent">{aluno.fase_atual}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider mb-0.5 flex items-center gap-1 justify-end"><Award size={9} /> XP</p>
                                <p className="text-sm font-bold text-emerald-400">{aluno.pontuacao_total} pts</p>
                              </div>
                            </div>
                            <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground group-hover:text-primary transition-colors">
                              <span>Ver entregas e validar</span><ChevronRight size={14} />
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </section>
                </div>
              )}

              {/* ══ SPRINTS ═══════════════════════════════════════════════════ */}
              {activeTab === "sprints" && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-bold text-foreground">Sprints & Tarefas</h2>
                      <p className="text-sm text-muted-foreground mt-0.5">Crie os módulos da mentoria e atribua tarefas aos alunos.</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button variant="outline" size="sm" onClick={handleImportarTemplate} disabled={importandoTemplate} className="gap-1.5 border-border">
                        {importandoTemplate ? <Loader2 size={13} className="animate-spin" /> : <LayoutTemplate size={13} />}
                        Importar Template 1 Ano
                      </Button>
                      <Button size="sm" onClick={() => setOpenCriarTarefa(true)} variant="outline" className="gap-1.5 border-border">
                        <Star size={13} /> Nova Tarefa
                      </Button>
                      <Button size="sm" onClick={() => setOpenCriarSprint(true)} className="gap-1.5">
                        <PlusCircle size={13} /> Novo Sprint
                      </Button>
                    </div>
                  </div>

                  {sprints.length === 0 ? (
                    <div className="bg-zinc-900/30 rounded-2xl border border-dashed border-border/40 p-12 text-center">
                      <Layers size={32} className="text-muted-foreground/20 mx-auto mb-3" />
                      <h3 className="text-lg font-bold text-white mb-1">Nenhum Sprint criado</h3>
                      <p className="text-muted-foreground text-sm mb-4">Crie manualmente ou importe o template de 12 meses.</p>
                      <Button onClick={handleImportarTemplate} disabled={importandoTemplate} className="gap-2">
                        {importandoTemplate ? <Loader2 size={14} className="animate-spin" /> : <LayoutTemplate size={14} />}
                        Importar Template 1 Ano (12 Sprints)
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {sprints.map((sprint, idx) => (
                        <div key={sprint.id} className="bg-zinc-900/50 border border-border/30 rounded-xl p-4 hover:border-border/60 transition-colors">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                                {String(idx + 1).padStart(2, "0")}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-foreground">{sprint.titulo}</p>
                                {sprint.descricao && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{sprint.descricao}</p>}
                              </div>
                            </div>
                            <button onClick={() => handleDeletarSprint(sprint.id)} className="text-muted-foreground/30 hover:text-destructive transition-colors p-1 rounded shrink-0">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ══ EVENTOS ═══════════════════════════════════════════════════ */}
              {activeTab === "eventos" && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-bold text-foreground">Eventos & Reuniões</h2>
                      <p className="text-sm text-muted-foreground mt-0.5">Reuniões, aulas, checkpoints e entregas programadas.</p>
                    </div>
                    <Button size="sm" onClick={() => setOpenCriarEvento(true)} className="gap-1.5">
                      <PlusCircle size={13} /> Novo Evento
                    </Button>
                  </div>

                  {eventos.length === 0 ? (
                    <div className="bg-zinc-900/30 rounded-2xl border border-dashed border-border/40 p-12 text-center">
                      <Calendar size={32} className="text-muted-foreground/20 mx-auto mb-3" />
                      <p className="text-muted-foreground text-sm">Nenhum evento cadastrado ainda.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {eventos.map(ev => {
                        const meta = TIPO_EVENTO_META[ev.tipo as TipoEvento] ?? TIPO_EVENTO_META.evento;
                        const isPast = new Date(ev.data_hora) < new Date();
                        return (
                          <div key={ev.id} className={cn("flex items-center gap-4 p-4 rounded-xl border transition-colors", meta.bg, isPast && "opacity-50")}>
                            <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", meta.bg)}>
                              <Calendar size={16} className={meta.color} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-foreground">{ev.titulo}</p>
                              <div className="flex items-center gap-3 mt-1 flex-wrap">
                                <span className={cn("text-[10px] font-bold uppercase tracking-wide", meta.color)}>{meta.label}</span>
                                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                  <Clock size={9} /> {new Date(ev.data_hora).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                                </span>
                                {!(ev as any).aluno_id ? (
                                  <span className="text-[10px] text-primary/70 flex items-center gap-1"><Globe size={9} /> Todos</span>
                                ) : (
                                  <span className="text-[10px] text-primary/70 flex items-center gap-1"><UserCheck size={9} /> Individual</span>
                                )}
                              </div>
                              {ev.descricao && <p className="text-xs text-muted-foreground mt-1 truncate">{ev.descricao}</p>}
                            </div>
                            <button onClick={() => handleDeletarEvento(ev.id)} className="text-muted-foreground/30 hover:text-destructive transition-colors p-1 rounded shrink-0">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ══ BIBLIOTECA ════════════════════════════════════════════════ */}
              {activeTab === "conteudos" && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-bold text-foreground">Biblioteca de Conteúdo</h2>
                      <p className="text-sm text-muted-foreground mt-0.5">Materiais globais visíveis para todos. Individuais apenas para o aluno selecionado.</p>
                    </div>
                    <Button size="sm" onClick={() => setOpenAddMaterial(true)} className="gap-1.5"><PlusCircle size={13} /> Adicionar</Button>
                  </div>
                  {materiais.length === 0 ? (
                    <div className="bg-zinc-900/30 rounded-2xl border border-dashed border-border/40 p-12 text-center">
                      <BookOpen size={32} className="text-muted-foreground/20 mx-auto mb-3" />
                      <p className="text-muted-foreground text-sm">Nenhum material cadastrado.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {materiais.map(m => {
                        const meta = TIPO_MATERIAL_META[m.tipo as TipoMaterial] ?? TIPO_MATERIAL_META.link;
                        const alunoNome = (m as any).alunos?.profiles?.nome;
                        return (
                          <div key={m.id} className="flex items-center gap-4 p-4 bg-zinc-900/50 rounded-xl border border-border/30 hover:border-border/60 transition-colors">
                            <div className={cn("w-9 h-9 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0", meta.color)}>{meta.icon}</div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-foreground truncate">{m.titulo}</p>
                              {m.descricao && <p className="text-xs text-muted-foreground truncate">{m.descricao}</p>}
                              <div className="flex items-center gap-2 mt-1">
                                <span className={cn("text-[10px] font-bold uppercase tracking-wide", meta.color)}>{meta.label}</span>
                                {m.aluno_id ? (
                                  <span className="text-[10px] text-primary/70 flex items-center gap-1"><UserCheck size={9} /> {alunoNome || "Aluno específico"}</span>
                                ) : (
                                  <span className="text-[10px] text-primary/70 flex items-center gap-1"><Globe size={9} /> Todos</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <a href={m.url} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-white/5 transition-colors">Abrir</a>
                              <button onClick={() => handleDeletarMaterial(m.id)} disabled={deletingMaterial === m.id} className="text-muted-foreground/30 hover:text-destructive transition-colors p-1 rounded disabled:opacity-50">
                                {deletingMaterial === m.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
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

      {/* ══ SHEET: Detalhe do Aluno ══════════════════════════════════════════ */}
      <Sheet open={!!alunoDetalhes} onOpenChange={open => { if (!open) { setAlunoDetalhes(null); setConfirmDelete(false); } }}>
        <SheetContent side="right" className="w-full sm:max-w-xl bg-zinc-950 border-border/40 overflow-y-auto flex flex-col gap-0 p-0">
          {alunoDetalhes && (
            <>
              <SheetHeader className="px-6 py-5 border-b border-border/30 bg-zinc-900/60 shrink-0">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full gold-gradient flex items-center justify-center text-primary-foreground font-bold text-lg shrink-0">
                    {getInitials(alunoDetalhes.profiles?.nome || alunoDetalhes.leads?.nome_completo || "?")}
                  </div>
                  <div>
                    <SheetTitle className="text-foreground">{alunoDetalhes.profiles?.nome || alunoDetalhes.leads?.nome_completo}</SheetTitle>
                    <SheetDescription className="text-xs">{alunoDetalhes.fase_atual} • <span className="text-emerald-400 font-bold">{alunoDetalhes.pontuacao_total} XP</span></SheetDescription>
                  </div>
                </div>
              </SheetHeader>
              {pendentesAprovacao.length > 0 && (
                <div className="px-6 py-3 bg-primary/10 border-b border-primary/20 shrink-0">
                  <p className="text-xs text-primary font-bold flex items-center gap-1.5">
                    <Clock size={12} /> {pendentesAprovacao.length} entrega(s) aguardando validação
                  </p>
                </div>
              )}
              <div className="flex-1 px-6 py-5 overflow-y-auto space-y-6">
                {/* Ações rápidas */}
                <div className="space-y-2">
                  <Button size="sm" variant="outline" className="w-full gap-2 border-primary/30 text-primary hover:bg-primary/10"
                    onClick={() => { setNovaTarefa(p => ({ ...p, aluno_id: alunoDetalhes.id })); setOpenCriarTarefa(true); }}>
                    <PlusCircle size={14} /> Atribuir Nova Tarefa a Este Aluno
                  </Button>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline"
                      className="flex-1 gap-1.5 border-border text-muted-foreground hover:text-foreground"
                      onClick={handleResetarSenha}
                      disabled={resetandoSenha || !alunoDetalhes?.profiles?.email}>
                      {resetandoSenha ? <Loader2 size={13} className="animate-spin" /> : <KeyRound size={13} />}
                      Resetar Senha
                    </Button>
                    <Button size="sm" variant="outline"
                      className={cn("flex-1 gap-1.5 transition-colors",
                        confirmDelete
                          ? "border-destructive text-destructive hover:bg-destructive/10"
                          : "border-border text-muted-foreground hover:text-destructive hover:border-destructive/50"
                      )}
                      onClick={handleExcluirAluno}
                      disabled={excluindo}>
                      {excluindo ? <Loader2 size={13} className="animate-spin" /> : <UserMinus size={13} />}
                      {confirmDelete ? "Confirmar exclusão" : "Excluir Aluno"}
                    </Button>
                  </div>
                </div>

                {loadingTarefas ? (
                  <div className="flex justify-center py-10"><Loader2 className="animate-spin text-primary" size={24} /></div>
                ) : tarefasDetalhe.length === 0 ? (
                  <p className="text-center py-10 text-muted-foreground text-sm">Nenhuma tarefa alocada ainda.</p>
                ) : (
                  sprintsComTarefas.map(sprint => (
                    <div key={sprint.id}>
                      <h4 className="text-xs uppercase tracking-widest text-muted-foreground/60 font-bold mb-3">{sprint.titulo}</h4>
                      <div className="space-y-2">
                        {sprint.tarefas.map((tarefa: any) => (
                          <div key={tarefa.id} className={cn("p-4 rounded-xl border transition-colors",
                            tarefa.aprovada_por_equipe ? "bg-emerald-500/5 border-emerald-500/20"
                            : tarefa.concluida ? "bg-primary/5 border-primary/20"
                            : "bg-zinc-900/40 border-border/30")}>
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-3 flex-1 min-w-0">
                                {tarefa.aprovada_por_equipe ? <CheckCircle2 size={16} className="text-emerald-500 mt-0.5 shrink-0" />
                                : tarefa.concluida ? <Clock size={16} className="text-primary mt-0.5 shrink-0" />
                                : <div className="w-4 h-4 rounded-full border-2 border-border mt-0.5 shrink-0" />}
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-foreground">{tarefa.titulo}</p>
                                  <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                                    <Star size={9} className="text-emerald-400" /> {tarefa.xp_recompensa} XP
                                    {tarefa.prazo && <span className="ml-1">• {new Date(tarefa.prazo).toLocaleDateString("pt-BR")}</span>}
                                  </p>
                                </div>
                              </div>
                              {tarefa.concluida && !tarefa.aprovada_por_equipe && (
                                <div className="flex items-center gap-2 shrink-0">
                                  <button onClick={() => handleAprovar(tarefa.id, alunoDetalhes.id, tarefa.xp_recompensa)} disabled={aprovando === tarefa.id}
                                    className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 disabled:opacity-50">
                                    {aprovando === tarefa.id ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />} Aprovar
                                  </button>
                                  <button onClick={() => handleRejeitar(tarefa.id)} disabled={aprovando === tarefa.id}
                                    className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 disabled:opacity-50">
                                    <XCircle size={11} /> Devolver
                                  </button>
                                </div>
                              )}
                              {tarefa.aprovada_por_equipe && <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-wide shrink-0">Aprovado</span>}
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

      {/* ══ DIALOG: Matrícula ══════════════════════════════════════════════════ */}
      <Dialog open={openMatricula} onOpenChange={setOpenMatricula}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><GraduationCap className="text-emerald-500" />
              {targetLead ? `Matricular: ${targetLead.nome_completo}` : "Matricular Aluno"}
            </DialogTitle>
            <DialogDescription>Cria acesso ao Portal do Aluno.</DialogDescription>
          </DialogHeader>
          {!targetLead ? (
            <div className="space-y-3">
              {leadsFechados.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">Nenhum lead fechado pendente.</p>
              : leadsFechados.map(lead => (
                <button key={lead.id} onClick={() => setTargetLead(lead)} className="w-full text-left p-3 rounded-lg border border-border/40 hover:border-primary/40 hover:bg-primary/5 transition-all">
                  <p className="font-semibold text-sm text-foreground">{lead.nome_completo}</p>
                  <p className="text-xs text-muted-foreground">{lead.email || "Sem e-mail"}</p>
                </button>
              ))}
            </div>
          ) : (
            <form onSubmit={handleMatricular} className="space-y-4">
              <div><Label className="text-xs text-muted-foreground uppercase mb-2 block">E-mail</Label>
                <div className="px-3 py-2 bg-secondary/50 rounded-md text-sm opacity-70">{targetLead.email || "—"}</div>
              </div>
              <div><Label className="text-xs text-muted-foreground uppercase mb-2 block">Senha Inicial</Label>
                <Input type="password" value={senhaAluno} onChange={e => setSenhaAluno(e.target.value)} className="bg-zinc-900 border-border h-11" placeholder="Mínimo 6 caracteres" required />
              </div>
              <Button type="submit" disabled={matriculando || !targetLead.email} className="w-full h-11 bg-emerald-500 hover:bg-emerald-600 text-white font-bold">
                {matriculando ? <Loader2 size={16} className="animate-spin" /> : "Confirmar e Criar Acesso"}
              </Button>
              {!targetLead.email && <p className="text-xs text-destructive text-center">Edite o e-mail no lead primeiro.</p>}
              <button type="button" onClick={() => setTargetLead(null)} className="w-full text-xs text-muted-foreground hover:text-foreground">← Escolher outro lead</button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ══ DIALOG: Criar Sprint ══════════════════════════════════════════════ */}
      <Dialog open={openCriarSprint} onOpenChange={setOpenCriarSprint}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Layers className="text-primary" size={18} /> Criar Sprint</DialogTitle>
            <DialogDescription>Módulo de execução da mentoria.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCriarSprint} className="space-y-4">
            <div><Label className="text-xs text-muted-foreground uppercase mb-2 block">Título *</Label>
              <Input value={novoSprint.titulo} onChange={e => setNovoSprint(p => ({ ...p, titulo: e.target.value }))} className="bg-zinc-900 border-border" placeholder="Ex: Sprint 1 — Diagnóstico & Base" required />
            </div>
            <div><Label className="text-xs text-muted-foreground uppercase mb-2 block">Descrição</Label>
              <Textarea value={novoSprint.descricao} onChange={e => setNovoSprint(p => ({ ...p, descricao: e.target.value }))} className="bg-zinc-900 border-border resize-none" rows={2} />
            </div>
            <Button type="submit" disabled={savingSprint} className="w-full h-11 font-bold">
              {savingSprint ? <Loader2 size={16} className="animate-spin" /> : "Criar Sprint"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ══ DIALOG: Criar Tarefa ══════════════════════════════════════════════ */}
      <Dialog open={openCriarTarefa} onOpenChange={setOpenCriarTarefa}>
        <DialogContent className="bg-card border-border sm:max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Star className="text-primary" size={18} /> Atribuir Tarefa</DialogTitle>
            <DialogDescription>Cria uma meta em um Sprint para um ou todos os alunos.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCriarTarefa} className="space-y-4">
            <div><Label className="text-xs text-muted-foreground uppercase mb-2 block">Sprint *</Label>
              <Select value={novaTarefa.sprint_id} onValueChange={v => setNovaTarefa(p => ({ ...p, sprint_id: v }))}>
                <SelectTrigger className="bg-zinc-900 border-border"><SelectValue placeholder="Selecione o sprint" /></SelectTrigger>
                <SelectContent>{sprints.map(s => <SelectItem key={s.id} value={s.id}>{s.titulo}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs text-muted-foreground uppercase mb-2 block">Aluno</Label>
              <Select value={novaTarefa.aluno_id} onValueChange={v => setNovaTarefa(p => ({ ...p, aluno_id: v }))}>
                <SelectTrigger className="bg-zinc-900 border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__todos__">Todos os Alunos</SelectItem>
                  {alunos.map(a => <SelectItem key={a.id} value={a.id}>{a.profiles?.nome || a.leads?.nome_completo}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs text-muted-foreground uppercase mb-2 block">Título da Tarefa *</Label>
              <Input value={novaTarefa.titulo} onChange={e => setNovaTarefa(p => ({ ...p, titulo: e.target.value }))} className="bg-zinc-900 border-border" placeholder="Ex: Criar calendário editorial do mês" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs text-muted-foreground uppercase mb-2 block">XP de Recompensa</Label>
                <Input type="number" min={1} max={500} value={novaTarefa.xp_recompensa} onChange={e => setNovaTarefa(p => ({ ...p, xp_recompensa: Number(e.target.value) }))} className="bg-zinc-900 border-border" />
              </div>
              <div><Label className="text-xs text-muted-foreground uppercase mb-2 block">Prazo (opcional)</Label>
                <Input type="date" value={novaTarefa.prazo} onChange={e => setNovaTarefa(p => ({ ...p, prazo: e.target.value }))} className="bg-zinc-900 border-border" />
              </div>
            </div>
            <Button type="submit" disabled={savingTarefa || !novaTarefa.sprint_id} className="w-full h-11 font-bold">
              {savingTarefa ? <Loader2 size={16} className="animate-spin" /> : "Criar Tarefa"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ══ DIALOG: Criar Evento ══════════════════════════════════════════════ */}
      <Dialog open={openCriarEvento} onOpenChange={setOpenCriarEvento}>
        <DialogContent className="bg-card border-border sm:max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Calendar className="text-primary" size={18} /> Criar Evento / Reunião</DialogTitle>
            <DialogDescription>Aparece no painel do aluno com destaque.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCriarEvento} className="space-y-4">
            <div><Label className="text-xs text-muted-foreground uppercase mb-2 block">Título *</Label>
              <Input value={novoEvento.titulo} onChange={e => setNovoEvento(p => ({ ...p, titulo: e.target.value }))} className="bg-zinc-900 border-border" placeholder="Ex: Reunião Mensal Sprint 3" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs text-muted-foreground uppercase mb-2 block">Tipo</Label>
                <Select value={novoEvento.tipo} onValueChange={v => setNovoEvento(p => ({ ...p, tipo: v as TipoEvento }))}>
                  <SelectTrigger className="bg-zinc-900 border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="reuniao">Reunião</SelectItem>
                    <SelectItem value="aula">Aula</SelectItem>
                    <SelectItem value="checkpoint">Checkpoint</SelectItem>
                    <SelectItem value="evento">Evento</SelectItem>
                    <SelectItem value="entrega">Entrega</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs text-muted-foreground uppercase mb-2 block">Data & Hora *</Label>
                <Input type="datetime-local" value={novoEvento.data_hora} onChange={e => setNovoEvento(p => ({ ...p, data_hora: e.target.value }))} className="bg-zinc-900 border-border" required />
              </div>
            </div>
            <div><Label className="text-xs text-muted-foreground uppercase mb-2 block">Visibilidade</Label>
              <Select value={novoEvento.aluno_id} onValueChange={v => setNovoEvento(p => ({ ...p, aluno_id: v }))}>
                <SelectTrigger className="bg-zinc-900 border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__todos__">Todos os Alunos</SelectItem>
                  {alunos.map(a => <SelectItem key={a.id} value={a.id}>{a.profiles?.nome || a.leads?.nome_completo}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs text-muted-foreground uppercase mb-2 block">Descrição / Link (opcional)</Label>
              <Textarea value={novoEvento.descricao} onChange={e => setNovoEvento(p => ({ ...p, descricao: e.target.value }))} className="bg-zinc-900 border-border resize-none" rows={2} placeholder="Link da reunião, instruções..." />
            </div>
            <Button type="submit" disabled={savingEvento || !novoEvento.data_hora} className="w-full h-11 font-bold">
              {savingEvento ? <Loader2 size={16} className="animate-spin" /> : "Salvar Evento"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ══ DIALOG: Adicionar Material ════════════════════════════════════════ */}
      <Dialog open={openAddMaterial} onOpenChange={setOpenAddMaterial}>
        <DialogContent className="bg-card border-border sm:max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><PlusCircle className="text-primary" size={18} /> Adicionar Material</DialogTitle>
            <DialogDescription>Globais ficam visíveis para todos os alunos.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSalvarMaterial} className="space-y-4">
            <div><Label className="text-xs text-muted-foreground uppercase mb-2 block">Título *</Label>
              <Input value={novoMaterial.titulo} onChange={e => setNovoMaterial(p => ({ ...p, titulo: e.target.value }))} className="bg-zinc-900 border-border" placeholder="Ex: Aula 01 — Fundamentos" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs text-muted-foreground uppercase mb-2 block">Tipo *</Label>
                <Select value={novoMaterial.tipo} onValueChange={v => setNovoMaterial(p => ({ ...p, tipo: v as TipoMaterial }))}>
                  <SelectTrigger className="bg-zinc-900 border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="video">Vídeo</SelectItem>
                    <SelectItem value="pdf">PDF</SelectItem>
                    <SelectItem value="documento">Documento</SelectItem>
                    <SelectItem value="link">Link</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs text-muted-foreground uppercase mb-2 block">Visibilidade</Label>
                <Select value={novoMaterial.aluno_id} onValueChange={v => setNovoMaterial(p => ({ ...p, aluno_id: v }))}>
                  <SelectTrigger className="bg-zinc-900 border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__global__">Todos os Alunos</SelectItem>
                    {alunos.map(a => <SelectItem key={a.id} value={a.id}>{a.profiles?.nome || a.leads?.nome_completo}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label className="text-xs text-muted-foreground uppercase mb-2 block">URL *</Label>
              <Input value={novoMaterial.url} onChange={e => setNovoMaterial(p => ({ ...p, url: e.target.value }))} className="bg-zinc-900 border-border" placeholder="https://..." type="url" required />
            </div>
            <div><Label className="text-xs text-muted-foreground uppercase mb-2 block">Descrição</Label>
              <Textarea value={novoMaterial.descricao} onChange={e => setNovoMaterial(p => ({ ...p, descricao: e.target.value }))} className="bg-zinc-900 border-border resize-none" rows={2} />
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
