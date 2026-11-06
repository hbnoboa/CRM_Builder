/**
 * Ajuda do botao "?": texto curto, passo a passo e (quando ha) um mini video das
 * telas reais em public/help/<video>.webm (gravado em ambiente de teste, sem dados de cliente).
 */
export interface HelpTopic {
  title: string;
  /** Para que serve, em 1-2 frases. */
  intro: string;
  /** Como usar, em passos curtos. */
  steps?: string[];
  /** Exemplo do dia a dia. */
  example?: string;
  /** Nome do arquivo em public/help (sem extensao). */
  video?: string;
}

export const HELP: Record<string, HelpTopic> = {
  // ── Ajustes da tabela ────────────────────────────────────────────────
  'settings.title': {
    title: 'Nome do registro',
    intro: 'É o campo que identifica cada registro. Ele aparece como título nas listas, na tela inicial, no painel lateral e nas pendências.',
    steps: ['Escolha o campo que as pessoas usam para reconhecer o registro.', 'Clique em Salvar ajustes.'],
    example: 'Numa Ordem de serviço, use "Nº da OS". Num Cliente, use "Nome". Num Veículo, use "Placa".',
    video: 'ajustes-nome',
  },
  'settings.status': {
    title: 'Situação',
    intro: 'É o campo que diz em que pé o registro está. Com ele, a tela inicial mostra a situação de cada item com a cor da opção.',
    steps: ['Escolha um campo do tipo "Lista de opções" (ex.: Aberta, Em andamento, Concluída) ou um "Sim ou não" (ex.: Resolvida).', 'Marque quais opções encerram o registro.'],
    example: 'Na OS: Situação. Numa não conformidade: Resolvida (Sim/Não).',
    video: 'ajustes-pendencias',
  },
  'settings.done': {
    title: 'Situações que encerram',
    intro: 'Quando o registro chega numa dessas situações, ele sai de "Minhas pendências": não há mais nada a fazer nele.',
    steps: ['Clique nas opções que significam "acabou" (ex.: Concluída, Cancelada).', 'Elas ficam marcadas com "encerra".'],
    video: 'ajustes-pendencias',
  },
  'settings.deadline': {
    title: 'Prazo',
    intro: 'É a data limite do registro. Com um prazo, a tela inicial de cada pessoa mostra o que está atrasado, o que vence hoje e o que está chegando.',
    steps: ['Escolha um campo de Data (ex.: Agendada para, Vencimento).', 'Escolha também a Situação e o que encerra, para os concluídos saírem da lista.'],
    example: 'Uma OS agendada para ontem e ainda "Aberta" aparece como "atrasado 1 dia".',
    video: 'ajustes-pendencias',
  },
  'settings.assignee': {
    title: 'Responsável',
    intro: 'Separa as pendências por pessoa: cada um vê só os registros em que é o responsável.',
    steps: ['Crie na aba Campos um campo "Pessoa da equipe" (ex.: Técnico).', 'Salve, volte aqui e escolha esse campo.'],
    example: 'Sem responsável, todos que veem a tabela veem as mesmas pendências.',
  },

  // ── Regras do campo ──────────────────────────────────────────────────
  'rules.field': {
    title: 'Regras do campo',
    intro: 'Fazem o formulário se adaptar ao que a pessoa preenche: mostrar um campo só quando faz sentido, exigir em alguns casos ou travar para ninguém mudar.',
    steps: [
      'Ligue a regra que quer usar.',
      'Escolha o campo de referência, a condição ("for", "não for", "estiver preenchido"...) e o valor.',
      'Salve. No editor o campo continua aparecendo, com uma etiqueta lembrando a regra.',
    ],
    example: 'Mostrar "CNPJ" só quando o Tipo for Empresa. Exigir "Motivo" quando a Situação for Cancelada.',
    video: 'regras-campo',
  },

  // ── Modulos da administracao ────────────────────────────────────────
  'module.entities': {
    title: 'Tabelas',
    intro: 'Cada tabela guarda um tipo de informação da empresa: clientes, ordens de serviço, veículos, visitas. Você define os campos (as perguntas do formulário) e a equipe preenche.',
    steps: ['Clique em "Nova tabela" e comece por um modelo ou em branco.', 'Adicione os campos e arraste para organizar.', 'Na aba Ajustes, diga qual é o nome do registro, a situação e o prazo.'],
    video: 'modulo-tabelas',
  },
  'module.pdf': {
    title: 'Modelos de PDF',
    intro: 'Documentos prontos para imprimir ou mandar ao cliente, preenchidos com os dados do registro: ordem de serviço, laudo, orçamento, relatório.',
    steps: ['Clique em "Novo modelo" e escolha a tabela.', 'Deixe marcado "Já começar com a ficha montada".', 'Ajuste no editor e clique em Publicar. O botão "Gerar PDF" aparece nos registros.'],
    video: 'modulo-pdf',
  },
  'module.dashboards': {
    title: 'Painéis',
    intro: 'Telas com números e gráficos para acompanhar a operação: quantas OS abertas, faturamento, situação por tipo.',
    steps: ['Abra ou crie um painel.', 'Clique num bloco à esquerda (ex.: "Número com variação") para adicionar.', 'Ajuste à direita e escolha em "Quem vê" quais cargos usam o painel.'],
    video: 'modulo-paineis',
  },
  'module.automations': {
    title: 'Automações',
    intro: 'Coisas que o sistema faz sozinho: avisar alguém, mandar e-mail, preencher uma data, enviar dados para outro sistema.',
    steps: ['Abra a tabela e vá na aba Automações.', 'Clique em "Criar automação" e escolha uma ideia pronta.', 'Complete as escolhas e confira a frase "Vai funcionar assim".'],
    example: 'Quando a OS ficar "Concluída", mandar e-mail ao cliente e preencher "Concluída em".',
    video: 'modulo-automacoes',
  },
  'module.integrations': {
    title: 'Integrações',
    intro: 'Liga a empresa a outros sistemas (ERP, site, Zapier, planilhas). Chaves de API deixam outro sistema ler e gravar registros; webhooks avisam outro sistema quando algo muda.',
    steps: ['Chaves de API: crie uma chave com um cargo e entregue ao responsável pelo outro sistema.', 'Webhooks: clique em "Conectar sistema" e cole o endereço que o outro sistema forneceu.'],
  },
  'module.users': {
    title: 'Usuários',
    intro: 'As pessoas da empresa que entram no sistema. Cada uma tem um cargo, que define o que ela vê e pode fazer.',
    steps: ['Clique em "Novo usuário" e preencha nome e e-mail.', 'Escolha o cargo.', 'A pessoa recebe o acesso e já entra com as permissões do cargo.'],
    video: 'modulo-usuarios',
  },
  'module.roles': {
    title: 'Cargos',
    intro: 'O cargo diz o que cada pessoa pode ver e fazer: quais tabelas, se cria, edita ou exclui, e se vê só os próprios registros ou todos.',
    steps: ['Abra um cargo (ex.: Operador) ou crie um novo.', 'Marque, tabela por tabela, o que esse cargo pode fazer.', 'Salve. Vale na hora para todos com esse cargo.'],
    example: 'Técnico: vê clientes, cria e edita só as próprias OS. Gerente: vê tudo.',
    video: 'modulo-cargos',
  },
  'module.teams': {
    title: 'Equipes',
    intro: 'Grupos de pessoas (ex.: Equipe Norte). Servem para o chat da equipe e para cargos que veem os registros da própria equipe.',
    steps: ['Crie a equipe e adicione as pessoas.', 'Nos cargos, use o escopo "da equipe" quando quiser que vejam o que a equipe fez.'],
  },
  'module.permissions': {
    title: 'Guia de permissões',
    intro: 'Mostra, numa tabela só, o que cada cargo pode fazer em cada parte do sistema. Útil para conferir antes de liberar alguém.',
  },
  'module.publicLinks': {
    title: 'Links públicos',
    intro: 'Formulários que pessoas de fora preenchem sem login: pedido de orçamento, abertura de chamado, cadastro. O que chega vira registro na tabela.',
    steps: ['Crie o link escolhendo a tabela e os campos.', 'Copie o endereço e mande ou coloque no site.'],
  },
  'module.security': {
    title: 'Segurança',
    intro: 'Regras de acesso da empresa: exigir verificação em duas etapas, ver quem está conectado e desconectar aparelhos.',
  },
  'module.audit': {
    title: 'Auditoria',
    intro: 'Histórico de quem fez o quê: criou, alterou ou excluiu registros e configurações. Use para conferir mudanças.',
  },
  'module.executions': {
    title: 'Execuções',
    intro: 'Histórico das automações e webhooks: o que rodou, quando, e se deu certo. Se algo não aconteceu, veja aqui o motivo.',
  },
  'module.organization': {
    title: 'Organização',
    intro: 'Dados e aparência da empresa: nome, logotipo e cor. A cor da marca é usada em todo o sistema.',
  },
  'module.plan': {
    title: 'Plano',
    intro: 'O plano contratado, o que está incluído e quanto já foi usado (usuários, registros, armazenamento).',
  },
  'module.privacy': {
    title: 'Dados e privacidade',
    intro: 'Exportar os dados da empresa, atender pedidos de clientes sobre dados pessoais (LGPD) e encerrar a conta.',
  },

  // ── Telas do dia a dia ───────────────────────────────────────────────
  'screen.home': {
    title: 'Início',
    intro: 'Sua tela de trabalho: o que lançar agora, suas pendências com prazo, os registros que você mexeu por último e as tabelas que você usa.',
    steps: ['Use "Lançar agora" para criar um registro em um clique.', 'Em "Minhas pendências" veja o que está atrasado ou vence hoje.', 'Clique numa tabela para ver todos os registros dela.'],
    video: 'tela-inicio',
  },
  'screen.records': {
    title: 'Registros',
    intro: 'A lista de tudo que foi lançado nesta tabela. Daqui você cria, abre, procura, filtra e exporta.',
    steps: [
      'Clique em "Criar" para lançar um novo.',
      'Clique na primeira coluna (o nome ou número) para abrir e editar.',
      'Clique em outro valor da linha para filtrar a lista por ele; "Limpar" tira os filtros.',
      'Use a busca, "Filtrar", "Colunas" e "Exportar" no alto da lista.',
    ],
    video: 'tela-registros',
  },
  'screen.dashboard': {
    title: 'Painel',
    intro: 'Números e gráficos da operação, atualizados sozinhos. Clique num pedaço de gráfico para filtrar o painel inteiro.',
    steps: ['Use as abas no alto para trocar de visão.', 'Clique numa barra ou fatia para filtrar; clique de novo para tirar.'],
  },
  'screen.trash': {
    title: 'Lixeira',
    intro: 'Os registros excluídos ficam aqui por um tempo. Dá para restaurar se foi engano.',
    steps: ['Encontre o registro e clique em Restaurar.', 'Depois do prazo, ele é apagado de vez.'],
  },
  'screen.settings': {
    title: 'Configurações',
    intro: 'Suas preferências: idioma, tema claro ou escuro, notificações e segurança da sua conta (senha e verificação em duas etapas).',
  },
  'screen.support': {
    title: 'Suporte',
    intro: 'Fale com a equipe do CRM Builder: abra um chamado com a sua dúvida ou problema e acompanhe a resposta por aqui.',
  },
  'screen.profile': {
    title: 'Perfil',
    intro: 'Seus dados: nome, foto e contato. Para trocar a senha, use Configurações › Segurança.',
  },
  'screen.admin': {
    title: 'Administração',
    intro: 'Onde você configura a empresa: equipe e cargos, tabelas, documentos (PDF), painéis, integrações e segurança. A equipe usa o que você monta aqui.',
    steps: ['Comece por Tabelas: o que a empresa vai registrar.', 'Depois Cargos e Usuários: quem vê e faz o quê.', 'Por fim Painéis e Modelos de PDF.'],
  },
};
