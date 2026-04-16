# Tipos de Campos para Sistemas de Sinistros de Transporte

## Resumo Executivo

Este documento analisa os tipos de campos essenciais para um sistema de sinistros de transporte de cargas, baseado em:
- Normas SUSEP (Superintendência de Seguros Privados) 2026
- Boas práticas de sistemas de seguros de carga no Brasil
- Documentação obrigatória para sinistros
- Campos já implementados no CRM Builder

## 1. Campos Atualmente Implementados no CRM Builder

O CRM Builder já possui **47 tipos de campos** implementados em `/home/hbnoboa11/crm-builder/packages/shared/src/enums.ts`:

### 1.1 Campos de Texto
- **text** - Texto simples (nomes, títulos, observações curtas)
- **textarea** - Área de texto (descrições, relatos)
- **richtext** - Texto rico formatado (relatórios detalhados)
- **email** - E-mail com validação
- **url** - URLs (links de documentos externos)
- **password** - Senha (acesso restrito)
- **hidden** - Campo oculto (metadados)

### 1.2 Campos Numéricos
- **number** - Números inteiros ou decimais
- **currency** - Valores monetários (indenização, prejuízo, franquia)
- **percentage** - Percentuais (% de avaria, depreciação)
- **slider** - Seleção numérica visual
- **rating** - Avaliação (satisfação, gravidade)

### 1.3 Campos de Documentos Brasileiros
- **cpf** - CPF com validação e máscara
- **cnpj** - CNPJ com validação e máscara
- **phone** - Telefone brasileiro (fixo e celular)
- **cep** - CEP com busca automática de endereço

### 1.4 Campos de Data/Hora
- **date** - Data (ocorrência do sinistro, vistoria)
- **datetime** - Data e hora (timestamp completo)
- **time** - Hora (horário do sinistro)
- **timer** - Temporizador (SLA, prazo de resposta)

### 1.5 Campos de Seleção
- **boolean** - Sim/Não (houve vítimas?, carga recuperada?)
- **select** - Seleção única (tipo de sinistro, status)
- **multiselect** - Seleção múltipla (causas do sinistro)
- **checkbox-group** - Grupo de checkboxes (documentos recebidos)
- **radio-group** - Grupo de radio buttons (opções exclusivas)
- **tags** - Tags customizáveis (palavras-chave)
- **color** - Seletor de cor (categorização visual)

### 1.6 Campos de Relação
- **relation** - Relação com outra entidade (apólice, segurado)
- **sub-entity** - Sub-entidade (itens da carga, documentos)
- **api-select** - Busca via API externa (transportadoras)
- **user-select** - Seleção de usuário (responsável, perito)
- **lookup** - Lookup de dados relacionados

### 1.7 Campos de Arquivos
- **file** - Upload de arquivos (PDF, documentos)
- **image** - Upload de imagens (fotos do sinistro)
- **signature** - Assinatura digital (termos, laudos)

### 1.8 Campos de Workflow
- **workflow-status** - Status do workflow (Em análise, Aprovado, Negado)
- **sla-status** - Status de SLA (dentro do prazo, atrasado)
- **action-button** - Botão de ação (enviar para vistoria, solicitar documentos)

### 1.9 Campos Computados
- **formula** - Fórmula calculada (valor líquido da indenização)
- **rollup** - Agregação de sub-entidades (total de itens da carga)

### 1.10 Campos Especiais
- **map** - Mapa (localização do sinistro)
- **zone-diagram** - Diagrama de zonas (áreas de avaria em veículo/carga)
- **json** - JSON estruturado (dados técnicos complexos)
- **array** - Lista dinâmica (testemunhas, envolvidos)
- **section-title** - Título de seção (organização do formulário)

## 2. Campos Essenciais para Sinistros de Transporte

### 2.1 Identificação do Sinistro
```typescript
{
  numeroSinistro: 'text',              // Número único do sinistro
  numeroApolice: 'text',               // Número da apólice
  dataHoraOcorrencia: 'datetime',      // Data/hora do sinistro (OBRIGATÓRIO)
  dataComunicacao: 'date',             // Data de comunicação à seguradora
  statusSinistro: 'workflow-status',   // Aberto, Em análise, Vistoria, Aprovado, Negado, Encerrado
  prioridade: 'select',                // Baixa, Média, Alta, Urgente
  tipoSinistro: 'select'               // Acidente, Roubo, Furto, Avaria, Desaparecimento
}
```

