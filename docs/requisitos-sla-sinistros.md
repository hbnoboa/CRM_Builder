# Requisitos de SLA para Gestão de Sinistros

## 1. Introdução

Este documento define os requisitos de **Service Level Agreement (SLA)** para gestão de sinistros no sistema CRM Builder, baseado em:
- Regulamentação SUSEP (Superintendência de Seguros Privados)
- Lei 15.040/2024 (Nova Lei de Seguros)
- Circular SUSEP nº 621/2021
- Boas práticas do mercado de seguros

## 2. Definições

### 2.1 SLA (Service Level Agreement)
Acordo de Nível de Serviço que define:
- Serviços prestados
- Prazos de atendimento
- Condições e obrigações
- Métricas de performance
- Penalidades por descumprimento

### 2.2 Gestão de Sinistros
Conjunto de processos e controles para registrar, analisar, regular e concluir um evento coberto por apólice, desde o aviso do sinistro até o pagamento ou negativa.

## 3. Regulamentação SUSEP

### 3.1 Prazos Legais (Lei 15.040/2024)

#### Seguros de Baixa Complexidade (Massificados)
- **Tipos**: Automóvel, vida, seguros até 500 salários mínimos
- **Prazo de regulação e liquidação**: **30 dias corridos**
- **Contagem**: A partir da apresentação do **último documento** solicitado

#### Seguros de Alta Complexidade (Grandes Riscos)
- **Prazo de regulação**: **até 120 dias**
- **Prazo de liquidação**: **até 120 dias**
- **Total**: até 240 dias (regulação + liquidação)

#### Pagamento da Indenização
- **Prazo**: **30 dias** após reconhecimento da cobertura
- **Sanções por atraso**:
  - Multa de 2%
  - Juros de mora
  - Correção monetária

### 3.2 Limitações de Solicitação de Documentos

| Tipo de Seguro | Máximo de Solicitações |
|----------------|------------------------|
| Automóvel | 1 vez |
| Seguros até 500 SM | 1 vez |
| Demais modalidades | 2 vezes |

### 3.3 Prazo de Manifestação
- **Prazo**: 30 dias após aviso do sinistro
- **Suspensão**: Contagem suspensa até entrega de documentos adicionais

## 4. Etapas do Processo de Sinistros

### 4.1 Fluxo Completo

```
1. Notificação do Sinistro (D0)
   ↓
2. Abertura e Enquadramento (D+2)
   ↓
3. Análise Documental (D+5 a D+15)
   ↓
4. Regulação e Avaliação Técnica (D+10 a D+25)
   ↓
5. Decisão e Formalização (D+28)
   ↓
6. Liquidação/Pagamento (D+30 a D+38)
```

### 4.2 Prazos por Etapa

| Etapa | Prazo Ideal | Prazo Máximo | Observações |
|-------|-------------|--------------|-------------|
| Primeiro contacto | 4 horas | 2 dias úteis | SUSEP exige 2 dias úteis |
| Abertura de processo | 24 horas | 48 horas | Registro inicial no sistema |
| Análise documental inicial | 3 dias | 5 dias | Verificação de completude |
| Solicitação de docs adicionais | 5 dias | 7 dias | Máximo de 1-2 solicitações |
| Vistoria/Perícia (se necessária) | 7 dias | 10 dias | Agendamento + execução |
| Análise de cobertura | 5 dias | 7 dias | Verificação de apólice |
| Decisão final | 25 dias | 30 dias | Desde último documento |
| Pagamento | 5 dias | 8 dias úteis | Após decisão favorável |

## 5. Classificação de Prioridade

### 5.1 Níveis de Prioridade

#### 🔴 URGENTE (P1)
- **Definição**: Sinistros com risco de vida, danos graves ou impacto financeiro elevado
- **Exemplos**:
  - Sinistros com vítimas fatais
  - Danos corporais graves
  - Perda total de veículo
  - Incêndios/explosões
  - Valores acima de 100 SM
- **SLA**:
  - Primeiro contato: **2 horas**
  - Abertura: **4 horas**
  - Vistoria: **3 dias**
  - Decisão: **15 dias**
  - Pagamento: **5 dias**

#### 🟠 ALTA (P2)
- **Definição**: Sinistros que afetam significativamente o segurado
- **Exemplos**:
  - Danos corporais leves
  - Colisões com terceiros
  - Roubo/furto
  - Danos materiais substanciais
  - Valores entre 50-100 SM
