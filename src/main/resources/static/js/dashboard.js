// ============================================================
// dashboard.js — TaskFlow v5
// BULLETPROOF: DOMContentLoaded + try/catch on init
// All features: Theme, Categories, Search, Filters, Quick-add,
// SVG Ring, Stats animation, SortableJS, canvas-confetti,
// Avatar dropdown, Weekly widget, Keyboard shortcut N,
// Collapsible desc, Drag & Drop, Notifications
// ============================================================

// ---- Safe DOM helper (never throws) ----
function $(id) {
    return document.getElementById(id);
}

function on(id, event, fn) {
    const el = $(id);
    if (el) el.addEventListener(event, fn);
}

// ---- State ----
let allTasks = [];
let activeFilter = 'ALL';
let searchQuery = '';
let editingId = null;
const notifiedIds = new Set();
const today = new Date().toISOString().split('T')[0];


// ============================================================
// ENTRY POINT — wrapped in DOMContentLoaded so DOM always ready
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    try { initTheme(); } catch (e) { console.error('Theme init failed', e); }
    try { initDashboard(); } catch (e) { console.error('Dashboard init failed', e); }
});


// ============================================================
// THEME (runs first, before auth check)
// ============================================================
function initTheme() {
    const saved = localStorage.getItem('taskflow-theme') || 'dark';
    applyTheme(saved);

    on('theme-toggle', 'click', toggleTheme);
    on('dropdown-theme', 'click', (e) => { e.stopPropagation(); toggleTheme(); });
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const icon = theme === 'dark' ? '☀️' : '🌙';
    const tt = $('theme-toggle'); if (tt) tt.textContent = icon;
    const di = $('dropdown-theme-icon'); if (di) di.textContent = icon;
}

function toggleTheme() {
    const cur = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = cur === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    localStorage.setItem('taskflow-theme', next);
}


// ============================================================
// MAIN INIT (after theme)
// ============================================================
async function initDashboard() {
    // ---- Auth check ----
    const token = localStorage.getItem('jwt_token');
    if (!token) { window.location.href = 'login.html'; return; }

    // ---- User info ----
    let name = 'User';
    try {
        const u = JSON.parse(localStorage.getItem('current_user') || '{}');
        name = u.name || 'User';
    } catch (e) { }

    const initial = name.charAt(0).toUpperCase();
    if ($('user-name')) $('user-name').textContent = name;
    if ($('user-avatar')) $('user-avatar').textContent = initial;
    if ($('dropdown-name')) $('dropdown-name').textContent = name;
    if ($('dropdown-avatar')) $('dropdown-avatar').textContent = initial;
    if ($('dropdown-sub')) $('dropdown-sub').textContent = 'Member';

    // ---- Nav ----
    on('nav-all', 'click', () => setNav('ALL', 'nav-all'));
    on('nav-completed', 'click', () => setNav('COMPLETED', 'nav-completed'));

    // ---- FAB + Empty CTA ----
    on('fab-add', 'click', openAddModal);
    on('empty-add-btn', 'click', openAddModal);

    // ---- Logout ----
    on('dropdown-logout', 'click', () => {
        localStorage.removeItem('jwt_token');
        localStorage.removeItem('current_user');
        window.location.href = 'login.html';
    });
    on('logout-btn', 'click', () => {
        localStorage.removeItem('jwt_token');
        localStorage.removeItem('current_user');
        window.location.href = 'login.html';
    });

    // ---- Avatar dropdown ----
    const wrap = $('avatar-wrap');
    const dropdown = $('avatar-dropdown');
    if (wrap && dropdown) {
        $('user-avatar').addEventListener('click', (e) => {
            e.stopPropagation();
            const open = !dropdown.classList.contains('hidden');
            dropdown.classList.toggle('hidden', open);
            wrap.classList.toggle('open', !open);
        });
        document.addEventListener('click', (e) => {
            if (!wrap.contains(e.target)) {
                dropdown.classList.add('hidden');
                wrap.classList.remove('open');
            }
        });
    }

    // ---- Modal ----
    on('modal-close', 'click', closeModal);
    on('modal-cancel', 'click', closeModal);
    on('modal-overlay', 'click', (e) => { if (e.target === $('modal-overlay')) closeModal(); });
    const form = $('task-form');
    if (form) form.addEventListener('submit', handleFormSubmit);

    // ---- Filter chips ----
    document.querySelectorAll('.filter-chip').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeFilter = btn.dataset.filter;
            renderAll();
        });
    });

    // ---- Search ----
    on('search-input', 'input', (e) => {
        searchQuery = e.target.value.toLowerCase().trim();
        renderAll();
    });

    // ---- Quick-add ----
    const qai = $('quick-add-input');
    if (qai) {
        qai.addEventListener('keydown', async (e) => {
            if (e.key !== 'Enter') return;
            const title = qai.value.trim();
            if (!title) return;
            qai.value = '';
            await quickCreate(title);
        });
    }
    on('quick-add-bar', 'click', () => { if (qai) qai.focus(); });

    // ---- Keyboard shortcut: N → open modal ----
    document.addEventListener('keydown', (e) => {
        const tag = document.activeElement.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        if (e.key === 'n' || e.key === 'N') openAddModal();
        if (e.key === 'Escape') closeModal();
    });

    // ---- Load data ----
    await loadTasks();

    // ---- Notifications (optional) ----
    try { initNotifications(); } catch (e) { }
}


