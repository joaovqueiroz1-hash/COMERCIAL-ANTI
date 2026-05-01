import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { fetchLeads, fetchProfiles, fetchProximasAcoes, updateLead } from '@/lib/api';
import { formatCurrency, isLeadQuente, STATUS_LABELS, PipelineStatus, PIPELINE_COLUMNS } from '@/lib/types';
import {
  TrendingUp, AlertTriangle, Clock, CalendarCheck, Flame, Users,
  Target, Phone, MessageSquare, DollarSign, Star, Crown,
  Activity, ChevronRight, Zap, Award,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export default function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const now = new Date();

  const { data: leads = [], isLoading: leadsLoading } = useQuery({ queryKey: ['leads'], queryFn: fetchLeads });
  const { data: profiles = [] } = useQuery({ queryKey: ['profiles'], queryFn: fetchProfiles });
  const { data: acoes = [] } = useQuery({ queryKey: ['proximas_acoes'], queryFn: () => fetchProximasAcoes() });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => updateLead(id, { status_pipeline: status as any }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leads'] }),
  });

  if (leadsLoading) {
    return (
      <AppLayout title="Dashboard" subtitle="Carregando...">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      </AppLayout>
    );
  }

  // --- Metrics ---
  const leadsNovos = leads.filter((l) => l.status_pipeline === 'novo_lead').length;
  const emContato = leads.filter((l) => ['contato_instagram', 'contato_whatsapp', 'tentativa_contato', 'contato_realizado'].includes(l.status_pipeline)).length;
  const reunioesAgendadas = leads.filter((l) => l.status_pipeline === 'reuniao_agendada').length;
  const fechados = leads.filter((l) => l.status_pipeline === 'fechado');
  const receitaFechada = fechados.reduce((sum, l) => sum + (l.faturamento_anual || 0), 0);
  const valorAcordadoTotal = leads
    .filter((l) => ['fechado', 'negociacao'].includes(l.status_pipeline) && (l as any).valor_acordado)
    .reduce((sum, l) => sum + ((l as any).valor_acordado || 0), 0);
  const totalAtivos = leads.filter((l) => l.status_pipeline !== 'perdido').length;
  const taxaConversao = totalAtivos > 0 ? ((fechados.length / totalAtivos) * 100).toFixed(1) : '0';
  const potencialTotal = leads
    .filter((l) => !['fechado', 'perdido'].includes(l.status_pipeline))
    .reduce((s, l) => s + (l.faturamento_anual || 0), 0);

  const followupPendente = leads.filter(
    (l) => l.proximo_followup && new Date(l.proximo_followup) < now && !['fechado', 'perdido'].includes(l.status_pipeline)
  ).length;

  const reunioesRealizadas = leads.filter((l) => l.status_pipeline === 'reuniao_realizada').length;
  const emNegociacao = leads.filter((l) => l.status_pipeline === 'negociacao').length;
  const perdidos = leads.filter((l) => l.status_pipeline === 'perdido').length;

  const leadsSemContato48h = leads.filter((l) => {
    if (['fechado', 'perdido', 'novo_lead'].includes(l.status_pipeline)) return false;
    if (!l.ultimo_contato) return true;
    return (now.getTime() - new Date(l.ultimo_contato).getTime()) > 48 * 60 * 60 * 1000;
  });

  const followupsVencidos = leads.filter(
    (l) => l.proximo_followup && new Date(l.proximo_followup) < now && !['fechado', 'perdido'].includes(l.status_pipeline)
  );

  const leadsQuentesList = leads.filter(
    (l) => isLeadQuente(l as any) && !['reuniao_agendada', 'fechado'].includes(l.status_pipeline)
  );

  const reunioesHoje = acoes.filter((a) => {
    const d = new Date(a.data_hora);
    return d.toDateString() === now.toDateString() && a.tipo === 'reuniao' && !a.concluida;
  });

  const topFit = [...leads].sort((a, b) => (b.fit_mentoria || 0) - (a.fit_mentoria || 0)).slice(0, 6);

  // --- Team Performance ---
  const vendedores = profiles.filter((u) => u.ativo);
  const teamData = vendedores.map((u) => {
    const myLeads = leads.filter((l) => l.vendedor_id === u.id || l.gestor_id === u.id);
    const closed = myLeads.filter((l) => l.status_pipeline === 'fechado').length;
    const inPipe = myLeads.filter((l) => !['fechado', 'perdido'].includes(l.status_pipeline)).length;
    const taxa = myLeads.length > 0 ? Math.round((closed / myLeads.length) * 100) : 0;
    const receita = myLeads.filter((l) => l.status_pipeline === 'fechado').reduce((s, l) => s + (l.faturamento_anual || 0), 0);
    return { id: u.id, nome: u.nome.split(' ')[0], nomeCompleto: u.nome, perfil: u.perfil, total: myLeads.length, closed, inPipe, taxa, receita };
  });

  // --- Charts ---
  const vendedorConversaoChart = teamData
    .filter((t) => t.total > 0)
    .sort((a, b) => b.taxa - a.taxa)
    .slice(0, 6);

  const dores = leads.reduce((acc, l) => {
    if (!l.maior_dor) return acc;
    const raw = l.maior_dor.trim();
    const dor = raw.length > 22 ? raw.substring(0, 22).replace(/\s\S*$/, '') + '…' : raw;
    acc[dor] = (acc[dor] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const doresData = Object.entries(dores).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, value]) => ({ name, value }));

  const pipelineDistrib = PIPELINE_COLUMNS.map((col) => ({
    name: col.label.replace(' ✅', '').replace(' ❌', ''),
    value: leads.filter((l) => l.status_pipeline === col.key).length,
    color: col.color,
  })).filter((d) => d.value > 0);

  const leadsPrioritarios = [...leads]
    .filter((l) => !['fechado', 'perdido'].includes(l.status_pipeline))
    .sort((a, b) => (b.faturamento_anual || 0) - (a.faturamento_anual || 0))
    .slice(0, 7);

  const tooltipStyle = {
    background: 'hsl(222,18%,9%)',
    border: '1px solid hsl(222,15%,18%)',
    borderRadius: 8,
    color: 'hsl(45,20%,94%)',
    fontSize: 12,
  };

  const statusColor = (s: string) => {
    const map: Record<string, string> = {
      novo_lead:          'bg-secondary text-muted-foreground',
      contato_instagram:  'bg-secondary text-muted-foreground',
      contato_whatsapp:   'bg-secondary text-muted-foreground',
      tentativa_contato:  'bg-secondary/60 text-muted-foreground/70',
      contato_realizado:  'bg-secondary text-muted-foreground',
      reuniao_agendada:   'bg-blue-100 text-blue-700',
      reuniao_realizada:  'bg-green-100 text-green-700',
      followup:           'bg-amber-100 text-amber-700',
      negociacao:         'bg-purple-100 text-purple-700',
      fechado:            'bg-emerald-100 text-emerald-700',
      perdido:            'bg-red-100 text-red-600',
    };
    return map[s] || 'bg-secondary text-muted-foreground';
  };

  const getInitialsFn = (name: string) =>
    name.split(' ').filter(Boolean).slice(0, 2).map((n) => n[0]).join('').toUpperCase();

  return (
    <AppLayout
      title="Dashboard"
      subtitle={`Hoje, ${now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}`}
      actions={
        <Button
          onClick={() => navigate('/leads')}
          className="gold-gradient text-primary-foreground font-semibold text-xs h-9 px-4 rounded-xl"
        >
          + Novo Lead
        </Button>
      }
    >
      {/* ── Hero KPIs ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6 animate-fade-in">
        <KpiCard
          label="Leads Ativos"
          value={totalAtivos}
          icon={<Users size={18} />}
          sub={`${leadsNovos} novos`}
          color="blue"
        />
        <KpiCard
          label="Reuniões Agendadas"
          value={reunioesAgendadas}
          icon={<CalendarCheck size={18} />}
          sub={`${reunioesRealizadas} realizadas`}
          color="gold"
        />
        <KpiCard
          label="Em Negociação"
          value={emNegociacao}
          icon={<Activity size={18} />}
          sub={`${fechados.length} fechados`}
          color="info"
        />
        <KpiCard
          label="Taxa de Conversão"
          value={`${taxaConversao}%`}
          icon={<TrendingUp size={18} />}
          sub={`${emNegociacao} neg. · ${fechados.length} fechados`}
          color="success"
        />
      </div>

      {/* ── Revenue row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
        <div className="card-glow p-4 sm:p-5 flex flex-col gap-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary/70">Valor Acordado</span>
            <DollarSign size={16} className="text-primary" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold gold-gradient-text">{formatCurrency(valorAcordadoTotal)}</p>
          <p className="text-[11px] text-muted-foreground">{fechados.length} fechados · {emNegociacao} em negociação</p>
        </div>
        <div className="card-premium p-4 sm:p-5 flex flex-col gap-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Potencial no Pipeline</span>
            <Target size={16} className="text-muted-foreground" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-foreground">{formatCurrency(potencialTotal)}</p>
          <p className="text-[11px] text-muted-foreground">leads ativos sem fechar</p>
        </div>
        <div className="card-premium p-4 sm:p-5 flex flex-col gap-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Follow-up Pendente</span>
            <Clock size={16} className="text-warning" />
          </div>
          <p className={`text-2xl sm:text-3xl font-bold ${followupPendente > 0 ? 'text-warning' : 'text-success'}`}>
            {followupPendente}
          </p>
          <p className="text-[11px] text-muted-foreground">{perdidos} perdidos no total</p>
        </div>
      </div>


      {/* ── Team Performance ── */}
      {teamData.length > 0 && (
        <>
          <SectionLabel icon={<Crown size={13} />} text="Performance da Equipe" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
            {teamData.slice(0, 6).map((member, idx) => (
              <div key={member.id} className={`${idx === 0 ? 'card-team-top' : 'card-team'} p-4 transition-all`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 bg-white/20 text-white">
                    {getInitialsFn(member.nomeCompleto)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{member.nomeCompleto}</p>
                    <p className="text-[10px] text-white/60 capitalize">{member.perfil}</p>
                  </div>
                  {idx === 0 && <Award size={14} className="text-amber-300 shrink-0" />}
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-lg font-bold text-white">{member.total}</p>
                    <p className="text-[9px] text-white/50 uppercase tracking-wide">Total</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-emerald-300">{member.closed}</p>
                    <p className="text-[9px] text-white/50 uppercase tracking-wide">Fechados</p>
                  </div>
                  <div>
                    <p className={`text-lg font-bold ${member.taxa >= 50 ? 'text-amber-300' : member.taxa >= 20 ? 'text-yellow-200' : 'text-white/60'}`}>
                      {member.taxa}%
                    </p>
                    <p className="text-[9px] text-white/50 uppercase tracking-wide">Conversão</p>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="w-full bg-white/15 rounded-full h-1">
                    <div
                      className="h-1 rounded-full bg-amber-300 transition-all"
                      style={{ width: `${Math.min(member.taxa, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Main content 2-col ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Leads prioritários */}
        <div className="lg:col-span-2 card-premium p-4 sm:p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground">Leads Prioritários</h3>
            <button onClick={() => navigate('/leads')} className="text-[11px] text-primary hover:underline flex items-center gap-1">
              Ver todos <ChevronRight size={12} />
            </button>
          </div>
          {leadsPrioritarios.length > 0 ? (
            <div className="space-y-1.5">
              {leadsPrioritarios.map((lead) => (
                <div
                  key={lead.id}
                  onClick={() => navigate(`/leads/${lead.id}`)}
                  className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-secondary cursor-pointer transition-colors group"
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${isLeadQuente(lead as any) ? 'gold-gradient text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>
                    {getInitialsFn(lead.nome_completo)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium text-foreground truncate">{lead.nome_completo}</p>
                      {isLeadQuente(lead as any) && <Flame size={11} className="text-primary shrink-0" />}
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate">{lead.nome_empresa}</p>
                  </div>
                  <span className="text-xs text-primary font-semibold shrink-0 hidden sm:inline">
                    {formatCurrency(lead.faturamento_anual || 0)}
                  </span>
                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {lead.status_pipeline !== 'negociacao' && (
                      <button
                        onClick={() => statusMutation.mutate({ id: lead.id, status: 'negociacao' })}
                        disabled={statusMutation.isPending}
                        className="text-[9px] px-1.5 py-0.5 rounded bg-white/8 text-white/50 hover:bg-white/15 hover:text-white/80 transition-colors"
                        title="Mover para Negociação"
                      >
                        Neg.
                      </button>
                    )}
                    {lead.status_pipeline !== 'fechado' && (
                      <button
                        onClick={() => statusMutation.mutate({ id: lead.id, status: 'fechado' })}
                        disabled={statusMutation.isPending}
                        className="text-[9px] px-1.5 py-0.5 rounded bg-white/8 text-white/50 hover:bg-primary/20 hover:text-primary transition-colors"
                        title="Marcar como Fechado"
                      >
                        Fechado
                      </button>
                    )}
                  </div>
                  <ChevronRight size={14} className="text-muted-foreground/30 group-hover:text-muted-foreground transition-colors shrink-0" />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum lead cadastrado ainda</p>
          )}
        </div>

        {/* Fit Mentoria */}
        <div className="card-premium p-4 sm:p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground">Maior Fit com a Mentoria</h3>
            <Star size={14} className="text-primary" />
          </div>
          {topFit.length > 0 ? (
            <div className="space-y-3">
              {topFit.map((lead, i) => (
                <div
                  key={lead.id}
                  onClick={() => navigate(`/leads/${lead.id}`)}
                  className="flex items-center gap-2.5 cursor-pointer group"
                >
                  <span className="text-[10px] text-muted-foreground w-4 shrink-0 font-bold">#{i + 1}</span>
                  <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold text-muted-foreground shrink-0">
                    {getInitialsFn(lead.nome_completo)}
                  </div>
                  <span className="text-xs text-foreground flex-1 truncate group-hover:text-primary transition-colors">{lead.nome_completo}</span>
                  <div className="flex gap-0.5 shrink-0">
                    {Array.from({ length: 5 }).map((_, si) => (
                      <Star
                        key={si}
                        size={11}
                        className={si < (lead.fit_mentoria || 0) ? 'text-primary fill-primary' : 'text-muted-foreground/20'}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum lead cadastrado</p>
          )}
        </div>
      </div>

      {/* ── Charts row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Conversão por vendedor */}
        {vendedorConversaoChart.length > 0 && (
          <div className="card-premium p-4 sm:p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">Conversão por Membro da Equipe (%)</h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={vendedorConversaoChart} layout="vertical" margin={{ left: 0, right: 20, top: 0, bottom: 0 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="nome" width={70} tick={{ fill: 'hsl(45,15%,60%)', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}%`, 'Conversão']} />
                <Bar dataKey="taxa" radius={[0, 6, 6, 0]} fill="hsl(0,0%,68%)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Pipeline distribution */}
        {pipelineDistrib.length > 0 && (
          <div className="card-premium p-4 sm:p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">Distribuição do Pipeline</h3>
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="50%" height={160}>
                <PieChart>
                  <Pie
                    data={pipelineDistrib}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={68}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {pipelineDistrib.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-1.5">
                {pipelineDistrib.slice(0, 6).map((item) => (
                  <div key={item.name} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: item.color }} />
                      <span className="text-[10px] text-muted-foreground truncate max-w-[100px]">{item.name}</span>
                    </div>
                    <span className="text-[11px] font-bold text-foreground">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Pipeline snapshot — full width ── */}
      <div className="card-premium p-4 sm:p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground">Pipeline — Snapshot</h3>
            <button onClick={() => navigate('/pipeline')} className="text-[11px] text-primary hover:underline flex items-center gap-1">
              Kanban <ChevronRight size={12} />
            </button>
          </div>
          <div className="space-y-2.5">
            {PIPELINE_COLUMNS.map((col) => {
              const count = leads.filter((l) => l.status_pipeline === col.key).length;
              const pct = leads.length > 0 ? (count / leads.length) * 100 : 0;
              return (
                <div key={col.key}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">{col.label.replace(' ✅', '').replace(' ❌', '')}</span>
                    <span className="text-xs font-bold text-foreground">{count}</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full transition-all"
                      style={{ width: `${pct}%`, background: col.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
    </AppLayout>
  );
}

// ── Sub-components ──

function SectionLabel({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-primary">{icon}</span>
      <span className="text-[11px] font-bold text-foreground uppercase tracking-widest">{text}</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

function KpiCard({
  label, value, icon, sub, color,
}: {
  label: string; value: string | number; icon: ReactNode; sub?: string;
  color: 'gold' | 'blue' | 'info' | 'success' | 'danger';
}) {
  const accent: Record<string, string> = {
    gold: 'border-l-primary',
    blue: 'border-l-info',
    info: 'border-l-info',
    success: 'border-l-success',
    danger: 'border-l-destructive',
  };
  const iconBg: Record<string, string> = {
    gold: 'bg-primary/15 text-primary',
    blue: 'bg-info/15 text-info',
    info: 'bg-info/15 text-info',
    success: 'bg-success/15 text-success',
    danger: 'bg-destructive/15 text-destructive',
  };
  return (
    <div className={`metric-card p-4 border-l-2 ${accent[color]}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold text-white/55 uppercase tracking-wider leading-tight">{label}</span>
        <span className={`p-1.5 rounded-lg ${iconBg[color]}`}>{icon}</span>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-[11px] text-white/50 mt-1">{sub}</p>}
    </div>
  );
}

function AlertCard({
  type, icon, title, description, action,
}: {
  type: 'critical' | 'warning' | 'info' | 'hot';
  icon: ReactNode; title: string; description: string; action?: () => void;
}) {
  const styles = {
    critical: { border: 'border-l-destructive', badge: 'bg-destructive/15 text-destructive', label: 'CRÍTICO', btnHover: 'hover:bg-destructive/10' },
    warning: { border: 'border-l-warning', badge: 'bg-warning/15 text-warning', label: 'URGENTE', btnHover: 'hover:bg-warning/10' },
    info: { border: 'border-l-info', badge: 'bg-info/15 text-info', label: 'INFO', btnHover: 'hover:bg-info/10' },
    hot: { border: 'border-l-primary', badge: 'bg-primary/15 text-primary', label: 'QUENTE', btnHover: 'hover:bg-primary/10' },
  };
  const s = styles[type];
  return (
    <div className={`card-premium p-3.5 border-l-2 ${s.border} animate-fade-in`}>
      <div className="flex items-start gap-3">
        <span className={`${s.badge} p-1.5 rounded-lg shrink-0`}>{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <p className="text-sm font-semibold text-foreground">{title}</p>
            <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${s.badge}`}>{s.label}</span>
          </div>
          <p className="text-[11px] text-muted-foreground truncate">{description}</p>
        </div>
        {action && (
          <button onClick={action} className={`p-1 rounded-lg transition-colors ${s.btnHover} shrink-0`}>
            <ChevronRight size={14} className="text-muted-foreground" />
          </button>
        )}
      </div>
    </div>
  );
}
