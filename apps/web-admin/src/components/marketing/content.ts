/**
 * Textos da pagina inicial e das paginas de solucao. So recursos que existem no
 * produto (nada de logos, numeros ou depoimentos inventados).
 */

export type StepIcon = 'smartphone' | 'camera' | 'layout' | 'file' | 'message' | 'bell' | 'users' | 'target' | 'clock' | 'check';

export interface SolutionPage {
  slug: string;
  /** Titulo grande da pagina. */
  headline: string;
  intro: string;
  /** Problemas que o modelo resolve (dor do cliente). */
  pains: string[];
  /** Como funciona no dia a dia, em etapas. */
  steps: Array<{ icon: StepIcon; title: string; text: string }>;
  /** Quem usa o que (cargos do modelo + administrador). */
  personas: Array<{ role: string; text: string }>;
  faq: Array<{ q: string; a: string }>;
}

export const SOLUTION_PAGES: Record<string, SolutionPage> = {
  'gestao-sinistros': {
    slug: 'gestao-sinistros',
    headline: 'Sinistros do aviso à indenização, com prazo e relatório pronto',
    intro:
      'O analista registra o aviso e cobra os documentos; o regulador faz a vistoria e a regulação pelo celular, com fotos e assinatura. Cada sinistro tem situação, prazo e histórico de andamentos, e o relatório sai em PDF com um clique.',
    pains: [
      'Avisos em e-mail e WhatsApp, sem saber em que pé cada sinistro está',
      'Prazos estourados porque ninguém vê o que vence hoje',
      'Fotos, boletim e documentos espalhados em pastas',
      'Relatório de regulação montado na mão, um por um',
    ],
    steps: [
      { icon: 'message', title: 'Aviso do sinistro', text: 'O analista abre o sinistro em segundos (até pelo chat, com /sinistro), já ligado ao segurado e à apólice.' },
      { icon: 'camera', title: 'Vistoria e documentos', text: 'O regulador vai ao local com o app, tira as fotos do dano, anexa o boletim e colhe a assinatura do segurado, mesmo sem sinal.' },
      { icon: 'clock', title: 'Prazos e andamentos', text: 'Cada etapa vira um andamento. A tela inicial de cada pessoa mostra o que está atrasado, vence hoje ou está chegando.' },
      { icon: 'file', title: 'Relatório em PDF', text: 'Segurado, ocorrência, valores, andamentos, fotos, parecer e assinatura num relatório pronto para a seguradora.' },
    ],
    personas: [
      { role: 'Regulador', text: 'Vê os segurados e só os sinistros que regula; registra vistoria, andamentos e parecer pelo app.' },
      { role: 'Analista de sinistros', text: 'Recebe os avisos, cobra documentos, acompanha os prazos no painel e gera os relatórios.' },
      { role: 'Administrador', text: 'Ajusta os campos, as situações, os tipos de sinistro e quem vê o quê.' },
    ],
    faq: [
      { q: 'Dá para usar com várias seguradoras?', a: 'Sim. A seguradora é um campo do segurado; o painel filtra e separa por ela.' },
      { q: 'O segurado pode enviar documentos sozinho?', a: 'Pode, com um link público que abre só o formulário de envio, sem login.' },
      { q: 'Consigo mudar as etapas do sinistro?', a: 'Sim. A situação é uma lista de opções: você renomeia, cria ou remove etapas e escolhe quais encerram o sinistro.' },
    ],
  },
  'vistoria-veicular': {
    slug: 'vistoria-veicular',
    headline: 'Vistoria de frota no celular, com laudo pronto em PDF',
    intro:
      'O vistoriador faz o checklist no app, tira as fotos e colhe a assinatura do motorista, mesmo sem sinal. O gestor acompanha a frota e as não conformidades num painel e gera o laudo com um clique.',
    pains: [
      'Checklist em papel que se perde ou chega dias depois',
      'Fotos espalhadas no WhatsApp, sem ligação com o veículo',
      'Não conformidades que ninguém acompanha até a correção',
      'Laudo montado na mão, no Word, a cada vistoria',
    ],
    steps: [
      { icon: 'smartphone', title: 'Vistoria no app', text: 'O vistoriador escolhe o veículo pela placa e preenche o checklist, inclusive no pátio sem internet.' },
      { icon: 'camera', title: 'Fotos e assinatura', text: 'Frente, traseira, laterais, foto de cada problema e a assinatura do motorista ficam no próprio registro.' },
      { icon: 'layout', title: 'Painel da frota', text: 'O gestor vê vistorias por dia, resultado, não conformidades por item e gravidade, e a fila de pendências.' },
      { icon: 'file', title: 'Laudo em PDF', text: 'Placa, checklist, não conformidades, fotos e assinatura num laudo pronto para enviar ou arquivar.' },
    ],
    personas: [
      { role: 'Vistoriador', text: 'Vê toda a frota e só as vistorias que ele mesmo fez; registra e corrige as próprias.' },
      { role: 'Gestor de frota', text: 'Vê tudo, cobra as correções, exporta para Excel e gera os laudos.' },
      { role: 'Administrador', text: 'Ajusta o checklist, cria campos novos e define quem vê o quê.' },
    ],
    faq: [
      { q: 'Posso mudar os itens do checklist?', a: 'Sim. O checklist é uma tabela como qualquer outra: você adiciona, remove ou renomeia itens sem programar.' },
      { q: 'Funciona com motorista terceirizado?', a: 'Sim. Com um link público, terceiros se cadastram e preenchem só a tabela que você liberar.' },
      { q: 'O laudo pode ter o meu logo?', a: 'Pode. O modelo de PDF é editável: logo, textos, campos, fotos e ordem dos blocos.' },
    ],
  },
  'ordem-servico': {
    slug: 'ordem-servico',
    headline: 'Ordens de serviço do atendimento ao fechamento',
    intro:
      'O atendente abre a OS e agenda o técnico. Em campo, o técnico registra o serviço, as peças, as fotos de antes e depois e a assinatura do cliente. O painel mostra a fila, o faturamento e o ticket médio.',
    pains: [
      'OS em papel ou planilha, sem saber o que está atrasado',
      'Técnico liga para o escritório para saber o próximo serviço',
      'Peças usadas que não chegam ao faturamento',
      'Cliente sem comprovante do que foi feito',
    ],
    steps: [
      { icon: 'message', title: 'Abertura', text: 'O atendente abre a OS pela tela ou digitando /os no chat, já ligada ao cliente.' },
      { icon: 'clock', title: 'Fila e agenda', text: 'Quadro por situação (aberta, agendada, em execução, aguardando peça, concluída) e agenda por técnico.' },
      { icon: 'camera', title: 'Execução em campo', text: 'No app, o técnico lança peças e serviços, fotos de antes e depois e a assinatura do cliente.' },
      { icon: 'file', title: 'OS em PDF', text: 'A OS sai com dados do cliente, itens, valores e assinatura, pronta para enviar.' },
    ],
    personas: [
      { role: 'Técnico', text: 'Recebe só as próprias ordens no app, executa e registra tudo no local.' },
      { role: 'Atendente', text: 'Cadastra clientes, abre e agenda ordens e acompanha a fila.' },
      { role: 'Administrador', text: 'Ajusta os tipos de serviço, campos e permissões, e acompanha o faturamento.' },
    ],
    faq: [
      { q: 'Consigo ver o histórico de um cliente?', a: 'Sim. Cada cliente mostra todas as ordens dele, com situação, técnico e valor.' },
      { q: 'O técnico vê as ordens dos outros?', a: 'Não, no modelo o técnico vê só as próprias. Você pode mudar isso nas permissões.' },
      { q: 'Dá para cobrar contrato de manutenção?', a: 'O cadastro do cliente já tem o tipo de contrato; os painéis e filtros mostram quem tem contrato ativo.' },
    ],
  },
  'crm-vendas-b2b': {
    slug: 'crm-vendas-b2b',
    headline: 'Funil de vendas B2B que a equipe usa de verdade',
    intro:
      'Empresas, oportunidades e atividades num só lugar. Cada vendedor cuida das próprias oportunidades; o gestor vê o funil inteiro, o valor em negociação, os motivos de perda e gera a proposta em PDF.',
    pains: [
      'Funil numa planilha que cada vendedor preenche de um jeito',
      'Proposta copiada e colada de um arquivo antigo',
      'Ninguém sabe por que as vendas foram perdidas',
      'Follow-up esquecido porque o próximo passo não está anotado',
    ],
    steps: [
      { icon: 'target', title: 'Oportunidade', text: 'Registre pela tela ou com /oportunidade no chat: valor, previsão, origem e próximo passo.' },
      { icon: 'layout', title: 'Funil e quadro', text: 'Arraste as oportunidades entre as etapas e veja o valor em cada uma.' },
      { icon: 'check', title: 'Atividades', text: 'Ligações, reuniões e visitas ligadas à oportunidade, com o que foi combinado.' },
      { icon: 'file', title: 'Proposta em PDF', text: 'Escopo, investimento e condições saem prontos a partir da oportunidade.' },
    ],
    personas: [
      { role: 'Vendedor', text: 'Vê todas as empresas e só as próprias oportunidades e atividades.' },
      { role: 'Gestor comercial', text: 'Vê o funil da equipe, os motivos de perda e exporta relatórios.' },
      { role: 'Administrador', text: 'Ajusta etapas, origens, campos da proposta e permissões.' },
    ],
    faq: [
      { q: 'Posso mudar as etapas do funil?', a: 'Sim. As etapas são opções de um campo: renomeie, crie ou remova, com a cor que quiser.' },
      { q: 'Dá para importar minha lista de clientes?', a: 'Sim, por Excel. A tabela de empresas importa e exporta planilhas.' },
      { q: 'Integra com meu ERP?', a: 'Por API e webhooks: o ERP pode ler e criar registros, e o sistema avisa o ERP quando algo muda.' },
    ],
  },
  'chamados-manutencao': {
    slug: 'chamados-manutencao',
    headline: 'Chamados de manutenção com prazo, responsável e histórico',
    intro:
      'Qualquer pessoa abre um chamado ligado ao equipamento ou local. A equipe de manutenção atende, aponta as horas e o material, e o painel mostra a fila, os prazos e os ativos que mais dão problema.',
    pains: [
      'Pedido de manutenção por e-mail, telefone ou no corredor',
      'Sem prazo nem responsável, o chamado fica esquecido',
      'Ninguém sabe quantas horas e quanto material cada equipamento consome',
      'Preventiva que só é lembrada depois da quebra',
    ],
    steps: [
      { icon: 'message', title: 'Abertura', text: 'O solicitante abre pelo app, pela tela ou com /chamado no chat, com foto do problema.' },
      { icon: 'clock', title: 'Prazo e fila', text: 'Prioridade define o prazo (SLA); o quadro mostra o que está aberto, em atendimento ou aguardando material.' },
      { icon: 'users', title: 'Atendimento', text: 'O técnico registra horas, material e a solução; o solicitante acompanha e avalia.' },
      { icon: 'file', title: 'Relatório', text: 'Relatório de atendimento em PDF e histórico completo por equipamento.' },
    ],
    personas: [
      { role: 'Solicitante', text: 'Abre chamados e acompanha só os que ele mesmo abriu.' },
      { role: 'Técnico de manutenção', text: 'Vê a fila inteira, atende, aponta horas e registra a solução.' },
      { role: 'Administrador', text: 'Cadastra os ativos, ajusta categorias, prioridades e permissões.' },
    ],
    faq: [
      { q: 'Serve para condomínio ou escola?', a: 'Sim. "Ativo" pode ser equipamento, sala, bloco ou instalação; os campos são ajustáveis.' },
      { q: 'Consigo controlar a preventiva?', a: 'O ativo guarda a última preventiva e a periodicidade; chamados preventivos entram na mesma fila.' },
      { q: 'O solicitante precisa de login?', a: 'Pode usar o app com login próprio ou um link público que dá acesso só à abertura de chamados.' },
    ],
  },
};

