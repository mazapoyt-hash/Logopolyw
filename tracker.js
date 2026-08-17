/* ============================================================
   Трекер задач
   ------------------------------------------------------------
   Хранилище: localStorage, ключ STORAGE_KEY.
   Формат: { version: 2, categories: [{id, name}], tasks: [...] }
   Задача: { id, title, desc, priority (0..3), cat, status, due, created, updated }
   Статусы: 'new' | 'progress' | 'hold' | 'done'
   ============================================================ */

const STORAGE_KEY = 'tracker_data_v2';
const LEGACY_KEY = 'logopoly_tasks_v1';

const PRIORITIES = {
  0: { label: 'Критичный', icon: '🔥' },
  1: { label: 'Высокий',   icon: '⬆️' },
  2: { label: 'Средний',   icon: '➖' },
  3: { label: 'Низкий',    icon: '⬇️' }
};

const STATUSES = {
  new:      { label: 'Новая',    next: 'progress' },
  progress: { label: 'В работе', next: 'done' },
  hold:     { label: 'Отложена', next: 'progress' },
  done:     { label: 'Готово',   next: 'new' }
};

/* Порядок статусов при сортировке «по статусу» */
const STATUS_ORDER = { progress: 0, new: 1, hold: 2, done: 3 };

const FALLBACK_CAT = 'other';

const DEFAULT_CATEGORIES = [
  { id: 'bug',   name: 'Баг' },
  { id: 'feat',  name: 'Фича' },
  { id: 'imp',   name: 'Улучшение' },
  { id: 'docs',  name: 'Документация' },
  { id: 'design', name: 'Дизайн' },
  { id: FALLBACK_CAT, name: 'Другое' }
];

/* Разделы старой, «игровой» версии трекера — во что их превращать при переносе */
const LEGACY_TAG_MAP = {
  bug: 'bug', idea: 'feat', ui: 'design',
  chat: FALLBACK_CAT, board: FALLBACK_CAT, trade: FALLBACK_CAT, net: FALLBACK_CAT
};

let tasks = [];
let categories = [];
let editingId = null;

const filters = { search: '', priority: 'all', cat: 'all', status: 'all', sort: 'priority' };

/* ---------------- Хранилище ---------------- */

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      categories = normalizeCategories(data.categories);
      tasks = Array.isArray(data.tasks) ? data.tasks.filter(isValidTask).map(normalizeTask) : [];
      return;
    }
    /* Первый запуск: переносим задачи из старой версии, если они были */
    categories = normalizeCategories(null);
    const legacy = localStorage.getItem(LEGACY_KEY);
    tasks = legacy ? migrateLegacy(JSON.parse(legacy)) : [];
    if (tasks.length) saveState();
  } catch (e) {
    console.warn('Не удалось прочитать сохранённые данные:', e);
    categories = normalizeCategories(null);
    tasks = [];
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, categories, tasks }));
  } catch (e) {
    toast('Не удалось сохранить — хранилище браузера недоступно');
  }
}

function migrateLegacy(list) {
  if (!Array.isArray(list)) return [];
  return list.filter(isValidTask).map(t => normalizeTask({ ...t, cat: LEGACY_TAG_MAP[t.tag] || FALLBACK_CAT }));
}

function normalizeCategories(list) {
  const clean = Array.isArray(list)
    ? list.filter(c => c && typeof c.name === 'string' && c.name.trim())
          .map(c => ({ id: String(c.id || slug(c.name)), name: c.name.trim().slice(0, 24) }))
    : [];
  if (!clean.length) return DEFAULT_CATEGORIES.map(c => ({ ...c }));
  /* «Другое» обязателен — в него переезжают задачи удалённых разделов */
  if (!clean.some(c => c.id === FALLBACK_CAT)) clean.push({ id: FALLBACK_CAT, name: 'Другое' });
  return clean;
}

function isValidTask(t) {
  return t && typeof t === 'object' && typeof t.title === 'string' && t.title.trim() !== '';
}