// ============================================================
// API HELPERS (inline, no import dependency that can fail)
// ============================================================
const BASE_URL = '/api';

async function apiRequest(method, path, body) {
    const token = localStorage.getItem('jwt_token');
    const opts = {
        method,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(BASE_URL + path, opts);
    if (res.status === 401) { window.location.href = 'login.html'; return; }
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `HTTP ${res.status}`);
    }
    if (res.status === 204) return null;
    return res.json();
}

const api = {
    getAll: () => apiRequest('GET', '/tasks'),
    create: (body) => apiRequest('POST', '/tasks', body),
    update: (id, b) => apiRequest('PUT', `/tasks/${id}`, b),
    delete: (id) => apiRequest('DELETE', `/tasks/${id}`),
    toggle: (id) => apiRequest('PATCH', `/tasks/${id}/status`),
};


// ============================================================
// LOAD TASKS
// ============================================================
async function loadTasks() {
    const ls = $('loading-state');
    const ea = $('empty-state-all');
    if (ls) ls.classList.remove('hidden');
    if (ea) ea.classList.add('hidden');
    clearSections();

    try {
        allTasks = await api.getAll() || [];
        renderAll();
        renderWeeklyWidget();
    } catch (err) {
        showToast('Failed to load tasks: ' + (err.message || ''), 'error');
    } finally {
        if (ls) ls.classList.add('hidden');
    }
}


// ============================================================
// FILTER
// ============================================================
function applyFiltersAndSearch(tasks) {
    return tasks.filter(t => {
        if (searchQuery) {
            const hit = t.title.toLowerCase().includes(searchQuery) ||
                (t.description || '').toLowerCase().includes(searchQuery);
            if (!hit) return false;
        }
        if (activeFilter === 'ALL') return true;
        if (activeFilter === 'PENDING') return t.status === 'PENDING';
        if (activeFilter === 'COMPLETED') return t.status === 'COMPLETED';
        if (activeFilter === 'HIGH') return t.priority === 'HIGH' && t.status === 'PENDING';
        if (activeFilter === 'DUE_TODAY') return t.dueDate === today && t.status === 'PENDING';
        if (activeFilter === 'WORK') return t.category === 'WORK';
        if (activeFilter === 'PERSONAL') return t.category === 'PERSONAL';
        if (activeFilter === 'HEALTH') return t.category === 'HEALTH';
        return true;
    });
}

