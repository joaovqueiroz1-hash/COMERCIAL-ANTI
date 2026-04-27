import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { fetchLeads, fetchProfiles, updateLead, createPipelineLog, fetchAllLeadTagsMap, Lead } from '@/lib/api';
import type { TagSistema } from '@/lib/api';
import { PipelineStatus, PIPELINE_COLUMNS, formatCurrency, getInitials } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { DndContext, DragEndEvent, DragOverlay, DragOverEvent, closestCorners, PointerSensor, useSensor, useSensors, useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Flame, Clock, Plus, Search, GripVertical } from 'lucide-react';
import { useMemo } from 'react';
import { toast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
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
    <div onClick={onClick} className="card-premium p-3 cursor-pointer hover:border-primary/40 transition-all animate-fade-in">
      <div className="flex items-start justify-between mb-1 gap-1">
        <p className="text-sm font-medium text-foreground truncate flex-1">{lead.nome_completo}</p>
        <div className="flex items-center gap-1 shrink-0">
          {hot && <Flame size={13} className="text-warning" />}
          {cardNumber != null && (
            <span className="text-[9px] font-mono font-bold px-1 py-0.5 rounded bg-white/8 text-white/35 leading-none">
              #{cardNumber}
            </span>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground truncate mb-2">{lead.nome_empresa || '—'}</p>

      {/* Colored system tags */}
      {tags && tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {tags.map(tag => (
            <span
              key={tag.id}
              className="text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none"
              style={{ backgroundColor: tag.cor + '28', color: tag.cor, border: `1px solid ${tag.cor}45` }}
            >
              {tag.nome}
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-1 mb-2">
        {(lead.faturamento_anual || 0) > 0 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/8 text-white/60 font-medium">{formatCurrency(lead.faturamento_anual || 0)}</span>
        )}
        {lead.instagram_empresa && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/8 text-white/50 font-medium truncate max-w-[90px]">{lead.instagram_empresa}</span>
        )}
        {(lead.tags || []).map((tag) => (
          <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-white/8 text-white/55 font-medium">{tag}</span>
        ))}
        {isOverdue && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/20 text-destructive font-medium animate-pulse flex items-center gap-0.5">
            <Clock size={8} /> {daysSinceContact}d
          </span>
        )}
      </div>
      <div className="flex items-center justify-end">
        <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-[9px] font-bold text-muted-foreground">
          {vendedor ? vendedor.nome.charAt(0) : '?'}
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
      {/* Drag handle — visible on hover, avoids conflict with card click */}
      <div
        {...listeners}
        className="absolute left-0 top-0 bottom-0 w-5 flex items-center justify-center cursor-grab active:cursor-grabbing z-10 opacity-0 group-hover:opacity-100 transition-opacity rounded-l-lg hover:bg-white/5"
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
    <div ref={setNodeRef} className={`${className} ${isOver ? 'ring-2 ring-primary/40' : ''}`}>
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

  const { data: leads = [], isLoading } = useQuery({ queryKey: ['leads'], queryFn: fetchLeads });
  const { data: profiles = [] } = useQuery({ queryKey: ['profiles'], queryFn: fetchProfiles });
  const { data: tagsMap = {} } = useQuery({ queryKey: ['lead_tags_map'], queryFn: fetchAllLeadTagsMap });

  // Filter leads by search
  const filteredLeads = search.trim()
    ? leads.filter(l => {
        const s = search.toLowerCase();
        return l.nome_completo.toLowerCase().includes(s) ||
          (l.nome_empresa || '').toLowerCase().includes(s) ||
          (l.whatsapp || '').includes(s) ||
          (l.email || '').toLowerCase().includes(s);
      })
    : leads;

  const moveMutation = useMutation({
    mutationFn: async ({ leadId, newStatus, oldStatus }: { leadId: string; newStatus: string; oldStatus: string }) => {
      await updateLead(leadId, { status_pipeline: newStatus as any });
      if (user) {
        await createPipelineLog({ lead_id: leadId, status_anterior: oldStatus, status_novo: newStatus, alterado_por: user.id });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast({ title: 'Lead movido ✓' });
    },
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const leadId = active.id as string;
    const overId = over.id as string;

    // Check if dropped on a column directly
    let targetColumnKey = PIPELINE_COLUMNS.find(c => c.key === overId)?.key;

    // If dropped on another lead card, find which column that lead belongs to
    if (!targetColumnKey) {
      const overLead = leads.find(l => l.id === overId);
      if (overLead) {
        targetColumnKey = overLead.status_pipeline;
      }
    }

    if (targetColumnKey) {
      const lead = leads.find(l => l.id === leadId);
      if (lead && lead.status_pipeline !== targetColumnKey) {
        moveMutation.mutate({ leadId, newStatus: targetColumnKey, oldStatus: lead.status_pipeline });
      }
    }
  };

  const handleCardClick = (lead: Lead) => {
    if (activeId) return;
    setSelectedLead(lead);
    setSheetOpen(true);
  };

  const activeLead = activeId ? leads.find(l => l.id === activeId) : null;

  // Global sequential number for each lead (stable, sorted by creation date)
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
    <AppLayout title="Pipeline" subtitle={`${filteredLeads.length} leads ${search ? 'encontrados' : 'no pipeline'}`}>
      {/* Search bar */}
      <div className="mb-4 animate-fade-in">
        <div className="relative max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, empresa, WhatsApp ou email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-secondary border-border h-9 text-sm"
          />
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={(e) => setActiveId(e.active.id as string)} onDragEnd={handleDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: 'calc(100vh - 200px)' }}>
          {PIPELINE_COLUMNS.map((col, colIndex) => {
            const columnLeads = filteredLeads.filter(l => l.status_pipeline === col.key);
            const colNum = String(colIndex + 1).padStart(2, '0');
            const borderTop =
              col.key === 'fechado' ? 'border-t-2 border-t-white/50' :
              col.key === 'perdido' ? 'border-t-2 border-t-white/15' : '';
            return (
              <DroppableColumn key={col.key} id={col.key} className={`min-w-[230px] w-[230px] shrink-0 card-premium flex flex-col ${borderTop}`}>
                <div className="p-3 border-b border-border flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[10px] font-mono font-bold text-white/25 shrink-0">{colNum}</span>
                    <span className="text-xs font-semibold text-foreground truncate">{col.label}</span>
                    <span className="text-[10px] bg-secondary text-muted-foreground px-1.5 py-0.5 rounded-full font-medium shrink-0">{columnLeads.length}</span>
                  </div>
                  <button className="text-muted-foreground hover:text-primary transition-colors shrink-0"><Plus size={14} /></button>
                </div>
                <SortableContext id={col.key} items={columnLeads.map(l => l.id)} strategy={verticalListSortingStrategy}>
                  <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-280px)]">
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

      <LeadEditSheet lead={selectedLead} profiles={profiles} open={sheetOpen} onOpenChange={setSheetOpen} />
    </AppLayout>
  );
}
