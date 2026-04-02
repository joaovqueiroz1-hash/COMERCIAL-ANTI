import { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Star, Save, X, Flame, AlertTriangle, MessageCircle, Phone, Video, Mail, Instagram } from 'lucide-react';
import { updateLead, fetchInteracoes, fetchProximasAcoes, Lead } from '@/lib/api';
import { STATUS_LABELS, PipelineStatus, formatCurrency } from '@/lib/types';
import { validateWhatsApp, cleanWhatsAppNumber } from '@/lib/whatsapp-utils';
import { toast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { InteractionForm } from '@/components/InteractionForm';
import { ActionForm } from '@/components/ActionForm';
import { useAuth } from '@/contexts/AuthContext';

interface LeadEditSheetProps {
  lead: Lead | null;
  profiles: any[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  readOnly?: boolean;
}

export function LeadEditSheet({ lead, profiles, open, onOpenChange, readOnly = false }: LeadEditSheetProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<Lead>>({});
  const [showInteraction, setShowInteraction] = useState(false);
  const [showAction, setShowAction] = useState(false);

  const { data: interacoes = [] } = useQuery({
    queryKey: ['interacoes', lead?.id],
    queryFn: () => fetchInteracoes(lead!.id),
    enabled: !!lead?.id && open,
  });

  const { data: acoes = [] } = useQuery({
    queryKey: ['proximas_acoes', lead?.id],
    queryFn: () => fetchProximasAcoes(lead!.id),
    enabled: !!lead?.id && open,
  });

  useEffect(() => {
    if (lead) setForm({ ...lead });
  }, [lead]);

  const mutation = useMutation({
    mutationFn: (updates: Partial<Lead>) => updateLead(lead!.id, updates as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead', lead?.id] });
      toast({ title: 'Lead atualizado ✓' });
      setEditing(false);
    },
    onError: () => toast({ title: 'Erro ao salvar', variant: 'destructive' }),
  });

  if (!lead) return null;

  const whatsappVal = validateWhatsApp(form.whatsapp);
  const hot = form.eh_empresario && (form.faturamento_anual || 0) > 500000 && form.capacidade_investimento && (form.fit_mentoria || 0) >= 4;
  const vendedor = profiles.find(p => p.id === form.vendedor_id);
  const gestor = profiles.find(p => p.id === form.gestor_id);

  const tipoIcon: Record<string, any> = { whatsapp: <MessageCircle size={14} />, ligacao: <Phone size={14} />, reuniao: <Video size={14} />, email: <Mail size={14} /> };
  const tipoLabel: Record<string, string> = { whatsapp: 'WhatsApp', ligacao: 'Ligação', reuniao: 'Reunião', email: 'E-mail' };

  const handleSave = () => {
    const { id, created_at, updated_at, ...updates } = form as any;
    mutation.mutate(updates);
  };

  const setField = (key: string, value: any) => setForm(prev => ({ ...prev, [key]: value }));

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

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-[540px] bg-background border-border p-0 flex flex-col">
          {/* Header */}
          <SheetHeader className="p-4 pb-3 border-b border-border shrink-0">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-sm font-bold text-primary-foreground shrink-0">
                  {lead.nome_completo.split(' ').filter(Boolean).slice(0, 2).map(n => n[0]).join('').toUpperCase()}
                </div>
                <div className="min-w-0">
                  <SheetTitle className="text-foreground text-base truncate flex items-center gap-1.5">
                    {lead.nome_completo}
                    {hot && <Flame size={14} className="text-warning shrink-0" />}
                  </SheetTitle>
                  <p className="text-xs text-muted-foreground truncate">{lead.nome_empresa || '—'}</p>
                </div>
              </div>
              {!readOnly && (
                <div className="flex gap-1.5 shrink-0">
                  {editing ? (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => { setForm({ ...lead }); setEditing(false); }} className="h-8 px-2 text-muted-foreground">
                        <X size={14} />
                      </Button>
                      <Button size="sm" onClick={handleSave} disabled={mutation.isPending} className="h-8 px-3 bg-primary text-primary-foreground text-xs">
                        <Save size={14} className="mr-1" /> Salvar
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setEditing(true)} className="h-8 px-3 border-border text-xs text-foreground">
                      Editar
                    </Button>
                  )}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${statusColor[form.status_pipeline || '']}`}>
                {STATUS_LABELS[(form.status_pipeline || 'novo_lead') as PipelineStatus]}
              </span>
              {(form.faturamento_anual || 0) > 0 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                  {formatCurrency(form.faturamento_anual || 0)}
                </span>
              )}
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${form.prioridade === 'alta' ? 'bg-destructive/20 text-destructive' : form.prioridade === 'media' ? 'bg-warning/20 text-warning' : 'bg-muted text-muted-foreground'}`}>
                {(form.prioridade || 'media').charAt(0).toUpperCase() + (form.prioridade || 'media').slice(1)}
              </span>
            </div>
          </SheetHeader>

          {/* Content */}
          <ScrollArea className="flex-1">
            <Tabs defaultValue="info" className="w-full">
              <TabsList className="w-full justify-start rounded-none border-b border-border bg-transparent h-9 px-4">
                <TabsTrigger value="info" className="text-xs data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">Informações</TabsTrigger>
                <TabsTrigger value="qualificacao" className="text-xs data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">Qualificação</TabsTrigger>
                <TabsTrigger value="timeline" className="text-xs data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">Timeline</TabsTrigger>
                <TabsTrigger value="acoes" className="text-xs data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">Ações</TabsTrigger>
              </TabsList>

              {/* INFO TAB */}
              <TabsContent value="info" className="p-4 space-y-4 mt-0">
                <div className="grid grid-cols-2 gap-3">
                  <FieldBlock label="Nome Completo" editing={editing}>
                    {editing ? <Input value={form.nome_completo || ''} onChange={e => setField('nome_completo', e.target.value)} className="h-8 text-xs bg-secondary border-border" />
                      : <p className="text-sm text-foreground">{form.nome_completo}</p>}
                  </FieldBlock>
                  <FieldBlock label="Empresa" editing={editing}>
                    {editing ? <Input value={form.nome_empresa || ''} onChange={e => setField('nome_empresa', e.target.value)} className="h-8 text-xs bg-secondary border-border" />
                      : <p className="text-sm text-foreground">{form.nome_empresa || '—'}</p>}
                  </FieldBlock>
                  <FieldBlock label="WhatsApp" editing={editing} warning={form.whatsapp && whatsappVal.warning ? whatsappVal.warning : undefined}>
                    {editing ? <Input value={form.whatsapp || ''} onChange={e => setField('whatsapp', e.target.value)} className="h-8 text-xs bg-secondary border-border" />
                      : (
                        <div className="flex items-center gap-2">
                          <p className="text-sm text-foreground">{form.whatsapp || '—'}</p>
                          {form.whatsapp && (() => { const c = cleanWhatsAppNumber(form.whatsapp); const num = c.startsWith('55') && c.length >= 12 ? c : `55${c}`; return (
                            <a href={`https://wa.me/${num}`} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-[#25D366]/15 text-[#25D366] hover:bg-[#25D366]/30 transition-colors">
                              <MessageCircle size={10} /> Abrir
                            </a>
                          ); })()}
                        </div>
                      )}
                  </FieldBlock>
                  <FieldBlock label="E-mail" editing={editing}>
                    {editing ? <Input value={form.email || ''} onChange={e => setField('email', e.target.value)} className="h-8 text-xs bg-secondary border-border" />
                      : <p className="text-sm text-foreground">{form.email || '—'}</p>}
                  </FieldBlock>
                  <FieldBlock label="Cidade" editing={editing}>
                    {editing ? <Input value={form.cidade || ''} onChange={e => setField('cidade', e.target.value)} className="h-8 text-xs bg-secondary border-border" />
                      : <p className="text-sm text-foreground">{form.cidade || '—'}</p>}
                  </FieldBlock>
                  <FieldBlock label="Estado" editing={editing}>
                    {editing ? <Input value={form.estado || ''} onChange={e => setField('estado', e.target.value)} className="h-8 text-xs bg-secondary border-border" />
                      : <p className="text-sm text-foreground">{form.estado || '—'}</p>}
                  </FieldBlock>
                  <FieldBlock label="Instagram" editing={editing}>
                    {editing ? <Input value={form.instagram_empresa || ''} onChange={e => setField('instagram_empresa', e.target.value)} className="h-8 text-xs bg-secondary border-border" />
                      : (
                        <div className="flex items-center gap-2">
                          <p className="text-sm text-foreground">{form.instagram_empresa || '—'}</p>
                          {form.instagram_empresa && (
                            <a href={`https://instagram.com/${form.instagram_empresa.replace('@', '')}`} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-400 hover:bg-purple-500/30 transition-colors">
                              <Instagram size={10} /> Abrir
                            </a>
                          )}
                        </div>
                      )}
                  </FieldBlock>
                  <FieldBlock label="Origem" editing={editing}>
                    {editing ? <Input value={form.origem || ''} onChange={e => setField('origem', e.target.value)} className="h-8 text-xs bg-secondary border-border" />
                      : <p className="text-sm text-foreground">{form.origem || '—'}</p>}
                  </FieldBlock>
                </div>

                <FieldBlock label="Status Pipeline" editing={editing}>
                  {editing ? (
                    <Select value={form.status_pipeline || 'novo_lead'} onValueChange={v => setField('status_pipeline', v)}>
                      <SelectTrigger className="h-8 text-xs bg-secondary border-border"><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                    </Select>
                  ) : null}
                </FieldBlock>

                <FieldBlock label="Prioridade" editing={editing}>
                  {editing ? (
                    <Select value={form.prioridade || 'media'} onValueChange={v => setField('prioridade', v)}>
                      <SelectTrigger className="h-8 text-xs bg-secondary border-border"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="alta">Alta</SelectItem>
                        <SelectItem value="media">Média</SelectItem>
                        <SelectItem value="baixa">Baixa</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : null}
                </FieldBlock>

                <FieldBlock label="Vendedor" editing={editing}>
                  {editing ? (
                    <Select value={form.vendedor_id || ''} onValueChange={v => setField('vendedor_id', v || null)}>
                      <SelectTrigger className="h-8 text-xs bg-secondary border-border"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                      <SelectContent>
                        {profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : <p className="text-sm text-foreground">{vendedor?.nome || '—'}</p>}
                </FieldBlock>

                <FieldBlock label="Gestor" editing={editing}>
                  {editing ? (
                    <Select value={form.gestor_id || ''} onValueChange={v => setField('gestor_id', v || null)}>
                      <SelectTrigger className="h-8 text-xs bg-secondary border-border"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                      <SelectContent>
                        {profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : <p className="text-sm text-foreground">{gestor?.nome || '—'}</p>}
                </FieldBlock>

                <div className="col-span-2">
                  <FieldBlock label="Maior Dor" editing={editing}>
                    {editing ? <Textarea value={form.maior_dor || ''} onChange={e => setField('maior_dor', e.target.value)} className="text-xs bg-secondary border-border min-h-[60px]" />
                      : <p className="text-sm text-foreground">{form.maior_dor || '—'}</p>}
                  </FieldBlock>
                </div>

                <div className="col-span-2">
                  <FieldBlock label="Observações Iniciais" editing={editing}>
                    {editing ? <Textarea value={form.observacoes_iniciais || ''} onChange={e => setField('observacoes_iniciais', e.target.value)} className="text-xs bg-secondary border-border min-h-[60px]" />
                      : <p className="text-sm text-foreground">{form.observacoes_iniciais || '—'}</p>}
                  </FieldBlock>
                </div>

                <div className="col-span-2">
                  <FieldBlock label="Observações Estratégicas" editing={editing}>
                    {editing ? <Textarea value={form.observacoes_estrategicas || ''} onChange={e => setField('observacoes_estrategicas', e.target.value)} className="text-xs bg-secondary border-border min-h-[60px]" />
                      : <p className="text-sm text-foreground italic text-muted-foreground">{form.observacoes_estrategicas || 'Nenhuma observação.'}</p>}
                  </FieldBlock>
                </div>
              </TabsContent>

              {/* QUALIFICAÇÃO TAB */}
              <TabsContent value="qualificacao" className="p-4 space-y-4 mt-0">
                <div className="grid grid-cols-2 gap-3">
                  <FieldBlock label="Empresário" editing={editing}>
                    {editing ? (
                      <div className="flex items-center gap-2">
                        <Switch checked={!!form.eh_empresario} onCheckedChange={v => setField('eh_empresario', v)} />
                        <span className="text-xs text-foreground">{form.eh_empresario ? 'Sim' : 'Não'}</span>
                      </div>
                    ) : <p className="text-sm text-foreground">{form.eh_empresario ? 'Sim' : 'Não'}</p>}
                  </FieldBlock>
                  <FieldBlock label="Cap. Investimento" editing={editing}>
                    {editing ? (
                      <div className="flex items-center gap-2">
                        <Switch checked={!!form.capacidade_investimento} onCheckedChange={v => setField('capacidade_investimento', v)} />
                        <span className="text-xs text-foreground">{form.capacidade_investimento ? 'Sim' : 'Não'}</span>
                      </div>
                    ) : <p className="text-sm text-foreground">{form.capacidade_investimento ? 'Sim' : 'Não'}</p>}
                  </FieldBlock>
                  <FieldBlock label="Faturamento Anual" editing={editing}>
                    {editing
                      ? <FaturamentoInput key={`fat-${lead?.id}`} value={form.faturamento_anual || 0} onChange={v => setField('faturamento_anual', v)} />
                      : <p className="text-sm text-primary font-medium">{formatCurrency(form.faturamento_anual || 0)}</p>}
                  </FieldBlock>
                  <FieldBlock label="Valor Acordado" editing={editing}>
                    {editing
                      ? <FaturamentoInput key={`val-${lead?.id}`} value={form.valor_acordado || 0} onChange={v => setField('valor_acordado', v > 0 ? v : null)} />
                      : <p className="text-sm font-semibold text-foreground">{form.valor_acordado ? formatCurrency(form.valor_acordado) : '—'}</p>}
                  </FieldBlock>
                  <FieldBlock label="Funcionários" editing={editing}>
                    {editing ? <Input type="number" value={form.quantidade_funcionarios || 0} onChange={e => setField('quantidade_funcionarios', Number(e.target.value))} className="h-8 text-xs bg-secondary border-border" />
                      : <p className="text-sm text-foreground">{form.quantidade_funcionarios || 0}</p>}
                  </FieldBlock>
                </div>

                <FieldBlock label={`Fit Mentoria (${form.fit_mentoria || 0}/5)`} editing={editing}>
                  {editing ? (
                    <div className="flex gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <button key={i} onClick={() => setField('fit_mentoria', i + 1)} className="focus:outline-none">
                          <Star size={20} className={i < (form.fit_mentoria || 0) ? 'text-primary fill-primary' : 'text-muted-foreground/30'} />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="flex gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} size={16} className={i < (form.fit_mentoria || 0) ? 'text-primary fill-primary' : 'text-muted-foreground/30'} />
                      ))}
                    </div>
                  )}
                </FieldBlock>

                <FieldBlock label={`Probabilidade de Fechamento (${form.probabilidade_fechamento || 0}%)`} editing={editing}>
                  <Slider
                    value={[form.probabilidade_fechamento || 0]}
                    onValueChange={v => editing && setField('probabilidade_fechamento', v[0])}
                    max={100}
                    step={5}
                    disabled={!editing}
                    className="mt-1"
                  />
                </FieldBlock>

                <div className="grid grid-cols-2 gap-3">
                  <FieldBlock label="Último Contato" editing={editing}>
                    {editing ? <Input type="date" value={form.ultimo_contato ? new Date(form.ultimo_contato).toISOString().split('T')[0] : ''} onChange={e => setField('ultimo_contato', e.target.value ? new Date(e.target.value).toISOString() : null)} className="h-8 text-xs bg-secondary border-border" />
                      : <p className="text-sm text-foreground">{form.ultimo_contato ? new Date(form.ultimo_contato).toLocaleDateString('pt-BR') : '—'}</p>}
                  </FieldBlock>
                  <FieldBlock label="Próx. Follow-up" editing={editing}>
                    {editing ? <Input type="date" value={form.proximo_followup ? new Date(form.proximo_followup).toISOString().split('T')[0] : ''} onChange={e => setField('proximo_followup', e.target.value ? new Date(e.target.value).toISOString() : null)} className="h-8 text-xs bg-secondary border-border" />
                      : <p className="text-sm text-foreground">{form.proximo_followup ? new Date(form.proximo_followup).toLocaleDateString('pt-BR') : '—'}</p>}
                  </FieldBlock>
                </div>

                <FieldBlock label="Tags" editing={editing}>
                  {editing ? <Input value={(form.tags || []).join(', ')} onChange={e => setField('tags', e.target.value.split(',').map(t => t.trim()).filter(Boolean))} placeholder="tag1, tag2, tag3" className="h-8 text-xs bg-secondary border-border" />
                    : (
                      <div className="flex flex-wrap gap-1">
                        {(form.tags || []).map(tag => <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{tag}</span>)}
                        {(!form.tags || form.tags.length === 0) && <span className="text-xs text-muted-foreground">Sem tags</span>}
                      </div>
                    )}
                </FieldBlock>
              </TabsContent>

              {/* TIMELINE TAB */}
              <TabsContent value="timeline" className="p-4 mt-0">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-foreground">Interações</h3>
                  <Button variant="outline" onClick={() => setShowInteraction(true)} className="border-border text-xs h-8 px-3 text-foreground">+ Contato</Button>
                </div>
                {interacoes.length > 0 ? (
                  <div className="space-y-4">
                    {interacoes.map((int) => {
                      const autor = profiles.find(u => u.id === int.realizado_por);
                      return (
                        <div key={int.id} className="relative pl-5 border-l-2 border-border">
                          <div className="absolute left-0 top-0.5 -translate-x-[5px] w-2 h-2 rounded-full bg-primary" />
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-primary">{tipoIcon[int.tipo]}</span>
                            <span className="text-xs font-medium text-foreground">{tipoLabel[int.tipo]}</span>
                            <span className="text-[10px] text-muted-foreground">{new Date(int.created_at).toLocaleDateString('pt-BR')}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mb-1">{int.resumo || '—'}</p>
                          {int.objecoes && <p className="text-xs text-warning bg-warning/10 px-2 py-1 rounded mb-1">⚠️ {int.objecoes}</p>}
                          <p className="text-[10px] text-muted-foreground">Por {autor?.nome?.split(' ')[0] || '—'} • Interesse: {int.interesse_demonstrado}</p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhuma interação registrada</p>
                )}
              </TabsContent>

              {/* AÇÕES TAB */}
              <TabsContent value="acoes" className="p-4 mt-0">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-foreground">Próximas Ações</h3>
                  <Button onClick={() => setShowAction(true)} className="gold-gradient text-primary-foreground font-semibold text-xs h-8 px-3">+ Agendar</Button>
                </div>
                {acoes.length > 0 ? (
                  <div className="space-y-2">
                    {acoes.map(a => (
                      <div key={a.id} className={`flex items-center gap-3 p-3 rounded-lg border ${a.concluida ? 'border-border bg-secondary/30 opacity-60' : 'border-border bg-secondary'}`}>
                        <div className={`w-2 h-2 rounded-full shrink-0 ${a.concluida ? 'bg-muted-foreground' : 'bg-primary'}`} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-medium ${a.concluida ? 'line-through text-muted-foreground' : 'text-foreground'}`}>{a.titulo}</p>
                          {a.descricao && <p className="text-[10px] text-muted-foreground truncate">{a.descricao}</p>}
                        </div>
                        <div className="flex flex-col items-end shrink-0">
                          <span className="text-[10px] text-primary">{new Date(a.data_hora).toLocaleDateString('pt-BR')}</span>
                          {a.tipo && <span className="text-[10px] text-muted-foreground">{a.tipo}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhuma ação agendada</p>
                )}
              </TabsContent>
            </Tabs>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Modals outside Sheet to avoid z-index issues */}
      {lead && (
        <>
          <InteractionForm leadId={lead.id} userId={user?.id || null} open={showInteraction} onOpenChange={setShowInteraction} />
          <ActionForm leadId={lead.id} profiles={profiles} userId={user?.id || null} open={showAction} onOpenChange={setShowAction} />
        </>
      )}
    </>
  );
}

function FaturamentoInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const initUnit = (): 'K' | 'MM' => value >= 500_000 ? 'MM' : 'K';
  const initDisplay = (u: 'K' | 'MM') => {
    if (!value) return '';
    const raw = u === 'MM' ? value / 1_000_000 : value / 1_000;
    return String(parseFloat(raw.toFixed(3)));
  };
  const [unit, setUnit] = useState<'K' | 'MM'>(initUnit);
  const [display, setDisplay] = useState<string>(() => initDisplay(initUnit()));

  const commit = (v: string, u: 'K' | 'MM') => {
    const num = parseFloat(v.replace(',', '.')) || 0;
    onChange(u === 'K' ? Math.round(num * 1_000) : Math.round(num * 1_000_000));
  };

  const switchUnit = (u: 'K' | 'MM') => {
    setUnit(u);
    commit(display, u);
  };

  return (
    <div className="flex gap-0">
      <Input
        type="number"
        value={display}
        onChange={e => { setDisplay(e.target.value); commit(e.target.value, unit); }}
        className="h-8 text-xs bg-secondary border-border rounded-r-none flex-1 min-w-0"
        placeholder="0"
        step="0.1"
      />
      {(['K', 'MM'] as const).map((u, i) => (
        <button
          key={u}
          type="button"
          onClick={() => switchUnit(u)}
          className={`px-2.5 h-8 text-xs border-y border-r border-border shrink-0 transition-colors
            ${i === 1 ? 'rounded-r' : ''}
            ${unit === u ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}
        >
          {u}
        </button>
      ))}
    </div>
  );
}

function FieldBlock({ label, editing, warning, children }: { label: string; editing: boolean; warning?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1 mb-1">
        <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</Label>
        {warning && (
          <Tooltip>
            <TooltipTrigger asChild>
              <AlertTriangle size={10} className="text-warning" />
            </TooltipTrigger>
            <TooltipContent className="bg-popover border-border text-popover-foreground text-xs max-w-[200px]">{warning}</TooltipContent>
          </Tooltip>
        )}
      </div>
      {children}
    </div>
  );
}
