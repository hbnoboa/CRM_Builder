// ============================================================
// iOS Risk — Mockup JavaScript
// Dados mock + rendering + interatividade
// ============================================================

// ---------- MOCK DATA ----------

const CORRETORES = [
  { id: 'cor1', nome: 'Corretor 1', iniciais: 'C1', email: 'corretor1@iosrisk.com', telefone: '(49) 99901-1001', color: 1 },
  { id: 'cor2', nome: 'Corretor 2', iniciais: 'C2', email: 'corretor2@iosrisk.com', telefone: '(49) 99902-2002', color: 2 },
  { id: 'cor3', nome: 'Corretor 3', iniciais: 'C3', email: 'corretor3@iosrisk.com', telefone: '(49) 99903-3003', color: 3 },
  { id: 'ges1', nome: 'Gestor', iniciais: 'GS', email: 'gestor@iosrisk.com', telefone: '(49) 99904-4004', color: 4 },
];

const SEGURADORAS = [
  { id: 'seg1', razaoSocial: 'Seguradora Alpha', cnpj: '01.234.567/0001-01', email: 'alpha@seg.com' },
  { id: 'seg2', razaoSocial: 'Seguradora Beta', cnpj: '02.345.678/0001-02', email: 'beta@seg.com' },
  { id: 'seg3', razaoSocial: 'Seguradora Gamma', cnpj: '03.456.789/0001-03', email: 'gamma@seg.com' },
  { id: 'seg4', razaoSocial: 'Seguradora Delta', cnpj: '04.567.890/0001-04', email: 'delta@seg.com' },
];

const SEGURADOS = [
  { id: 'sgu1', nome: 'Segurado 1', cnpj: '10.111.222/0001-10', cidade: 'Concordia', estado: 'SC' },
  { id: 'sgu2', nome: 'Segurado 2', cnpj: '20.222.333/0001-20', cidade: 'Chapeco', estado: 'SC' },
  { id: 'sgu3', nome: 'Segurado 3', cnpj: '30.333.444/0001-30', cidade: 'Curitiba', estado: 'PR' },
  { id: 'sgu4', nome: 'Segurado 4', cnpj: '40.444.555/0001-40', cidade: 'Florianopolis', estado: 'SC' },
  { id: 'sgu5', nome: 'Segurado 5', cnpj: '50.555.666/0001-50', cidade: 'Porto Alegre', estado: 'RS' },
  { id: 'sgu6', nome: 'Segurado 6', cnpj: '60.666.777/0001-60', cidade: 'Joinville', estado: 'SC' },
];

const REGULADORAS = [
  { id: 'reg1', razaoSocial: 'Reguladora 1', cnpj: '11.111.111/0001-11' },
  { id: 'reg2', razaoSocial: 'Reguladora 2', cnpj: '22.222.222/0001-22' },
  { id: 'reg3', razaoSocial: 'Reguladora 3', cnpj: '33.333.333/0001-33' },
];

const GERENCIADORAS = [
  { id: 'ger1', razaoSocial: 'Gerenciadora 1', cnpj: '44.444.444/0001-44' },
  { id: 'ger2', razaoSocial: 'Gerenciadora 2', cnpj: '55.555.555/0001-55' },
  { id: 'ger3', razaoSocial: 'Gerenciadora 3', cnpj: '66.666.666/0001-66' },
];

const TRANSPORTADORAS = [
  { id: 'trp1', razaoSocial: 'Transportadora 1', cnpj: '77.777.777/0001-77', rntrc: 'RNTRC-001' },
  { id: 'trp2', razaoSocial: 'Transportadora 2', cnpj: '88.888.888/0001-88', rntrc: 'RNTRC-002' },
  { id: 'trp3', razaoSocial: 'Transportadora 3', cnpj: '99.999.999/0001-99', rntrc: 'RNTRC-003' },
  { id: 'trp4', razaoSocial: 'Transportadora 4', cnpj: '10.101.010/0001-10', rntrc: 'RNTRC-004' },
];

const CAUSAS = ['ACIDENTE', 'AVARIA', 'ROUBO'];
const CLASSIFICACOES = ['COLISAO', 'TOMBAMENTO', 'FURTO', 'INCENDIO', 'AVARIA', 'ROUBO', 'EXTRAVIO', 'QUEBRA', 'MOLHADURA', 'VAZAMENTO'];
const MERCADORIAS = ['Alimentos', 'Eletronicos', 'Combustivel', 'Graos', 'Calcados', 'Cosmeticos', 'Medicamentos', 'Aco/Aluminio', 'Bebidas', 'Textil'];

const STATUSES = [
  { value: 'Pendente', color: '#71717a', badge: 'badge-gray' },
  { value: 'Em Andamento', color: '#3b82f6', badge: 'badge-blue' },
  { value: 'Concluido', color: '#22c55e', badge: 'badge-green' },
  { value: 'Cancelado', color: '#ef4444', badge: 'badge-red' },
  { value: 'Negado', color: '#8b5cf6', badge: 'badge-purple' },
];

const PRIORITIES = [
  { value: 'Baixa', color: '#22c55e', badge: 'badge-green' },
  { value: 'Media', color: '#eab308', badge: 'badge-yellow' },
  { value: 'Alta', color: '#f97316', badge: 'badge-orange' },
  { value: 'Urgente', color: '#ef4444', badge: 'badge-red' },
];

const TIPOS_DOCUMENTO = [
  'NF', 'CTE', 'MDFE', 'Averbacao', 'CNH', 'Boletim de Ocorrencia',
  'BO Furto', 'Decl. Motorista', 'Docs do Veiculo', 'Tacografo',
  'Doc. Terceiros', 'Fotos do Sinistro', 'Rel. Monitoramento', 'Rel. Reguladora'
];

const TAGS = [
  { name: 'Carga Total', color: '#3b82f6', count: 0 },
  { name: 'Carga Parcial', color: '#22c55e', count: 0 },
  { name: 'Alta Prioridade', color: '#ef4444', count: 0 },
  { name: 'Aguardando Docs', color: '#eab308', count: 0 },
  { name: 'Em Regulacao', color: '#8b5cf6', count: 0 },
  { name: 'Indenizado', color: '#06b6d4', count: 0 },
  { name: 'Judicial', color: '#f97316', count: 0 },
  { name: 'Salvados', color: '#ec4899', count: 0 },
  { name: 'Roubo', color: '#dc2626', count: 0 },
  { name: 'Acidente', color: '#2563eb', count: 0 },
  { name: 'Avaria', color: '#ca8a04', count: 0 },
  { name: 'Interestadual', color: '#059669', count: 0 },
];

const SLA_POLICIES = [
  { name: 'Padrao', tempos: { Baixa: '48h', Media: '24h', Alta: '8h', Urgente: '4h' }, active: true },
  { name: 'Premium', tempos: { Baixa: '24h', Media: '12h', Alta: '4h', Urgente: '2h' }, active: true },
  { name: 'Emergencia', tempos: { Baixa: '12h', Media: '6h', Alta: '2h', Urgente: '1h' }, active: true },
  { name: 'Sem SLA', tempos: { Baixa: '-', Media: '-', Alta: '-', Urgente: '-' }, active: false },
];

const NOTIFICATIONS = [
  { id: 'n1', type: 'error', icon: '🔴', iconBg: 'rgba(239,68,68,0.15)', title: 'SLA Violado', message: 'SIN-005: prazo de resposta excedido (Urgente)', time: 'Ha 15 min', read: false },
  { id: 'n2', type: 'warning', icon: '🟡', iconBg: 'rgba(234,179,8,0.15)', title: 'SLA em Atencao', message: 'SIN-012: prazo vence em 2 horas (Alta)', time: 'Ha 30 min', read: false },
  { id: 'n3', type: 'warning', icon: '📄', iconBg: 'rgba(234,179,8,0.15)', title: 'Documentos Pendentes', message: 'SIN-008: faltam 6 de 14 documentos', time: 'Ha 1 hora', read: false },
  { id: 'n4', type: 'info', icon: '📋', iconBg: 'rgba(59,130,246,0.15)', title: 'Follow-up Atrasado', message: 'SIN-015: data prevista era ontem', time: 'Ha 2 horas', read: false },
  { id: 'n5', type: 'success', icon: '✅', iconBg: 'rgba(34,197,94,0.15)', title: 'Sinistro Concluido', message: 'SIN-019: status alterado para Concluido', time: 'Ha 3 horas', read: false },
  { id: 'n6', type: 'info', icon: '🔥', iconBg: 'rgba(59,130,246,0.15)', title: 'Novo Sinistro', message: 'SIN-030: registrado por Corretor 2', time: 'Ha 4 horas', read: true },
  { id: 'n7', type: 'warning', icon: '⏱️', iconBg: 'rgba(234,179,8,0.15)', title: 'SLA em Atencao', message: 'SIN-003: prazo vence em 4 horas (Media)', time: 'Ha 5 horas', read: true },
  { id: 'n8', type: 'info', icon: '📎', iconBg: 'rgba(59,130,246,0.15)', title: 'Documento Enviado', message: 'SIN-022: Boletim de Ocorrencia anexado', time: 'Ha 6 horas', read: true },
];

