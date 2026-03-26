import { Lead, Interacao, ProximaAcao, User, PipelineLog, PipelineStatus, Prioridade } from './types';

export const mockUsers: User[] = [
  { id: 'u1', nome: 'Letícia Vaz', email: 'leticia@lvbusinessclub.com', perfil: 'admin', ativo: true },
  { id: 'u2', nome: 'Marina Costa', email: 'marina@lvbusinessclub.com', perfil: 'gestor', ativo: true },
  { id: 'u3', nome: 'Rafael Oliveira', email: 'rafael@lvbusinessclub.com', perfil: 'vendedor', ativo: true },
  { id: 'u4', nome: 'Camila Santos', email: 'camila@lvbusinessclub.com', perfil: 'vendedor', ativo: true },
  { id: 'u5', nome: 'Bruno Mendes', email: 'bruno@lvbusinessclub.com', perfil: 'vendedor', ativo: false },
];

function parseFaturamento(raw: string): number {
  if (!raw) return 0;
  const cleaned = raw.toLowerCase().replace(/[r$€\s]/g, '').replace('reais', '').replace('anual', '').replace('ano', '').trim();
  if (cleaned.includes('milhões') || cleaned.includes('milhoes') || cleaned.includes('mi') || cleaned.includes('mm')) {
    const num = parseFloat(cleaned.replace(/[^0-9.,]/g, '').replace(',', '.'));
    return isNaN(num) ? 0 : num * 1000000;
  }
  if (cleaned.includes('m') && !cleaned.includes('mil')) {
    const num = parseFloat(cleaned.replace(/[^0-9.,]/g, '').replace(',', '.'));
    return isNaN(num) ? 0 : num * 1000000;
  }
  if (cleaned.includes('k') || cleaned.includes('mil')) {
    const num = parseFloat(cleaned.replace(/[^0-9.,]/g, '').replace(',', '.'));
    return isNaN(num) ? 0 : num * 1000;
  }
  const num = parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
  return isNaN(num) ? 0 : num;
}

const statuses: PipelineStatus[] = ['novo_lead', 'tentativa_contato', 'contato_realizado', 'reuniao_agendada', 'reuniao_realizada', 'followup', 'negociacao', 'fechado', 'perdido'];

function assignStatus(i: number): PipelineStatus {
  const distribution: PipelineStatus[] = [
    'novo_lead', 'novo_lead', 'novo_lead', 'novo_lead', 'novo_lead', 'novo_lead', 'novo_lead', 'novo_lead',
    'tentativa_contato', 'tentativa_contato', 'tentativa_contato', 'tentativa_contato', 'tentativa_contato',
    'contato_realizado', 'contato_realizado', 'contato_realizado', 'contato_realizado',
    'reuniao_agendada', 'reuniao_agendada', 'reuniao_agendada', 'reuniao_agendada',
    'reuniao_realizada', 'reuniao_realizada', 'reuniao_realizada',
    'followup', 'followup', 'followup', 'followup',
    'negociacao', 'negociacao', 'negociacao',
    'fechado', 'fechado', 'fechado',
    'perdido', 'perdido',
  ];
  return distribution[i % distribution.length];
}

function assignPrioridade(fat: number, empresario: boolean): Prioridade {
  if (fat > 1000000 && empresario) return 'alta';
  if (fat > 200000) return 'media';
  return 'baixa';
}

function assignFit(fat: number, empresario: boolean, capInvest: boolean): number {
  let fit = 1;
  if (empresario) fit += 1;
  if (capInvest) fit += 1;
  if (fat > 500000) fit += 1;
  if (fat > 2000000) fit += 1;
  return Math.min(fit, 5);
}

