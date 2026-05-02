import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { fetchLeads, fetchProfiles, createLead, Lead, LeadInsert } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { STATUS_LABELS, PipelineStatus, formatCurrency, getInitials } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronDown, ChevronUp, Search, Flame, Filter, AlertTriangle } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { validateWhatsApp } from '@/lib/whatsapp-utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { LeadEditSheet } from '@/components/LeadEditSheet';

export default function Leads() {
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get('search') || '');

  useEffect(() => {
    const s = searchParams.get('search');
    if (s) setSearch(s);
  }, [searchParams]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [prioridadeFilter, setPrioridadeFilter] = useState<string>('all');
  const [vendorFilter, setVendorFilter] = useState<string>('all');
  const [faturamentoMin, setFaturamentoMin] = useState<string>('');
  const [dataInicio, setDataInicio] = useState<string>('');
  const [dataFim, setDataFim] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('faturamento_desc');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newLeadForm, setNewLeadForm] = useState({ nome_completo: '', whatsapp: '', nome_empresa: '', observacoes_iniciais: '' });
  
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (lead: LeadInsert) => createLead(lead),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      setCreateModalOpen(false);
      setNewLeadForm({ nome_completo: '', whatsapp: '', nome_empresa: '', observacoes_iniciais: '' });
      setSelectedLead(data as Lead);
      setSheetOpen(true);
    }
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLeadForm.nome_completo.trim()) return;
    createMutation.mutate({
      nome_completo: newLeadForm.nome_completo,
      whatsapp: newLeadForm.whatsapp,
      nome_empresa: newLeadForm.nome_empresa,
      observacoes_iniciais: newLeadForm.observacoes_iniciais,
      vendedor_id: user?.id,
      status_pipeline: 'novo_lead',
      prioridade: 'media',
    });
  };

  const { data: leads = [], isLoading } = useQuery({ queryKey: ['leads'], queryFn: fetchLeads });
  const { data: profiles = [] } = useQuery({ queryKey: ['profiles'], queryFn: fetchProfiles });

  let filtered = [...leads];
  if (search) {
    const s = search.toLowerCase();
    filtered = filtered.filter(l => l.nome_completo.toLowerCase().includes(s) || (l.nome_empresa || '').toLowerCase().includes(s) || (l.whatsapp || '').includes(s));
  }
  if (statusFilter !== 'all') filtered = filtered.filter(l => l.status_pipeline === statusFilter);
  if (prioridadeFilter !== 'all') filtered = filtered.filter(l => l.prioridade === prioridadeFilter);
  if (vendorFilter !== 'all') filtered = filtered.filter(l => l.vendedor_id === vendorFilter);
  if (faturamentoMin) filtered = filtered.filter(l => (l.faturamento_anual || 0) >= Number(faturamentoMin));
  if (dataInicio) filtered = filtered.filter(l => new Date(l.created_at) >= new Date(dataInicio));
  if (dataFim) filtered = filtered.filter(l => new Date(l.created_at) <= new Date(dataFim + 'T23:59:59'));

  switch (sortBy) {
    case 'faturamento_desc': filtered.sort((a, b) => (b.faturamento_anual || 0) - (a.faturamento_anual || 0)); break;
    case 'faturamento_asc': filtered.sort((a, b) => (a.faturamento_anual || 0) - (b.faturamento_anual || 0)); break;
    case 'recent': filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()); break;
    case 'oldest': filtered.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()); break;
  }

  const statusColor = (s: string) => {
    const map: Record<string, string> = {
      novo_lead:          'bg-secondary text-muted-foreground',
      congelado:          'bg-secondary/60 text-muted-foreground/60',
      contato_instagram:  'bg-secondary text-muted-foreground',
      contato_whatsapp:   'bg-secondary text-muted-foreground',
      tentativa_contato:  'bg-secondary/60 text-muted-foreground/60',
      contato_realizado:  'bg-secondary text-muted-foreground',
      reuniao_agendada:   'bg-primary/8 text-primary',
      reuniao_realizada:  'bg-primary/12 text-primary',
      followup:           'bg-primary/8 text-primary/80',
      negociacao:         'bg-primary/15 text-primary',
      fechado:            'bg-primary/20 text-primary font-semibold',
      perdido:            'bg-secondary/50 text-muted-foreground/50',
    };
    return map[s] || 'bg-secondary text-muted-foreground';
  };

  const handleOpenLead = (lead: Lead) => {
    setSelectedLead(lead);
    setSheetOpen(true);
  };

  if (isLoading) {
    return (
      <AppLayout title="Leads">
        <div className="space-y-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 card-premium" />)}</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Leads" subtitle={`${filtered.length} leads encontrados`}
      actions={<Button onClick={() => setCreateModalOpen(true)} className="gold-gradient text-primary-foreground font-semibold text-xs sm:text-sm h-8 sm:h-9 px-3 sm:px-4">+ Novo Lead</Button>}>
      
      {/* Filters */}
      <div className="card-premium p-3 sm:p-4 mb-4">
        <div className="flex items-center gap-2 sm:gap-3 mb-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar por nome, empresa ou telefone..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-secondary border-border h-9 sm:h-10 text-sm" />
          </div>
          <Button variant="outline" onClick={() => setFiltersOpen(!filtersOpen)} className="border-border text-muted-foreground h-9 sm:h-10 px-2 sm:px-3">
            <Filter size={14} className="sm:mr-2" />
            <span className="hidden sm:inline">Filtros</span>
            {filtersOpen ? <ChevronUp size={14} className="ml-1" /> : <ChevronDown size={14} className="ml-1" />}
          </Button>
        </div>
        {filtersOpen && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-border">
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="bg-secondary border-border h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{[['all', 'Todos'], ...Object.entries(STATUS_LABELS)].map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Prioridade</label>
              <Select value={prioridadeFilter} onValueChange={setPrioridadeFilter}>
                <SelectTrigger className="bg-secondary border-border h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">Todas</SelectItem><SelectItem value="alta">Alta</SelectItem><SelectItem value="media">Média</SelectItem><SelectItem value="baixa">Baixa</SelectItem></SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Vendedor</label>
              <Select value={vendorFilter} onValueChange={setVendorFilter}>
                <SelectTrigger className="bg-secondary border-border h-9 text-xs"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Ordenar</label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="bg-secondary border-border h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="faturamento_desc">Maior faturamento</SelectItem><SelectItem value="faturamento_asc">Menor faturamento</SelectItem><SelectItem value="recent">Mais recente</SelectItem><SelectItem value="oldest">Mais antigo</SelectItem></SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Faturamento mín. (R$)</label>
              <Input
                type="number"
                value={faturamentoMin}
                onChange={e => setFaturamentoMin(e.target.value)}
                placeholder="Ex: 500000"
                className="bg-secondary border-border h-9 text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Criado a partir de</label>
              <Input
                type="date"
                value={dataInicio}
                onChange={e => setDataInicio(e.target.value)}
                className="bg-secondary border-border h-9 text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Criado até</label>
              <Input
                type="date"
                value={dataFim}
                onChange={e => setDataFim(e.target.value)}
                className="bg-secondary border-border h-9 text-xs"
              />
            </div>
            <div className="flex items-end">
              <Button
                variant="ghost"
                size="sm"
                className="h-9 w-full text-muted-foreground hover:text-foreground text-xs border border-border"
                onClick={() => { setStatusFilter('all'); setPrioridadeFilter('all'); setVendorFilter('all'); setFaturamentoMin(''); setDataInicio(''); setDataFim(''); }}
              >
                Limpar filtros
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Table - Desktop */}
      <div className="card-premium overflow-hidden hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="p-3 text-left text-[10px] font-medium text-muted-foreground uppercase tracking-wider w-8"><Checkbox /></th>
                <th className="p-3 text-left text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Lead</th>
                <th className="p-3 text-left text-[10px] font-medium text-muted-foreground uppercase tracking-wider">WhatsApp</th>
                <th className="p-3 text-left text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Faturamento</th>
                <th className="p-3 text-left text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Dor</th>
                <th className="p-3 text-left text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="p-3 text-left text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Prioridade</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((lead) => {
                const hot = lead.eh_empresario && (lead.faturamento_anual || 0) > 500000 && lead.capacidade_investimento && (lead.fit_mentoria || 0) >= 4;
                const whatsappVal = validateWhatsApp(lead.whatsapp);
                return (
                  <tr key={lead.id} onClick={() => handleOpenLead(lead)} className="border-b border-border/50 hover:bg-secondary/50 cursor-pointer transition-colors">
                    <td className="p-3" onClick={(e) => e.stopPropagation()}><Checkbox /></td>
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-bold text-foreground shrink-0">{getInitials(lead.nome_completo)}</div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate flex items-center gap-1">
                            {lead.nome_completo}
                            {hot && <Flame size={12} className="text-warning shrink-0" />}
                          </p>
                          <p className="text-[10px] text-muted-foreground truncate">{lead.nome_empresa || '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">{lead.whatsapp || '—'}</span>
                        {lead.whatsapp && whatsappVal.warning && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <AlertTriangle size={12} className="text-warning shrink-0" />
                            </TooltipTrigger>
                            <TooltipContent className="bg-popover border-border text-popover-foreground text-xs">
                              {whatsappVal.warning}
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </td>
                    <td className="p-3"><span className="text-xs font-medium text-primary">{formatCurrency(lead.faturamento_anual || 0)}</span></td>
                    <td className="p-3"><span className="text-xs text-muted-foreground truncate max-w-[150px] block">{lead.maior_dor || '—'}</span></td>
                    <td className="p-3"><span className={`text-[10px] px-2 py-1 rounded-full whitespace-nowrap ${statusColor(lead.status_pipeline)}`}>{STATUS_LABELS[lead.status_pipeline as PipelineStatus]}</span></td>
                    <td className="p-3">
                      <span className={`text-[10px] px-2 py-1 rounded-full ${lead.prioridade === 'alta' ? 'bg-destructive/20 text-destructive' : lead.prioridade === 'media' ? 'bg-warning/20 text-warning' : 'bg-muted text-muted-foreground'}`}>
                        {lead.prioridade.charAt(0).toUpperCase() + lead.prioridade.slice(1)}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="p-8 text-center text-sm text-muted-foreground">Nenhum lead encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Card list - Mobile */}
      <div className="space-y-2 md:hidden">
        {filtered.map((lead) => {
          const hot = lead.eh_empresario && (lead.faturamento_anual || 0) > 500000 && lead.capacidade_investimento && (lead.fit_mentoria || 0) >= 4;
          const whatsappVal = validateWhatsApp(lead.whatsapp);
          return (
            <div key={lead.id} onClick={() => handleOpenLead(lead)} className="card-dark p-3 cursor-pointer transition-colors">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-white shrink-0">
                  {getInitials(lead.nome_completo)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <p className="text-sm font-medium text-white truncate">{lead.nome_completo}</p>
                    {hot && <Flame size={12} className="text-primary shrink-0" />}
                  </div>
                  <p className="text-[10px] text-white/50 truncate mb-1.5">{lead.nome_empresa || '—'}</p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/70">
                      {STATUS_LABELS[lead.status_pipeline as PipelineStatus]}
                    </span>
                    {(lead.faturamento_anual || 0) > 0 && (
                      <span className="text-[10px] text-primary font-medium">{formatCurrency(lead.faturamento_anual || 0)}</span>
                    )}
                    {lead.whatsapp && whatsappVal.warning && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-white/60 flex items-center gap-0.5">
                        <AlertTriangle size={9} /> WhatsApp
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="card-dark p-8 text-center text-sm text-white/50">Nenhum lead encontrado.</div>
        )}
      </div>

      <LeadEditSheet lead={selectedLead} profiles={profiles} open={sheetOpen} onOpenChange={setSheetOpen} />

      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="bg-background border-border sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-foreground">Adicionar Novo Lead</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateSubmit} className="space-y-4 py-4">
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs">Nome Completo *</Label>
              <Input required value={newLeadForm.nome_completo} onChange={e => setNewLeadForm({ ...newLeadForm, nome_completo: e.target.value })} className="bg-secondary border-border h-9" placeholder="Ex: João Silva" />
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs">WhatsApp</Label>
              <Input value={newLeadForm.whatsapp} onChange={e => setNewLeadForm({ ...newLeadForm, whatsapp: e.target.value })} className="bg-secondary border-border h-9" placeholder="Ex: 5511999999999" />
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs">Empresa</Label>
              <Input value={newLeadForm.nome_empresa} onChange={e => setNewLeadForm({ ...newLeadForm, nome_empresa: e.target.value })} className="bg-secondary border-border h-9" placeholder="Ex: Tech Solutions" />
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs">Observações (Opcional)</Label>
              <Input value={newLeadForm.observacoes_iniciais} onChange={e => setNewLeadForm({ ...newLeadForm, observacoes_iniciais: e.target.value })} className="bg-secondary border-border h-9" placeholder="Detalhes iniciais..." />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" onClick={() => setCreateModalOpen(false)} className="text-muted-foreground h-9">Cancelar</Button>
              <Button type="submit" disabled={createMutation.isPending} className="bg-primary hover:bg-primary/90 text-primary-foreground h-9">
                {createMutation.isPending ? 'Salvando...' : 'Salvar Lead'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