const USERS = [
  { id: 'u1', name: 'Corretor 1', initials: 'C1', email: 'corretor1@iosrisk.com', role: 'Corretor', roleType: 'USER', color: 1, sinistros: 12, status: 'Ativo' },
  { id: 'u2', name: 'Corretor 2', initials: 'C2', email: 'corretor2@iosrisk.com', role: 'Corretor', roleType: 'USER', color: 2, sinistros: 10, status: 'Ativo' },
  { id: 'u3', name: 'Corretor 3', initials: 'C3', email: 'corretor3@iosrisk.com', role: 'Corretor', roleType: 'USER', color: 3, sinistros: 8, status: 'Ativo' },
  { id: 'u4', name: 'Admin', initials: 'AD', email: 'admin@iosrisk.com', role: 'Admin', roleType: 'ADMIN', color: 4, sinistros: 0, status: 'Ativo' },
  { id: 'u5', name: 'Gestor', initials: 'GS', email: 'gestor@iosrisk.com', role: 'Gerente', roleType: 'MANAGER', color: 5, sinistros: 5, status: 'Ativo' },
];

const ROLES = [
  { name: 'Admin', permissions: ['Acesso total', 'Gerenciar usuarios', 'Gerenciar roles', 'Configuracoes', 'Exportar dados', 'Excluir registros'] },
  { name: 'Gerente', permissions: ['Ver todos sinistros', 'Editar sinistros', 'Dashboard completo', 'Exportar dados', 'Gerenciar SLA'] },
  { name: 'Corretor', permissions: ['Ver sinistros proprios', 'Criar sinistros', 'Editar sinistros proprios', 'Adicionar follow-ups', 'Enviar documentos'] },
  { name: 'Visualizador', permissions: ['Ver todos sinistros (somente leitura)', 'Ver dashboard', 'Exportar dados'] },
];

// ---------- GENERATE SINISTROS ----------

function generateSinistros() {
  const sinistros = [];
  const statusDist = [
    'Pendente','Pendente','Pendente','Pendente','Pendente','Pendente','Pendente','Pendente',
    'Em Andamento','Em Andamento','Em Andamento','Em Andamento','Em Andamento','Em Andamento','Em Andamento','Em Andamento','Em Andamento','Em Andamento',
    'Concluido','Concluido','Concluido','Concluido','Concluido','Concluido',
    'Cancelado','Cancelado','Cancelado',
    'Negado','Negado','Negado'
  ];
  const descricoes = [
    'Veiculo sofreu colisao na rodovia durante transporte de carga refrigerada.',
    'Carga avariada por problemas no acondicionamento durante o transporte.',
    'Roubo de carga durante parada em posto de combustivel.',
    'Tombamento do veiculo em curva da rodovia, perda total da mercadoria.',
    'Furto da carga durante pernoite em estacionamento nao monitorado.',
    'Incendio no compartimento de carga, causa em investigacao.',
  ];
  const locais = ['BR-101, km 342 - SC','BR-116, km 215 - PR','BR-376, km 180 - PR','BR-153, km 95 - SC','BR-470, km 120 - SC','Rod. Pres. Dutra, km 310 - SP'];
  const origens = ['Concordia/SC','Chapeco/SC','Curitiba/PR','Florianopolis/SC','Porto Alegre/RS','Joinville/SC'];
  const destinos = ['Sao Paulo/SP','Rio de Janeiro/RJ','Belo Horizonte/MG','Campinas/SP','Santos/SP','Vitoria/ES'];
  const tiposContato = ['Ligacao Telefonica','E-mail','WhatsApp','Visita Presencial','Reuniao','Envio de Documento','Nota Interna'];
  const fuDescricoes = ['Solicitado envio de documentacao pendente.','Retorno sobre analise da reguladora.','Aguardando laudo do vistoriador.','Segurado informou novos dados.','Seguradora solicitou docs complementares.'];
  const fuAcoes = ['Cobrar resposta da seguradora','Enviar documentos','Agendar vistoria','Contatar segurado','Aguardar laudo'];
  const possibleTags = ['Carga Total','Carga Parcial','Alta Prioridade','Aguardando Docs','Em Regulacao','Indenizado','Judicial','Salvados'];

  for (let i = 0; i < 30; i++) {
    const status = statusDist[i];
    const corretor = CORRETORES[i % CORRETORES.length];
    const seguradora = SEGURADORAS[i % SEGURADORAS.length];
    const segurado = SEGURADOS[i % SEGURADOS.length];
    const prioridade = PRIORITIES[i % 4].value;
    const slaVal = i % 5 === 0 ? 'violated' : (i % 3 === 0 ? 'warning' : 'ok');

    // Vehicles
    const veiculos = [{ tipo: 'Cavalo', marca: ['Scania','Volvo','Mercedes','DAF'][i%4], modelo: ['R450','FH540','Actros','XF'][i%4], placa: 'ABC'+String(1000+i*3), ano: 2020+(i%4) }];
    if (i%2===0) veiculos.push({ tipo: 'Carreta 1', marca: '-', modelo: 'Bau', placa: 'DEF'+String(2000+i), ano: 2019+(i%3), tipoCarreta: 'Bau Refrigerado' });
    if (i%4===0) veiculos.push({ tipo: 'Carreta 2', marca: '-', modelo: 'Graneleira', placa: 'GHI'+String(3000+i), ano: 2018, tipoCarreta: 'Graneleira' });

    // Documents (5-14)
    const numDocs = 5 + (i * 7 % 10);
    const shuffled = TIPOS_DOCUMENTO.slice().sort(() => ((i*13+7)%17)/17 - 0.5);
    const documentos = shuffled.slice(0, Math.min(numDocs, 14)).map(tipo => ({
      tipo, arquivo: tipo.toLowerCase().replace(/[^a-z]/g,'-')+'-sin-'+String(i+1).padStart(3,'0')+'.pdf',
      dataEnvio: '2025-03-'+String(2+(i%27)).padStart(2,'0')+' '+String(8+(i%10)).padStart(2,'0')+':'+String((i*7)%60).padStart(2,'0')
    }));

    // Follow-ups (0-5)
    const followUps = [];
    for (let f = 0; f < Math.min(i%6, 5); f++) {
      followUps.push({
        dataHora: '2025-03-'+String(5+f*3).padStart(2,'0')+' '+String(9+f).padStart(2,'0')+':00',
        tipoContato: tiposContato[f%7], prioridade: PRIORITIES[f%4].value,
        contato: 'Contato '+(f+1),
        telefoneEmail: f%2===0 ? '(49) 9'+(9000+f*111)+'-'+(1000+f*222) : 'contato'+(f+1)+'@email.com',
        descricao: fuDescricoes[f%5], proximaAcao: fuAcoes[f%5],
        dataPrevista: '2025-03-'+String(10+f*3).padStart(2,'0')
      });
    }

    const numTags = 1+(i%3);
    const sinTags = possibleTags.slice().sort(() => ((i*11+3)%13)/13-0.5).slice(0,numTags);
    const valorNota = 10000 + ((i*17321)%490000);
    const prejuizo = Math.floor(valorNota * (0.3 + ((i*7919)%70)/100));

    sinistros.push({
      id: 'SIN-'+String(i+1).padStart(3,'0'),
      corretor, seguradora, segurado,
      reguladora: REGULADORAS[i%3], gerenciadora: GERENCIADORAS[i%3], transportadora: TRANSPORTADORAS[i%4],
      cnpjSegurado: segurado.cnpj,
      numApolice: 'APL-2024-'+String(1000+i*7).padStart(5,'0'),
      ramo: ['Transporte Nacional','Transporte Internacional','RCTR-C','RCF-DC'][i%4],
      numSeguradora: 'SEG-'+String(5000+i*13).padStart(6,'0'),
      numReguladora: i%3===0 ? 'REG-'+String(3000+i*11).padStart(6,'0') : '',
      valorNota, prejuizo,
      valorIndenizado: status==='Concluido' ? Math.floor(prejuizo*0.85) : 0,
      franquia: Math.floor(valorNota*0.05),
      salvados: status==='Concluido' ? (i*1231)%5000 : 0,
      despesasRegulacao: i%3===0 ? 500+((i*997)%3000) : 0,
      causa: CAUSAS[i%3], classificacao: CLASSIFICACOES[i%10], mercadoria: MERCADORIAS[i%10],
      dataHoraEvento: '2025-03-'+String(1+(i%28)).padStart(2,'0')+' '+String(6+(i%16)).padStart(2,'0')+':'+String((i*13)%60).padStart(2,'0'),
      dataHoraAviso: '2025-03-'+String(2+(i%27)).padStart(2,'0')+' '+String(8+(i%10)).padStart(2,'0')+':'+String((i*17)%60).padStart(2,'0'),
      localEvento: locais[i%6],
      motorista: 'Motorista '+(i+1), cpfMotorista: String(100+i*3)+'.'+String(200+i*7)+'.'+String(300+i*11)+'-'+String(10+i%90).padStart(2,'0'),
      remetente: 'Remetente '+(i%5+1), localOrigem: origens[i%6],
      destinatario: 'Destinatario '+(i%5+1), localDestino: destinos[i%6],
      descricao: descricoes[i%6], observacoes: i%3===0 ? 'Aguardando documentacao complementar da transportadora.' : '',
      status, prioridade, sla: slaVal,
      slaDeadline: '2025-03-'+String(5+(i%25)).padStart(2,'0')+' 18:00',
      veiculos, documentos, followUps, tags: sinTags,
      createdAt: '2025-03-'+String(1+(i%28)).padStart(2,'0'),
      createdBy: corretor.nome
    });
  }
  return sinistros;
}

