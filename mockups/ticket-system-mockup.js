// ========================================
// CRM Builder - Ticket System Mockup JS
// ========================================

// ==================== MOCK DATA ====================
const USERS = [
  { id: 'u1', name: 'Usuario 1', initials: 'U1', email: 'usuario1@empresa.com', role: 'Administrador', roleType: 'ADMIN', color: 'avatar-1', tickets: 12, status: 'Ativo' },
  { id: 'u2', name: 'Usuario 2', initials: 'U2', email: 'usuario2@empresa.com', role: 'Gerente', roleType: 'MANAGER', color: 'avatar-2', tickets: 8, status: 'Ativo' },
  { id: 'u3', name: 'Usuario 3', initials: 'U3', email: 'usuario3@empresa.com', role: 'Desenvolvedor', roleType: 'CUSTOM', color: 'avatar-3', tickets: 15, status: 'Ativo' },
  { id: 'u4', name: 'Usuario 4', initials: 'U4', email: 'usuario4@empresa.com', role: 'Desenvolvedor', roleType: 'CUSTOM', color: 'avatar-4', tickets: 9, status: 'Ativo' },
  { id: 'u5', name: 'Usuario 5', initials: 'U5', email: 'usuario5@empresa.com', role: 'Visualizador', roleType: 'VIEWER', color: 'avatar-5', tickets: 3, status: 'Pendente' },
];

const PROJECTS = [
  { id: 'p1', name: 'Projeto Alpha', desc: 'Plataforma principal do produto', icon: '🚀', color: '#3b82f6', tickets: 18, progress: 65 },
  { id: 'p2', name: 'Projeto Beta', desc: 'Modulo de integracao com terceiros', icon: '🔗', color: '#8b5cf6', tickets: 15, progress: 40 },
  { id: 'p3', name: 'Projeto Gamma', desc: 'App mobile e sincronizacao offline', icon: '📱', color: '#22c55e', tickets: 14, progress: 25 },
];

const TAGS = [
  { name: 'Frontend', color: '#3b82f6', count: 12 },
  { name: 'Backend', color: '#22c55e', count: 15 },
  { name: 'API', color: '#8b5cf6', count: 8 },
  { name: 'Database', color: '#f59e0b', count: 6 },
  { name: 'UI/UX', color: '#ec4899', count: 9 },
  { name: 'DevOps', color: '#06b6d4', count: 4 },
  { name: 'Seguranca', color: '#ef4444', count: 5 },
  { name: 'Performance', color: '#f97316', count: 7 },
  { name: 'Mobile', color: '#14b8a6', count: 6 },
  { name: 'Docs', color: '#6366f1', count: 3 },
  { name: 'Testes', color: '#a855f7', count: 8 },
  { name: 'Infra', color: '#64748b', count: 4 },
];

const STATUSES = [
  { value: 'Aberto', color: '#3b82f6', badge: 'badge-blue' },
  { value: 'Em Progresso', color: '#eab308', badge: 'badge-yellow' },
  { value: 'Em Review', color: '#a855f7', badge: 'badge-purple' },
  { value: 'Concluido', color: '#22c55e', badge: 'badge-green' },
];

const PRIORITIES = [
  { value: 'Critica', color: '#ef4444', badge: 'badge-red' },
  { value: 'Alta', color: '#f97316', badge: 'badge-orange' },
  { value: 'Media', color: '#eab308', badge: 'badge-yellow' },
  { value: 'Baixa', color: '#22c55e', badge: 'badge-green' },
];

const TYPES = [
  { value: 'Bug', badge: 'badge-red', icon: '🐛' },
  { value: 'Feature', badge: 'badge-blue', icon: '✨' },
  { value: 'Melhoria', badge: 'badge-cyan', icon: '📈' },
  { value: 'Tarefa', badge: 'badge-gray', icon: '📋' },
];

const SLA_POLICIES = [
  { name: 'Padrao', active: true, hours: '08:00-18:00', days: 'Seg-Sex', times: { Critica: '4h', Alta: '8h', Media: '24h', Baixa: '48h' } },
  { name: 'Premium', active: true, hours: '00:00-23:59', days: 'Todos', times: { Critica: '1h', Alta: '4h', Media: '8h', Baixa: '24h' } },
  { name: 'Emergencia', active: true, hours: '00:00-23:59', days: 'Todos', times: { Critica: '30min', Alta: '2h', Media: '4h', Baixa: '8h' } },
  { name: 'Sem SLA', active: false, hours: '-', days: '-', times: { Critica: '-', Alta: '-', Media: '-', Baixa: '-' } },
];

// Generate 47 tickets
const TICKETS = [];
const ticketTitles = [
  'Corrigir erro de login no Safari','Implementar filtro avancado na listagem','Refatorar componente de upload','Otimizar queries do dashboard',
  'Adicionar suporte a exportacao CSV','Bug na paginacao da tabela','Implementar notificacoes push','Revisar permissoes de acesso',
  'Criar endpoint de relatorios','Melhorar performance do carregamento','Corrigir layout responsivo','Adicionar validacao de formulario',
  'Implementar cache de dados','Bug no calculo de SLA','Criar template de email','Adicionar log de auditoria',
  'Corrigir timezone nas datas','Implementar busca full-text','Otimizar bundle size','Adicionar testes unitarios',
  'Bug no upload de arquivos grandes','Implementar drag and drop','Criar dashboard de metricas','Revisar seguranca dos endpoints',
  'Adicionar suporte a dark mode','Corrigir memory leak no websocket','Implementar versionamento de API','Bug no filtro por data',
  'Criar documentacao da API','Melhorar UX do formulario','Adicionar autenticacao 2FA','Corrigir bug no mobile',
  'Implementar webhook de eventos','Otimizar consultas N+1','Adicionar internacionalizacao','Bug na sincronizacao offline',
  'Criar componente de grafico','Revisar indices do banco','Implementar rate limiting','Adicionar compressao de imagens',
  'Bug no envio de notificacoes','Criar workflow de aprovacao','Implementar backup automatico','Adicionar monitoramento',
  'Corrigir CSS do sidebar','Implementar importacao em lote','Otimizar renderizacao da tabela'
];
for (let i = 0; i < 47; i++) {
  const statusIdx = i < 8 ? 0 : i < 20 ? 1 : i < 28 ? 2 : 3;
  const priorityIdx = i % 4;
  const typeIdx = i % 4;
  const userIdx = i % 5;
  const projectIdx = i % 3;
  const tagCount = (i % 3) + 1;
  const ticketTags = TAGS.slice(i % TAGS.length, (i % TAGS.length) + tagCount).map(t => t.name);
  if (ticketTags.length === 0) ticketTags.push(TAGS[0].name);
  const slaStates = ['ok', 'ok', 'warning', 'violated'];
  const days = 15 - (i % 15);
  TICKETS.push({
    id: `TKT-${String(i + 1).padStart(3, '0')}`,
    title: ticketTitles[i % ticketTitles.length],
    status: STATUSES[statusIdx].value,
    priority: PRIORITIES[priorityIdx].value,
    type: TYPES[typeIdx].value,
    assignee: USERS[userIdx],
    project: PROJECTS[projectIdx].name,
    tags: ticketTags,
    sla: slaStates[i % 4],
    createdAt: `2025-03-${String(days).padStart(2, '0')}`,
    sprint: `Sprint ${Math.ceil((i + 1) / 10)}`,
    estimate: `${(i % 5) + 1}h`,
  });
}