function bucketTasks(tasks) {
    const todayList = [], upcomingList = [], completedList = [];
    tasks.forEach(t => {
        if (t.status === 'COMPLETED') { completedList.push(t); return; }
        if (!t.dueDate || t.dueDate === today) { todayList.push(t); }
        else { upcomingList.push(t); }
    });
    upcomingList.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const po = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    todayList.sort((a, b) => (po[a.priority] ?? 2) - (po[b.priority] ?? 2));
    return { todayList, upcomingList, completedList };
}


// ============================================================
// RENDER
// ============================================================
function renderAll() {
    const filtered = applyFiltersAndSearch(allTasks);
    const { todayList, upcomingList, completedList } = bucketTasks(filtered);

    renderSection('today', todayList);
    renderSection('upcoming', upcomingList);
    renderSection('completed', completedList);

    updateStats();
    updateRing();

    const ea = $('empty-state-all');
    if (ea) ea.classList.toggle('hidden', allTasks.length > 0 || filtered.length > 0);
}

function renderSection(key, tasks) {
    const list = $(`list-${key}`);
    const count = $(`count-${key}`);
    const empty = $(`empty-${key}`);
    if (!list) return;

    list.innerHTML = '';
    if (count) count.textContent = tasks.length;
    if (tasks.length === 0) { if (empty) empty.classList.remove('hidden'); return; }
    if (empty) empty.classList.add('hidden');
    tasks.forEach(t => list.appendChild(buildCard(t)));

    // SortableJS
    if (window.Sortable) {
        new Sortable(list, {
            group: `section-${key}`, animation: 180, delay: 80,
            delayOnTouchOnly: true,
            ghostClass: 'sortable-ghost', chosenClass: 'sortable-chosen',
        });
    }
}

function clearSections() {
    ['today', 'upcoming', 'completed'].forEach(key => {
        const list = $(`list-${key}`);
        const count = $(`count-${key}`);
        const empty = $(`empty-${key}`);
        if (list) list.innerHTML = '';
        if (count) count.textContent = '0';
        if (empty) empty.classList.remove('hidden');
    });
}


// ============================================================
// BUILD CARD
// ============================================================
function buildCard(task) {
    const card = document.createElement('div');
    const isDone = task.status === 'COMPLETED';

    let urgencyClass = '';
    if (!isDone && task.dueDate) {
        if (task.dueDate < today) urgencyClass = 'due-overdue';
        else if (task.dueDate === today) urgencyClass = 'due-urgent';
    }
    card.className = `task-card priority-${task.priority || 'LOW'} ${isDone ? 'completed-card' : ''} ${urgencyClass}`.trim();
    card.dataset.id = task.id;

    const dueInfo = getDueInfo(task.dueDate, isDone);
    const hasDesc = !!task.description;

    const priLabel = { HIGH: '⚠ High Priority', MEDIUM: '● Medium', LOW: '○ Low' }[task.priority] || '○ Low';
    const catLabel = { WORK: '💼 Work', PERSONAL: '🏠 Personal', HEALTH: '💪 Health' }[task.category] || '🏠 Personal';
    const dueLabel = dueInfo ? `📅 ${dueInfo.label}` : '';
    const dueCls = dueInfo ? dueInfo.cls : '';

    card.innerHTML = `
        <button class="task-check" data-action="toggle" data-id="${task.id}"
                title="${isDone ? 'Mark as pending' : 'Mark as complete'}"
                aria-label="${isDone ? 'Mark as pending' : 'Mark as complete'}">
            ${isDone ? '✓' : ''}
        </button>
        <div class="task-body">
            <div class="task-title">${escHtml(task.title)}</div>
            <div class="task-meta-line">
                <span class="meta-cat">${catLabel}</span>
                <span class="meta-dot">•</span>
                <span class="meta-pri ${task.priority || 'LOW'}">${priLabel}</span>
                ${dueLabel ? `<span class="meta-dot">•</span><span class="meta-due ${dueCls}">${dueLabel}</span>` : ''}
            </div>
            ${hasDesc ? `
            <span class="desc-toggle" data-desc="${task.id}">Details ▼</span>
            <div class="task-desc-content" id="desc-${task.id}">${escHtml(task.description)}</div>
            ` : ''}
        </div>
        <div class="task-actions">
            <button class="btn-icon btn-edit"   data-action="edit"   data-id="${task.id}" title="Edit">✏️</button>
            <button class="btn-icon btn-delete" data-action="delete" data-id="${task.id}" title="Delete">🗑️</button>
        </div>`;

    // Collapsible description
    if (hasDesc) {
        const toggle = card.querySelector('.desc-toggle');
        const content = card.querySelector(`#desc-${task.id}`);
        if (toggle && content) {
            toggle.addEventListener('click', (e) => {
                e.stopPropagation();
                const open = content.classList.toggle('expanded');
                toggle.textContent = open ? 'Details ▲' : 'Details ▼';
            });
        }
    }

    card.addEventListener('click', handleCardAction);
    return card;
}