const SINISTROS = generateSinistros();
TAGS.forEach(t => { t.count = SINISTROS.filter(s => s.tags.includes(t.name)).length; });

// ---------- STATE ----------

let currentSection = 'dashboard';
let currentSinistroTab = 'registros';
let currentTemplate = 0;
let tableCurrentPage = 1;
const TABLE_PAGE_SIZE = 8;
let tableSortCol = null;
let tableSortDir = 'asc';
let tableSearchTerm = '';
let crossFilters = [];
let selectedRows = new Set();
let notificationsData = [...NOTIFICATIONS];

// ---------- UTILITIES ----------

function formatCurrency(v) { return v ? v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}) : 'R$ 0,00'; }
function formatDate(s) { return s ? s.substring(0,10).split('-').reverse().join('/') : '-'; }
function getStatusObj(v) { return STATUSES.find(s=>s.value===v)||STATUSES[0]; }
function getPriorityObj(v) { return PRIORITIES.find(p=>p.value===v)||PRIORITIES[0]; }

// ---------- NAVIGATION ----------

function showSection(name) {
  document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
  const el = document.getElementById('section-'+name);
  if (el) el.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  const nav = document.querySelector('.nav-item[data-section="'+name+'"]');
  if (nav) nav.classList.add('active');
  currentSection = name;
  // Render cadastro sections on demand
  if (['segurados','seguradoras','corretores','transportadoras','reguladoras','gerenciadoras'].includes(name)) renderCadastro(name);
}

function toggleSection(el) {
  el.classList.toggle('collapsed');
  const items = el.nextElementSibling;
  if (el.classList.contains('collapsed')) { items.style.maxHeight = '0'; }
  else { items.style.maxHeight = items.scrollHeight+'px'; }
}

function switchSinistroTab(tabId) {
  currentSinistroTab = tabId;
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  document.querySelector('.tab-btn[data-tab="'+tabId+'"]').classList.add('active');
  document.querySelectorAll('.tab-content').forEach(c=>c.classList.remove('active'));
  const tc = document.getElementById('tab-'+tabId);
  if (tc) tc.classList.add('active');
}

function switchTemplate(idx) {
  currentTemplate = idx;
  document.querySelectorAll('.template-pill').forEach((p,i)=>p.classList.toggle('active',i===idx));
}

function openDialog(id) { document.getElementById(id).classList.add('open'); }
function closeDialog(id) { document.getElementById(id).classList.remove('open'); }

// ---------- CROSS-FILTER ----------

function addCrossFilter(field, value) {
  if (crossFilters.find(f=>f.field===field&&f.value===value)) return;
  crossFilters.push({field,value});
  renderFilterBar(); renderTable(); renderKanban();
}
function removeCrossFilter(idx) { crossFilters.splice(idx,1); renderFilterBar(); renderTable(); renderKanban(); }
function clearAllFilters() { crossFilters=[]; renderFilterBar(); renderTable(); renderKanban(); }

function renderFilterBar() {
  const c = document.getElementById('filter-bar-content');
  const rc = document.getElementById('record-count');
  if (!c) return;
  if (crossFilters.length === 0) { c.innerHTML = ''; if(rc) rc.textContent = SINISTROS.length+' sinistros'; return; }
  c.innerHTML = crossFilters.map((f,i)=>'<span class="filter-badge">'+f.field+': '+f.value+' <span class="remove" onclick="removeCrossFilter('+i+')">✕</span></span>').join('')
    + '<button class="btn btn-ghost btn-sm" onclick="clearAllFilters()">Limpar</button>';
  if(rc) rc.textContent = getFilteredSinistros().length+' de '+SINISTROS.length+' sinistros';
}

// ---------- DATA TABLE ----------

function getFilteredSinistros() {
  let data = SINISTROS.slice();
  crossFilters.forEach(f => {
    data = data.filter(s => {
      if (f.field==='status') return s.status===f.value;
      if (f.field==='causa') return s.causa===f.value;
      if (f.field==='prioridade') return s.prioridade===f.value;
      if (f.field==='seguradora') return s.seguradora.razaoSocial===f.value;
      if (f.field==='corretor') return s.corretor.nome===f.value;
      if (f.field==='classificacao') return s.classificacao===f.value;
      return true;
    });
  });
  if (tableSearchTerm) {
    const q = tableSearchTerm.toLowerCase();
    data = data.filter(s=> s.id.toLowerCase().includes(q) || s.segurado.nome.toLowerCase().includes(q) || s.corretor.nome.toLowerCase().includes(q) || s.seguradora.razaoSocial.toLowerCase().includes(q) || s.causa.toLowerCase().includes(q));
  }
  if (tableSortCol) {
    data.sort((a,b) => {
      let va, vb;
      if (tableSortCol==='id') { va=a.id; vb=b.id; }
      else if (tableSortCol==='corretor') { va=a.corretor.nome; vb=b.corretor.nome; }
      else if (tableSortCol==='seguradora') { va=a.seguradora.razaoSocial; vb=b.seguradora.razaoSocial; }
      else if (tableSortCol==='segurado') { va=a.segurado.nome; vb=b.segurado.nome; }
      else if (tableSortCol==='numSeguradora') { va=a.numSeguradora; vb=b.numSeguradora; }
      else if (tableSortCol==='status') { va=a.status; vb=b.status; }
      else if (tableSortCol==='prioridade') { va=a.prioridade; vb=b.prioridade; }
      else if (tableSortCol==='causa') { va=a.causa; vb=b.causa; }
      else if (tableSortCol==='createdAt') { va=a.createdAt; vb=b.createdAt; }
      else { va=a.id; vb=b.id; }
      const cmp = String(va).localeCompare(String(vb));
      return tableSortDir==='asc' ? cmp : -cmp;
    });
  }
  return data;
}

function renderTable() {
  const tbody = document.getElementById('sinistros-tbody');
  const pag = document.getElementById('table-pagination');
  if (!tbody) return;
  const data = getFilteredSinistros();
  const total = data.length;
  const totalPages = Math.max(1,Math.ceil(total/TABLE_PAGE_SIZE));
  if (tableCurrentPage > totalPages) tableCurrentPage = totalPages;
  const start = (tableCurrentPage-1)*TABLE_PAGE_SIZE;
  const page = data.slice(start, start+TABLE_PAGE_SIZE);

  tbody.innerHTML = page.map(s => {
    const st = getStatusObj(s.status);
    const pr = getPriorityObj(s.prioridade);
    const docsCount = s.documentos.length;
    const docsCls = docsCount>=12?'docs-ok':(docsCount>=8?'docs-partial':'docs-low');
    const docsPct = Math.round(docsCount/14*100);
    return '<tr onclick="showDetail(\''+s.id+'\')">'
      +'<td class="checkbox-cell" onclick="event.stopPropagation()"><input type="checkbox" '+(selectedRows.has(s.id)?'checked':'')+' onchange="toggleRow(\''+s.id+'\')"></td>'
      +'<td style="color:var(--primary);font-weight:600">'+s.id+'</td>'
      +'<td>'+s.corretor.nome+'</td>'
      +'<td>'+s.seguradora.razaoSocial+'</td>'
      +'<td>'+s.segurado.nome+'</td>'
      +'<td>'+s.numSeguradora+'</td>'
      +'<td><span class="badge '+st.badge+'">'+s.status+'</span></td>'
      +'<td><span class="badge '+pr.badge+'">'+s.prioridade+'</span></td>'
      +'<td><span class="badge badge-gray">'+s.causa+'</span></td>'
      +'<td><span class="docs-badge '+docsCls+'">📎 '+docsCount+'/14</span><span class="docs-mini-bar"><span class="docs-mini-bar-fill" style="width:'+docsPct+'%;background:'+st.color+'"></span></span></td>'
      +'<td><span class="sla-indicator sla-'+s.sla+'" title="SLA: '+s.sla+'"></span></td>'
      +'<td>'+formatDate(s.createdAt)+'</td>'
      +'</tr>';
  }).join('');

  if (pag) {
    const from = total>0?start+1:0;
    const to = Math.min(start+TABLE_PAGE_SIZE, total);
    let ph = '<div class="table-pagination-info">'+from+'-'+to+' de '+total+' · '+tableCurrentPage+'/'+totalPages+'</div>';
    ph += '<div class="table-pagination-pages">';
    ph += '<button class="page-btn" onclick="goToPage(1)" '+(tableCurrentPage<=1?'disabled':'')+'>&laquo;</button>';
    ph += '<button class="page-btn" onclick="goToPage('+(tableCurrentPage-1)+')" '+(tableCurrentPage<=1?'disabled':'')+'>&lsaquo;</button>';
    for (let p=Math.max(1,tableCurrentPage-2);p<=Math.min(totalPages,tableCurrentPage+2);p++) {
      ph += '<button class="page-btn '+(p===tableCurrentPage?'active':'')+'" onclick="goToPage('+p+')">'+p+'</button>';
    }
    ph += '<button class="page-btn" onclick="goToPage('+(tableCurrentPage+1)+')" '+(tableCurrentPage>=totalPages?'disabled':'')+'>&rsaquo;</button>';
    ph += '<button class="page-btn" onclick="goToPage('+totalPages+')" '+(tableCurrentPage>=totalPages?'disabled':'')+'>&raquo;</button>';
    ph += '</div>';
    pag.innerHTML = ph;
  }
  renderFilterBar();
}

