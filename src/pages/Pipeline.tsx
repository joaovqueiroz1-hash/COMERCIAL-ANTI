import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { fetchLeads, fetchProfiles, updateLead, updateLeadExtra, createPipelineLog, fetchAllLeadTagsMap, fetchMetas, Lead } from '@/lib/api';
import type { TagSistema } from '@/lib/api';
import { PipelineStatus, PIPELINE_COLUMNS, MOTIVOS_PERDA, formatCurrency, getInitials } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { DndContext, DragEndEvent, DragOverlay, closestCorners, PointerSensor, useSensor, useSensors, useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Flame, Clock, Plus, Search, GripVertical, Users, DollarSign, SlidersHorizontal } from 'lucide-react';
import { useMemo } from 'react';
import { toast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { LeadEditSheet } from '@/components/LeadEditSheet';

function LeadCard({ lead, profiles, tags, onClick, cardNumber }: { lead: Lead; profiles: any[]; tags?: TagSistema[]; onClick?: () => void; cardNumber?: number }) {
  const now = new Date();
  const daysSinceContact = lead.ultimo_contato
    ? Math.floor((now.getTime() - new Date(lead.ultimo_contato).getTime()) / (24 * 60 * 60 * 1000))
    : null;
  const isOverdue = daysSinceContact !== null && daysSinceContact > 2;
  const hot = lead.eh_empresario && (lead.faturamento_anual || 0) > 500000 && lead.capacidade_investimento && (lead.fit_mentoria || 0) >= 4;
  const vendedor = profiles.find(p => p.id === lead.vendedor_id);

  return (
    <div onClick={onClick} className="card-lead p-3 cursor-pointer transition-all animate-fade-in">
      <div className="flex items-start justify-between mb-1 gap-1">
        <p className="text-sm font-medium text-foreground truncate flex-1">{lead.nome_completo}</p>
        <div className="flex items-center gap-1 shrink-0">
          {hot && <Flame size={13} className="text-primary" />}
          {cardNumber != null && (
            <span className="text-[9px] font-mono font-bold px-1 py-0.5 rounded bg-secondary text-muted-foreground/40 leading-none">
              #{cardNumber}
            </span>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground truncate mb-2">{lead.nome_empresa || '—'}</p>

      {tags && tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {tags.map(tag => (
            <span
              key={tag.id}
              className="text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none"
              style={{ backgroundColor: tag.cor + '30', color: tag.cor, border: `1px solid ${tag.cor}50` }}
            >
              {tag.nome}
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-1 mb-2">
        {(lead.faturamento_anual || 0) > 0 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-foreground/70 font-medium">{formatCurrency(lead.faturamento_anual || 0)}</span>
        )}
        {lead.instagram_empresa && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary/60 text-muted-foreground/60 font-medium truncate max-w-[90px]">{lead.instagram_empresa}</span>
        )}
        {(lead.tags || []).map((tag) => (
          <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-secondary/50 text-muted-foreground/70 font-medium">{tag}</span>
        ))}
        {isOverdue && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-600 font-medium animate-pulse flex items-center gap-0.5">
            <Clock size={8} /> {daysSinceContact}d
          </span>
        )}
      </div>

      <div className="flex items-center justify-between">
        {vendedor ? (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/25 text-primary font-semibold truncate max-w-[120px]">
            {vendedor.nome}
          </span>
        ) : (
          <span className="text-[10px] text-muted-foreground/40">Sem vendedor</span>
        )}
        <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-[9px] font-bold text-muted-foreground/70 shrink-0">
          {vendedor ? vendedor.nome.charAt(0).toUpperCase() : '?'}
        </div>
      </div>
    </div>
  );
}

function SortableLeadCard({ lead, profiles, tags, onClick, cardNumber }: { lead: Lead; profiles: any[]; tags?: TagSistema[]; onClick?: () => void; cardNumber?: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lead.id, data: { columnId: lead.status_pipeline } });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <div ref={setNodeRef} style={style} {...attributes} className="relative group">
      <div
        {...listeners}
        className="absolute left-0 top-0 bottom-0 w-5 flex items-center justify-center cursor-grab active:cursor-grabbing z-10 opacity-0 group-hover:opacity-100 transition-opacity rounded-l-lg hover:bg-black/5"
        title="Arrastar"
      >
        <GripVertical size={11} className="text-muted-foreground/50" />
      </div>
      <div className="pl-4">
        <LeadCard lead={lead} profiles={profiles} tags={tags} onClick={onClick} cardNumber={cardNumber} />
      </div>
    </div>
  );
}

function DroppableColumn({ id, children, className }: { id: string; children: React.ReactNode; className?: string }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`${className} ${isOver ? 'ring-2 ring-primary/30' : ''}`}>
      {children}
    </div>
  );
}

