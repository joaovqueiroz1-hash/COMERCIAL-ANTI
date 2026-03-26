import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { createProximaAcao, ProximaAcaoInsert, Profile } from '@/lib/api';
import { toast } from '@/hooks/use-toast';

interface ActionFormProps {
  leadId: string;
  profiles: Profile[];
  userId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ActionForm({ leadId, profiles, userId, open, onOpenChange }: ActionFormProps) {
  const queryClient = useQueryClient();
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [tipo, setTipo] = useState('reuniao');
  const [dataHora, setDataHora] = useState('');
  const [responsavelId, setResponsavelId] = useState(userId || '');

  const mutation = useMutation({
    mutationFn: (data: ProximaAcaoInsert) => createProximaAcao(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proximas_acoes'] });
      queryClient.invalidateQueries({ queryKey: ['proximas_acoes', leadId] });
      toast({ title: 'Ação agendada ✓' });
      resetForm();
      onOpenChange(false);
    },
    onError: () => toast({ title: 'Erro ao agendar', variant: 'destructive' }),
  });

  const resetForm = () => {
    setTitulo('');
    setDescricao('');
    setTipo('reuniao');
    setDataHora('');
    setResponsavelId(userId || '');
  };

  const handleSubmit = () => {
    if (!titulo.trim() || !dataHora) {
      toast({ title: 'Preencha título e data/hora', variant: 'destructive' });
      return;
    }
    mutation.mutate({
      lead_id: leadId,
      titulo,
      descricao: descricao || null,
      tipo,
      data_hora: new Date(dataHora).toISOString(),
      responsavel_id: responsavelId || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-background border-border sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="text-foreground text-base">Agendar Ação</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">Título *</Label>
            <Input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex: Reunião de apresentação" className="h-8 text-xs bg-secondary border-border" />
          </div>

          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">Descrição</Label>
            <Textarea value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Detalhes da ação..." className="text-xs bg-secondary border-border min-h-[60px]" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">Tipo</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger className="h-8 text-xs bg-secondary border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="reuniao">Reunião</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="ligacao">Ligação</SelectItem>
                  <SelectItem value="email">E-mail</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">Data/Hora *</Label>
              <Input type="datetime-local" value={dataHora} onChange={e => setDataHora(e.target.value)} className="h-8 text-xs bg-secondary border-border" />
            </div>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">Responsável</Label>
            <Select value={responsavelId} onValueChange={setResponsavelId}>
              <SelectTrigger className="h-8 text-xs bg-secondary border-border"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
              <SelectContent>
                {profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1 border-border text-muted-foreground text-xs h-9">Cancelar</Button>
            <Button onClick={handleSubmit} disabled={mutation.isPending} className="flex-1 bg-primary text-primary-foreground text-xs h-9">
              {mutation.isPending ? 'Salvando...' : 'Agendar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