### 2.2 Dados do Segurado
```typescript
{
  seguradoNome: 'text',
  seguradoTipo: 'select',              // Pessoa Física, Pessoa Jurídica
  seguradoCPF: 'cpf',
  seguradoCNPJ: 'cnpj',
  seguradoEmail: 'email',
  seguradoTelefone: 'phone',
  seguradoEndereco: 'textarea',
  seguradoCEP: 'cep'
}
```

### 2.3 Dados da Transportadora
```typescript
{
  transportadoraNome: 'text',
  transportadoraCNPJ: 'cnpj',
  transportadoraTelefone: 'phone',
  transportadoraEmail: 'email',
  tipoTransporte: 'select',            // Rodoviário, Ferroviário, Aéreo, Marítimo
  tipoSeguro: 'select'                 // RCTR-C, RC-DC, RCF-DC, RCV
}
```

### 2.4 Dados do Veículo
```typescript
{
  veiculoPlaca: 'text',
  veiculoTipo: 'select',               // Caminhão, Carreta, Bitrem, Van
  veiculoMarca: 'text',
  veiculoModelo: 'text',
  motoristaNome: 'text',
  motoristaCPF: 'cpf',
  motoristaCNH: 'text'
}
```

### 2.5 Dados da Carga
```typescript
{
  descricaoCarga: 'richtext',          // Descrição detalhada da carga
  valorCarga: 'currency',              // Valor total da carga (OBRIGATÓRIO)
  pesoCarga: 'number',                 // Peso em KG
  itensCarga: 'sub-entity',            // Lista de itens (descrição, quantidade, valor)
  naturezaCarga: 'select',             // Perecível, Frágil, Perigosa, Normal
  numeroNF: 'text',                    // Número da Nota Fiscal (OBRIGATÓRIO)
  dataEmissaoNF: 'date',
  arquivoNF: 'file'                    // Upload da NF (OBRIGATÓRIO)
}
```

### 2.6 Dados da Viagem
```typescript
{
  origem: 'text',                      // Cidade/Estado de origem (OBRIGATÓRIO)
  origemCEP: 'cep',
  origemMapa: 'map',
  destino: 'text',                     // Cidade/Estado de destino (OBRIGATÓRIO)
  destinoCEP: 'cep',
  destinoMapa: 'map',
  localSinistro: 'text',               // Local exato do sinistro (OBRIGATÓRIO)
  localSinistroCEP: 'cep',
  localSinistroMapa: 'map',
  numeroCTe: 'text',                   // Conhecimento de Transporte Eletrônico
  arquivoCTe: 'file'
}
```

### 2.7 Descrição do Sinistro
```typescript
{
  tipoOcorrencia: 'select',            // Colisão, Capotamento, Tombamento, Incêndio, Roubo, Furto
  causaSinistro: 'multiselect',        // Múltiplas causas possíveis
  descricaoDetalhada: 'richtext',      // Relato detalhado (OBRIGATÓRIO)
  houveFeridos: 'boolean',
  houveVitimas: 'boolean',
  houveBoletimOcorrencia: 'boolean',
  numeroBO: 'text',
  arquivoBO: 'file',
  testemunhas: 'array',                // Lista de testemunhas (nome, telefone)
  fotosLocal: 'image',                 // Fotos do local (múltiplas)
  fotosCarga: 'image',                 // Fotos da carga avariada (múltiplas)
  fotosVeiculo: 'image',               // Fotos do veículo (múltiplas)
  diagramaAvarias: 'zone-diagram'      // Diagrama visual das avarias
}
```

### 2.8 Avaliação de Danos
```typescript
{
  percentualAvaria: 'percentage',      // % de avaria da carga
  valorPrejuizo: 'currency',           // Valor estimado do prejuízo (OBRIGATÓRIO)
  valorFranquia: 'currency',           // Valor da franquia
  valorIndenizacao: 'currency',        // Valor calculado (formula)
  cargaRecuperavel: 'boolean',
  cargaRecuperada: 'boolean',
  valorRecuperado: 'currency',
  localArmazenamento: 'text',          // Onde a carga está armazenada
  laudoPericial: 'file',
  dataVistoria: 'datetime',
  perito: 'user-select',               // Perito responsável
  statusVistoria: 'select'             // Agendada, Realizada, Pendente
}
```