function searchTable(v) { tableSearchTerm=v; tableCurrentPage=1; renderTable(); }
function sortTable(col) { if(tableSortCol===col) tableSortDir=tableSortDir==='asc'?'desc':'asc'; else { tableSortCol=col; tableSortDir='asc'; } renderTable(); }
function goToPage(p) { tableCurrentPage=Math.max(1,p); renderTable(); }
function toggleRow(id) { selectedRows.has(id)?selectedRows.delete(id):selectedRows.add(id); renderTable(); }
function toggleSelectAll() { const data=getFilteredSinistros(); if(selectedRows.size===data.length) selectedRows.clear(); else data.forEach(s=>selectedRows.add(s.id)); renderTable(); }

// ---------- KANBAN ----------

function renderKanban() {
  const board = document.getElementById('kanban-board');
  if (!board) return;
  const data = getFilteredSinistros();
  const cols = STATUSES.map(st=>({...st, items: data.filter(s=>s.status===st.value)}));
  board.innerHTML = cols.map(col=>{
    return '<div class="kanban-column" data-status="'+col.value+'" ondragover="kanbanDragOver(event)" ondragleave="kanbanDragLeave(event)" ondrop="kanbanDrop(event)">'
      +'<div class="kanban-col-header"><span class="col-dot" style="background:'+col.color+'"></span>'+col.value+' <span class="col-count">'+col.items.length+'</span>'
      +'<button class="col-add" onclick="showSection(\'form\')">+</button></div>'
      +'<div class="kanban-cards">'+col.items.map(s=>renderKanbanCard(s)).join('')+'</div></div>';
  }).join('');
}

function renderKanbanCard(s) {
  const pr = getPriorityObj(s.prioridade);
  const dc = s.documentos.length;
  return '<div class="kanban-card" draggable="true" data-id="'+s.id+'" ondragstart="kanbanDragStart(event)" onclick="showDetail(\''+s.id+'\')">'
    +'<div class="kanban-card-id">'+s.id+'</div>'
    +'<div class="kanban-card-title">'+s.segurado.nome+' — '+s.causa+'</div>'
    +'<div class="kanban-card-meta">'
    +'<span class="badge badge-gray" style="font-size:10px">'+s.causa+'</span>'
    +'<span class="badge '+pr.badge+'" style="font-size:10px">'+s.prioridade+'</span>'
    +'</div>'
    +'<div class="kanban-card-footer">'
    +'<div class="flex items-center gap-2"><span class="kanban-card-avatar avatar-'+s.corretor.color+'">'+s.corretor.iniciais+'</span>'
    +'<span class="kanban-card-docs">📎 '+dc+'/14</span></div>'
    +'<span class="sla-indicator sla-'+s.sla+'"></span>'
    +'</div></div>';
}

function kanbanDragStart(e) { e.dataTransfer.setData('text/plain',e.target.dataset.id); e.target.classList.add('dragging'); }
function kanbanDragOver(e) { e.preventDefault(); e.currentTarget.closest('.kanban-column').classList.add('drag-over'); }
function kanbanDragLeave(e) { e.currentTarget.closest('.kanban-column').classList.remove('drag-over'); }
function kanbanDrop(e) {
  e.preventDefault();
  const col = e.currentTarget.closest('.kanban-column');
  col.classList.remove('drag-over');
  const id = e.dataTransfer.getData('text/plain');
  const newStatus = col.dataset.status;
  const s = SINISTROS.find(x=>x.id===id);
  if (s) { s.status = newStatus; renderKanban(); renderTable(); }
}

// ---------- DETAIL VIEW ----------

