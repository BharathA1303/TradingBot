/**
 * TradingBot Auth — Simple JWT (no Firebase)
 * Drop-in replacement for the Firebase config module.
 * All functions work with our backend JWT API.
 */

export const DEMO_MODE = false;

// Minimal auth object that mimics Firebase Auth's interface
let _currentUser = null;
let _authStateCallbacks = [];

export const auth = {
    get currentUser() { return _currentUser; },
    signOut: () => signOut(null),
};

export function setCurrentUser(user) {
    _currentUser = user;
    _authStateCallbacks.forEach(cb => cb(user));
}

// Fake Firebase-compatible exports (unused but imported by other files)
export const googleProvider = null;

export function signInWithPopup() {
    return Promise.reject(new Error('Google sign-in is disabled'));
}

export async function signInWithEmailAndPassword(_, email, password) {
    const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const error = new Error(err.detail || 'Login failed');
        error.code = res.status === 401 ? 'auth/invalid-credential' : 'auth/unknown';
        throw error;
    }
    const data = await res.json();
    const token = data.token;
    localStorage.setItem('tradingbot_token', token);
    const user = {
        uid: data.user?.id,
        email: data.user?.email,
        displayName: data.user?.full_name,
        emailVerified: true,
        getIdToken: async () => localStorage.getItem('tradingbot_token') || '',
        providerData: [{ providerId: 'password' }],
    };
    setCurrentUser(user);
    return { user, backendUser: data.user };
}

export async function createUserWithEmailAndPassword(_, email, password) {
    // Registration handled separately via /api/auth/register
    return { user: null };
}

export function signOut(_) {
    localStorage.removeItem('tradingbot_token');
    localStorage.removeItem('tradingbot_user');
    setCurrentUser(null);
    return Promise.resolve();
}

export function onAuthStateChanged(_, callback) {
    _authStateCallbacks.push(callback);
    // Fire immediately with current state
    callback(_currentUser);
    // Return unsubscribe function
    return () => {
        _authStateCallbacks = _authStateCallbacks.filter(cb => cb !== callback);
    };
}

export function sendPasswordResetEmail() {
    return Promise.resolve();
}

export function sendEmailVerification() {
    return Promise.resolve();
}

export function updateProfile(user, profile) {
    if (user && profile.displayName) user.displayName = profile.displayName;
    return Promise.resolve();
}

export default { currentUser: null };
