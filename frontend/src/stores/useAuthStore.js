/**
 * Auth store — JWT-based authentication (no Firebase).
 *
 * Flow:
 *   1. User enters email+password
 *   2. POST /api/auth/login → returns JWT token + user profile
 *   3. Token stored in localStorage as 'tradingbot_token'
 *   4. All subsequent API calls use token as Bearer
 *   5. On app load, check localStorage for token + call /api/auth/me to restore session
 */
import { create } from 'zustand';
import api from '../services/api';
import {
    setUserSessionCookie,
    clearUserSessionCookie,
} from '../utils/authSessionCookie';

const GROUP_TOKEN_STORAGE_KEY = 'tradingbot_group_token';

function getGroupTokenForSync() {
    try {
        const params = new URLSearchParams(window.location.search || '');
        const fromUrl = (params.get('grp') || '').trim();
        if (fromUrl) {
            localStorage.setItem(GROUP_TOKEN_STORAGE_KEY, fromUrl);
            return fromUrl;
        }
    } catch {
    }

    try {
        const stored = (localStorage.getItem(GROUP_TOKEN_STORAGE_KEY) || '').trim();
        return stored || '';
    } catch {
        return '';
    }
}

function syncUserSessionCookie() {
    setUserSessionCookie();
}

export const useAuthStore = create((set, get) => ({
    /** @type {object|null} */
    user: (() => {
        try {
            const stored = localStorage.getItem('tradingbot_user');
            return stored ? JSON.parse(stored) : null;
        } catch { return null; }
    })(),

    /** @type {boolean} */
    loading: true,

    /** @type {boolean} */
    initializing: true,

    // ─── Initialize auth state from localStorage ───────────────────────────────

    /**
     * Call once on app mount to restore auth state from localStorage.
     * Verifies token with backend /api/auth/me.
     */
    initAuth: () => {
        const token = localStorage.getItem('tradingbot_token');
        if (!token) {
            set({ user: null, loading: false, initializing: false });
            return () => {};
        }

        // Verify token with backend
        api.get('/auth/me')
            .then((res) => {
                const userData = res.data;
                localStorage.setItem('tradingbot_user', JSON.stringify(userData));
                syncUserSessionCookie();
                set({ user: userData, loading: false, initializing: false });
            })
            .catch(() => {
                // Token invalid or expired — clear auth state
                localStorage.removeItem('tradingbot_token');
                localStorage.removeItem('tradingbot_user');
                clearUserSessionCookie();
                set({ user: null, loading: false, initializing: false });
            });

        return () => {}; // return unsubscribe no-op for compatibility
    },

    // ─── Actions ──────────────────────────────────────────────────────────────

    loginWithGoogle: async () => {
        const error = new Error('Google sign-in is disabled. Please use email and password.');
        error.code = 'auth/google-disabled';
        throw error;
    },

    loginWithEmail: async (email, password) => {
        const res = await api.post('/auth/login', { email, password });
        const { token, user: userData } = res.data;

        localStorage.setItem('tradingbot_token', token);
        localStorage.setItem('tradingbot_user', JSON.stringify(userData));
        localStorage.removeItem(GROUP_TOKEN_STORAGE_KEY);
        syncUserSessionCookie();
        set({ user: userData, loading: false, initializing: false });

        return { success: true, isNew: false, user: userData };
    },

    registerWithEmail: async (email, password, fullName, username) => {
        const groupToken = getGroupTokenForSync();
        const res = await api.post('/auth/register', {
            email,
            password,
            full_name: fullName || '',
            username: username || '',
            ...(groupToken ? { group_token: groupToken } : {}),
        });
        const { token, user: userData } = res.data;

        if (token) {
            localStorage.setItem('tradingbot_token', token);
            localStorage.setItem('tradingbot_user', JSON.stringify(userData));
            syncUserSessionCookie();
            set({ user: userData, loading: false, initializing: false });
        }

        localStorage.removeItem(GROUP_TOKEN_STORAGE_KEY);

        return { success: true, needsVerification: false, user: userData };
    },

    resendVerification: async () => {
        // No email verification needed with JWT auth
        return { sent: false, alreadyVerified: true };
    },

    resetPassword: async (email) => {
        // Placeholder — implement server-side password reset if needed
        console.warn('Password reset not yet implemented for JWT auth');
    },

    logout: async () => {
        try {
            await api.post('/auth/logout');
        } catch {
            // Best-effort
        }
        localStorage.removeItem('tradingbot_token');
        localStorage.removeItem('tradingbot_user');
        localStorage.removeItem('tradingbot_onboarded');
        localStorage.removeItem('tradingbot_trading_mode');
        clearUserSessionCookie();
        try {
            sessionStorage.removeItem('tradingbot_admin_session');
        } catch {
        }
        set({ user: null });
    },

    /**
     * Get the current JWT token from localStorage.
     * Used by the API interceptor.
     */
    getToken: async () => {
        return localStorage.getItem('tradingbot_token') || null;
    },

    /**
     * Partially update user fields in store + localStorage.
     */
    updateUser: (patch) => {
        const current = get().user;
        if (!current) return;
        const updated = { ...current, ...patch };
        localStorage.setItem('tradingbot_user', JSON.stringify(updated));
        set({ user: updated });
    },

    /**
     * Save the user's mobile number as contact info (no OTP required).
     * Validates format on the backend (+91, 10-digit, starts with 6-9).
     * Patches the in-memory store so callers see the phone immediately.
     */
    submitPhone: async (phone) => {
        const response = await api.post('/auth/set-phone', { phone });
        const current = get().user;
        if (current) {
            const updated = { ...current, phone: response.data.phone };
            localStorage.setItem('tradingbot_user', JSON.stringify(updated));
            set({ user: updated });
        }
        return response.data;
    },
}));