/** Casos de uso por segmento e por area; cada um aponta para o modelo mais proximo. */
export const USE_CASES = {
  segmentos: [
    { title: 'Reguladoras e corretoras de seguros', text: 'Aviso, vistoria, regulação e relatório de sinistro com prazo e fotos.', solution: 'gestao-sinistros' },
    { title: 'Associações de proteção veicular', text: 'Sinistros dos associados, documentos e indenização acompanhados de perto.', solution: 'gestao-sinistros' },
    { title: 'Transporte e logística', text: 'Vistoria de saída e retorno, não conformidades e laudo por placa.', solution: 'vistoria-veicular' },
    { title: 'Locadoras e oficinas', text: 'Checklist de entrega e devolução com fotos e assinatura do cliente.', solution: 'vistoria-veicular' },
    { title: 'Assistência técnica', text: 'OS com agenda de técnicos, peças, fotos e assinatura no local.', solution: 'ordem-servico' },
    { title: 'Climatização e elétrica', text: 'Instalações, preventivas e contratos de manutenção por cliente.', solution: 'ordem-servico' },
    { title: 'Indústria e distribuição', text: 'Funil de vendas B2B, propostas e acompanhamento por vendedor.', solution: 'crm-vendas-b2b' },
    { title: 'Facilities, condomínios e escolas', text: 'Chamados por local, prazo por prioridade e histórico de cada ativo.', solution: 'chamados-manutencao' },
  ],
  areas: [
    { title: 'Sinistros e regulação', text: 'Avisos, documentos, vistoria, parecer e indenização com prazos e histórico.', solution: 'gestao-sinistros' },
    { title: 'Vistorias e inspeções', text: 'Checklist com fotos, não conformidades com prazo e laudo em PDF.', solution: 'vistoria-veicular' },
    { title: 'Operações de campo', text: 'Formulários no celular que funcionam offline, com foto, local e assinatura.', solution: 'ordem-servico' },
    { title: 'Comercial', text: 'Empresas, oportunidades, atividades e propostas no mesmo lugar.', solution: 'crm-vendas-b2b' },
    { title: 'Manutenção', text: 'Chamados, apontamento de horas e custo de material por equipamento.', solution: 'chamados-manutencao' },
    { title: 'Atendimento', text: 'Abertura pelo chat com comandos, fila por situação e avisos automáticos.', solution: 'ordem-servico' },
    { title: 'Algo que não está aqui', text: 'Comece em branco e monte as tabelas, os painéis e os documentos do seu processo.', solution: null },
  ],
} as const;