### 2.9 Documentação
```typescript
{
  documentosRecebidos: 'checkbox-group', // Lista de documentos obrigatórios
  // - Nota Fiscal
  // - CT-e (Conhecimento de Transporte)
  // - Boletim de Ocorrência
  // - Laudo Pericial
  // - Fotos do sinistro
  // - Declaração do motorista
  // - Comprovante de entrega (se aplicável)
  documentosAdicionais: 'file',        // Outros documentos (múltiplos)
  observacoesDocumentos: 'textarea'
}
```

### 2.10 Workflow e SLA
```typescript
{
  status: 'workflow-status',           // Status do processo
  responsavel: 'user-select',          // Responsável atual
  dataPrazo: 'date',                   // Prazo regulatório (SUSEP)
  slaStatus: 'sla-status',             // Status do SLA
  tempoDecorrido: 'timer',             // Timer desde abertura
  historicoStatus: 'sub-entity',       // Histórico de mudanças de status
  acoes: 'action-button'               // Botões de ação (Aprovar, Negar, Solicitar docs)
}
```

### 2.11 Dados Bancários para Pagamento
```typescript
{
  bancoNome: 'text',
  bancoNumero: 'text',
  agencia: 'text',
  conta: 'text',
  tipoConta: 'select',                 // Corrente, Poupança
  favorecidoNome: 'text',
  favorecidoCPF: 'cpf',
  favorecidoCNPJ: 'cnpj',
  chavePix: 'text',
  tipoChavePix: 'select'               // CPF, CNPJ, Email, Telefone, Aleatória
}
```

### 2.12 Integração com Terceiros
```typescript
{
  proteseRegulador: 'text',            // Protocolo regulador SUSEP
  numeroProcessoJudicial: 'text',      // Se houver processo
  advogadoResponsavel: 'text',
  statusJudicial: 'select',
  integracao: 'api-select'             // Integração com sistemas externos
}
```

## 3. Campos Recomendados Adicionais (Não Implementados)

### 3.1 Placa de Veículo (com validação Mercosul)
```typescript
{
  type: 'plate',
  validation: {
    format: 'mercosul', // ABC1D23 ou ABC-1234
    country: 'BR'
  }
}
```

### 3.2 Renavam
```typescript
{
  type: 'renavam',
  validation: {
    length: 11,
    checkDigit: true
  }
}
```

### 3.3 PIS/PASEP
```typescript
{
  type: 'pis',
  validation: true
}
```

### 3.4 Código de Rastreio
```typescript
{
  type: 'tracking-code',
  providers: ['Onixsat', 'Sascar', 'Autotrac']
}
```

### 3.5 Coordenadas GPS
```typescript
{
  type: 'gps-coordinates',
  format: 'decimal', // -23.550520, -46.633308
  validation: {
    latitude: { min: -90, max: 90 },
    longitude: { min: -180, max: 180 }
  }
}
```

## 4. Validações Brasileiras Essenciais

### 4.1 CPF
- Formato: 000.000.000-00
- Validação: algoritmo de dígito verificador
- Máscara obrigatória para exibição

### 4.2 CNPJ
- Formato: 00.000.000/0000-00
- Validação: algoritmo de dígito verificador
- Máscara obrigatória para exibição

### 4.3 CEP
- Formato: 00000-000
- Integração com ViaCEP para busca automática de endereço
- Preenchimento automático de: logradouro, bairro, cidade, estado

### 4.4 Telefone
- Formato celular: (00) 9 0000-0000
- Formato fixo: (00) 0000-0000
- Validação de DDD válido

### 4.5 Currency (Moeda Brasileira)
- Formato: R$ 0.000.000,00
- Separador de milhar: ponto (.)
- Separador decimal: vírgula (,)
- Prefixo: R$

## 5. Campos Obrigatórios pela SUSEP (2026)

Segundo a **Resolução CNSP nº 488/2026** e normas vigentes, são obrigatórios:

