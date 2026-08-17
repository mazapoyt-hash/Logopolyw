/* ============================================================
   Трекер задач и багов
   ------------------------------------------------------------
   Хранилище: localStorage (ключ STORAGE_KEY).
   Задача: { id, title, desc, priority (0..3), tag, status, created, updated }
   Статусы: 'new' | 'progress' | 'done'
   ============================================================ */

const STORAGE_KEY = 'logopoly_tasks_v1';

const PRIORITIES = {
  0: { label: 'Критичный', icon: '🔥' },
  1: { label: 'Высокий',   icon: '⬆️' },
  2: { label: 'Средний',   icon: '➖' },
  3: { label: 'Низкий',    icon: '⬇️' }
};

const TAGS = {
  bug:   'Баг',
  chat:  'Чат / мессенджер',
  board: 'Доска / поля',
  trade: 'Сделки',
  net:   'Сеть / Firebase',
  ui:    'Интерфейс',
  idea:  'Идея / фича'
};

const STATUSES = {
  new:      { label: 'Новая',    next: 'progress' },
  progress: { label: 'В работе', next: 'done' },
  done:     { label: 'Готово',   next: 'new' }
};

/* Порядок статусов при сортировке «по статусу» */
const STATUS_ORDER = { progress: 0, new: 1, done: 2 };

let tasks = load();
let editingId = null;

const filters = { search: '', priority: 'all', tag: 'all', status: 'all', sort: 'priority' };

/* ---------------- Хранилище ---------------- */

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isValidTask).map(normalize) : [];
  } catch (e) {
    console.warn('Не удалось прочитать сохранённые задачи:', e);
    return [];
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch (e) {
    toast('Не удалось сохранить — хранилище браузера недоступно');
  }
}

function isValidTask(t) {
  return t && typeof t === 'object' && typeof t.title === 'string' && t.title.trim() !== '';
}

/* Приводим задачу к актуальной форме — чтобы старые/чужие файлы не ломали список */
function normalize(t) {
  const priority = Number(t.priority);
  return {
    id: String(t.id || newId()),
    title: String(t.title).slice(0, 120),
    desc: typeof t.desc === 'string' ? t.desc.slice(0, 2000) : '',
    priority: PRIORITIES[priority] ? priority : 2,
    tag: TAGS[t.tag] ? t.tag : 'bug',
    status: STATUSES[t.status] ? t.status : 'new',
    created: Number(t.created) || Date.now(),
    updated: Number(t.updated) || Number(t.created) || Date.now()
  };
}

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* ---------------- Создание / изменение ---------------- */

const form = document.getElementById('task-form');
const fieldId = document.getElementById('field-id');
const fieldTitle = document.getElementById('field-title');
const fieldDesc = document.getElementById('field-desc');
const fieldPriority = document.getElementById('field-priority');
const fieldTag = document.getElementById('field-tag');
const fieldStatus = document.getElementById('field-status');
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
    tag: fieldTag.value,
    status: fieldStatus.value
  };

  if (editingId) {
    const task = tasks.find(t => t.id === editingId);
    if (task) {
      Object.assign(task, data, { updated: Date.now() });
      toast('Задача обновлена');
    }
    stopEditing();
  } else {
    tasks.unshift(normalize({ ...data, id: newId(), created: Date.now(), updated: Date.now() }));
    toast('Задача добавлена');
    form.reset();
    fieldPriority.value = '2';
    fieldStatus.value = 'new';
  }

  save();
  render();
  fieldTitle.focus();
});

btnCancelEdit.addEventListener('click', stopEditing);

function startEditing(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  editingId = id;
  fieldId.value = id;
  fieldTitle.value = task.title;
  fieldDesc.value = task.desc;
  fieldPriority.value = String(task.priority);
  fieldTag.value = task.tag;
  fieldStatus.value = task.status;

  btnSubmit.textContent = 'Сохранить изменения';
  btnCancelEdit.classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  fieldTitle.focus();
}

function stopEditing() {
  editingId = null;
  form.reset();
  fieldId.value = '';
  fieldPriority.value = '2';
  fieldStatus.value = 'new';
  btnSubmit.textContent = 'Добавить задачу';
  btnCancelEdit.classList.add('hidden');
}

function cycleStatus(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  task.status = STATUSES[task.status].next;
  task.updated = Date.now();
  save();
  render();
}

function changePriority(id, delta) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  const next = task.priority + delta;
  if (!PRIORITIES[next]) return;
  task.priority = next;
  task.updated = Date.now();
  save();
  render();
}