/** "Como funciona": uma aba por parte da montagem, com captura real do sistema. */
export const HOW_IT_WORKS = [
  {
    id: 'tabelas',
    label: 'Tabelas e formulários',
    title: 'Monte o formulário do seu processo',
    text: 'Arraste campos e organize em linhas e seções. Texto, número, moeda, data, listas com cor, foto, assinatura, local e sub-tabelas.',
    bullets: ['Campos obrigatórios e únicos', 'Regras por campo: obrigatório, visível, valor padrão, cálculo', 'Sub-tabelas: itens da OS, não conformidades'],
    image: '/home/como-tabela.webp',
  },
  {
    id: 'registros',
    label: 'Registros',
    title: 'A equipe preenche, você acompanha',
    text: 'O mesmo formulário no navegador e no app. Cada registro guarda quem fez, quando, fotos, assinatura e o histórico de alterações.',
    bullets: ['Busca, filtros e exportação para Excel', 'Importação de planilhas', 'Lixeira para desfazer exclusões'],
    image: '/home/como-formulario.webp',
  },
  {
    id: 'paineis',
    label: 'Painéis',
    title: 'Painéis por cargo, sem fórmula',
    text: 'Indicadores, gráficos, funil, quadro kanban e tabelas. Cada cargo abre direto no painel dele, e um clique no gráfico filtra o resto.',
    bullets: ['Mais de 20 tipos de widget', 'Abas no mesmo painel', 'Filtro cruzado entre os gráficos'],
    image: '/home/como-painel.webp',
  },
  {
    id: 'documentos',
    label: 'Documentos em PDF',
    title: 'Laudos, OS e propostas com um clique',
    text: 'Monte o documento com os campos do registro, tabelas das sub-tabelas, fotos e assinatura. A pré-visualização mostra exatamente como sai.',
    bullets: ['Logo, cabeçalho e rodapé', 'Dados do registro pai (ex.: placa do veículo)', 'Geração individual ou em lote'],
    image: '/home/como-pdf.webp',
  },
  {
    id: 'permissoes',
    label: 'Permissões',
    title: 'Cada pessoa vê só o que precisa',
    text: 'Cargos com permissão por tabela e por campo: ver tudo, só os próprios registros ou os da equipe. Campos sensíveis somem até do app.',
    bullets: ['Cargos e equipes', 'Campo escondido por cargo', 'Hierarquia: quem gerencia quem'],
    image: '/home/como-cargos.webp',
  },
  {
    id: 'chat',
    label: 'Chat e comandos',
    title: 'Trabalho combinado no próprio registro',
    text: 'Conversa por tabela, por registro e direta. Comandos como /os ou /pendencias viram formulário ou consulta sem sair do chat.',
    bullets: ['Cartão do registro na conversa', 'Comandos que criam ou consultam', 'Conversa direta e por equipe'],
    image: '/home/como-chat.webp',
  },
] as const;

