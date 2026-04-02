import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { fetchProximasAcoes, fetchLeads, fetchProfiles, updateProximaAcao } from '@/lib/api';
import { Calendar, Clock, CheckCircle, Pencil } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const tipoColors: Record<string, string> = {
  reuniao: 'bg-white/10 text-white/65',
  whatsapp: 'bg-white/10 text-white/65',
  ligacao: 'bg-white/10 text-white/65',
  email: 'bg-white/10 text-white/65',
};
const tipoLabel: Record<string, string> = {
  reuniao: 'Reunião',
  whatsapp: 'WhatsApp',
  ligacao: 'Ligação',
  email: 'E-mail',
};

export default function Agenda() {
  const now = new Date();
  const queryClient = useQueryClient();
  const { data: acoes = [], isLoading } = useQuery({ queryKey: ['proximas_acoes'], queryFn: () => fetchProximasAcoes() });
  const { data: leads = [] } = useQuery({ queryKey: ['leads'], queryFn: fetchLeads });
  const { data: profiles = [] } = useQuery({ queryKey: ['profiles'], queryFn: fetchProfiles });

  const [editAcao, setEditAcao] = useState<any | null>(null);
  const [editTitulo, setEditTitulo] = useState('');
  const [editTipo, setEditTipo] = useState('');
  const [editDataHora, setEditDataHora] = useState('');

  const concluirMutation = useMutation({
    mutationFn: (id: string) => updateProximaAcao(id, { concluida: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proximas_acoes'] });
      toast({ title: 'Ação concluída ✓' });
    },
  });

  const editarMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: any }) => updateProximaAcao(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proximas_acoes'] });
      toast({ title: 'Ação atualizada ✓' });
      setEditAcao(null);
    },
    onError: (e: any) => {
      toast({ title: 'Erro ao atualizar', description: e.message, variant: 'destructive' });
    },
  });

  const handleOpenEdit = (acao: any) => {
    setEditAcao(acao);
    setEditTitulo(acao.titulo || '');
    setEditTipo(acao.tipo || '');
    // Format datetime-local value
    const d = new Date(acao.data_hora);
    const pad = (n: number) => String(n).padStart(2, '0');
    setEditDataHora(`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
  };

  const handleSaveEdit = () => {
    if (!editAcao) return;
    editarMutation.mutate({
      id: editAcao.id,
      updates: {
        titulo: editTitulo,
        tipo: editTipo,
        data_hora: new Date(editDataHora).toISOString(),
      },
    });
  };

  const pendentes = acoes.filter((a) => !a.concluida).sort((a, b) => new Date(a.data_hora).getTime() - new Date(b.data_hora).getTime());

  if (isLoading) return <AppLayout title="Agenda"><Skeleton className="h-40 card-premium" /></AppLayout>;

  return (
    <AppLayout title="Agenda" subtitle="Próximas ações e reuniões">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="card-premium p-4 border-l-2 border-l-primary">
          <div className="flex items-center gap-3">
            <Calendar size={18} className="text-primary" />
            <h2 className="text-sm font-semibold text-foreground">
              Hoje — {now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </h2>
          </div>
        </div>

        {pendentes.length > 0 ? pendentes.map((acao) => {
          const lead = leads.find((l) => l.id === acao.lead_id);
          const resp = profiles.find((u) => u.id === acao.responsavel_id);
          const date = new Date(acao.data_hora);
          const isOverdue = date < now;
          return (
            <div key={acao.id} className={`card-premium p-4 ${isOverdue ? 'border-l-2 border-l-destructive' : ''}`}>
              <div className="flex items-start gap-4">
                <div className="text-center shrink-0 w-12">
                  <p className="text-lg font-bold text-foreground">{date.getDate()}</p>
                  <p className="text-[10px] text-muted-foreground uppercase">{date.toLocaleDateString('pt-BR', { month: 'short' })}</p>
                  <p className="text-xs text-primary font-medium">{date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="text-sm font-medium text-foreground">{acao.titulo}</h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${tipoColors[acao.tipo || ''] || 'bg-white/10 text-white/65'}`}>
                      {tipoLabel[acao.tipo || ''] || acao.tipo}
                    </span>
                    {isOverdue && <span className="text-[10px] px-2 py-0.5 rounded-full bg-destructive/20 text-destructive">Atrasada</span>}
                  </div>
                  {acao.descricao && <p className="text-xs text-muted-foreground mb-1">{acao.descricao}</p>}
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span>Lead: {lead?.nome_completo || '—'}</span>
                    <span>•</span>
                    <span>Resp: {resp?.nome?.split(' ')[0] || '—'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleOpenEdit(acao)}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    title="Editar"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => concluirMutation.mutate(acao.id)}
                    disabled={concluirMutation.isPending}
                    className="text-muted-foreground hover:text-success transition-colors"
                    title="Concluir"
                  >
                    <CheckCircle size={20} />
                  </button>
                </div>
              </div>
            </div>
          );
        }) : (
          <div className="card-premium p-8 text-center">
            <Clock size={32} className="mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">Nenhuma ação pendente</p>
          </div>
        )}
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editAcao} onOpenChange={(o) => { if (!o) setEditAcao(null); }}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Editar Ação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Título</Label>
              <Input value={editTitulo} onChange={(e) => setEditTitulo(e.target.value)} className="bg-secondary border-border mt-1" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Canal</Label>
              <div className="flex gap-2 mt-1 flex-wrap">
                {['whatsapp', 'ligacao', 'reuniao', 'email'].map((t) => (
                  <button
                    key={t}
                    onClick={() => setEditTipo(t)}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${editTipo === t ? 'border-primary/60 bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-border-hover'}`}
                  >
                    {tipoLabel[t]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Data e Hora</Label>
              <Input
                type="datetime-local"
                value={editDataHora}
                onChange={(e) => setEditDataHora(e.target.value)}
                className="bg-secondary border-border mt-1"
              />
            </div>
            <Button
              onClick={handleSaveEdit}
              disabled={editarMutation.isPending}
              className="w-full gold-gradient text-primary-foreground font-semibold"
            >
              {editarMutation.isPending ? 'Salvando...' : 'Salvar alterações'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
