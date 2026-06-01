import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchNotasCriativas, createNotaCriativa, deleteNotaCriativa,
  type NotaCriativa,
} from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { getInitials } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Sparkles, Send, Trash2, Link2, ExternalLink, Loader2, StickyNote,
} from "lucide-react";

const PERFIL_LABEL: Record<string, string> = {
  admin: "Equipe", gestor: "Equipe", operacional: "Equipe", vendedor: "Equipe",
  aluno: "Aluno",
};

function formatDataHora(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

interface AbaCriativaProps {
  alunoId: string;
}

export default function AbaCriativa({ alunoId }: AbaCriativaProps) {
  const { profile } = useAuth();
  const isEquipe = profile && ["admin", "gestor", "operacional"].includes(profile.perfil);

  const [notas, setNotas] = useState<NotaCriativa[]>([]);
  const [loading, setLoading] = useState(true);
  const [conteudo, setConteudo] = useState("");
  const [url, setUrl] = useState("");
  const [modoLink, setModoLink] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [removendo, setRemovendo] = useState<string | null>(null);
  const fimRef = useRef<HTMLDivElement>(null);

  const carregar = useCallback(async () => {
    try {
      const data = await fetchNotasCriativas(alunoId);
      setNotas(data);
    } catch (e) {
      console.error("[AbaCriativa]", e);
    } finally {
      setLoading(false);
    }
  }, [alunoId]);

  useEffect(() => { setLoading(true); carregar(); }, [carregar]);

  // Realtime: novas anotações aparecem para quem estiver com o quadro aberto
  useEffect(() => {
    const canal = supabase
      .channel(`notas_criativas_${alunoId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notas_criativas", filter: `aluno_id=eq.${alunoId}` },
        () => { carregar(); },
      )
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [alunoId, carregar]);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [notas.length]);

  async function handleEnviar(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    if (!conteudo.trim()) { toast({ title: "Escreva algo antes de salvar." }); return; }
    if (modoLink && !url.trim()) { toast({ title: "Informe o link." }); return; }
    setEnviando(true);
    try {
      await createNotaCriativa({
        aluno_id: alunoId,
        autor_id: profile.id,
        conteudo: conteudo.trim(),
        tipo: modoLink ? "link" : "nota",
        url: modoLink ? url.trim() : null,
      });
      setConteudo(""); setUrl(""); setModoLink(false);
      // realtime recarrega; recarrega tb por garantia (próprio autor)
      carregar();
    } catch (err: any) {
      toast({ title: "Erro ao salvar anotação", description: err.message, variant: "destructive" });
    } finally {
      setEnviando(false);
    }
  }

  async function handleRemover(id: string) {
    setRemovendo(id);
    try {
      await deleteNotaCriativa(id);
      setNotas(prev => prev.filter(n => n.id !== id));
    } catch (err: any) {
      toast({ title: "Erro ao remover", description: err.message, variant: "destructive" });
    } finally {
      setRemovendo(null);
    }
  }

  function podeRemover(n: NotaCriativa) {
    return isEquipe || (profile && n.autor_id === profile.id);
  }

  return (
    <section className="bg-card rounded-2xl border border-border overflow-hidden flex flex-col">
      {/* Cabeçalho */}
      <div className="px-5 py-4 border-b border-border flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Sparkles size={16} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold text-foreground leading-tight">Aba Criativa</h3>
          <p className="text-[11px] text-muted-foreground">Refs, docs e links — tudo fica registrado com autor e horário.</p>
        </div>
      </div>

      {/* Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[55vh] min-h-[200px]">
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-primary" size={22} /></div>
        ) : notas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <StickyNote size={30} className="text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">Nenhuma anotação ainda. Comece salvando uma referência, doc ou link abaixo.</p>
          </div>
        ) : (
          notas.map(n => {
            const autorNome = n.profiles?.nome ?? "—";
            const autorPerfil = n.profiles?.perfil ?? "";
            const ehEquipe = ["admin", "gestor", "operacional", "vendedor"].includes(autorPerfil);
            return (
              <div key={n.id} className="group rounded-xl border border-border bg-secondary/30 p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-6 h-6 rounded-full gold-gradient flex items-center justify-center text-[9px] font-bold text-primary-foreground shrink-0">
                    {getInitials(autorNome)}
                  </div>
                  <span className="text-xs font-semibold text-foreground truncate">{autorNome}</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[8px] px-1.5 py-0 border",
                      ehEquipe ? "border-primary/30 text-primary/80" : "border-emerald-500/30 text-emerald-500",
                    )}
                  >
                    {PERFIL_LABEL[autorPerfil] ?? autorPerfil}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground ml-auto shrink-0">{formatDataHora(n.created_at)}</span>
                  {podeRemover(n) && (
                    <button
                      onClick={() => handleRemover(n.id)}
                      disabled={removendo === n.id}
                      className="text-muted-foreground/30 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                      title="Remover anotação"
                    >
                      {removendo === n.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                    </button>
                  )}
                </div>
                <p className="text-sm text-foreground whitespace-pre-wrap break-words pl-8">{n.conteudo}</p>
                {n.tipo === "link" && n.url && (
                  <a
                    href={n.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-8 mt-1.5 inline-flex items-center gap-1 text-[11px] text-primary hover:underline break-all"
                  >
                    <ExternalLink size={11} /> {n.url}
                  </a>
                )}
              </div>
            );
          })
        )}
        <div ref={fimRef} />
      </div>

      {/* Caixa de envio */}
      <form onSubmit={handleEnviar} className="border-t border-border p-3 space-y-2">
        <Textarea
          value={conteudo}
          onChange={e => setConteudo(e.target.value)}
          placeholder="Escreva uma referência, ideia ou observação..."
          className="bg-secondary/40 border-border resize-none min-h-[60px] text-sm"
          onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleEnviar(e as any); }}
        />
        {modoLink && (
          <Input
            type="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://..."
            className="bg-secondary/40 border-border text-sm"
          />
        )}
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setModoLink(v => !v)}
            className={cn(
              "inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border transition-colors",
              modoLink ? "border-primary/40 text-primary bg-primary/10" : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            <Link2 size={12} /> {modoLink ? "Com link" : "Anexar link"}
          </button>
          <Button type="submit" size="sm" disabled={enviando} className="gold-gradient text-primary-foreground font-bold">
            {enviando ? <Loader2 size={14} className="animate-spin" /> : <><Send size={13} className="mr-1.5" /> Salvar</>}
          </Button>
        </div>
      </form>
    </section>
  );
}
