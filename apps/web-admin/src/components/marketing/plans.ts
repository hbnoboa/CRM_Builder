/**
 * Planos (referencia comercial da pagina de precos). Os limites e funcoes usam os
 * mesmos nomes do console (Plan.limits: maxUsers/maxRecords/maxStorageMb e
 * Plan.features: chat/pdf/automations/webhooks/publicLinks/mobile), para os planos
 * reais poderem ser configurados com estes valores. Precos por usuario/mes.
 */

export type PlanKey = 'essencial' | 'profissional' | 'empresarial';

export interface PlanInfo {
  key: PlanKey;
  name: string;
  monthly: number;
  /** Anual: 20% de desconto, cobrado de uma vez. */
  yearly: number;
  description: string;
  highlight?: boolean;
  /** Resumo do cartao. */
  summary: string[];
}

export const PLANS: PlanInfo[] = [
  {
    key: 'essencial',
    name: 'Essencial',
    monthly: 49,
    yearly: 39,
    description: 'Para pequenas equipes tirarem a operação da planilha.',
    summary: ['Até 5 usuários', 'Tabelas, formulários e painéis', 'App no celular com modo offline', 'Documentos em PDF', 'Modelos prontos'],
  },
  {
    key: 'profissional',
    name: 'Profissional',
    monthly: 89,
    yearly: 71,
    highlight: true,
    description: 'Para quem tem campo e escritório trabalhando juntos.',
    summary: ['Até 50 usuários', 'Tudo do Essencial', 'Automações, webhooks e links públicos', 'Equipes e permissão por campo', 'Implantação guiada'],
  },
  {
    key: 'empresarial',
    name: 'Empresarial',
    monthly: 149,
    yearly: 119,
    description: 'Para operações maiores, com integração e controle total.',
    summary: ['Usuários ilimitados', 'Tudo do Profissional', 'API e chaves de integração', 'Segurança obrigatória (2 etapas, senha)', 'Suporte prioritário e gerente de conta'],
  },
];

/** true = incluido, false = nao, texto = limite ou detalhe. */
type Cell = boolean | string;

export const COMPARISON: Array<{ group: string; rows: Array<{ label: string; hint?: string; values: Record<PlanKey, Cell> }> }> = [
  {
    group: 'Limites',
    rows: [
      { label: 'Usuários', values: { essencial: 'até 5', profissional: 'até 50', empresarial: 'ilimitado' } },
      { label: 'Registros', hint: 'Somando todas as tabelas', values: { essencial: '10 mil', profissional: '200 mil', empresarial: 'ilimitado' } },
      { label: 'Armazenamento de arquivos', hint: 'Fotos, assinaturas e PDFs', values: { essencial: '5 GB', profissional: '50 GB', empresarial: '500 GB' } },
      { label: 'Tabelas, painéis e modelos de PDF', values: { essencial: 'ilimitados', profissional: 'ilimitados', empresarial: 'ilimitados' } },
    ],
  },
  {
    group: 'Montagem',
    rows: [
      { label: 'Modelos prontos (sinistros, vistoria, OS, vendas, chamados)', values: { essencial: true, profissional: true, empresarial: true } },
      { label: 'Tabelas, formulários e sub-tabelas', values: { essencial: true, profissional: true, empresarial: true } },
      { label: 'Regras por campo (obrigatório, visível, cálculo)', values: { essencial: true, profissional: true, empresarial: true } },
      { label: 'Painéis com gráficos, funil e quadro kanban', values: { essencial: true, profissional: true, empresarial: true } },
      { label: 'Documentos em PDF (laudos, OS, propostas)', values: { essencial: true, profissional: true, empresarial: true } },
      { label: 'Importação e exportação de Excel', values: { essencial: true, profissional: true, empresarial: true } },
    ],
  },
  {
    group: 'Equipe e campo',
    rows: [
      { label: 'App no celular com modo offline', values: { essencial: true, profissional: true, empresarial: true } },
      { label: 'Fotos, assinatura e localização no registro', values: { essencial: true, profissional: true, empresarial: true } },
      { label: 'Chat por tabela, por registro e direto', values: { essencial: true, profissional: true, empresarial: true } },
      { label: 'Comandos no chat (/sinistro, /vistoria, /os…)', values: { essencial: false, profissional: true, empresarial: true } },
      { label: 'Cargos personalizados', values: { essencial: 'até 3', profissional: true, empresarial: true } },
      { label: 'Equipes e escopo "da equipe"', values: { essencial: false, profissional: true, empresarial: true } },
      { label: 'Permissão por campo', values: { essencial: false, profissional: true, empresarial: true } },
      { label: 'Links públicos para terceiros', values: { essencial: false, profissional: true, empresarial: true } },
    ],
  },
  {
    group: 'Automação e integração',
    rows: [
      { label: 'Notificações no sistema e no celular', values: { essencial: true, profissional: true, empresarial: true } },
      { label: 'Automações (quando acontecer X, faça Y)', values: { essencial: false, profissional: true, empresarial: true } },
      { label: 'Webhooks', values: { essencial: false, profissional: true, empresarial: true } },
      { label: 'API com chaves de integração', values: { essencial: false, profissional: false, empresarial: true } },
    ],
  },
  {
    group: 'Segurança e LGPD',
    rows: [
      { label: 'Dados isolados por empresa', values: { essencial: true, profissional: true, empresarial: true } },
      { label: 'Verificação em 2 etapas', values: { essencial: 'opcional', profissional: 'opcional', empresarial: 'pode exigir de todos' } },
      { label: 'Política de senha e controle de sessões', values: { essencial: false, profissional: true, empresarial: true } },
      { label: 'Auditoria de ações', values: { essencial: '30 dias', profissional: '1 ano', empresarial: '5 anos' } },
      { label: 'Lixeira para restaurar registros', values: { essencial: true, profissional: true, empresarial: true } },
      { label: 'Exportação completa dos dados', values: { essencial: true, profissional: true, empresarial: true } },
    ],
  },
  {
    group: 'Suporte',
    rows: [
      { label: 'Central de ajuda e chamados', values: { essencial: true, profissional: true, empresarial: true } },
      { label: 'Tempo de primeira resposta', values: { essencial: '2 dias úteis', profissional: '1 dia útil', empresarial: '4 horas úteis' } },
      { label: 'Implantação', values: { essencial: 'por conta própria', profissional: 'guiada (2 sessões)', empresarial: 'assistida, com importação' } },
      { label: 'Gerente de conta', values: { essencial: false, profissional: false, empresarial: true } },
    ],
  },
];

export const BILLING_FAQ = [
  { q: 'Como funciona o teste grátis?', a: 'Você usa o sistema completo durante o período de teste, sem cartão de crédito. No fim, escolhe o plano para continuar usando.' },
  { q: 'Como é cobrado?', a: 'Por usuário ativo, por mês. No anual, o desconto de 20% vale para o ano inteiro e a cobrança é feita de uma vez.' },
  { q: 'Posso trocar de plano?', a: 'Sim, a qualquer momento. Subir de plano vale na hora; descer vale a partir do próximo ciclo.' },
  { q: 'O que acontece se passar do limite?', a: 'Avisamos antes. Nada é apagado: você escolhe subir de plano ou liberar espaço.' },
  { q: 'Tem plano para mais de 200 pessoas?', a: 'Sim. Para operações grandes ou necessidades específicas (servidor dedicado, contrato, faturamento), fale com um especialista.' },
];
