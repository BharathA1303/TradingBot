import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/useAuthStore';
import toast from 'react-hot-toast';

export default function AdminAccessPage() {
    const navigate = useNavigate();
    const user = useAuthStore((s) => s.user);
    const initializing = useAuthStore((s) => s.initializing);
    const loginWithEmail = useAuthStore((s) => s.loginWithEmail);
    const logout = useAuthStore((s) => s.logout);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    if (initializing) {
        return (
            <div style={styles.shell}>
                <div style={styles.card}>
                    <div style={styles.spinner} />
                    <p style={styles.muted}>Preparing admin access...</p>
                </div>
            </div>
        );
    }

    if (user?.role === 'admin') {
        return <Navigate to="/admin/panel" replace />;
    }

    const handleSubmit = async (e) => {
        e.preventDefault();
        const em = email.trim().toLowerCase();
        if (!em || !password) {
            toast.error('Email and password are required');
            return;
        }

        setLoading(true);
        try {
            const res = await loginWithEmail(em, password);
            const loggedInUser = res?.user;
            if (loggedInUser?.role === 'admin') {
                toast.success('Admin authenticated successfully');
                navigate('/admin/panel', { replace: true });
            } else {
                toast.error(`Signed in as ${loggedInUser?.email || em}, but this account does not have admin permissions.`);
            }
        } catch (err) {
            const msg = err?.response?.data?.detail || err.message || 'Admin authentication failed';
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={styles.shell}>
            <div style={styles.card}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                    <div style={styles.badge}>Admin Control Center</div>
                    <button
                        type="button"
                        style={styles.linkBtn}
                        onClick={() => navigate('/login')}
                    >
                        ← Live Trading
                    </button>
                </div>

                <h1 style={styles.title}>TradingBot Admin Panel</h1>
                <p style={styles.text}>
                    Enter your email and password to open the admin console.
                </p>

                {user && user.role !== 'admin' && (
                    <div style={styles.warningBox}>
                        Currently signed in as <strong>{user.email}</strong> (Standard User).
                        Please sign in below with your admin account.
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ marginTop: '24px' }}>
                    <div style={styles.fieldGroup}>
                        <label style={styles.label}>Admin Email</label>
                        <input
                            type="email"
                            required
                            autoComplete="email"
                            placeholder="admin@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            style={styles.input}
                        />
                    </div>

                    <div style={styles.fieldGroup}>
                        <label style={styles.label}>Password</label>
                        <input
                            type="password"
                            required
                            autoComplete="current-password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            style={styles.input}
                        />
                    </div>

                    <div style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
                        <button
                            type="submit"
                            disabled={loading}
                            style={{
                                ...styles.primaryBtn,
                                opacity: loading ? 0.7 : 1,
                                cursor: loading ? 'not-allowed' : 'pointer',
                            }}
                        >
                            {loading ? 'Authenticating...' : 'Sign In to Admin Panel'}
                        </button>
                        {user && (
                            <button
                                type="button"
                                style={styles.secondaryBtn}
                                onClick={async () => {
                                    await logout();
                                    navigate('/login');
                                }}
                            >
                                Sign Out
                            </button>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
}

const styles = {
    shell: {
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(circle at 0% 0%, #1f334e 0%, #0f1a31 48%, #090f1f 100%)',
        color: '#e2e8f0',
        padding: '24px',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
    },
    card: {
        width: '100%',
        maxWidth: '480px',
        borderRadius: '18px',
        border: '1px solid rgba(148,163,184,0.24)',
        background: 'linear-gradient(165deg, rgba(30,41,59,0.96), rgba(15,23,42,0.95))',
        boxShadow: '0 28px 64px rgba(0,0,0,0.45)',
        padding: '32px',
    },
    badge: {
        display: 'inline-flex',
        alignItems: 'center',
        padding: '6px 14px',
        borderRadius: '999px',
        border: '1px solid rgba(16,185,129,0.5)',
        background: 'rgba(16,185,129,0.1)',
        color: '#10b981',
        fontWeight: 700,
        fontSize: '12px',
        letterSpacing: '0.4px',
        textTransform: 'uppercase',
    },
    linkBtn: {
        background: 'transparent',
        border: 'none',
        color: '#94a3b8',
        fontSize: '13px',
        cursor: 'pointer',
        padding: '4px 8px',
    },
    title: {
        margin: '0 0 8px 0',
        fontSize: '28px',
        fontWeight: 700,
        color: '#ffffff',
    },
    text: {
        margin: '0 0 16px 0',
        color: '#94a3b8',
        fontSize: '14px',
        lineHeight: 1.5,
    },
    warningBox: {
        background: 'rgba(234, 179, 8, 0.1)',
        border: '1px solid rgba(234, 179, 8, 0.3)',
        borderRadius: '8px',
        padding: '10px 14px',
        fontSize: '13px',
        color: '#facc15',
        marginBottom: '16px',
    },
    fieldGroup: {
        marginBottom: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
    },
    label: {
        fontSize: '13px',
        fontWeight: 600,
        color: '#cbd5e1',
    },
    input: {
        width: '100%',
        padding: '12px 14px',
        borderRadius: '10px',
        border: '1px solid rgba(148,163,184,0.25)',
        background: 'rgba(15,23,42,0.7)',
        color: '#ffffff',
        fontSize: '14px',
        outline: 'none',
        boxSizing: 'border-box',
    },
    primaryBtn: {
        flex: 1,
        border: 'none',
        background: 'linear-gradient(135deg, #00B67A, #059669)',
        color: '#fff',
        borderRadius: '10px',
        padding: '12px 18px',
        fontWeight: 700,
        fontSize: '14px',
        cursor: 'pointer',
    },
    secondaryBtn: {
        border: '1px solid rgba(148,163,184,0.4)',
        background: 'transparent',
        color: '#cbd5e1',
        borderRadius: '10px',
        padding: '12px 16px',
        fontWeight: 600,
        fontSize: '14px',
        cursor: 'pointer',
    },
    muted: {
        marginTop: '12px',
        color: '#94a3b8',
        fontSize: '14px',
    },
    spinner: {
        width: '36px',
        height: '36px',
        border: '3px solid rgba(0,182,122,0.2)',
        borderTopColor: '#00B67A',
        borderRadius: '999px',
        animation: 'spin 1s linear infinite',
    },
};