function getDueInfo(dueDate, isDone) {
    if (!dueDate || isDone) return null;
    if (dueDate < today) return { label: 'Overdue', cls: 'due-overdue' };
    if (dueDate === today) return { label: 'Due today', cls: 'due-today' };
    return { label: formatDate(dueDate), cls: '' };
}


// ============================================================
// CARD ACTIONS
// ============================================================
async function handleCardAction(e) {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const { action, id } = el.dataset;
    const taskId = Number(id);
    if (action === 'toggle') await doToggle(taskId);
    if (action === 'edit') openEditModal(taskId);
    if (action === 'delete') await doDelete(taskId);
}


// ============================================================
// STATS + RING
// ============================================================
function updateStats() {
    const total = allTasks.length;
    const pending = allTasks.filter(t => t.status === 'PENDING').length;
    const completed = allTasks.filter(t => t.status === 'COMPLETED').length;
    const rate = total === 0 ? 0 : Math.round((completed / total) * 100);

    animateCount('stat-total', total);
    animateCount('stat-pending', pending);
    animateCount('stat-completed', completed);
    const sr = $('stat-rate');
    if (sr) sr.textContent = total > 0 ? `${rate}% completion rate` : '—';
}

function animateCount(id, target) {
    const el = $(id);
    if (!el) return;
    const from = parseInt(el.textContent) || 0;
    if (from === target) return;
    const dur = 500, start = performance.now();
    function tick(now) {
        const p = Math.min((now - start) / dur, 1);
        const e = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(from + (target - from) * e);
        if (p < 1) requestAnimationFrame(tick); else el.textContent = target;
    }
    requestAnimationFrame(tick);
}

function updateRing() {
    const todayAll = allTasks.filter(t => t.dueDate === today);
    const todayDone = todayAll.filter(t => t.status === 'COMPLETED');
    const total = todayAll.length, done = todayDone.length;
    const pct = total === 0 ? 0 : Math.round((done / total) * 100);

    const fill = $('ring-fill');
    if (fill) fill.style.strokeDashoffset = 100 - pct;
    if ($('ring-pct')) $('ring-pct').textContent = `${pct}%`;
    if ($('ring-subtitle')) {
        $('ring-subtitle').textContent = total === 0 ? 'No tasks due today' : `${done} of ${total} completed`;
    }
    if ($('ring-fraction')) {
        const rem = total - done;
        $('ring-fraction').textContent = rem > 0 ? `${rem} task${rem > 1 ? 's' : ''} remaining`
            : total > 0 ? 'All done! 🎉' : '';
    }
}