export default function Pipeline() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [vendorFilter, setVendorFilter] = useState('all');
  const [nichoFilter, setNichoFilter] = useState('');
  const [faturamentoMin, setFaturamentoMin] = useState('');
  const [faturamentoMax, setFaturamentoMax] = useState('');
  const [dorFilter, setDorFilter] = useState('');
  const [reuniaoFilter, setReuniaoFilter] = useState<'all' | 'sim' | 'nao'>('all');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [pendingLostLead, setPendingLostLead] = useState<{ leadId: string; oldStatus: string } | null>(null);
  const [lossReason, setLossReason] = useState('');
  const [pendingClosedLead, setPendingClosedLead] = useState<{ leadId: string; oldStatus: string } | null>(null);
  const [closedMetaId, setClosedMetaId] = useState('');
  const [closedValorAcordado, setClosedValorAcordado] = useState('');

  const { data: leads = [], isLoading } = useQuery({ queryKey: ['leads'], queryFn: fetchLeads });
  const { data: profiles = [] } = useQuery({ queryKey: ['profiles'], queryFn: fetchProfiles });
  const { data: tagsMap = {} } = useQuery({ queryKey: ['lead_tags_map'], queryFn: fetchAllLeadTagsMap });
  const { data: metas = [] } = useQuery({ queryKey: ['metas'], queryFn: fetchMetas });

  const filteredLeads = useMemo(() => {
    let result = leads;
    if (search.trim()) {
      const s = search.toLowerCase();
      result = result.filter(l =>
        l.nome_completo.toLowerCase().includes(s) ||
        (l.nome_empresa || '').toLowerCase().includes(s) ||
        (l.whatsapp || '').includes(s) ||
        (l.email || '').toLowerCase().includes(s)
      );
    }
    if (vendorFilter !== 'all') {
      result = result.filter(l => l.vendedor_id === vendorFilter);
    }
    if (nichoFilter.trim()) {
      const n = nichoFilter.toLowerCase();
      result = result.filter(l => ((l as any).nicho || '').toLowerCase().includes(n));
    }
    if (faturamentoMin) result = result.filter(l => (l.faturamento_anual || 0) >= Number(faturamentoMin));
    if (faturamentoMax) result = result.filter(l => (l.faturamento_anual || 0) <= Number(faturamentoMax));
    if (dorFilter.trim()) {
      const d = dorFilter.toLowerCase();
      result = result.filter(l => (l.maior_dor || '').toLowerCase().includes(d));
    }
    if (reuniaoFilter !== 'all') result = result.filter(l => reuniaoFilter === 'sim' ? (l as any).reuniao_agendada === true : !(l as any).reuniao_agendada);
    if (dataInicio) result = result.filter(l => new Date(l.created_at) >= new Date(dataInicio));
    if (dataFim) result = result.filter(l => new Date(l.created_at) <= new Date(dataFim + 'T23:59:59'));
    return result;
  }, [leads, search, vendorFilter, nichoFilter, faturamentoMin, faturamentoMax, dorFilter, reuniaoFilter, dataInicio, dataFim]);

  const moveMutation = useMutation({
    mutationFn: async ({ leadId, newStatus, oldStatus, motivo, metaId, valorAcordado }: { leadId: string; newStatus: string; oldStatus: string; motivo?: string; metaId?: string; valorAcordado?: number }) => {
      // Typed update: only fields guaranteed to be in the schema
      const baseUpdate: any = { status_pipeline: newStatus as any };
      if (motivo) baseUpdate.motivo_perda = motivo;
      if (valorAcordado) baseUpdate.valor_acordado = valorAcordado;
      await updateLead(leadId, baseUpdate);

      // meta_id is a newer column — update separately so the move always succeeds
      if (metaId) await updateLeadExtra(leadId, { meta_id: metaId });

      if (user) {
        await createPipelineLog({ lead_id: leadId, status_anterior: oldStatus, status_novo: newStatus, alterado_por: user.id });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast({ title: 'Lead movido ✓' });
    },
    onError: (err: any) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast({ title: 'Erro ao mover lead', description: err?.message || 'Verifique se o SQL de migração foi executado no Supabase.', variant: 'destructive' });
    },
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const leadId = active.id as string;
    const overId = over.id as string;

    let targetColumnKey = PIPELINE_COLUMNS.find(c => c.key === overId)?.key;

    if (!targetColumnKey) {
      const overLead = leads.find(l => l.id === overId);
      if (overLead) targetColumnKey = overLead.status_pipeline;
    }

    if (targetColumnKey) {
      const lead = leads.find(l => l.id === leadId);
      const alreadyInTarget = lead && (
        lead.status_pipeline === targetColumnKey ||
        (targetColumnKey === 'vendido' && lead.status_pipeline === 'fechado')
      );
      if (lead && !alreadyInTarget) {
        if (targetColumnKey === 'vendido') {
          setPendingClosedLead({ leadId, oldStatus: lead.status_pipeline });
          setClosedMetaId('');
          setClosedValorAcordado('');
        } else if (targetColumnKey === 'perdido') {
          setPendingLostLead({ leadId, oldStatus: lead.status_pipeline });
          setLossReason('');
        } else {
          moveMutation.mutate({ leadId, newStatus: targetColumnKey, oldStatus: lead.status_pipeline });
        }
      }
    }
  };

  const confirmLoss = () => {
    if (!pendingLostLead || !lossReason) return;
    moveMutation.mutate({
      leadId: pendingLostLead.leadId,
      newStatus: 'perdido',
      oldStatus: pendingLostLead.oldStatus,
      motivo: lossReason,
    });
    setPendingLostLead(null);
    setLossReason('');
  };

  const confirmClose = () => {
    if (!pendingClosedLead) return;
    moveMutation.mutate({
      leadId: pendingClosedLead.leadId,
      newStatus: 'vendido',
      oldStatus: pendingClosedLead.oldStatus,
      metaId: closedMetaId || undefined,
      valorAcordado: closedValorAcordado ? Number(closedValorAcordado) : undefined,
    });
    setPendingClosedLead(null);
    setClosedMetaId('');
    setClosedValorAcordado('');
  };

  const handleCardClick = (lead: Lead) => {
    if (activeId) return;
    setSelectedLead(lead);
    setSheetOpen(true);
  };

  const activeLead = activeId ? leads.find(l => l.id === activeId) : null;

  const leadNumberMap = useMemo(() => {
    const sorted = [...leads].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    return Object.fromEntries(sorted.map((l, i) => [l.id, i + 1]));
  }, [leads]);

  if (isLoading) {
    return (
      <AppLayout title="Pipeline">
        <div className="flex gap-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="w-[220px] h-[400px] shrink-0 card-premium" />)}
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Pipeline" subtitle={`${filteredLeads.length} leads ${search || vendorFilter !== 'all' || nichoFilter || faturamentoMin || faturamentoMax || dorFilter || reuniaoFilter !== 'all' || dataInicio || dataFim ? 'filtrados' : 'no pipeline'}`}>
      {/* Filters bar */}
      <div className="mb-2 animate-fade-in flex flex-wrap gap-2 items-center">
        <div className="relative w-72">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, empresa, WhatsApp..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-card border-border h-9 text-sm"
          />
        </div>

        <Select value={vendorFilter} onValueChange={setVendorFilter}>
          <SelectTrigger className="w-48 h-9 bg-card border-border text-sm">
            <Users size={14} className="text-muted-foreground mr-1" />
            <SelectValue placeholder="Todos os vendedores" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os vendedores</SelectItem>
            {profiles.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Toggle filtros avançados */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowFilters(v => !v)}
          className={`h-9 text-xs border-border gap-1.5 ${showFilters ? 'bg-primary/5 border-primary/30 text-primary' : ''}`}
        >
          <SlidersHorizontal size={13} /> Filtros
          {(nichoFilter || faturamentoMin || faturamentoMax || dorFilter || reuniaoFilter !== 'all' || dataInicio || dataFim) && (
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
          )}
        </Button>

        {(search || vendorFilter !== 'all' || showFilters) && (
          <Button variant="ghost" size="sm" className="h-9 text-muted-foreground hover:text-foreground text-xs"
            onClick={() => { setSearch(''); setVendorFilter('all'); setNichoFilter(''); setFaturamentoMin(''); setFaturamentoMax(''); setDorFilter(''); setReuniaoFilter('all'); setDataInicio(''); setDataFim(''); }}>
            Limpar filtros
          </Button>
        )}
      </div>

      {showFilters && (
        <div className="card-premium p-3 mb-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 animate-fade-in">
          <div className="space-y-1">
            <p className="text-[9px] uppercase font-bold text-muted-foreground tracking-wide">Nicho</p>
            <Input value={nichoFilter} onChange={e => setNichoFilter(e.target.value)} placeholder="Ex: Saúde, Varejo..." className="h-8 text-xs bg-secondary border-border" />
          </div>
          <div className="space-y-1">
            <p className="text-[9px] uppercase font-bold text-muted-foreground tracking-wide">Maior Dor</p>
            <Input value={dorFilter} onChange={e => setDorFilter(e.target.value)} placeholder="Buscar na dor..." className="h-8 text-xs bg-secondary border-border" />
          </div>
          <div className="space-y-1">
            <p className="text-[9px] uppercase font-bold text-muted-foreground tracking-wide">Fat. Mín (R$)</p>
            <Input type="number" value={faturamentoMin} onChange={e => setFaturamentoMin(e.target.value)} placeholder="0" className="h-8 text-xs bg-secondary border-border" />
          </div>
          <div className="space-y-1">
            <p className="text-[9px] uppercase font-bold text-muted-foreground tracking-wide">Fat. Máx (R$)</p>
            <Input type="number" value={faturamentoMax} onChange={e => setFaturamentoMax(e.target.value)} placeholder="Ilimitado" className="h-8 text-xs bg-secondary border-border" />
          </div>
          <div className="space-y-1">
            <p className="text-[9px] uppercase font-bold text-muted-foreground tracking-wide">Reunião Agendada</p>
            <Select value={reuniaoFilter} onValueChange={v => setReuniaoFilter(v as any)}>
              <SelectTrigger className="h-8 text-xs bg-secondary border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="sim">Sim</SelectItem>
                <SelectItem value="nao">Não</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <p className="text-[9px] uppercase font-bold text-muted-foreground tracking-wide">Criado de</p>
            <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="h-8 text-xs bg-secondary border-border" />
          </div>
          <div className="space-y-1">
            <p className="text-[9px] uppercase font-bold text-muted-foreground tracking-wide">Criado até</p>
            <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="h-8 text-xs bg-secondary border-border" />
          </div>
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={(e) => setActiveId(e.active.id as string)} onDragEnd={handleDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: 'calc(100vh - 220px)' }}>
          {PIPELINE_COLUMNS.map((col, colIndex) => {
            const columnLeads = filteredLeads.filter(l =>
              col.key === 'vendido'
                ? (l.status_pipeline === 'vendido' || l.status_pipeline === 'fechado')
                : l.status_pipeline === col.key
            );
            const colNum = String(colIndex + 1).padStart(2, '0');
            const borderTop =
              col.key === 'vendido' ? 'border-t-2 border-t-primary' :
              col.key === 'perdido' ? 'border-t-2 border-t-muted-foreground/30' : '';
            return (
              <DroppableColumn key={col.key} id={col.key} className={`min-w-[240px] w-[240px] shrink-0 card-premium flex flex-col ${borderTop}`}>
                <div className="p-3 border-b border-border flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[10px] font-mono font-bold text-muted-foreground/40 shrink-0">{colNum}</span>
                    <span className="text-xs font-semibold text-foreground truncate">{col.label}</span>
                    <span className="text-[10px] bg-secondary text-muted-foreground px-1.5 py-0.5 rounded-full font-medium shrink-0">{columnLeads.length}</span>
                  </div>
                  <button className="text-muted-foreground hover:text-primary transition-colors shrink-0"><Plus size={14} /></button>
                </div>
                <SortableContext id={col.key} items={columnLeads.map(l => l.id)} strategy={verticalListSortingStrategy}>
                  <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-300px)]">
                    {columnLeads.map(lead => (
                      <SortableLeadCard
                        key={lead.id}
                        lead={lead}
                        profiles={profiles}
                        tags={tagsMap[lead.id]}
                        onClick={() => handleCardClick(lead)}
                        cardNumber={leadNumberMap[lead.id]}
                      />
                    ))}
                    {columnLeads.length === 0 && <p className="text-[10px] text-muted-foreground text-center py-4">Vazio</p>}
                  </div>
                </SortableContext>
              </DroppableColumn>
            );
          })}
        </div>
        <DragOverlay>{activeLead ? <LeadCard lead={activeLead} profiles={profiles} tags={tagsMap[activeLead.id]} /> : null}</DragOverlay>
      </DndContext>

      {/* Loss reason dialog */}
      <Dialog open={!!pendingLostLead} onOpenChange={(open) => { if (!open) { setPendingLostLead(null); setLossReason(''); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Motivo da perda</DialogTitle>
            <DialogDescription>Selecione o motivo pelo qual este lead foi perdido.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 mt-2">
            {MOTIVOS_PERDA.map(motivo => (
              <button
                key={motivo}
                onClick={() => setLossReason(motivo)}
                className={`text-left text-sm px-3 py-2.5 rounded-lg border transition-all ${
                  lossReason === motivo
                    ? 'border-primary bg-primary/5 text-foreground font-medium'
                    : 'border-border bg-secondary/50 text-muted-foreground hover:border-primary/40 hover:text-foreground'
                }`}
              >
                {motivo}
              </button>
            ))}
          </div>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" className="flex-1" onClick={() => { setPendingLostLead(null); setLossReason(''); }}>
              Cancelar
            </Button>
            <Button
              className="flex-1 gold-gradient text-primary-foreground"
              disabled={!lossReason}
              onClick={confirmLoss}
            >
              Confirmar perda
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Fechado dialog */}
      <Dialog open={!!pendingClosedLead} onOpenChange={(open) => { if (!open) { setPendingClosedLead(null); setClosedMetaId(''); setClosedValorAcordado(''); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><DollarSign size={16} className="text-primary" /> Lead Fechado!</DialogTitle>
            <DialogDescription>Vincule a uma meta e informe o valor acordado (opcional).</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 mt-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Meta</Label>
              <Select value={closedMetaId || '__none__'} onValueChange={v => setClosedMetaId(v === '__none__' ? '' : v)}>
                <SelectTrigger className="h-9 bg-secondary border-border text-sm"><SelectValue placeholder="Selecionar meta..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhuma</SelectItem>
                  {(metas as any[]).map(m => <SelectItem key={m.id} value={m.id}>{m.titulo}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Valor Acordado (R$)</Label>
              <Input
                type="number"
                value={closedValorAcordado}
                onChange={e => setClosedValorAcordado(e.target.value)}
                placeholder="Ex: 15000"
                className="h-9 bg-secondary border-border text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" className="flex-1" onClick={() => { setPendingClosedLead(null); setClosedMetaId(''); setClosedValorAcordado(''); }}>
              Cancelar
            </Button>
            <Button className="flex-1 gold-gradient text-primary-foreground" onClick={confirmClose}>
              Confirmar fechamento
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <LeadEditSheet lead={selectedLead} profiles={profiles} open={sheetOpen} onOpenChange={setSheetOpen} />
    </AppLayout>
  );
}
