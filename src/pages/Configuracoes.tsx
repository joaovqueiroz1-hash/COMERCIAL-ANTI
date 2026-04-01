import { useState, useCallback, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Upload, FileSpreadsheet, CheckCircle, AlertTriangle, Loader2, Ban, Copy, MessageSquare, Wifi, WifiOff, Eye, EyeOff, Trash2, Info } from 'lucide-react';
import { getZApiStatus, ZApiConfig } from '@/lib/zapi';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { fetchLeads, fetchZApiConfigGlobally, upsertZApiConfigGlobally, deleteZApiConfigGlobally } from '@/lib/api';
import type { LeadInsert } from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';
import { normalizeWhatsAppKey } from '@/lib/whatsapp-utils';
import { supabase } from '@/integrations/supabase/client';

function parseBool(val: any): boolean {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val === 1;
  const s = String(val).toLowerCase().trim();
  return ['sim', 'yes', '1', 'true', 's'].includes(s);
}

function parseNumber(val: any): number {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const n = Number(String(val).replace(/[^\d.,\-]/g, '').replace(',', '.'));
  return isNaN(n) ? 0 : n;
}

function parseFuncionarios(val: any): number {
  const n = parseNumber(val);
  return Math.min(100000, Math.max(0, Math.floor(n)));
}

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

const headerPatterns: [RegExp, string][] = [
  [/nome\s*completo|nome_completo|^nome$/i, 'nome'],
  [/whatsapp|telefone|celular|phone|tel|fone/i, 'whatsapp'],
  [/e[\-_]?mail/i, 'email'],
  [/cidade|city/i, 'cidade'],
  [/^estado$|^uf$|^state$/i, 'estado'],
  [/voce.*empresari|eh_empresari|^empresari/i, 'empresario'],
  [/redes[\s_]*socia|instagram|^nome_empresa$|^empresa$/i, 'instagram'],
  [/funcionario|employees|^func$/i, 'funcionarios'],
  [/maior.*dor|qual.*dor|^dor$|pain|desafio/i, 'maior_dor'],
  [/faturamento|revenue|^fat$/i, 'faturamento'],
  [/capacidade.*invest|investimento/i, 'capacidade_investimento'],
  [/observa|^obs$|notes/i, 'observacoes'],
  [/carimbo|data.*hora|timestamp/i, 'timestamp'],
];

function normalizeHeaders(row: Record<string, any>): Record<string, any> {
  const normalized: Record<string, any> = {};
  for (const rawKey of Object.keys(row)) {
    const stripped = stripAccents(rawKey).toLowerCase().trim().replace(/\s+/g, '_');
    let mapped: string | null = null;
    for (const [pattern, canonical] of headerPatterns) {
      if (pattern.test(stripped)) {
        mapped = canonical;
        break;
      }
    }
    if (mapped) {
      normalized[mapped] = row[rawKey];
    }
  }
  return normalized;
}

function mapRowToLead(row: Record<string, any>): LeadInsert | null {
  const nome = row['nome'] || '';
  if (!String(nome).trim()) return null;

  return {
    nome_completo: String(nome).trim(),
    whatsapp: row['whatsapp'] ? String(row['whatsapp']).trim() : null,
    email: row['email'] ? String(row['email']).trim() : null,
    cidade: row['cidade'] ? String(row['cidade']).trim() : null,
    estado: row['estado'] ? String(row['estado']).trim() : null,
    eh_empresario: row['empresario'] != null ? parseBool(row['empresario']) : false,
    instagram_empresa: row['instagram'] ? String(row['instagram']).trim() : null,
    quantidade_funcionarios: parseFuncionarios(row['funcionarios'] || 0),
    maior_dor: row['maior_dor'] ? String(row['maior_dor']).trim() : null,
    faturamento_anual: parseNumber(row['faturamento'] || 0),
    capacidade_investimento: row['capacidade_investimento'] != null ? parseBool(row['capacidade_investimento']) : false,
    observacoes_iniciais: row['observacoes'] ? String(row['observacoes']).trim() : null,
    status_pipeline: 'novo_lead',
    prioridade: 'media',
  };
}

function generateDedupKey(lead: LeadInsert): string {
  const name = lead.nome_completo.toLowerCase().trim().replace(/\s+/g, ' ');
  const email = (lead.email || '').toLowerCase().trim();
  const phone = normalizeWhatsAppKey(lead.whatsapp);
  return `${name}|${email}|${phone}`;
}