/* Приводим задачу к актуальной форме — чтобы старые и чужие файлы не ломали список */
function normalizeTask(t) {
  const priority = Number(t.priority);
  const cat = String(t.cat || '');
  return {
    id: String(t.id || newId()),
    title: String(t.title).trim().slice(0, 120),
    desc: typeof t.desc === 'string' ? t.desc.slice(0, 2000) : '',
    priority: PRIORITIES[priority] ? priority : 2,
    cat: categories.some(c => c.id === cat) ? cat : FALLBACK_CAT,
    status: STATUSES[t.status] ? t.status : 'new',
    due: /^\d{4}-\d{2}-\d{2}$/.test(t.due) ? t.due : '',
    created: Number(t.created) || Date.now(),
    updated: Number(t.updated) || Number(t.created) || Date.now()
  };
}

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function slug(name) {
  return 'c' + Math.abs([...name].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) | 0, 7)).toString(36);
}

function catName(id) {
  const cat = categories.find(c => c.id === id);
  return cat ? cat.name : 'Другое';
}

/* ---------------- Создание / изменение задач ---------------- */

const form = document.getElementById('task-form');
const fieldTitle = document.getElementById('field-title');
const fieldDesc = document.getElementById('field-desc');
const fieldPriority = document.getElementById('field-priority');
const fieldCat = document.getElementById('field-cat');
const fieldStatus = document.getElementById('field-status');
const fieldDue = document.getElementById('field-due');
const btnSubmit = document.getElementById('btn-submit');
const btnCancelEdit = document.getElementById('btn-cancel-edit');

form.addEventListener('submit', e => {
  e.preventDefault();
  const title = fieldTitle.value.trim();
  if (!title) return;

  const data = {
    title,
    desc: fieldDesc.value.trim(),
    priority: Number(fieldPriority.value),
    cat: fieldCat.value,
    status: fieldStatus.value,
    due: fieldDue.value
  };

  if (editingId) {
    const task = tasks.find(t => t.id === editingId);
    if (task) {
      Object.assign(task, normalizeTask({ ...task, ...data }), { updated: Date.now() });
      toast('Задача обновлена');
    }
    stopEditing();
  } else {
    tasks.unshift(normalizeTask({ ...data, id: newId(), created: Date.now(), updated: Date.now() }));
    toast('Задача добавлена');
    resetForm();
  }

  saveState();
  render();
  fieldTitle.focus();
});

btnCancelEdit.addEventListener('click', stopEditing);

function resetForm() {
  form.reset();
  fieldPriority.value = '2';
  fieldStatus.value = 'new';
  fieldDue.value = '';
  if (categories.length) fieldCat.value = categories[0].id;
}

function startEditing(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  editingId = id;
  fieldTitle.value = task.title;
  fieldDesc.value = task.desc;
  fieldPriority.value = String(task.priority);
  fieldCat.value = task.cat;
  fieldStatus.value = task.status;
  fieldDue.value = task.due;

  btnSubmit.textContent = 'Сохранить изменения';
  btnCancelEdit.classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  fieldTitle.focus();
}

function stopEditing() {
  editingId = null;
  resetForm();
  btnSubmit.textContent = 'Добавить задачу';
  btnCancelEdit.classList.add('hidden');
}

function cycleStatus(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  task.status = STATUSES[task.status].next;
  task.updated = Date.now();
  saveState();
  render();
}

function changePriority(id, delta) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  const next = task.priority + delta;
  if (!PRIORITIES[next]) return;
  task.priority = next;
  task.updated = Date.now();
  saveState();
  render();
}

function removeTask(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  if (!confirm(`Удалить задачу «${task.title}»?`)) return;
  tasks = tasks.filter(t => t.id !== id);
  if (editingId === id) stopEditing();
  saveState();
  render();
  toast('Задача удалена');
}

/* ---------------- Разделы ---------------- */

const catForm = document.getElementById('cat-form');
const catInput = document.getElementById('cat-input');
const catManager = document.getElementById('cat-manager');

catForm.addEventListener('submit', e => {
  e.preventDefault();
  const name = catInput.value.trim().slice(0, 24);
  if (!name) return;
  if (categories.some(c => c.name.toLowerCase() === name.toLowerCase())) {
    toast('Такой раздел уже есть');
    return;
  }
  let id = slug(name);
  while (categories.some(c => c.id === id)) id += 'x';
  categories.push({ id, name });
  catInput.value = '';
  saveState();
  render();
  toast(`Раздел «${name}» добавлен`);
});

