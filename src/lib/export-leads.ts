import { STATUS_LABELS, PipelineStatus } from '@/lib/types';

// Exporta leads para uma planilha .xlsx com cabeçalhos amigáveis em PT-BR.
// xlsx é carregado sob demanda (dynamic import) para não pesar no bundle inicial.

const simNao = (v: boolean | null | undefined) => (v ? 'Sim' : 'Não');
const dataBR = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleDateString('pt-BR') : '';

export async function exportLeadsToExcel(
  leads: any[],
  profiles: { id: string; nome: string }[] = [],
  fileName = 'leads-arquivados',
): Promise<number> {
  const nomeVendedor = (id: string | null | undefined) =>
    profiles.find(p => p.id === id)?.nome ?? '';

  const rows = leads.map(l => ({
    'Nome completo': l.nome_completo ?? '',
    'Empresa': l.nome_empresa ?? '',
    'WhatsApp': l.whatsapp ?? '',
    'E-mail': l.email ?? '',
    'Cidade': l.cidade ?? '',
    'Estado': l.estado ?? '',
    'Instagram': l.instagram_empresa ?? '',
    'Nicho': l.nicho ?? '',
    'É empresário': simNao(l.eh_empresario),
    'Qtd. funcionários': l.quantidade_funcionarios ?? 0,
    'Faturamento anual (R$)': l.faturamento_anual ?? 0,
    'Maior dor': l.maior_dor ?? '',
    'Capacidade de investimento': simNao(l.capacidade_investimento),
    'Status': STATUS_LABELS[l.status_pipeline as PipelineStatus] ?? l.status_pipeline ?? '',
    'Prioridade': l.prioridade ?? '',
    'Origem': l.origem ?? '',
    'Lista de origem': l.lista_origem ?? '',
    'Motivo da perda': l.motivo_perda ?? '',
    'Observações iniciais': l.observacoes_iniciais ?? '',
    'Observações estratégicas': l.observacoes_estrategicas ?? '',
    'Vendedor': nomeVendedor(l.vendedor_id),
    'Criado em': dataBR(l.created_at),
    'Último contato': dataBR(l.ultimo_contato),
  }));

  const XLSX = await import('xlsx');
  const ws = XLSX.utils.json_to_sheet(rows);
  // Largura aproximada de cada coluna com base no tamanho do cabeçalho
  ws['!cols'] = Object.keys(rows[0] ?? {}).map(k => ({ wch: Math.max(14, k.length + 2) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Leads Arquivados');
  const hoje = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `${fileName}-${hoje}.xlsx`);
  return rows.length;
}