export const INTEGRATIONS = [
  { title: 'API com chaves', text: 'Leia e grave registros a partir de qualquer sistema, com chave e permissões próprias.' },
  { title: 'Webhooks', text: 'Avise o ERP, o financeiro ou outra ferramenta quando um registro é criado ou alterado.' },
  { title: 'Automações', text: 'Quando algo acontece, o sistema age: muda campo, cria registro, avisa pessoas, chama webhook.' },
  { title: 'Excel', text: 'Importe as planilhas que você já tem e exporte qualquer tabela ou consulta.' },
  { title: 'Links públicos', text: 'Terceiros (motoristas, prestadores, clientes) se cadastram por link e preenchem só o que você liberou.' },
  { title: 'Avisos', text: 'Notificações no sistema e no celular quando algo muda no que é seu.' },
] as const;

export const SECURITY = [
  { title: 'Dados isolados por empresa', text: 'Cada empresa só enxerga os próprios dados, no navegador, na API e no app.' },
  { title: 'Permissão por campo', text: 'Campos escondidos por cargo não chegam nem ao celular de quem não pode ver.' },
  { title: 'Acesso protegido', text: 'Verificação em 2 etapas, política de senha e controle das sessões ativas.' },
  { title: 'Auditoria', text: 'Registro de quem fez o quê: acessos, alterações de cargos, usuários e configurações.' },
  { title: 'Lixeira e histórico', text: 'Registros excluídos podem ser restaurados; alterações ficam registradas.' },
  { title: 'LGPD', text: 'Exportação completa dos dados da empresa e encerramento da conta pelo próprio dono.' },
] as const;
