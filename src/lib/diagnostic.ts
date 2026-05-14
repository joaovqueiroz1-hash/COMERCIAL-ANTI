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

const DIAGNOSTIC_PROMPT = `Você é um especialista em diagnóstico empresarial. Analise o negócio e retorne APENAS um JSON válido, sem markdown, sem texto fora do JSON.

REGRAS OBRIGATÓRIAS DE FORMATO (para caber no limite de tokens):
- summary: máximo 2 frases curtas
- descricao de cada dimensão: máximo 1 frase (15 palavras)
- descricao de cada indicador: máximo 1 frase (12 palavras)
- Exatamente 3 indicadores por dimensão
- Nenhum campo pode ser omitido

JSON a retornar:
{"overall_score":0,"summary":"","dimensions":[{"nome":"","descricao":"","score":0,"status":"forte","indicadores":[{"nome":"","descricao":"","status":"forte"}]}]}

Use exatamente estas 8 dimensões (nesta ordem, nomes exatos):
1. Posicionamento & Proposta de Valor
2. Marketing & Comunicação
3. Vendas & Conversão
4. Tráfego & Aquisição
5. Relacionamento & Retenção
6. Operações & Processos
7. Produto & Entrega
8. Métricas & Gestão

Status: "forte" (score 7-10), "oportunidade" (4-6), "critico" (0-3).
Seja específico ao negócio. Retorne SOMENTE o JSON completo e fechado.`;

// ── reparo de JSON truncado ────────────────────────────────────────────────────

function repairJson(json: string): string {
  const stack: string[] = [];
  let inString = false;
  let escaped = false;
  let i = 0;

  for (; i < json.length; i++) {
    const ch = json[i];
    if (escaped) { escaped = false; continue; }
    if (ch === "\\" && inString) { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{" || ch === "[") stack.push(ch);
    else if (ch === "}" || ch === "]") stack.pop();
  }

  // Se terminamos dentro de uma string, corta até o último campo completo
  let trimmed = json;
  if (inString) {
    // Recua até a última vírgula ou chave que não esteja dentro de string
    const lastSafe = json.lastIndexOf('",');
    trimmed = lastSafe > 0 ? json.slice(0, lastSafe + 1) : json;
    // Recalcula o stack
    stack.length = 0;
    inString = false; escaped = false;
    for (const ch of trimmed) {
      if (escaped) { escaped = false; continue; }
      if (ch === "\\" && inString) { escaped = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === "{" || ch === "[") stack.push(ch);
      else if (ch === "}" || ch === "]") stack.pop();
    }
  }

  // Remove vírgula solta no final
  trimmed = trimmed.replace(/,\s*$/, "");
  // Fecha estruturas abertas na ordem inversa
  const closing = stack.reverse().map(c => c === "{" ? "}" : "]").join("");
  return trimmed + closing;
}

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

  try {
    return JSON.parse(jsonStr) as DiagnosticoData;
  } catch {
    // Reparo via máquina de estados: ignora { } [ ] dentro de strings
    const repaired = repairJson(jsonStr);
    try {
      return JSON.parse(repaired) as DiagnosticoData;
    } catch {
      throw new Error("Resposta da IA incompleta. Tente novamente com um documento menor.");
    }
  }
}