function showDetail(sinistroId) {
  const s = SINISTROS.find(x=>x.id===sinistroId);
  if (!s) return;
  const st = getStatusObj(s.status);
  const pr = getPriorityObj(s.prioridade);
  const dc = s.documentos.length;
  const docPct = Math.round(dc/14*100);
  const uploadedTypes = s.documentos.map(d=>d.tipo);

  let h = '<button class="btn btn-ghost btn-sm mb-4" onclick="showSection(\'sinistros\')">← Voltar para lista</button>';
  h += '<div class="detail-header">';
  h += '<div class="detail-id">'+s.id+'</div>';
  h += '<div class="detail-title-row"><span class="detail-segurado">'+s.segurado.nome+'</span>';
  h += '<span class="badge '+st.badge+'">'+s.status+'</span>';
  h += '<span class="badge badge-gray">'+s.causa+'</span>';
  h += '<span class="badge '+pr.badge+'">'+s.prioridade+'</span></div>';
  h += '<div class="detail-meta"><span>Corretor: <strong>'+s.corretor.nome+'</strong></span>';
  h += '<span>Evento: '+formatDate(s.dataHoraEvento)+'</span>';
  h += '<span>Apolice: '+s.numApolice+'</span></div></div>';

  h += '<div class="detail-layout">';

  // === MAIN ===
  h += '<div class="detail-main">';

  // Dados do Sinistro
  h += '<div class="detail-section"><div class="detail-section-header"><span class="detail-section-icon">📋</span><span class="detail-section-title">Dados do Sinistro</span></div>';
  h += '<div class="info-grid">';
  h += '<div class="info-item"><div class="info-label">Apolice</div><div class="info-value">'+s.numApolice+'</div></div>';
  h += '<div class="info-item"><div class="info-label">Ramo</div><div class="info-value">'+s.ramo+'</div></div>';
  h += '<div class="info-item"><div class="info-label">No Seguradora</div><div class="info-value">'+s.numSeguradora+'</div></div>';
  h += '<div class="info-item"><div class="info-label">No Reguladora</div><div class="info-value">'+(s.numReguladora||'-')+'</div></div>';
  h += '<div class="info-item"><div class="info-label">Classificacao</div><div class="info-value">'+s.classificacao+'</div></div>';
  h += '<div class="info-item"><div class="info-label">Mercadoria</div><div class="info-value">'+s.mercadoria+'</div></div>';
  h += '<div class="info-item"><div class="info-label">Data/Hora Evento</div><div class="info-value">'+s.dataHoraEvento+'</div></div>';
  h += '<div class="info-item"><div class="info-label">Data/Hora Aviso</div><div class="info-value">'+s.dataHoraAviso+'</div></div>';
  h += '<div class="info-item"><div class="info-label">Local</div><div class="info-value">'+s.localEvento+'</div></div>';
  h += '<div class="info-item"><div class="info-label">Motorista</div><div class="info-value">'+s.motorista+'</div></div>';
  h += '<div class="info-item"><div class="info-label">Origem</div><div class="info-value">'+s.localOrigem+'</div></div>';
  h += '<div class="info-item"><div class="info-label">Destino</div><div class="info-value">'+s.localDestino+'</div></div>';
  h += '</div>';
  if (s.descricao) h += '<div class="mt-4" style="padding:12px;background:var(--muted);border-radius:6px"><div class="info-label mb-2">Descricao</div><div style="font-size:13px">'+s.descricao+'</div></div>';
  h += '</div>';

  // Valores
  h += '<div class="detail-section"><div class="detail-section-header"><span class="detail-section-icon">💰</span><span class="detail-section-title">Valores</span></div>';
  h += '<div class="currency-grid">';
  h += '<div class="currency-item"><div class="currency-label">Valor Nota</div><div class="currency-value">'+formatCurrency(s.valorNota)+'</div></div>';
  h += '<div class="currency-item"><div class="currency-label">Prejuizo</div><div class="currency-value" style="color:#ef4444">'+formatCurrency(s.prejuizo)+'</div></div>';
  h += '<div class="currency-item"><div class="currency-label">Valor Indenizado</div><div class="currency-value">'+formatCurrency(s.valorIndenizado)+'</div></div>';
  h += '<div class="currency-item"><div class="currency-label">Franquia/POS</div><div class="currency-value" style="color:var(--muted-foreground)">'+formatCurrency(s.franquia)+'</div></div>';
  h += '<div class="currency-item"><div class="currency-label">Salvados</div><div class="currency-value" style="color:var(--muted-foreground)">'+formatCurrency(s.salvados)+'</div></div>';
  h += '<div class="currency-item"><div class="currency-label">Desp. Regulacao</div><div class="currency-value" style="color:var(--muted-foreground)">'+formatCurrency(s.despesasRegulacao)+'</div></div>';
  h += '</div></div>';

  // Veiculos
  h += '<div class="detail-section"><div class="detail-section-header"><span class="detail-section-icon">🚛</span><span class="detail-section-title">Veiculos</span><span class="detail-section-count">'+s.veiculos.length+'</span></div>';
  h += '<table class="vehicle-table"><thead><tr><th>Tipo</th><th>Marca</th><th>Modelo</th><th>Placa</th><th>Ano</th></tr></thead><tbody>';
  s.veiculos.forEach(v => { h += '<tr><td>'+v.tipo+'</td><td>'+v.marca+'</td><td>'+v.modelo+'</td><td>'+v.placa+'</td><td>'+v.ano+'</td></tr>'; });
  h += '</tbody></table>';
  h += '<button class="btn btn-secondary btn-sm mt-2">+ Adicionar Veiculo</button></div>';

  // === DOCUMENTOS (checklist!) ===
  h += '<div class="detail-section"><div class="detail-section-header"><span class="detail-section-icon">📄</span><span class="detail-section-title">Documentos</span><span class="detail-section-count">'+dc+'/14</span></div>';
  h += '<div class="doc-progress"><div class="doc-progress-header"><span class="doc-progress-label">Progresso de envio</span><span class="doc-progress-count">'+dc+' de 14 documentos enviados</span></div>';
  h += '<div class="doc-progress-bar"><div class="doc-progress-fill" style="width:'+docPct+'%"></div></div></div>';
  h += '<div class="doc-checklist">';
  TIPOS_DOCUMENTO.forEach(tipo => {
    const doc = s.documentos.find(d=>d.tipo===tipo);
    if (doc) {
      h += '<div class="doc-item doc-uploaded"><span class="doc-item-icon" style="color:#22c55e">✅</span><span class="doc-item-name">'+tipo+'</span><span class="doc-item-date">'+formatDate(doc.dataEnvio)+'</span></div>';
    } else {
      h += '<div class="doc-item doc-missing"><span class="doc-item-icon" style="color:var(--muted-foreground)">⬜</span><span class="doc-item-name doc-pending">'+tipo+'</span><span class="doc-item-date" style="color:#ef4444">Pendente</span></div>';
    }
  });
  h += '</div>';
  h += '<button class="btn btn-primary btn-sm mt-4">📎 Enviar Documento</button></div>';

  // Follow Ups
  h += '<div class="detail-section"><div class="detail-section-header"><span class="detail-section-icon">📞</span><span class="detail-section-title">Follow Ups</span><span class="detail-section-count">'+s.followUps.length+'</span></div>';
  if (s.followUps.length > 0) {
    h += '<div class="followup-list">';
    s.followUps.forEach(fu => {
      const fuPr = getPriorityObj(fu.prioridade);
      h += '<div class="followup-item"><div class="followup-header"><span class="followup-date">'+fu.dataHora+'</span>';
      h += '<span class="badge badge-blue" style="font-size:10px">'+fu.tipoContato+'</span>';
      h += '<span class="badge '+fuPr.badge+' followup-priority" style="font-size:10px">'+fu.prioridade+'</span></div>';
      h += '<div class="followup-contact">'+fu.contato+' · '+fu.telefoneEmail+'</div>';
      h += '<div class="followup-desc">'+fu.descricao+'</div>';
      if (fu.proximaAcao) h += '<div class="followup-next">Proxima acao: '+fu.proximaAcao+' ('+formatDate(fu.dataPrevista)+')</div>';
      h += '</div>';
    });
    h += '</div>';
  } else { h += '<div style="padding:20px;text-align:center;color:var(--muted-foreground)">Nenhum follow-up registrado</div>'; }
  h += '<button class="btn btn-secondary btn-sm mt-2">+ Novo Follow Up</button></div>';

  // Timeline
  h += '<div class="detail-section"><div class="detail-section-header"><span class="detail-section-icon">📅</span><span class="detail-section-title">Timeline</span></div>';
  h += '<div class="timeline">';
  h += '<div class="timeline-item"><span class="timeline-dot" style="background:#3b82f6"></span><div class="timeline-content">Sinistro criado por <strong>'+s.createdBy+'</strong></div><div class="timeline-time">'+formatDate(s.createdAt)+' 09:00</div></div>';
  s.documentos.slice(0,3).forEach((d,i) => {
    h += '<div class="timeline-item"><span class="timeline-dot" style="background:#22c55e"></span><div class="timeline-content">Documento <strong>'+d.tipo+'</strong> enviado</div><div class="timeline-time">'+formatDate(d.dataEnvio)+'</div></div>';
  });
  s.followUps.slice(0,2).forEach(fu => {
    h += '<div class="timeline-item"><span class="timeline-dot" style="background:#8b5cf6"></span><div class="timeline-content">Follow-up: <strong>'+fu.tipoContato+'</strong> — '+fu.descricao.substring(0,60)+'</div><div class="timeline-time">'+fu.dataHora+'</div></div>';
  });
  if (s.status !== 'Pendente') {
    h += '<div class="timeline-item"><span class="timeline-dot" style="background:'+st.color+'"></span><div class="timeline-content">Status alterado para <strong>'+s.status+'</strong></div><div class="timeline-time">'+formatDate(s.createdAt)+'</div></div>';
  }
  h += '</div></div>';

  h += '</div>'; // /detail-main

  // === SIDEBAR ===
  h += '<div class="detail-sidebar">';

  // SLA Timer
  const slaClass = s.sla==='ok'?'sla-timer-ok':(s.sla==='warning'?'sla-timer-warning':'sla-timer-violated');
  const slaText = s.sla==='ok'?'Dentro do prazo':(s.sla==='warning'?'Atencao: prazo proximo':'SLA Violado');
  const slaTime = s.sla==='ok'?'12h 30m':(s.sla==='warning'?'02h 15m':'-04h 20m');
  h += '<div class="sla-timer '+slaClass+'"><div class="sla-timer-label">Tempo Restante SLA</div>';
  h += '<div class="sla-timer-value">'+slaTime+'</div><div class="sla-timer-status">'+slaText+'</div></div>';

  // Properties
  h += '<div class="card mb-4"><div class="card-header"><div class="card-title">Propriedades</div></div><div class="card-content"><div class="properties-grid">';
  h += '<div class="property-item"><span class="property-label">Status</span><span class="badge '+st.badge+'">'+s.status+'</span></div>';
  h += '<div class="property-item"><span class="property-label">Prioridade</span><span class="badge '+pr.badge+'">'+s.prioridade+'</span></div>';
  h += '<div class="property-item"><span class="property-label">Causa</span><span class="property-value">'+s.causa+'</span></div>';
  h += '<div class="property-item"><span class="property-label">Classificacao</span><span class="property-value">'+s.classificacao+'</span></div>';
  h += '<div class="property-item"><span class="property-label">Mercadoria</span><span class="property-value">'+s.mercadoria+'</span></div>';
  h += '</div></div></div>';

  // Partes Envolvidas
  h += '<div class="card mb-4"><div class="card-header"><div class="card-title">Partes Envolvidas</div></div><div class="card-content"><div class="properties-grid">';
  h += '<div class="property-item"><span class="property-label">Corretor</span><span class="property-value">'+s.corretor.nome+'</span></div>';
  h += '<div class="property-item"><span class="property-label">Seguradora</span><span class="property-value">'+s.seguradora.razaoSocial+'</span></div>';
  h += '<div class="property-item"><span class="property-label">Segurado</span><span class="property-value">'+s.segurado.nome+'</span></div>';
  h += '<div class="property-item"><span class="property-label">Reguladora</span><span class="property-value">'+s.reguladora.razaoSocial+'</span></div>';
  h += '<div class="property-item"><span class="property-label">Gerenciadora</span><span class="property-value">'+s.gerenciadora.razaoSocial+'</span></div>';
  h += '<div class="property-item"><span class="property-label">Transportadora</span><span class="property-value">'+s.transportadora.razaoSocial+'</span></div>';
  h += '</div></div></div>';

  // Tags
  if (s.tags.length > 0) {
    h += '<div class="card"><div class="card-header"><div class="card-title">Tags</div></div><div class="card-content"><div class="flex gap-2" style="flex-wrap:wrap">';
    s.tags.forEach(t => { const tag = TAGS.find(x=>x.name===t); h += '<span class="badge" style="background:'+((tag?tag.color:'#71717a')+'20')+';color:'+(tag?tag.color:'#71717a')+'">'+t+'</span>'; });
    h += '</div></div></div>';
  }

  h += '</div>'; // /sidebar
  h += '</div>'; // /detail-layout

  document.getElementById('detail-content').innerHTML = h;
  showSection('detail');
}