catManager.addEventListener('click', e => {
  const btn = e.target.closest('[data-cat]');
  if (!btn) return;
  removeCategory(btn.dataset.cat);
});

function removeCategory(id) {
  if (id === FALLBACK_CAT) return;
  const cat = categories.find(c => c.id === id);
  if (!cat) return;

  const used = tasks.filter(t => t.cat === id).length;
  const question = used
    ? `Удалить раздел «${cat.name}»? Задач в нём: ${used} — они переедут в «Другое».`
    : `Удалить раздел «${cat.name}»?`;
  if (!confirm(question)) return;

  categories = categories.filter(c => c.id !== id);
  tasks.forEach(t => { if (t.cat === id) t.cat = FALLBACK_CAT; });
  saveState();
  render();
  toast('Раздел удалён');
}

function renderCategories() {
  catManager.innerHTML = categories.map(c => {
    const used = tasks.filter(t => t.cat === c.id).length;
    const remove = c.id === FALLBACK_CAT
      ? ''
      : `<button type="button" class="tr-cat-del" data-cat="${c.id}" title="Удалить раздел">✕</button>`;
    return `<span class="tr-cat-tag">${esc(c.name)}<i>${used}</i>${remove}</span>`;
  }).join('');

  fillSelect(fieldCat, categories.map(c => [c.id, c.name]), categories[0].id);
  fillSelect(document.getElementById('filter-cat'),
    [['all', 'Все'], ...categories.map(c => [c.id, c.name])], filters.cat);
}

/* Перерисовывает <select>, сохраняя выбранное значение, если оно ещё существует */
function fillSelect(select, pairs, fallback) {
  const previous = select.value;
  select.innerHTML = pairs.map(([value, label]) =>
    `<option value="${value}">${esc(label)}</option>`).join('');
  select.value = pairs.some(([value]) => value === previous) ? previous : fallback;
}

/* ---------------- Фильтры ---------------- */

document.getElementById('filter-search').addEventListener('input', e => {
  filters.search = e.target.value.trim().toLowerCase();
  renderList();
});
document.getElementById('sort-mode').addEventListener('change', e => {
  filters.sort = e.target.value;
  renderList();
});
document.getElementById('filter-priority').addEventListener('change', e => {
  filters.priority = e.target.value;
  renderList();
});
document.getElementById('filter-cat').addEventListener('change', e => {
  filters.cat = e.target.value;
  renderList();
});
document.getElementById('status-chips').addEventListener('click', e => {
  const chip = e.target.closest('.tr-chip');
  if (!chip) return;
  filters.status = chip.dataset.status;
  document.querySelectorAll('#status-chips .tr-chip').forEach(c => c.classList.toggle('active', c === chip));
  renderList();
});

function visibleTasks() {
  return tasks.filter(t => {
    if (filters.priority !== 'all' && t.priority !== Number(filters.priority)) return false;
    if (filters.cat !== 'all' && t.cat !== filters.cat) return false;
    if (filters.status === 'open' && t.status === 'done') return false;
    if (filters.status !== 'all' && filters.status !== 'open' && t.status !== filters.status) return false;
    if (filters.search && !(t.title + ' ' + t.desc).toLowerCase().includes(filters.search)) return false;
    return true;
  }).sort(comparator);
}

function comparator(a, b) {
  /* Готовые задачи всегда уезжают в конец списка */
  const doneA = a.status === 'done' ? 1 : 0;
  const doneB = b.status === 'done' ? 1 : 0;
  if (doneA !== doneB) return doneA - doneB;

  switch (filters.sort) {
    case 'created-desc': return b.created - a.created;
    case 'created-asc':  return a.created - b.created;
    case 'due':
      /* Задачи без срока — в конец */
      if (!a.due !== !b.due) return a.due ? -1 : 1;
      if (a.due !== b.due) return a.due < b.due ? -1 : 1;
      return a.priority - b.priority;
    case 'status':
      if (STATUS_ORDER[a.status] !== STATUS_ORDER[b.status]) {
        return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      }
      return a.priority - b.priority;
    default: /* priority */
      if (a.priority !== b.priority) return a.priority - b.priority;
      return b.created - a.created;
  }
}

