import Anthropic from "@anthropic-ai/sdk";

// ── tipos ─────────────────────────────────────────────────────────────────────

export interface DiagnosticoIndicador {
  nome: string;
  descricao: string;
  status: "forte" | "oportunidade" | "critico";
}

export interface DiagnosticoDimensao {
  nome: string;
  descricao: string;
  score: number; // 0-10
  status: "forte" | "oportunidade" | "critico";
  indicadores: DiagnosticoIndicador[];
}

export interface DiagnosticoData {
  overall_score: number; // 0-10
  summary: string;
  dimensions: DiagnosticoDimensao[];
}

// ── extração de texto ─────────────────────────────────────────────────────────

export async function extractTextFromFile(file: File): Promise<string> {
  if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
    return extractPdf(file);
  }
  if (
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    file.name.endsWith(".docx")
  ) {
    return extractDocx(file);
  }
  if (
    file.type === "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    file.name.endsWith(".pptx")
  ) {
    return extractPptx(file);
  }
  return file.text();
}

async function extractPdf(file: File): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");
  // @ts-ignore — Vite handles the ?url import
  const workerUrl = new URL("pdfjs-dist/build/pdf.worker.mjs", import.meta.url).href;
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    pages.push(content.items.map((item: any) => item.str).join(" "));
  }
  return pages.join("\n\n");
}

async function extractDocx(file: File): Promise<string> {
  const mammoth = await import("mammoth");
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

async function extractPptx(file: File): Promise<string> {
  const { unzipSync, strFromU8 } = await import("fflate");
  const arrayBuffer = await file.arrayBuffer();
  const zipped = unzipSync(new Uint8Array(arrayBuffer));
  const texts: string[] = [];
  for (const [path, data] of Object.entries(zipped)) {
    if (/^ppt\/slides\/slide\d+\.xml$/.test(path)) {
      const xml = strFromU8(data);
      // Extrai apenas o texto dos elementos <a:t>
      const matches = xml.match(/<a:t[^>]*>([^<]+)<\/a:t>/g) ?? [];
      const slideText = matches.map(m => m.replace(/<[^>]+>/g, "")).join(" ");
      if (slideText.trim()) texts.push(slideText);
    }
  }
  return texts.join("\n\n");
}

// ── prompt de diagnóstico ─────────────────────────────────────────────────────

const DIAGNOSTIC_PROMPT = `Você é um especialista em diagnóstico empresarial estratégico.

Com base no conteúdo do documento fornecido, analise o negócio do cliente e gere um diagnóstico completo e estruturado.

Retorne um JSON válido (sem markdown, sem texto extra) exatamente neste formato:
{
  "overall_score": <número de 0 a 10>,
  "summary": "<parágrafo com síntese executiva do negócio, pontos fortes e principais desafios>",
  "dimensions": [
    {
      "nome": "<nome da dimensão>",
      "descricao": "<avaliação desta dimensão em 1-2 frases>",
      "score": <número de 0 a 10>,
      "status": "<forte|oportunidade|critico>",
      "indicadores": [
        {
          "nome": "<nome do indicador>",
          "descricao": "<avaliação específica deste indicador>",
          "status": "<forte|oportunidade|critico>"
        }
      ]
    }
  ]
}

Analise obrigatoriamente as seguintes dimensões (use exatamente esses nomes, sem emoji):
1. Posicionamento & Proposta de Valor
2. Marketing & Comunicação
3. Vendas & Conversão
4. Tráfego & Aquisição
5. Relacionamento & Retenção
6. Operações & Processos
7. Produto & Entrega
8. Métricas & Gestão

Cada dimensão deve ter entre 3 e 5 indicadores.
Status "forte" = funcionando bem (score 7-10).
Status "oportunidade" = pode melhorar (score 4-6).
Status "critico" = precisa ação urgente (score 0-3).

Seja direto, específico ao negócio descrito, e evite generalismos.`;

// ── geração do diagnóstico via Claude ─────────────────────────────────────────

export async function gerarDiagnostico(docText: string, apiKeyOverride?: string): Promise<DiagnosticoData> {
  const apiKey =
    apiKeyOverride ||
    import.meta.env.VITE_ANTHROPIC_API_KEY ||
    localStorage.getItem("anthropic_api_key") ||
    "";
  if (!apiKey) throw new Error("Chave da API não configurada. Insira a chave no campo abaixo.");

  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8000,
    messages: [
      {
        role: "user",
        content: `${DIAGNOSTIC_PROMPT}\n\n---\n\nCONTEÚDO DO DOCUMENTO:\n\n${docText.slice(0, 40000)}`,
      },
    ],
  });

  const rawText = (message.content[0] as any).text as string;

  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Claude não retornou JSON válido.");

  let jsonStr = jsonMatch[0];

  // Se o JSON foi truncado, tenta fechar os colchetes/chaves abertos
  try {
    return JSON.parse(jsonStr) as DiagnosticoData;
  } catch {
    // Conta colchetes e chaves abertos para fechar o JSON truncado
    let opens = 0;
    let arrOpens = 0;
    for (const ch of jsonStr) {
      if (ch === "{") opens++;
      else if (ch === "}") opens--;
      else if (ch === "[") arrOpens++;
      else if (ch === "]") arrOpens--;
    }
    // Remove trailing vírgula solta se houver
    jsonStr = jsonStr.replace(/,\s*$/, "");
    for (let i = 0; i < arrOpens; i++) jsonStr += "]";
    for (let i = 0; i < opens; i++) jsonStr += "}";
    try {
      return JSON.parse(jsonStr) as DiagnosticoData;
    } catch (e2) {
      throw new Error("Resposta da IA incompleta. Tente novamente com um documento menor.");
    }
  }
}
