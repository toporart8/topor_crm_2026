/**
 * ТопорДорф CRM — Полная система:
 * 1. Заказы топоров (коммерция, 112 клиентов, эскизы, взаиморасчёты с Димой, просрочки)
 * 2. Цех фигурок и оберегов «Обережье» (FBS маркетплейсы WB/Ozon, план цеха, смены, зарплаты)
 * 3. Командный и персональный чат цеха
 * 4. Разделение доступа: Руководитель (Админка) и Сотрудники (Вероника, Катя, Дмитрий)
 */
'use strict';

const paths = {
  grid: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  orders: 'M8 4H4v17h16V4h-4 M9 2h6v4H9z M8 11h8 M8 16h5',
  sketch: 'M4 20l4-1L20 7l-3-3L5 16z M14 7l3 3 M4 20h16',
  wallet: 'M3 6h16v14H3z M3 6V4h13v2 M15 11h6v5h-6z M17 13h1',
  archive: 'M3 3h18v5H3z M5 8v13h14V8 M9 12h6',
  plus: 'M12 5v14 M5 12h14',
  search: 'M21 21l-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  clock: 'M12 8v5l3 2 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  check: 'M5 12l4 4L19 6',
  arrow: 'M5 12h14 M14 7l5 5-5 5',
  folder: 'M3 5h7l2 3h9v12H3z',
  copy: 'M8 8h12v13H8z M16 8V3H3v13h5',
  image: 'M3 3h18v18H3z M3 16l5-5 4 4 3-3 6 6 M16 7h.01',
  info: 'M12 11v6 M12 7h.01 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  figurines: 'M12 2L2 7l10 5 10-5-10-5z M2 17l10 5 10-5 M2 12l10 5 10-5',
  chat: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  edit: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7 M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z',
  payout: 'M2 10h20 M7 15h2 M12 15h5 M2 5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z'
};

const icon = n => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[n] || paths.orders}"/></svg>`;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rub = n => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(n) + ' ₽';

const day = new Date(); day.setHours(12, 0, 0, 0);
const dateOffset = n => {
  let d = new Date(day);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const today = dateOffset(0);

function parseDate(s) {
  if (!s) return null;
  s = String(s).trim();
  if (!s || s === 'Без срока' || s === 'Invalid Date') return null;
  if (/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.test(s)) {
    const m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), 12, 0, 0);
  }
  if (/^(\d{4})-(\d{1,2})-(\d{1,2})/.test(s)) {
    const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function pluralDays(n) {
  const abs = Math.abs(n);
  const n10 = abs % 10, n100 = abs % 100;
  if (n100 >= 11 && n100 <= 19) return 'дней';
  if (n10 === 1) return 'день';
  if (n10 >= 2 && n10 <= 4) return 'дня';
  return 'дней';
}

function getDueStatus(o) {
  if (!active(o)) return { isOverdue: false, text: '', days: 0 };
  const d = parseDate(o.due);
  if (!d) return { isOverdue: false, text: '', days: 0 };
  const now = new Date(); now.setHours(12, 0, 0, 0);
  const diffDays = Math.round((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays > 0) return { isOverdue: true, days: diffDays, text: `Просрочен на ${diffDays} ${pluralDays(diffDays)}` };
  if (diffDays === 0) return { isOverdue: false, isToday: true, days: 0, text: 'Срок сегодня' };
  const left = Math.abs(diffDays);
  return { isOverdue: false, days: diffDays, text: `Осталось ${left} ${pluralDays(left)}` };
}

const dateLabel = s => {
  const d = parseDate(s);
  if (!d) return 'Без срока';
  const dd = String(d.getDate()).padStart(2, '0'), mm = String(d.getMonth() + 1).padStart(2, '0'), yy = d.getFullYear();
  return `${dd}.${mm}.${yy}`;
};

const statuses = ["Новый", "Подготовить эскиз", "На отправку оплачен", "Ожидает оплаты", "В производстве", "Готов", "Отправлен", "Закрыт", "Наклеен", "Отказ", "у Димы", "Наклейка готова", "Видео отправлено"];
const classes = statuses.map((_, i) => "order-status-" + i);
const statusColors = ["#e8eaed", "#e6cff2", "#62f870", "#ffe700", "#e6cff2", "#20e633", "#045ce0", "#215a6c", "#e8eaed", "#b10202", "#0df8f8", "#ffe5a0", "#ffe5a0"];
const statusTextColors = statuses.map((_, i) => [6, 7, 9].includes(i) ? "#ffffff" : "#182320");
const sketchStatuses = ['Нет эскиза', 'Подготовить', 'Отправлен клиенту', 'На правках', 'Готов', 'Согласован'];

const total = o => Number(o.axe) + Number(o.sheath) + Number(o.box) + Number(o.shipping);
const debt = o => Math.max(0, total(o) - Number(o.paid));
const active = o => !['Закрыт', 'Отказ'].includes(o.status);
const overdue = o => active(o) && getDueStatus(o).isOverdue;
const needsSketch = o => active(o) && !['Готов', 'Согласован'].includes(o.sketch);

// Хранилище данных
let orders = [], ledger = [], view = 'orders', tab = 'all', query = '', statusFilter = '', sequence = 108;
const STORAGE_KEY = 'topordorf_crm_data_v1';
const AUTH_KEY = 'topordorf_crm_auth_token';
let lastServerTimestamp = '';
let isOnline = false;

// --- Состояние модуля Фигурок и Чат ---
let currentProject = localStorage.getItem('topordorf_project') || 'topor'; // 'topor' | 'figurines' | 'chat'
let currentRole = localStorage.getItem('topordorf_role') || 'admin';       // 'admin' | 'employee'
let currentEmployeeId = localStorage.getItem('topordorf_emp_id') || 'emp_1';
// URL-параметры для прямого входа сотрудника по персональной ссылке (например: ?emp=1111)
(function checkUrlAuth() {
  try {
    const params = new URLSearchParams(window.location.search);
    const empParam = params.get('emp') || params.get('pin');
    if (empParam) {
      const emps = figurines.employees || [
        { id: "emp_1", name: "Вероника", pin: "1111" },
        { id: "emp_2", name: "Катя", pin: "2222" },
        { id: "emp_3", name: "Дмитрий", pin: "3333" }
      ];
      const found = emps.find(e => e.id === empParam || e.pin === empParam || e.name.toLowerCase() === empParam.toLowerCase());
      if (found) {
        currentRole = 'employee';
        currentEmployeeId = found.id;
        currentProject = 'figurines';
        view = 'emp_workspace';
        localStorage.setItem('topordorf_role', 'employee');
        localStorage.setItem('topordorf_emp_id', found.id);
        localStorage.setItem('topordorf_project', 'figurines');
      }
    }
  } catch(e) {}
})();

let activeChatChannel = 'general';

let figurines = {
  products: [
    { id: "R001", name: "Руна «Феху» (Елка)", category: 1, ready: 71, inProgress: 0, availableWB: 0, targetWB: 0, availableOzon: 0, targetOzon: 40, toProduce: 0, status: "ПОВЫСИТЬ ЛИМИТ" },
    { id: "R002", name: "Руна «Тейваз» (Стрелка)", category: 1, ready: 96, inProgress: 0, availableWB: 40, targetWB: 25, availableOzon: 30, targetOzon: 25, toProduce: 0, status: "НОРМА" },
    { id: "F001", name: "Фигурка «Хранитель» (Дед)", category: 1, ready: 0, inProgress: 0, availableWB: 0, targetWB: 50, availableOzon: 0, targetOzon: 0, toProduce: 60, status: "ПРОИЗВОДИТЬ" },
    { id: "O001", name: "Оберег Велес (Круг)", category: 1, ready: 21, inProgress: 0, availableWB: 0, targetWB: 30, availableOzon: 0, targetOzon: 30, toProduce: 49, status: "ПРОИЗВОДИТЬ" },
    { id: "O002", name: "Лапа волка", category: 1, ready: 146, inProgress: 0, availableWB: 0, targetWB: 0, availableOzon: 100, targetOzon: 30, toProduce: 0, status: "НОРМА" }
  ],
  employees: [
    { id: "emp_1", name: "Вероника", pin: "1111", balance: 3680 },
    { id: "emp_2", name: "Катя", pin: "2222", balance: 0 },
    { id: "emp_3", name: "Дмитрий", pin: "3333", balance: 0 }
  ],
  shifts: [
    { id: "sh_1", date: "31.07.2026", employee: "Вероника", employeeId: "emp_1", productId: "R001", product: "Руна «Феху» (Елка)", printed: 12, painted: 12, packed: 12, scrap: 0, comment: "", category: 1, earned: 120 },
    { id: "sh_2", date: "31.07.2026", employee: "Вероника", employeeId: "emp_1", productId: "O001", product: "Оберег Велес (Круг)", printed: 10, painted: 10, packed: 10, scrap: 0, comment: "", category: 1, earned: 100 },
    { id: "sh_3", date: "31.07.2026", employee: "Вероника", employeeId: "emp_1", productId: "O002", product: "Лапа волка", printed: 44, painted: 44, packed: 44, scrap: 0, comment: "", category: 1, earned: 440 },
    { id: "sh_4", date: "03.08.2026", employee: "Вероника", employeeId: "emp_1", productId: "O002", product: "Лапа волка", printed: 102, painted: 102, packed: 102, scrap: 0, comment: "", category: 1, earned: 1020 },
    { id: "sh_5", date: "03.08.2026", employee: "Вероника", employeeId: "emp_1", productId: "O001", product: "Оберег Велес (Круг)", printed: 11, painted: 11, packed: 11, scrap: 0, comment: "", category: 1, earned: 110 }
  ],
  salary: [
    { id: "sal_1", date: "31.07.2026", employee: "Вероника", employeeId: "emp_1", itemsCat1: 66, itemsCat2: 0, itemsCat3: 0, base: 1000, pieceRate: 660, total: 1660, paid: false, paidDate: "", comment: "" },
    { id: "sal_2", date: "03.08.2026", employee: "Вероника", employeeId: "emp_1", itemsCat1: 102, itemsCat2: 0, itemsCat3: 0, base: 1000, pieceRate: 1020, total: 2020, paid: false, paidDate: "", comment: "" }
  ],
  shipments: [],
  messages: [
    { id: "msg_1", channel: "general", author: "Руководитель", authorRole: "admin", text: "Добро пожаловать в рабочее пространство цеха фигурок и оберегов!", time: "08.09.2026, 00:00" },
    { id: "msg_2", channel: "general", author: "Вероника", authorRole: "employee", text: "Здравствуйте! Смены за 31.07 и 03.08 внесены в систему.", time: "08.09.2026, 00:05" }
  ],
  settings: {
    baseShiftRate: 1000,
    categories: { "1": 10, "2": 20, "3": 30 },
    categoryNames: { "1": "Мелкие (руны, подвески)", "2": "Средние (обереги)", "3": "Крупные (фигурки)" }
  }
};

function getAuthHeaders() {
  const token = localStorage.getItem(AUTH_KEY) || '';
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['x-crm-token'] = token;
  if (currentRole === 'employee' && currentEmployeeId) headers['x-employee-id'] = currentEmployeeId;
  return headers;
}

function promptAuthDialog() {
  const smallDialog = document.getElementById('small-dialog');
  if (!smallDialog || smallDialog.open) return;
  document.getElementById('small-body').innerHTML = `
   <form id="auth-form">
    <div class="dialog-head"><h2 id="small-title">🔑 Вход в ТопорДорф CRM</h2></div>
    <div class="dialog-content">
     <p class="field-hint" style="margin-bottom:14px">Введите пароль мастерской для синхронизации.</p>
     <label class="field full">Пароль
      <input type="password" id="auth-pass-input" placeholder="Введите пароль..." required autofocus autocomplete="current-password">
     </label>
     <p id="auth-error-msg" style="color:#b10202;font-size:12px;margin-top:8px" hidden></p>
    </div>
    <div class="dialog-actions">
     <span></span>
     <button class="button primary" type="submit">Войти</button>
    </div>
   </form>`;
  smallDialog.showModal();
  document.getElementById('auth-form').onsubmit = async e => {
    e.preventDefault();
    const pass = document.getElementById('auth-pass-input').value;
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pass })
      });
      const data = await res.json();
      if (res.ok && data.token) {
        localStorage.setItem(AUTH_KEY, data.token);
        smallDialog.close();
        toast('Успешная авторизация');
        fetchServerState();
      } else {
        const errEl = document.getElementById('auth-error-msg');
        if (errEl) { errEl.textContent = data.error || 'Неверный пароль'; errEl.hidden = false; }
      }
    } catch {
      toast('Ошибка соединения при входе');
    }
  };
}