// ============================================================
// WEEKLY WIDGET
// ============================================================
function renderWeeklyWidget() {
    const daysEl = $('weekly-days');
    const streakEl = $('weekly-streak');
    if (!daysEl) return;

    const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const now = new Date();
    const totalTasks = allTasks.length;
    const doneTasks = allTasks.filter(t => t.status === 'COMPLETED').length;
    const weekDue = allTasks.filter(t => {
        if (!t.dueDate) return false;
        const d = new Date(t.dueDate + 'T00:00:00');
        const diff = (d - now) / 86400000;
        return diff >= -1 && diff <= 7;
    }).length;

    // Build last 7 days
    const days = [];
    let streak = 0;
    for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        const iso = d.toISOString().split('T')[0];
        const isT = iso === today;
        const isPast = iso < today;
        const hadDone = allTasks.some(t => t.status === 'COMPLETED' && t.dueDate === iso);
        days.push({ label: DAY_NAMES[d.getDay()], iso, isT, isPast, hadDone });
    }

    // Streak = consecutive past days with completions, going back from yesterday
    for (let i = days.length - 2; i >= 0; i--) {
        if (days[i].hadDone) streak++;
        else break;
    }

    daysEl.innerHTML = days.map(day => {
        let cls = 'future', icon = '·';
        if (day.isT) { cls = 'todaydot'; icon = '▶'; }
        else if (day.hadDone) { cls = 'done'; icon = '✓'; }
        else if (day.isPast) { cls = 'missed'; icon = '–'; }
        return `<div class="day-pill">
                    <span class="day-label">${day.label}</span>
                    <div class="day-dot ${cls}">${icon}</div>
                </div>`;
    }).join('');

    // Stats line below dots
    const existingStats = daysEl.parentElement.querySelector('.weekly-stats-line');
    if (existingStats) existingStats.remove();
    const statsLine = document.createElement('div');
    statsLine.className = 'weekly-stats-line';
    statsLine.innerHTML = `
        <span>📋 Total tasks: <strong>${totalTasks}</strong></span>
        <span>✅ Completed: <strong>${doneTasks}</strong></span>
        <span>📅 Due this week: <strong>${weekDue}</strong></span>`;
    daysEl.parentElement.appendChild(statsLine);

    if (streakEl) {
        if (streak > 0) {
            streakEl.textContent = `🔥 ${streak}-day streak`;
            streakEl.style.display = '';
        } else {
            streakEl.style.display = 'none';
        }
    }
}


// ============================================================
// CONFETTI
// ============================================================
function fireConfetti() {
    if (typeof confetti === 'undefined') return;
    confetti({
        particleCount: 80, spread: 60, origin: { y: 0.7 },
        colors: ['#6366f1', '#a855f7', '#10b981', '#f59e0b']
    });
}


// ============================================================
// CRUD
// ============================================================
async function quickCreate(title) {
    try {
        const created = await api.create({ title, priority: 'LOW', category: 'PERSONAL' });
        if (created) { allTasks.unshift(created); renderAll(); renderWeeklyWidget(); }
        showToast('Task added! ✓', 'success');
    } catch (err) { showToast(err.message || 'Could not create task', 'error'); }
}

async function handleFormSubmit(e) {
    e.preventDefault();
    const payload = {
        title: ($('task-title')?.value || '').trim(),
        description: ($('task-desc')?.value || '').trim() || null,
        dueDate: $('task-due')?.value || null,
        priority: $('task-priority')?.value || 'LOW',
        category: $('task-category')?.value || 'PERSONAL',
    };
    if (!payload.title) { showToast('Title is required', 'error'); return; }

    const btn = e.target.querySelector('[type="submit"]');
    if (btn) btn.disabled = true;

    try {
        if (editingId) {
            const updated = await api.update(editingId, payload);
            if (updated) allTasks = allTasks.map(t => t.id === editingId ? updated : t);
            showToast('Task updated!', 'success');
        } else {
            const created = await api.create(payload);
            if (created) allTasks.unshift(created);
            showToast('Task created!', 'success');
        }
        renderAll(); renderWeeklyWidget(); closeModal();
    } catch (err) {
        showToast(err.message || 'Something went wrong', 'error');
    } finally { if (btn) btn.disabled = false; }
}

async function doToggle(id) {
    try {
        const updated = await api.toggle(id);
        if (updated) allTasks = allTasks.map(t => t.id === id ? updated : t);
        renderAll(); renderWeeklyWidget();
        if (updated?.status === 'COMPLETED') { fireConfetti(); showToast('Done! 🎉', 'success'); }
        else showToast('Marked pending', 'success');
    } catch (err) { showToast(err.message || 'Could not update', 'error'); }
}

