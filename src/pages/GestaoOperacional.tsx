import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { fetchAlunos, fetchLeads } from "@/lib/api";
import { Users, Award, ChevronRight, PlusCircle, GraduationCap, Loader2 } from "lucide-react";
import { getInitials } from "@/lib/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export default function GestaoOperacional() {
  const [alunos, setAlunos] = useState<any[]>([]);
  const [leadsFechados, setLeadsFechados] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Matricula Modal states
  const [openMatricula, setOpenMatricula] = useState(false);
  const [targetLead, setTargetLead] = useState<any | null>(null);
  const [senhaAluno, setSenhaAluno] = useState('');
  const [matriculando, setMatriculando] = useState(false);

  const loadData = async () => {
     try {
        const [alunosData, leadsData] = await Promise.all([
           fetchAlunos(),
           fetchLeads()
        ]);
        const listaAlunos = alunosData || [];
        setAlunos(listaAlunos);
        
        // Leads fechados que NÃO estão nos alunos
        const pendentes = (leadsData || []).filter(l => 
           l.status_pipeline === 'fechado' && !listaAlunos.some(a => a.lead_id === l.id)
        );
        setLeadsFechados(pendentes);
     } catch (e) {
        console.error(e);
     } finally {
        setLoading(false);
     }
  };

  useEffect(() => { loadData(); }, []);

  const handleMatricular = async (e: React.FormEvent) => {
     e.preventDefault();
     if (!targetLead?.email) {
        toast({ title: 'Lead sem E-mail', description: 'Vá no CRM e adicione o e-mail do lead antes de matricular.', variant: 'destructive' });
        return;
     }
     if (senhaAluno.length < 6) return toast({ title: 'Mínimo de 6 caracteres.' });
     
     setMatriculando(true);
     try {
        const email = targetLead.email.trim();
        // 1. Tentar Edge Function
        const res = await supabase.functions.invoke('create-user', {
          body: { email, password: senhaAluno, nome: targetLead.nome_completo, perfil: 'aluno' },
        });
        
        const authErr = res.error || res?.data?.error;
        let profileId = null;

        if (!authErr && res.data?.user?.id) {
           profileId = res.data.user.id;
        } else {
           console.log("Edge function failed, falling back to local Auth Signup", authErr);
           const { data: signUpData, error: sErr } = await supabase.auth.signUp({
              email, password: senhaAluno, options: { data: { nome: targetLead.nome_completo, perfil: 'aluno' } }
           });
           if (sErr) throw sErr;
           if (signUpData.user) {
              profileId = signUpData.user.id;
              await supabase.from('profiles').upsert({ id: profileId, nome: targetLead.nome_completo, email, perfil: 'aluno', ativo: true });
           }
        }

        if (profileId) {
           const { error: alErr } = await supabase.from('alunos').insert({
              lead_id: targetLead.id, profile_id: profileId, fase_atual: 'Onboarding', pontuacao_total: 0
           });
           if (alErr) throw alErr;

           toast({ title: 'Aluno Matriculado com Sucesso!' });
           setOpenMatricula(false);
           setSenhaAluno('');
           setTargetLead(null);
           loadData(); // refresh lists
        } else {
           throw new Error("Não foi possível gerar a credencial.");
        }
     } catch (err: any) {
        console.error("ERRO MATRICULA:", err);
        // Sometimes the session hijack causes the current tab session to die abruptly.
        toast({ title: 'Falha ou Deslogamento', description: 'Se ocorreu um erro de RLS, a senha foi criada mas você precisará recarregar a guia.', variant: 'warning' });
     } finally {
        setMatriculando(false);
     }
  };

  return (
    <AppLayout>
      <div className="flex flex-col h-full bg-background/50 overflow-hidden">
        <header className="px-6 py-6 border-b border-border/40 bg-zinc-900/20 backdrop-blur-md flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Gestão Operacional (Mentoria)</h1>
            <p className="text-muted-foreground mt-1 text-sm">Painel da equipe para validação de Sprints e acompanhamento de alunos.</p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors text-sm font-medium">
            <PlusCircle size={16} />
            Matricular Aluno
          </button>
        </header>
        
        <main className="flex-1 p-6 overflow-y-auto space-y-8">
          {loading ? (
             <div className="flex justify-center mt-20"><div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" /></div>
          ) : (
            <>
              {/* === SEÇÃO: Leads Pendentes de Matrícula === */}
              {leadsFechados.length > 0 && (
                 <section>
                    <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
                       <GraduationCap className="text-warning" /> 
                       Aguardando Matrícula ({leadsFechados.length})
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                       {leadsFechados.map(lead => (
                          <div key={lead.id} className="bg-warning/10 border border-warning/20 p-4 rounded-xl flex items-center justify-between">
                             <div className="flex-1 min-w-0 pr-4">
                                <h3 className="font-bold text-warning truncate">{lead.nome_completo}</h3>
                                <p className="text-xs text-muted-foreground truncate">{lead.email || "⚠️ Sem e-mail cadastrado"}</p>
                             </div>
                             <Button 
                               onClick={() => { setTargetLead(lead); setOpenMatricula(true); }}
                               size="sm" 
                               className="bg-warning hover:bg-warning/80 text-background px-3 whitespace-nowrap shadow-lg shadow-warning/20">
                                Matricular
                             </Button>
                          </div>
                       ))}
                    </div>
                 </section>
              )}

              {/* === SEÇÃO: Alunos Ativos === */}
              <section>
                 <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
                    <Users className="text-primary" /> Alunos Ativos
                 </h2>
                 {alunos.length === 0 ? (
                    <div className="bg-zinc-900/30 rounded-2xl border border-border/40 p-10 text-center flex flex-col items-center justify-center">
                      <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mb-4"><Users size={24} className="text-muted-foreground" /></div>
                      <h2 className="text-xl font-bold text-white mb-2">Nenhum Aluno Ativo</h2>
                      <p className="text-muted-foreground max-w-md">Feche vendas no CRM para listá-las aqui e iniciar a matrícula em 1 clique.</p>
                    </div>
                 ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {alunos.map(aluno => (
                         <div key={aluno.id} className="bg-zinc-900 border border-border/40 p-5 rounded-xl hover:border-primary/50 transition-colors cursor-pointer group">
                            <div className="flex items-center gap-4 mb-4">
                               <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center font-bold text-lg text-primary">
                                  {getInitials(aluno.profiles?.nome || aluno.leads?.nome_completo || "?")}
                               </div>
                               <div>
                                  <h3 className="font-bold text-foreground">{aluno.profiles?.nome || aluno.leads?.nome_completo}</h3>
                                  <p className="text-xs text-muted-foreground">{aluno.leads?.whatsapp || aluno.profiles?.email}</p>
                               </div>
                            </div>
                            <div className="flex justify-between items-center bg-black/20 p-3 rounded-lg mb-4">
                               <div>
                                  <p className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider mb-1">Fase Atual</p>
                                  <p className="text-sm font-medium gold-gradient bg-clip-text text-transparent">{aluno.fase_atual}</p>
                               </div>
                               <div className="text-right">
                                  <p className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider mb-1 flex items-center gap-1 justify-end"><Award size={10}/> XP</p>
                                  <p className="text-sm font-bold text-emerald-400">{aluno.pontuacao_total} pts</p>
                               </div>
                            </div>
                            <div className="flex justify-between items-center text-xs font-semibold text-muted-foreground group-hover:text-primary transition-colors">
                               <span>Ver Sprints e Aprovações</span>
                               <ChevronRight size={14} />
                            </div>
                         </div>
                      ))}
                    </div>
                 )}
              </section>
            </>
          )}
        </main>
      </div>

      {/* Modal de Matrícula */}
      <Dialog open={openMatricula} onOpenChange={setOpenMatricula}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
               <GraduationCap className="text-emerald-500" />
               Matricular: {targetLead?.nome_completo}
            </DialogTitle>
            <DialogDescription>
               Atribuir senha e liberar acesso ao Portal do Aluno.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleMatricular} className="space-y-4">
             <div>
                <Label className="text-xs text-muted-foreground uppercase mb-2 block">E-mail Cadastrado</Label>
                <div className="px-3 py-2 bg-secondary/50 rounded-md text-sm text-foreground opacity-70">
                   {targetLead?.email || '—'}
                </div>
             </div>
             <div>
                <Label className="text-xs text-muted-foreground uppercase mb-2 block">Crie a Senha Inicial</Label>
                <Input
                   type="password"
                   value={senhaAluno}
                   onChange={e => setSenhaAluno(e.target.value)}
                   className="bg-bg-tertiary border-border h-11"
                   placeholder="Mínimo 6 caracteres"
                   required
                />
             </div>
             <Button type="submit" disabled={matriculando || !targetLead?.email} className="w-full h-11 bg-emerald-500 hover:bg-emerald-600 text-white font-bold">
                {matriculando ? <Loader2 size={16} className="animate-spin" /> : 'Confirmar e Criar Acesso'}
             </Button>
             {!targetLead?.email && <p className="text-xs text-destructive text-center">Feche a janela e edite o e-mail no lead primeiro.</p>}
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