- **SLA**:
  - Primeiro contato: **4 horas**
  - Abertura: **12 horas**
  - Vistoria: **5 dias**
  - Decisão: **20 dias**
  - Pagamento: **7 dias**

#### 🟡 MÉDIA (P3)
- **Definição**: Sinistros rotineiros sem urgência especial
- **Exemplos**:
  - Pequenas colisões
  - Danos a vidros
  - Avarias leves
  - Valores entre 10-50 SM
- **SLA**:
  - Primeiro contato: **8 horas**
  - Abertura: **24 horas**
  - Vistoria: **7 dias**
  - Decisão: **25 dias**
  - Pagamento: **8 dias**

#### 🟢 BAIXA (P4)
- **Definição**: Sinistros simples e de baixo valor
- **Exemplos**:
  - Quebra de retrovisor
  - Pequenos arranhões
  - Chaveiro
  - Valores até 10 SM
- **SLA**:
  - Primeiro contato: **24 horas**
  - Abertura: **48 horas**
  - Vistoria: **10 dias**
  - Decisão: **30 dias**
  - Pagamento: **8 dias**

### 5.2 Critérios de Priorização Automática

```typescript
interface PriorityCalculation {
  // Fatores de pontuação (0-100)
  severity: number;        // Gravidade (morte=100, material=20)
  value: number;           // Valor (% do limite da apólice)
  complexity: number;      // Complexidade (partes envolvidas, coberturas)
  customerTier: number;    // Nível do cliente (VIP=100, padrão=50)
  legalRisk: number;       // Risco jurídico (processo=100)

  // Fórmula
  // priority = (severity * 0.4) + (value * 0.3) +
  //            (complexity * 0.1) + (customerTier * 0.1) +
  //            (legalRisk * 0.1)

  // Resultado → P1: 80-100 | P2: 60-79 | P3: 40-59 | P4: 0-39
}
```

## 6. Métricas de Desempenho (KPIs)

### 6.1 Métricas Obrigatórias

| Métrica | Fórmula | Meta | Crítico |
|---------|---------|------|---------|
| **Tempo Médio de Regulação** | Média(Data Decisão - Data Abertura) | ≤ 20 dias | ≥ 30 dias |
| **Tempo Médio de Liquidação** | Média(Data Pagamento - Data Decisão) | ≤ 5 dias | ≥ 8 dias |
| **Taxa de Cumprimento de SLA** | (Sinistros no prazo / Total) × 100 | ≥ 95% | < 85% |
| **Taxa de Reabertura** | (Sinistros reabertos / Total) × 100 | ≤ 5% | ≥ 10% |
| **Índice de Retrabalho** | (Docs solicitados novamente / Total) × 100 | ≤ 10% | ≥ 20% |
| **Taxa de Fraude Detectada** | (Fraudes / Total sinistros) × 100 | Monitorar | - |
| **NPS de Sinistros** | Promotores - Detratores | ≥ 50 | < 30 |
| **Primeiro Contato no Prazo** | (Contatos < 2 dias / Total) × 100 | ≥ 98% | < 90% |

### 6.2 Métricas por Prioridade

```
P1 (Urgente):
- 100% com primeiro contato em < 2h
- 95% com decisão em < 15 dias
- 98% com pagamento em < 5 dias

P2 (Alta):
- 98% com primeiro contato em < 4h
- 90% com decisão em < 20 dias
- 95% com pagamento em < 7 dias

P3 (Média):
- 95% com primeiro contato em < 8h
- 85% com decisão em < 25 dias
- 90% com pagamento em < 8 dias

P4 (Baixa):
- 90% com primeiro contato em < 24h
- 80% com decisão em < 30 dias
- 85% com pagamento em < 8 dias
```

## 7. Boas Práticas de Gestão de Tempo

### 7.1 Automação

- **Abertura automática** de processos ao receber notificação
- **Classificação automática** de prioridade baseada em regras
- **Distribuição inteligente** para reguladores baseada em:
  - Carga de trabalho atual
  - Especialização por tipo de sinistro
  - Localização geográfica
- **Alertas automáticos** de prazos próximos ao vencimento
- **Lembretes** para solicitação de documentos pendentes

### 7.2 Comunicação

- **Transparência**: Status visível em tempo real para cliente
- **Proatividade**: Avisos antes de solicitar documentos
- **Multicanal**: Email, SMS, push notification, WhatsApp
- **Templates**: Mensagens padronizadas para cada etapa
- **Histórico completo**: Registro de todas as interações

### 7.3 Documentação