1. **Data e hora da ocorrência**
2. **Local exato do sinistro** (endereço completo)
3. **Descrição detalhada do ocorrido**
4. **Valor da carga transportada**
5. **Nota Fiscal** (número e arquivo)
6. **Conhecimento de Transporte (CT-e)**
7. **Boletim de Ocorrência** (se aplicável)
8. **Fotos do sinistro** (local, carga, veículo)
9. **Dados do segurado** (nome, CPF/CNPJ, contato)
10. **Dados da transportadora** (CNPJ, RNTRC)
11. **Origem e destino** da carga
12. **Valor estimado do prejuízo**

## 6. Estrutura Sugerida de Entidades

### 6.1 Entidade Principal: Sinistro
Contém todos os campos principais listados acima.

### 6.2 Sub-entidades Relacionadas:

#### Itens da Carga (sub-entity)
```typescript
{
  descricaoItem: 'text',
  quantidadeItem: 'number',
  valorUnitarioItem: 'currency',
  valorTotalItem: 'currency', // formula: quantidade * valorUnitario
  ncmItem: 'text',
  avariado: 'boolean',
  percentualAvaria: 'percentage',
  valorPrejuizoItem: 'currency'
}
```

#### Documentos (sub-entity)
```typescript
{
  tipoDocumento: 'select',
  numeroDocumento: 'text',
  dataEmissao: 'date',
  arquivo: 'file',
  status: 'select' // Pendente, Recebido, Aprovado, Rejeitado
}
```

#### Histórico de Status (sub-entity)
```typescript
{
  statusAnterior: 'text',
  statusNovo: 'text',
  dataHoraMudanca: 'datetime',
  usuarioResponsavel: 'user-select',
  observacao: 'textarea'
}
```

#### Comunicações (sub-entity)
```typescript
{
  tipo: 'select', // Email, Telefone, WhatsApp, Presencial
  data: 'datetime',
  assunto: 'text',
  descricao: 'richtext',
  usuario: 'user-select',
  anexos: 'file'
}
```

## 7. Fórmulas Calculadas Importantes

### 7.1 Valor Líquido de Indenização
```javascript
formula: "valorPrejuizo - valorFranquia - valorRecuperado"
```

### 7.2 Total de Itens da Carga
```javascript
rollup: {
  subEntity: "itensCarga",
  operation: "sum",
  field: "valorTotalItem"
}
```

### 7.3 Prazo Regulatório (30 dias corridos)
```javascript
formula: "dataComunicacao + 30 dias"
```

### 7.4 Dias até o Prazo
```javascript
formula: "dataPrazo - dataAtual"
```

## 8. Configurações de Workflow

### 8.1 Status do Sinistro
```typescript
workflow: {
  states: [
    { id: 'aberto', label: 'Aberto', color: '#3B82F6' },
    { id: 'em_analise', label: 'Em Análise', color: '#F59E0B' },
    { id: 'aguardando_docs', label: 'Aguardando Documentos', color: '#EF4444' },
    { id: 'vistoria_agendada', label: 'Vistoria Agendada', color: '#8B5CF6' },
    { id: 'em_vistoria', label: 'Em Vistoria', color: '#06B6D4' },
    { id: 'analise_pericial', label: 'Análise Pericial', color: '#F97316' },
    { id: 'aprovado', label: 'Aprovado', color: '#10B981' },
    { id: 'negado', label: 'Negado', color: '#EF4444' },
    { id: 'pagamento_pendente', label: 'Pagamento Pendente', color: '#FBBF24' },
    { id: 'encerrado', label: 'Encerrado', color: '#6B7280' }
  ],
  transitions: [
    { from: 'aberto', to: ['em_analise', 'aguardando_docs'] },
    { from: 'em_analise', to: ['vistoria_agendada', 'aprovado', 'negado', 'aguardando_docs'] },
    { from: 'aguardando_docs', to: ['em_analise'] },
    { from: 'vistoria_agendada', to: ['em_vistoria'] },
    { from: 'em_vistoria', to: ['analise_pericial'] },
    { from: 'analise_pericial', to: ['aprovado', 'negado', 'aguardando_docs'] },
    { from: 'aprovado', to: ['pagamento_pendente'] },
    { from: 'pagamento_pendente', to: ['encerrado'] },
    { from: 'negado', to: ['encerrado'] }
  ]
}
```