function removeTask(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  if (!confirm(`Удалить задачу «${task.title}»?`)) return;
  tasks = tasks.filter(t => t.id !== id);
  if (editingId === id) stopEditing();
  save();
  render();
  toast('Задача удалена');
}

/* ---------------- Фильтры ---------------- */

document.getElementById('filter-search').addEventListener('input', e => {
  filters.search = e.target.value.trim().toLowerCase();
  render();
});
document.getElementById('sort-mode').addEventListener('change', e => {
  filters.sort = e.target.value;
  render();
});
document.getElementById('filter-priority').addEventListener('change', e => {
  filters.priority = e.target.value;
  render();
});
document.getElementById('filter-tag').addEventListener('change', e => {
  filters.tag = e.target.value;
  render();
});
document.getElementById('status-chips').addEventListener('click', e => {
  const chip = e.target.closest('.tr-chip');
  if (!chip) return;
  filters.status = chip.dataset.status;
  document.querySelectorAll('#status-chips .tr-chip').forEach(c => c.classList.toggle('active', c === chip));
  render();
});

function visibleTasks() {
  const list = tasks.filter(t => {
    if (filters.priority !== 'all' && t.priority !== Number(filters.priority)) return false;
    if (filters.tag !== 'all' && t.tag !== filters.tag) return false;
    if (filters.status === 'open' && t.status === 'done') return false;
    if (filters.status !== 'all' && filters.status !== 'open' && t.status !== filters.status) return false;
    if (filters.search) {
      const haystack = (t.title + ' ' + t.desc).toLowerCase();
      if (!haystack.includes(filters.search)) return false;
    }
    return true;
  });

  return list.sort(comparator);
}

function comparator(a, b) {
  /* Готовые задачи всегда уезжают в конец списка */
  const doneA = a.status === 'done' ? 1 : 0;
  const doneB = b.status === 'done' ? 1 : 0;
  if (doneA !== doneB) return doneA - doneB;

  switch (filters.sort) {
    case 'created-desc': return b.created - a.created;
    case 'created-asc':  return a.created - b.created;
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

/* ---------------- Отрисовка ---------------- */

const listEl = document.getElementById('task-list');
const statsEl = document.getElementById('stats');

function render() {
  renderStats();
  renderList();
}

function renderStats() {
  const open = tasks.filter(t => t.status !== 'done');
  const stats = [
    { value: tasks.length, label: 'Всего' },
    { value: open.length, label: 'Открытых' },
    { value: tasks.filter(t => t.status === 'progress').length, label: 'В работе' },
    { value: open.filter(t => t.priority === 0).length, label: 'Критичных', alert: true }
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
      : 'Пока пусто. Добавьте первый баг — например, тот, что нашли в чате.'}</div>`;
    return;
  }

  listEl.innerHTML = list.map(taskHtml).join('');
}

function taskHtml(t) {
  const prio = PRIORITIES[t.priority];
  const statusBadge = t.status === 'new'
    ? ''
    : `<span class="tr-badge status-${t.status}">${STATUSES[t.status].label}</span>`;

  return `
  <article class="tr-task p${t.priority}${t.status === 'done' ? ' done' : ''}">
    <button class="tr-check" data-act="cycle" data-id="${t.id}"
            title="Статус: ${STATUSES[t.status].label} → ${STATUSES[STATUSES[t.status].next].label}">
      ${t.status === 'done' ? '✔' : t.status === 'progress' ? '◐' : ''}
    </button>

    <div class="tr-task-main">
      <div class="tr-task-title">${esc(t.title)}</div>
      ${t.desc ? `<p class="tr-task-desc">${esc(t.desc)}</p>` : ''}
      <div class="tr-task-meta">
        <span class="tr-badge prio p${t.priority}">${prio.icon} ${prio.label}</span>
        <span class="tr-badge">${TAGS[t.tag]}</span>
        ${statusBadge}
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
  const blob = new Blob([JSON.stringify(tasks, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `logopoly-tasks-${new Date().toISOString().slice(0, 10)}.json`;
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
      if (!Array.isArray(parsed)) throw new Error('ожидался массив задач');
      const incoming = parsed.filter(isValidTask).map(normalize);
      if (!incoming.length) { toast('В файле нет задач'); return; }

      /* Задачи с уже известным id обновляем, остальные добавляем */
      const byId = new Map(tasks.map(t => [t.id, t]));
      incoming.forEach(t => byId.set(t.id, t));
      tasks = [...byId.values()];

      save();
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
    const head = `- ${box} ${PRIORITIES[t.priority].icon} ${PRIORITIES[t.priority].label} · ${TAGS[t.tag]} — ${t.title}`;
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
  save();
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

render();
