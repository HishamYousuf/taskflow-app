// ============================================================
// dashboard.js — TaskFlow v6
// Full redesign: Sidebar, Accordion, Animated Donut, Quick-add,
// Weekly Timeline, Category/Priority Chips, Page-load Stagger
// ============================================================

// ---- Safe DOM helper ----
function $(id) { return document.getElementById(id); }
function on(id, event, fn) { const el = $(id); if (el) el.addEventListener(event, fn); }

// ---- State ----
let allTasks = [];
let activeFilter = 'ALL';
let searchQuery = '';
let editingId = null;
let qsPriority = null;
let qsDue = null;
const notifiedIds = new Set();
const today = new Date().toISOString().split('T')[0];


// ============================================================
// ENTRY POINT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    try { initTheme(); } catch (e) { console.error('Theme init failed', e); }
    try { initDashboard(); } catch (e) { console.error('Dashboard init failed', e); }
});


// ============================================================
// THEME
// ============================================================
function initTheme() {
    const saved = localStorage.getItem('taskflow-theme') || 'dark';
    applyTheme(saved);
    on('theme-toggle', 'click', toggleTheme);
    on('dropdown-theme', 'click', (e) => { e.stopPropagation(); toggleTheme(); });
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const isDark = theme === 'dark';
    const svgMoon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
    const svgSun = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
    const tt = $('theme-icon'); if (tt) tt.innerHTML = isDark ? svgMoon : svgSun;
    const di = $('dropdown-theme-icon'); if (di) di.textContent = isDark ? '🌙' : '☀️';
}

function toggleTheme() {
    const cur = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = cur === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    localStorage.setItem('taskflow-theme', next);
}


// ============================================================
// MAIN INIT
// ============================================================
async function initDashboard() {
    // ---- Inject SVG gradient defs for donut ----
    const svgDefs = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgDefs.setAttribute('style', 'position:absolute;width:0;height:0');
    svgDefs.innerHTML = `<defs>
        <linearGradient id="donutGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#4F46E5"/>
            <stop offset="100%" stop-color="#7C3AED"/>
        </linearGradient>
    </defs>`;
    document.body.prepend(svgDefs);

    // ---- Auth check ----
    const token = localStorage.getItem('jwt_token');
    if (!token) { window.location.href = 'login.html'; return; }

    // ---- User info ----
    let name = 'User';
    try { const u = JSON.parse(localStorage.getItem('current_user') || '{}'); name = u.name || 'User'; } catch (e) { }

    const initial = name.charAt(0).toUpperCase();
    ['user-name', 'sidebar-username'].forEach(id => { const el = $(id); if (el) el.textContent = name; });
    ['user-avatar', 'dropdown-avatar', 'sidebar-avatar'].forEach(id => { const el = $(id); if (el) el.textContent = initial; });
    if ($('dropdown-name')) $('dropdown-name').textContent = name;
    if ($('dropdown-sub')) $('dropdown-sub').textContent = 'Member';

    // ---- Sidebar mobile toggle ----
    const sidebar = $('sidebar');
    const overlay = $('sidebar-overlay');
    function openSidebar() { sidebar?.classList.add('open'); overlay?.classList.add('show'); }
    function closeSidebar() { sidebar?.classList.remove('open'); overlay?.classList.remove('show'); }
    on('topbar-hamburger', 'click', openSidebar);
    overlay?.addEventListener('click', closeSidebar);

    // ---- Sidebar nav items ----
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const section = item.dataset.section;
            if (!section || section === 'calendar' || section === 'analytics' || section === 'settings') return;
            document.querySelectorAll('.sidebar-nav .nav-item').forEach(n => n.classList.remove('active'));
            item.classList.add('active');
            if (section === 'completed') { activeFilter = 'COMPLETED'; }
            else { activeFilter = 'ALL'; }
            document.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
            document.querySelector(`.filter-chip[data-filter="${activeFilter}"]`)?.classList.add('active');
            renderAll();
            closeSidebar();
        });
    });

    // ---- FAB + empty CTA ----
    on('fab-add', 'click', openAddModal);
    on('empty-add-btn', 'click', openAddModal);
    on('empty-today-btn', 'click', openAddModal);
    on('quick-add-fab-btn', 'click', () => $('quick-add-input')?.focus());

    // ---- Logout (multiple buttons) ----
    ['logout-btn', 'dropdown-logout', 'logout-btn-hidden'].forEach(id => {
        on(id, 'click', () => {
            localStorage.removeItem('jwt_token');
            localStorage.removeItem('current_user');
            window.location.href = 'login.html';
        });
    });

    // ---- Avatar dropdown ----
    const wrap = $('avatar-wrap');
    const dropdown = $('avatar-dropdown');
    if (wrap && dropdown) {
        $('user-avatar')?.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('hidden');
        });
        document.addEventListener('click', (e) => {
            if (!wrap.contains(e.target)) dropdown.classList.add('hidden');
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
    const qaCard = $('quick-add-bar');
    const suggestions = $('quick-suggestions');

    if (qai) {
        qai.addEventListener('keydown', async (e) => {
            if (e.key !== 'Enter') return;
            const title = qai.value.trim();
            if (!title) return;
            qai.value = '';
            qsPriority = null; qsDue = null;
            hideSuggestions();
            await quickCreate(title, qsPriority, qsDue);
        });

        qai.addEventListener('focus', showSuggestions);
        qai.addEventListener('blur', (e) => {
            // delay so chip clicks register
            setTimeout(() => { if (!qaCard?.contains(document.activeElement)) hideSuggestions(); }, 200);
        });
    }

    // Quick suggestions chips
    document.querySelectorAll('[data-qs-priority]').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('[data-qs-priority]').forEach(c => c.classList.remove('active'));
            if (qsPriority === chip.dataset.qsPriority) { qsPriority = null; }
            else { qsPriority = chip.dataset.qsPriority; chip.classList.add('active'); }
        });
    });
    document.querySelectorAll('[data-qs-due]').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('[data-qs-due]').forEach(c => c.classList.remove('active'));
            if (qsDue === chip.dataset.qsDue) { qsDue = null; }
            else { qsDue = chip.dataset.qsDue; chip.classList.add('active'); }
        });
    });

    // ---- Keyboard shortcut: N → focus quick add / open modal ----
    document.addEventListener('keydown', (e) => {
        const tag = document.activeElement.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        if (e.key === 'n' || e.key === 'N') { qai?.focus(); }
        if (e.key === 'Escape') { closeModal(); hideSuggestions(); }
    });

    // ---- Load data ----
    await loadTasks();

    // ---- Notifications ----
    try { initNotifications(); } catch (e) { }
}