async function doDelete(id) {
    if (!confirm('Delete this task?')) return;
    try {
        await api.delete(id);
        allTasks = allTasks.filter(t => t.id !== id);
        renderAll(); renderWeeklyWidget();
        showToast('Task deleted', 'success');
    } catch (err) { showToast(err.message || 'Could not delete', 'error'); }
}


// ============================================================
// MODAL
// ============================================================
function openAddModal() {
    editingId = null;
    const form = $('task-form'); if (form) form.reset();
    if ($('modal-title')) $('modal-title').textContent = 'Add New Task';
    if ($('task-priority')) $('task-priority').value = 'LOW';
    if ($('task-category')) $('task-category').value = 'PERSONAL';
    const mo = $('modal-overlay');
    if (mo) { mo.classList.remove('hidden'); setTimeout(() => $('task-title')?.focus(), 60); }
}

function openEditModal(id) {
    const task = allTasks.find(t => t.id === id);
    if (!task) return;
    editingId = id;
    if ($('modal-title')) $('modal-title').textContent = 'Edit Task';
    if ($('task-title')) $('task-title').value = task.title;
    if ($('task-desc')) $('task-desc').value = task.description || '';
    if ($('task-due')) $('task-due').value = task.dueDate || '';
    if ($('task-priority')) $('task-priority').value = task.priority || 'LOW';
    if ($('task-category')) $('task-category').value = task.category || 'PERSONAL';
    const mo = $('modal-overlay');
    if (mo) { mo.classList.remove('hidden'); setTimeout(() => $('task-title')?.focus(), 60); }
}

function closeModal() {
    const mo = $('modal-overlay');
    if (mo) mo.classList.add('hidden');
    const form = $('task-form'); if (form) form.reset();
    editingId = null;
}


// ============================================================
// NAV
// ============================================================
function setNav(filter, activeId) {
    activeFilter = filter;
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    const al = $(activeId); if (al) al.classList.add('active');
    document.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
    const sel = filter === 'COMPLETED' ? 'COMPLETED' : 'ALL';
    document.querySelector(`.filter-chip[data-filter="${sel}"]`)?.classList.add('active');
    renderAll();
}


// ============================================================
// NOTIFICATIONS
// ============================================================
async function initNotifications() {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') await Notification.requestPermission();
    checkAndNotify();
    setInterval(checkAndNotify, 60_000);
}

function checkAndNotify() {
    if (Notification.permission !== 'granted') return;
    const now = new Date();
    allTasks.forEach(task => {
        if (task.status === 'COMPLETED' || !task.dueDate) return;
        if (notifiedIds.has(task.id)) return;
        const due = new Date(task.dueDate + 'T23:59:00');
        const diffHours = (due - now) / 3_600_000;
        const overdue = task.dueDate < today;
        const soon = task.dueDate === today && diffHours <= 8 && diffHours > 0;
        if (!soon && !overdue) return;
        notifiedIds.add(task.id);
        const icon = { HIGH: '🔴', MEDIUM: '🟡', LOW: '🟢' }[task.priority] || '🟢';
        const body = overdue ? 'This task is overdue!' : `Due today — ${Math.ceil(diffHours)}h remaining`;
        const n = new Notification(`${icon} ${task.title}`, { body, tag: `task-${task.id}` });
        n.onclick = () => { window.focus(); n.close(); };
        setTimeout(() => n.close(), 8000);
    });
}


// ============================================================
// TOAST
// ============================================================
let toastTimer;
function showToast(msg, type = 'success') {
    const t = $('toast');
    if (!t) return;
    t.textContent = msg;
    t.className = `toast show ${type}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
}


// ============================================================
// HELPERS
// ============================================================
function formatDate(dateStr) {
    const [y, m, d] = dateStr.split('-');
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function escHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
