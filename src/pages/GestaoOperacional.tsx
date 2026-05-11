import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  fetchAlunos, fetchLeads, fetchSprintTarefas, fetchSprints, fetchSprintsForAluno,
  aprovarTarefa, rejeitarTarefa,
  fetchTodosMateriais, createMaterial, deleteMaterial,
  fetchTodosEventos, createEvento, deleteEvento,
  createSprint, deleteSprint, createSprintTarefa, deleteSprintTarefa,
  resetUserPasswordAdmin, uploadMaterialFile, updateAluno, updateSprintTarefa,
  fetchTodasSprintTarefas, fetchProfiles, renamePasta, deletePasta,
} from "@/lib/api";
import type { Material, Evento } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import {
  Users, Award, PlusCircle, GraduationCap, Loader2,
  CheckCircle2, XCircle, Clock, BookOpen, Video,
  FileText, Link2, Trash2, Globe, UserCheck, ChevronRight,
  Star, Calendar, Zap, Layers, LayoutTemplate,
  MapPin, KeyRound, UserMinus, ExternalLink, Pencil,
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
  pdf:       { icon: <FileText size={14} />, label: "PDF",       color: "text-primary" },
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
  const [todasTarefas, setTodasTarefas] = useState<any[]>([]);
  const [profiles,     setProfiles]     = useState<any[]>([]);
  const [loading,      setLoading]      = useState(true);

  const [activeTab, setActiveTab] = useState<ActiveTab>("alunos");

  // ── detalhe aluno ─────────────────────────────────────────────────────────
  const [alunoDetalhes,   setAlunoDetalhes]   = useState<any | null>(null);
  const [tarefasDetalhe,  setTarefasDetalhe]  = useState<any[]>([]);
  const [loadingTarefas,  setLoadingTarefas]  = useState(false);
  const [aprovando,       setAprovando]       = useState<string | null>(null);
  const [sheetTab,        setSheetTab]        = useState<"tarefas" | "eventos" | "biblioteca" | "premio">("tarefas");
  const [premioEdit,      setPremioEdit]      = useState({ titulo: "", descricao: "", xp_meta: 1000 });
  const [savingPremio,    setSavingPremio]    = useState(false);
  const [sprintsAluno,    setSprintsAluno]    = useState<any[]>([]);
  const [tarefaXpEdit,    setTarefaXpEdit]    = useState<Record<string, number>>({});

  // ── matrícula ─────────────────────────────────────────────────────────────
  const [openMatricula, setOpenMatricula] = useState(false);
  const [targetLead,    setTargetLead]    = useState<any | null>(null);
  const [senhaAluno,    setSenhaAluno]    = useState("");
  const [matriculando,  setMatriculando]  = useState(false);

  // ── aluno: excluir / resetar senha ───────────────────────────────────────
  const [excluindo,       setExcluindo]       = useState(false);
  const [resetandoSenha,  setResetandoSenha]  = useState(false);
  const [confirmDelete,   setConfirmDelete]   = useState(false);
  const [openResetSenha,  setOpenResetSenha]  = useState(false);
  const [novaSenhaAdmin,  setNovaSenhaAdmin]  = useState("");

  // ── sprint + tarefa ───────────────────────────────────────────────────────
  const [openCriarSprint,  setOpenCriarSprint]  = useState(false);
  const [openCriarTarefa,  setOpenCriarTarefa]  = useState(false);
  const [savingSprint,     setSavingSprint]     = useState(false);
  const [savingTarefa,     setSavingTarefa]     = useState(false);
  const [importandoParaAluno, setImportandoParaAluno] = useState<string | null>(null);
  const [novoSprint, setNovoSprint] = useState({ titulo: "", descricao: "", aluno_id: null as string | null });
  const [novaTarefa, setNovaTarefa] = useState({
    sprint_id: "", aluno_id: "", titulo: "", xp_recompensa: 50, prazo: "", responsavel_id: "",
  });
  const [sprintsParaTarefa, setSprintsParaTarefa] = useState<any[]>([]);

  // ── biblioteca: pastas ────────────────────────────────────────────────────
  const [openNovaPastaDialog, setOpenNovaPastaDialog] = useState(false);
  const [novaPastaInput, setNovaPastaInput] = useState("");
  const [pastasLocais, setPastasLocais] = useState<string[]>([]);
  const [pastaEditando, setPastaEditando] = useState<string | null>(null);
  const [pastaNovoNome, setPastaNovoNome] = useState("");
  const [pastaDeletando, setPastaDeletando] = useState<string | null>(null);

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
    aluno_id: "__global__", sprint_id: "__none__", pasta: "",
  });
  const [novaPasta, setNovaPasta] = useState("");
  const [savingMaterial,   setSavingMaterial]   = useState(false);
  const [deletingMaterial, setDeletingMaterial] = useState<string | null>(null);
  const [deletingEvento,   setDeletingEvento]   = useState<string | null>(null);
  const [materialMode,     setMaterialMode]     = useState<"link" | "upload">("link");

  // ── fase inline edit ──────────────────────────────────────────────────────
  const [editandoFase,  setEditandoFase]  = useState<string | null>(null);
  const [novaFaseTexto, setNovaFaseTexto] = useState("");
  const [materialFile,     setMaterialFile]     = useState<File | null>(null);

  // ── carga ─────────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    // Promise.allSettled garante que leads/alunos carregam mesmo se tabelas novas ainda não existirem
    const [alunosRes, leadsRes, materiaisRes, sprintsRes, eventosRes, tarefasRes, profilesRes] = await Promise.allSettled([
      fetchAlunos(), fetchLeads(), fetchTodosMateriais(), fetchSprints(), fetchTodosEventos(), fetchTodasSprintTarefas(), fetchProfiles(),
    ]);
    const listaAlunos = alunosRes.status === "fulfilled" ? (alunosRes.value || []) : [];
    const listaLeads  = leadsRes.status  === "fulfilled" ? (leadsRes.value  || []) : [];
    setAlunos(listaAlunos);
    setLeadsFechados(listaLeads.filter(
      l => ["fechado", "vendido"].includes(l.status_pipeline) && !listaAlunos.some((a: any) => a.lead_id === l.id),
    ));
    if (materiaisRes.status === "fulfilled") setMateriais((materiaisRes.value || []) as Material[]);
    if (sprintsRes.status  === "fulfilled") setSprints(sprintsRes.value || []);
    if (eventosRes.status  === "fulfilled") setEventos((eventosRes.value || []) as Evento[]);
    if (tarefasRes.status  === "fulfilled") setTodasTarefas(tarefasRes.value || []);
    if (profilesRes.status === "fulfilled") setProfiles((profilesRes.value || []).filter((p: any) => p.perfil !== 'aluno'));
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── detalhe aluno ─────────────────────────────────────────────────────────
  async function abrirDetalhe(aluno: any) {
    setAlunoDetalhes(aluno);
    setSheetTab("tarefas");
    setSprintsAluno([]);
    setPremioEdit({
      titulo: aluno.premio_titulo ?? "",
      descricao: aluno.premio_descricao ?? "",
      xp_meta: aluno.premio_xp_meta ?? 1000,
    });
    setLoadingTarefas(true);
    try {
      const [tarefas, spAluno] = await Promise.all([
        fetchSprintTarefas(aluno.id),
        fetchSprintsForAluno(aluno.id),
      ]);
      setTarefasDetalhe(tarefas || []);
      setSprintsAluno(spAluno || []);
      const xpInit: Record<string, number> = {};
      for (const t of (tarefas || [])) xpInit[t.id] = t.xp_recompensa ?? 100;
      setTarefaXpEdit(xpInit);
    }
    finally { setLoadingTarefas(false); }
  }

  async function handleSalvarPremio(e: React.FormEvent) {
    e.preventDefault();
    if (!alunoDetalhes) return;
    setSavingPremio(true);
    try {
      const updated = await updateAluno(alunoDetalhes.id, {
        premio_titulo: premioEdit.titulo || null,
        premio_descricao: premioEdit.descricao || null,
        premio_xp_meta: premioEdit.xp_meta || 1000,
      });
      setAlunoDetalhes((prev: any) => ({ ...prev, ...updated }));
      setAlunos(prev => prev.map(a => a.id === alunoDetalhes.id ? { ...a, ...updated } : a));
      toast({ title: "Prêmio atualizado!" });
    } catch (err: any) {
      toast({ title: "Erro ao salvar prêmio.", description: "Execute a migração SQL no Supabase primeiro.", variant: "destructive" });
    } finally { setSavingPremio(false); }
  }

  async function handleAprovar(tarefaId: string, alunoId: string, xp: number) {
    setAprovando(tarefaId);
    try {
      await aprovarTarefa(tarefaId, alunoId, xp);
      setTarefasDetalhe(prev => prev.map(t => t.id === tarefaId ? { ...t, aprovada_por_equipe: true, concluida: true } : t));
      setTodasTarefas(prev => prev.map(t => t.id === tarefaId ? { ...t, aprovada_por_equipe: true, concluida: true } : t));
      setAlunos(prev => prev.map(a => a.id === alunoId ? { ...a, pontuacao_total: (a.pontuacao_total || 0) + xp } : a));
      toast({ title: `+${xp} XP concedidos!` });
    } catch { toast({ title: "Erro ao aprovar.", variant: "destructive" }); }
    finally { setAprovando(null); }
  }

  async function handleConcluirAdmin(tarefaId: string, alunoId: string, xp: number) {
    setAprovando(tarefaId);
    try {
      await aprovarTarefa(tarefaId, alunoId, xp);
      setTarefasDetalhe(prev => prev.map(t => t.id === tarefaId ? { ...t, aprovada_por_equipe: true, concluida: true } : t));
      setTodasTarefas(prev => prev.map(t => t.id === tarefaId ? { ...t, aprovada_por_equipe: true, concluida: true } : t));
      setAlunos(prev => prev.map(a => a.id === alunoId ? { ...a, pontuacao_total: (a.pontuacao_total || 0) + xp } : a));
      toast({ title: `Tarefa concluída e +${xp} XP concedidos!` });
    } catch { toast({ title: "Erro ao concluir.", variant: "destructive" }); }
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
      const emailTrimmed = targetLead.email.trim();

      // ── Passo 1: Verificar se já existe profile com este e-mail ─────────
      // Fazemos isso ANTES de chamar signUp para evitar o rate limit do Supabase
      // que ocorre quando tentamos criar o mesmo e-mail múltiplas vezes.
      const { data: existingProfile, error: checkErr } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", emailTrimmed)
        .maybeSingle();
      if (checkErr) throw new Error(`Erro ao verificar perfil: ${checkErr.message}`);

      let pid: string | undefined = existingProfile?.id;

      // ── Passo 2: Se não existe, criar usuário no Auth ───────────────────
      // Só chama signUp quando o e-mail não está cadastrado, evitando rate limit.
      if (!pid) {
        const { data: signUpData, error: sErr } = await adminAuthClient.auth.signUp({
          email: emailTrimmed,
          password: senhaAluno,
          options: { data: { nome: targetLead.nome_completo, perfil: "aluno" } },
        });
        if (sErr) throw sErr;
        pid = signUpData?.user?.id;
        if (!pid) throw new Error("Não foi possível criar o acesso. Verifique se o e-mail é válido e tente novamente.");
      }

      // ── Passo 3: Confirmar e-mail via RPC ──────────────────────────────
      const { error: rpcError } = await (supabase as any).rpc("confirm_user_signup", { user_id: pid });
      if (rpcError) console.warn("[handleMatricular] confirm_user_signup:", rpcError);

      // ── Passo 4: Garantir que o profile existe e está correto ───────────
      // O trigger handle_new_user já cria o profile no signUp; o upsert
      // aqui serve para garantir nome/perfil corretos caso o perfil já exista.
      // IMPORTANTE: requer a policy "Admin can update any profile" no Supabase
      // (migration 20260401000001). Sem ela o UPDATE path do upsert falha.
      const { error: profUpsertErr } = await (supabase as any).from("profiles").upsert(
        { id: pid, nome: targetLead.nome_completo, email: emailTrimmed, perfil: "aluno", ativo: true },
        { onConflict: "id" },
      );
      if (profUpsertErr) {
        // Falha não-fatal: o profile pode já existir com os dados certos.
        // Registramos mas não abortamos a matrícula.
        console.warn("[handleMatricular] profiles upsert:", profUpsertErr.message);
      }

      // ── Passo 5: Inserir (ou reconciliar) registro em alunos ───────────
      // Usa upsert no profile_id para tolerar re-tentativas de matrícula.
      // Se já existir um aluno para este profile_id, não duplica.
      const { error: alErr } = await (supabase as any).from("alunos").upsert(
        { lead_id: targetLead.id, profile_id: pid, fase_atual: "Onboarding", pontuacao_total: 0 },
        { onConflict: "profile_id", ignoreDuplicates: false },
      );
      if (alErr) throw new Error(`Erro ao criar registro do aluno: ${alErr.message}`);

      toast({ title: "Aluno matriculado!", description: `Acesso criado para ${emailTrimmed}` });
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

  // ── aluno: resetar senha ──────────────────────────────────────────────────
  async function handleResetarSenha(e: React.FormEvent) {
    e.preventDefault();
    if (!alunoDetalhes?.profile_id || novaSenhaAdmin.length < 6) {
      toast({ title: "A senha deve ter pelo menos 6 caracteres.", variant: "destructive" });
      return;
    }
    setResetandoSenha(true);
    try {
      await resetUserPasswordAdmin(alunoDetalhes.profile_id, novaSenhaAdmin);
      toast({ title: "Senha alterada com sucesso!", description: "O aluno já pode fazer login com a nova senha." });
      setOpenResetSenha(false);
      setNovaSenhaAdmin("");
    } catch (err: any) {
      toast({ title: "Erro ao alterar senha", description: err.message, variant: "destructive" });
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

  // ── tarefa: abrir dialog (carrega sprints do aluno selecionado) ──────────
  async function abrirDialogTarefa(alunoIdPreSelecionado?: string) {
    const alunoId = alunoIdPreSelecionado ?? "";
    setNovaTarefa(p => ({ ...p, aluno_id: alunoId, sprint_id: "" }));
    if (alunoId) {
      const data = await fetchSprintsForAluno(alunoId);
      setSprintsParaTarefa(data || []);
    } else {
      setSprintsParaTarefa([]);
    }
    setOpenCriarTarefa(true);
  }

  async function handleAlterarAlunoTarefa(alunoId: string) {
    setNovaTarefa(p => ({ ...p, aluno_id: alunoId, sprint_id: "" }));
    const data = alunoId ? await fetchSprintsForAluno(alunoId) : [];
    setSprintsParaTarefa(data || []);
  }

  // ── sprints ───────────────────────────────────────────────────────────────
  async function handleCriarSprint(e: React.FormEvent) {
    e.preventDefault();
    if (!novoSprint.titulo || !novoSprint.aluno_id) {
      toast({ title: "Selecione um aluno para o sprint.", variant: "destructive" });
      return;
    }
    setSavingSprint(true);
    try {
      const existentes = await fetchSprintsForAluno(novoSprint.aluno_id);
      const ordem = existentes.length + 1;
      const novo = await createSprint(novoSprint.titulo, novoSprint.descricao || undefined, ordem, novoSprint.aluno_id);
      if (alunoDetalhes?.id === novoSprint.aluno_id) {
        setSprintsAluno(prev => [...prev, novo]);
      }
      toast({ title: "Sprint criado!" });
      setOpenCriarSprint(false);
      setNovoSprint({ titulo: "", descricao: "", aluno_id: null });
    } catch { toast({ title: "Erro ao criar sprint.", variant: "destructive" }); }
    finally { setSavingSprint(false); }
  }

  async function handleImportarTemplate(aluno_id: string) {
    setImportandoParaAluno(aluno_id);
    try {
      const existentes = await fetchSprintsForAluno(aluno_id);
      let created = 0;
      for (const s of TEMPLATE_SPRINTS) {
        const exists = existentes.some((x: any) => x.titulo === s.titulo);
        if (!exists) { await createSprint(s.titulo, s.descricao, s.ordem, aluno_id); created++; }
      }
      if (alunoDetalhes?.id === aluno_id) {
        const fresh = await fetchSprintsForAluno(aluno_id);
        setSprintsAluno(fresh || []);
      }
      toast({ title: `${created} sprint(s) importados!`, description: created === 0 ? "Todos já existiam." : undefined });
    } catch { toast({ title: "Erro ao importar.", variant: "destructive" }); }
    finally { setImportandoParaAluno(null); }
  }

  async function handleCriarTarefa(e: React.FormEvent) {
    e.preventDefault();
    if (!novaTarefa.sprint_id || !novaTarefa.titulo || !novaTarefa.aluno_id) return;
    setSavingTarefa(true);
    try {
      await createSprintTarefa({
        sprint_id: novaTarefa.sprint_id,
        aluno_id: novaTarefa.aluno_id,
        titulo: novaTarefa.titulo,
        xp_recompensa: novaTarefa.xp_recompensa,
        prazo: novaTarefa.prazo || undefined,
        responsavel_id: novaTarefa.responsavel_id || null,
      });
      toast({ title: "Tarefa criada!" });
      setOpenCriarTarefa(false);
      setNovaTarefa({ sprint_id: "", aluno_id: "", titulo: "", xp_recompensa: 50, prazo: "", responsavel_id: "" });
    } catch { toast({ title: "Erro ao criar tarefa.", variant: "destructive" }); }
    finally { setSavingTarefa(false); }
  }

  async function handleDeletarSprint(id: string) {
    try {
      await deleteSprint(id);
      setSprintsAluno(prev => prev.filter(s => s.id !== id));
      toast({ title: "Sprint removido." });
    }
    catch { toast({ title: "Erro ao remover.", variant: "destructive" }); }
  }

  function handleCriarPastaLocal() {
    const nome = novaPastaInput.trim();
    if (!nome) return;
    if (!pastasLocais.includes(nome)) setPastasLocais(prev => [...prev, nome]);
    setNovoMaterial(p => ({ ...p, pasta: nome }));
    setNovaPasta(nome);
    setOpenNovaPastaDialog(false);
    setNovaPastaInput("");
    setOpenAddMaterial(true);
  }

  async function handleRenomearPasta(oldName: string, newName: string) {
    const trimmed = newName.trim();
    setPastaEditando(null);
    if (!trimmed || trimmed === oldName) return;
    try {
      await renamePasta(oldName, trimmed);
      setMateriais(prev => prev.map(m => (m as any).pasta === oldName ? { ...m, pasta: trimmed } as any : m));
      setPastasLocais(prev => prev.map(p => p === oldName ? trimmed : p));
      toast({ title: `Pasta renomeada para "${trimmed}"` });
    } catch {
      toast({ title: "Erro ao renomear pasta.", variant: "destructive" });
    }
  }

  async function handleDeletarPasta(name: string) {
    if (pastaDeletando !== name) { setPastaDeletando(name); return; }
    setPastaDeletando(null);
    try {
      await deletePasta(name);
      setMateriais(prev => prev.map(m => (m as any).pasta === name ? { ...m, pasta: null } as any : m));
      setPastasLocais(prev => prev.filter(p => p !== name));
      toast({ title: `Pasta "${name}" removida. Materiais movidos para Sem pasta.` });
    } catch {
      toast({ title: "Erro ao remover pasta.", variant: "destructive" });
    }
  }

  // ── fase ─────────────────────────────────────────────────────────────────
  async function handleSalvarFase(alunoId: string, fase: string) {
    const trimmed = fase.trim();
    setEditandoFase(null);
    if (!trimmed) return;
    const prev = alunos.find(a => a.id === alunoId)?.fase_atual;
    if (trimmed === prev) return;
    try {
      await updateAluno(alunoId, { fase_atual: trimmed });
      setAlunos(p => p.map(a => a.id === alunoId ? { ...a, fase_atual: trimmed } : a));
      if (alunoDetalhes?.id === alunoId) setAlunoDetalhes((p: any) => p ? { ...p, fase_atual: trimmed } : p);
    } catch { toast({ title: "Erro ao salvar fase.", variant: "destructive" }); }
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
    setDeletingEvento(id);
    try { await deleteEvento(id); setEventos(prev => prev.filter(e => e.id !== id)); toast({ title: "Evento removido." }); }
    catch { toast({ title: "Erro.", variant: "destructive" }); }
    finally { setDeletingEvento(null); }
  }

  // ── materiais ─────────────────────────────────────────────────────────────
  async function handleSalvarMaterial(e: React.FormEvent) {
    e.preventDefault();
    if (!novoMaterial.titulo) return;
    if (materialMode === "link" && !novoMaterial.url) return;
    if (materialMode === "upload" && !materialFile) return;

    setSavingMaterial(true);
    try {
      let finalUrl = novoMaterial.url;
      
      if (materialMode === "upload" && materialFile) {
        finalUrl = await uploadMaterialFile(materialFile);
      }

      const pastaFinal = novoMaterial.pasta === "__nova__"
        ? novaPasta.trim() || null
        : (novoMaterial.pasta && novoMaterial.pasta !== "__sem__" ? novoMaterial.pasta.trim() : null);
      await createMaterial({
        titulo: novoMaterial.titulo, descricao: novoMaterial.descricao || null,
        tipo: novoMaterial.tipo, url: finalUrl,
        aluno_id: novoMaterial.aluno_id === "__global__" ? null : novoMaterial.aluno_id,
        sprint_id: novoMaterial.sprint_id === "__none__" ? null : novoMaterial.sprint_id,
        criado_por: profile?.id ?? null,
        pasta: pastaFinal,
      } as any);
      if (pastaFinal) setPastasLocais(prev => [...new Set([...prev, pastaFinal])]);
      toast({ title: "Material adicionado!" });
      setOpenAddMaterial(false);
      setNovoMaterial({ titulo: "", descricao: "", tipo: "link", url: "", aluno_id: "__global__", sprint_id: "__none__", pasta: "" });
      setNovaPasta("");
      setMaterialMode("link");
      setMaterialFile(null);
      setMateriais((await fetchTodosMateriais() || []) as Material[]);
    } catch (err: any) { 
      toast({ title: "Erro ao salvar material.", description: err.message, variant: "destructive" }); 
    }
    finally { setSavingMaterial(false); }
  }

  async function handleDeletarMaterial(id: string) {
    setDeletingMaterial(id);
    try { await deleteMaterial(id); setMateriais(prev => prev.filter(m => m.id !== id)); toast({ title: "Removido." }); }
    catch { toast({ title: "Erro.", variant: "destructive" }); }
    finally { setDeletingMaterial(null); }
  }

  // ── helpers para sheet ────────────────────────────────────────────────────
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
                  {/* ── Painel de Tarefas em Aberto ─────────────────────── */}
                  {(() => {
                    const tarefasAbertas = todasTarefas.filter(t => !t.aprovada_por_equipe);
                    if (tarefasAbertas.length === 0) return null;
                    return (
                      <section>
                        <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                          <Clock className="text-primary" size={20} /> Tarefas em Aberto
                          <span className="text-xs bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-bold">{tarefasAbertas.length}</span>
                        </h2>
                        <div className="bg-card border border-primary/15 rounded-xl overflow-hidden shadow-sm">
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-primary/10 bg-primary/5">
                                  <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-primary/70">Aluno</th>
                                  <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-primary/70">Tarefa</th>
                                  <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-primary/70">Sprint</th>
                                  <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-primary/70">Responsável</th>
                                  <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-primary/70">Prazo</th>
                                  <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-primary/70">Status</th>
                                  <th className="px-4 py-3" />
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border/50">
                                {tarefasAbertas.map(t => {
                                  const isOverdue = t.prazo && new Date(t.prazo) < new Date();
                                  const alunoNome = t.alunos?.profiles?.nome ?? "—";
                                  const sprintTitulo = t.sprints?.titulo ?? "—";
                                  const responsavelNome = t.responsavel?.nome ?? null;
                                  const linkEntrega = (t as any).link_entrega;
                                  return (
                                    <tr key={t.id} className="hover:bg-primary/5 transition-colors">
                                      <td className="px-4 py-3 text-xs font-semibold text-foreground whitespace-nowrap">{alunoNome}</td>
                                      <td className="px-4 py-3 max-w-[200px]">
                                        <p className="text-xs text-foreground truncate">{t.titulo}</p>
                                        {linkEntrega && (
                                          <a href={linkEntrega} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline flex items-center gap-1 mt-0.5 truncate">
                                            <Link2 size={9} /> Ver entrega
                                          </a>
                                        )}
                                      </td>
                                      <td className="px-4 py-3 text-[11px] text-muted-foreground max-w-[150px] truncate">{sprintTitulo}</td>
                                      <td className="px-4 py-3 whitespace-nowrap">
                                        {responsavelNome ? (
                                          <span className="text-[11px] font-semibold text-primary bg-primary/10 border border-primary/20 px-2.5 py-0.5 rounded-full">{responsavelNome.split(" ")[0]}</span>
                                        ) : (
                                          <span className="text-[11px] text-muted-foreground/40">—</span>
                                        )}
                                      </td>
                                      <td className={cn("px-4 py-3 text-xs whitespace-nowrap font-medium", isOverdue ? "text-red-400" : t.prazo ? "text-foreground" : "text-muted-foreground/50")}>
                                        {t.prazo ? new Date(t.prazo).toLocaleDateString("pt-BR") : "—"}
                                        {isOverdue && <span className="ml-1 text-[9px] bg-red-500/10 text-red-400 border border-red-500/20 px-1 rounded">Atrasado</span>}
                                      </td>
                                      <td className="px-4 py-3">
                                        {t.aprovada_por_equipe ? (
                                          <Badge className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Aprovado</Badge>
                                        ) : t.concluida ? (
                                          <Badge className="text-[10px] bg-primary/10 text-primary border-primary/20">Em revisão</Badge>
                                        ) : (
                                          <Badge variant="outline" className="text-[10px] text-muted-foreground">Pendente</Badge>
                                        )}
                                      </td>
                                      <td className="px-4 py-3 text-right whitespace-nowrap">
                                        {t.concluida && !t.aprovada_por_equipe && (
                                          <button onClick={() => handleAprovar(t.id, t.aluno_id, t.xp_recompensa)} disabled={aprovando === t.id}
                                            className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 disabled:opacity-50 mr-1">
                                            {aprovando === t.id ? <Loader2 size={10} className="animate-spin inline" /> : "Aprovar"}
                                          </button>
                                        )}
                                        {!t.concluida && (
                                          <button onClick={() => handleConcluirAdmin(t.id, t.aluno_id, t.xp_recompensa)} disabled={aprovando === t.id}
                                            className="text-[11px] font-bold px-2.5 py-1 rounded-lg border border-primary/30 text-primary hover:bg-primary/10 transition-colors disabled:opacity-50">
                                            {aprovando === t.id ? <Loader2 size={10} className="animate-spin inline" /> : "Concluir"}
                                          </button>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </section>
                    );
                  })()}

                  <section>
                    <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2"><UserCheck className="text-primary" size={20} /> Alunos Ativos</h2>
                    {alunos.length === 0 ? (
                      <div className="bg-secondary/40 rounded-2xl border border-border p-10 text-center">
                        <Users size={32} className="text-muted-foreground/40 mx-auto mb-3" />
                        <p className="text-muted-foreground text-sm">Nenhum aluno ativo ainda.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {alunos.map(aluno => (
                          <button key={aluno.id} onClick={() => abrirDetalhe(aluno)}
                            className="bg-card border border-border p-5 rounded-xl hover:border-primary/50 hover:shadow-sm text-left group w-full transition-all">
                            <div className="flex items-center gap-4 mb-4">
                              <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center font-bold text-lg text-primary shrink-0">
                                {getInitials(aluno.profiles?.nome || aluno.leads?.nome_completo || "?")}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-foreground truncate">{aluno.profiles?.nome || aluno.leads?.nome_completo}</h3>
                                <p className="text-xs text-muted-foreground truncate">{aluno.leads?.whatsapp || aluno.profiles?.email}</p>
                              </div>
                            </div>
                            <div className="flex justify-between items-center bg-secondary/60 p-3 rounded-lg mb-3">
                              <div>
                                <p className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider mb-0.5">Fase</p>
                                <p className="text-sm font-semibold gold-gradient-text">{aluno.fase_atual}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider mb-0.5 flex items-center gap-1 justify-end"><Award size={9} /> XP</p>
                                <p className="text-sm font-bold text-emerald-600">{aluno.pontuacao_total} pts</p>
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

              {/* ══ SPRINTS POR ALUNO ════════════════════════════════════════ */}
              {activeTab === "sprints" && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-bold text-foreground">Sprints por Aluno</h2>
                      <p className="text-sm text-muted-foreground mt-0.5">Cada aluno tem seus próprios sprints. Gerencie dentro de cada perfil.</p>
                    </div>
                  </div>

                  {alunos.length === 0 ? (
                    <div className="bg-secondary/30 rounded-2xl border border-dashed border-border p-12 text-center">
                      <Users size={32} className="text-muted-foreground/40 mx-auto mb-3" />
                      <p className="text-muted-foreground text-sm">Nenhum aluno matriculado. Matricule primeiro para gerenciar sprints.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                      {alunos.map(aluno => (
                        <div key={aluno.id} className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center font-bold text-primary shrink-0">
                              {getInitials(aluno.profiles?.nome || aluno.leads?.nome_completo || "?")}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-bold text-foreground truncate">{aluno.profiles?.nome || aluno.leads?.nome_completo}</h3>
                              {editandoFase === aluno.id ? (
                                <input
                                  value={novaFaseTexto}
                                  onChange={e => setNovaFaseTexto(e.target.value)}
                                  onBlur={() => handleSalvarFase(aluno.id, novaFaseTexto)}
                                  onKeyDown={e => { if (e.key === 'Enter') handleSalvarFase(aluno.id, novaFaseTexto); if (e.key === 'Escape') setEditandoFase(null); }}
                                  autoFocus
                                  className="text-xs bg-secondary border border-primary/30 rounded px-1.5 py-0.5 outline-none text-foreground w-full mt-0.5"
                                />
                              ) : (
                                <button
                                  onClick={() => { setEditandoFase(aluno.id); setNovaFaseTexto(aluno.fase_atual); }}
                                  className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 group transition-colors mt-0.5"
                                  title="Clique para editar a fase"
                                >
                                  {aluno.fase_atual}
                                  <Pencil size={9} className="opacity-0 group-hover:opacity-60 transition-opacity" />
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col gap-2">
                            <Button size="sm" variant="outline" className="gap-2 w-full border-primary/30 text-primary hover:bg-primary/10"
                              onClick={() => abrirDialogTarefa(aluno.id)}>
                              <Star size={13} /> Nova Tarefa
                            </Button>
                            <Button size="sm" variant="outline" className="gap-2 w-full border-border"
                              onClick={() => { setNovoSprint(p => ({ ...p, aluno_id: aluno.id })); setOpenCriarSprint(true); }}>
                              <Zap size={13} /> Criar Sprint
                            </Button>
                            <Button size="sm" variant="outline" className="gap-2 w-full border-border text-muted-foreground hover:text-foreground"
                              disabled={importandoParaAluno === aluno.id}
                              onClick={() => handleImportarTemplate(aluno.id)}>
                              {importandoParaAluno === aluno.id ? <Loader2 size={13} className="animate-spin" /> : <LayoutTemplate size={13} />}
                              Importar Template 12 Sprints
                            </Button>
                          </div>
                          <button onClick={() => abrirDetalhe(aluno)} className="text-xs text-primary/70 hover:text-primary flex items-center gap-1 justify-end transition-colors">
                            Ver detalhes completos <ChevronRight size={12} />
                          </button>
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
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => setOpenNovaPastaDialog(true)} className="gap-1.5 border-border">
                        <PlusCircle size={13} /> Nova Pasta
                      </Button>
                      <Button size="sm" onClick={() => setOpenAddMaterial(true)} className="gap-1.5"><PlusCircle size={13} /> Adicionar</Button>
                    </div>
                  </div>
                  {materiais.length === 0 ? (
                    <div className="bg-secondary/30 rounded-2xl border border-dashed border-border p-12 text-center">
                      <BookOpen size={32} className="text-muted-foreground/40 mx-auto mb-3" />
                      <p className="text-muted-foreground text-sm">Nenhum material cadastrado.</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {(() => {
                        const pastasDosMateriais = Array.from(new Set(materiais.map(m => (m as any).pasta).filter((p: any) => p && p !== "__nova__" && p !== "__sem__"))) as string[];
                        const todasPastas = Array.from(new Set([...pastasDosMateriais, ...pastasLocais]));
                        const grupos: (string | null)[] = [null, ...todasPastas];
                        return grupos.map(pasta => {
                          const grupo = materiais.filter(m => ((m as any).pasta || null) === pasta);
                          if (grupo.length === 0 && pasta === null) return null;
                          if (grupo.length === 0 && pasta !== null) return (
                            <div key={pasta}>
                              <div className="flex items-center gap-2 mb-3">
                                {pastaEditando === pasta ? (
                                  <input
                                    value={pastaNovoNome}
                                    onChange={e => setPastaNovoNome(e.target.value)}
                                    onBlur={() => handleRenomearPasta(pasta, pastaNovoNome)}
                                    onKeyDown={e => { if (e.key === 'Enter') handleRenomearPasta(pasta, pastaNovoNome); if (e.key === 'Escape') setPastaEditando(null); }}
                                    autoFocus
                                    className="text-xs font-bold bg-secondary border border-primary/30 rounded px-2 py-0.5 outline-none text-foreground uppercase tracking-widest"
                                  />
                                ) : (
                                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">📁 {pasta}</span>
                                )}
                                <div className="flex-1 h-px bg-border" />
                                <span className="text-[10px] text-muted-foreground">0</span>
                                <button onClick={() => { setPastaEditando(pasta); setPastaNovoNome(pasta); setPastaDeletando(null); }} className="text-muted-foreground/40 hover:text-primary transition-colors p-0.5 rounded" title="Renomear pasta"><Pencil size={11} /></button>
                                <button onClick={() => handleDeletarPasta(pasta)} className={cn("transition-colors p-0.5 rounded", pastaDeletando === pasta ? "text-destructive" : "text-muted-foreground/40 hover:text-destructive")} title={pastaDeletando === pasta ? "Clique para confirmar exclusão" : "Excluir pasta"}><Trash2 size={11} /></button>
                              </div>
                              <div className="border border-dashed border-border rounded-xl p-4 text-center">
                                <p className="text-xs text-muted-foreground mb-2">Pasta vazia</p>
                                <Button size="sm" variant="outline" className="gap-1.5 text-xs border-primary/30 text-primary"
                                  onClick={() => { setNovoMaterial(p => ({ ...p, pasta })); setOpenAddMaterial(true); }}>
                                  <PlusCircle size={11} /> Adicionar material
                                </Button>
                              </div>
                            </div>
                          );
                          return (
                            <div key={pasta ?? "__sem__"}>
                              <div className="flex items-center gap-2 mb-3">
                                {pastaEditando === pasta && pasta ? (
                                  <input
                                    value={pastaNovoNome}
                                    onChange={e => setPastaNovoNome(e.target.value)}
                                    onBlur={() => handleRenomearPasta(pasta, pastaNovoNome)}
                                    onKeyDown={e => { if (e.key === 'Enter') handleRenomearPasta(pasta, pastaNovoNome); if (e.key === 'Escape') setPastaEditando(null); }}
                                    autoFocus
                                    className="text-xs font-bold bg-secondary border border-primary/30 rounded px-2 py-0.5 outline-none text-foreground uppercase tracking-widest"
                                  />
                                ) : (
                                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                                    {pasta ? `📁 ${pasta}` : "Sem pasta"}
                                  </span>
                                )}
                                <div className="flex-1 h-px bg-border" />
                                <span className="text-[10px] text-muted-foreground">{grupo.length}</span>
                                {pasta && (
                                  <>
                                    <button onClick={() => { setPastaEditando(pasta); setPastaNovoNome(pasta); setPastaDeletando(null); }} className="text-muted-foreground/40 hover:text-primary transition-colors p-0.5 rounded" title="Renomear pasta"><Pencil size={11} /></button>
                                    <button onClick={() => handleDeletarPasta(pasta)} className={cn("transition-colors p-0.5 rounded", pastaDeletando === pasta ? "text-destructive" : "text-muted-foreground/40 hover:text-destructive")} title={pastaDeletando === pasta ? "Clique para confirmar exclusão" : "Excluir pasta"}><Trash2 size={11} /></button>
                                  </>
                                )}
                              </div>
                              <div className="space-y-2">
                                {grupo.map(m => {
                        const meta = TIPO_MATERIAL_META[m.tipo as TipoMaterial] ?? TIPO_MATERIAL_META.link;
                        const alunoNome = (m as any).alunos?.profiles?.nome;
                        return (
                          <div key={m.id} className="flex items-center gap-4 p-4 bg-card rounded-xl border border-border hover:border-primary/30 transition-colors">
                            <div className={cn("w-9 h-9 rounded-lg bg-secondary flex items-center justify-center shrink-0", meta.color)}>{meta.icon}</div>
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
                            </div>
                          );
                        });
                      })()}
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
        <SheetContent side="right" className="w-full sm:max-w-xl bg-card border-border overflow-y-auto flex flex-col gap-0 p-0">
          {alunoDetalhes && (
            <>
              <SheetHeader className="px-6 py-5 border-b border-border bg-secondary/40 shrink-0">
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
              
              <div className="px-6 border-b border-border shrink-0 flex gap-1 bg-secondary/20 overflow-x-auto">
                <button onClick={() => setSheetTab("tarefas")} className={cn("flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all -mb-px whitespace-nowrap", sheetTab === "tarefas" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
                  <Star size={14} /> Sprints & Tarefas
                </button>
                <button onClick={() => setSheetTab("eventos")} className={cn("flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all -mb-px whitespace-nowrap", sheetTab === "eventos" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
                  <Calendar size={14} /> Eventos
                </button>
                <button onClick={() => setSheetTab("biblioteca")} className={cn("flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all -mb-px whitespace-nowrap", sheetTab === "biblioteca" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
                  <BookOpen size={14} /> Biblioteca
                </button>
                <button onClick={() => setSheetTab("premio")} className={cn("flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all -mb-px whitespace-nowrap", sheetTab === "premio" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
                  <Award size={14} /> Prêmio
                </button>
              </div>

              <div className="flex-1 px-6 py-5 overflow-y-auto space-y-6">
                {/* ── ABA: TAREFAS ────────────────────────────────────────── */}
                {sheetTab === "tarefas" && (
                  <>
                    {pendentesAprovacao.length > 0 && (
                      <div className="p-3 mb-4 rounded-lg bg-primary/10 border border-primary/20">
                        <p className="text-xs text-primary font-bold flex items-center gap-1.5">
                          <Clock size={12} /> {pendentesAprovacao.length} entrega(s) aguardando validação
                        </p>
                      </div>
                    )}
                    
                    <div className="space-y-2">
                      <Button size="sm" variant="outline" className="w-full gap-2 border-primary/30 text-primary hover:bg-primary/10"
                        onClick={() => abrirDialogTarefa(alunoDetalhes.id)}>
                        <PlusCircle size={14} /> Atribuir Nova Tarefa a Este Aluno
                      </Button>
                      <Button size="sm" variant="outline" className="w-full gap-2 border-border text-muted-foreground hover:text-foreground"
                        onClick={() => { setNovoSprint(p => ({ ...p, aluno_id: alunoDetalhes.id })); setOpenCriarSprint(true); }}>
                        <Layers size={14} /> Criar Sprint Exclusivo para Este Aluno
                      </Button>
                      <div className="grid grid-cols-2 gap-2">
                        <Button size="sm" variant="outline" className="col-span-2 gap-1.5 border-primary/20 text-primary hover:bg-primary/5"
                          onClick={() => window.open(`/portal/${alunoDetalhes.id}`, '_blank')}>
                          <ExternalLink size={13} /> Acessar Visão do Aluno
                        </Button>
                        <Button size="sm" variant="outline" className="gap-1.5 border-border text-muted-foreground hover:text-foreground"
                          onClick={() => setOpenResetSenha(true)} disabled={!alunoDetalhes?.profile_id}>
                          <KeyRound size={13} /> Alterar Senha
                        </Button>
                        <Button size="sm" variant="outline"
                          className={cn("gap-1.5 transition-colors", confirmDelete ? "border-destructive text-destructive hover:bg-destructive/10" : "border-border text-muted-foreground hover:text-destructive hover:border-destructive/50")}
                          onClick={handleExcluirAluno} disabled={excluindo}>
                          {excluindo ? <Loader2 size={13} className="animate-spin" /> : <UserMinus size={13} />} {confirmDelete ? "Confirmar exclusão" : "Excluir Aluno"}
                        </Button>
                      </div>
                    </div>

                    {loadingTarefas ? (
                      <div className="flex justify-center py-10"><Loader2 className="animate-spin text-primary" size={24} /></div>
                    ) : sprintsAluno.length === 0 ? (
                      <p className="text-center py-10 text-muted-foreground text-sm">Nenhum sprint criado. Crie um sprint exclusivo para este aluno.</p>
                    ) : (
                      <div className="space-y-5">
                        {sprintsAluno.map(sprint => {
                          const tarefasSprint = tarefasDetalhe.filter(t => t.sprint_id === sprint.id);
                          return (
                            <div key={sprint.id}>
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="text-xs uppercase tracking-widest text-muted-foreground/60 font-bold">{sprint.titulo}</h4>
                                <button onClick={() => handleDeletarSprint(sprint.id)} className="text-muted-foreground/30 hover:text-destructive transition-colors p-1 rounded" title="Remover sprint">
                                  <Trash2 size={12} />
                                </button>
                              </div>
                              {tarefasSprint.length === 0 ? (
                                <p className="text-xs text-muted-foreground/60 pl-1 py-2 italic">Nenhuma tarefa neste sprint ainda.</p>
                              ) : (
                                <div className="space-y-2">
                                  {tarefasSprint.map((tarefa: any) => (
                                    <div key={tarefa.id} className={cn("p-4 rounded-xl border transition-colors",
                                      tarefa.aprovada_por_equipe ? "bg-emerald-500/5 border-emerald-500/20"
                                      : tarefa.concluida ? "bg-primary/5 border-primary/20"
                                      : "bg-secondary/40 border-border")}>
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-start gap-3 flex-1 min-w-0">
                                          {tarefa.aprovada_por_equipe ? <CheckCircle2 size={16} className="text-emerald-500 mt-0.5 shrink-0" />
                                          : tarefa.concluida ? <Clock size={16} className="text-primary mt-0.5 shrink-0" />
                                          : <div className="w-4 h-4 rounded-full border-2 border-border mt-0.5 shrink-0" />}
                                          <div className="min-w-0">
                                            <p className="text-sm font-medium text-foreground">{tarefa.titulo}</p>
                                            <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1 flex-wrap">
                                              <Star size={9} className="text-emerald-400" /> {tarefa.xp_recompensa} XP
                                              {tarefa.prazo && <span className="ml-1">• {new Date(tarefa.prazo).toLocaleDateString("pt-BR")}</span>}
                                              {(tarefa as any).responsavel?.nome && (
                                                <span className="ml-1 text-primary/70">• {(tarefa as any).responsavel.nome.split(" ")[0]}</span>
                                              )}
                                            </p>
                                            {(tarefa as any).link_entrega && (
                                              <a href={(tarefa as any).link_entrega} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline flex items-center gap-1 mt-1">
                                                <ExternalLink size={9} /> Ver entrega
                                              </a>
                                            )}
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
                                        {!tarefa.concluida && (
                                          <button onClick={() => handleConcluirAdmin(tarefa.id, alunoDetalhes.id, tarefa.xp_recompensa)} disabled={aprovando === tarefa.id}
                                            className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg border border-primary/30 text-primary hover:bg-primary/10 transition-colors disabled:opacity-50 shrink-0">
                                            {aprovando === tarefa.id ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />} Concluir
                                          </button>
                                        )}
                                        {tarefa.aprovada_por_equipe && <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-wide shrink-0">Aprovado</span>}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}

                {/* ── ABA: EVENTOS ────────────────────────────────────────── */}
                {sheetTab === "eventos" && (() => {
                  const eventosAluno = eventos.filter(e => e.aluno_id === alunoDetalhes.id || e.aluno_id === null || e.aluno_id === "__todos__");
                  return (
                    <>
                      <Button size="sm" variant="outline" className="w-full gap-2 border-primary/30 text-primary hover:bg-primary/10 mb-6"
                        onClick={() => { setNovoEvento(p => ({ ...p, aluno_id: alunoDetalhes.id })); setOpenCriarEvento(true); }}>
                        <PlusCircle size={14} /> Agendar Evento para Este Aluno
                      </Button>
                      
                      {eventosAluno.length === 0 ? (
                        <p className="text-center py-10 text-muted-foreground text-sm">Nenhum evento agendado.</p>
                      ) : (
                        <div className="space-y-3">
                          {eventosAluno.map(ev => (
                            <div key={ev.id} className="p-4 rounded-xl border border-border bg-secondary/30 hover:border-primary/30 transition-all flex justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge variant="outline" className="text-[10px] uppercase">{ev.tipo}</Badge>
                                  {(!ev.aluno_id || ev.aluno_id === "__todos__") && <Badge variant="outline" className="text-[9px] px-1 bg-white/5">Global</Badge>}
                                </div>
                                <h4 className="font-semibold text-sm text-foreground truncate">{ev.titulo}</h4>
                                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                  <Calendar size={12} /> {new Date(ev.data_hora).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                                </p>
                              </div>
                              <button onClick={() => handleDeletarEvento(ev.id)} disabled={deletingEvento === ev.id} className="text-muted-foreground hover:text-destructive shrink-0">
                                {deletingEvento === ev.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  );
                })()}

                {/* ── ABA: PRÊMIO ─────────────────────────────────────────── */}
                {sheetTab === "premio" && (
                  <div className="space-y-6">
                    <form onSubmit={handleSalvarPremio} className="space-y-4">
                      <div className="p-4 bg-secondary/40 rounded-xl border border-border">
                        <p className="text-xs text-muted-foreground">Configure o prêmio personalizado deste aluno. Ele verá isso no portal como meta final da mentoria.</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground uppercase mb-2 block">Título do Prêmio *</Label>
                        <Input
                          value={premioEdit.titulo}
                          onChange={e => setPremioEdit(p => ({ ...p, titulo: e.target.value }))}
                          className="bg-secondary border-border"
                          placeholder="Ex: Viagem para Paris, Mentoria com especialista..."
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground uppercase mb-2 block">Descrição</Label>
                        <Textarea
                          value={premioEdit.descricao}
                          onChange={e => setPremioEdit(p => ({ ...p, descricao: e.target.value }))}
                          className="bg-secondary border-border resize-none"
                          rows={3}
                          placeholder="Descreva o prêmio em detalhes para motivar o aluno..."
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground uppercase mb-2 block">Meta de XP para Desbloquear</Label>
                        <Input
                          type="number"
                          min={100}
                          max={10000}
                          value={premioEdit.xp_meta}
                          onChange={e => setPremioEdit(p => ({ ...p, xp_meta: Number(e.target.value) }))}
                          className="bg-secondary border-border"
                        />
                      </div>
                      <Button type="submit" disabled={savingPremio} className="w-full h-11 font-bold">
                        {savingPremio ? <Loader2 size={16} className="animate-spin" /> : "Salvar Prêmio"}
                      </Button>
                    </form>

                    {/* XP por tarefa */}
                    <div className="border-t border-border pt-5">
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                        <Zap size={12} className="text-primary" /> XP por Tarefa
                      </p>
                      {sprintsAluno.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Nenhum sprint criado para este aluno.</p>
                      ) : (
                        <div className="space-y-4">
                          {sprintsAluno.map(sprint => {
                            const tarefasSprint = tarefasDetalhe.filter(t => t.sprint_id === sprint.id);
                            return (
                              <div key={sprint.id}>
                                <p className="text-xs font-semibold text-foreground mb-2">{sprint.titulo}</p>
                                {tarefasSprint.length === 0 ? (
                                  <p className="text-[11px] text-muted-foreground pl-2">Sem tarefas</p>
                                ) : (
                                  <div className="space-y-1.5">
                                    {tarefasSprint.map(tarefa => (
                                      <div key={tarefa.id} className="flex items-center gap-2 py-1 px-2.5 rounded-lg bg-secondary/50">
                                        <span className="text-xs text-foreground flex-1 truncate">{tarefa.titulo}</span>
                                        <Input
                                          type="number"
                                          min={0}
                                          max={9999}
                                          className="w-20 h-7 text-xs bg-background border-border text-center px-1"
                                          value={tarefaXpEdit[tarefa.id] ?? (tarefa.xp_recompensa ?? 100)}
                                          onChange={e => setTarefaXpEdit(p => ({ ...p, [tarefa.id]: Number(e.target.value) }))}
                                          onBlur={async () => {
                                            const xp = tarefaXpEdit[tarefa.id] ?? tarefa.xp_recompensa ?? 100;
                                            try {
                                              await updateSprintTarefa(tarefa.id, { xp_recompensa: xp });
                                              toast({ title: `XP atualizado: ${xp} XP` });
                                            } catch {
                                              toast({ title: "Erro ao salvar XP", variant: "destructive" });
                                            }
                                          }}
                                        />
                                        <span className="text-[10px] text-muted-foreground shrink-0">XP</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ── ABA: BIBLIOTECA ─────────────────────────────────────── */}
                {sheetTab === "biblioteca" && (() => {
                  const materiaisAluno = materiais.filter(m => m.aluno_id === alunoDetalhes.id || m.aluno_id === null || m.aluno_id === "__global__");
                  return (
                    <>
                      <Button size="sm" variant="outline" className="w-full gap-2 border-primary/30 text-primary hover:bg-primary/10 mb-6"
                        onClick={() => { setNovoMaterial(p => ({ ...p, aluno_id: alunoDetalhes.id })); setOpenAddMaterial(true); }}>
                        <PlusCircle size={14} /> Adicionar Material para Este Aluno
                      </Button>
                      
                      {materiaisAluno.length === 0 ? (
                        <p className="text-center py-10 text-muted-foreground text-sm">Nenhum material na biblioteca deste aluno.</p>
                      ) : (
                        <div className="space-y-3">
                          {materiaisAluno.map(mat => (
                            <div key={mat.id} className="p-4 rounded-xl border border-border bg-secondary/30 hover:border-primary/30 transition-all flex justify-between gap-3">
                              <div className="flex items-start gap-3 flex-1 min-w-0">
                                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                  {mat.tipo === 'video' ? <Video size={14} /> : mat.tipo === 'pdf' ? <FileText size={14} /> : <BookOpen size={14} />}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <h4 className="font-semibold text-sm text-foreground truncate">{mat.titulo}</h4>
                                    {(!mat.aluno_id || mat.aluno_id === "__global__") && <Badge variant="outline" className="text-[9px] px-1 bg-white/5">Global</Badge>}
                                  </div>
                                  <a href={mat.url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-primary hover:underline flex items-center gap-1 mt-1 truncate">
                                    <Link2 size={10} /> Acessar conteúdo
                                  </a>
                                </div>
                              </div>
                              <button onClick={() => handleDeletarMaterial(mat.id)} disabled={deletingMaterial === mat.id} className="text-muted-foreground hover:text-destructive shrink-0">
                                {deletingMaterial === mat.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  );
                })()}
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
                <Input type="password" value={senhaAluno} onChange={e => setSenhaAluno(e.target.value)} className="bg-secondary border-border h-11" placeholder="Mínimo 6 caracteres" required />
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
      <Dialog open={openCriarSprint} onOpenChange={open => { if (!open) { setNovoSprint({ titulo: "", descricao: "", aluno_id: null }); } setOpenCriarSprint(open); }}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Layers className="text-primary" size={18} /> Criar Sprint</DialogTitle>
            <DialogDescription>O sprint ficará vinculado ao aluno selecionado.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCriarSprint} className="space-y-4">
            <div><Label className="text-xs text-muted-foreground uppercase mb-2 block">Aluno *</Label>
              <Select value={novoSprint.aluno_id ?? ""} onValueChange={v => setNovoSprint(p => ({ ...p, aluno_id: v || null }))}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Selecione o aluno" /></SelectTrigger>
                <SelectContent>
                  {alunos.map(a => <SelectItem key={a.id} value={a.id}>{a.profiles?.nome || a.leads?.nome_completo}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs text-muted-foreground uppercase mb-2 block">Título *</Label>
              <Input value={novoSprint.titulo} onChange={e => setNovoSprint(p => ({ ...p, titulo: e.target.value }))} className="bg-secondary border-border" placeholder="Ex: Sprint 1 — Diagnóstico & Base" required />
            </div>
            <div><Label className="text-xs text-muted-foreground uppercase mb-2 block">Descrição</Label>
              <Textarea value={novoSprint.descricao} onChange={e => setNovoSprint(p => ({ ...p, descricao: e.target.value }))} className="bg-secondary border-border resize-none" rows={2} />
            </div>
            <Button type="submit" disabled={savingSprint || !novoSprint.aluno_id} className="w-full h-11 font-bold">
              {savingSprint ? <Loader2 size={16} className="animate-spin" /> : "Criar Sprint"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ══ DIALOG: Criar Tarefa ══════════════════════════════════════════════ */}
      <Dialog open={openCriarTarefa} onOpenChange={setOpenCriarTarefa}>
        <DialogContent className="bg-card border-border sm:max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Star className="text-primary" size={18} /> Atribuir Tarefa</DialogTitle>
            <DialogDescription>Cria uma tarefa dentro de um Sprint para o aluno selecionado.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCriarTarefa} className="space-y-4">
            <div><Label className="text-xs text-muted-foreground uppercase mb-2 block">Aluno *</Label>
              <Select value={novaTarefa.aluno_id} onValueChange={handleAlterarAlunoTarefa}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Selecione o aluno" /></SelectTrigger>
                <SelectContent>
                  {alunos.map(a => <SelectItem key={a.id} value={a.id}>{a.profiles?.nome || a.leads?.nome_completo}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs text-muted-foreground uppercase mb-2 block">Sprint *</Label>
              <Select value={novaTarefa.sprint_id} onValueChange={v => setNovaTarefa(p => ({ ...p, sprint_id: v }))} disabled={!novaTarefa.aluno_id}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder={novaTarefa.aluno_id ? "Selecione o sprint" : "Selecione um aluno primeiro"} /></SelectTrigger>
                <SelectContent>
                  {sprintsParaTarefa.length === 0 && <SelectItem value="__none__" disabled>Nenhum sprint encontrado — crie um primeiro</SelectItem>}
                  {sprintsParaTarefa.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.titulo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs text-muted-foreground uppercase mb-2 block">Título da Tarefa *</Label>
              <Input value={novaTarefa.titulo} onChange={e => setNovaTarefa(p => ({ ...p, titulo: e.target.value }))} className="bg-secondary border-border" placeholder="Ex: Criar calendário editorial do mês" required />
            </div>
            <div><Label className="text-xs text-muted-foreground uppercase mb-2 block">Responsável (opcional)</Label>
              <Select value={novaTarefa.responsavel_id || "__none__"} onValueChange={v => setNovaTarefa(p => ({ ...p, responsavel_id: v === "__none__" ? "" : v }))}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Sem responsável" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sem responsável</SelectItem>
                  {(() => {
                    const alunoSel = alunos.find(a => a.id === novaTarefa.aluno_id);
                    if (!alunoSel?.profile_id) return null;
                    const nomeAluno = alunoSel.profiles?.nome || alunoSel.leads?.nome_completo || "Aluno";
                    return <SelectItem key={alunoSel.profile_id} value={alunoSel.profile_id}>👤 {nomeAluno} (aluno)</SelectItem>;
                  })()}
                  {profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs text-muted-foreground uppercase mb-2 block">XP de Recompensa</Label>
                <Input type="number" min={1} max={500} value={novaTarefa.xp_recompensa} onChange={e => setNovaTarefa(p => ({ ...p, xp_recompensa: Number(e.target.value) }))} className="bg-secondary border-border" />
              </div>
              <div><Label className="text-xs text-muted-foreground uppercase mb-2 block">Prazo (opcional)</Label>
                <Input type="date" value={novaTarefa.prazo} onChange={e => setNovaTarefa(p => ({ ...p, prazo: e.target.value }))} className="bg-secondary border-border" />
              </div>
            </div>
            <Button type="submit" disabled={savingTarefa || !novaTarefa.sprint_id || !novaTarefa.aluno_id} className="w-full h-11 font-bold">
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
              <Input value={novoEvento.titulo} onChange={e => setNovoEvento(p => ({ ...p, titulo: e.target.value }))} className="bg-secondary border-border" placeholder="Ex: Reunião Mensal Sprint 3" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs text-muted-foreground uppercase mb-2 block">Tipo</Label>
                <Select value={novoEvento.tipo} onValueChange={v => setNovoEvento(p => ({ ...p, tipo: v as TipoEvento }))}>
                  <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
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
                <Input type="datetime-local" value={novoEvento.data_hora} onChange={e => setNovoEvento(p => ({ ...p, data_hora: e.target.value }))} className="bg-secondary border-border" required />
              </div>
            </div>
            <div><Label className="text-xs text-muted-foreground uppercase mb-2 block">Visibilidade</Label>
              <Select value={novoEvento.aluno_id} onValueChange={v => setNovoEvento(p => ({ ...p, aluno_id: v }))}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__todos__">Todos os Alunos</SelectItem>
                  {alunos.map(a => <SelectItem key={a.id} value={a.id}>{a.profiles?.nome || a.leads?.nome_completo}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs text-muted-foreground uppercase mb-2 block">Descrição / Link (opcional)</Label>
              <Textarea value={novoEvento.descricao} onChange={e => setNovoEvento(p => ({ ...p, descricao: e.target.value }))} className="bg-secondary border-border resize-none" rows={2} placeholder="Link da reunião, instruções..." />
            </div>
            <Button type="submit" disabled={savingEvento || !novoEvento.data_hora} className="w-full h-11 font-bold">
              {savingEvento ? <Loader2 size={16} className="animate-spin" /> : "Salvar Evento"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ══ DIALOG: Resetar Senha ══════════════════════════════════════════════ */}
      <Dialog open={openResetSenha} onOpenChange={setOpenResetSenha}>
        <DialogContent className="bg-card border-border sm:max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><KeyRound className="text-primary" size={18} /> Alterar Senha do Aluno</DialogTitle>
            <DialogDescription>A nova senha será aplicada imediatamente para {alunoDetalhes?.profiles?.nome || "este aluno"}.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleResetarSenha} className="space-y-4">
            <div><Label className="text-xs text-muted-foreground uppercase mb-2 block">Nova Senha *</Label>
              <Input type="password" value={novaSenhaAdmin} onChange={e => setNovaSenhaAdmin(e.target.value)} className="bg-secondary border-border" placeholder="Mínimo 6 caracteres" minLength={6} required />
            </div>
            <Button type="submit" disabled={resetandoSenha || novaSenhaAdmin.length < 6} className="w-full h-11 font-bold">
              {resetandoSenha ? <Loader2 size={16} className="animate-spin" /> : "Confirmar Nova Senha"}
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
              <Input value={novoMaterial.titulo} onChange={e => setNovoMaterial(p => ({ ...p, titulo: e.target.value }))} className="bg-secondary border-border" placeholder="Ex: Aula 01 — Fundamentos" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs text-muted-foreground uppercase mb-2 block">Tipo *</Label>
                <Select value={novoMaterial.tipo} onValueChange={v => setNovoMaterial(p => ({ ...p, tipo: v as TipoMaterial }))}>
                  <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
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
                  <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__global__">Todos os Alunos</SelectItem>
                    {alunos.map(a => <SelectItem key={a.id} value={a.id}>{a.profiles?.nome || a.leads?.nome_completo}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div>
              <Label className="text-xs text-muted-foreground uppercase mb-2 block">Método de Envio *</Label>
              <div className="flex gap-2 mb-3">
                <Button type="button" variant={materialMode === "link" ? "default" : "outline"} onClick={() => setMaterialMode("link")} className="flex-1 text-xs h-8">Link Externo</Button>
                <Button type="button" variant={materialMode === "upload" ? "default" : "outline"} onClick={() => setMaterialMode("upload")} className="flex-1 text-xs h-8">Upload de Arquivo</Button>
              </div>
              {materialMode === "link" ? (
                <Input value={novoMaterial.url} onChange={e => setNovoMaterial(p => ({ ...p, url: e.target.value }))} className="bg-secondary border-border" placeholder="https://..." type="url" required />
              ) : (
                <Input type="file" onChange={e => setMaterialFile(e.target.files?.[0] || null)} className="bg-secondary border-border cursor-pointer pt-1.5" required />
              )}
            </div>

            <div>
              <Label className="text-xs text-muted-foreground uppercase mb-2 block">Pasta</Label>
              {(() => {
                const pastasDosBanco = materiais
                  .map(m => (m as any).pasta)
                  .filter((p: any) => p && p !== "__nova__" && p !== "__sem__");
                const todasPastas = Array.from(new Set([...pastasDosBanco, ...pastasLocais])) as string[];
                return (
                  <>
                    <Select
                      value={novoMaterial.pasta || "__sem__"}
                      onValueChange={v => {
                        if (v === "__nova__") { setNovoMaterial(p => ({ ...p, pasta: "__nova__" })); setNovaPasta(""); }
                        else if (v === "__sem__") { setNovoMaterial(p => ({ ...p, pasta: "" })); setNovaPasta(""); }
                        else { setNovoMaterial(p => ({ ...p, pasta: v })); setNovaPasta(""); }
                      }}
                    >
                      <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Sem pasta" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__sem__">📄 Sem pasta</SelectItem>
                        {todasPastas.map(p => {
                          const qtd = materiais.filter(m => (m as any).pasta === p).length;
                          return (
                            <SelectItem key={p} value={p}>
                              📁 {p}{qtd > 0 ? ` (${qtd} material${qtd !== 1 ? 'is' : ''})` : ''}
                            </SelectItem>
                          );
                        })}
                        <SelectItem value="__nova__">✦ Criar nova pasta...</SelectItem>
                      </SelectContent>
                    </Select>
                    {novoMaterial.pasta === "__nova__" && (
                      <Input
                        className="bg-secondary border-border mt-2"
                        placeholder="Nome da nova pasta"
                        value={novaPasta}
                        onChange={e => setNovaPasta(e.target.value)}
                        autoFocus
                        required
                      />
                    )}
                    {novoMaterial.pasta && novoMaterial.pasta !== "__sem__" && novoMaterial.pasta !== "__nova__" && (
                      <p className="text-[11px] text-primary/70 mt-1.5 flex items-center gap-1">
                        ✓ Este material será adicionado à pasta <strong>"{novoMaterial.pasta}"</strong>
                      </p>
                    )}
                  </>
                );
              })()}
            </div>
            <div><Label className="text-xs text-muted-foreground uppercase mb-2 block">Descrição</Label>
              <Textarea value={novoMaterial.descricao} onChange={e => setNovoMaterial(p => ({ ...p, descricao: e.target.value }))} className="bg-secondary border-border resize-none" rows={2} />
            </div>
            <Button type="submit" disabled={savingMaterial || (materialMode === "upload" && !materialFile) || (materialMode === "link" && !novoMaterial.url) || (novoMaterial.pasta === "__nova__" && !novaPasta.trim())} className="w-full h-11 font-bold">
              {savingMaterial ? <Loader2 size={16} className="animate-spin" /> : "Salvar Material"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ══ DIALOG: Nova Pasta ════════════════════════════════════════════════ */}
      <Dialog open={openNovaPastaDialog} onOpenChange={v => { setOpenNovaPastaDialog(v); if (!v) setNovaPastaInput(""); }}>
        <DialogContent className="bg-card border-border sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><BookOpen className="text-primary" size={18} /> Nova Pasta</DialogTitle>
            <DialogDescription>Crie uma pasta para organizar os materiais da biblioteca.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label className="text-xs text-muted-foreground uppercase mb-2 block">Nome da Pasta *</Label>
              <Input
                value={novaPastaInput}
                onChange={e => setNovaPastaInput(e.target.value)}
                className="bg-secondary border-border"
                placeholder="Ex: Sprint 1, Aulas, Planilhas..."
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleCriarPastaLocal(); } }}
                autoFocus
              />
            </div>
            <Button onClick={handleCriarPastaLocal} disabled={!novaPastaInput.trim()} className="w-full h-11 font-bold">
              Criar Pasta e Adicionar Material
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