function setOnlineStatus(online) {
  isOnline = online;
}

function saveState() {
  const updatedAt = new Date().toISOString();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ orders, ledger, sequence, figurines, version: 1, updatedAt }));
  } catch (err) {
    console.error('Ошибка сохранения state:', err);
  }
  syncToServer({ orders, ledger, sequence, figurines, updatedAt });
}

async function syncToServer(payload) {
  try {
    const res = await fetch('/api/state', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    if (res.status === 401 && currentRole === 'admin') {
      setOnlineStatus(false);
      promptAuthDialog();
      return;
    }
    if (res.ok) {
      const data = await res.json();
      if (data.updatedAt) lastServerTimestamp = data.updatedAt;
      setOnlineStatus(true);
    }
  } catch {
    setOnlineStatus(false);
  }
}

async function fetchServerState() {
  try {
    const res = await fetch('/api/state', { headers: getAuthHeaders() });
    if (res.status === 401 && currentRole === 'admin') {
      setOnlineStatus(false);
      promptAuthDialog();
      return;
    }
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.orders) && Array.isArray(data.ledger)) {
        orders = data.orders;
        ledger = data.ledger;
        sequence = Number(data.sequence) || 108;
        if (data.figurines && typeof data.figurines === 'object') {
          figurines = data.figurines;
        }
        if (data.updatedAt) lastServerTimestamp = data.updatedAt;
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ orders, ledger, sequence, figurines, version: 1, updatedAt: data.updatedAt }));
        setOnlineStatus(true);
        render();
      }
    }
  } catch {
    setOnlineStatus(false);
  }
}

async function checkServerUpdates() {
  try {
    const res = await fetch('/api/state', { headers: getAuthHeaders() });
    if (res.status === 401) return;
    if (res.ok) {
      const data = await res.json();
      setOnlineStatus(true);
      if (data.updatedAt && data.updatedAt !== lastServerTimestamp) {
        lastServerTimestamp = data.updatedAt;
        orders = data.orders;
        ledger = data.ledger;
        sequence = Number(data.sequence) || 108;
        if (data.figurines) figurines = data.figurines;
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ orders, ledger, sequence, figurines, version: 1, updatedAt: data.updatedAt }));
        render();
      }
    }
  } catch {
    setOnlineStatus(false);
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (data && Array.isArray(data.orders) && Array.isArray(data.ledger)) {
      orders = data.orders;
      ledger = data.ledger;
      sequence = Number(data.sequence) || 108;
      if (data.figurines) figurines = data.figurines;
      return true;
    }
  } catch (err) {
    console.error('Ошибка восстановления state:', err);
  }
  return false;
}

function initData() {
  if (!loadState()) {
    saveState();
  }
  fetchServerState();
}
initData();
setInterval(checkServerUpdates, 6000);
window.addEventListener('focus', checkServerUpdates);
document.getElementById('today').textContent = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });

function toast(text) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), 3400);
}

// --- НАВИГАЦИЯ И ВИДЫ ---
function getActiveViews() {
  if (currentProject === 'chat') {
    return [['chat', 'Чат команды', 'chat']];
  }
  if (currentProject === 'figurines') {
    if (currentRole === 'employee') {
      return [
        ['emp_workspace', 'Моя смена', 'plus'],
        ['emp_plan', 'План цеха', 'orders'],
        ['emp_shifts', 'Мои смены', 'clock']
      ];
    }
    return [
      ['fig_dashboard', 'Дашборд FBS', 'grid'],
      ['fig_products', 'Остатки и лимиты', 'orders'],
      ['fig_shifts', 'Смены цеха', 'clock'],
      ['fig_salary', 'Зарплаты цеха', 'wallet']
    ];
  }
  // currentProject === 'topor'
  return [
    ['orders', 'Заказы', 'orders'],
    ['home', 'Обзор', 'grid'],
    ['sketches', 'Эскизы', 'sketch'],
    ['money', 'Взаиморасчёты', 'wallet'],
    ['archive', 'Архив', 'archive']
  ];
}

function updateHeaderAndSidebar() {
  document.querySelectorAll('.project-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.proj === currentProject);
  });
  
  const roleBtn = document.getElementById('role-switch-btn');
  const userAvatar = document.getElementById('user-avatar');
  const userDisplayName = document.getElementById('user-display-name');
  const userDisplayRole = document.getElementById('user-display-role');
  
  if (currentRole === 'admin') {
    if (roleBtn) {
      roleBtn.innerHTML = '👑 Руководитель';
      roleBtn.className = 'role-badge-btn';
    }
    if (userAvatar) userAvatar.textContent = 'М';
    if (userDisplayName) userDisplayName.textContent = 'Моя мастерская';
    if (userDisplayRole) userDisplayRole.textContent = 'Руководитель (Админка)';
  } else {
    const emp = figurines.employees?.find(e => e.id === currentEmployeeId) || { name: 'Сотрудник' };
    if (roleBtn) {
      roleBtn.innerHTML = `👷 ${esc(emp.name)}`;
      roleBtn.className = 'role-badge-btn emp';
    }
    if (userAvatar) userAvatar.textContent = emp.name.slice(0, 1);
    if (userDisplayName) userDisplayName.textContent = emp.name;
    if (userDisplayRole) userDisplayRole.textContent = 'Сотрудник цеха';
  }
}

function nav() {
  const viewsList = getActiveViews();
  const navEl = document.getElementById('navigation');
  if (navEl) {
    navEl.innerHTML = viewsList.map(([id, title, ico]) => `
      <a href="#${id}" class="${view === id ? 'active' : ''}" ${view === id ? 'aria-current="page"' : ''}>
        ${icon(ico)}${title}
        ${id === 'orders' ? `<span class="count">${orders.filter(active).length}</span>` : ''}
      </a>
    `).join('');
  }
  const currentViewTitle = viewsList.find(x => x[0] === view)?.[1] || 'Раздел';
  const projTitle = currentProject === 'topor' ? 'Топоры' : currentProject === 'figurines' ? 'Фигурки' : 'Чат';
  document.getElementById('breadcrumb').innerHTML = `${projTitle} <span>/</span> ${currentViewTitle}`;
}

// --- РЕНДЕРИНГ РАЗДЕЛОВ ---
function render() {
  updateHeaderAndSidebar();
  nav();
  const c = document.getElementById('content');
  if (!c) return;

  if (currentProject === 'chat') {
    c.innerHTML = chatPage();
    initChatEvents();
  } else if (currentProject === 'figurines') {
    if (view === 'fig_dashboard') c.innerHTML = figDashboardPage();
    else if (view === 'fig_products') c.innerHTML = figProductsPage();
    else if (view === 'fig_shifts') c.innerHTML = figShiftsPage();
    else if (view === 'fig_salary') c.innerHTML = figSalaryPage();
    else if (view === 'emp_workspace') c.innerHTML = empWorkspacePage();
    else if (view === 'emp_plan') c.innerHTML = empPlanPage();
    else if (view === 'emp_shifts') c.innerHTML = empShiftsPage();
    else {
      view = currentRole === 'admin' ? 'fig_dashboard' : 'emp_workspace';
      render();
    }
  } else {
    // topor project
    if (view === 'home') c.innerHTML = overview();
    else if (view === 'sketches') c.innerHTML = sketchesPage();
    else if (view === 'money') c.innerHTML = moneyPage();
    else c.innerHTML = ordersPage();
    if (view === 'orders' || view === 'archive') updateList();
  }
}

function setView() {
  const hash = location.hash.slice(1);
  const validViews = getActiveViews().map(x => x[0]);
  if (validViews.includes(hash)) {
    view = hash;
  } else {
    view = validViews[0] || 'orders';
  }
  tab = 'all';
  query = '';
  statusFilter = '';
  render();
}
window.addEventListener('hashchange', setView);

// ==========================================
// 🗿 МОДУЛЬ ФИГУРОК И ОБЕРЕГОВ (FBS)
// ==========================================