/* ---------------- Сроки ---------------- */

function today() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/* Сколько дней осталось до срока: 0 — сегодня, отрицательное — просрочено */
function daysLeft(due) {
  const [y, m, d] = due.split('-').map(Number);
  return Math.round((new Date(y, m - 1, d) - today()) / 86400000);
}

function dueBadge(task) {
  if (!task.due) return '';
  const left = daysLeft(task.due);
  const date = formatDue(task.due);

  if (task.status === 'done') return `<span class="tr-badge due">срок ${date}</span>`;
  if (left < 0) return `<span class="tr-badge due overdue">просрочено на ${plural(-left)}</span>`;
  if (left === 0) return `<span class="tr-badge due soon">срок сегодня</span>`;
  if (left === 1) return `<span class="tr-badge due soon">срок завтра</span>`;
  return `<span class="tr-badge due">до ${date}</span>`;
}

function plural(days) {
  const n = days % 100;
  const last = n % 10;
  if (n > 10 && n < 20) return days + ' дней';
  if (last === 1) return days + ' день';
  if (last >= 2 && last <= 4) return days + ' дня';
  return days + ' дней';
}

function formatDue(due) {
  const [y, m, d] = due.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

function isOverdue(task) {
  return task.due && task.status !== 'done' && daysLeft(task.due) < 0;
}

/* ---------------- Отрисовка ---------------- */

const listEl = document.getElementById('task-list');
const statsEl = document.getElementById('stats');

function render() {
  renderCategories();
  renderStats();
  renderList();
}

function renderStats() {
  const open = tasks.filter(t => t.status !== 'done');
  const stats = [
    { value: tasks.length, label: 'Всего' },
    { value: open.length, label: 'Открытых' },
    { value: tasks.filter(t => t.status === 'progress').length, label: 'В работе' },
    { value: open.filter(t => t.priority === 0).length, label: 'Критичных', alert: true },
    { value: tasks.filter(isOverdue).length, label: 'Просрочено', alert: true }
  ];

  statsEl.innerHTML = stats.map(s =>
    `<div class="tr-stat${s.alert && s.value > 0 ? ' alert' : ''}"><b>${s.value}</b><span>${s.label}</span></div>`
  ).join('');
}

function renderList() {
  const list = visibleTasks();

  if (!list.length) {
    listEl.innerHTML = `<div class="tr-card tr-empty">${tasks.length
      ? 'Под фильтры ничего не подошло.'
      : 'Пока пусто. Добавьте первую задачу — форма выше.'}</div>`;
    return;
  }

  listEl.innerHTML = list.map(taskHtml).join('');
}

function taskHtml(t) {
  const prio = PRIORITIES[t.priority];
  const statusBadge = t.status === 'new'
    ? ''
    : `<span class="tr-badge status-${t.status}">${STATUSES[t.status].label}</span>`;
  const mark = { done: '✔', progress: '◐', hold: '⏸' }[t.status] || '';

  return `
  <article class="tr-task p${t.priority}${t.status === 'done' ? ' done' : ''}${isOverdue(t) ? ' overdue' : ''}">
    <button class="tr-check" data-act="cycle" data-id="${t.id}"
            title="Статус: ${STATUSES[t.status].label} → ${STATUSES[STATUSES[t.status].next].label}">${mark}</button>

    <div class="tr-task-main">
      <div class="tr-task-title">${esc(t.title)}</div>
      ${t.desc ? `<p class="tr-task-desc">${esc(t.desc)}</p>` : ''}
      <div class="tr-task-meta">
        <span class="tr-badge prio p${t.priority}">${prio.icon} ${prio.label}</span>
        <span class="tr-badge">${esc(catName(t.cat))}</span>
        ${statusBadge}
        ${dueBadge(t)}
        <span class="tr-date">создано ${formatDate(t.created)}</span>
      </div>
    </div>

    <div class="tr-task-actions">
      <button class="tr-icon-btn" data-act="up" data-id="${t.id}" title="Поднять приоритет"
              ${t.priority === 0 ? 'disabled' : ''}>▲</button>
      <button class="tr-icon-btn" data-act="down" data-id="${t.id}" title="Понизить приоритет"
              ${t.priority === 3 ? 'disabled' : ''}>▼</button>
      <button class="tr-icon-btn" data-act="edit" data-id="${t.id}" title="Редактировать">✎</button>
      <button class="tr-icon-btn del" data-act="del" data-id="${t.id}" title="Удалить">🗑</button>
    </div>
  </article>`;
}

listEl.addEventListener('click', e => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const id = btn.dataset.id;
  switch (btn.dataset.act) {
    case 'cycle': cycleStatus(id); break;
    case 'up':    changePriority(id, -1); break;
    case 'down':  changePriority(id, +1); break;
    case 'edit':  startEditing(id); break;
    case 'del':   removeTask(id); break;
  }
});

function formatDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) +
         ' ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* ---------------- Экспорт / импорт ---------------- */

document.getElementById('btn-export').addEventListener('click', () => {
  const payload = JSON.stringify({ version: 2, categories, tasks }, null, 2);
  const blob = new Blob([payload], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tasks-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

const importFile = document.getElementById('import-file');
document.getElementById('btn-import').addEventListener('click', () => importFile.click());

importFile.addEventListener('change', () => {
  const file = importFile.files && importFile.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      /* Принимаем и новый формат с разделами, и старый — простой массив задач */
      const rawTasks = Array.isArray(parsed) ? parsed : parsed && parsed.tasks;
      if (!Array.isArray(rawTasks)) throw new Error('в файле нет списка задач');

      if (parsed && Array.isArray(parsed.categories)) {
        const known = new Set(categories.map(c => c.id));
        normalizeCategories(parsed.categories).forEach(c => {
          if (!known.has(c.id)) { categories.push(c); known.add(c.id); }
        });
      }

      const incoming = rawTasks.filter(isValidTask)
        .map(t => normalizeTask(Array.isArray(parsed) ? { ...t, cat: LEGACY_TAG_MAP[t.tag] || t.cat } : t));
      if (!incoming.length) { toast('В файле нет задач'); return; }

      /* Задачи с уже известным id обновляем, остальные добавляем */
      const byId = new Map(tasks.map(t => [t.id, t]));
      incoming.forEach(t => byId.set(t.id, t));
      tasks = [...byId.values()];

      saveState();
      render();
      toast(`Загружено задач: ${incoming.length}`);
    } catch (err) {
      toast('Не получилось прочитать файл: ' + err.message);
    } finally {
      importFile.value = '';
    }
  };
  reader.readAsText(file);
});

document.getElementById('btn-copy-md').addEventListener('click', async () => {
  const list = visibleTasks();
  if (!list.length) { toast('Список пуст'); return; }

  const text = list.map(t => {
    const box = t.status === 'done' ? '[x]' : '[ ]';
    const due = t.due ? ` · до ${formatDue(t.due)}` : '';
    const head = `- ${box} ${PRIORITIES[t.priority].icon} ${PRIORITIES[t.priority].label} · ${catName(t.cat)}${due} — ${t.title}`;
    return t.desc ? head + '\n' + t.desc.split('\n').map(l => '      ' + l).join('\n') : head;
  }).join('\n');

  try {
    await navigator.clipboard.writeText(text);
    toast('Скопировано в буфер обмена');
  } catch (e) {
    /* clipboard недоступен (например, страница открыта по file://) */
    prompt('Скопируйте вручную:', text);
  }
});

document.getElementById('btn-clear-done').addEventListener('click', () => {
  const done = tasks.filter(t => t.status === 'done');
  if (!done.length) { toast('Готовых задач нет'); return; }
  if (!confirm(`Удалить готовые задачи (${done.length})?`)) return;
  tasks = tasks.filter(t => t.status !== 'done');
  saveState();
  render();
  toast('Готовые задачи удалены');
});

/* ---------------- Тост ---------------- */

const toastEl = document.getElementById('toast');
let toastTimer = null;

function toast(message) {
  toastEl.textContent = message;
  toastEl.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.add('hidden'), 2200);
}

/* ---------------- Старт ---------------- */

loadState();
render();
resetForm();
