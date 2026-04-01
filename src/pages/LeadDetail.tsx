import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { fetchLead, fetchInteracoes, fetchProximasAcoes, fetchProfiles } from '@/lib/api';
import { formatCurrency, getInitials, STATUS_LABELS, PipelineStatus } from '@/lib/types';
import { ArrowLeft, Flame, MessageCircle, Phone, Video, Mail, Star, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Skeleton } from '@/components/ui/skeleton';
import { validateWhatsApp } from '@/lib/whatsapp-utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { InteractionForm } from '@/components/InteractionForm';
import { ActionForm } from '@/components/ActionForm';
import { useAuth } from '@/contexts/AuthContext';

function DataFieldWarning({ warning }: { warning: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center gap-1 ml-1.5 px-1.5 py-0.5 rounded bg-warning/15 text-warning text-[10px] font-medium cursor-help">
          <AlertTriangle size={10} />
          Atenção
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="bg-popover border-border text-popover-foreground text-xs max-w-[200px]">
        {warning}
      </TooltipContent>
    </Tooltip>
  );
}

export default function LeadDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showInteraction, setShowInteraction] = useState(false);
  const [showAction, setShowAction] = useState(false);

  const { data: lead, isLoading } = useQuery({ queryKey: ['lead', id], queryFn: () => fetchLead(id!), enabled: !!id });
  const { data: interacoes = [] } = useQuery({ queryKey: ['interacoes', id], queryFn: () => fetchInteracoes(id!), enabled: !!id });
  const { data: acoes = [] } = useQuery({ queryKey: ['proximas_acoes', id], queryFn: () => fetchProximasAcoes(id!), enabled: !!id });
  const { data: profiles = [] } = useQuery({ queryKey: ['profiles'], queryFn: fetchProfiles });

  if (isLoading) {
    return <AppLayout title="Carregando..."><Skeleton className="h-40 card-premium" /></AppLayout>;
  }

  if (!lead) {
    return (
      <AppLayout title="Lead não encontrado">
        <div className="flex flex-col items-center justify-center py-20">
          <p className="text-muted-foreground mb-4">Lead não encontrado</p>
          <Button variant="outline" onClick={() => navigate('/leads')}>Voltar</Button>
        </div>
      </AppLayout>
    );
  }

  const vendedor = profiles.find((u) => u.id === lead.vendedor_id);
  const gestor = profiles.find((u) => u.id === lead.gestor_id);
  const hot = lead.eh_empresario && (lead.faturamento_anual || 0) > 500000 && lead.capacidade_investimento && (lead.fit_mentoria || 0) >= 4;

  const tipoIcon: Record<string, any> = { whatsapp: <MessageCircle size={14} />, ligacao: <Phone size={14} />, reuniao: <Video size={14} />, email: <Mail size={14} /> };
  const tipoLabel: Record<string, string> = { whatsapp: 'WhatsApp', ligacao: 'Ligação', reuniao: 'Reunião', email: 'E-mail' };

  const statusColor: Record<string, string> = {
    novo_lead:          'bg-white/10 text-white/60',
    contato_instagram:  'bg-white/10 text-white/60',
    contato_whatsapp:   'bg-white/10 text-white/60',
    tentativa_contato:  'bg-white/5 text-white/40',
    contato_realizado:  'bg-white/10 text-white/50',
    reuniao_agendada:   'bg-white/15 text-white/80',
    reuniao_realizada:  'bg-white/15 text-white/80',
    followup:           'bg-white/10 text-white/70',
    negociacao:         'bg-white/20 text-white/90',
    fechado:            'bg-white/25 text-white',
    perdido:            'bg-white/5 text-white/30',
  };

  const whatsappValidation = validateWhatsApp(lead.whatsapp);
  const emailWarning = lead.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email) ? 'Formato de e-mail inválido' : null;

  return (
    <AppLayout title={lead.nome_completo} subtitle={lead.nome_empresa || undefined}
      actions={
        <Button variant="outline" onClick={() => navigate('/leads')} className="border-border text-muted-foreground h-9 text-xs sm:text-sm">
          <ArrowLeft size={14} className="mr-1 sm:mr-2" />
          <span className="hidden sm:inline">Voltar</span>
          <span className="sm:hidden">←</span>
        </Button>
      }>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-4">
          {/* Header card */}
          <div className="card-premium p-4 sm:p-6">
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full gold-gradient flex items-center justify-center text-lg sm:text-xl font-bold text-primary-foreground shrink-0">
                {getInitials(lead.nome_completo)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h2 className="text-lg sm:text-xl font-semibold text-foreground">{lead.nome_completo}</h2>
                  {hot && <Flame size={18} className="text-warning" />}
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground mb-2 truncate">
                  {lead.nome_empresa} {lead.instagram_empresa && `• ${lead.instagram_empresa}`}
                </p>
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  <span className={`text-[10px] sm:text-xs px-2 sm:px-3 py-1 rounded-full ${statusColor[lead.status_pipeline]}`}>
                    {STATUS_LABELS[lead.status_pipeline as PipelineStatus]}
                  </span>
                  <span className="text-[10px] sm:text-xs px-2 sm:px-3 py-1 rounded-full bg-primary/10 text-primary">
                    {formatCurrency(lead.faturamento_anual || 0)}
                  </span>
                  <span className="text-[10px] sm:text-xs px-2 sm:px-3 py-1 rounded-full bg-secondary text-muted-foreground">
                    {lead.quantidade_funcionarios} func.
                  </span>
                  {lead.capacidade_investimento && (
                    <span className="text-[10px] sm:text-xs px-2 sm:px-3 py-1 rounded-full bg-success/10 text-success">
                      Capacidade de investimento
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Data card */}
          <div className="card-premium p-4 sm:p-6">
            <h3 className="text-sm font-semibold text-foreground mb-4">Dados Completos</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">E-mail</p>
                <div className="flex items-center flex-wrap">
                  <p className="text-sm text-foreground break-all">{lead.email || '—'}</p>
                  {emailWarning && <DataFieldWarning warning={emailWarning} />}
                </div>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">WhatsApp</p>
                <div className="flex items-center flex-wrap">
                  <p className="text-sm text-foreground">{lead.whatsapp || '—'}</p>
                  {lead.whatsapp && whatsappValidation.warning && (
                    <DataFieldWarning warning={whatsappValidation.warning} />
                  )}
                </div>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Cidade/Estado</p>
                <p className="text-sm text-foreground">{lead.cidade && lead.estado ? `${lead.cidade}/${lead.estado}` : lead.cidade || lead.estado || '—'}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Empresário</p>
                <p className="text-sm text-foreground">{lead.eh_empresario ? 'Sim' : 'Não'}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Maior Dor</p>
                <p className="text-sm text-foreground">{lead.maior_dor || '—'}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Origem</p>
                <p className="text-sm text-foreground">{lead.origem || '—'}</p>
              </div>
            </div>
          </div>

          {/* Observations */}
          <div className="card-premium p-4 sm:p-6">
            <h3 className="text-sm font-semibold text-foreground mb-4">Observações Estratégicas</h3>
            <div className="border-l-2 border-primary pl-4 bg-secondary/50 p-3 rounded-r-lg">
              <p className="text-sm text-muted-foreground italic">{lead.observacoes_estrategicas || 'Nenhuma observação registrada.'}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="card-premium p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground">Próximas Ações</h3>
              <Button onClick={() => setShowAction(true)} className="gold-gradient text-primary-foreground font-semibold text-xs h-8 px-3">+ Agendar</Button>
            </div>
            {acoes.length > 0 ? (
              <div className="space-y-2">
                {acoes.map((a) => (
                  <div key={a.id} className={`flex items-center gap-3 p-2 rounded-lg ${a.concluida ? 'bg-secondary/30 opacity-60' : 'bg-secondary'}`}>
                    <div className={`w-2 h-2 rounded-full shrink-0 ${a.concluida ? 'bg-muted-foreground' : 'bg-primary'}`} />
                    <span className="text-xs text-primary shrink-0">{new Date(a.data_hora).toLocaleDateString('pt-BR')}</span>
                    <span className={`text-xs flex-1 truncate ${a.concluida ? 'line-through text-muted-foreground' : 'text-foreground'}`}>{a.titulo}</span>
                    {a.tipo && <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">{a.tipo}</span>}
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground">Nenhuma ação agendada</p>}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          <div className="card-premium p-4 sm:p-6">
            <h3 className="text-sm font-semibold text-foreground mb-4">Responsáveis</h3>
            <div className="space-y-3">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Gestor</p>
                <p className="text-sm text-foreground">{gestor?.nome || '—'}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Vendedor</p>
                <p className="text-sm text-foreground">{vendedor?.nome || '—'}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Probabilidade</p>
                <div className="flex items-center gap-3">
                  <Slider defaultValue={[lead.probabilidade_fechamento || 0]} max={100} step={5} className="flex-1" />
                  <span className="text-sm font-medium text-primary">{lead.probabilidade_fechamento}%</span>
                </div>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Fit</p>
                <div className="flex gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} size={16} className={i < (lead.fit_mentoria || 0) ? 'text-primary fill-primary' : 'text-muted-foreground/30'} />
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Último Contato</p>
                <p className="text-sm text-foreground">{lead.ultimo_contato ? new Date(lead.ultimo_contato).toLocaleDateString('pt-BR') : '—'}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Próximo Follow-up</p>
                <p className="text-sm text-foreground">{lead.proximo_followup ? new Date(lead.proximo_followup).toLocaleDateString('pt-BR') : '—'}</p>
              </div>
            </div>
          </div>

          <div className="card-premium p-4 sm:p-6">
            <h3 className="text-sm font-semibold text-foreground mb-3">Tags</h3>
            <div className="flex flex-wrap gap-1">
              {(lead.tags || []).map((tag) => (
                <span key={tag} className="text-xs px-2 py-1 rounded-full bg-secondary text-muted-foreground">{tag}</span>
              ))}
              {(!lead.tags || lead.tags.length === 0) && <p className="text-xs text-muted-foreground">Sem tags</p>}
            </div>
          </div>

          <div className="card-premium p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground">Timeline</h3>
              <Button variant="outline" onClick={() => setShowInteraction(true)} className="border-border text-xs h-8 px-3 text-foreground">+ Contato</Button>
            </div>
            {interacoes.length > 0 ? (
              <div className="space-y-4">
                {interacoes.map((int) => {
                  const autor = profiles.find(u => u.id === int.realizado_por);
                  return (
                    <div key={int.id} className="relative pl-6 border-l border-border">
                      <div className="absolute left-0 top-0 -translate-x-1/2 w-3 h-3 rounded-full bg-card border-2 border-primary" />
                      <div className="mb-1 flex items-center gap-2 flex-wrap">
                        <span className="text-primary">{tipoIcon[int.tipo]}</span>
                        <span className="text-xs font-medium text-foreground">{tipoLabel[int.tipo]}</span>
                        <span className="text-[10px] text-muted-foreground">{new Date(int.created_at).toLocaleDateString('pt-BR')}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mb-1">{int.resumo}</p>
                      {int.objecoes && <p className="text-xs text-warning bg-warning/10 px-2 py-1 rounded">⚠️ {int.objecoes}</p>}
                      <p className="text-[10px] text-muted-foreground mt-1">Por {autor?.nome.split(' ')[0] || '—'} • Interesse: {int.interesse_demonstrado}</p>
                    </div>
                  );
                })}
              </div>
            ) : <p className="text-sm text-muted-foreground">Nenhuma interação registrada</p>}
          </div>
        </div>
      </div>

      {/* Modals */}
      <InteractionForm leadId={lead.id} userId={user?.id || null} open={showInteraction} onOpenChange={setShowInteraction} />
      <ActionForm leadId={lead.id} profiles={profiles} userId={user?.id || null} open={showAction} onOpenChange={setShowAction} />
    </AppLayout>
  );
}
