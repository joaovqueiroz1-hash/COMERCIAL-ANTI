import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { fetchMetas, createMeta, updateMeta, deleteMeta, fetchLeads, fetchProfiles } from '@/lib/api';
import { formatCurrency } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Target, Plus, Trash2, Edit2, Users, CalendarCheck, DollarSign, CheckCircle, Link2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const TIPOS = [
  { value: 'receita',     label: 'Receita (R$)',       icon: DollarSign },
  { value: 'fechamentos', label: 'Fechamentos',         icon: CheckCircle },
  { value: 'reunioes',    label: 'Reuniões Agendadas',  icon: CalendarCheck },
  { value: 'leads',       label: 'Novos Leads',         icon: Users },
];

function calcValorAtual(tipo: string, leads: any[], dataInicio?: string, dataFim?: string, metaId?: string): number {
  const ini = dataInicio ? new Date(dataInicio) : null;
  const fim = dataFim ? new Date(dataFim + 'T23:59:59') : null;

  const inPeriod = (date: string) => {
    const d = new Date(date);
    if (ini && d < ini) return false;
    if (fim && d > fim) return false;
    return true;
  };

  switch (tipo) {
    case 'receita':
      return leads
        .filter(l => l.status_pipeline === 'fechado' && inPeriod(l.created_at) && (!metaId || l.meta_id === metaId))
        .reduce((s, l) => s + ((l as any).valor_acordado || l.faturamento_anual || 0), 0);
    case 'fechamentos':
      return leads.filter(l => l.status_pipeline === 'fechado' && inPeriod(l.created_at) && (!metaId || l.meta_id === metaId)).length;
    case 'reunioes':
      return leads.filter(l => ['reuniao_agendada', 'reuniao_realizada'].includes(l.status_pipeline) && inPeriod(l.created_at)).length;
    case 'leads':
      return leads.filter(l => inPeriod(l.created_at)).length;
    default:
      return 0;
  }
}