export default function Configuracoes() {
  // ── Z-API state ──
  const [zapiForm, setZapiForm] = useState<ZApiConfig>({ instanceId: '', token: '', clientToken: '' });
  const [zapiSaved, setZapiSaved] = useState(false);
  const [zapiStatus, setZapiStatus] = useState<'idle' | 'checking' | 'connected' | 'error'>('idle');
  const [zapiStatusMsg, setZapiStatusMsg] = useState('');
  const [showToken, setShowToken] = useState(false);

  useEffect(() => {
    fetchZApiConfigGlobally().then((cfg) => {
      if (cfg) {
        setZapiForm({
          instanceId: cfg.instance_id,
          token: cfg.token,
          clientToken: cfg.client_token || '',
        });
        setZapiSaved(true);
      }
    });
  }, []);

  const handleZapiSave = async () => {
    if (!zapiForm.instanceId.trim() || !zapiForm.token.trim()) {
      toast.error('Preencha o Instance ID e o Token');
      return;
    }
    try {
      await upsertZApiConfigGlobally({
        instance_id: zapiForm.instanceId.trim(),
        token: zapiForm.token.trim(),
        client_token: zapiForm.clientToken.trim() || null,
      });
      setZapiSaved(true);
      toast.success('Configurações Z-API salvas no servidor');
    } catch (e: any) {
      toast.error('Erro ao salvar configuração: ' + e.message);
    }
  };

  const handleZapiTest = async () => {
    if (!zapiForm.instanceId || !zapiForm.token) { toast.error('Configure e salve primeiro'); return; }
    setZapiStatus('checking');
    setZapiStatusMsg('');
    try {
      const status = await getZApiStatus(zapiForm);
      if (status.connected) {
        setZapiStatus('connected');
        setZapiStatusMsg('WhatsApp conectado e funcionando!');
      } else {
        setZapiStatus('error');
        setZapiStatusMsg('Instância desconectada. Verifique o QR Code no painel Z-API.');
      }
    } catch (e: any) {
      setZapiStatus('error');
      setZapiStatusMsg(e.message ?? 'Erro ao conectar na Z-API');
    }
  };

  const handleZapiClear = async () => {
    try {
      await deleteZApiConfigGlobally();
      setZapiForm({ instanceId: '', token: '', clientToken: '' });
      setZapiSaved(false);
      setZapiStatus('idle');
      toast.info('Configuração Z-API removida');
    } catch (e: any) {
      toast.error('Erro ao remover configuração');
    }
  };

  // ── Import state ──
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{
    success: number;
    errors: number;
    duplicates: number;
    errorRows: string[];
  } | null>(null);
  const queryClient = useQueryClient();

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f && (f.name.endsWith('.csv') || f.name.endsWith('.xlsx'))) {
      setFile(f);
      setResult(null);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setResult(null);
    }
  };

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    setResult(null);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      if (rows.length === 0) {
        toast.error('Arquivo vazio ou sem dados válidos.');
        setImporting(false);
        return;
      }

      // Fetch existing leads for dedup
      const existingLeads = await fetchLeads();
      const existingKeys = new Set<string>();
      for (const el of existingLeads) {
        const name = el.nome_completo.toLowerCase().trim().replace(/\s+/g, ' ');
        const email = (el.email || '').toLowerCase().trim();
        const phone = normalizeWhatsAppKey(el.whatsapp);
        existingKeys.add(`${name}|${email}|${phone}`);
      }

      const normalizedRows = rows.map(row => normalizeHeaders(row));

      let success = 0;
      let errors = 0;
      let duplicates = 0;
      const errorRows: string[] = [];
      const validLeads: LeadInsert[] = [];
      const seenKeys = new Set<string>();

      for (let i = 0; i < normalizedRows.length; i++) {
        const lead = mapRowToLead(normalizedRows[i]);
        if (!lead) {
          errors++;
          errorRows.push(`Linha ${i + 2}: nome ausente`);
          continue;
        }

        const key = generateDedupKey(lead);

        // Check against existing DB leads AND already-seen in this file
        if (existingKeys.has(key) || seenKeys.has(key)) {
          duplicates++;
          continue;
        }

        seenKeys.add(key);
        validLeads.push(lead);
      }

      // Insert in batches of 50 via Edge Function (bypasses RLS)
      const BATCH_SIZE = 50;
      for (let i = 0; i < validLeads.length; i += BATCH_SIZE) {
        const batch = validLeads.slice(i, i + BATCH_SIZE);
        try {
          const res = await supabase.functions.invoke('import-leads', { body: { leads: batch } });
          if (res.error) throw new Error(res.error.message);
          if (res.data?.error) throw new Error(res.data.error);
          success += batch.length;
        } catch (err: any) {
          errors += batch.length;
          errorRows.push(`Lote ${Math.floor(i / BATCH_SIZE) + 1}: ${err.message || 'Erro desconhecido'}`);
        }
      }

      setResult({ success, errors, duplicates, errorRows });
      queryClient.invalidateQueries({ queryKey: ['leads'] });

      if (success > 0) {
        toast.success(`${success} lead(s) importado(s) com sucesso!`);
      }
      if (duplicates > 0) {
        toast.info(`${duplicates} duplicado(s) ignorado(s).`);
      }
      if (errors > 0) {
        toast.error(`${errors} linha(s) com erro.`);
      }

      setFile(null);
    } catch (err: any) {
      toast.error('Erro ao processar arquivo: ' + (err.message || 'Formato inválido'));
    } finally {
      setImporting(false);
    }
  };

  return (
    <AppLayout title="Configurações" subtitle="Importação de dados e configurações do sistema">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Import */}
        <div className="card-premium p-4 sm:p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <FileSpreadsheet size={16} className="text-primary" />
            Importar Leads (CSV/Excel)
          </h3>

          <div
            className={`border-2 border-dashed rounded-lg p-6 sm:p-8 text-center transition-colors ${
              isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-border-hover'
            }`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <Upload size={28} className="mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-foreground mb-1">Arraste o arquivo aqui ou</p>
            <label className="cursor-pointer">
              <span className="text-sm text-primary hover:underline">clique para selecionar</span>
              <input type="file" accept=".csv,.xlsx" onChange={handleFileChange} className="hidden" />
            </label>
            <p className="text-[10px] text-muted-foreground mt-2">Formatos aceitos: CSV, XLSX • Duplicados são ignorados automaticamente</p>
          </div>

          {file && (
            <div className="mt-4 p-3 bg-secondary rounded-lg flex items-center gap-3 flex-wrap sm:flex-nowrap">
              <CheckCircle size={16} className="text-success shrink-0" />
              <span className="text-sm text-foreground flex-1 truncate">{file.name}</span>
              <Button
                onClick={handleImport}
                disabled={importing}
                className="gold-gradient text-primary-foreground font-semibold text-xs h-8 px-4 w-full sm:w-auto"
              >
                {importing ? <><Loader2 size={14} className="animate-spin mr-1" /> Importando...</> : 'Importar'}
              </Button>
            </div>
          )}

          {result && (
            <div className="mt-4 space-y-2">
              <div className="p-3 bg-secondary rounded-lg">
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle size={14} className="text-success" />
                    <span className="text-foreground"><strong className="text-success">{result.success}</strong> importado(s)</span>
                  </span>
                  {result.duplicates > 0 && (
                    <span className="flex items-center gap-1.5">
                      <Copy size={14} className="text-warning" />
                      <span className="text-foreground"><strong className="text-warning">{result.duplicates}</strong> duplicado(s)</span>
                    </span>
                  )}
                  {result.errors > 0 && (
                    <span className="flex items-center gap-1.5">
                      <Ban size={14} className="text-destructive" />
                      <span className="text-foreground"><strong className="text-destructive">{result.errors}</strong> erro(s)</span>
                    </span>
                  )}
                </div>
              </div>
              {result.errorRows.length > 0 && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg max-h-40 overflow-y-auto">
                  <p className="text-xs font-semibold text-destructive mb-1 flex items-center gap-1">
                    <AlertTriangle size={12} /> Erros encontrados:
                  </p>
                  {result.errorRows.map((err, i) => (
                    <p key={i} className="text-xs text-muted-foreground">{err}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="mt-4">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Campos aceitos no CSV:</p>
            <div className="flex flex-wrap gap-1">
              {['nome_completo', 'whatsapp', 'email', 'cidade', 'estado', 'empresario', 'nome_empresa', 'instagram', 'funcionarios', 'maior_dor', 'faturamento_anual', 'capacidade_investimento', 'observacoes'].map((field) => (
                <span key={field} className="text-[10px] px-2 py-1 rounded bg-secondary text-muted-foreground font-mono">
                  {field}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Z-API */}
        <div className="card-premium p-4 sm:p-6">
          <h3 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
            <MessageSquare size={16} className="text-primary" />
            Integração WhatsApp — Z-API
          </h3>
          <p className="text-xs text-muted-foreground mb-4">
            Conecte sua instância Z-API para enviar mensagens diretamente pelo WhatsApp CRM.
            Crie sua conta em{' '}
            <span className="text-primary">z-api.io</span>
            {' '}e copie as credenciais da sua instância.
          </p>

          {/* Status banner */}
          {zapiStatus !== 'idle' && (
            <div className={`flex items-center gap-2 px-3 py-2.5 rounded-lg mb-4 text-sm ${
              zapiStatus === 'connected'
                ? 'bg-success/10 border border-success/25 text-success'
                : zapiStatus === 'checking'
                ? 'bg-info/10 border border-info/25 text-info'
                : 'bg-destructive/10 border border-destructive/25 text-destructive'
            }`}>
              {zapiStatus === 'checking' && <Loader2 size={14} className="animate-spin shrink-0" />}
              {zapiStatus === 'connected' && <Wifi size={14} className="shrink-0" />}
              {zapiStatus === 'error' && <WifiOff size={14} className="shrink-0" />}
              <span>{zapiStatus === 'checking' ? 'Verificando conexão...' : zapiStatusMsg}</span>
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Instance ID <span className="text-destructive">*</span></label>
              <input
                value={zapiForm.instanceId}
                onChange={(e) => { setZapiForm(f => ({ ...f, instanceId: e.target.value })); setZapiSaved(false); }}
                placeholder="Ex: 3D8F2A1B4E..."
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 font-mono"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Token <span className="text-destructive">*</span></label>
              <div className="relative">
                <input
                  type={showToken ? 'text' : 'password'}
                  value={zapiForm.token}
                  onChange={(e) => { setZapiForm(f => ({ ...f, token: e.target.value })); setZapiSaved(false); }}
                  placeholder="Cole seu token aqui"
                  className="w-full bg-secondary border border-border rounded-lg pl-3 pr-10 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
                Client-Token
                <span className="text-[10px] text-muted-foreground/50">(opcional — token da CONTA, não da instância)</span>
              </label>
              <input
                value={zapiForm.clientToken}
                onChange={(e) => { setZapiForm(f => ({ ...f, clientToken: e.target.value })); setZapiSaved(false); }}
                placeholder="Deixe vazio se não usa Security Token"
                className={`w-full bg-secondary border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 font-mono ${
                  zapiForm.clientToken && zapiForm.clientToken === zapiForm.token
                    ? 'border-warning/60 bg-warning/5'
                    : 'border-border'
                }`}
              />
              {zapiForm.clientToken && zapiForm.clientToken === zapiForm.token && (
                <p className="text-[11px] text-warning mt-1.5 flex items-center gap-1">
                  <AlertTriangle size={11} />
                  Este campo está igual ao Token da instância — isso causa erro 400. Deixe em branco ou insira o token de segurança da sua conta Z-API.
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                onClick={handleZapiSave}
                className="gold-gradient text-primary-foreground font-semibold text-xs h-9 px-5"
              >
                {zapiSaved ? <><CheckCircle size={13} className="mr-1.5" /> Salvo</> : 'Salvar credenciais'}
              </Button>
              <Button
                variant="outline"
                onClick={handleZapiTest}
                disabled={!zapiSaved || zapiStatus === 'checking'}
                className="border-border text-foreground text-xs h-9 px-5"
              >
                {zapiStatus === 'checking'
                  ? <><Loader2 size={13} className="animate-spin mr-1.5" /> Testando...</>
                  : <><Wifi size={13} className="mr-1.5" /> Testar conexão</>}
              </Button>
              {zapiSaved && (
                <Button
                  variant="ghost"
                  onClick={handleZapiClear}
                  className="text-destructive hover:bg-destructive/10 text-xs h-9 px-3"
                >
                  <Trash2 size={13} className="mr-1.5" /> Remover
                </Button>
              )}
            </div>
          </div>

          <div className="mt-4 p-3 rounded-lg bg-secondary/60 border border-border/50 space-y-3">
            <div className="flex gap-2">
              <Info size={13} className="text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                As credenciais do Z-API agora são armazenadas no servidor (Supabase) e compartilhadas com toda a equipe para uso do CRM Realtime.
              </p>
            </div>
            <div className="flex gap-2 border-t border-border/50 pt-2">
              <AlertTriangle size={13} className="text-warning shrink-0 mt-0.5" />
              <div className="text-[11px] text-muted-foreground leading-relaxed">
                <strong className="text-foreground">Webhook Obrigatório:</strong> Para receber novas mensagens no sistema, vá no painel da sua instância na Z-API, abra a aba "Webhooks" e habilite as opções "Ao Receber", configurando a URL abaixo:
                <div className="flex items-center gap-2 mt-1.5 mb-1 bg-background border border-border rounded px-2 py-1.5 focus-within:border-primary/50 transition-colors">
                  <code className="text-primary font-mono text-[10px] sm:text-xs select-all flex-1">https://[SEU_PROJETO].supabase.co/functions/v1/zapi-webhook</code>
                </div>
                <p className="text-[10px] opacity-80">Substitua <code className="text-primary bg-primary/10 px-1 rounded">{"[SEU_PROJETO]"}</code> pela URL real do seu projeto Supabase atual.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