const rawLeads = [
  { date: '2026-02-20', nome: 'Lívia Carollyna Silva Pereira', whatsapp: '21972727238', email: 'liviacsp.brito@gmail.com', empresario: false, empresa: '', instagram: '', func: 0, dor: 'Iniciar negócio do zero', fat: '0', capInvest: true, cidade: 'Rio de Janeiro', estado: 'RJ' },
  { date: '2026-02-20', nome: 'Carolyne Cardoso de Carvalho', whatsapp: '71982336707', email: 'donacharmosa.mdi@gmail.com', empresario: true, empresa: 'Dona Charmosa', instagram: '@donacharmosa.beauty', func: 0, dor: 'Financeiro e estratégia de vendas', fat: '115000', capInvest: true, cidade: 'Salvador', estado: 'BA' },
  { date: '2026-02-20', nome: 'Julia Kleque', whatsapp: '+44792291942', email: 'juliakleque@gmail.com', empresario: true, empresa: 'Kleque & Co.', instagram: '@klequeandco', func: 1, dor: 'Crescer o negócio', fat: '500000', capInvest: true, cidade: 'Londres', estado: 'EX' },
  { date: '2026-02-20', nome: 'Luciana Simpson da Silva', whatsapp: '92982048658', email: 'luciana.simpson1904@gmail.com', empresario: true, empresa: 'Le Chic Manaus', instagram: '@lechicmanaus', func: 1, dor: 'Alcançar clientes', fat: '600000', capInvest: true, cidade: 'Manaus', estado: 'AM' },
  { date: '2026-02-20', nome: 'Juliana Ricca', whatsapp: '64996021020', email: 'juricca@hotmail.com', empresario: false, empresa: '', instagram: '@julianaricca.lidera', func: 1, dor: 'Estruturar mentoria', fat: '800000', capInvest: true, cidade: 'Goiânia', estado: 'GO' },
  { date: '2026-02-20', nome: 'Francine de Souza', whatsapp: '11916495191', email: 'francinesouza29@hotmail.com', empresario: true, empresa: 'Francine Confeitaria', instagram: '@francinesouzaconfeitaria', func: 2, dor: 'Marketing', fat: '400000', capInvest: true, cidade: 'São Paulo', estado: 'SP' },
  { date: '2026-02-20', nome: 'Ítala Rodrigues', whatsapp: '81996757733', email: 'rodrigues.itala@gmail.com', empresario: true, empresa: 'VHV', instagram: '@itala.vhv', func: 2, dor: 'Captação de leads qualificados', fat: '800000', capInvest: true, cidade: 'Recife', estado: 'PE' },
  { date: '2026-02-20', nome: 'Sofia Brito', whatsapp: '45999927227', email: 'sofiabritol@hotmail.com', empresario: true, empresa: 'Ashira Joias', instagram: '@ashirajoiass', func: 2, dor: 'Escalar', fat: '144000', capInvest: true, cidade: 'Foz do Iguaçu', estado: 'PR' },
  { date: '2026-02-20', nome: 'Sara Gurgel', whatsapp: '35984114693', email: 'saragurgel97@gmail.com', empresario: true, empresa: 'Intimate SS', instagram: '@intimate.ss', func: 2, dor: 'Engajamento e comunidade', fat: '1200000', capInvest: true, cidade: 'Varginha', estado: 'MG' },
  { date: '2026-02-20', nome: 'Andreia Bittencourt', whatsapp: '12981457750', email: 'andreiabralves@hotmail.com', empresario: true, empresa: 'Bitten Store', instagram: '@bitten_store', func: 2, dor: 'Escalar', fat: '1500000', capInvest: true, cidade: 'São José dos Campos', estado: 'SP' },
  { date: '2026-02-20', nome: 'Gabriela Tanese', whatsapp: '11986301305', email: 'gabrielapltanese@gmail.com', empresario: true, empresa: 'Viga Engenharia', instagram: '@vigaengenhariaeconstrucao', func: 3, dor: 'Gravar conteúdos', fat: '300000', capInvest: true, cidade: 'São Paulo', estado: 'SP' },
  { date: '2026-02-20', nome: 'Vitória Fernandes', whatsapp: '13996464973', email: 'contato.vitchola@gmail.com', empresario: true, empresa: 'Vitchola', instagram: '@vitchola', func: 3, dor: 'Gestão de pessoas', fat: '1800000', capInvest: true, cidade: 'Santos', estado: 'SP' },
  { date: '2026-02-20', nome: 'Jessica Helena Moreira', whatsapp: '19992499003', email: 'helenajessica59@gmail.com', empresario: true, empresa: 'Camori Boutique', instagram: '@camoriboutique', func: 3, dor: 'Arrumar rotina da empresa', fat: '900000', capInvest: true, cidade: 'Campinas', estado: 'SP' },
  { date: '2026-02-21', nome: 'Lyria Lucille Prado', whatsapp: '11993953123', email: 'lyriaprado@gmail.com', empresario: true, empresa: 'Closet Midy', instagram: '@closetmidy', func: 3, dor: 'Baixas vendas e prejuízos', fat: '586067', capInvest: true, cidade: 'São Paulo', estado: 'SP' },
  { date: '2026-02-20', nome: 'Thais Dias de Azevedo', whatsapp: '21997021569', email: 'contato.thaismello@gmail.com', empresario: true, empresa: 'Maloario', instagram: '@maloario', func: 4, dor: 'Escalar vendas', fat: '1200000', capInvest: true, cidade: 'Rio de Janeiro', estado: 'RJ' },
  { date: '2026-02-21', nome: 'Diego Zanichelli', whatsapp: '92999851995', email: 'cassiano.diego@gmail.com', empresario: true, empresa: 'Seja Roots', instagram: '@seja_roots', func: 4, dor: 'Campanhas e posicionamento', fat: '1200000', capInvest: true, cidade: 'Manaus', estado: 'AM' },
  { date: '2026-02-20', nome: 'Juliana Santos', whatsapp: '48991939004', email: 'julianaskmr@gmail.com', empresario: true, empresa: 'Seja Ceci', instagram: '@sejaceci', func: 4, dor: 'Fazer o site funcionar', fat: '1800000', capInvest: true, cidade: 'Florianópolis', estado: 'SC' },
  { date: '2026-02-20', nome: 'Diego Biagiotti', whatsapp: '19992011388', email: 'diego@mrshelby.com.br', empresario: true, empresa: 'Mr. Shelby', instagram: '@use.mrshelby', func: 4, dor: 'Posicionamento da marca', fat: '2400000', capInvest: true, cidade: 'Campinas', estado: 'SP' },
  { date: '2026-02-20', nome: 'Aline dos Santos', whatsapp: '12992489019', email: 'aline.ssilva.2013@outlook.com', empresario: true, empresa: 'New Modas', instagram: '@new_modas_', func: 5, dor: 'Transição para site e gestão', fat: '1000500', capInvest: true, cidade: 'São José dos Campos', estado: 'SP' },
  { date: '2026-02-20', nome: 'Sofia Castellano', whatsapp: '11991615402', email: 'sofia@spookies.com.br', empresario: true, empresa: 'Spookies', instagram: '@spookiesbr', func: 5, dor: 'Escala', fat: '1500000', capInvest: true, cidade: 'São Paulo', estado: 'SP' },
  { date: '2026-02-21', nome: 'Giovanna Roger', whatsapp: '81984427144', email: 'giovanna_pereira11@hotmail.com', empresario: true, empresa: 'Zarzu Jeans', instagram: '@zarzujeans', func: 5, dor: 'Potencial inexplorado', fat: '2500000', capInvest: true, cidade: 'Toritama', estado: 'PE' },
  { date: '2026-02-21', nome: 'Marcela Lamastra', whatsapp: '11997989210', email: 'marcela.lamastra@marcelalamastra.com.br', empresario: true, empresa: 'Marcela Lamastra', instagram: '@marcelalamastra', func: 5, dor: 'Construção de ecossistemas', fat: '2000000', capInvest: true, cidade: 'São Paulo', estado: 'SP' },
  { date: '2026-02-20', nome: 'Carla Ceragioli', whatsapp: '11975505460', email: 'carla@amicamia.com.br', empresario: true, empresa: 'Amica Mia', instagram: '@amicamia', func: 6, dor: 'Escalar o negócio', fat: '1500000', capInvest: true, cidade: 'São Paulo', estado: 'SP' },
  { date: '2026-02-21', nome: 'Chrystiane Carvalho', whatsapp: '31995415808', email: 'chrystianeccarvalho@gmail.com', empresario: true, empresa: 'Chic Four C', instagram: '@chicfourc', func: 6, dor: 'Posicionamento para e-commerce', fat: '2400000', capInvest: true, cidade: 'Belo Horizonte', estado: 'MG' },
  { date: '2026-02-20', nome: 'Matheus Alves', whatsapp: '41987852518', email: 'mthalves521@gmail.com', empresario: true, empresa: 'Use Apexx', instagram: '@use.apexx', func: 6, dor: 'Digital (só vende físico)', fat: '2400000', capInvest: true, cidade: 'Curitiba', estado: 'PR' },
  { date: '2026-02-20', nome: 'Stephanie Galera', whatsapp: '44988156446', email: 'stephaniesuellen15@gmail.com', empresario: true, empresa: 'Acessórios NaSP', instagram: '@acessoriosnasp', func: 7, dor: 'Crescimento de faturamento', fat: '2000000', capInvest: true, cidade: 'Maringá', estado: 'PR' },
  { date: '2026-02-20', nome: 'Marina Ocanha', whatsapp: '19987295951', email: 'marina.ocanha@hotmail.com', empresario: true, empresa: 'Jo Modas Online', instagram: '@jomodasonline', func: 8, dor: 'Marketing e vendas on-line', fat: '2000000', capInvest: true, cidade: 'Campinas', estado: 'SP' },
  { date: '2026-02-21', nome: 'Maria Luiza Martins', whatsapp: '11941190562', email: 'marialuizabernardes2012@outlook.com', empresario: true, empresa: 'Marketplaces', instagram: '', func: 8, dor: 'Criar site próprio', fat: '9000000', capInvest: true, cidade: 'São Paulo', estado: 'SP' },
  { date: '2026-02-21', nome: 'Bruno Gilliard Mendes', whatsapp: '17991461221', email: 'bruno@youman.com.br', empresario: true, empresa: 'You Man Grooming', instagram: '@youmangrooming', func: 8, dor: 'Marca mais conhecida para vendas', fat: '2800000', capInvest: true, cidade: 'São José do Rio Preto', estado: 'SP' },
  { date: '2026-02-20', nome: 'Patricia Ribeiro', whatsapp: '34988110404', email: 'patricia@patybiju.com.br', empresario: true, empresa: 'Paty Biju', instagram: '@patybiju', func: 10, dor: 'Internet', fat: '3000000', capInvest: true, cidade: 'Uberlândia', estado: 'MG' },
  { date: '2026-02-20', nome: 'Danielle Marques', whatsapp: '16992309871', email: 'contatodaniellemaarques@gmail.com', empresario: true, empresa: 'Do Silêncio ao Silício', instagram: '@dosilencioaosilicio', func: 10, dor: 'Escala', fat: '500000', capInvest: true, cidade: 'Ribeirão Preto', estado: 'SP' },
  { date: '2026-02-20', nome: 'Thamillia Guimarães', whatsapp: '71992464668', email: 'dolitastore@gmail.com', empresario: true, empresa: 'Dolita Store', instagram: '@dolitastore', func: 11, dor: 'Organização de processos', fat: '7000000', capInvest: true, cidade: 'Salvador', estado: 'BA' },
  { date: '2026-02-20', nome: 'Andressa Avelar', whatsapp: '34993169115', email: 'andressaavelars@gmail.com', empresario: true, empresa: 'Segue a Creative', instagram: '@segueacreative', func: 12, dor: 'Atender segmentos com qualidade', fat: '1200000', capInvest: true, cidade: 'Uberlândia', estado: 'MG' },
  { date: '2026-02-21', nome: 'Janaina Monteiro', whatsapp: '81999713362', email: 'janejanayna6@gmail.com', empresario: true, empresa: 'Vem Cá Moda e Tecidos', instagram: '@vemcamodaetecidos', func: 12, dor: 'Gestão', fat: '12000000', capInvest: true, cidade: 'Recife', estado: 'PE' },
  { date: '2026-02-21', nome: 'Talita Pinheiro', whatsapp: '+13059061526', email: 'talita@talitapinheiro.com', empresario: true, empresa: 'Everything Concierge', instagram: '@talipinheiro', func: 15, dor: 'Falta de SOPs e escala', fat: '1500000', capInvest: true, cidade: 'Miami', estado: 'EX' },
  { date: '2026-02-20', nome: 'Ana Paula Niedermeyer', whatsapp: '44997261177', email: 'ana@anamayerlingerie.com.br', empresario: true, empresa: 'Ana Mayer Lingerie', instagram: '@anamayerlingerie', func: 25, dor: 'Planejamento estratégico', fat: '4000000', capInvest: true, cidade: 'Maringá', estado: 'PR' },
  { date: '2026-02-20', nome: 'Mozara Coracini', whatsapp: '45999132308', email: 'mozarabmaicon@gmail.com', empresario: true, empresa: 'Coracini Store', instagram: '@coracinistore', func: 25, dor: 'Escalar e-commerce', fat: '6000000', capInvest: true, cidade: 'Foz do Iguaçu', estado: 'PR' },
  { date: '2026-02-20', nome: 'Natacha Guadanhini', whatsapp: '35991662524', email: 'natachadesousaguadanhini@gmail.com', empresario: true, empresa: 'Natasha Tricot', instagram: '@natashatricot', func: 29, dor: 'Delegar', fat: '12000000', capInvest: true, cidade: 'Pouso Alegre', estado: 'MG' },
  { date: '2026-02-20', nome: 'Amanda Klie', whatsapp: '16981367454', email: 'ambordados12@gmail.com', empresario: true, empresa: 'AM Bordados', instagram: '@loja_ambordados', func: 30, dor: 'Criativos e posicionamento', fat: '700000', capInvest: true, cidade: 'Ribeirão Preto', estado: 'SP' },
  { date: '2026-02-20', nome: 'Fabiula Sardeli', whatsapp: '19991376097', email: 'fabiula.sardeli@gmail.com', empresario: true, empresa: 'Flor de Cacto Concept', instagram: '@flordecactoconcept', func: 40, dor: 'Gestão de tempo', fat: '14000000', capInvest: true, cidade: 'Campinas', estado: 'SP' },
  { date: '2026-02-20', nome: 'Gabriela Nogueira', whatsapp: '19997427612', email: 'gabriela@037creations.com', empresario: true, empresa: '037 Creations', instagram: '@037creations', func: 50, dor: 'Low profile, oportunidades perdidas', fat: '10000000', capInvest: true, cidade: 'Campinas', estado: 'SP' },
  { date: '2026-02-21', nome: 'Flávia Lacerda', whatsapp: '11976493097', email: 'flavia@mimobom.com.br', empresario: true, empresa: 'Lojas Mimo Bom', instagram: '@lojasmimobom', func: 130, dor: 'Posicionar marca pessoal', fat: '20000000', capInvest: true, cidade: 'São Paulo', estado: 'SP' },
  { date: '2026-02-21', nome: 'Maysa Calegari', whatsapp: '11947754714', email: 'calegarimaysa@gmail.com', empresario: true, empresa: 'Grupo Toys', instagram: '@grupotoys.oficial', func: 230, dor: 'Comunidade e multicanais', fat: '90000000', capInvest: true, cidade: 'São Paulo', estado: 'SP' },
  { date: '2026-02-20', nome: 'Pamella Andrade', whatsapp: '31999386208', email: 'pamellaateixeira@gmail.com', empresario: true, empresa: 'Azelia Oficial / Ágil Sports', instagram: '@azelia.oficial', func: 8, dor: 'Escalar vendas', fat: '1000000', capInvest: true, cidade: 'Belo Horizonte', estado: 'MG' },
  { date: '2026-02-21', nome: 'Priscila Traina', whatsapp: '14981714666', email: 'priscilatraina@yahoo.com.br', empresario: true, empresa: 'Ext.Fit', instagram: '@ext.fit', func: 35, dor: 'Produção e gestão de estoque', fat: '7000000', capInvest: true, cidade: 'Bauru', estado: 'SP' },
  { date: '2026-02-20', nome: 'Fernanda Bisquolo', whatsapp: '11972202220', email: 'fernanda@inbrasilturismo.com.br', empresario: true, empresa: 'InBrasil Eventos e Turismo', instagram: '@inbrasileventoseturismo', func: 22, dor: 'Crescimento', fat: '20000000', capInvest: true, cidade: 'São Paulo', estado: 'SP' },
  { date: '2026-02-20', nome: 'Pedro Neves Moro', whatsapp: '27997490995', email: 'pedronevesmoro@gmail.com', empresario: true, empresa: 'Pedro Moro', instagram: '@pedromoro93', func: 23, dor: 'Viralizar', fat: '2000000', capInvest: true, cidade: 'Vitória', estado: 'ES' },
];

