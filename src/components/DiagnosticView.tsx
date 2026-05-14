import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Pencil, Check, X, ChevronDown, ChevronUp } from "lucide-react";
import type { DiagnosticoData, DiagnosticoDimensao, DiagnosticoIndicador } from "@/lib/diagnostic";

interface DiagnosticViewProps {
  data: DiagnosticoData;
  editable?: boolean;
  onSave?: (updated: DiagnosticoData) => void;
  saving?: boolean;
}

const STATUS_META = {
  forte:       { label: "Forte",       color: "text-emerald-600", bg: "bg-emerald-500/10 border-emerald-500/20", dot: "bg-emerald-500" },
  oportunidade:{ label: "Oportunidade",color: "text-amber-600",   bg: "bg-amber-500/10 border-amber-500/20",   dot: "bg-amber-500"  },
  critico:     { label: "Crítico",     color: "text-red-600",     bg: "bg-red-500/10 border-red-500/20",       dot: "bg-red-500"    },
};

function ScoreBar({ score }: { score: number }) {
  const pct = Math.round((score / 10) * 100);
  const color = score >= 7 ? "bg-emerald-500" : score >= 4 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-bold tabular-nums w-6 text-right">{score}</span>
    </div>
  );
}

function IndicatorRow({
  indicator,
  editable,
  onChange,
}: {
  indicator: DiagnosticoIndicador;
  editable: boolean;
  onChange: (updated: DiagnosticoIndicador) => void;
}) {
  const meta = STATUS_META[indicator.status];
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(indicator);

  function commit() {
    onChange(draft);
    setEditing(false);
  }
  function cancel() {
    setDraft(indicator);
    setEditing(false);
  }

  return (
    <div className="flex items-start gap-2.5 py-2">
      <span className={cn("mt-1.5 w-2 h-2 rounded-full shrink-0", meta.dot)} />
      {editing ? (
        <div className="flex-1 space-y-1.5">
          <Input
            value={draft.nome}
            onChange={e => setDraft(p => ({ ...p, nome: e.target.value }))}
            className="h-7 text-xs bg-secondary border-border"
          />
          <Textarea
            value={draft.descricao}
            onChange={e => setDraft(p => ({ ...p, descricao: e.target.value }))}
            className="text-xs min-h-[56px] bg-secondary border-border resize-none"
          />
          <div className="flex gap-1">
            {(["forte", "oportunidade", "critico"] as const).map(s => (
              <button
                key={s}
                onClick={() => setDraft(p => ({ ...p, status: s }))}
                className={cn(
                  "text-[10px] px-2 py-0.5 rounded border font-semibold",
                  draft.status === s ? STATUS_META[s].bg + " " + STATUS_META[s].color : "border-border text-muted-foreground"
                )}
              >
                {STATUS_META[s].label}
              </button>
            ))}
            <div className="ml-auto flex gap-1">
              <button onClick={cancel} className="text-muted-foreground hover:text-foreground"><X size={14} /></button>
              <button onClick={commit} className="text-emerald-500 hover:text-emerald-400"><Check size={14} /></button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-semibold text-foreground">{indicator.nome}</p>
            <span className={cn("text-[10px] font-medium", meta.color)}>· {meta.label}</span>
            {editable && (
              <button onClick={() => { setDraft(indicator); setEditing(true); }} className="ml-auto text-muted-foreground hover:text-foreground shrink-0">
                <Pencil size={11} />
              </button>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{indicator.descricao}</p>
        </div>
      )}
    </div>
  );
}

function DimensionCard({
  dim,
  editable,
  onChange,
}: {
  dim: DiagnosticoDimensao;
  editable: boolean;
  onChange: (updated: DiagnosticoDimensao) => void;
}) {
  const [open, setOpen] = useState(false);
  const [editingHeader, setEditingHeader] = useState(false);
  const [draft, setDraft] = useState({ nome: dim.nome, descricao: dim.descricao, score: dim.score, status: dim.status });
  const meta = STATUS_META[dim.status];

  function commitHeader() {
    onChange({ ...dim, ...draft });
    setEditingHeader(false);
  }

  function updateIndicator(idx: number, updated: DiagnosticoIndicador) {
    const next = [...dim.indicadores];
    next[idx] = updated;
    onChange({ ...dim, indicadores: next });
  }

  return (
    <div className={cn("rounded-xl border p-4 space-y-3", meta.bg)}>
      <div className="flex items-start gap-3">
        <span className="text-2xl">{dim.icon}</span>
        <div className="flex-1 min-w-0">
          {editingHeader ? (
            <div className="space-y-1.5">
              <div className="flex gap-1">
                <Input
                  value={draft.nome}
                  onChange={e => setDraft(p => ({ ...p, nome: e.target.value }))}
                  className="h-7 text-sm font-semibold bg-card border-border"
                />
                <Input
                  type="number"
                  min={0}
                  max={10}
                  value={draft.score}
                  onChange={e => setDraft(p => ({ ...p, score: Number(e.target.value) }))}
                  className="h-7 w-16 text-sm bg-card border-border"
                />
              </div>
              <Textarea
                value={draft.descricao}
                onChange={e => setDraft(p => ({ ...p, descricao: e.target.value }))}
                className="text-xs min-h-[48px] bg-card border-border resize-none"
              />
              <div className="flex gap-1 items-center">
                {(["forte", "oportunidade", "critico"] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setDraft(p => ({ ...p, status: s }))}
                    className={cn(
                      "text-[10px] px-2 py-0.5 rounded border font-semibold",
                      draft.status === s ? STATUS_META[s].bg + " " + STATUS_META[s].color : "border-border text-muted-foreground"
                    )}
                  >
                    {STATUS_META[s].label}
                  </button>
                ))}
                <div className="ml-auto flex gap-1">
                  <button onClick={() => setEditingHeader(false)} className="text-muted-foreground hover:text-foreground"><X size={14} /></button>
                  <button onClick={commitHeader} className="text-emerald-500 hover:text-emerald-400"><Check size={14} /></button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <p className="font-semibold text-sm text-foreground">{dim.nome}</p>
              <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded border", meta.bg, meta.color)}>{meta.label}</span>
              {editable && (
                <button onClick={() => { setDraft({ nome: dim.nome, descricao: dim.descricao, score: dim.score, status: dim.status }); setEditingHeader(true); }} className="ml-auto text-muted-foreground hover:text-foreground shrink-0">
                  <Pencil size={13} />
                </button>
              )}
            </div>
          )}
          {!editingHeader && (
            <>
              <ScoreBar score={dim.score} />
              <p className="text-xs text-muted-foreground mt-1">{dim.descricao}</p>
            </>
          )}
        </div>
      </div>

      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
      >
        {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        {open ? "Fechar" : `Ver ${dim.indicadores.length} indicadores`}
      </button>

      {open && (
        <div className="divide-y divide-border/50">
          {dim.indicadores.map((ind, idx) => (
            <IndicatorRow
              key={idx}
              indicator={ind}
              editable={editable}
              onChange={updated => updateIndicator(idx, updated)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function DiagnosticView({ data, editable = false, onSave, saving = false }: DiagnosticViewProps) {
  const [localData, setLocalData] = useState<DiagnosticoData>(data);
  const [editingSummary, setEditingSummary] = useState(false);
  const [summaryDraft, setSummaryDraft] = useState(data.summary);
  const [scoreDraft, setScoreDraft] = useState(data.overall_score);
  const [dirty, setDirty] = useState(false);

  const scoreColor = localData.overall_score >= 7
    ? "text-emerald-500"
    : localData.overall_score >= 4
    ? "text-amber-500"
    : "text-red-500";

  function updateDimension(idx: number, updated: DiagnosticoDimensao) {
    setLocalData(prev => {
      const next = { ...prev, dimensions: [...prev.dimensions] };
      next.dimensions[idx] = updated;
      return next;
    });
    setDirty(true);
  }

  function commitSummary() {
    setLocalData(prev => ({ ...prev, summary: summaryDraft, overall_score: scoreDraft }));
    setDirty(true);
    setEditingSummary(false);
  }

  return (
    <div className="space-y-5">
      {/* Header / score geral */}
      <div className="rounded-xl border border-border bg-secondary/30 p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className={cn("text-4xl font-black tabular-nums", scoreColor)}>
            {localData.overall_score.toFixed(1)}
          </div>
          <div className="flex-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Score Geral do Negócio</p>
            <div className="mt-1">
              <ScoreBar score={localData.overall_score} />
            </div>
          </div>
          {editable && !editingSummary && (
            <button
              onClick={() => { setSummaryDraft(localData.summary); setScoreDraft(localData.overall_score); setEditingSummary(true); }}
              className="text-muted-foreground hover:text-foreground"
            >
              <Pencil size={14} />
            </button>
          )}
        </div>

        {editingSummary ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground">Score:</label>
              <Input
                type="number"
                min={0}
                max={10}
                step={0.1}
                value={scoreDraft}
                onChange={e => setScoreDraft(Number(e.target.value))}
                className="h-7 w-20 text-sm bg-secondary border-border"
              />
            </div>
            <Textarea
              value={summaryDraft}
              onChange={e => setSummaryDraft(e.target.value)}
              className="text-sm min-h-[80px] bg-secondary border-border resize-none"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setEditingSummary(false)} className="text-muted-foreground hover:text-foreground"><X size={14} /></button>
              <button onClick={commitSummary} className="text-emerald-500 hover:text-emerald-400"><Check size={14} /></button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground leading-relaxed">{localData.summary}</p>
        )}
      </div>

      {/* Dimensões */}
      <div className="space-y-3">
        {localData.dimensions.map((dim, idx) => (
          <DimensionCard
            key={idx}
            dim={dim}
            editable={editable}
            onChange={updated => updateDimension(idx, updated)}
          />
        ))}
      </div>

      {/* Salvar (só quando editable + dirty) */}
      {editable && dirty && onSave && (
        <div className="sticky bottom-0 pb-2">
          <Button
            onClick={() => { onSave(localData); setDirty(false); }}
            disabled={saving}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
          >
            {saving ? "Salvando..." : "Salvar Alterações"}
          </Button>
        </div>
      )}
    </div>
  );
}
