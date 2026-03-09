// ============================================================
// api.js — Base API client
// Centralized fetch wrapper that attaches JWT and handles errors
// ============================================================

const BASE_URL = '/api';

function getToken() {
    return localStorage.getItem('jwt_token');
}

async function request(path, { method = 'GET', body = null, auth = true } = {}) {
    const headers = { 'Content-Type': 'application/json' };

    if (auth) {
        const token = getToken();
        if (token) headers['Authorization'] = `Bearer ${token}`;
    }

    const config = { method, headers };
    if (body) config.body = JSON.stringify(body);

    const res = await fetch(`${BASE_URL}${path}`, config);

    // No content responses (e.g. DELETE 204)
    if (res.status === 204) return null;

    const data = await res.json().catch(() => null);

    if (!res.ok) {
        const message = data?.message || data?.error || `Error ${res.status}`;
        throw new Error(message);
    }

    return data;
}

// ---- Auth Endpoints ----
export const authApi = {
    register: (payload) => request('/register', { method: 'POST', body: payload, auth: false }),
    login: (payload) => request('/login', { method: 'POST', body: payload, auth: false }),
};

// ---- Task Endpoints ----
export const taskApi = {
    getAll: (status = null) => request(status ? `/tasks?status=${status}` : '/tasks'),
    create: (payload) => request('/tasks', { method: 'POST', body: payload }),
    update: (id, payload) => request(`/tasks/${id}`, { method: 'PUT', body: payload }),
    delete: (id) => request(`/tasks/${id}`, { method: 'DELETE' }),
    toggleStatus: (id) => request(`/tasks/${id}/status`, { method: 'PATCH' }),
};