// ---------- CHARTS ----------

function renderDashboardHome() {
  const c = document.getElementById('dashboard-home-content');
  if (!c) return;
  const totalPrejuizo = SINISTROS.reduce((a,s)=>a+s.prejuizo,0);
  const emAndamento = SINISTROS.filter(s=>s.status==='Em Andamento').length;
  const slaOk = SINISTROS.filter(s=>s.sla==='ok').length;
  const slaPct = Math.round(slaOk/SINISTROS.length*100);

  let h = '<div class="kpi-grid">';
  h += '<div class="kpi-card"><div class="kpi-label">🔥 Total Sinistros</div><div class="kpi-value">'+SINISTROS.length+'</div><div class="kpi-sub">+5 ultimos 7 dias</div></div>';
  h += '<div class="kpi-card"><div class="kpi-label">⚡ Em Andamento</div><div class="kpi-value" style="color:#3b82f6">'+emAndamento+'</div><div class="kpi-sub">'+Math.round(emAndamento/SINISTROS.length*100)+'% do total</div></div>';
  h += '<div class="kpi-card"><div class="kpi-label">💰 Prejuizo Total</div><div class="kpi-value" style="color:#ef4444;font-size:22px">'+formatCurrency(totalPrejuizo)+'</div><div class="kpi-sub">Todos os sinistros</div></div>';
  h += '<div class="kpi-card"><div class="kpi-label">⏱️ SLA Compliance</div><div class="kpi-value kpi-trend-up">'+slaPct+'%</div><div class="kpi-sub">'+slaOk+' de '+SINISTROS.length+' dentro do prazo</div></div>';
  h += '</div>';

  h += '<div class="charts-grid">';
  h += '<div class="chart-card"><div class="chart-card-title">Sinistros — Ultimos 30 dias</div><div id="home-area-chart"></div></div>';
  h += '<div class="chart-card"><div class="chart-card-title">Distribuicao por Status</div><div id="home-status-donut" class="donut-container"></div></div>';
  h += '</div>';

  h += '<div class="charts-grid">';
  h += '<div class="chart-card"><div class="chart-card-title">Por Causa</div><div id="home-causa-bars" class="bar-chart"></div></div>';
  h += '<div class="chart-card"><div class="chart-card-title">Atividade Recente</div><div class="activity-feed">';
  h += '<div class="activity-item"><span class="activity-icon" style="background:rgba(59,130,246,0.15)">🔥</span><div class="activity-text"><strong>Corretor 2</strong> registrou sinistro SIN-030</div><span class="activity-time">Ha 2h</span></div>';
  h += '<div class="activity-item"><span class="activity-icon" style="background:rgba(34,197,94,0.15)">✅</span><div class="activity-text"><strong>Gestor</strong> concluiu SIN-019</div><span class="activity-time">Ha 3h</span></div>';
  h += '<div class="activity-item"><span class="activity-icon" style="background:rgba(234,179,8,0.15)">📄</span><div class="activity-text"><strong>Corretor 1</strong> enviou BO em SIN-008</div><span class="activity-time">Ha 4h</span></div>';
  h += '<div class="activity-item"><span class="activity-icon" style="background:rgba(168,85,247,0.15)">📞</span><div class="activity-text"><strong>Corretor 3</strong> registrou follow-up em SIN-015</div><span class="activity-time">Ha 5h</span></div>';
  h += '</div></div>';
  h += '</div>';

  h += '<div class="quick-actions mt-4"><button class="quick-action-btn" onclick="showSection(\'form\')">🔥 Novo Sinistro</button>';
  h += '<button class="quick-action-btn" onclick="showSection(\'sinistros\');switchSinistroTab(\'kanban\')">📌 Ver Kanban</button>';
  h += '<button class="quick-action-btn" onclick="showSection(\'sinistros\')">📋 Ver Listagem</button></div>';

  c.innerHTML = h;
  renderAreaChart('home-area-chart');
  renderStatusDonut('home-status-donut', SINISTROS);
  renderCausaBars('home-causa-bars', SINISTROS);
}

function renderAreaChart(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const pts = []; for(let d=0;d<30;d++) pts.push(1+((d*7+3)%5));
  const mx = Math.max(...pts); const W=500,H=150,PX=40,PY=20,CW=W-PX*2,CH=H-PY*2;
  let poly='',area=PX+','+(H-PY);
  pts.forEach((v,i)=>{ const x=PX+(i/(pts.length-1))*CW, y=(H-PY)-(v/mx)*CH; poly+=x+','+y+' '; area+=' '+x+','+y; });
  area+=' '+(PX+CW)+','+(H-PY);
  let svg='<svg viewBox="0 0 '+W+' '+H+'" width="100%" height="'+H+'">';
  svg+='<defs><linearGradient id="ag-'+containerId+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#3b82f6" stop-opacity="0.3"/><stop offset="100%" stop-color="#3b82f6" stop-opacity="0.02"/></linearGradient></defs>';
  for(let g=0;g<=4;g++){const gy=(H-PY)-(g/4)*CH; svg+='<line x1="'+PX+'" y1="'+gy+'" x2="'+(W-PX)+'" y2="'+gy+'" stroke="var(--border)" stroke-width="1"/>'; svg+='<text x="'+(PX-8)+'" y="'+(gy+4)+'" text-anchor="end" font-size="10" fill="var(--muted-foreground)">'+Math.round(g/4*mx)+'</text>';}
  svg+='<polygon points="'+area+'" fill="url(#ag-'+containerId+')"/>';
  svg+='<polyline points="'+poly+'" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linejoin="round"/>';
  [0,7,14,21,29].forEach(i=>{const x=PX+(i/(pts.length-1))*CW; svg+='<text x="'+x+'" y="'+(H-4)+'" text-anchor="middle" font-size="10" fill="var(--muted-foreground)">Dia '+(i+1)+'</text>';});
  svg+='</svg>';
  el.innerHTML=svg;
}

function renderStatusDonut(containerId, data) {
  const el = document.getElementById(containerId); if (!el) return;
  const counts={}; STATUSES.forEach(s=>{counts[s.value]=0}); data.forEach(s=>{counts[s.status]=(counts[s.status]||0)+1;});
  const total=data.length, C=2*Math.PI*70; let off=0;
  let svg='<svg viewBox="0 0 200 200" width="160" height="160">';
  STATUSES.forEach(st=>{if(!counts[st.value])return; const p=counts[st.value]/total,dl=C*p,doff=C*off;
    svg+='<circle cx="100" cy="100" r="70" fill="none" stroke="'+st.color+'" stroke-width="24" stroke-dasharray="'+dl+' '+(C-dl)+'" stroke-dashoffset="-'+doff+'" transform="rotate(-90 100 100)" style="cursor:pointer" onclick="addCrossFilter(\'status\',\''+st.value+'\')"/>'; off+=p;});
  svg+='<text x="100" y="96" text-anchor="middle" font-size="24" font-weight="700" fill="var(--foreground)">'+total+'</text>';
  svg+='<text x="100" y="114" text-anchor="middle" font-size="11" fill="var(--muted-foreground)">sinistros</text></svg>';
  let leg='<div class="donut-legend">';
  STATUSES.forEach(st=>{if(!counts[st.value])return; leg+='<div class="donut-legend-item" onclick="addCrossFilter(\'status\',\''+st.value+'\')"><span class="donut-legend-dot" style="background:'+st.color+'"></span>'+st.value+'<span class="donut-legend-value">'+counts[st.value]+'</span></div>';});
  leg+='</div>';
  el.innerHTML=svg+leg;
}

function renderCausaBars(containerId, data) {
  const el=document.getElementById(containerId); if(!el)return;
  const counts={}; data.forEach(s=>{counts[s.causa]=(counts[s.causa]||0)+1;});
  const colors={ACIDENTE:'#3b82f6',AVARIA:'#eab308',ROUBO:'#ef4444'};
  const entries=Object.entries(counts).sort((a,b)=>b[1]-a[1]); const mx=entries.length?entries[0][1]:1;
  el.innerHTML=entries.map(e=>'<div class="bar-item" onclick="addCrossFilter(\'causa\',\''+e[0]+'\')"><span class="bar-label">'+e[0]+'</span><div class="bar-track"><div class="bar-fill" style="width:'+Math.round(e[1]/mx*100)+'%;background:'+(colors[e[0]]||'#3b82f6')+'">'+e[1]+'</div></div></div>').join('');
}

