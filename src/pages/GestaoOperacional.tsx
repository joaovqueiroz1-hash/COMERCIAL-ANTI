import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { fetchAlunos } from "@/lib/api";
import { Users, Award, ChevronRight, PlusCircle } from "lucide-react";
import { getInitials } from "@/lib/types";

export default function GestaoOperacional() {
  const [alunos, setAlunos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
     fetchAlunos().then(data => {
        setAlunos(data || []);
     }).finally(() => setLoading(false));
  }, []);

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
        
        <main className="flex-1 p-6 overflow-y-auto">
          {loading ? (
             <div className="flex justify-center mt-20"><div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" /></div>
          ) : alunos.length === 0 ? (
             <div className="bg-zinc-900/30 rounded-2xl border border-border/40 p-10 text-center flex flex-col items-center justify-center mt-10">
               <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mb-4"><Users size={24} className="text-muted-foreground" /></div>
               <h2 className="text-xl font-bold text-white mb-2">Nenhum Aluno Ativo</h2>
               <p className="text-muted-foreground max-w-md">Para matricular um aluno, mude o Status do Lead para Fechado e crie um acesso vinculando o perfil a ele.</p>
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
        </main>
      </div>
    </AppLayout>
  );
}