- **Checklist digital**: Documentos necessários por tipo de sinistro
- **Validação automática**: Verificação de completude
- **Upload facilitado**: App mobile, portal web, email
- **OCR**: Extração automática de dados de documentos
- **Armazenamento seguro**: Backup e versionamento

### 7.4 Governança

- **Dashboard de SLA**: Visão em tempo real do cumprimento
- **Relatórios gerenciais**: Diário, semanal, mensal
- **Auditoria**: Rastreabilidade completa de ações
- **Melhoria contínua**: Análise de gargalos e otimizações
- **Treinamento**: Capacitação regular da equipe

## 8. Penalidades e Escalação

### 8.1 Níveis de Alerta

| Situação | Quando | Ação |
|----------|--------|------|
| **Alerta Verde** | 70% do prazo | Notificação ao responsável |
| **Alerta Amarelo** | 85% do prazo | Email ao supervisor |
| **Alerta Laranja** | 95% do prazo | Escalação ao gerente |
| **Alerta Vermelho** | Prazo vencido | Escalação à diretoria + plano de ação |

### 8.2 Escalação Hierárquica

```
Regulador → (24h sem ação) → Supervisor
Supervisor → (48h sem resolução) → Gerente
Gerente → (72h sem resolução) → Diretor
```

### 8.3 Consequências do Descumprimento

**Para a seguradora (regulamentação):**
- Multa de 2% sobre valor do sinistro
- Juros de mora desde a data devida
- Correção monetária
- Processos administrativos SUSEP
- Danos à reputação

**Internas (governança):**
- Registro de não conformidade
- Revisão de processos
- Plano de ação corretiva
- Avaliação de desempenho individual/equipe

## 9. Implementação no Sistema

### 9.1 Campos de SLA na Entidade "Sinistro"

```typescript
interface SinistroSLA {
  // Prioridade
  priorityLevel: 'P1' | 'P2' | 'P3' | 'P4';
  priorityScore: number; // 0-100
  priorityCalculatedAt: Date;
  priorityCalculatedBy: 'AUTO' | 'MANUAL';

  // Prazos
  slaFirstContact: Date;        // D+2h a D+24h
  slaDocumentReview: Date;      // D+3 a D+10
  slaInspection: Date;          // D+3 a D+10
  slaDecision: Date;            // D+15 a D+30
  slaPayment: Date;             // D+20 a D+38

  // Marcos reais
  actualFirstContact?: Date;
  actualDocumentComplete?: Date;
  actualInspectionDone?: Date;
  actualDecisionDate?: Date;
  actualPaymentDate?: Date;

  // Status de SLA
  slaStatus: 'ON_TIME' | 'AT_RISK' | 'OVERDUE';
  slaAlertLevel: 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED';

  // Motivos de atraso
  delayReasons?: Array<{
    reason: string;
    addedBy: string;
    addedAt: Date;
    daysExtended: number;
  }>;

  // Suspensões (aguardando docs)
  slaSuspensions?: Array<{
    suspendedAt: Date;
    resumedAt?: Date;
    reason: string;
    daysOnHold: number;
  }>;
}
```

### 9.2 Dashboard de SLA

**Visão Geral:**
- Total de sinistros por status de SLA
- Taxa de cumprimento geral e por prioridade
- Sinistros em risco (amarelo/laranja)
- Sinistros atrasados (vermelho)
- Tempo médio por etapa

**Filtros:**
- Por prioridade (P1, P2, P3, P4)
- Por produto (auto, vida, residencial)
- Por período (hoje, semana, mês)
- Por responsável
- Por status de SLA

**Alertas:**
- Notificações push para prazos próximos
- Email diário com resumo de SLA
- SMS para sinistros P1 em risco

### 9.3 Automações Sugeridas