export default function Metas() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMeta, setEditingMeta] = useState<any | null>(null);
  const [form, setForm] = useState({ titulo: '', descricao: '', tipo: 'receita', valor_meta: '', data_inicio: '', data_fim: '' });

  const { data: metas = [], isLoading: metasLoading } = useQuery({ queryKey: ['metas'], queryFn: fetchMetas });
  const { data: leads = [] } = useQuery({ queryKey: ['leads'], queryFn: fetchLeads });

  const createMutation = useMutation({
    mutationFn: (data: any) => createMeta(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['metas'] }); setModalOpen(false); resetForm(); toast({ title: 'Meta criada ✓' }); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: any) => updateMeta(id, updates),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['metas'] }); setModalOpen(false); setEditingMeta(null); resetForm(); toast({ title: 'Meta atualizada ✓' }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteMeta(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['metas'] }); toast({ title: 'Meta removida' }); },
  });

  const resetForm = () => setForm({ titulo: '', descricao: '', tipo: 'receita', valor_meta: '', data_inicio: '', data_fim: '' });

  const openCreate = () => { resetForm(); setEditingMeta(null); setModalOpen(true); };
  const openEdit = (meta: any) => {
    setEditingMeta(meta);
    setForm({
      titulo: meta.titulo,
      descricao: meta.descricao || '',
      tipo: meta.tipo,
      valor_meta: String(meta.valor_meta),
      data_inicio: meta.data_inicio || '',
      data_fim: meta.data_fim || '',
    });
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      titulo: form.titulo,
      descricao: form.descricao || null,
      tipo: form.tipo,
      valor_meta: Number(form.valor_meta),
      data_inicio: form.data_inicio || null,
      data_fim: form.data_fim || null,
      criado_por: user?.id,
      ativo: true,
    };
    if (editingMeta) {
      updateMutation.mutate({ id: editingMeta.id, updates: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  if (metasLoading) {
    return (
      <AppLayout title="Metas">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title="Metas"
      subtitle="Acompanhe os objetivos da equipe"
      actions={
        <Button onClick={openCreate} className="gold-gradient text-primary-foreground font-semibold text-xs h-9 px-4">
          <Plus size={14} className="mr-1" /> Nova Meta
        </Button>
      }
    >
      {metas.length === 0 ? (
        <div className="card-premium flex flex-col items-center justify-center py-20 gap-4">
          <Target size={40} className="text-muted-foreground/30" />
          <p className="text-muted-foreground text-sm">Nenhuma meta cadastrada ainda.</p>
          <Button onClick={openCreate} className="gold-gradient text-primary-foreground text-xs h-9 px-4">
            <Plus size={14} className="mr-1" /> Criar primeira meta
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {metas.map((meta: any) => {
            const atual = calcValorAtual(meta.tipo, leads, meta.data_inicio, meta.data_fim, meta.id);
            const pct = meta.valor_meta > 0 ? Math.min((atual / meta.valor_meta) * 100, 100) : 0;
            const tipoConfig = TIPOS.find(t => t.value === meta.tipo);
            const TipoIcon = tipoConfig?.icon ?? Target;
            const isReceita = meta.tipo === 'receita';
            const formatVal = (v: number) => isReceita ? formatCurrency(v) : String(Math.round(v));

            // Always compute both linked stats regardless of meta type
            const leadsVinculados = (leads as any[]).filter(l => l.meta_id === meta.id && l.status_pipeline === 'fechado');
            const statsFechamentos = leadsVinculados.length;
            const statsReceita = leadsVinculados.reduce((sum: number, l: any) => sum + (l.valor_acordado || 0), 0);

            return (
              <div key={meta.id} className="card-premium p-5 flex flex-col gap-3 animate-fade-in">
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <TipoIcon size={17} className="text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{meta.titulo}</p>
                      <p className="text-[10px] text-muted-foreground">{tipoConfig?.label}</p>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => openEdit(meta)} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                      <Edit2 size={13} />
                    </button>
                    <button onClick={() => deleteMutation.mutate(meta.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Primary progress value */}
                <div className="flex items-end justify-between gap-2">
                  <div>
                    <p className="text-2xl font-bold text-foreground">{formatVal(atual)}</p>
                    <p className="text-[10px] text-muted-foreground">meta: {formatVal(meta.valor_meta)}</p>
                  </div>
                  <div className={`text-2xl font-bold ${pct >= 100 ? 'text-primary' : pct >= 70 ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {Math.round(pct)}%
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-secondary rounded-full h-1.5">
                  <div
                    className="h-1.5 rounded-full bg-primary transition-all duration-700"
                    style={{ width: `${pct}%` }}
                  />
                </div>

                {/* Both metrics — always visible */}
                <div className="flex rounded-lg overflow-hidden border border-border">
                  <div className="flex-1 flex flex-col items-center py-2 gap-0.5 bg-secondary/40">
                    <span className="text-xs font-bold text-foreground">{statsFechamentos}</span>
                    <span className="text-[9px] text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                      <CheckCircle size={8} /> Fechamentos
                    </span>
                  </div>
                  <div className="w-px bg-border" />
                  <div className="flex-1 flex flex-col items-center py-2 gap-0.5 bg-secondary/40">
                    <span className="text-xs font-bold text-foreground">{formatCurrency(statsReceita)}</span>
                    <span className="text-[9px] text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                      <DollarSign size={8} /> Receita
                    </span>
                  </div>
                  <div className="w-px bg-border" />
                  <div className="flex-1 flex flex-col items-center py-2 gap-0.5 bg-secondary/40">
                    <span className="text-xs font-bold text-foreground">{leadsVinculados.length > 0 ? leadsVinculados[leadsVinculados.length - 1]?.nome_completo?.split(' ')[0] ?? '—' : '—'}</span>
                    <span className="text-[9px] text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                      <Link2 size={8} /> Último
                    </span>
                  </div>
                </div>

                {/* Period */}
                {(meta.data_inicio || meta.data_fim) && (
                  <p className="text-[10px] text-muted-foreground">
                    {meta.data_inicio && new Date(meta.data_inicio).toLocaleDateString('pt-BR')}
                    {meta.data_inicio && meta.data_fim && ' → '}
                    {meta.data_fim && new Date(meta.data_fim).toLocaleDateString('pt-BR')}
                  </p>
                )}

                {meta.descricao && <p className="text-[11px] text-muted-foreground leading-relaxed">{meta.descricao}</p>}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal criar/editar */}
      <Dialog open={modalOpen} onOpenChange={(v) => { if (!v) { setModalOpen(false); setEditingMeta(null); resetForm(); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingMeta ? 'Editar Meta' : 'Nova Meta'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Título *</Label>
              <Input required value={form.titulo} onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))} placeholder="Ex: Receita Maio 2026" className="h-9 bg-secondary border-border text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Tipo de Meta *</Label>
              <Select value={form.tipo} onValueChange={v => setForm(p => ({ ...p, tipo: v }))}>
                <SelectTrigger className="h-9 bg-secondary border-border text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                {form.tipo === 'receita' ? 'Valor Meta (R$) *' : 'Quantidade Meta *'}
              </Label>
              <Input required type="number" value={form.valor_meta} onChange={e => setForm(p => ({ ...p, valor_meta: e.target.value }))} placeholder={form.tipo === 'receita' ? '500000' : '10'} className="h-9 bg-secondary border-border text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Data Início</Label>
                <Input type="date" value={form.data_inicio} onChange={e => setForm(p => ({ ...p, data_inicio: e.target.value }))} className="h-9 bg-secondary border-border text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Data Fim</Label>
                <Input type="date" value={form.data_fim} onChange={e => setForm(p => ({ ...p, data_fim: e.target.value }))} className="h-9 bg-secondary border-border text-sm" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Descrição</Label>
              <Textarea value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} placeholder="Detalhes da meta..." className="bg-secondary border-border text-sm min-h-[60px]" />
            </div>
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" className="flex-1 h-9" onClick={() => { setModalOpen(false); resetForm(); }}>Cancelar</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="flex-1 h-9 gold-gradient text-primary-foreground">
                {editingMeta ? 'Salvar' : 'Criar Meta'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