function renderOverviewCharts() {
  const c=document.getElementById('overview-content'); if(!c) return;
  let h='<div class="kpi-grid">';
  STATUSES.forEach(st=>{const cnt=SINISTROS.filter(s=>s.status===st.value).length; h+='<div class="kpi-card"><div class="kpi-label" style="color:'+st.color+'">'+st.value+'</div><div class="kpi-value">'+cnt+'</div></div>';});
  h+='</div>';
  h+='<div class="charts-grid"><div class="chart-card"><div class="chart-card-title">Por Status</div><div id="ov-donut" class="donut-container"></div></div>';
  h+='<div class="chart-card"><div class="chart-card-title">Por Causa</div><div id="ov-causa" class="bar-chart"></div></div></div>';
  h+='<div class="charts-grid"><div class="chart-card"><div class="chart-card-title">Por Seguradora</div><div id="ov-seg" class="bar-chart"></div></div>';
  h+='<div class="chart-card"><div class="chart-card-title">Top 5 — Maior Prejuizo</div><table class="mini-table"><thead><tr><th>ID</th><th>Segurado</th><th>Prejuizo</th></tr></thead><tbody>';
  SINISTROS.slice().sort((a,b)=>b.prejuizo-a.prejuizo).slice(0,5).forEach(s=>{h+='<tr><td style="color:var(--primary);font-weight:600">'+s.id+'</td><td>'+s.segurado.nome+'</td><td style="font-weight:600;color:#ef4444">'+formatCurrency(s.prejuizo)+'</td></tr>';});
  h+='</tbody></table></div></div>';
  c.innerHTML=h;
  renderStatusDonut('ov-donut',SINISTROS);
  renderCausaBars('ov-causa',SINISTROS);
  // Seguradora bars
  const segEl=document.getElementById('ov-seg'); if(segEl){const counts={};SINISTROS.forEach(s=>{const n=s.seguradora.razaoSocial;counts[n]=(counts[n]||0)+1;});const entries=Object.entries(counts).sort((a,b)=>b[1]-a[1]);const mx=entries[0]?entries[0][1]:1;
  segEl.innerHTML=entries.map(e=>'<div class="bar-item" onclick="addCrossFilter(\'seguradora\',\''+e[0]+'\')"><span class="bar-label">'+e[0]+'</span><div class="bar-track"><div class="bar-fill" style="width:'+Math.round(e[1]/mx*100)+'%;background:#8b5cf6">'+e[1]+'</div></div></div>').join('');}
}

function renderCorretorCharts() {
  const c=document.getElementById('corretor-content'); if(!c)return;
  let h='<div class="charts-grid"><div class="chart-card"><div class="chart-card-title">Sinistros por Corretor</div><div id="cor-bars" class="bar-chart"></div></div>';
  h+='<div class="chart-card"><div class="chart-card-title">Por Classificacao</div><div id="cor-class" class="bar-chart"></div></div></div>';
  h+='<div class="charts-grid"><div class="chart-card"><div class="chart-card-title">Top Mercadorias</div><div class="stat-list">';
  const mercCounts={}; SINISTROS.forEach(s=>{mercCounts[s.mercadoria]=(mercCounts[s.mercadoria]||0)+1;});
  Object.entries(mercCounts).sort((a,b)=>b[1]-a[1]).slice(0,5).forEach((e,i)=>{
    h+='<div class="stat-list-item"><span class="stat-rank">#'+(i+1)+'</span><span class="stat-name">'+e[0]+'</span><span class="stat-value">'+e[1]+'</span></div>';
  });
  h+='</div></div></div>';
  c.innerHTML=h;
  // Corretor bars
  const corEl=document.getElementById('cor-bars');if(corEl){const counts={};SINISTROS.forEach(s=>{const n=s.corretor.nome;counts[n]=(counts[n]||0)+1;});const entries=Object.entries(counts).sort((a,b)=>b[1]-a[1]);const mx=entries[0]?entries[0][1]:1;
  corEl.innerHTML=entries.map(e=>'<div class="bar-item" onclick="addCrossFilter(\'corretor\',\''+e[0]+'\')"><span class="bar-label">'+e[0]+'</span><div class="bar-track"><div class="bar-fill" style="width:'+Math.round(e[1]/mx*100)+'%;background:#3b82f6">'+e[1]+'</div></div></div>').join('');}
  // Classificacao bars
  const clsEl=document.getElementById('cor-class');if(clsEl){const counts={};SINISTROS.forEach(s=>{counts[s.classificacao]=(counts[s.classificacao]||0)+1;});const entries=Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,8);const mx=entries[0]?entries[0][1]:1;
  clsEl.innerHTML=entries.map(e=>'<div class="bar-item" onclick="addCrossFilter(\'classificacao\',\''+e[0]+'\')"><span class="bar-label">'+e[0]+'</span><div class="bar-track"><div class="bar-fill" style="width:'+Math.round(e[1]/mx*100)+'%;background:#f97316">'+e[1]+'</div></div></div>').join('');}
}

function renderSLACharts() {
  const c=document.getElementById('sla-tab-content'); if(!c)return;
  const ok=SINISTROS.filter(s=>s.sla==='ok').length, warn=SINISTROS.filter(s=>s.sla==='warning').length, viol=SINISTROS.filter(s=>s.sla==='violated').length;
  const pct=Math.round(ok/SINISTROS.length*100);
  let h='<div class="kpi-grid">';
  h+='<div class="kpi-card"><div class="kpi-label">⏱️ Compliance</div><div class="kpi-value kpi-trend-up">'+pct+'%</div></div>';
  h+='<div class="kpi-card"><div class="kpi-label">✅ Dentro do Prazo</div><div class="kpi-value" style="color:#22c55e">'+ok+'</div></div>';
  h+='<div class="kpi-card"><div class="kpi-label">🟡 Em Atencao</div><div class="kpi-value" style="color:#eab308">'+warn+'</div></div>';
  h+='<div class="kpi-card"><div class="kpi-label">🔴 Violados</div><div class="kpi-value" style="color:#ef4444">'+viol+'</div></div>';
  h+='</div>';
  h+='<div class="charts-grid"><div class="chart-card"><div class="chart-card-title">Tempo Medio por Prioridade</div><div class="bar-chart">';
  [{p:'Baixa',t:36,c:'#22c55e'},{p:'Media',t:18,c:'#eab308'},{p:'Alta',t:7,c:'#f97316'},{p:'Urgente',t:3,c:'#ef4444'}].forEach(x=>{
    h+='<div class="bar-item"><span class="bar-label">'+x.p+'</span><div class="bar-track"><div class="bar-fill" style="width:'+Math.round(x.t/48*100)+'%;background:'+x.c+'">'+x.t+'h</div></div></div>';
  });
  h+='</div></div>';
  h+='<div class="chart-card"><div class="chart-card-title">Heatmap: Prioridade x Status</div><div id="sla-heatmap"></div></div></div>';
  c.innerHTML=h;
  // Heatmap
  const hm=document.getElementById('sla-heatmap');if(hm){
    const matrix={};PRIORITIES.forEach(p=>{matrix[p.value]={};STATUSES.forEach(s=>{matrix[p.value][s.value]=0;});});
    SINISTROS.forEach(s=>{if(matrix[s.prioridade])matrix[s.prioridade][s.status]++;});
    let mx=0;PRIORITIES.forEach(p=>{STATUSES.forEach(s=>{if(matrix[p.value][s.value]>mx)mx=matrix[p.value][s.value];});});
    let g='<div class="heatmap-grid" style="grid-template-columns:100px repeat('+STATUSES.length+',1fr)">';
    g+='<div class="heatmap-cell heatmap-header"></div>';
    STATUSES.forEach(s=>{g+='<div class="heatmap-cell heatmap-header" style="font-size:10px">'+s.value+'</div>';});
    PRIORITIES.forEach(p=>{g+='<div class="heatmap-cell heatmap-label">'+p.value+'</div>';
      STATUSES.forEach(s=>{const v=matrix[p.value][s.value],int=mx>0?v/mx:0;
        g+='<div class="heatmap-cell" style="background:rgba(59,130,246,'+(0.1+int*0.8)+');color:'+(int>0.5?'#fff':'var(--foreground)')+'">'+v+'</div>';});});
    g+='</div>';hm.innerHTML=g;}
}

// ---------- NOTIFICATIONS ----------

function toggleNotifications() { document.getElementById('notif-popover').classList.toggle('open'); }

