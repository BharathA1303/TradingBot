// BrokerConnectNotifier.jsx
import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useBrokerStore } from '../../stores/useBrokerStore';
import { Zap, ArrowRight, X, Link2 } from 'lucide-react';
import { cn } from '../../utils/cn';

const PRICE_PAGES = ['/terminal', '/watchlist', '/dashboard', '/portfolio'];

export default function BrokerConnectNotifier() {
    const location = useLocation();
    const navigate = useNavigate();
    const anyConnected = useBrokerStore((s) => s.anyConnected);
    const statusLoaded = useBrokerStore((s) => s.statusLoaded);
    const fetchStatus = useBrokerStore((s) => s.fetchStatus);

    const [visible, setVisible] = useState(false);
    const lastPromptRef = useRef(0);

    // Initial status fetch if not yet loaded
    useEffect(() => {
        if (!statusLoaded) {
            fetchStatus();
        }
    }, [statusLoaded, fetchStatus]);

    // Check on route change whether user is on a price-dependent page
    useEffect(() => {
        if (!statusLoaded) return;
        if (anyConnected) {
            setVisible(false);
            return;
        }

        const isPricePage = PRICE_PAGES.some((path) => location.pathname.startsWith(path));
        if (isPricePage) {
            // Show notification if broker is disconnected
            const now = Date.now();
            // Don't re-trigger if dismissed within the last 45 seconds
            if (now - lastPromptRef.current > 45_000) {
                setVisible(true);
            }
        } else {
            setVisible(false);
        }
    }, [location.pathname, anyConnected, statusLoaded]);

    if (!visible || anyConnected) return null;

    const handleDismiss = () => {
        lastPromptRef.current = Date.now();
        setVisible(false);
    };

    const handleConnect = () => {
        setVisible(false);
        navigate('/brokers');
    };

    return (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm animate-bounce-subtle select-none">
            <div className="relative overflow-hidden rounded-2xl bg-slate-900/95 dark:bg-slate-950/95 text-white border border-amber-500/30 shadow-2xl shadow-amber-500/10 backdrop-blur-xl p-4">
                {/* Glowing top line */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-emerald-400 to-teal-400" />

                <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center flex-shrink-0 mt-0.5 text-amber-400">
                        <Zap className="w-5 h-5 animate-pulse" />
                    </div>

                    <div className="flex-1 min-w-0 pr-4">
                        <div className="flex items-center gap-1.5">
                            <h4 className="text-sm font-bold text-white tracking-tight">
                                Live Market Data Paused
                            </h4>
                        </div>
                        <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                            Please connect your broker to stream real-time NSE & BSE stock prices.
                        </p>

                        <div className="mt-3 flex items-center gap-2">
                            <button
                                type="button"
                                onClick={handleConnect}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-bold text-xs shadow-md transition-all duration-150 hover:scale-105"
                            >
                                <Link2 className="w-3.5 h-3.5" />
                                <span>Connect Broker</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                            </button>

                            <button
                                type="button"
                                onClick={handleDismiss}
                                className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                            >
                                Later
                            </button>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={handleDismiss}
                        className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors flex-shrink-0 -mr-1 -mt-1"
                        aria-label="Dismiss notification"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}
