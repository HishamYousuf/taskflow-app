// ============================================================
// auth.js — Register, Login, Logout logic
// ============================================================

import { authApi } from './api.js';

export function saveToken(token) {
    localStorage.setItem('jwt_token', token);
}

export function getToken() {
    return localStorage.getItem('jwt_token');
}

export function saveUser(user) {
    localStorage.setItem('current_user', JSON.stringify(user));
}

export function getUser() {
    try {
        return JSON.parse(localStorage.getItem('current_user')) || {};
    } catch {
        return {};
    }
}

export function logout() {
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('current_user');
    window.location.href = 'login.html';
}

export function requireAuth() {
    if (!getToken()) {
        window.location.href = 'login.html';
    }
}

export function redirectIfLoggedIn() {
    if (getToken()) {
        window.location.href = 'dashboard.html';
    }
}

// ---- Register ----
export async function handleRegister(name, email, password) {
    const data = await authApi.register({ name, email, password });
    saveToken(data.token);
    saveUser({ name: data.name || name, email: data.email || email });
    window.location.href = 'dashboard.html';
}

// ---- Login ----
export async function handleLogin(email, password) {
    const data = await authApi.login({ email, password });
    saveToken(data.token);
    saveUser({ name: data.name || email.split('@')[0], email: data.email || email });
    window.location.href = 'dashboard.html';
}