const NOTIFICATIONS = [
  { id: 1, type: 'info', icon: '💬', title: 'Novo comentario', msg: 'Usuario 3 comentou em TKT-005', time: '2 min', unread: true, bg: 'rgba(59,130,246,0.15)' },
  { id: 2, type: 'success', icon: '✅', title: 'Ticket concluido', msg: 'TKT-031 foi marcado como concluido', time: '15 min', unread: true, bg: 'rgba(34,197,94,0.15)' },
  { id: 3, type: 'warning', icon: '⚠️', title: 'SLA proximo do limite', msg: 'TKT-012 tem 2h restantes no SLA', time: '30 min', unread: true, bg: 'rgba(234,179,8,0.15)' },
  { id: 4, type: 'error', icon: '🔴', title: 'SLA violado', msg: 'TKT-008 excedeu o tempo de SLA', time: '1h', unread: true, bg: 'rgba(239,68,68,0.15)' },
  { id: 5, type: 'info', icon: '👤', title: 'Ticket atribuido', msg: 'TKT-042 foi atribuido a voce', time: '2h', unread: false, bg: 'rgba(59,130,246,0.15)' },
  { id: 6, type: 'success', icon: '🔀', title: 'PR merged', msg: 'Pull request #47 foi mergeado', time: '3h', unread: false, bg: 'rgba(34,197,94,0.15)' },
  { id: 7, type: 'info', icon: '📎', title: 'Anexo adicionado', msg: 'Usuario 2 anexou arquivo em TKT-015', time: '5h', unread: false, bg: 'rgba(59,130,246,0.15)' },
  { id: 8, type: 'warning', icon: '🔄', title: 'Sprint finalizada', msg: 'Sprint 3 foi encerrada com 5 tickets pendentes', time: '1d', unread: false, bg: 'rgba(234,179,8,0.15)' },
];

const ROLES = [
  { name: 'Administrador', type: 'ADMIN', desc: 'Acesso total ao sistema', users: 1, color: 'badge-red', perms: ['Criar','Ler','Editar','Excluir','Exportar','Importar','Gerenciar Usuarios','Gerenciar Roles'] },
  { name: 'Gerente', type: 'MANAGER', desc: 'Gerencia equipes e dados', users: 1, color: 'badge-purple', perms: ['Criar','Ler','Editar','Excluir','Exportar'] },
  { name: 'Desenvolvedor', type: 'CUSTOM', desc: 'Acesso a tickets e projetos', users: 2, color: 'badge-blue', perms: ['Criar','Ler','Editar','Exportar'] },
  { name: 'Visualizador', type: 'VIEWER', desc: 'Apenas leitura', users: 1, color: 'badge-gray', perms: ['Ler'] },
];

// ==================== STATE ====================
let currentSection = 'dashboard';
let currentTicketTab = 'registros';
let currentTemplate = 0;
let tableCurrentPage = 1;
const TABLE_PAGE_SIZE = 8;
let tableSortCol = null;
let tableSortDir = 'asc';
let tableSearchTerm = '';
let crossFilters = [];
let selectedRows = new Set();
let notificationsData = [...NOTIFICATIONS];

// ==================== NAVIGATION ====================
function showSection(name) {
  currentSection = name;
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  const el = document.getElementById('section-' + name);
  if (el) el.classList.add('active');
  // Update sidebar active
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const navItem = document.querySelector(`.nav-item[data-section="${name}"]`);
  if (navItem) navItem.classList.add('active');
  // Close notification popover
  document.getElementById('notif-popover')?.classList.remove('show');
}

function toggleSection(el) {
  el.closest('.nav-section').classList.toggle('collapsed');
}

