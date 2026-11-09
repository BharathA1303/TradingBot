import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../stores/useAuthStore';
import { useBrokerStore } from '../stores/useBrokerStore';
import AppLoader from './ui/AppLoader';

/**
 * requireOnboarding — when true, user must have a broker connected
 * before accessing the wrapped route. Connection is one-time per
 * account: gated on the server-confirmed `/api/broker/all-status`
 * result (via useBrokerStore), not just a local flag, so it holds
 * across devices/browsers for the same account. A cached localStorage
 * flag is used only as a fast-path to avoid a flash redirect for
 * already-onboarded returning users while the server check is in flight;
 * if the server disagrees, the user is corrected on the next render.
 */
export default function ProtectedRoute({ children, requireOnboarding = false }) {
    const user = useAuthStore((s) => s.user);
    const initializing = useAuthStore((s) => s.initializing);
    const anyConnected = useBrokerStore((s) => s.anyConnected);
    const statusLoaded = useBrokerStore((s) => s.statusLoaded);
    const fetchStatus = useBrokerStore((s) => s.fetchStatus);
    const [checkingBroker, setCheckingBroker] = useState(requireOnboarding && !statusLoaded);

    // Fast path: if we have a cached user in localStorage, skip the spinner
    // entirely to prevent the flash. Firebase will validate in the background.
    const hasCachedUser = !user && initializing && (() => {
        try { return !!localStorage.getItem('tradingbot_user'); } catch { return false; }
    })();

    const cachedOnboarded = (() => {
        try { return !!localStorage.getItem('tradingbot_onboarded'); } catch { return false; }
    })();

    useEffect(() => {
        if (!requireOnboarding || statusLoaded) {
            setCheckingBroker(false);
            return;
        }
        let cancelled = false;
        (async () => {
            const connected = await fetchStatus();
            if (cancelled) return;
            try {
                if (connected) localStorage.setItem('tradingbot_onboarded', '1');
                else localStorage.removeItem('tradingbot_onboarded');
            } catch {
                // localStorage unavailable — server state (anyConnected) still governs
            }
            setCheckingBroker(false);
        })();
        return () => { cancelled = true; };
    }, [requireOnboarding, statusLoaded, fetchStatus]);

    if (initializing && !hasCachedUser) {
        return <AppLoader />;
    }

    if (!user && !hasCachedUser) {
        return <Navigate to="/login" replace />;
    }

    // For dashboard/app routes, ensure account is active
    const status = (user?.account_status || 'active').toLowerCase();
    const isActive = status === 'active' && user?.is_active !== false;
    if (!isActive) {
        return <Navigate to="/account-status" replace />;
    }

    return children;
}