const vendedores = ['u3', 'u4'];

export const mockLeads: Lead[] = rawLeads.map((r, i) => {
  const fat = r.fat ? parseFaturamento(r.fat) || parseInt(r.fat.replace(/\D/g, '')) || 0 : 0;
  const status = assignStatus(i);
  const pri = assignPrioridade(fat, r.empresario);
  const fit = assignFit(fat, r.empresario, r.capInvest);
  const vendedor = vendedores[i % vendedores.length];
  const dayOffset = i * 2;
  const lastContact = status !== 'novo_lead' ? new Date(Date.now() - (dayOffset * 24 * 60 * 60 * 1000 + Math.random() * 48 * 60 * 60 * 1000)).toISOString() : null;
  const nextFollowup = status !== 'fechado' && status !== 'perdido' ? new Date(Date.now() + ((i % 7) * 24 * 60 * 60 * 1000)).toISOString() : null;

  return {
    id: `lead-${i + 1}`,
    created_at: new Date(r.date).toISOString(),
    nome_completo: r.nome,
    whatsapp: r.whatsapp,
    email: r.email,
    cidade: r.cidade,
    estado: r.estado,
    eh_empresario: r.empresario,
    nome_empresa: r.empresa,
    instagram_empresa: r.instagram,
    quantidade_funcionarios: r.func,
    maior_dor: r.dor,
    faturamento_anual: fat,
    capacidade_investimento: r.capInvest,
    observacoes_iniciais: '',
    status_pipeline: status,
    gestor_id: 'u2',
    vendedor_id: vendedor,
    prioridade: pri,
    fit_mentoria: fit,
    probabilidade_fechamento: status === 'fechado' ? 100 : status === 'negociacao' ? 70 : status === 'reuniao_realizada' ? 50 : status === 'reuniao_agendada' ? 30 : 10,
    ultimo_contato: lastContact,
    proximo_followup: nextFollowup,
    tags: r.empresario ? ['Empresário'] : ['Não empresário'],
    observacoes_estrategicas: '',
    origem: 'Formulário LV Business Club',
  };
});