// ============================================================
// SUGGESTION ROW HELPERS
// ============================================================
function showSuggestions() {
    const s = $('quick-suggestions');
    if (s) { s.classList.remove('hidden'); }
}
function hideSuggestions() {
    const s = $('quick-suggestions');
    if (s) { s.classList.add('hidden'); }
    document.querySelectorAll('[data-qs-priority],[data-qs-due]').forEach(c => c.classList.remove('active'));
    qsPriority = null; qsDue = null;
}


// ============================================================
// API HELPERS
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
        if (!t.dueDate || t.dueDate === today) todayList.push(t);
        else upcomingList.push(t);
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

    tasks.forEach((t, i) => {
        const card = buildCard(t);
        card.style.animationDelay = `${i * 40}ms`;
        list.appendChild(card);
    });

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
// BUILD CARD (new design)
// ============================================================
function buildCard(task) {
    const card = document.createElement('div');
    const isDone = task.status === 'COMPLETED';
    const pri = task.priority || 'LOW';
    const cat = task.category || 'PERSONAL';

    let urgency = '';
    if (!isDone && task.dueDate) {
        if (task.dueDate < today) urgency = 'urgent';
        else if (task.dueDate === today) urgency = 'due-soon';
    }
    card.className = `task-card priority-${pri} ${isDone ? 'completed-card' : ''} ${urgency}`.trim();
    card.dataset.id = task.id;

    // Category chip
    const catMap = {
        WORK: { cls: 'cat-work', icon: '💼', label: 'Work' },
        PERSONAL: { cls: 'cat-personal', icon: '🏠', label: 'Personal' },
        HEALTH: { cls: 'cat-health', icon: '💪', label: 'Health' },
    };
    const catInfo = catMap[cat] || catMap.PERSONAL;

    // Priority badge
    const priMap = {
        HIGH: { cls: 'badge-high', label: 'High' },
        MEDIUM: { cls: 'badge-medium', label: 'Medium' },
        LOW: { cls: 'badge-low', label: 'Low' },
    };
    const priInfo = priMap[pri] || priMap.LOW;

    // Due date chip
    const dueInfo = getDueInfo(task.dueDate, isDone);
    const dueHtml = dueInfo
        ? `<span class="due-chip ${dueInfo.cls}">📅 ${dueInfo.label}</span>`
        : '';

    // Description accordion
    const hasDesc = !!task.description;
    const descHtml = hasDesc ? `
        <div class="task-desc-panel" id="desc-panel-${task.id}">
            <p class="task-desc-text">${escHtml(task.description)}</p>
            <div class="task-desc-actions">
                <button class="task-desc-btn edit-btn" data-action="edit" data-id="${task.id}">✏️ Edit</button>
                <button class="task-desc-btn delete delete-btn" data-action="delete" data-id="${task.id}">🗑️ Delete</button>
            </div>
        </div>` : '';

    card.innerHTML = `
        <div class="task-main">
            <button class="task-check${isDone ? ' done' : ''}" data-action="toggle" data-id="${task.id}"
                    title="${isDone ? 'Mark as pending' : 'Mark as complete'}"
                    aria-label="${isDone ? 'Mark as pending' : 'Mark as complete'}">
                ${isDone ? '✓' : ''}
            </button>
            <div class="task-body">
                <div class="task-title">${escHtml(task.title)}</div>
                <div class="task-meta">
                    <span class="cat-chip ${catInfo.cls}">${catInfo.icon} ${catInfo.label}</span>
                    <span class="priority-badge ${priInfo.cls}">${priInfo.label}</span>
                    ${dueHtml}
                </div>
            </div>
            <div class="task-actions">
                <button class="task-action-btn edit" data-action="edit" data-id="${task.id}" title="Edit">✏️</button>
                <button class="task-action-btn del"  data-action="delete" data-id="${task.id}" title="Delete">🗑️</button>
            </div>
        </div>
        ${descHtml}`;

    // Accordion: click task-main (not buttons) toggles description
    if (hasDesc) {
        card.querySelector('.task-main').addEventListener('click', (e) => {
            if (e.target.closest('[data-action]')) return; // let button handle
            const panel = card.querySelector(`#desc-panel-${task.id}`);
            if (panel) panel.classList.toggle('expanded');
        });
    }

    card.addEventListener('click', handleCardAction);
    return card;
}