### 8.2 SLA por Status
```typescript
sla: {
  'aberto': { prazo: 2, unidade: 'horas' },
  'em_analise': { prazo: 48, unidade: 'horas' },
  'aguardando_docs': { prazo: 120, unidade: 'horas' },
  'vistoria_agendada': { prazo: 72, unidade: 'horas' },
  'aprovado': { prazo: 30, unidade: 'dias' }
}
```

## 9. Integrações Recomendadas

### 9.1 ViaCEP
- Auto-preenchimento de endereço via CEP

### 9.2 ReceitaWS / BrasilAPI
- Validação e consulta de CNPJ

### 9.3 Google Maps / OpenStreetMap
- Visualização de rotas e locais

### 9.4 Sistemas de Rastreamento
- Onixsat, Sascar, Autotrac (último ponto conhecido)

### 9.5 SUSEP
- Consulta de apólices e registro de sinistros

## 10. Considerações de Segurança

1. **Dados Sensíveis**: CPF, CNPJ, dados bancários devem ser criptografados em repouso
2. **LGPD**: Consentimento para tratamento de dados pessoais
3. **Auditoria**: Log de todas as alterações em campos sensíveis
4. **Anexos**: Validação de tipo e tamanho de arquivo
5. **Assinatura Digital**: Certificado digital ICP-Brasil quando necessário

## 11. Resumo de Prioridade

### Prioridade ALTA (Obrigatórios SUSEP)
- ✅ date, datetime (data/hora ocorrência)
- ✅ text, richtext (descrição detalhada)
- ✅ currency (valores)
- ✅ file, image (documentos, fotos)
- ✅ cpf, cnpj (identificação)
- ✅ cep, map (localização)

### Prioridade MÉDIA (Operacionais)
- ✅ workflow-status (controle de processo)
- ✅ sla-status (prazos regulatórios)
- ✅ user-select (responsáveis)
- ✅ sub-entity (itens da carga, documentos)
- ✅ phone, email (contato)

### Prioridade BAIXA (Complementares)
- ✅ zone-diagram (diagrama de avarias)
- ✅ signature (assinatura digital)
- ✅ timer (temporizador)
- ✅ formula, rollup (cálculos)

## 12. Fontes e Referências

- [SUSEP - Resolução CNSP nº 488/2026 sobre RC-V](https://www.gov.br/susep/pt-br/central-de-conteudos/noticias/2026/marco/cnsp-altera-norma-sobre-seguro-obrigatorio-de-responsabilidade-civil-para-transporte-rodoviario-de-cargas)
- [Documentos exigidos em sinistros de carga](https://blog.credriskmarine.com/6-tipos-de-documentos-exigidos-em-sinistros)
- [Guia de sinistro de carga](https://www.mutuus.net/blog/sinistro-de-carga/)
- [Lei 14.599/2023 sobre seguros de transporte](https://www.thomsonreuters.com.br/pt/juridico/blog/nova-lei-seguros-de-cargas.html)
- [Freight Claims Process Guide](https://www.gofclogistics.com/a-complete-guide-to-freight-claims/)
- [FMCSA Insurance Filing Requirements](https://www.fmcsa.dot.gov/registration/insurance-filing-requirements)

## 13. Conclusão

O CRM Builder já possui **todos os tipos de campos essenciais** para implementar um sistema completo de sinistros de transporte conforme normas SUSEP 2026. Os 47 tipos de campos implementados cobrem:

✅ **100% dos campos obrigatórios** pela SUSEP
✅ **100% das validações brasileiras** (CPF, CNPJ, CEP, telefone, moeda)
✅ **Workflow completo** com status e SLA
✅ **Upload de documentos** múltiplos
✅ **Geolocalização** e mapas
✅ **Cálculos automáticos** com fórmulas
✅ **Sub-entidades** para itens e documentos
✅ **Assinatura digital**

**Campos adicionais recomendados** (não essenciais, mas úteis):
- Placa Mercosul com validação
- Renavam com validação
- PIS/PASEP
- Código de rastreamento
- Coordenadas GPS estruturadas

O sistema está **pronto para implementação** de um CRM completo de sinistros de transporte sem necessidade de novos tipos de campos.