export const mockInteracoes: Interacao[] = mockLeads
  .filter((l) => l.status_pipeline !== 'novo_lead')
  .slice(0, 20)
  .map((l, i) => ({
    id: `int-${i + 1}`,
    created_at: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
    lead_id: l.id,
    tipo: (['whatsapp', 'ligacao', 'reuniao', 'email'] as const)[i % 4],
    realizado_por: l.vendedor_id || 'u3',
    resumo: [
      'Primeiro contato realizado via WhatsApp. Lead demonstrou interesse.',
      'Ligação de qualificação. Entende o valor da mentoria.',
      'Reunião de apresentação da mentoria realizada com sucesso.',
      'E-mail de follow-up enviado com material complementar.',
      'WhatsApp de acompanhamento. Lead pediu mais tempo.',
    ][i % 5],
    objecoes: i % 3 === 0 ? 'Preço elevado' : '',
    interesse_demonstrado: (['alto', 'medio', 'baixo'] as const)[i % 3],
    proximo_passo: 'Agendar próxima reunião',
    data_proximo_followup: new Date(Date.now() + (i + 1) * 24 * 60 * 60 * 1000).toISOString(),
  }));

export const mockProximasAcoes: ProximaAcao[] = [
  { id: 'pa-1', lead_id: 'lead-18', titulo: 'Reunião de fechamento', descricao: 'Apresentar proposta final', data_hora: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), tipo: 'reuniao', responsavel_id: 'u3', concluida: false },
  { id: 'pa-2', lead_id: 'lead-20', titulo: 'Enviar proposta', descricao: 'Proposta personalizada para Spookies', data_hora: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), tipo: 'email', responsavel_id: 'u4', concluida: false },
  { id: 'pa-3', lead_id: 'lead-15', titulo: 'Follow-up WhatsApp', descricao: 'Checar interesse após reunião', data_hora: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(), tipo: 'whatsapp', responsavel_id: 'u3', concluida: false },
  { id: 'pa-4', lead_id: 'lead-22', titulo: 'Reunião com Marcela', descricao: 'Apresentação do programa', data_hora: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(), tipo: 'reuniao', responsavel_id: 'u4', concluida: false },
];

export const mockPipelineLogs: PipelineLog[] = mockLeads
  .filter((l) => l.status_pipeline !== 'novo_lead')
  .slice(0, 10)
  .map((l, i) => ({
    id: `log-${i + 1}`,
    lead_id: l.id,
    status_anterior: 'novo_lead',
    status_novo: l.status_pipeline,
    alterado_por: l.vendedor_id || 'u3',
    alterado_em: new Date(Date.now() - i * 48 * 60 * 60 * 1000).toISOString(),
  }));