function getDueInfo(dueDate, isDone) {
    if (!dueDate || isDone) return null;
    if (dueDate < today) return { label: 'Overdue', cls: 'overdue' };
    if (dueDate === today) return { label: 'Due today', cls: 'soon' };
    return { label: formatDate(dueDate), cls: '' };
}


// ============================================================
// CARD ACTIONS
// ============================================================
async function handleCardAction(e) {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    e.stopPropagation();
    const { action, id } = el.dataset;
    const taskId = Number(id);
    if (action === 'toggle') await doToggle(taskId, el);
    if (action === 'edit') openEditModal(taskId);
    if (action === 'delete') await doDelete(taskId);
}


// ============================================================
// STATS + DONUT RING
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
    const el = $(id); if (!el) return;
    const from = parseInt(el.textContent) || 0;
    if (from === target) return;
    const dur = 600, start = performance.now();
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

    // Animate donut: dasharray=100, dashoffset = 100 - pct
    const fill = $('ring-fill');
    if (fill) {
        // Trigger animation via setTimeout to allow CSS transition
        setTimeout(() => { fill.style.strokeDashoffset = String(100 - pct); }, 100);
    }
    if ($('ring-pct')) $('ring-pct').textContent = `${pct}%`;
    if ($('ring-subtitle')) $('ring-subtitle').textContent = total === 0 ? 'No tasks due today' : `${done} of ${total} done`;
    if ($('ring-fraction')) {
        const rem = total - done;
        $('ring-fraction').textContent = rem > 0
            ? `${rem} remaining`
            : total > 0 ? 'All done! 🎉' : '';
    }
}