function renderNotifications() {
  const list=document.getElementById('notif-list');
  const badge=document.getElementById('notif-count');
  if(!list)return;
  const unread=notificationsData.filter(n=>!n.read).length;
  if(badge){badge.textContent=unread;badge.style.display=unread>0?'flex':'none';}
  if(!notificationsData.length){list.innerHTML='<div style="padding:32px;text-align:center;color:var(--muted-foreground)">Nenhuma notificacao</div>';return;}
  list.innerHTML=notificationsData.map(n=>
    '<div class="notif-item" onclick="markNotifRead(\''+n.id+'\')">'
    +'<div class="notif-item-icon" style="background:'+n.iconBg+'">'+n.icon+'</div>'
    +'<div class="notif-item-body"><div class="notif-item-title '+(n.read?'':'unread')+'">'+n.title+'</div>'
    +'<div class="notif-item-msg">'+n.message+'</div><div class="notif-item-time">'+n.time+'</div></div>'
    +'<div class="notif-item-actions">'+(n.read?'':'<span class="notif-dot"></span>')
    +'<button class="notif-close" onclick="event.stopPropagation();removeNotif(\''+n.id+'\')">✕</button></div></div>'
  ).join('');
}

function markNotifRead(id) { const n=notificationsData.find(x=>x.id===id);if(n)n.read=true;renderNotifications(); }
function markAllRead() { notificationsData.forEach(n=>{n.read=true;});renderNotifications(); }
function removeNotif(id) { notificationsData=notificationsData.filter(n=>n.id!==id);renderNotifications(); }
function clearNotifs() { notificationsData=[];renderNotifications(); }

// ---------- CADASTRO ----------

function renderCadastro(type) {
  const c=document.getElementById('cadastro-'+type); if(!c)return;
  let h='';
  if(type==='segurados'){h+='<table class="cadastro-table"><thead><tr><th>Nome</th><th>CNPJ</th><th>Cidade</th><th>Estado</th></tr></thead><tbody>';
    SEGURADOS.forEach(s=>{h+='<tr><td>'+s.nome+'</td><td>'+s.cnpj+'</td><td>'+s.cidade+'</td><td>'+s.estado+'</td></tr>';});h+='</tbody></table>';}
  else if(type==='seguradoras'){h+='<table class="cadastro-table"><thead><tr><th>Razao Social</th><th>CNPJ</th><th>E-mail</th></tr></thead><tbody>';
    SEGURADORAS.forEach(s=>{h+='<tr><td>'+s.razaoSocial+'</td><td>'+s.cnpj+'</td><td>'+s.email+'</td></tr>';});h+='</tbody></table>';}
  else if(type==='corretores'){h+='<table class="cadastro-table"><thead><tr><th>Nome</th><th>E-mail</th><th>Telefone</th></tr></thead><tbody>';
    CORRETORES.forEach(s=>{h+='<tr><td>'+s.nome+'</td><td>'+s.email+'</td><td>'+s.telefone+'</td></tr>';});h+='</tbody></table>';}
  else if(type==='transportadoras'){h+='<table class="cadastro-table"><thead><tr><th>Razao Social</th><th>CNPJ</th><th>RNTRC</th></tr></thead><tbody>';
    TRANSPORTADORAS.forEach(s=>{h+='<tr><td>'+s.razaoSocial+'</td><td>'+s.cnpj+'</td><td>'+s.rntrc+'</td></tr>';});h+='</tbody></table>';}
  else if(type==='reguladoras'){h+='<table class="cadastro-table"><thead><tr><th>Razao Social</th><th>CNPJ</th></tr></thead><tbody>';
    REGULADORAS.forEach(s=>{h+='<tr><td>'+s.razaoSocial+'</td><td>'+s.cnpj+'</td></tr>';});h+='</tbody></table>';}
  else if(type==='gerenciadoras'){h+='<table class="cadastro-table"><thead><tr><th>Razao Social</th><th>CNPJ</th></tr></thead><tbody>';
    GERENCIADORAS.forEach(s=>{h+='<tr><td>'+s.razaoSocial+'</td><td>'+s.cnpj+'</td></tr>';});h+='</tbody></table>';}
  c.innerHTML=h;
}

// ---------- USERS / ROLES / TAGS / SLA / SETTINGS ----------

function renderUsers() {
  const c=document.getElementById('users-content');if(!c)return;
  let h='<div class="kpi-grid">';
  h+='<div class="kpi-card"><div class="kpi-label">👥 Total</div><div class="kpi-value">'+USERS.length+'</div></div>';
  h+='<div class="kpi-card"><div class="kpi-label">✅ Ativos</div><div class="kpi-value kpi-trend-up">'+USERS.filter(u=>u.status==='Ativo').length+'</div></div>';
  h+='<div class="kpi-card"><div class="kpi-label">👔 Corretores</div><div class="kpi-value" style="color:#3b82f6">'+USERS.filter(u=>u.role==='Corretor').length+'</div></div>';
  h+='</div><div class="card-grid">';
  USERS.forEach(u=>{h+='<div class="user-card"><div class="user-avatar avatar-'+u.color+'">'+u.initials+'</div><div class="user-info"><div class="user-name">'+u.name+'</div><div class="user-email">'+u.email+'</div><div class="user-meta"><span class="badge badge-blue">'+u.role+'</span><span class="badge badge-gray">'+u.sinistros+' sinistros</span></div></div></div>';});
  h+='</div>';c.innerHTML=h;
}

function renderRoles() {
  const c=document.getElementById('roles-content');if(!c)return;
  let h='<div class="card-grid">';
  ROLES.forEach(r=>{h+='<div class="role-card"><div class="role-header"><span class="role-name">'+r.name+'</span></div><div class="role-perms">';
    r.permissions.forEach(p=>{h+='<span class="badge badge-gray" style="margin:2px">'+p+'</span>';});h+='</div></div>';});
  h+='</div>';c.innerHTML=h;
}

function renderTagsSection() {
  TAGS.forEach(t=>{t.count=SINISTROS.filter(s=>s.tags.includes(t.name)).length;});
  const c=document.getElementById('tags-content');if(!c)return;
  let h='<div class="tag-grid">';
  TAGS.forEach(t=>{h+='<div class="tag-card" onclick="addCrossFilter(\'tag\',\''+t.name+'\');showSection(\'sinistros\')"><span class="tag-dot" style="background:'+t.color+'"></span><span class="tag-name">'+t.name+'</span><span class="tag-count">'+t.count+'</span></div>';});
  h+='</div>';c.innerHTML=h;
}

function renderSLASection() {
  const c=document.getElementById('sla-content');if(!c)return;
  let h='<div class="card-grid">';
  SLA_POLICIES.forEach(p=>{h+='<div class="sla-card"><div class="sla-card-header"><span class="sla-card-name">'+p.name+'</span><span class="badge '+(p.active?'badge-green':'badge-gray')+'">'+(p.active?'Ativo':'Inativo')+'</span></div>';
    h+='<div class="sla-times">';Object.entries(p.tempos).forEach(([k,v])=>{const pr=getPriorityObj(k);h+='<div class="sla-time-item"><div class="sla-time-label" style="color:'+pr.color+'">'+k+'</div><div class="sla-time-value">'+v+'</div></div>';});
    h+='</div></div>';});
  h+='</div>';c.innerHTML=h;
}

function renderSettings() {
  const c=document.getElementById('settings-content');if(!c)return;
  let h='<div class="settings-grid">';
  h+='<div class="card"><div class="card-header"><div class="card-title">Informacoes do Tenant</div></div><div class="card-content">';
  h+='<div class="form-group mb-3"><label class="form-label">Nome da Empresa</label><input class="form-input" value="iOS Risk Seguros"></div>';
  h+='<div class="form-group mb-3"><label class="form-label">E-mail</label><input class="form-input" value="contato@iosrisk.com"></div>';
  h+='<div class="form-group"><label class="form-label">Fuso Horario</label><select class="form-select"><option>America/Sao_Paulo (BRT)</option></select></div>';
  h+='</div></div>';
  h+='<div class="card"><div class="card-header"><div class="card-title">Horario Comercial</div></div><div class="card-content">';
  h+='<div class="form-grid"><div class="form-group"><label class="form-label">Inicio</label><input type="time" class="form-input" value="08:00"></div>';
  h+='<div class="form-group"><label class="form-label">Fim</label><input type="time" class="form-input" value="18:00"></div></div>';
  h+='<div class="mt-2" style="font-size:12px;color:var(--muted-foreground)">Segunda a Sexta</div></div></div>';
  h+='<div class="card"><div class="card-header"><div class="card-title">Notificacoes</div></div><div class="card-content">';
  [['E-mail de alerta SLA',true],['Push no celular',true],['Resumo diario',false],['Novos sinistros',true],['Documentos pendentes',true]].forEach(([lbl,on])=>{
    h+='<div class="setting-row"><div><div class="setting-label">'+lbl+'</div></div><button class="toggle '+(on?'active':'')+'" onclick="this.classList.toggle(\'active\')"></button></div>';});
  h+='</div></div></div>';
  c.innerHTML=h;
}

// ---------- INIT ----------

document.addEventListener('DOMContentLoaded', () => {
  renderDashboardHome();
  renderTable();
  renderFilterBar();
  renderKanban();
  renderOverviewCharts();
  renderCorretorCharts();
  renderSLACharts();
  renderNotifications();
  renderUsers();
  renderRoles();
  renderTagsSection();
  renderSLASection();
  renderSettings();
  showSection('dashboard');
});