// ==================== TABS ====================
function switchTicketTab(tabId) {
  currentTicketTab = tabId;
  document.querySelectorAll('#section-tickets .tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('#section-tickets .tab-content').forEach(c => c.classList.remove('active'));
  document.querySelector(`#section-tickets .tab-btn[data-tab="${tabId}"]`)?.classList.add('active');
  document.getElementById('tab-' + tabId)?.classList.add('active');
  if (tabId === 'kanban') renderKanban();
}

function switchTemplate(idx) {
  currentTemplate = idx;
  document.querySelectorAll('.template-pill').forEach((p, i) => {
    p.classList.toggle('active', i === idx);
  });
}

// ==================== DATA TABLE ====================
function getFilteredTickets() {
  let filtered = [...TICKETS];
  // Search
  if (tableSearchTerm) {
    const term = tableSearchTerm.toLowerCase();
    filtered = filtered.filter(t =>
      t.id.toLowerCase().includes(term) ||
      t.title.toLowerCase().includes(term) ||
      t.assignee.name.toLowerCase().includes(term) ||
      t.project.toLowerCase().includes(term)
    );
  }
  // Cross filters
  crossFilters.forEach(f => {
    filtered = filtered.filter(t => {
      if (f.field === 'status') return t.status === f.value;
      if (f.field === 'priority') return t.priority === f.value;
      if (f.field === 'type') return t.type === f.value;
      if (f.field === 'assignee') return t.assignee.name === f.value;
      if (f.field === 'project') return t.project === f.value;
      if (f.field === 'tag') return t.tags.includes(f.value);
      return true;
    });
  });
  // Sort
  if (tableSortCol) {
    filtered.sort((a, b) => {
      let va = a[tableSortCol] || '';
      let vb = b[tableSortCol] || '';
      if (tableSortCol === 'assignee') { va = a.assignee.name; vb = b.assignee.name; }
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      if (va < vb) return tableSortDir === 'asc' ? -1 : 1;
      if (va > vb) return tableSortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }
  return filtered;
}

function renderTable() {
  const filtered = getFilteredTickets();
  const totalPages = Math.max(1, Math.ceil(filtered.length / TABLE_PAGE_SIZE));
  if (tableCurrentPage > totalPages) tableCurrentPage = totalPages;
  const start = (tableCurrentPage - 1) * TABLE_PAGE_SIZE;
  const pageData = filtered.slice(start, start + TABLE_PAGE_SIZE);

  const tbody = document.getElementById('ticket-tbody');
  if (!tbody) return;
  tbody.innerHTML = pageData.map(t => {
    const statusBadge = STATUSES.find(s => s.value === t.status);
    const priBadge = PRIORITIES.find(p => p.value === t.priority);
    const typeBadge = TYPES.find(tp => tp.value === t.type);
    const slaClass = t.sla === 'ok' ? 'badge-green' : t.sla === 'warning' ? 'badge-yellow' : 'badge-red';
    const slaText = t.sla === 'ok' ? 'OK' : t.sla === 'warning' ? 'Atencao' : 'Violado';
    const checked = selectedRows.has(t.id) ? 'checked' : '';
    return `<tr class="clickable-row" onclick="showDetail('${t.id}')">
      <td onclick="event.stopPropagation()"><input type="checkbox" class="checkbox" ${checked} onchange="toggleRow('${t.id}', this.checked)"></td>
      <td><span style="color: var(--primary); font-weight: 600">${t.id}</span></td>
      <td style="max-width:200px" title="${t.title}">${t.title}</td>
      <td><span class="badge ${statusBadge?.badge || ''}">${t.status}</span></td>
      <td><span class="badge ${priBadge?.badge || ''}"><span class="badge-dot" style="background:${priBadge?.color || ''}"></span> ${t.priority}</span></td>
      <td><span class="badge ${typeBadge?.badge || ''}">${t.type}</span></td>
      <td><span class="flex items-center gap-2"><span class="${t.assignee.color}" style="width:22px;height:22px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:600">${t.assignee.initials}</span> ${t.assignee.name}</span></td>
      <td>${t.project}</td>
      <td><span class="badge ${slaClass}">${slaText}</span></td>
      <td>${t.createdAt}</td>
    </tr>`;
  }).join('');

  // Footer
  const footer = document.getElementById('ticket-footer');
  if (footer) {
    const from = filtered.length > 0 ? start + 1 : 0;
    const to = Math.min(start + TABLE_PAGE_SIZE, filtered.length);
    footer.innerHTML = `
      <span>${from}-${to} de ${filtered.length} registros</span>
      <div class="pagination">
        <button class="page-btn" onclick="goToPage(1)" ${tableCurrentPage===1?'disabled':''}>&laquo;</button>
        <button class="page-btn" onclick="goToPage(${tableCurrentPage-1})" ${tableCurrentPage===1?'disabled':''}>&lsaquo;</button>
        ${Array.from({length: Math.min(5, totalPages)}, (_, i) => {
          let p = tableCurrentPage <= 3 ? i + 1 : tableCurrentPage + i - 2;
          if (p > totalPages) return '';
          if (p < 1) return '';
          return `<button class="page-btn ${p===tableCurrentPage?'active':''}" onclick="goToPage(${p})">${p}</button>`;
        }).join('')}
        <button class="page-btn" onclick="goToPage(${tableCurrentPage+1})" ${tableCurrentPage>=totalPages?'disabled':''}>&rsaquo;</button>
        <button class="page-btn" onclick="goToPage(${totalPages})" ${tableCurrentPage>=totalPages?'disabled':''}>&raquo;</button>
      </div>
    `;
  }

  // Record count in filter bar
  const rc = document.getElementById('record-count');
  if (rc) rc.textContent = `${filtered.length} de ${TICKETS.length} registros`;

  // Select all checkbox
  const selectAll = document.getElementById('select-all');
  if (selectAll) selectAll.checked = pageData.length > 0 && pageData.every(t => selectedRows.has(t.id));
}

function searchTable(term) {
  tableSearchTerm = term;
  tableCurrentPage = 1;
  renderTable();
}

function sortTable(col) {
  if (tableSortCol === col) {
    if (tableSortDir === 'asc') tableSortDir = 'desc';
    else if (tableSortDir === 'desc') { tableSortCol = null; tableSortDir = 'asc'; }
  } else {
    tableSortCol = col;
    tableSortDir = 'asc';
  }
  // Update sort indicators
  document.querySelectorAll('.data-table th .sort-indicator').forEach(s => s.textContent = '');
  if (tableSortCol) {
    const th = document.querySelector(`.data-table th[data-col="${tableSortCol}"] .sort-indicator`);
    if (th) th.textContent = tableSortDir === 'asc' ? '▲' : '▼';
  }
  renderTable();
}

function goToPage(p) {
  const filtered = getFilteredTickets();
  const totalPages = Math.max(1, Math.ceil(filtered.length / TABLE_PAGE_SIZE));
  if (p < 1 || p > totalPages) return;
  tableCurrentPage = p;
  renderTable();
}

function toggleRow(id, checked) {
  if (checked) selectedRows.add(id); else selectedRows.delete(id);
  renderTable();
}

function toggleSelectAll(checked) {
  const filtered = getFilteredTickets();
  const start = (tableCurrentPage - 1) * TABLE_PAGE_SIZE;
  const pageData = filtered.slice(start, start + TABLE_PAGE_SIZE);
  pageData.forEach(t => { if (checked) selectedRows.add(t.id); else selectedRows.delete(t.id); });
  renderTable();
}

// ==================== CROSS FILTER ====================
function addCrossFilter(field, value) {
  const exists = crossFilters.find(f => f.field === field && f.value === value);
  if (exists) {
    removeCrossFilter(field, value);
    return;
  }
  crossFilters.push({ field, value });
  tableCurrentPage = 1;
  renderFilterBar();
  renderTable();
  renderOverviewCharts();
}

function removeCrossFilter(field, value) {
  crossFilters = crossFilters.filter(f => !(f.field === field && f.value === value));
  renderFilterBar();
  renderTable();
  renderOverviewCharts();
}

function clearAllFilters() {
  crossFilters = [];
  tableSearchTerm = '';
  tableCurrentPage = 1;
  const searchInput = document.getElementById('table-search');
  if (searchInput) searchInput.value = '';
  renderFilterBar();
  renderTable();
  renderOverviewCharts();
}

function renderFilterBar() {
  const container = document.getElementById('filter-badges');
  if (!container) return;
  container.innerHTML = crossFilters.map(f =>
    `<span class="filter-badge">${f.field}: ${f.value} <button class="remove" onclick="removeCrossFilter('${f.field}','${f.value}')">&times;</button></span>`
  ).join('');
  const clearBtn = document.getElementById('filter-clear-btn');
  if (clearBtn) clearBtn.style.display = crossFilters.length > 0 ? 'flex' : 'none';
  const filterCount = document.getElementById('filter-count');
  if (filterCount) filterCount.textContent = crossFilters.length > 0 ? `Filtros (${crossFilters.length})` : 'Filtros';
}

// ==================== KANBAN ====================
function renderKanban() {
  const board = document.getElementById('kanban-board');
  if (!board) return;
  const filtered = getFilteredTickets();

  const columns = [
    { status: 'Aberto', color: '#3b82f6', wip: 10 },
    { status: 'Em Progresso', color: '#eab308', wip: 6 },
    { status: 'Em Review', color: '#a855f7', wip: 5 },
    { status: 'Concluido', color: '#22c55e', wip: 999 },
  ];

  board.innerHTML = columns.map(col => {
    const cards = filtered.filter(t => t.status === col.status);
    const exceeded = cards.length > col.wip;
    return `<div class="kanban-column ${exceeded ? 'wip-exceeded' : ''}" data-status="${col.status}"
      ondragover="kanbanDragOver(event)" ondragleave="kanbanDragLeave(event)" ondrop="kanbanDrop(event)">
      <div class="kanban-col-header">
        <span class="kanban-col-dot" style="background:${col.color}"></span>
        <span class="kanban-col-name">${col.status}</span>
        <span class="kanban-col-count">${cards.length}</span>
        <button class="kanban-col-add" title="Adicionar">+</button>
      </div>
      <div class="kanban-cards">
        ${cards.map(t => renderKanbanCard(t)).join('')}
      </div>
    </div>`;
  }).join('');
}

function renderKanbanCard(t) {
  const priBadge = PRIORITIES.find(p => p.value === t.priority);
  const typeBadge = TYPES.find(tp => tp.value === t.type);
  const slaColor = t.sla === 'ok' ? '#22c55e' : t.sla === 'warning' ? '#eab308' : '#ef4444';
  const slaText = t.sla === 'ok' ? 'OK' : t.sla === 'warning' ? 'Atencao' : 'Violado';
  return `<div class="kanban-card" draggable="true" data-ticket-id="${t.id}"
    ondragstart="kanbanDragStart(event)" ondragend="kanbanDragEnd(event)" onclick="showDetail('${t.id}')">
    <div class="kanban-card-id">${t.id}</div>
    <div class="kanban-card-title">${t.title}</div>
    <div class="kanban-card-badges">
      <span class="badge ${typeBadge?.badge || ''}">${t.type}</span>
      <span class="badge ${priBadge?.badge || ''}"><span class="badge-dot" style="background:${priBadge?.color}"></span> ${t.priority}</span>
    </div>
    <div class="kanban-card-tags">${t.tags.map(tg => `<span class="kanban-card-tag">${tg}</span>`).join('')}</div>
    <div class="kanban-card-footer">
      <span class="kanban-card-avatar ${t.assignee.color}">${t.assignee.initials}</span>
      <span class="kanban-card-sla"><span class="sla-dot" style="background:${slaColor}"></span> ${slaText}</span>
    </div>
  </div>`;
}

function kanbanDragStart(e) {
  e.target.classList.add('dragging');
  e.dataTransfer.setData('text/plain', e.target.dataset.ticketId);
  e.dataTransfer.effectAllowed = 'move';
}
function kanbanDragEnd(e) { e.target.classList.remove('dragging'); }
function kanbanDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const col = e.target.closest('.kanban-column');
  if (col) col.classList.add('drag-over');
}
function kanbanDragLeave(e) {
  const col = e.target.closest('.kanban-column');
  if (col) col.classList.remove('drag-over');
}
function kanbanDrop(e) {
  e.preventDefault();
  const col = e.target.closest('.kanban-column');
  if (!col) return;
  col.classList.remove('drag-over');
  const ticketId = e.dataTransfer.getData('text/plain');
  const newStatus = col.dataset.status;
  const ticket = TICKETS.find(t => t.id === ticketId);
  if (ticket && ticket.status !== newStatus) {
    ticket.status = newStatus;
    renderKanban();
    renderTable();
    renderOverviewCharts();
  }
}

// ==================== DETAIL VIEW ====================
function showDetail(ticketId) {
  const t = TICKETS.find(tk => tk.id === ticketId);
  if (!t) return;
  const container = document.getElementById('detail-content');
  if (!container) return;

  const statusBadge = STATUSES.find(s => s.value === t.status);
  const priBadge = PRIORITIES.find(p => p.value === t.priority);
  const slaColor = t.sla === 'ok' ? '#22c55e' : t.sla === 'warning' ? '#eab308' : '#ef4444';
  const slaText = t.sla === 'ok' ? 'Dentro do prazo' : t.sla === 'warning' ? 'Proximo do limite' : 'SLA Violado';
  const slaTime = t.sla === 'ok' ? '06:42:15' : t.sla === 'warning' ? '01:58:30' : '-02:15:00';

  container.innerHTML = `
    <div class="detail-layout">
      <div class="detail-main">
        <div class="detail-header">
          <div class="detail-header-info">
            <div class="detail-id">${t.id}</div>
            <div class="detail-title">${t.title}</div>
            <div class="detail-meta">
              <span class="badge ${statusBadge?.badge || ''}">${t.status}</span>
              <span class="badge ${priBadge?.badge || ''}">${t.priority}</span>
              <span class="text-sm text-muted">Criado por ${t.assignee.name} em ${t.createdAt}</span>
            </div>
          </div>
        </div>

        <div class="detail-section">
          <div class="detail-section-title">📝 Descricao</div>
          <div class="detail-description">
            Este ticket trata de: ${t.title.toLowerCase()}. O problema foi identificado durante a sprint ${t.sprint} e afeta o modulo do ${t.project}. A solucao deve considerar as melhores praticas de desenvolvimento e seguir os padroes do projeto.
          </div>
        </div>

        <div class="detail-section">
          <div class="detail-section-title">📎 Sub-registros <span class="badge badge-gray">3/5</span></div>
          <div class="mini-table">
            <table class="w-full" style="border-collapse:collapse">
              <tr><td style="padding:6px 0;font-size:12px"><span class="badge badge-green">✓</span> Analise inicial</td></tr>
              <tr><td style="padding:6px 0;font-size:12px"><span class="badge badge-green">✓</span> Implementacao do fix</td></tr>
              <tr><td style="padding:6px 0;font-size:12px"><span class="badge badge-green">✓</span> Code review</td></tr>
              <tr><td style="padding:6px 0;font-size:12px"><span class="badge badge-yellow">○</span> Testes de regressao</td></tr>
              <tr><td style="padding:6px 0;font-size:12px"><span class="badge badge-gray">○</span> Deploy em staging</td></tr>
            </table>
          </div>
          <div class="progress-bar-container mt-2">
            <div class="progress-bar-fill" style="width:60%;background:#22c55e"></div>
          </div>
        </div>

        <div class="detail-section">
          <div class="detail-section-title">💬 Comentarios <span class="badge badge-gray">3</span></div>
          <div class="comment">
            <span class="comment-avatar avatar-3">U3</span>
            <div class="comment-body">
              <div class="comment-header"><span class="comment-author">Usuario 3</span><span class="comment-time">2h atras</span></div>
              <div class="comment-text">Ja identifiquei a causa raiz. Vou enviar o PR hoje.</div>
            </div>
          </div>
          <div class="comment">
            <span class="comment-avatar avatar-2">U2</span>
            <div class="comment-body">
              <div class="comment-header"><span class="comment-author">Usuario 2</span><span class="comment-time">5h atras</span></div>
              <div class="comment-text">Precisamos resolver isso antes do final da sprint. Qual e a estimativa?</div>
            </div>
          </div>
          <div class="comment">
            <span class="comment-avatar avatar-1">U1</span>
            <div class="comment-body">
              <div class="comment-header"><span class="comment-author">Usuario 1</span><span class="comment-time">1d atras</span></div>
              <div class="comment-text">Ticket criado a partir do report do cliente. Prioridade alta.</div>
            </div>
          </div>
        </div>

        <div class="detail-section">
          <div class="detail-section-title">📋 Historico</div>
          <div class="timeline-item"><span class="timeline-dot" style="background:#22c55e"></span><span class="timeline-text"><strong>Usuario 3</strong> moveu de "Aberto" para "${t.status}" — 2h atras</span></div>
          <div class="timeline-item"><span class="timeline-dot" style="background:#3b82f6"></span><span class="timeline-text"><strong>Usuario 2</strong> atribuiu a <strong>${t.assignee.name}</strong> — 5h atras</span></div>
          <div class="timeline-item"><span class="timeline-dot" style="background:#a855f7"></span><span class="timeline-text"><strong>Usuario 1</strong> definiu prioridade como <strong>${t.priority}</strong> — 1d atras</span></div>
          <div class="timeline-item"><span class="timeline-dot" style="background:var(--border)"></span><span class="timeline-text"><strong>Usuario 1</strong> criou o ticket — ${t.createdAt}</span></div>
        </div>
      </div>

      <div class="detail-sidebar">
        <div class="card">
          <div class="card-header"><h3>Propriedades</h3></div>
          <div class="card-content">
            <div class="prop-list">
              <div class="prop-item"><span class="prop-label">Status</span><span class="badge ${statusBadge?.badge || ''}">${t.status}</span></div>
              <div class="prop-item"><span class="prop-label">Prioridade</span><span class="badge ${priBadge?.badge || ''}">${t.priority}</span></div>
              <div class="prop-item"><span class="prop-label">Tipo</span><span class="prop-value">${t.type}</span></div>
              <div class="prop-item"><span class="prop-label">Responsavel</span><span class="prop-value flex items-center gap-2"><span class="kanban-card-avatar ${t.assignee.color}">${t.assignee.initials}</span> ${t.assignee.name}</span></div>
              <div class="prop-item"><span class="prop-label">Projeto</span><span class="prop-value">${t.project}</span></div>
              <div class="prop-item"><span class="prop-label">Sprint</span><span class="prop-value">${t.sprint}</span></div>
              <div class="prop-item"><span class="prop-label">Estimativa</span><span class="prop-value">${t.estimate}</span></div>
              <div class="prop-item"><span class="prop-label">Criado em</span><span class="prop-value">${t.createdAt}</span></div>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><h3>SLA</h3></div>
          <div class="card-content">
            <div class="sla-timer">
              <div class="sla-timer-value" style="color:${slaColor}">${slaTime}</div>
              <div class="sla-timer-label">${slaText}</div>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><h3>Tags</h3></div>
          <div class="card-content">
            <div class="flex gap-2" style="flex-wrap:wrap">
              ${t.tags.map(tg => {
                const tag = TAGS.find(x => x.name === tg);
                return `<span class="badge" style="background:${tag ? tag.color + '22' : 'var(--secondary)'};color:${tag ? tag.color : 'inherit'}">${tg}</span>`;
              }).join('')}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  showSection('detail');
}

// ==================== OVERVIEW CHARTS ====================
function renderOverviewCharts() {
  const filtered = getFilteredTickets();
  renderStatusDonut(filtered);
  renderPriorityBar(filtered);
  renderMemberBar(filtered);
  renderSLAKpis(filtered);
  renderHeatmap(filtered);
}

function renderStatusDonut(data) {
  const container = document.getElementById('chart-status-donut');
  if (!container) return;
  const counts = {};
  STATUSES.forEach(s => counts[s.value] = 0);
  data.forEach(t => counts[t.status] = (counts[t.status] || 0) + 1);
  const total = data.length || 1;
  let offset = 0;
  const segments = STATUSES.map(s => {
    const pct = (counts[s.value] / total) * 100;
    const seg = { ...s, count: counts[s.value], pct, offset };
    offset += pct;
    return seg;
  });

  const r = 60, cx = 90, cy = 90;
  const circumference = 2 * Math.PI * r;
  container.innerHTML = `<svg width="180" height="180" viewBox="0 0 180 180">
    ${segments.map(s => {
      const dashLen = (s.pct / 100) * circumference;
      const dashOffset = -((s.offset / 100) * circumference);
      const isCrossFiltered = crossFilters.some(f => f.field === 'status') && !crossFilters.some(f => f.field === 'status' && f.value === s.value);
      return `<circle class="donut-segment ${isCrossFiltered ? 'cross-filtered' : ''}" cx="${cx}" cy="${cy}" r="${r}"
        fill="none" stroke="${s.color}" stroke-width="20"
        stroke-dasharray="${dashLen} ${circumference - dashLen}"
        stroke-dashoffset="${dashOffset}"
        transform="rotate(-90 ${cx} ${cy})"
        onclick="addCrossFilter('status','${s.value}')"/>`;
    }).join('')}
    <text x="${cx}" y="${cy - 6}" text-anchor="middle" fill="var(--foreground)" font-size="20" font-weight="700">${total}</text>
    <text x="${cx}" y="${cy + 12}" text-anchor="middle" fill="var(--muted-foreground)" font-size="11">Total</text>
  </svg>
  <div style="margin-top:8px">${segments.map(s => `<div style="display:flex;align-items:center;gap:6px;font-size:12px;margin:4px 0;cursor:pointer" onclick="addCrossFilter('status','${s.value}')"><span style="width:8px;height:8px;border-radius:2px;background:${s.color}"></span>${s.value}: ${s.count}</div>`).join('')}</div>`;
}

function renderPriorityBar(data) {
  const container = document.getElementById('chart-priority-bar');
  if (!container) return;
  const counts = {};
  PRIORITIES.forEach(p => counts[p.value] = 0);
  data.forEach(t => counts[t.priority] = (counts[t.priority] || 0) + 1);
  const maxVal = Math.max(...Object.values(counts), 1);

  container.innerHTML = PRIORITIES.map(p => {
    const w = (counts[p.value] / maxVal) * 100;
    const isCF = crossFilters.some(f => f.field === 'priority') && !crossFilters.some(f => f.field === 'priority' && f.value === p.value);
    return `<div class="stat-list-item bar-segment ${isCF ? 'cross-filtered' : ''}" onclick="addCrossFilter('priority','${p.value}')" style="cursor:pointer">
      <span class="stat-list-label">${p.value}</span>
      <div class="stat-bar-bg"><div class="stat-bar-fill" style="width:${w}%;background:${p.color}"></div></div>
      <span class="stat-list-value">${counts[p.value]}</span>
    </div>`;
  }).join('');
}

function renderMemberBar(data) {
  const container = document.getElementById('chart-member-bar');
  if (!container) return;
  const counts = {};
  USERS.forEach(u => counts[u.name] = 0);
  data.forEach(t => counts[t.assignee.name] = (counts[t.assignee.name] || 0) + 1);
  const maxVal = Math.max(...Object.values(counts), 1);

  container.innerHTML = USERS.map(u => {
    const w = (counts[u.name] / maxVal) * 100;
    const isCF = crossFilters.some(f => f.field === 'assignee') && !crossFilters.some(f => f.field === 'assignee' && f.value === u.name);
    return `<div class="stat-list-item bar-segment ${isCF ? 'cross-filtered' : ''}" onclick="addCrossFilter('assignee','${u.name}')" style="cursor:pointer">
      <span class="stat-list-label">${u.initials}</span>
      <div class="stat-bar-bg"><div class="stat-bar-fill" style="width:${w}%;background:${u.color.includes('1') ? '#3b82f6' : u.color.includes('2') ? '#a855f7' : u.color.includes('3') ? '#22c55e' : u.color.includes('4') ? '#f97316' : '#ec4899'}"></div></div>
      <span class="stat-list-value">${counts[u.name]}</span>
    </div>`;
  }).join('');
}

function renderSLAKpis(data) {
  const container = document.getElementById('sla-kpis');
  if (!container) return;
  const total = data.length || 1;
  const ok = data.filter(t => t.sla === 'ok').length;
  const warning = data.filter(t => t.sla === 'warning').length;
  const violated = data.filter(t => t.sla === 'violated').length;
  const compliance = Math.round((ok / total) * 100);
  container.innerHTML = `
    <div class="kpi-card"><div class="kpi-label">Compliance SLA</div><div class="kpi-value" style="color:#22c55e">${compliance}%</div></div>
    <div class="kpi-card"><div class="kpi-label">Dentro do Prazo</div><div class="kpi-value">${ok}</div></div>
    <div class="kpi-card"><div class="kpi-label">⚠️ Atencao</div><div class="kpi-value" style="color:#eab308">${warning}</div></div>
    <div class="kpi-card"><div class="kpi-label">🔴 Violados</div><div class="kpi-value" style="color:#ef4444">${violated}</div></div>
  `;
}

function renderHeatmap(data) {
  const container = document.getElementById('chart-heatmap');
  if (!container) return;
  const grid = {};
  PRIORITIES.forEach(p => { grid[p.value] = {}; STATUSES.forEach(s => { grid[p.value][s.value] = 0; }); });
  data.forEach(t => { if (grid[t.priority]) grid[t.priority][t.status] = (grid[t.priority][t.status] || 0) + 1; });
  const maxVal = Math.max(...Object.values(grid).flatMap(r => Object.values(r)), 1);

  container.innerHTML = `<div class="heatmap-grid" style="grid-template-columns: 100px repeat(${STATUSES.length}, 1fr)">
    <div class="heatmap-header"></div>
    ${STATUSES.map(s => `<div class="heatmap-header">${s.value}</div>`).join('')}
    ${PRIORITIES.map(p => `
      <div class="heatmap-header" style="text-align:left">${p.value}</div>
      ${STATUSES.map(s => {
        const val = grid[p.value][s.value];
        const intensity = val / maxVal;
        const bg = `rgba(59,130,246,${0.1 + intensity * 0.6})`;
        return `<div class="heatmap-cell" style="background:${bg}" onclick="addCrossFilter('priority','${p.value}')">${val}</div>`;
      }).join('')}
    `).join('')}
  </div>`;
}

// ==================== NOTIFICATIONS ====================
function toggleNotifications() {
  const popover = document.getElementById('notif-popover');
  if (popover) popover.classList.toggle('show');
}

function renderNotifications() {
  const list = document.getElementById('notif-list');
  if (!list) return;
  list.innerHTML = notificationsData.map(n => `
    <div class="notif-item ${n.unread ? 'unread' : ''}" onclick="markNotifRead(${n.id})">
      <span class="notif-icon" style="background:${n.bg}">${n.icon}</span>
      <div class="notif-body">
        <div class="notif-title">${n.title}</div>
        <div class="notif-message">${n.msg}</div>
        <div class="notif-time">${n.time} atras</div>
      </div>
      ${n.unread ? '<span class="notif-unread-dot"></span>' : ''}
      <button class="notif-close" onclick="event.stopPropagation();removeNotif(${n.id})">&times;</button>
    </div>
  `).join('');
  // Update bell badge
  const unreadCount = notificationsData.filter(n => n.unread).length;
  const badge = document.getElementById('notif-badge');
  if (badge) { badge.textContent = unreadCount; badge.style.display = unreadCount > 0 ? 'flex' : 'none'; }
  const dot = document.getElementById('notif-dot');
  if (dot) dot.style.display = unreadCount > 0 ? 'block' : 'none';
}

function markNotifRead(id) {
  const n = notificationsData.find(x => x.id === id);
  if (n) n.unread = false;
  renderNotifications();
}

function markAllRead() {
  notificationsData.forEach(n => n.unread = false);
  renderNotifications();
}

function removeNotif(id) {
  notificationsData = notificationsData.filter(n => n.id !== id);
  renderNotifications();
}

function clearNotifs() {
  notificationsData = [];
  renderNotifications();
}

// ==================== DIALOGS ====================
function openDialog(id) {
  document.getElementById(id)?.classList.add('show');
}
function closeDialog(id) {
  document.getElementById(id)?.classList.remove('show');
}

// ==================== ROLES ====================
function toggleRoleDetails(el) {
  el.closest('.role-card').classList.toggle('expanded');
}

function renderRoles() {
  const container = document.getElementById('roles-list');
  if (!container) return;
  container.innerHTML = ROLES.map(r => `
    <div class="role-card">
      <div class="role-card-header" onclick="toggleRoleDetails(this)">
        <div style="flex:1">
          <div class="flex items-center gap-2 mb-2">
            <span class="role-name">${r.name}</span>
            <span class="badge ${r.color}">${r.type}</span>
          </div>
          <div class="role-desc">${r.desc}</div>
        </div>
        <span class="badge badge-gray">${r.users} usuario${r.users > 1 ? 's' : ''}</span>
        <span class="text-muted" style="font-size:12px">▼</span>
      </div>
      <div class="role-details">
        <div class="perm-grid">
          ${['Criar','Ler','Editar','Excluir','Exportar','Importar','Gerenciar Usuarios','Gerenciar Roles'].map(p =>
            `<div class="perm-item"><span class="${r.perms.includes(p) ? 'perm-check' : 'perm-cross'}">${r.perms.includes(p) ? '✓' : '✗'}</span> ${p}</div>`
          ).join('')}
        </div>
      </div>
    </div>
  `).join('');
}

// ==================== PROJECTS ====================
function renderProjects() {
  const container = document.getElementById('projects-grid');
  if (!container) return;
  container.innerHTML = PROJECTS.map(p => {
    const inProgress = Math.round(p.tickets * (1 - p.progress / 100));
    return `<div class="project-card" onclick="addCrossFilter('project','${p.name}');showSection('tickets')">
      <div class="project-icon" style="background:${p.color}22;color:${p.color}">${p.icon}</div>
      <div class="project-name">${p.name}</div>
      <div class="project-desc">${p.desc}</div>
      <div class="project-stats">
        <span class="project-stat">📋 ${p.tickets} tickets</span>
        <span class="project-stat">🔄 ${inProgress} em progresso</span>
      </div>
      <div class="project-progress mt-2">
        <div class="project-progress-label"><span>Progresso</span><span>${p.progress}%</span></div>
        <div class="progress-bar-container"><div class="progress-bar-fill" style="width:${p.progress}%;background:${p.color}"></div></div>
      </div>
    </div>`;
  }).join('');
}

// ==================== USERS ====================
function renderUsers() {
  const container = document.getElementById('users-list');
  if (!container) return;
  container.innerHTML = USERS.map(u => {
    const roleBadge = u.roleType === 'ADMIN' ? 'badge-red' : u.roleType === 'MANAGER' ? 'badge-purple' : u.roleType === 'CUSTOM' ? 'badge-blue' : 'badge-gray';
    return `<div class="user-card">
      <span class="user-avatar ${u.color}">${u.initials}</span>
      <div class="user-info">
        <div class="user-name">${u.name}</div>
        <div class="user-email">${u.email}</div>
      </div>
      <div class="user-meta">
        <span class="badge ${roleBadge}">${u.role}</span>
        <span class="badge badge-gray">${u.tickets} tickets</span>
        <span class="badge ${u.status === 'Ativo' ? 'badge-green' : 'badge-yellow'}">${u.status}</span>
      </div>
    </div>`;
  }).join('');
}

// ==================== TAGS ====================
function renderTags() {
  const container = document.getElementById('tags-grid');
  if (!container) return;
  container.innerHTML = TAGS.map(t => `
    <div class="tag-card" onclick="addCrossFilter('tag','${t.name}');showSection('tickets')">
      <span class="tag-color" style="background:${t.color}"></span>
      <span class="tag-name">${t.name}</span>
      <span class="tag-count">${t.count}</span>
    </div>
  `).join('');
}

// ==================== SLA ====================
function renderSLAPolicies() {
  const container = document.getElementById('sla-list');
  if (!container) return;
  container.innerHTML = SLA_POLICIES.map(p => `
    <div class="sla-card">
      <div class="flex items-center justify-between mb-3">
        <div>
          <div class="font-semibold">${p.name}</div>
          <div class="text-sm text-muted mt-2">${p.hours} · ${p.days}</div>
        </div>
        <span class="badge ${p.active ? 'badge-green' : 'badge-gray'}">${p.active ? 'Ativo' : 'Inativo'}</span>
      </div>
      <div class="sla-grid">
        ${Object.entries(p.times).map(([pri, time]) => `
          <div class="sla-cell">
            <div class="sla-cell-label">${pri}</div>
            <div class="sla-cell-value">${time}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
}

// ==================== SETTINGS ====================
function toggleSetting(el) {
  el.classList.toggle('active');
}

// ==================== DASHBOARD HOME CHARTS ====================
function renderDashboardHome() {
  // Area chart - SVG
  const areaChart = document.getElementById('dash-area-chart');
  if (areaChart) {
    const points = [5,8,12,7,15,20,18,25,22,30,28,35,32,40,38,42,45,40,38,35,30,28,32,35,38,40,42,45,47,44];
    const w = 500, h = 120, maxV = Math.max(...points);
    const coords = points.map((v, i) => `${(i / (points.length - 1)) * w},${h - (v / maxV) * h}`);
    areaChart.innerHTML = `<svg width="100%" height="${h + 20}" viewBox="0 0 ${w} ${h + 20}" preserveAspectRatio="none">
      <defs><linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#3b82f6" stop-opacity="0.3"/><stop offset="100%" stop-color="#3b82f6" stop-opacity="0"/></linearGradient></defs>
      <polygon points="0,${h + 20} ${coords.join(' ')} ${w},${h + 20}" fill="url(#areaGrad)"/>
      <polyline points="${coords.join(' ')}" fill="none" stroke="#3b82f6" stroke-width="2"/>
    </svg>`;
  }
  // Bar chart - entities
  const barChart = document.getElementById('dash-bar-chart');
  if (barChart) {
    const data = PROJECTS.map(p => ({ name: p.name, value: p.tickets, color: p.color }));
    const maxVal = Math.max(...data.map(d => d.value), 1);
    barChart.innerHTML = data.map(d => `
      <div class="stat-list-item" style="cursor:pointer" onclick="addCrossFilter('project','${d.name}');showSection('tickets')">
        <span class="stat-list-label">${d.name}</span>
        <div class="stat-bar-bg"><div class="stat-bar-fill" style="width:${(d.value/maxVal)*100}%;background:${d.color}"></div></div>
        <span class="stat-list-value">${d.value}</span>
      </div>
    `).join('');
  }
  // Activity feed
  const activityFeed = document.getElementById('dash-activity');
  if (activityFeed) {
    const activities = [
      { icon: '✅', bg: 'rgba(34,197,94,0.15)', text: '<strong>Usuario 3</strong> concluiu TKT-031', time: '15 min' },
      { icon: '💬', bg: 'rgba(59,130,246,0.15)', text: '<strong>Usuario 2</strong> comentou em TKT-005', time: '30 min' },
      { icon: '🔄', bg: 'rgba(168,85,247,0.15)', text: '<strong>Usuario 4</strong> moveu TKT-018 para Review', time: '1h' },
      { icon: '🐛', bg: 'rgba(239,68,68,0.15)', text: '<strong>Usuario 1</strong> criou bug TKT-047', time: '2h' },
      { icon: '📎', bg: 'rgba(249,115,22,0.15)', text: '<strong>Usuario 5</strong> anexou arquivo em TKT-022', time: '3h' },
    ];
    activityFeed.innerHTML = activities.map(a => `
      <div class="activity-item">
        <span class="activity-icon" style="background:${a.bg}">${a.icon}</span>
        <span class="activity-text">${a.text}</span>
        <span class="activity-time">${a.time}</span>
      </div>
    `).join('');
  }
}

// ==================== LINE CHART (Velocity) ====================
function renderVelocityChart() {
  const container = document.getElementById('chart-velocity');
  if (!container) return;
  const weeks = ['S1','S2','S3','S4','S5','S6','S7','S8'];
  const created = [8,12,6,10,14,9,11,7];
  const resolved = [5,10,8,12,11,13,9,10];
  const w = 400, h = 120, maxV = Math.max(...created, ...resolved);
  const toCoords = (arr) => arr.map((v, i) => `${(i / (arr.length - 1)) * w},${h - (v / maxV) * h}`).join(' ');
  container.innerHTML = `<svg width="100%" height="${h + 30}" viewBox="0 0 ${w} ${h + 30}" preserveAspectRatio="none">
    <polyline points="${toCoords(created)}" fill="none" stroke="#ef4444" stroke-width="2"/>
    <polyline points="${toCoords(resolved)}" fill="none" stroke="#22c55e" stroke-width="2"/>
    ${weeks.map((wk, i) => `<text x="${(i / (weeks.length - 1)) * w}" y="${h + 20}" fill="var(--muted-foreground)" font-size="10" text-anchor="middle">${wk}</text>`).join('')}
  </svg>
  <div style="display:flex;gap:16px;margin-top:4px;font-size:11px">
    <span style="display:flex;align-items:center;gap:4px"><span style="width:12px;height:2px;background:#ef4444;display:inline-block"></span> Criados</span>
    <span style="display:flex;align-items:center;gap:4px"><span style="width:12px;height:2px;background:#22c55e;display:inline-block"></span> Resolvidos</span>
  </div>`;
}

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', () => {
  showSection('dashboard');
  renderTable();
  renderFilterBar();
  renderNotifications();
  renderDashboardHome();
  renderOverviewCharts();
  renderVelocityChart();
  renderKanban();
  renderProjects();
  renderUsers();
  renderRoles();
  renderTags();
  renderSLAPolicies();

  // Close notification popover on outside click
  document.addEventListener('click', (e) => {
    const popover = document.getElementById('notif-popover');
    const bell = document.getElementById('notif-bell');
    if (popover && popover.classList.contains('show') && !popover.contains(e.target) && !bell.contains(e.target)) {
      popover.classList.remove('show');
    }
  });
});