```typescript
// 1. Cálculo automático de prioridade
ActionChain: "Auto-classificar prioridade do sinistro"
Trigger: Criação de sinistro
Actions:
  - Calcular priority_score baseado em regras
  - Definir priority_level (P1-P4)
  - Calcular todos os SLA deadlines
  - Atribuir regulador conforme especialização
  - Enviar notificação de abertura ao cliente

// 2. Alerta de prazo próximo
ActionChain: "Alertar prazo em risco"
Trigger: Agenda diária (executa 4x/dia)
Actions:
  - Buscar sinistros com sla_status = 'AT_RISK'
  - Enviar email ao responsável
  - Se P1/P2 → enviar SMS também
  - Registrar alerta no histórico

// 3. Escalação automática
ActionChain: "Escalar sinistro atrasado"
Trigger: Agenda diária (executa 2x/dia)
Actions:
  - Buscar sinistros com sla_status = 'OVERDUE'
  - Se < 24h de atraso → notificar supervisor
  - Se 24-48h → escalar para gerente
  - Se > 48h → escalar para diretor
  - Adicionar comentário automático

// 4. Suspensão por documentos pendentes
ActionChain: "Suspender SLA por docs"
Trigger: Mudança de status para "Aguardando Documentos"
Actions:
  - Criar registro em sla_suspensions
  - Pausar contagem de prazos
  - Notificar cliente sobre docs pendentes
  - Agendar lembrete em 7 dias

// 5. Retomada após docs recebidos
ActionChain: "Retomar SLA"
Trigger: Status muda para "Em Análise" (docs recebidos)
Actions:
  - Fechar suspensão atual (resumedAt)
  - Recalcular prazos somando dias suspensos
  - Notificar regulador
  - Atualizar sla_status
```

### 9.4 Relatórios Gerenciais

**Relatório Diário:**
- Sinistros abertos hoje
- Sinistros decididos hoje
- Sinistros pagos hoje
- Taxa de cumprimento do dia
- Sinistros em risco
- Sinistros atrasados

**Relatório Semanal:**
- Performance por regulador
- Taxa de cumprimento por prioridade
- Tempo médio por etapa
- Principais causas de atraso
- Análise de retrabalho

**Relatório Mensal:**
- KPIs completos
- Comparativo com mês anterior
- Tendências e sazonalidades
- NPS de sinistros
- Recomendações de melhoria

## 10. Conformidade e Auditoria

### 10.1 Evidências Obrigatórias

Para cada sinistro, manter registrado:
- ✅ Data/hora de todas as comunicações
- ✅ Data de solicitação de cada documento
- ✅ Data de recebimento de cada documento
- ✅ Motivos de suspensão de prazos
- ✅ Justificativas de extensão de prazos
- ✅ Todas as decisões e seus responsáveis
- ✅ Comprovantes de pagamento

### 10.2 Checklist de Conformidade SUSEP

- [ ] Primeiro contato em até 2 dias úteis
- [ ] Máximo de solicitações de docs respeitado
- [ ] Decisão em até 30 dias (baixa complexidade) ou 120 dias (alta)
- [ ] Pagamento em até 30 dias após decisão favorável
- [ ] Multa/juros calculados automaticamente em atrasos
- [ ] Histórico completo de tratativas
- [ ] Motivos de negativa formalizados
- [ ] Documentação arquivada por período legal

## 11. Referências

### Legislação
- [Lei 15.040/2024 - Nova Lei de Seguros](https://www.gov.br/susep/pt-br/central-de-conteudos/noticias/2025/dezembro/lei-do-contrato-de-seguro-entra-em-vigor-trazendo-mais-clareza-e-seguranca-juridica-ao-mercado)
- [Circular SUSEP nº 621/2021](https://www.passosgarcia.adv.br/blog/circular621-susep)
- [Plano de Regulação SUSEP 2026](https://www.gov.br/susep/pt-br/central-de-conteudos/noticias/2025/dezembro/susep-aprova-plano-de-regulacao-para-2026)

### Artigos e Guias
- [SLA em Corretoras de Seguros - Agger](https://blog.agger.com.br/sua-corretoras-de-seguros-ja-tem-sla/)
- [Regulação de Sinistros sob Lei 15.040/24 - Revista Cobertura](https://revistacobertura.com.br/noticias/artigos/regulacao-de-sinistros-sob-a-nova-lei-15-040-24/)
- [Prazo de Regulação: O que diz a legislação - Akad Seguros](https://akadseguros.com.br/blog/gestao/prazo-de-regulacao-de-sinistro-o-que-diz-a-legislacao/)
- [Gestão de Sinistros: Boas Práticas - Alper Seguros](https://www.alperseguros.com.br/blog/seguros/gestao-de-sinistro/)
- [4 Boas Práticas para Gestão de Sinistros - CQCS](https://cqcs.com.br/noticia/gestao-de-sinistros-4-boas-praticas-para-o-corretor-de-seguros/)
- [Controle de Sinistro: Gestão Eficiente - Agger](https://www.agger.com.br/blog/controle-de-sinistro-gestao-eficiente/)
- [SLA em Contratos: Como Definir e Medir - Contraktor](https://conteudo.contraktor.com.br/gestao-de-contratos/sla-contrato/)

---

**Versão:** 1.0
**Data:** 2026-04-06
**Última atualização:** 2026-04-06
**Responsável:** Documentação CRM Builder
