import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { createInteracao, InteracaoInsert } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { MessageCircle, Phone, Video, Mail } from 'lucide-react';

interface InteractionFormProps {
  leadId: string;
  userId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InteractionForm({ leadId, userId, open, onOpenChange }: InteractionFormProps) {
  const queryClient = useQueryClient();
  const [tipo, setTipo] = useState<'whatsapp' | 'ligacao' | 'reuniao' | 'email'>('whatsapp');
  const [resumo, setResumo] = useState('');
  const [objecoes, setObjecoes] = useState('');
  const [interesse, setInteresse] = useState<'baixo' | 'medio' | 'alto'>('medio');
  const [proximoPasso, setProximoPasso] = useState('');

  const mutation = useMutation({
    mutationFn: (data: InteracaoInsert) => createInteracao(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interacoes', leadId] });
      toast({ title: 'Interação registrada ✓' });
      resetForm();
      onOpenChange(false);
    },
    onError: () => toast({ title: 'Erro ao registrar', variant: 'destructive' }),
  });

  const resetForm = () => {
    setTipo('whatsapp');
    setResumo('');
    setObjecoes('');
    setInteresse('medio');
    setProximoPasso('');
  };

  const handleSubmit = () => {
    if (!resumo.trim()) {
      toast({ title: 'Preencha o resumo', variant: 'destructive' });
      return;
    }
    mutation.mutate({
      lead_id: leadId,
      tipo,
      resumo,
      objecoes: objecoes || null,
      interesse_demonstrado: interesse,
      proximo_passo: proximoPasso || null,
      realizado_por: userId,
    });
  };

  const tipoOptions = [
    { value: 'whatsapp', label: 'WhatsApp', icon: <MessageCircle size={14} /> },
    { value: 'ligacao', label: 'Ligação', icon: <Phone size={14} /> },
    { value: 'reuniao', label: 'Reunião', icon: <Video size={14} /> },
    { value: 'email', label: 'E-mail', icon: <Mail size={14} /> },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-background border-border sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="text-foreground text-base">Registrar Interação</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">Tipo</Label>
            <div className="grid grid-cols-4 gap-2">
              {tipoOptions.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setTipo(opt.value as any)}
                  className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-xs transition-colors ${
                    tipo === opt.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-secondary text-muted-foreground hover:border-primary/50'
                  }`}
                >
                  {opt.icon}
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">Resumo *</Label>
            <Textarea value={resumo} onChange={e => setResumo(e.target.value)} placeholder="Descreva o que aconteceu..." className="text-xs bg-secondary border-border min-h-[80px]" />
          </div>

          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">Objeções</Label>
            <Input value={objecoes} onChange={e => setObjecoes(e.target.value)} placeholder="Objeções levantadas..." className="h-8 text-xs bg-secondary border-border" />
          </div>

          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">Interesse Demonstrado</Label>
            <Select value={interesse} onValueChange={v => setInteresse(v as any)}>
              <SelectTrigger className="h-8 text-xs bg-secondary border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="baixo">Baixo</SelectItem>
                <SelectItem value="medio">Médio</SelectItem>
                <SelectItem value="alto">Alto</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">Próximo Passo</Label>
            <Input value={proximoPasso} onChange={e => setProximoPasso(e.target.value)} placeholder="O que fazer a seguir..." className="h-8 text-xs bg-secondary border-border" />
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1 border-border text-muted-foreground text-xs h-9">Cancelar</Button>
            <Button onClick={handleSubmit} disabled={mutation.isPending} className="flex-1 bg-primary text-primary-foreground text-xs h-9">
              {mutation.isPending ? 'Salvando...' : 'Registrar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