function figDashboardPage() {
  const products = figurines.products || [];
  const salary = figurines.salary || [];
  
  const totalReady = products.reduce((s, p) => s + Number(p.ready || 0), 0);
  const totalToProduce = products.reduce((s, p) => s + Number(p.toProduce || 0), 0);
  const totalAvailableWB = products.reduce((s, p) => s + Number(p.availableWB || 0), 0);
  const totalAvailableOzon = products.reduce((s, p) => s + Number(p.availableOzon || 0), 0);
  const totalUnpaid = salary.filter(x => !x.paid).reduce((s, x) => s + Number(x.total || 0), 0);
  const totalToAdd = products.reduce((s, p) => {
    const diffWB = Math.max(0, Number(p.targetWB || 0) - Number(p.availableWB || 0));
    const diffOz = Math.max(0, Number(p.targetOzon || 0) - Number(p.availableOzon || 0));
    return s + diffWB + diffOz;
  }, 0);

  return `
    <div class="page-head">
      <div>
        <div class="eyebrow">ЦЕХ «ОБЕРЕЖЬЕ» · FBS МАРКЕТПЛЕЙСЫ</div>
        <h1>Дашборд производства фигурок</h1>
        <p class="subtitle">Контроль склада, лимитов WB/Ozon и плана цеха. Все показатели можно редактировать вручную.</p>
      </div>
      <div class="header-actions">
        <button class="button primary" data-action="new-product">${icon('plus')} Добавить товар</button>
      </div>
    </div>

    <div class="fbs-grid">
      <div class="fbs-card">
        <div class="card-head">
          <span>Физический готовый остаток</span>
          <button class="edit-icon-btn" data-action="quick-adjust" title="Быстрая ручная корректировка">${icon('edit')}</button>
        </div>
        <div class="card-val">${totalReady} <small style="font-size:15px;font-weight:400;color:#6d7a72">шт</small></div>
        <div class="card-note">Готово в цехе к отправке</div>
      </div>

      <div class="fbs-card highlight">
        <div class="card-head">
          <span>Добавить в продажу (WB/Ozon)</span>
        </div>
        <div class="card-val">${totalToAdd} <small style="font-size:15px;font-weight:400;color:#6d7a72">шт</small></div>
        <div class="card-note">WB: ${totalAvailableWB} шт · Ozon: ${totalAvailableOzon} шт</div>
      </div>

      <div class="fbs-card alert">
        <div class="card-head">
          <span>Нужно произвести</span>
          <button class="edit-icon-btn" data-action="quick-adjust" title="Редактировать план">${icon('edit')}</button>
        </div>
        <div class="card-val">${totalToProduce} <small style="font-size:15px;font-weight:400;color:#6d7a72">шт</small></div>
        <div class="card-note">${products.filter(p => p.status === 'ПРОИЗВОДИТЬ').length} позиций требуют запуска</div>
      </div>

      <div class="fbs-card">
        <div class="card-head">
          <span>Невыплаченная зарплата</span>
          <button class="button light" style="min-height:28px;padding:2px 8px;font-size:11px" onclick="location.hash='#fig_salary'">К выплатам</button>
        </div>
        <div class="card-val" style="color:#b10202">${rub(totalUnpaid)}</div>
        <div class="card-note">По всем закрытым сменам</div>
      </div>
    </div>

    <section class="panel">
      <div class="toolbar">
        <h2>План производства и доступность на маркетплейсах</h2>
        <span class="field-hint">Кликните на «✏️ Изменить», чтобы вручную скорректировать любую цифру товара</span>
      </div>
      <table class="order-table">
        <thead>
          <tr>
            <th>КОД / ТОВАР</th>
            <th>ФИЗИЧЕСКИ ГОТОВО</th>
            <th>ДОСТУПНО WB / ЦЕЛЬ</th>
            <th>ДОСТУПНО OZON / ЦЕЛЬ</th>
            <th>ПРОИЗВЕСТИ</th>
            <th>СТАТУС</th>
            <th>ДЕЙСТВИЕ</th>
          </tr>
        </thead>
        <tbody>
          ${products.map(p => {
            const statusClass = p.status === 'ПРОИЗВОДИТЬ' ? 'produce' : p.status === 'ПОВЫСИТЬ ЛИМИТ' ? 'limit' : 'ok';
            return `
              <tr>
                <td>
                  <strong>${esc(p.name)}</strong>
                  <div class="meta">Код: ${esc(p.id)} · Категория ${p.category}</div>
                </td>
                <td><span style="font-size:16px;font-weight:600">${p.ready}</span> шт</td>
                <td>
                  <span>${p.availableWB}</span> / <span style="color:#718276">${p.targetWB} шт</span>
                </td>
                <td>
                  <span>${p.availableOzon}</span> / <span style="color:#718276">${p.targetOzon} шт</span>
                </td>
                <td><strong style="color:${p.toProduce > 0 ? '#b10202' : '#26372a'}">${p.toProduce} шт</strong></td>
                <td><span class="fig-status ${statusClass}">${esc(p.status || 'НОРМА')}</span></td>
                <td>
                  <button class="button light" style="min-height:34px;padding:4px 10px;font-size:12px" data-edit-fig="${p.id}">
                    ${icon('edit')} Изменить
                  </button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </section>
  `;
}

function figProductsPage() {
  return figDashboardPage();
}

function figShiftsPage() {
  const shifts = figurines.shifts || [];
  return `
    <div class="page-head">
      <div>
        <div class="eyebrow">ЖУРНАЛ СМЕН ЦЕХА</div>
        <h1>Результаты смен сотрудников</h1>
        <p class="subtitle">История изготовления изделий по дням и сотрудникам (Вероника, Катя, Дмитрий).</p>
      </div>
      <button class="button primary" data-action="new-shift">${icon('plus')} Внести смену</button>
    </div>

    <section class="panel">
      <div class="toolbar">
        <h2>Журнал смен (${shifts.length})</h2>
      </div>
      <table class="order-table">
        <thead>
          <tr>
            <th>ДАТА</th>
            <th>СОТРУДНИК</th>
            <th>ИЗДЕЛИЕ</th>
            <th>ПЕЧАТЬ</th>
            <th>ПОКРАСКА</th>
            <th>УПАКОВКА</th>
            <th>БРАК</th>
            <th>СДЕЛЬНО, ₽</th>
          </tr>
        </thead>
        <tbody>
          ${shifts.slice().reverse().map(sh => `
            <tr>
              <td>${esc(sh.date)}</td>
              <td><strong>${esc(sh.employee)}</strong></td>
              <td>${esc(sh.product)}</td>
              <td>${sh.printed} шт</td>
              <td>${sh.painted} шт</td>
              <td>${sh.packed} шт</td>
              <td style="color:${sh.scrap > 0 ? '#b10202' : '#718276'}">${sh.scrap} шт</td>
              <td><strong style="color:#2a5538">+${rub(sh.earned)}</strong></td>
            </tr>
          `).join('') || '<tr><td colspan="8">Пока нет внесенных смен</td></tr>'}
        </tbody>
      </table>
    </section>
  `;
}

function figSalaryPage() {
  const employees = figurines.employees || [];
  const salary = figurines.salary || [];
  const totalUnpaid = salary.filter(x => !x.paid).reduce((s, x) => s + Number(x.total || 0), 0);

  return `
    <div class="page-head">
      <div>
        <div class="eyebrow">ФИНАНСЫ И ВЫПЛАТЫ ЦЕХА</div>
        <h1>Зарплатная ведомость мастеров</h1>
        <p class="subtitle">Базовая ставка (1000 ₽/смена) + сдельная оплата по категориям. Выплата в 1 клик.</p>
      </div>
      <div>
        <span class="badge ready" style="font-size:14px;padding:8px 14px">К выплате: ${rub(totalUnpaid)}</span>
      </div>
    </div>

    <div class="stats" style="grid-template-columns:repeat(3, 1fr);margin-bottom:24px">
      ${employees.map(emp => {
        const empUnpaid = salary.filter(x => x.employeeId === emp.id && !x.paid).reduce((s, x) => s + Number(x.total || 0), 0);
        return `
          <div class="stat ${empUnpaid > 0 ? 'selected' : ''}">
            <div class="stat-label">${esc(emp.name)} ${icon('user')}</div>
            <div class="stat-value">${rub(empUnpaid)}</div>
            <div class="stat-note" style="margin-top:12px">
              ${empUnpaid > 0 
                ? `<button class="button primary" style="min-height:32px;padding:4px 10px;font-size:12px;background:#eab308;border-color:#ca8a04;color:#000" data-payout-emp="${emp.id}">Выплатить ${rub(empUnpaid)}</button>` 
                : 'Все смены оплачены'}
            </div>
          </div>
        `;
      }).join('')}
    </div>

    <section class="panel">
      <div class="toolbar">
        <h2>Журнал закрытых смен и начислений</h2>
      </div>
      <table class="order-table">
        <thead>
          <tr>
            <th>ДАТА СМЕНЫ</th>
            <th>МАСТЕР</th>
            <th>ОБЪЕМ (ШТ)</th>
            <th>БАЗА</th>
            <th>СДЕЛЬНО</th>
            <th>НАЧИСЛЕНО</th>
            <th>СТАТУС</th>
            <th>ДЕЙСТВИЕ</th>
          </tr>
        </thead>
        <tbody>
          ${salary.slice().reverse().map(sal => `
            <tr>
              <td>${esc(sal.date)}</td>
              <td><strong>${esc(sal.employee)}</strong></td>
              <td>${sal.itemsCat1 + sal.itemsCat2 + sal.itemsCat3} шт</td>
              <td>${rub(sal.base)}</td>
              <td>${rub(sal.pieceRate)}</td>
              <td><strong>${rub(sal.total)}</strong></td>
              <td>
                <span class="badge ${sal.paid ? 'ready' : 'payment'}">
                  ${sal.paid ? `Оплачено (${sal.paidDate || ''})` : 'Ожидает оплаты'}
                </span>
              </td>
              <td>
                ${!sal.paid ? `<button class="text-button" data-payout-single="${sal.id}">Оплатить</button>` : '<span style="color:#718276">—</span>'}
              </td>
            </tr>
          `).join('') || '<tr><td colspan="8">Пока нет записей о начислениях</td></tr>'}
        </tbody>
      </table>
    </section>
  `;
}

// ==========================================
// 👷 РАБОЧЕЕ МЕСТО СОТРУДНИКА (ВЕРОНИКА / КАТЯ / ДМИТРИЙ)
// ==========================================

function empWorkspacePage() {
  const emp = figurines.employees?.find(e => e.id === currentEmployeeId) || { name: 'Сотрудник' };
  const products = figurines.products || [];
  const myShifts = (figurines.shifts || []).filter(sh => sh.employeeId === currentEmployeeId);
  const mySalary = (figurines.salary || []).filter(sal => sal.employeeId === currentEmployeeId);
  const myUnpaid = mySalary.filter(x => !x.paid).reduce((s, x) => s + Number(x.total || 0), 0);
  const urgentProduce = products.filter(p => p.status === 'ПРОИЗВОДИТЬ');

  return `
    <div class="emp-hero">
      <div>
        <h2>Рабочее место мастера: ${esc(emp.name)}</h2>
        <p>Вносите количество напечатанного, покрашенного и упакованного за смену. Заработок считается автоматически.</p>
      </div>
      <div class="emp-hero-actions">
        <button class="button btn-shift-big" data-action="new-shift">➕ Внести смену</button>
      </div>
    </div>

    <div class="stats" style="grid-template-columns:repeat(3, 1fr);margin-bottom:24px">
      <div class="stat selected">
        <div class="stat-label">Мой баланс к выплате ${icon('wallet')}</div>
        <div class="stat-value">${rub(myUnpaid)}</div>
        <div class="stat-note">Ожидает выплаты от руководителя</div>
      </div>
      <div class="stat">
        <div class="stat-label">Базовая ставка смены</div>
        <div class="stat-value">1 000 ₽</div>
        <div class="stat-note">+ сдельная оплата по изделиям</div>
      </div>
      <div class="stat">
        <div class="stat-label">Всего внесено смен</div>
        <div class="stat-value">${myShifts.length}</div>
        <div class="stat-note">За все время работы</div>
      </div>
    </div>

    <div class="dashboard-columns">
      <section class="panel">
        <div class="panel-title">
          <h2>🔥 План цеха — Сделать в первую очередь!</h2>
        </div>
        <div style="padding:16px 20px">
          ${urgentProduce.length ? urgentProduce.map(p => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid #edf0ec">
              <div>
                <strong>${esc(p.name)}</strong>
                <div class="meta">Категория: ${p.category} · Готово в цехе: ${p.ready} шт</div>
              </div>
              <div style="text-align:right">
                <span class="fig-status produce">Сделать: ${p.toProduce} шт</span>
              </div>
            </div>
          `).join('') : '<div class="empty">Срочных позиций нет, работаем по штатному плану</div>'}
        </div>
      </section>

      <section class="panel">
        <div class="panel-title">
          <h2>Мои последние смены</h2>
        </div>
        <div style="padding:16px 20px">
          ${myShifts.slice(-4).reverse().map(sh => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #edf0ec;font-size:13px">
              <div>
                <strong>${esc(sh.product)}</strong>
                <div class="meta">${sh.date} · Упаковано: ${sh.packed} шт</div>
              </div>
              <strong style="color:#2b583d">+${rub(sh.earned)}</strong>
            </div>
          `).join('') || '<div class="empty">Смен пока не внесено</div>'}
        </div>
      </section>
    </div>
  `;
}

function empPlanPage() {
  const products = figurines.products || [];
  return `
    <div class="page-head">
      <div>
        <div class="eyebrow">ПЛАН ЦЕХА</div>
        <h1>План производства изделий</h1>
        <p class="subtitle">Позиции со статусом «ПРОИЗВОДИТЬ» имеют наивысший приоритет.</p>
      </div>
    </div>
    <section class="panel">
      <table class="order-table">
        <thead>
          <tr>
            <th>ИЗДЕЛИЕ</th>
            <th>ФИЗИЧЕСКИ ГОТОВО</th>
            <th>НУЖНО ПРОИЗВЕСТИ</th>
            <th>СТАТУС</th>
          </tr>
        </thead>
        <tbody>
          ${products.map(p => `
            <tr>
              <td><strong>${esc(p.name)}</strong><div class="meta">Категория ${p.category}</div></td>
              <td>${p.ready} шт</td>
              <td><strong style="color:${p.toProduce > 0 ? '#b10202' : '#283d2c'}">${p.toProduce} шт</strong></td>
              <td><span class="fig-status ${p.status === 'ПРОИЗВОДИТЬ' ? 'produce' : p.status === 'ПОВЫСИТЬ ЛИМИТ' ? 'limit' : 'ok'}">${esc(p.status)}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </section>
  `;
}

function empShiftsPage() {
  return figShiftsPage();
}

// ==========================================
// 💬 ЧАТ КОМАНДЫ (ОБЩИЙ + ЛИЧНЫЕ ПЕРЕПИСКИ)
// ==========================================

function chatPage() {
  const employees = figurines.employees || [];
  const messages = figurines.messages || [];
  
  // Доступные каналы:
  let channels = [{ id: 'general', title: '📢 Общий чат цеха', subtitle: 'Для всех сотрудников' }];
  
  if (currentRole === 'admin') {
    employees.forEach(emp => {
      channels.push({ id: `private_${emp.id}`, title: `👤 ${emp.name}`, subtitle: 'Личный чат' });
    });
  } else {
    channels.push({ id: `private_${currentEmployeeId}`, title: '👑 Руководитель', subtitle: 'Личный чат' });
  }

  // Фильтруем сообщения по активному каналу
  const currentChannelMessages = messages.filter(m => m.channel === activeChatChannel);
  const activeChannelMeta = channels.find(c => c.id === activeChatChannel) || channels[0];

  return `
    <div class="page-head">
      <div>
        <div class="eyebrow">КОМАНДНЫЙ ЧАТ</div>
        <h1>Сообщения и связь с цехом</h1>
        <p class="subtitle">Быстрое обсуждение вопросов по заказам, дедлайнам и фигуркам в реальном времени.</p>
      </div>
    </div>

    <div class="chat-container">
      <div class="chat-sidebar">
        <div class="chat-sidebar-header">
          <span>ДИАЛОГИ</span>
        </div>
        <div class="channel-list">
          ${channels.map(ch => `
            <button class="channel-item ${activeChatChannel === ch.id ? 'active' : ''}" data-channel="${ch.id}">
              <div>
                <div>${esc(ch.title)}</div>
                <small style="font-size:11px;opacity:0.8">${esc(ch.subtitle)}</small>
              </div>
            </button>
          `).join('')}
        </div>
      </div>

      <div class="chat-main">
        <div class="chat-main-header">
          <h3>${esc(activeChannelMeta.title)}</h3>
          <span style="font-size:12px;color:#707f75">${esc(activeChannelMeta.subtitle)}</span>
        </div>

        <div class="chat-messages" id="chat-messages-box">
          ${currentChannelMessages.length ? currentChannelMessages.map(m => {
            const isMine = (currentRole === 'admin' && m.authorRole === 'admin') || (currentRole === 'employee' && m.authorId === currentEmployeeId);
            return `
              <div class="chat-msg ${isMine ? 'mine' : 'theirs'}">
                <div class="chat-msg-head">
                  <strong>${esc(m.author)}</strong>
                  ${m.authorRole === 'admin' ? '<span class="badge" style="padding:1px 5px;font-size:9px">👑 Руководитель</span>' : ''}
                  <span>${esc(m.time)}</span>
                </div>
                <div class="chat-bubble">
                  ${esc(m.text)}
                </div>
              </div>
            `;
          }).join('') : '<div class="empty" style="padding:40px 10px">Пока нет сообщений в этом чате. Напишите первым!</div>'}
        </div>

        <form id="chat-form" class="chat-input-bar">
          <input type="text" id="chat-input" placeholder="Напишите сообщение..." required autocomplete="off">
          <button class="button primary" type="submit">Отправить</button>
        </form>
      </div>
    </div>
  `;
}

function initChatEvents() {
  const box = document.getElementById('chat-messages-box');
  if (box) box.scrollTop = box.scrollHeight;

  const form = document.getElementById('chat-form');
  if (form) {
    form.onsubmit = async e => {
      e.preventDefault();
      const inputEl = document.getElementById('chat-input');
      const text = inputEl.value.trim();
      if (!text) return;

      const authorName = currentRole === 'admin' 
        ? 'Руководитель' 
        : (figurines.employees?.find(e => e.id === currentEmployeeId)?.name || 'Сотрудник');

      const payload = {
        channel: activeChatChannel,
        text,
        author: authorName,
        authorRole: currentRole,
        authorId: currentRole === 'admin' ? 'admin' : currentEmployeeId
      };

      try {
        const res = await fetch('/api/chat/message', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          const data = await res.json();
          if (data.message) {
            if (!figurines.messages) figurines.messages = [];
            figurines.messages.push(data.message);
            saveState();
            render();
          }
        }
      } catch {
        // Локальное сохранение при офлайне
        const newMsg = {
          id: 'msg_' + Date.now(),
          channel: activeChatChannel,
          text,
          author: authorName,
          authorRole: currentRole,
          authorId: currentRole === 'admin' ? 'admin' : currentEmployeeId,
          time: new Date().toLocaleDateString('ru-RU') + ', ' + new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
        };
        figurines.messages.push(newMsg);
        saveState();
        render();
      }
      inputEl.value = '';
    };
  }
}

// ==========================================
// ✏️ МОДАЛЬНЫЕ ОКНА: РУЧНАЯ ПРАВКА ДАШБОРДА И СМЕНЫ
// ==========================================

function openFigurineEdit(id) {
  const p = figurines.products.find(x => x.id === id);
  if (!p) return;
  const dialog = document.getElementById('fig-dialog');
  document.getElementById('fig-body').innerHTML = `
    <form id="fig-edit-form">
      <div class="dialog-head">
        <div>
          <div class="eyebrow">${esc(p.id)} · РЕДАКТИРОВАНИЕ ПОКАЗАТЕЛЕЙ</div>
          <h2 id="fig-title">${esc(p.name)}</h2>
        </div>
        <button type="button" class="close" data-close="fig">×</button>
      </div>
      <div class="dialog-content">
        <p class="field-hint" style="margin-bottom:16px">Вы можете вручную скорректировать любое значение склада, лимитов и плана производства.</p>
        <div class="form-grid">
          <label class="field">Физически готово в цехе, шт
            <input type="number" name="ready" value="${p.ready}" min="0" required>
          </label>
          <label class="field">Нужно произвести, шт
            <input type="number" name="toProduce" value="${p.toProduce}" min="0" required>
          </label>
          <label class="field">Доступно покупателям на WB, шт
            <input type="number" name="availableWB" value="${p.availableWB}" min="0" required>
          </label>
          <label class="field">Цель по лимиту WB, шт
            <input type="number" name="targetWB" value="${p.targetWB}" min="0" required>
          </label>
          <label class="field">Доступно покупателям на Ozon, шт
            <input type="number" name="availableOzon" value="${p.availableOzon}" min="0" required>
          </label>
          <label class="field">Цель по лимиту Ozon, шт
            <input type="number" name="targetOzon" value="${p.targetOzon}" min="0" required>
          </label>
          <label class="field full">Статус производства
            <select name="status">
              <option value="НОРМА" ${p.status === 'НОРМА' ? 'selected' : ''}>НОРМА (зеленый)</option>
              <option value="ПРОИЗВОДИТЬ" ${p.status === 'ПРОИЗВОДИТЬ' ? 'selected' : ''}>ПРОИЗВОДИТЬ (красный алерт)</option>
              <option value="ПОВЫСИТЬ ЛИМИТ" ${p.status === 'ПОВЫСИТЬ ЛИМИТ' ? 'selected' : ''}>ПОВЫСИТЬ ЛИМИТ (синий)</option>
            </select>
          </label>
        </div>
      </div>
      <div class="dialog-actions">
        <button type="button" class="button" data-close="fig">Отмена</button>
        <button class="button primary" type="submit">${icon('check')} Сохранить изменения</button>
      </div>
    </form>
  `;
  dialog.showModal();

  document.getElementById('fig-edit-form').onsubmit = e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    p.ready = Number(fd.get('ready') || 0);
    p.toProduce = Number(fd.get('toProduce') || 0);
    p.availableWB = Number(fd.get('availableWB') || 0);
    p.targetWB = Number(fd.get('targetWB') || 0);
    p.availableOzon = Number(fd.get('availableOzon') || 0);
    p.targetOzon = Number(fd.get('targetOzon') || 0);
    p.status = fd.get('status') || 'НОРМА';
    saveState();
    dialog.close();
    render();
    toast(`Показатели «${p.name}» обновлены`);
  };
}

function openShiftModal() {
  const dialog = document.getElementById('fig-dialog');
  const products = figurines.products || [];
  const employees = figurines.employees || [];
  const defaultEmp = employees.find(e => e.id === currentEmployeeId) || employees[0];

  document.getElementById('fig-body').innerHTML = `
    <form id="shift-add-form">
      <div class="dialog-head">
        <div>
          <div class="eyebrow">ЦЕХ «ОБЕРЕЖЬЕ»</div>
          <h2 id="fig-title">Внесение результата смены</h2>
        </div>
        <button type="button" class="close" data-close="fig">×</button>
      </div>
      <div class="dialog-content">
        <div class="form-grid">
          <label class="field">Дата смены
            <input type="text" name="date" value="${new Date().toLocaleDateString('ru-RU')}" required>
          </label>
          <label class="field">Сотрудник
            <select name="employeeId">
              ${employees.map(e => `<option value="${e.id}" ${e.id === defaultEmp.id ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}
            </select>
          </label>
          <label class="field full">Изделие
            <select name="productId" id="shift-product-select">
              ${products.map(p => `<option value="${p.id}" data-cat="${p.category}">${esc(p.name)} (Кат. ${p.category} · ${figurines.settings?.categories?.[p.category] || 10} ₽/шт)</option>`).join('')}
            </select>
          </label>
          <label class="field">3D-Печать, шт
            <input type="number" name="printed" value="0" min="0" required>
          </label>
          <label class="field">Покрашено, шт
            <input type="number" name="painted" value="0" min="0" required id="shift-painted-input">
          </label>
          <label class="field">Упаковано, шт
            <input type="number" name="packed" value="0" min="0" required id="shift-packed-input">
          </label>
          <label class="field">Брак, шт
            <input type="number" name="scrap" value="0" min="0" required>
          </label>
          <label class="field full">Комментарий к смене
            <input type="text" name="comment" placeholder="Например: перенастроили стол принтера">
          </label>
        </div>

        <div id="live-shift-calc" style="background:#f0f5ef;padding:14px;border-radius:8px;margin-top:14px;font-size:13px;display:flex;justify-content:space-between;align-items:center">
          <span>Сдельное начисление за эту позицию:</span>
          <strong id="shift-earned-val" style="font-size:17px;color:#29583e">0 ₽</strong>
        </div>
      </div>
      <div class="dialog-actions">
        <button type="button" class="button" data-close="fig">Отмена</button>
        <button class="button primary" type="submit">${icon('check')} Зафиксировать смену</button>
      </div>
    </form>
  `;
  dialog.showModal();

  const updateCalc = () => {
    const sel = document.getElementById('shift-product-select');
    const opt = sel?.options[sel.selectedIndex];
    const cat = opt?.dataset.cat || 1;
    const rate = figurines.settings?.categories?.[cat] || 10;
    const painted = Number(document.getElementById('shift-painted-input')?.value || 0);
    const packed = Number(document.getElementById('shift-packed-input')?.value || 0);
    // Сдельная плата за готовое (упакованное или покрашенное)
    const count = Math.max(painted, packed);
    const sum = count * rate;
    document.getElementById('shift-earned-val').textContent = rub(sum);
  };

  document.getElementById('shift-product-select').onchange = updateCalc;
  document.getElementById('shift-painted-input').oninput = updateCalc;
  document.getElementById('shift-packed-input').oninput = updateCalc;

  document.getElementById('shift-add-form').onsubmit = e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const empId = fd.get('employeeId');
    const emp = employees.find(x => x.id === empId);
    const prodId = fd.get('productId');
    const prod = products.find(x => x.id === prodId);
    const printed = Number(fd.get('printed') || 0);
    const painted = Number(fd.get('painted') || 0);
    const packed = Number(fd.get('packed') || 0);
    const scrap = Number(fd.get('scrap') || 0);
    const cat = prod ? prod.category : 1;
    const rate = figurines.settings?.categories?.[cat] || 10;
    const earned = Math.max(painted, packed) * rate;

    const newShift = {
      id: 'sh_' + Date.now(),
      date: fd.get('date'),
      employee: emp ? emp.name : 'Сотрудник',
      employeeId: empId,
      productId: prodId,
      product: prod ? prod.name : '',
      printed, painted, packed, scrap,
      comment: fd.get('comment') || '',
      category: cat,
      earned
    };

    if (!figurines.shifts) figurines.shifts = [];
    figurines.shifts.push(newShift);

    // Увеличиваем физический остаток на складе на кол-во упакованного
    if (prod && packed > 0) {
      prod.ready = (Number(prod.ready) || 0) + packed;
      if (prod.toProduce > 0) {
        prod.toProduce = Math.max(0, prod.toProduce - packed);
        if (prod.toProduce === 0) prod.status = 'НОРМА';
      }
    }

    // Обновляем зарплатную ведомость за этот день
    let salRecord = (figurines.salary || []).find(s => s.date === newShift.date && s.employeeId === empId);
    if (!salRecord) {
      salRecord = {
        id: 'sal_' + Date.now(),
        date: newShift.date,
        employee: newShift.employee,
        employeeId: empId,
        itemsCat1: 0, itemsCat2: 0, itemsCat3: 0,
        base: figurines.settings?.baseShiftRate || 1000,
        pieceRate: 0,
        total: figurines.settings?.baseShiftRate || 1000,
        paid: false,
        paidDate: '',
        comment: ''
      };
      if (!figurines.salary) figurines.salary = [];
      figurines.salary.push(salRecord);
    }
    salRecord.pieceRate += earned;
    salRecord.total += earned;
    if (cat === 1) salRecord.itemsCat1 += Math.max(painted, packed);
    if (cat === 2) salRecord.itemsCat2 += Math.max(painted, packed);
    if (cat === 3) salRecord.itemsCat3 += Math.max(painted, packed);

    saveState();
    dialog.close();
    render();
    toast(`Смена мастера ${newShift.employee} зафиксирована (+${rub(earned)})`);
  };
}

function openRoleSwitchModal() {
  const dialog = document.getElementById('small-dialog');
  const employees = figurines.employees || [];
  const origin = window.location.origin + window.location.pathname;
  
  document.getElementById('small-body').innerHTML = `
    <div class="dialog-head">
      <h2 id="small-title">Вход и рабочие пространства</h2>
      <button type="button" class="close" data-close="small">×</button>
    </div>
    <div class="dialog-content">
      <p class="field-hint" style="margin-bottom:14px">Выберите ваш профиль для быстрого переключения или скопируйте персональную ссылку для мастера:</p>
      
      <div style="display:flex;flex-direction:column;gap:10px">
        <div style="border:1px solid var(--border);border-radius:10px;padding:12px;background:rgba(255,255,255,0.03)">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div>
              <div style="font-weight:700;font-size:15px">👑 Руководитель (Админка)</div>
              <small class="meta">Полный доступ: топоры, дашборд FBS, касса, все чаты</small>
            </div>
            <button class="button ${currentRole === 'admin' ? 'primary' : 'light'}" data-set-role="admin">
              ${currentRole === 'admin' ? '✓ Активен' : 'Войти'}
            </button>
          </div>
        </div>

        <div class="section-title" style="margin-top:10px">Мастера производства фигурок</div>
        ${employees.map(e => {
          const empLink = `${origin}?emp=${e.pin}`;
          return `
          <div style="border:1px solid var(--border);border-radius:10px;padding:12px;display:flex;flex-direction:column;gap:8px;background:rgba(255,255,255,0.02)">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <div>
                <div style="font-weight:700;font-size:15px">👷 ${esc(e.name)}</div>
                <small class="meta">ПИН-код: <code>${esc(e.pin)}</code> · Баланс: <strong style="color:var(--gold)">${rub(e.balance || 0)}</strong></small>
              </div>
              <button class="button ${currentRole === 'employee' && currentEmployeeId === e.id ? 'primary' : 'light'}" data-set-emp="${e.id}">
                ${currentRole === 'employee' && currentEmployeeId === e.id ? '✓ Активен' : 'Войти'}
              </button>
            </div>
            <div style="display:flex;align-items:center;gap:8px;padding-top:4px;border-top:1px dashed rgba(255,255,255,0.08)">
              <span style="font-size:11px;color:var(--text-muted);white-space:nowrap">Ссылка для смартфона:</span>
              <input type="text" readonly value="${empLink}" style="font-size:11px;padding:4px 8px;height:26px;flex:1;background:rgba(0,0,0,0.2);border:1px solid var(--border);border-radius:4px;color:var(--text)" id="link-emp-${e.id}">
              <button class="button light" style="font-size:11px;padding:4px 8px;height:26px" data-copy-link="${empLink}">Копировать</button>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>
    <div class="dialog-actions">
      <button class="button" data-close="small">Закрыть</button>
    </div>
  `;
  dialog.showModal();

  dialog.querySelectorAll('[data-copy-link]').forEach(btn => {
    btn.onclick = async () => {
      try {
        await navigator.clipboard.writeText(btn.dataset.copyLink);
        toast('Персональная ссылка скопирована! Отправьте её мастеру');
      } catch (err) {
        toast('Выделите и скопируйте ссылку из поля');
      }
    };
  });
}

function openPayoutModal(employeeId) {
  const emp = (figurines.employees || []).find(e => e.id === employeeId);
  if (!emp) return;
  const salary = (figurines.salary || []).filter(x => x.employeeId === employeeId && !x.paid);
  const totalDue = salary.reduce((s, x) => s + Number(x.total || 0), 0);

  const dialog = document.getElementById('small-dialog');
  document.getElementById('small-body').innerHTML = `
    <div class="dialog-head">
      <h2 id="small-title">Выплата зарплаты: ${esc(emp.name)}</h2>
      <button type="button" class="close" data-close="small">×</button>
    </div>
    <div class="dialog-content">
      <p style="font-size:15px;line-height:1.6">Подтверждаете перевод средств мастеру <strong>${esc(emp.name)}</strong> на сумму <strong style="color:#2a5538">${rub(totalDue)}</strong>?</p>
      <p class="field-hint" style="margin-top:10px">Все ${salary.length} открытых смен будут отмечены как оплаченные с сегодняшней датой.</p>
    </div>
    <div class="dialog-actions">
      <button class="button" data-close="small">Отмена</button>
      <button class="button primary" id="confirm-payout-btn" style="background:#20a144;border-color:#1c8f3c">${icon('check')} Подтвердить выплату</button>
    </div>
  `;
  dialog.showModal();

  document.getElementById('confirm-payout-btn').onclick = () => {
    const todayStr = new Date().toLocaleDateString('ru-RU');
    salary.forEach(s => {
      s.paid = true;
      s.paidDate = todayStr;
    });
    saveState();
    dialog.close();
    render();
    toast(`Выплата ${rub(totalDue)} мастеру ${emp.name} зафиксирована!`);
  };
}

// ==========================================
// 🪓 РАЗДЕЛ ЗАКАЗОВ ТОПОРОВ (СОХРАНЁН ПОЛНОСТЬЮ)
// ==========================================

function ordersPage() {
  const archive = view === 'archive';
  return pageHead(archive ? 'Архив заказов' : 'Заказы', archive ? 'Завершённые заказы и отказы. Вся история под рукой.' : 'От первого эскиза до готового топора.') +
    (archive ? '' : stats()) +
    `<section class="panel">
      <div class="toolbar">
        <div class="tabs" aria-label="Фильтры заказов">
          ${(archive ? [['all', 'Все завершённые']] : [['all', 'Все заказы'], ['urgent', 'Требуют внимания'], ['ready', 'Готовы']]).map(([id, label]) => `
            <button class="tab ${tab === id ? 'active' : ''}" data-tab="${id}" aria-pressed="${tab === id}">
              ${label}${id === 'all' ? `<span class="tab-count">${orders.filter(o => archive ? !active(o) : active(o)).length}</span>` : ''}
            </button>
          `).join('')}
        </div>
        <div class="filters">
          <div class="search">${icon('search')}<input id="search" aria-label="Поиск заказов" placeholder="Клиент, телефон, тема…" value="${esc(query)}"></div>
          <select id="status-filter" aria-label="Статус заказа">
            <option value="">Все статусы</option>
            ${statuses.filter(s => archive ? ['Закрыт', 'Отказ'].includes(s) : !['Закрыт', 'Отказ'].includes(s)).map(s => statusOption(s, statusFilter)).join('')}
          </select>
        </div>
      </div>
      <div id="table-area"></div>
      <div class="table-foot"><span id="result-count"></span><span>Перетаскивайте строки за ручку слева</span></div>
    </section>
    <div class="bottom-note">${icon('folder')} ТЗ и эскизы для сотрудника — по ссылке на Google Drive</div>`;
}

function overview() {
  const attention = orders.filter(o => overdue(o) || (active(o) && o.due === today)).sort((a, b) => a.due.localeCompare(b.due));
  return pageHead('Обзор мастерской', 'Сроки, задачи и деньги — всё на одном экране.') + stats() +
    `<div class="dashboard-columns">
      <section class="panel">
        <div class="panel-title"><h2>На что обратить внимание</h2></div>
        ${attention.length ? attention.map(o => {
          const dueInfo = getDueStatus(o);
          return `
            <div class="agenda-item">
              <span class="monogram">${esc(o.client[0])}</span>
              <div>
                <button class="order-name" data-open="${o.id}">${esc(o.client)} · ${esc(o.id)}</button>
                <div class="meta">${esc(o.theme)}</div>
              </div>
              <div style="text-align:right">
                <div class="due ${dueInfo.isOverdue ? 'late bold-red' : dueInfo.isToday ? 'warn' : ''}">${dateLabel(o.due)}</div>
                ${dueInfo.text ? `<div class="meta due-meta ${dueInfo.isOverdue ? 'overdue-alert' : dueInfo.isToday ? 'today-alert' : ''}">${dueInfo.text}</div>` : ''}
              </div>
            </div>
          `;
        }).join('') : '<div class="empty">Срочных дел по срокам нет</div>'}
      </section>
      <section class="panel">
        <div class="panel-title"><h2>Этапы работы</h2><span class="meta">Активные заказы</span></div>
        <div style="padding:12px 0">
          ${statuses.filter(s => !['Закрыт', 'Отказ'].includes(s)).map(s => {
            const n = orders.filter(o => o.status === s).length;
            return `
              <div class="stage-row">
                <span>${s}</span>
                <div class="stage-track"><span style="width:${n / Math.max(orders.filter(active).length, 1) * 100}%"></span></div>
                <span>${n}</span>
              </div>
            `;
          }).join('')}
        </div>
      </section>
    </div>`;
}

function sketchesPage() {
  const list = orders.filter(active);
  return pageHead('Эскизы', 'Задания, правки и согласованные рисунки.').replace('<button class="button primary" data-action="new">', '<button class="button primary" data-action="create-sketch">').replace('Новый заказ</button>', 'Создать эскиз</button>') +
    `<div class="sketch-grid">
      ${list.map(o => `
        <article class="sketch-card">
          ${imagePreview(o.image, true)}
          <div class="sketch-content">
            <span class="badge ${o.sketch === 'Согласован' ? 'ready' : 'sketch'}">${esc(o.sketch)}</span>
            <h3>${esc(o.theme || 'Новый эскиз')}</h3>
            <p class="meta">${esc(o.id)} · ${esc(o.client)}</p>
            <button class="button" data-open="${o.id}">Открыть задание ${icon('arrow')}</button>
            <button class="button primary sketch-create" data-sketch-order="${o.id}">${icon('sketch')} Создать эскиз</button>
          </div>
        </article>
      `).join('') || '<div class="empty">Пока нет активных заказов</div>'}
    </div>`;
}

function moneyPage() {
  const earned = ledger.filter(x => x.type === 'earned').reduce((s, x) => s + x.amount, 0),
        paid = ledger.filter(x => x.type === 'paid').reduce((s, x) => s + x.amount, 0),
        balance = earned - paid;
  return pageHead('Взаиморасчёты с Димой', 'Заработок за выполненную работу и ваши переводы.', false) +
    `<div class="stats" style="grid-template-columns:repeat(3,minmax(0,1fr))">
      <div class="stat"><div class="stat-label">Дима заработал</div><div class="stat-value">${rub(earned)}</div></div>
      <div class="stat"><div class="stat-label">Вы перевели</div><div class="stat-value">${rub(paid)}</div></div>
      <div class="stat selected"><div class="stat-label">${balance >= 0 ? 'Осталось выплатить' : 'Аванс у Димы'}</div><div class="stat-value">${rub(Math.abs(balance))}</div></div>
    </div>
    <section class="panel">
      <div class="toolbar">
        <h2>Операции</h2>
        <div class="ledger-head">
          <button class="button" data-ledger="earned">${icon('plus')} Начислить</button>
          <button class="button primary" data-ledger="paid">${icon('wallet')} Записать перевод</button>
        </div>
      </div>
      <table class="ledger-table">
        <thead>
          <tr><th>ДАТА</th><th>ОПЕРАЦИЯ</th><th class="ledger-note">КОММЕНТАРИЙ</th><th>СУММА</th><th></th></tr>
        </thead>
        <tbody>
          ${ledger.map((x, i) => ({ x, i })).sort((a, b) => b.x.date.localeCompare(a.x.date)).map(({ x, i }) => `
            <tr>
              <td>${dateLabel(x.date)}</td>
              <td class="ledger-type">${x.type === 'earned' ? 'Начислено за работу' : 'Перевод Диме'}${x.order ? `<div class="meta">${esc(x.order)}</div>` : ''}</td>
              <td class="ledger-note">${esc(x.note)}</td>
              <td class="${x.type === 'earned' ? 'positive' : 'negative'}">${rub(x.amount)}</td>
              <td><button class="text-button" data-ledger-edit="${i}">Изменить</button></td>
            </tr>
          `).join('') || '<tr><td colspan="5">Пока нет операций</td></tr>'}
        </tbody>
      </table>
    </section>
    <p class="balance-note">Остаток к выплате = заработано − переведено. Оплаты клиентов учитываются в карточках заказов.</p>`;
}

function stats() {
  const a = orders.filter(active);
  return `<div class="stats">
    <div class="stat selected"><div class="stat-label">В работе ${icon('orders')}</div><div class="stat-value">${a.length}<span style="font-size:14px;font-weight:400;letter-spacing:0;margin-left:9px">заказов</span></div><div class="stat-note">${a.filter(o => o.status === 'В производстве').length} в производстве</div></div>
    <div class="stat"><div class="stat-label">Нужен эскиз ${icon('sketch')}</div><div class="stat-value">${a.filter(needsSketch).length}</div><div class="stat-note">Подготовить или согласовать</div></div>
    <div class="stat"><div class="stat-label">Просрочено ${icon('clock')}</div><div class="stat-value">${a.filter(overdue).length}</div><div class="stat-note warn">${a.filter(o => o.due === today).length} со сроком сегодня</div></div>
    <div class="stat"><div class="stat-label">Остаток к оплате ${icon('wallet')}</div><div class="stat-value">${rub(a.reduce((s, o) => s + debt(o), 0))}</div><div class="stat-note">По активным заказам</div></div>
  </div>`;
}

function pageHead(title, sub, button = true) {
  return `<div class="page-head">
    <div><div class="eyebrow">МОЯ МАСТЕРСКАЯ</div><h1>${title}</h1><p class="subtitle">${sub}</p></div>
    ${button ? `<button class="button primary" data-action="new">${icon('plus')} Новый заказ</button>` : ''}
  </div>`;
}

function filtered() {
  return orders.filter(o =>
    (view === 'archive' ? !active(o) : active(o)) &&
    (tab !== 'urgent' || o.priority === 'Срочно' || overdue(o)) &&
    (tab !== 'ready' || o.status === 'Готов') &&
    (!statusFilter || o.status === statusFilter) &&
    (!query || [o.id, o.client, o.theme, o.task, o.contact].join(' ').toLowerCase().includes(query.toLowerCase()))
  );
}

function rowsHTML(rows) {
  if (!rows.length) return `<div class="empty"><h3>Заказов не найдено</h3><p>Измените фильтры или создайте новый заказ.</p><button class="button" data-action="clear">Сбросить фильтры</button></div>`;
  return `<table class="order-table">
    <thead>
      <tr><th>ЗАКАЗ / КЛИЕНТ</th><th>ТЕЛЕФОН</th><th class="theme-col">ЗАМЫСЕЛ</th><th>СТАТУС</th><th>СРОК</th><th>СТОИМОСТЬ / ОСТАТОК</th><th></th></tr>
    </thead>
    <tbody>
      ${rows.map(o => {
        const dueInfo = getDueStatus(o);
        return `
          <tr data-order-id="${o.id}">
            <td class="order-main">
              <div class="order-cell">
                <button class="drag-handle" type="button" data-drag="${o.id}" aria-label="Переместить ${esc(o.id)}" title="Перетащите строку">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5h1 M15 5h1 M8 12h1 M15 12h1 M8 19h1 M15 19h1"/></svg>
                </button>
                <span class="monogram">${esc(o.client.slice(0, 1))}</span>
                <div>
                  <button class="order-name" data-open="${o.id}">${esc(o.client)}</button>
                  <div class="meta"><span class="order-id">${esc(o.id)}</span>${o.priority === 'Срочно' ? '<span class="priority">Срочно</span>' : ''}</div>
                </div>
              </div>
            </td>
            <td class="phone-col"><span class="mobile-label">Телефон:</span>${phoneHTML(o.contact)}</td>
            <td class="theme-col"><div class="theme">${esc(o.theme || 'Без названия')}</div><div class="meta">${esc(o.sketch)}</div></td>
            <td class="status-col">${inlineStatus(o)}</td>
            <td class="due-col">
              <div class="due ${dueInfo.isOverdue ? 'late bold-red' : dueInfo.isToday ? 'warn' : ''}"><span class="mobile-label">Срок:</span>${dateLabel(o.due)}</div>
              ${dueInfo.text ? `<div class="meta due-meta ${dueInfo.isOverdue ? 'overdue-alert' : dueInfo.isToday ? 'today-alert' : ''}">${dueInfo.text}</div>` : ''}
            </td>
            <td class="money-col">
              <div class="money">${rub(total(o))}</div>
              <div class="meta ${debt(o) === 0 ? 'paid' : ''}">${debt(o) === 0 ? (o.paid > total(o) ? 'Переплата ' + rub(o.paid - total(o)) : 'Оплачено') : 'Остаток ' + rub(debt(o))}</div>
            </td>
            <td class="open-col"><button class="row-open" data-open="${o.id}" aria-label="Открыть ${esc(o.id)}"><span class="open-order-label">Открыть заказ</span><span aria-hidden="true">›</span></button></td>
          </tr>
        `;
      }).join('')}
    </tbody>
  </table>`;
}

function updateList() {
  const rows = filtered();
  const tableArea = document.getElementById('table-area');
  if (tableArea) tableArea.innerHTML = rowsHTML(rows);
  const resultCount = document.getElementById('result-count');
  if (resultCount) resultCount.textContent = `Показано ${rows.length} из ${orders.filter(o => view === 'archive' ? !active(o) : active(o)).length} заказов`;
}

// Карточка заказа топора
const orderDialog = document.getElementById('order-dialog'), smallDialog = document.getElementById('small-dialog');
let editing = null;
const input = (label, name, value, type = 'text', full = false, extra = '') => `<label class="field ${full ? 'full' : ''}">${label}<input type="${type}" name="${name}" value="${esc(value)}" ${extra}></label>`;
const select = (label, name, value, options) => `<label class="field">${label}<select name="${name}" ${name === 'status' ? `style="${statusStyle(value)}"` : ''}>${options.map(s => name === 'status' ? statusOption(s, value) : `<option ${s === value ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></label>`;

function safeURL(s) {
  if (!s) return '';
  try {
    const u = new URL(s);
    return u.protocol === 'https:' ? u.href : '';
  } catch {
    return '';
  }
}

function formatDateInput(val) {
  if (!val) return '';
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(val)) {
    const [d, m, y] = val.split('.');
    return `${y}-${m}-${d}`;
  }
  return val;
}

function normalizeOrder(o) {
  return {
    id: o.id || 'З-0000', client: o.client || '', theme: o.theme || '', contact: o.contact || o.phone || '',
    status: o.status || 'Новый', priority: o.priority || 'Обычный',
    created: formatDateInput(o.created || o.dateRec || ''), due: formatDateInput(o.due || o.dateReady || ''),
    sketch: o.sketch || o.sketchStatus || 'Нет эскиза', task: o.task || o.desc || '',
    axe: Number(o.axe ?? o.priceAxe ?? 0), sheath: Number(o.sheath ?? 0), box: Number(o.box ?? o.priceBox ?? 0),
    shipping: Number(o.shipping ?? o.priceShip ?? 0), paid: Number(o.paid ?? 0),
    delivery: o.delivery || 'СДЭК', address: o.address || '', folder: o.folder || o.folderUrl || '',
    image: o.image || o.sketchUrl || '', note: o.note || '', history: Array.isArray(o.history) ? o.history : []
  };
}

function openOrder(id) {
  const raw = orders.find(o => o.id === id);
  editing = raw ? raw.id : null;
  const o = raw ? normalizeOrder(raw) : {
    id: 'Новый заказ', client: '', theme: '', contact: '', status: 'Новый', priority: 'Обычный',
    created: today, due: '', sketch: 'Нет эскиза', task: '', axe: 15000, sheath: 0, box: 0,
    shipping: 0, paid: 0, delivery: 'СДЭК', address: '', folder: '', image: '', note: '', history: []
  };
  const dueInfo = raw ? getDueStatus(raw) : { isOverdue: false, text: '' };

  document.getElementById('order-body').innerHTML = `
    <form id="order-form">
      <div class="dialog-head">
        <div>
          <div class="eyebrow">${esc(o.id)} · КАРТОЧКА ЗАКАЗА ${dueInfo.text ? `<span class="meta due-meta ${dueInfo.isOverdue ? 'overdue-alert' : dueInfo.isToday ? 'today-alert' : ''}" style="margin-left:8px;vertical-align:middle">${dueInfo.text}</span>` : ''}</div>
          <h2 id="order-title">${raw ? esc(o.client) : 'Новый заказ'}</h2>
        </div>
        <button type="button" class="close" data-close="order" aria-label="Закрыть">×</button>
      </div>
      <div class="dialog-content">
        <div class="form-grid">
          ${input('Клиент *', 'client', o.client, 'text', false, 'required maxlength="100"')}
          ${input('Телефон', 'contact', o.contact, 'tel', false, 'maxlength="150" placeholder="+7 …"')}
          ${input('Тема / название заказа', 'theme', o.theme, 'text', true, 'maxlength="160"')}
          ${select('Статус заказа', 'status', o.status, statuses)}
          ${select('Приоритет', 'priority', o.priority, ['Обычный', 'Срочно', 'Низкий'])}
          ${input('Дата принятия', 'created', o.created, 'date')}
          ${input('Дата готовности', 'due', o.due, 'date')}
        </div>
        <div class="section-title">Задание и эскиз</div>
        <div class="form-grid">
          <label class="field full">Техническое задание
            <textarea name="task" maxlength="10000" placeholder="Форма топора, рисунки на обеих сторонах, надписи, отделка…">${esc(o.task)}</textarea>
          </label>
          ${select('Состояние эскиза', 'sketch', o.sketch, sketchStatuses)}
          ${input('Ссылка на папку Google Drive', 'folder', o.folder, 'url', false, 'placeholder="https://drive.google.com/…"')}
          ${input('Ссылка на эскиз — Google Drive или изображение', 'image', o.image, 'url', true, 'placeholder="https://drive.google.com/file/d/…/view"')}
        </div>
        <p class="field-hint" style="margin-top:8px">Вставьте ссылку именно на файл эскиза. Ссылка на папку указывается отдельно.</p>
        <div id="order-image-preview">${imagePreview(o.image)}</div>
        <div class="copy-section">
          <button class="button light" type="button" data-action="copy-task">${icon('copy')} Скопировать ТЗ сотруднику</button>
          <button class="button light" type="button" data-action="open-folder">${icon('folder')} Открыть папку</button>
        </div>
        <div class="section-title">Стоимость и оплата · только для вас</div>
        <div class="form-grid four">
          ${input('Топор, ₽', 'axe', o.axe, 'number', false, 'min="0" max="100000000" step="1" required')}
          ${input('Чехол, ₽', 'sheath', o.sheath, 'number', false, 'min="0" max="100000000" step="1" required')}
          ${input('Короб, ₽', 'box', o.box, 'number', false, 'min="0" max="100000000" step="1" required')}
          ${input('Доставка, ₽', 'shipping', o.shipping, 'number', false, 'min="0" max="100000000" step="1" required')}
        </div>
        <div class="form-grid" style="margin-top:18px">
          ${input('Всего оплачено клиентом, ₽', 'paid', o.paid, 'number', false, 'min="0" max="100000000" step="1" required')}
          ${select('Способ доставки', 'delivery', o.delivery, ['СДЭК', 'Самовывоз', 'Ozon', 'Пятёрочка', 'Почта России', 'Курьер', 'Другое'])}
        </div>
        <div id="live-total" class="total-strip"></div>
        <div class="form-grid" style="margin-top:20px">
          ${input('Адрес доставки', 'address', o.address, 'text', true, 'maxlength="1000"')}
          <label class="field full">Личные заметки
            <textarea name="note" maxlength="5000" placeholder="Не попадут в текст для сотрудника">${esc(o.note)}</textarea>
          </label>
        </div>
        ${o.history.length ? `<div class="section-title">История изменений</div><div class="history">${o.history.slice(-5).reverse().map(esc).join('<br>')}</div>` : ''}
      </div>
      <div class="dialog-actions">
        ${raw ? `<button class="button" type="button" data-action="archive-order">${icon('archive')} ${active(o) ? 'В архив' : 'Вернуть в работу'}</button>` : '<span></span>'}
        <div class="right">
          <button type="button" class="button" data-close="order">Отмена</button>
          <button class="button primary" type="submit">${icon('check')} Сохранить</button>
        </div>
      </div>
    </form>`;
  updateTotal(o);
  const od = document.getElementById('order-dialog');
  if (od) {
    if (od.open) od.close();
    try { od.showModal(); } catch { od.setAttribute('open', ''); }
  }
}

function draft() {
  const form = document.getElementById('order-form');
  if (!form) return { axe: 0, sheath: 0, box: 0, shipping: 0, paid: 0 };
  const f = new FormData(form);
  const o = Object.fromEntries(f);
  for (const k of ['axe', 'sheath', 'box', 'shipping', 'paid']) o[k] = Number(o[k] || 0);
  return o;
}

function updateTotal(provided) {
  const o = provided || draft();
  const t = total(o);
  const p = Number(o.paid || 0);
  const d = Math.max(0, t - p);
  const el = document.getElementById('live-total');
  if (el) {
    el.innerHTML = `<div>Стоимость<strong>${rub(t)}</strong></div><div>Оплачено<strong>${rub(p)}</strong></div><div>${p > t ? 'Переплата' : 'Остаток'}<strong>${rub(p > t ? p - t : d)}</strong></div>`;
  }
}

function saveOrder(status) {
  const form = document.getElementById('order-form');
  if (!form.reportValidity()) return;
  const o = draft();
  o.client = o.client.trim();
  if (!o.client) { toast('Укажите имя клиента'); return; }
  for (const name of ['folder', 'image']) {
    if (o[name] && !safeURL(o[name])) {
      toast('Используйте ссылку, начинающуюся с https://');
      return;
    }
  }
  if (status) o.status = status;
  const previous = orders.find(x => x.id === editing);
  o.id = previous?.id || 'З-' + String(sequence++).padStart(4, '0');
  o.history = [...(previous?.history || []), `${new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} · ${previous ? 'Заказ обновлён' : 'Заказ создан'} · ${o.status}`];
  if (previous) orders[orders.indexOf(previous)] = o;
  else orders.unshift(o);
  saveState();
  orderDialog.close();
  render();
  toast('Заказ сохранён');
}

async function copyTask() {
  const o = draft();
  const text = employeeTaskText(o, editing);
  try {
    await navigator.clipboard.writeText(text);
    toast('ТЗ скопировано — с контактами и ссылками');
  } catch {
    document.getElementById('small-body').innerHTML = `
      <div class="dialog-head"><h2 id="small-title">ТЗ для сотрудника</h2><button class="close" data-close="small">×</button></div>
      <div class="dialog-content"><textarea class="copy-text" readonly>${esc(text)}</textarea></div>
    `;
    smallDialog.showModal();
    smallDialog.querySelector('textarea').select();
  }
}

function ledgerDialog(type, index = null) {
  const x = index === null ? { type, amount: '', date: today, order: '', note: '' } : ledger[index];
  document.getElementById('small-body').innerHTML = `
    <form id="ledger-form" data-index="${index ?? ''}">
      <div class="dialog-head">
        <h2 id="small-title">${index !== null ? 'Изменить операцию' : type === 'earned' ? 'Начислить за работу' : 'Записать перевод'}</h2>
        <button type="button" class="close" data-close="small">×</button>
      </div>
      <div class="dialog-content">
        <input type="hidden" name="type" value="${x.type}">
        <div class="form-grid">
          ${input('Дата', 'date', x.date, 'date', false, 'required')}
          ${input('Сумма, ₽', 'amount', x.amount, 'number', false, 'required min="1" max="100000000" step="1"')}
          <label class="field full">Заказ (необязательно)
            <select name="order">
              <option value="">Без привязки к заказу</option>
              ${orders.map(o => `<option value="${o.id}" ${o.id === x.order ? 'selected' : ''}>${o.id} · ${esc(o.client)}</option>`).join('')}
            </select>
          </label>
          ${input('Комментарий', 'note', x.note, 'text', true, 'maxlength="500"')}
        </div>
      </div>
      <div class="dialog-actions">
        <button class="button" type="button" data-close="small">Отмена</button>
        <button class="button primary" type="submit">Сохранить</button>
      </div>
    </form>`;
  smallDialog.showModal();
}

// Глобальный слушатель кликов
document.addEventListener('click', e => {
  // 1. Проектный переключатель
  const projBtn = e.target.closest('[data-proj]');
  if (projBtn) {
    currentProject = projBtn.dataset.proj;
    localStorage.setItem('topordorf_project', currentProject);
    view = currentProject === 'topor' 
      ? 'orders' 
      : currentProject === 'chat' 
        ? 'chat' 
        : (currentRole === 'admin' ? 'fig_dashboard' : 'emp_workspace');
    render();
    return;
  }

  // 2. Кнопка чата в шапке
  if (e.target.closest('#chat-nav-btn')) {
    currentProject = 'chat';
    localStorage.setItem('topordorf_project', currentProject);
    view = 'chat';
    render();
    return;
  }

  // 3. Кнопка смены роли (Руководитель / Сотрудник)
  if (e.target.closest('#role-switch-btn')) {
    openRoleSwitchModal();
    return;
  }

  // 4. Переключение роли из модалки
  const setRoleBtn = e.target.closest('[data-set-role]');
  if (setRoleBtn) {
    if (currentRole === 'employee') {
      const pass = prompt('Вход в панель руководителя. Введите пароль (по умолчанию 7417):');
      if (!pass || pass.trim() !== '7417') {
        toast('Неверный пароль руководителя');
        return;
      }
    }
    currentRole = 'admin';
    localStorage.setItem('topordorf_role', 'admin');
    smallDialog.close();
    toast('Режим: Руководитель (Админка)');
    if (currentProject === 'figurines') view = 'fig_dashboard';
    render();
    return;
  }

  const setEmpBtn = e.target.closest('[data-set-emp]');
  if (setEmpBtn) {
    const targetEmpId = setEmpBtn.dataset.setEmp;
    const emp = (figurines.employees || []).find(x => x.id === targetEmpId);
    if (!emp) return;

    if (currentRole === 'employee' && currentEmployeeId !== targetEmpId) {
      const inputPin = prompt(`Введите ПИН-код мастера ${emp.name} (по умолчанию ${emp.pin}):`);
      if (!inputPin || inputPin.trim() !== String(emp.pin).trim()) {
        toast('Неверный ПИН-код');
        return;
      }
    }

    currentRole = 'employee';
    currentEmployeeId = targetEmpId;
    localStorage.setItem('topordorf_role', 'employee');
    localStorage.setItem('topordorf_emp_id', currentEmployeeId);
    smallDialog.close();
    toast(`Вход выполнен: ${emp.name}`);
    if (currentProject === 'figurines') view = 'emp_workspace';
    render();
    return;
  }

  // 5. Переключение каналов в чате
  const chBtn = e.target.closest('[data-channel]');
  if (chBtn) {
    activeChatChannel = chBtn.dataset.channel;
    render();
    return;
  }

  // 6. Редактирование товара фигурок
  const figEditBtn = e.target.closest('[data-edit-fig]');
  if (figEditBtn) {
    openFigurineEdit(figEditBtn.dataset.editFig);
    return;
  }

  // 7. Действия фигурок
  if (e.target.closest('[data-action="new-shift"]')) {
    openShiftModal();
    return;
  }
  if (e.target.closest('[data-action="new-product"]')) {
    toast('Создание новой позиции: используйте кнопку «Изменить» в строках');
    return;
  }
  if (e.target.closest('[data-action="quick-adjust"]')) {
    if (figurines.products?.[0]) openFigurineEdit(figurines.products[0].id);
    return;
  }

  // 8. Выплаты зарплаты
  const payoutEmpBtn = e.target.closest('[data-payout-emp]');
  if (payoutEmpBtn) {
    openPayoutModal(payoutEmpBtn.dataset.payoutEmp);
    return;
  }
  const payoutSingleBtn = e.target.closest('[data-payout-single]');
  if (payoutSingleBtn) {
    const sal = (figurines.salary || []).find(s => s.id === payoutSingleBtn.dataset.payoutSingle);
    if (sal) {
      sal.paid = true;
      sal.paidDate = new Date().toLocaleDateString('ru-RU');
      saveState();
      render();
      toast(`Смена за ${sal.date} (${sal.employee}) отмечена как оплаченная`);
    }
    return;
  }

  // 9. Закрытие модалок
  const closeBtn = e.target.closest('[data-close]');
  if (closeBtn) {
    const which = closeBtn.dataset.close;
    if (which === 'order') orderDialog?.close();
    else if (which === 'fig') document.getElementById('fig-dialog')?.close();
    else smallDialog?.close();
    return;
  }

  // 10. Клик по строке заказа топора
  if (e.target.closest('.inline-status, .phone-link, .drag-handle, input, select, textarea, .edit-icon-btn, button')) return;
  const tr = e.target.closest('tr[data-order-id]');
  if (tr && tr.dataset.orderId) {
    openOrder(tr.dataset.orderId);
    return;
  }

  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.open) { openOrder(b.dataset.open); return; }
  if (b.dataset.tab) { tab = b.dataset.tab; render(); return; }
  if (b.dataset.ledger) { ledgerDialog(b.dataset.ledger); return; }
  if (b.dataset.ledgerEdit !== undefined) { ledgerDialog('', Number(b.dataset.ledgerEdit)); return; }
  const action = b.dataset.action;
  if (action === 'new') openOrder();
  if (action === 'clear') { query = ''; statusFilter = ''; tab = 'all'; render(); }
  if (action === 'copy-task') copyTask();
  if (action === 'open-folder') {
    const url = safeURL(draft().folder);
    if (!url) { toast('Сначала добавьте HTTPS-ссылку на папку'); return; }
    window.open(url, '_blank', 'noopener,noreferrer');
  }
  if (action === 'archive-order') {
    const o = orders.find(x => x.id === editing);
    saveOrder(active(o) ? 'Закрыт' : 'Новый');
  }
});

// Слушатели поиска и фильтров
document.addEventListener('input', e => {
  if (e.target.id === 'search') { query = e.target.value; updateList(); }
  if (e.target.closest('#order-form') && ['axe', 'sheath', 'box', 'shipping', 'paid'].includes(e.target.name)) updateTotal();
});
document.addEventListener('change', e => {
  if (e.target.id === 'status-filter') { statusFilter = e.target.value; updateList(); }
});
document.addEventListener('submit', e => {
  if (e.target.id === 'order-form') { e.preventDefault(); saveOrder(); }
  if (e.target.id === 'ledger-form') {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    f.amount = Number(f.amount);
    const i = e.target.dataset.index;
    if (i === '') ledger.push(f);
    else ledger[Number(i)] = f;
    saveState();
    smallDialog.close();
    render();
    toast('Операция сохранена');
  }
});

// Сброс и экспорт/импорт
document.getElementById('reset').onclick = () => {
  document.getElementById('small-body').innerHTML = `
    <div class="dialog-head"><h2 id="small-title">Сбросить данные?</h2><button class="close" data-close="small">×</button></div>
    <div class="dialog-content"><p style="font-size:14px;line-height:1.7">Все ваши изменения в заказах будут сброшены к исходным.</p></div>
    <div class="dialog-actions"><button class="button" data-close="small">Отмена</button><button class="button primary" id="confirm-reset">Сбросить</button></div>
  `;
  smallDialog.showModal();
  document.getElementById('confirm-reset').onclick = () => {
    saveState();
    smallDialog.close();
    render();
    toast('Данные восстановлены');
  };
};

function exportData() {
  const data = { appName: 'Topordorf CRM', exportDate: new Date().toISOString(), version: 2, orders, ledger, sequence, figurines };
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `topordorf_crm_backup_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast('Резервная копия скачана (JSON)');
}
document.getElementById('export-json')?.addEventListener('click', exportData);

function phoneHTML(contact) {
  const value = String(contact || '').trim();
  if (!value) return '<span class="phone-empty">—</span>';
  const number = value.replace(/[\s().-]/g, '');
  return /^[+]?[0-9]{7,15}$/.test(number) ? `<a class="phone-link" href="tel:${esc(number)}">${esc(value)}</a>` : `<span class="phone-value">${esc(value)}</span>`;
}

// Drag-and-drop сортировка заказов
function reorderVisible(source, target, after = false) {
  const visible = filtered(); const from = visible.findIndex(o => o.id === source);
  if (from < 0 || source === target || !visible.some(o => o.id === target)) return false;
  const [moved] = visible.splice(from, 1);
  const to = visible.findIndex(o => o.id === target);
  visible.splice(to + (after ? 1 : 0), 0, moved);
  const ids = new Set(visible.map(o => o.id)); let n = 0;
  orders = orders.map(o => ids.has(o.id) ? visible[n++] : o);
  return true;
}
let rowDrag = null;
function dragTarget() {
  if (!rowDrag) return;
  document.querySelectorAll('.drop-before,.drop-after').forEach(el => el.classList.remove('drop-before', 'drop-after'));
  const rows = [...document.querySelectorAll('.order-table tbody tr')];
  const table = document.querySelector('.order-table');
  const box = table?.getBoundingClientRect();
  if (!box || rowDrag.x < box.left || rowDrag.x > box.right) { rowDrag.target = null; return; }
  let row = rows.find(r => { const b = r.getBoundingClientRect(); return rowDrag.y >= b.top && rowDrag.y <= b.bottom; });
  if (!row && rows.length) {
    if (rowDrag.y < rows[0].getBoundingClientRect().top) row = rows[0];
    else if (rowDrag.y > rows.at(-1).getBoundingClientRect().bottom) row = rows.at(-1);
  }
  if (!row || row.dataset.orderId === rowDrag.id) { rowDrag.target = null; return; }
  const b = row.getBoundingClientRect();
  rowDrag.target = row.dataset.orderId;
  rowDrag.after = rowDrag.y > b.top + b.height / 2;
  row.classList.add(rowDrag.after ? 'drop-after' : 'drop-before');
}
function dragScroll() {
  if (!rowDrag) return;
  if (rowDrag.started) {
    const margin = 70;
    const step = rowDrag.y < margin ? -12 : rowDrag.y > innerHeight - margin ? 12 : 0;
    if (step) { window.scrollBy(0, step); dragTarget(); }
  }
  rowDrag.frame = requestAnimationFrame(dragScroll);
}
function finishDrag(commit) {
  if (!rowDrag) return;
  const d = rowDrag; rowDrag = null; cancelAnimationFrame(d.frame);
  document.body.classList.remove('reordering');
  document.querySelectorAll('.dragging,.drop-before,.drop-after').forEach(el => el.classList.remove('dragging', 'drop-before', 'drop-after'));
  if (d.handle.hasPointerCapture(d.pointer)) d.handle.releasePointerCapture(d.pointer);
  if (commit && d.started && d.target && reorderVisible(d.id, d.target, d.after)) {
    saveState(); updateList(); document.querySelector(`[data-drag="${d.id}"]`)?.focus({ preventScroll: true }); toast('Порядок заказов изменён');
  }
}
document.addEventListener('pointerdown', e => {
  const handle = e.target.closest('[data-drag]'); if (!handle || !e.isPrimary || e.button !== 0) return;
  e.preventDefault(); handle.focus({ preventScroll: true });
  rowDrag = { id: handle.dataset.drag, handle, pointer: e.pointerId, x: e.clientX, y: e.clientY, startY: e.clientY, started: false, target: null };
  handle.setPointerCapture(e.pointerId); rowDrag.frame = requestAnimationFrame(dragScroll);
});
document.addEventListener('pointermove', e => {
  if (!rowDrag || e.pointerId !== rowDrag.pointer) return;
  rowDrag.x = e.clientX; rowDrag.y = e.clientY;
  if (!rowDrag.started && Math.abs(e.clientY - rowDrag.startY) > 5) {
    rowDrag.started = true; rowDrag.handle.closest('tr').classList.add('dragging'); document.body.classList.add('reordering');
  }
  if (rowDrag.started) { e.preventDefault(); dragTarget(); }
}, { passive: false });
document.addEventListener('pointerup', e => { if (rowDrag && e.pointerId === rowDrag.pointer) finishDrag(true); });
document.addEventListener('pointercancel', () => finishDrag(false));
document.addEventListener('lostpointercapture', () => finishDrag(false));

// Генератор промтов для эскизов
const SKETCH_RULES = `Создай готовый чёрно-белый эскиз для лазерной гравировки двух сторон топора по прикреплённому шаблону.
КОНТУР И РАЗМЕЩЕНИЕ: Используй прикреплённый контур двух топоров как неизменяемый шаблон. Строго сохрани внешнюю геометрию и пропорции.`;
function composeSketchPrompt(theme, task) {
  return `Тема эскиза: ${theme.trim() || '[УКАЖИТЕ ТЕМУ]'}${task.trim() ? '\n\nПожелания к рисунку:\n' + task.trim() : ''}\n\n${SKETCH_RULES}`;
}
function openSketchCreator(orderId = '') {
  const o = orders.find(x => x.id === orderId);
  const dialog = document.getElementById('sketch-dialog');
  dialog.innerHTML = `
    <div class="dialog-head"><div><div class="eyebrow">ТЕМА ЭСКИЗА · ДВЕ СТОРОНЫ ТОПОРА</div><h2 id="sketch-title">Создать эскиз</h2></div><button class="close" type="button" data-sketch-close aria-label="Закрыть">×</button></div>
    <div class="dialog-content sketch-generator">
      <div class="sketch-generator-fields">
        <label class="field">Заказ<select id="sketch-order"><option value="">Без привязки к заказу</option>${orders.map(x => `<option value="${x.id}" ${x.id === o?.id ? 'selected' : ''}>${x.id} · ${esc(x.client)}</option>`).join('')}</select></label>
        <label class="field">Тема эскиза<input id="sketch-theme" value="${esc(o?.theme || '')}" maxlength="500"></label>
        <label class="field">Пожелания к рисунку<textarea id="sketch-task" maxlength="10000">${esc(o?.task || '')}</textarea></label>
      </div>
      <div class="contour-card">
        <div class="contour-heading">Контур топоров <span>Исходный шаблон</span></div>
        <img src="axe-contour.jpg" alt="Контур топоров" width="710" height="449">
        <a class="button" href="axe-contour.jpg" download="axe-contour.jpg">${icon('image')} Скачать контур</a>
      </div>
      <label class="field full prompt-field">Готовый промт<textarea id="sketch-prompt" spellcheck="false">${esc(composeSketchPrompt(o?.theme || '', o?.task || ''))}</textarea></label>
    </div>
    <div class="dialog-actions sketch-generator-actions">
      <div class="right"><button class="button" type="button" data-sketch-close>Закрыть</button><button class="button primary" type="button" id="copy-sketch-prompt">${icon('copy')} Скопировать промт</button></div>
    </div>`;
  dialog.showModal();
  dialog.querySelectorAll('[data-sketch-close]').forEach(b => b.onclick = () => dialog.close());
  dialog.querySelector('#copy-sketch-prompt').onclick = async () => {
    await navigator.clipboard.writeText(dialog.querySelector('#sketch-prompt').value);
    toast('Промт скопирован');
  };
}
document.addEventListener('click', e => {
  const b = e.target.closest('button');
  if (b?.dataset.action === 'create-sketch') openSketchCreator();
  if (b?.dataset.sketchOrder) openSketchCreator(b.dataset.sketchOrder);
});

function imageSource(value) {
  const href = safeURL(String(value || '').trim()); if (!href) return { kind: value ? 'invalid' : 'empty' };
  const url = new URL(href);
  if (['drive.google.com', 'docs.google.com', 'www.drive.google.com'].includes(url.hostname)) {
    if (url.pathname.includes('/folders/')) return { kind: 'folder', href };
    const match = url.pathname.match(/^\/file\/d\/([A-Za-z0-9_-]+)(?:\/|$)/);
    const id = match?.[1] || (['/open', '/uc', '/thumbnail'].includes(url.pathname) ? url.searchParams.get('id') : null);
    if (!id || !/^[A-Za-z0-9_-]+$/.test(id)) return { kind: 'unsupported', href };
    return { kind: 'drive', href, preview: `https://drive.google.com/file/d/${id}/preview` };
  }
  return { kind: 'direct', href };
}

function imagePreview(value, compact = false) {
  const source = imageSource(value);
  if (source.kind === 'empty') return compact ? `<div class="sketch-art">${icon('image')}<span>Рисунок ещё не добавлен</span></div>` : '';
  if (source.kind === 'invalid') return '<p class="field-hint preview-message">Вставьте ссылку, начинающуюся с https://</p>';
  if (source.kind === 'folder' || source.kind === 'unsupported') return `<div class="preview-message"><a href="${esc(source.href)}" target="_blank" rel="noopener noreferrer" class="text-button">Открыть в Google Drive</a></div>`;
  return `<div class="image-view ${compact ? 'compact' : ''}">
    ${source.kind === 'drive' ? `<iframe class="drive-preview" src="${esc(source.preview)}" title="Эскиз" loading="lazy"></iframe>` : `<img class="direct-preview" src="${esc(source.href)}" alt="Эскиз" loading="lazy">`}
    <div class="image-view-footer"><a href="${esc(source.href)}" target="_blank" rel="noopener noreferrer">Открыть оригинал ↗</a></div>
  </div>`;
}

function inlineStatus(o) {
  return `<select class="inline-status badge ${classes[statuses.indexOf(o.status)] || 'new'}" data-order-status="${esc(o.id)}" aria-label="Статус заказа ${esc(o.id)}">${statuses.map(status => statusOption(status, o.status)).join('')}</select>`;
}
function setOrderStatus(id, status) {
  const order = orders.find(o => o.id === id);
  if (!order || !statuses.includes(status) || order.status === status) return null;
  const previous = order.status; order.status = status;
  order.history = [...(order.history || []), `${new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} · Статус: ${previous} → ${status}`];
  return order;
}
document.addEventListener('change', e => {
  const control = e.target.closest('[data-order-status]'); if (!control) return;
  const order = setOrderStatus(control.dataset.orderStatus, control.value); if (!order) return;
  saveState(); render();
  toast(!active(order) ? `${order.id} перенесён в архив · ${order.status}` : `${order.id}: ${order.status}`);
});

function statusStyle(status) {
  const i = statuses.indexOf(status); return i < 0 ? '' : `background-color:${statusColors[i]};color:${statusTextColors[i]}`;
}
function statusOption(status, selected) {
  return `<option value="${esc(status)}" style="${statusStyle(status)}" ${status === selected ? 'selected' : ''}>${esc(status)}</option>`;
}

function employeeTaskText(o, id) {
  return [
    `ЗАКАЗ ${id || '(новый)'}`,
    o.theme ? `Тема: ${o.theme}` : null,
    o.contact?.trim() ? `Телефон: ${o.contact.trim()}` : null,
    `Срок: ${o.due ? new Date(o.due + 'T12:00:00').toLocaleDateString('ru-RU') : 'уточнить'}`,
    `Приоритет: ${o.priority}`,
    '',
    o.task || 'Техническое задание пока не заполнено',
    '',
    `Эскиз: ${o.sketch}`,
    o.folder?.trim() ? `Папка заказа: ${o.folder.trim()}` : null,
    o.image?.trim() ? `Ссылка на эскиз: ${o.image.trim()}` : null
  ].filter(x => x !== null).join('\n');
}

// Запуск первичного рендера
setView();