// ============================================================
// WEEKLY WIDGET (new timeline design)
// ============================================================
function renderWeeklyWidget() {
    const daysEl = $('weekly-days');
    const chipsEl = $('weekly-chips');
    const streakEl = $('weekly-streak');
    if (!daysEl) return;

    const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const now = new Date();

    // Build 7-day window
    const days = [];
    let streak = 0;

    for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        const iso = d.toISOString().split('T')[0];
        const isToday = iso === today;
        const isPast = iso < today;

        const dayTasks = allTasks.filter(t => t.dueDate === iso);
        const pending = dayTasks.filter(t => t.status === 'PENDING');
        const done = dayTasks.filter(t => t.status === 'COMPLETED');
        const overdue = isPast && pending.length > 0;

        let dotClass = 'empty';
        if (dayTasks.length === 0) dotClass = 'empty';
        else if (overdue) dotClass = 'overdue';
        else if (pending.length > 0) dotClass = 'pending';
        else dotClass = 'done';

        days.push({
            abbr: DAY_NAMES[d.getDay()],
            num: d.getDate(),
            iso, isToday, isPast,
            total: dayTasks.length, done: done.length, pending: pending.length,
            dotClass,
            hadDone: done.length > 0,
            taskNames: dayTasks.map(t => t.title).slice(0, 3),
        });
    }

    // Streak
    for (let i = days.length - 2; i >= 0; i--) {
        if (days[i].hadDone) streak++;
        else break;
    }

    daysEl.innerHTML = days.map(day => `
        <div class="week-day-col${day.isToday ? ' today' : ''}" title="${day.taskNames.join(', ') || 'No tasks'}">
            <span class="week-day-abbr">${day.abbr}</span>
            <span class="week-day-num">${day.num}</span>
            <div class="week-dot ${day.dotClass}"></div>
            <span class="week-count">${day.total > 0 ? day.total : ''}</span>
        </div>`).join('');

    // Summary chips
    const totalTasks = allTasks.length;
    const doneTasks = allTasks.filter(t => t.status === 'COMPLETED').length;
    const weekDue = allTasks.filter(t => {
        if (!t.dueDate) return false;
        const d = new Date(t.dueDate + 'T00:00:00');
        const diff = (d - now) / 86400000;
        return diff >= -1 && diff <= 7;
    }).length;

    if (chipsEl) {
        chipsEl.innerHTML = `
            <div class="week-chip">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                <span>${totalTasks} Tasks</span>
            </div>
            <div class="week-chip">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                <span>${doneTasks} Completed</span>
            </div>
            <div class="week-chip">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                <span>${weekDue} Due this week</span>
            </div>`;
    }

    if (streakEl) {
        streakEl.textContent = streak > 0 ? `🔥 ${streak}-day streak` : '';
        streakEl.style.display = streak > 0 ? '' : 'none';
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
async function quickCreate(title, priority, dueKey) {
    let dueDate = null;
    if (dueKey === 'today') dueDate = today;
    else if (dueKey === 'tomorrow') {
        const d = new Date(); d.setDate(d.getDate() + 1);
        dueDate = d.toISOString().split('T')[0];
    } else if (dueKey === 'week') {
        const d = new Date(); d.setDate(d.getDate() + 7);
        dueDate = d.toISOString().split('T')[0];
    }

    try {
        const created = await api.create({
            title,
            priority: priority || 'LOW',
            category: 'PERSONAL',
            dueDate,
        });
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

async function doToggle(id, checkBtn) {
    // Visual feedback first
    if (checkBtn) {
        checkBtn.classList.add('done');
        checkBtn.textContent = '✓';
    }
    try {
        const updated = await api.toggle(id);
        if (updated) allTasks = allTasks.map(t => t.id === id ? updated : t);
        renderAll(); renderWeeklyWidget();
        if (updated?.status === 'COMPLETED') { fireConfetti(); showToast('Done! 🎉', 'success'); }
        else showToast('Marked pending', 'success');
    } catch (err) {
        showToast(err.message || 'Could not update', 'error');
        renderAll(); // revert visual
    }
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
    const mo = $('modal-overlay'); if (mo) mo.classList.add('hidden');
    const form = $('task-form'); if (form) form.reset();
    editingId = null;
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
    const t = $('toast'); if (!t) return;
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
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
