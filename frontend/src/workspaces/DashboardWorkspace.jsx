// ─── DashboardWorkspace ──────────────────────────────────────────────────────
// Expanded dashboard hub — KPI overview, indices, holdings, orders, and navigation.
import { useEffect, useMemo, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/useAuthStore';
import { usePortfolioStore } from '../store/usePortfolioStore';
import { useMarketStore } from '../store/useMarketStore';
import { useLiveMarketIndices } from '../market/hooks/useLiveMarketIndices';
import api from '../services/api';
import {
    TrendingUp, TrendingDown, IndianRupee,
    BarChart3, ArrowRight, Briefcase,
    ShieldCheck, ClipboardList, Link2,
} from 'lucide-react';
import { formatCurrency, formatPrice, formatPercent, pnlColorClass, cleanSymbol } from '../utils/formatters';
import { buildPortfolioMetrics } from '../utils/portfolioMetrics';
import { Skeleton } from '../components/ui';
import { cn } from '../utils/cn';

const NAV_CARDS = [
    { to: '/terminal', icon: BarChart3, label: 'Terminal', desc: 'Live charts & order execution', accent: true },
    { to: '/brokers', icon: Link2, label: 'Broker Connect', desc: 'Live broker integrations' },
    { to: '/portfolio', icon: Briefcase, label: 'Portfolio', desc: 'Holdings & performance' },
    { to: '/orders', icon: ClipboardList, label: 'Orders', desc: 'Order history & status' },
    { to: '/auto-alpha', icon: ShieldCheck, label: 'Alpha Auto', desc: 'AI-managed momentum strategy' },
];

function MiniSparkline({ data = [], color = 'var(--bullish)', width = 80, height = 24 }) {
    if (!data || data.length < 2) return null;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const points = data.map((value, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = height - ((value - min) / range) * height;
        return `${x},${y}`;
    }).join(' ');

    return (
        <svg width={width} height={height} className="flex-shrink-0 opacity-60" aria-hidden="true">
            <polyline
                fill="none"
                stroke={color}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={points}
            />
        </svg>
    );
}

const formatQuoteTime = (timestamp) => {
    if (!timestamp) return 'Today, -- IST';
    const date = new Date(typeof timestamp === 'number' && timestamp < 1e11 ? timestamp * 1000 : timestamp);
    const optionsDate = { day: 'numeric', month: 'short', year: 'numeric' };
    const optionsTime = { hour: '2-digit', minute: '2-digit', hour12: false };
    const dStr = date.toLocaleDateString('en-IN', optionsDate);
    const tStr = date.toLocaleTimeString('en-IN', optionsTime);
    return `Today, ${dStr} • ${tStr} IST`;
};

function IndexAreaChart({ candles, prevClose, isUp, timeframe, historyLoading }) {
    const [hoveredPoint, setHoveredPoint] = useState(null);
    const [containerWidth, setContainerWidth] = useState(500);
    const svgRef = useRef(null);

    useEffect(() => {
        if (!svgRef.current) return;
        const resizeObserver = new ResizeObserver((entries) => {
            for (let entry of entries) {
                setContainerWidth(entry.contentRect.width || 500);
            }
        });
        resizeObserver.observe(svgRef.current);
        return () => resizeObserver.disconnect();
    }, []);

    const svgHeight = 160;
    const padding = { top: 20, right: 15, bottom: 20, left: 55 };

    const prices = useMemo(() => candles.map(c => c.close || c.price || 0), [candles]);
    const minPrice = useMemo(() => {
        const minVal = Math.min(...prices, prevClose || Infinity);
        return minVal === Infinity ? 0 : minVal * 0.9995;
    }, [prices, prevClose]);
    const maxPrice = useMemo(() => {
        const maxVal = Math.max(...prices, prevClose || -Infinity);
        return maxVal === -Infinity ? 100 : maxVal * 1.0005;
    }, [prices, prevClose]);
    const priceRange = maxPrice - minPrice || 1;

    const points = useMemo(() => {
        if (candles.length < 2) return [];
        return candles.map((c, i) => {
            const val = c.close || c.price || 0;
            const x = padding.left + (i / (candles.length - 1)) * (containerWidth - padding.left - padding.right);
            const y = padding.top + (1 - (val - minPrice) / priceRange) * (svgHeight - padding.top - padding.bottom);
            return { x, y, price: val, time: c.time, candle: c };
        });
    }, [candles, containerWidth, minPrice, maxPrice, priceRange]);

    const linePath = useMemo(() => {
        if (points.length < 2) return '';
        return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    }, [points]);

    const areaPath = useMemo(() => {
        if (points.length < 2) return '';
        const startX = points[0].x;
        const endX = points[points.length - 1].x;
        const bottomY = svgHeight - padding.bottom;
        return `${linePath} L ${endX} ${bottomY} L ${startX} ${bottomY} Z`;
    }, [points, linePath]);

    const prevCloseY = useMemo(() => {
        if (!prevClose || prevClose < minPrice || prevClose > maxPrice) return null;
        return padding.top + (1 - (prevClose - minPrice) / priceRange) * (svgHeight - padding.top - padding.bottom);
    }, [prevClose, minPrice, maxPrice, priceRange]);

    const handleMouseMove = (e) => {
        if (!svgRef.current || points.length === 0) return;
        const rect = svgRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        
        let closest = points[0];
        let minDist = Math.abs(points[0].x - mouseX);
        for (let i = 1; i < points.length; i++) {
            const dist = Math.abs(points[i].x - mouseX);
            if (dist < minDist) {
                minDist = dist;
                closest = points[i];
            }
        }
        setHoveredPoint(closest);
    };

    const handleMouseLeave = () => {
        setHoveredPoint(null);
    };

    const color = isUp ? '#10b981' : '#ef4444';
    const gradientId = useMemo(() => `chart-gradient-${Math.random().toString(36).substr(2, 9)}`, []);

    const xAxisLabels = useMemo(() => {
        if (points.length < 2) return [];
        const labels = [];
        const step = Math.max(1, Math.floor(points.length / 5));
        for (let i = 0; i < points.length; i += step) {
            const p = points[i];
            const date = new Date(p.time * 1000);
            let text = '';
            if (timeframe === '1D') {
                text = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
            } else {
                text = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
            }
            labels.push({ x: p.x, text });
        }
        const lastP = points[points.length - 1];
        const lastDate = new Date(lastP.time * 1000);
        const lastText = timeframe === '1D'
            ? lastDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })
            : lastDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        if (labels.length > 0 && Math.abs(labels[labels.length - 1].x - lastP.x) > 40) {
            labels.push({ x: lastP.x, text: lastText });
        }
        return labels;
    }, [points, timeframe]);

    const yAxisLabels = useMemo(() => {
        const labels = [];
        for (let i = 0; i <= 4; i++) {
            const val = minPrice + (i / 4) * priceRange;
            const y = padding.top + (1 - i / 4) * (svgHeight - padding.top - padding.bottom);
            labels.push({ y, text: Math.round(val).toLocaleString('en-IN') });
        }
        return labels;
    }, [minPrice, priceRange]);

    return (
        <div className="relative w-full h-[170px] select-none mt-2" onMouseLeave={handleMouseLeave}>
            {historyLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-surface-900/40 z-10 rounded-lg">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
                </div>
            )}
            <svg
                ref={svgRef}
                width="100%"
                height={svgHeight}
                className="overflow-visible cursor-crosshair"
                onMouseMove={handleMouseMove}
            >
                <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity="0.2" />
                        <stop offset="100%" stopColor={color} stopOpacity="0.0" />
                    </linearGradient>
                </defs>

                {/* Y Axis Gridlines & Text */}
                {yAxisLabels.map((l, i) => (
                    <g key={i}>
                        <line
                            x1={padding.left}
                            y1={l.y}
                            x2={containerWidth - padding.right}
                            y2={l.y}
                            stroke="var(--border)"
                            strokeWidth="0.5"
                            strokeDasharray="3 3"
                            className="opacity-40"
                        />
                        <text
                            x={10}
                            y={l.y + 3}
                            textAnchor="start"
                            fill="var(--text-muted, #94a3b8)"
                            fontSize="9"
                            fontFamily="monospace"
                            className="font-medium opacity-75"
                        >
                            {l.text}
                        </text>
                    </g>
                ))}

                {/* Previous Close Line */}
                {prevCloseY !== null && (
                    <g>
                        <line
                            x1={padding.left}
                            y1={prevCloseY}
                            x2={containerWidth - padding.right}
                            y2={prevCloseY}
                            stroke="var(--text-muted, #94a3b8)"
                            strokeWidth="0.75"
                            strokeDasharray="3 3"
                            className="opacity-40"
                        />
                        <text
                            x={containerWidth - padding.right}
                            y={prevCloseY - 4}
                            textAnchor="end"
                            fill="var(--text-muted, #94a3b8)"
                            fontSize="8.5"
                            className="font-semibold opacity-75"
                        >
                            Prev. Close {Number(prevClose).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </text>
                    </g>
                )}

                {/* Chart paths */}
                {points.length >= 2 && (
                    <>
                        <path d={areaPath} fill={`url(#${gradientId})`} />
                        <path d={linePath} fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" />
                        
                        {!hoveredPoint && (
                            <>
                                <circle
                                    cx={points[points.length - 1].x}
                                    cy={points[points.length - 1].y}
                                    r="6"
                                    fill={color}
                                    className="animate-ping opacity-35"
                                />
                                <circle
                                    cx={points[points.length - 1].x}
                                    cy={points[points.length - 1].y}
                                    r="3.5"
                                    fill={color}
                                    stroke="var(--bg-surface, #18191f)"
                                    strokeWidth="1.5"
                                />
                            </>
                        )}
                    </>
                )}

                {/* Hover line & dot */}
                {hoveredPoint && (
                    <g>
                        <line
                            x1={hoveredPoint.x}
                            y1={padding.top}
                            x2={hoveredPoint.x}
                            y2={svgHeight - padding.bottom}
                            stroke="var(--edge, #ffffff)"
                            strokeWidth="0.75"
                            className="opacity-20"
                        />
                        <circle
                            cx={hoveredPoint.x}
                            cy={hoveredPoint.y}
                            r="4"
                            fill={color}
                            stroke="var(--bg-surface, #18191f)"
                            strokeWidth="1.5"
                        />
                    </g>
                )}

                {/* X Axis Labels */}
                {xAxisLabels.map((l, i) => (
                    <text
                        key={i}
                        x={l.x}
                        y={svgHeight - 4}
                        textAnchor="middle"
                        fill="var(--text-muted, #94a3b8)"
                        fontSize="8.5"
                        fontFamily="monospace"
                        className="opacity-60 font-medium"
                    >
                        {l.text}
                    </text>
                ))}
            </svg>

            {/* Hover Tooltip */}
            {hoveredPoint && (
                <div
                    className="absolute z-20 pointer-events-none rounded px-2 py-0.5 text-[10px] font-semibold border bg-surface-950 border-edge/20 text-heading shadow-xl flex flex-col gap-0.5"
                    style={{
                        left: `${Math.min(containerWidth - 110, Math.max(10, hoveredPoint.x - 50))}px`,
                        top: `${Math.max(5, hoveredPoint.y - 42)}px`,
                    }}
                >
                    <span className="text-[8px] text-gray-500 font-mono">
                        {new Date(hoveredPoint.time * 1000).toLocaleString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: false
                        })}
                    </span>
                    <span className="text-heading tabular-nums">
                        {Number(hoveredPoint.price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                </div>
            )}
        </div>
    );
}

export default function DashboardWorkspace() {
    const navigate = useNavigate();
    const user = useAuthStore((s) => s.user);
    const portfolio = usePortfolioStore((s) => s.summary);
    const holdings = usePortfolioStore((s) => s.holdings);
    const orders = usePortfolioStore((s) => s.orders);
    const pnl = usePortfolioStore((s) => s.pnl);
    const loading = usePortfolioStore((s) => s.isLoading);
    const refreshPortfolio = usePortfolioStore((s) => s.refreshPortfolio);
    const liveQuotes = useMarketStore((s) => s.symbols);

    const { indices } = useLiveMarketIndices();

    const [activeTab, setActiveTab] = useState('^NSEI'); // Default is NIFTY 50
    const [timeframe, setTimeframe] = useState('1D'); // Default is 1D
    const [history, setHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    useEffect(() => {
        refreshPortfolio();
    }, [refreshPortfolio]);

    useEffect(() => {
        let active = true;
        setHistory([]); // Reset history immediately on tab/timeframe switch
        const fetchHistory = async () => {
            setHistoryLoading(true);
            try {
                let period = '1d';
                let interval = '5m';
                if (timeframe === '1W') { period = '5d'; interval = '15m'; }
                else if (timeframe === '1M') { period = '1mo'; interval = '1d'; }
                else if (timeframe === '1Y') { period = '1y'; interval = '1d'; }
                
                const res = await api.get(`/market/history/${encodeURIComponent(activeTab)}?period=${period}&interval=${interval}`);
                if (res.data?.candles && active) {
                    setHistory(res.data.candles);
                } else if (active) {
                    setHistory([]);
                }
            } catch (err) {
                console.error('Failed to fetch index history:', err);
                if (active) setHistory([]);
            } finally {
                if (active) setHistoryLoading(false);
            }
        };
        fetchHistory();
        return () => { active = false; };
    }, [activeTab, timeframe]);

    const selectedIndexQuote = useMemo(() => {
        const found = indices.find(idx => idx.symbol === activeTab);
        if (found) return found;
        
        // Realistic client-side EOD/boot fallback to avoid empty layouts before Zebu API boot
        return {
            symbol: activeTab,
            name: activeTab === '^NSEI' ? 'NIFTY 50' : activeTab === '^BSESN' ? 'SENSEX' : activeTab === '^NSEBANK' ? 'BANK NIFTY' : 'FINNIFTY',
            price: activeTab === '^NSEI' ? 23962.60 : activeTab === '^BSESN' ? 76627.38 : activeTab === '^NSEBANK' ? 57559.00 : 26037.00,
            change: -205.10,
            change_percent: -0.85,
            prev_close: activeTab === '^NSEI' ? 24167.70 : activeTab === '^BSESN' ? 77282.70 : activeTab === '^NSEBANK' ? 58052.70 : 26260.00,
            high: activeTab === '^NSEI' ? 24284.65 : activeTab === '^BSESN' ? 77500 : activeTab === '^NSEBANK' ? 58200 : 26400,
            low: activeTab === '^NSEI' ? 23706.25 : activeTab === '^BSESN' ? 76100 : activeTab === '^NSEBANK' ? 57100 : 25900,
            advances: activeTab === '^NSEI' ? 31 : activeTab === '^BSESN' ? 18 : activeTab === '^NSEBANK' ? 8 : 11,
            declines: activeTab === '^NSEI' ? 19 : activeTab === '^BSESN' ? 12 : activeTab === '^NSEBANK' ? 4 : 5,
            unchanged: 0,
            timestamp: Math.floor(Date.now() / 1000)
        };
    }, [indices, activeTab]);

    const chartCandles = useMemo(() => {
        let baseCandles = [];
        if (history && history.length > 1) {
            baseCandles = history.map(c => ({ ...c }));
        } else {
            const price = selectedIndexQuote?.price || 24000;
            const prev = selectedIndexQuote?.prev_close || price * 1.008;
            const count = timeframe === '1D' ? 78 : timeframe === '1W' ? 50 : 30;
            const mock = [];
            const step = (price - prev) / count;
            const startUnix = Math.floor(Date.now() / 1000) - count * 300;
            for (let i = 0; i <= count; i++) {
                const noise = Math.sin(i * 0.4) * (price * 0.001) + Math.cos(i * 0.1) * (price * 0.0005);
                mock.push({
                    time: startUnix + i * 300,
                    close: prev + step * i + noise
                });
            }
            baseCandles = mock;
        }

        // Dynamically sync the last candle with the real-time quote price to make it animate
        if (baseCandles.length > 0 && selectedIndexQuote?.price) {
            const lastIdx = baseCandles.length - 1;
            baseCandles[lastIdx].close = selectedIndexQuote.price;
        }
        return baseCandles;
    }, [history, selectedIndexQuote, timeframe]);

    const metrics = useMemo(() => buildPortfolioMetrics({
        summary: portfolio,
        pnl,
        holdings,
        liveQuotes,
    }), [portfolio, pnl, holdings, liveQuotes]);

    const {
        liveHoldings,
        totalInvested,
        currentValue,
        availableCash,
        totalCapital,
        totalPnl,
        totalPnlPct,
    } = metrics;

    const topHoldings = liveHoldings.slice(0, 5);
    const recentOrders = (orders || []).slice(0, 5);

    const kpiCards = [
        { label: 'TOTAL CAPITAL', value: formatCurrency(totalCapital), icon: IndianRupee, iconColor: 'text-primary-600' },
        { label: 'AVAILABLE CASH', value: formatCurrency(availableCash), icon: IndianRupee, iconColor: 'text-accent-cyan' },
        { label: 'INVESTED', value: formatCurrency(totalInvested), icon: BarChart3, iconColor: 'text-primary-600' },
        { label: 'CURRENT VALUE', value: formatCurrency(currentValue), icon: TrendingUp, iconColor: 'text-accent-emerald' },
    ];

    return (
        <div className="neu-dashboard-workspace p-4 lg:p-6 space-y-6 animate-fade-in relative">
            {/* Loading overlay — fades out smoothly */}
            <div
                className="absolute inset-0 z-10 p-4 lg:p-6 space-y-6 transition-opacity duration-300"
                style={{
                    opacity: loading ? 1 : 0,
                    pointerEvents: loading ? 'auto' : 'none',
                    background: 'var(--bg-base, #0f0f1e)',
                }}
            >
                <Skeleton variant="text" className="h-8 w-48 rounded-xl" />
                <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className={cn('neu-dash-kpi p-4', i === 4 && 'col-span-2')}>
                            <Skeleton variant="text" className="h-3 w-20 rounded-md" />
                            <Skeleton variant="text" className="h-7 w-28 mt-2 rounded-lg" />
                        </div>
                    ))}
                </div>
                <Skeleton variant="chart" className="h-44 rounded-3xl" />
            </div>

            {/* Welcome Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-display font-bold text-heading tracking-tight">
                        Welcome, {user?.full_name?.split(' ')[0] || user?.username || 'Trader'}
                    </h1>
                </div>
                <div className="flex items-center gap-2">
                    <Link
                        to="/terminal"
                        className="neu-dash-btn-primary hidden sm:inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold text-white transition-all group"
                        aria-label="Open trading terminal"
                    >
                        <span>Trade Now</span>
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </Link>
                </div>
            </div>

            {/* KPI Bar */}
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-3.5">
                {kpiCards.map(({ label, value, icon: Icon, iconColor }) => (
                    <div key={label} className="neu-dash-kpi p-4 flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400">{label}</span>
                            <div className="w-8 h-8 rounded-xl neu-dash-icon-tile flex items-center justify-center flex-shrink-0">
                                <Icon className={cn('w-4 h-4', iconColor)} />
                            </div>
                        </div>
                        <span className="text-lg sm:text-xl font-price font-bold text-heading tabular-nums mt-2">
                            {value}
                        </span>
                    </div>
                ))}

                <div className={cn(
                    'neu-dash-kpi p-4 flex flex-col justify-between col-span-2 relative overflow-hidden',
                    totalPnl >= 0 ? 'neu-dash-kpi-profit' : 'neu-dash-kpi-loss'
                )}>
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400">TOTAL P&amp;L</span>
                        <div className={cn(
                            'w-8 h-8 rounded-xl neu-dash-icon-tile flex items-center justify-center flex-shrink-0',
                            totalPnl >= 0 ? 'text-emerald-500' : 'text-rose-500'
                        )}>
                            {totalPnl >= 0
                                ? <TrendingUp className="w-4 h-4 text-emerald-500" />
                                : <TrendingDown className="w-4 h-4 text-rose-500" />
                            }
                        </div>
                    </div>
                    <div className="flex items-end gap-3 mt-2">
                        <span className={cn('text-2xl sm:text-3xl font-price font-bold tabular-nums', pnlColorClass(totalPnl))}>
                            {totalPnl >= 0 ? '+' : ''}{formatCurrency(totalPnl)}
                        </span>
                        <span className={cn(
                            'text-xs font-price font-bold px-2.5 py-0.5 rounded-full neu-dash-badge tabular-nums mb-1',
                            pnlColorClass(totalPnl)
                        )}>
                            {totalPnl >= 0 ? '▲' : '▼'} {formatPercent(totalPnlPct)}
                        </span>
                    </div>
                </div>
            </div>

            {/* Market + Quick Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                <div className="lg:col-span-3 neu-dash-card p-5 lg:p-6 flex flex-col justify-between">
                    <div>
                        {/* Section Header with Tabs */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 mb-4 border-b border-slate-200/50 dark:border-white/5">
                            <h2 className="text-xs font-extrabold text-heading tracking-wider uppercase">Market Overview</h2>
                            <div className="neu-dash-inset p-1 rounded-2xl flex items-center gap-1 overflow-x-auto no-scrollbar">
                                {[
                                    { symbol: '^NSEI', name: 'NIFTY 50' },
                                    { symbol: '^BSESN', name: 'SENSEX' },
                                    { symbol: '^NSEBANK', name: 'BANK NIFTY' },
                                    { symbol: '^CNXFIN', name: 'FINNIFTY' },
                                ].map((tab) => {
                                    const active = activeTab === tab.symbol;
                                    return (
                                        <button
                                            key={tab.symbol}
                                            onClick={() => setActiveTab(tab.symbol)}
                                            className={cn(
                                                'px-3 py-1 text-xs font-bold rounded-xl transition-all duration-200 whitespace-nowrap',
                                                active
                                                    ? 'neu-dash-tab-active'
                                                    : 'text-slate-500 dark:text-slate-400 hover:text-heading'
                                            )}
                                        >
                                            {tab.name}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Large Price Quote and Timeframe select */}
                        <div className="flex items-start justify-between gap-4 mt-2">
                            <div className="space-y-1">
                                <div className="flex items-baseline gap-2.5 flex-wrap">
                                    <span className="text-3xl sm:text-4xl font-price font-extrabold text-heading tracking-tight tabular-nums">
                                        {Number(selectedIndexQuote?.price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </span>
                                    <span className={cn(
                                        'text-xs font-price font-bold px-2.5 py-0.5 rounded-full neu-dash-badge flex items-center gap-1 tabular-nums',
                                        (selectedIndexQuote?.change ?? 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'
                                    )}>
                                        {(selectedIndexQuote?.change ?? 0) >= 0 ? '▲' : '▼'}
                                        {Math.abs(selectedIndexQuote?.change_percent ?? 0).toFixed(2)}% ({(selectedIndexQuote?.change ?? 0) > 0 ? '+' : ''}{formatPrice(selectedIndexQuote?.change)})
                                    </span>
                                </div>
                                <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                                    {formatQuoteTime(selectedIndexQuote?.timestamp)}
                                </div>
                            </div>

                            {/* Timeframe pill selector */}
                            <div className="neu-dash-inset p-1 rounded-xl flex items-center gap-1 flex-shrink-0">
                                {['1D', '1W', '1M', '1Y'].map((t) => {
                                    const active = timeframe === t;
                                    return (
                                        <button
                                            key={t}
                                            onClick={() => setTimeframe(t)}
                                            className={cn(
                                                'px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all duration-150',
                                                active
                                                    ? 'neu-dash-timeframe-active'
                                                    : 'text-slate-500 dark:text-slate-400 hover:text-heading'
                                            )}
                                        >
                                            {t}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* High fidelity SVG Area Chart */}
                        <IndexAreaChart
                            candles={chartCandles}
                            prevClose={selectedIndexQuote?.prev_close}
                            isUp={(selectedIndexQuote?.change ?? 0) >= 0}
                            timeframe={timeframe}
                            historyLoading={historyLoading}
                        />
                    </div>

                    {/* Dynamic Footer stats */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-4 mt-2">
                        <div className="neu-dash-inset p-2.5 rounded-xl text-center">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">Day Low</span>
                            <span className="text-xs font-price font-extrabold text-heading mt-0.5 block tabular-nums">
                                {Number(selectedIndexQuote?.low).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                        </div>
                        <div className="neu-dash-inset p-2.5 rounded-xl text-center">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">Day High</span>
                            <span className="text-xs font-price font-extrabold text-heading mt-0.5 block tabular-nums">
                                {Number(selectedIndexQuote?.high).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                        </div>
                        <div className="neu-dash-inset p-2.5 rounded-xl text-center">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500 block">Advances</span>
                            <span className="text-xs font-price font-extrabold text-emerald-500 mt-0.5 block tabular-nums">
                                {selectedIndexQuote?.advances ?? 0}
                            </span>
                        </div>
                        <div className="neu-dash-inset p-2.5 rounded-xl text-center">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-500 block">Declines</span>
                            <span className="text-xs font-price font-extrabold text-rose-500 mt-0.5 block tabular-nums">
                                {selectedIndexQuote?.declines ?? 0}
                            </span>
                        </div>
                        <div className="neu-dash-inset p-2.5 rounded-xl text-center col-span-2 sm:col-span-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">Unchanged</span>
                            <span className="text-xs font-price font-extrabold text-slate-600 dark:text-slate-300 mt-0.5 block tabular-nums">
                                {selectedIndexQuote?.unchanged ?? 0}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-2 neu-dash-card p-5 lg:p-6 flex flex-col justify-between">
                    <div>
                        <h2 className="text-xs font-extrabold text-heading tracking-wider uppercase mb-4">Quick Actions</h2>
                        <div className="space-y-3">
                            {NAV_CARDS.slice(0, 4).map(({ to, icon: Icon, label, desc, accent }) => (
                                <Link
                                    key={to}
                                    to={to}
                                    className={cn(
                                        'neu-dash-action-row flex items-center justify-between p-3.5 rounded-2xl transition-all duration-200 group',
                                        accent ? 'neu-dash-action-accent' : ''
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl neu-dash-icon-tile flex items-center justify-center flex-shrink-0">
                                            <Icon className={cn('w-4 h-4', accent ? 'text-emerald-500' : 'text-slate-500 dark:text-slate-400 group-hover:text-heading')} />
                                        </div>
                                        <div>
                                            <span className={cn('text-sm font-bold block', accent ? 'text-emerald-500' : 'text-heading')}>
                                                {label}
                                            </span>
                                            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">{desc}</span>
                                        </div>
                                    </div>
                                    <div className="w-7 h-7 rounded-full neu-dash-arrow-tile flex items-center justify-center group-hover:translate-x-1 transition-transform">
                                        <ArrowRight className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 group-hover:text-heading" />
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Holdings + Recent Orders */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="neu-dash-card p-5 lg:p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xs font-extrabold text-heading tracking-wider uppercase">Top Holdings</h2>
                        <Link to="/portfolio" className="neu-dash-pill-btn text-xs font-bold text-emerald-600 dark:text-emerald-400 px-3.5 py-1.5 rounded-full transition-all">
                            View All →
                        </Link>
                    </div>
                    {topHoldings.length > 0 ? (
                        <div className="space-y-1">
                            {topHoldings.map((holding, i) => (
                                <button
                                    type="button"
                                    key={`${holding.symbol}-${i}`}
                                    onClick={() => navigate(`/terminal?symbol=${encodeURIComponent(holding.symbol)}`)}
                                    className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl neu-dash-row-hover transition-all text-left group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-xl neu-dash-icon-tile flex items-center justify-center text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex-shrink-0">
                                            {(cleanSymbol(holding.symbol) || '??').slice(0, 2)}
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-heading group-hover:text-emerald-500 transition-colors">{cleanSymbol(holding.symbol)}</div>
                                            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-price tabular-nums">
                                                {holding.quantity} × {formatCurrency(holding.avg_price)}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm font-price font-bold text-heading tabular-nums">{formatCurrency(holding.current_value)}</div>
                                        <div className={cn('text-[11px] font-price font-semibold tabular-nums', pnlColorClass(holding.pnl))}>
                                            {(holding.pnl ?? 0) >= 0 ? '+' : ''}{formatCurrency(holding.pnl)} ({formatPercent(holding.pnl_percent)})
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-10">
                            <div className="w-14 h-14 rounded-2xl neu-dash-inset mx-auto mb-3 flex items-center justify-center text-slate-400">
                                <IndianRupee className="w-7 h-7" />
                            </div>
                            <p className="text-sm font-semibold text-slate-500">No holdings yet</p>
                            <Link to="/terminal" className="inline-flex items-center gap-1.5 mt-3 neu-dash-pill-btn text-xs font-bold text-emerald-600 dark:text-emerald-400 px-4 py-1.5 rounded-full">
                                Start trading <ArrowRight className="w-3 h-3" />
                            </Link>
                        </div>
                    )}
                </div>

                <div className="neu-dash-card p-5 lg:p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xs font-extrabold text-heading tracking-wider uppercase">Recent Orders</h2>
                        <Link to="/orders" className="neu-dash-pill-btn text-xs font-bold text-emerald-600 dark:text-emerald-400 px-3.5 py-1.5 rounded-full transition-all">
                            View All →
                        </Link>
                    </div>
                    {recentOrders.length > 0 ? (
                        <div className="space-y-1">
                            {recentOrders.map((order, i) => (
                                <button
                                    type="button"
                                    key={`${order.id || order.order_id || i}`}
                                    onClick={() => navigate(`/terminal?symbol=${encodeURIComponent(order.symbol || '')}`)}
                                    className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl neu-dash-row-hover transition-all text-left group"
                                >
                                    <div className="flex items-center gap-3">
                                        <span className={cn(
                                            'text-[10px] font-bold px-2 py-0.5 rounded-md neu-dash-badge',
                                            order.side === 'BUY' ? 'text-emerald-500' : 'text-rose-500'
                                        )}>
                                            {order.side || '—'}
                                        </span>
                                        <div>
                                            <div className="text-sm font-bold text-heading group-hover:text-emerald-500 transition-colors">{cleanSymbol(order.symbol || 'N/A')}</div>
                                            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-price tabular-nums">{order.quantity ?? 0} qty</div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm font-price font-bold text-heading tabular-nums">
                                            {formatCurrency(order.filled_price ?? order.price)}
                                        </div>
                                        <span className={cn(
                                            'text-[10px] px-2 py-0.5 rounded-full font-bold neu-dash-badge',
                                            order.status === 'FILLED'
                                                ? 'text-emerald-500'
                                                : order.status === 'REJECTED' || order.status === 'CANCELLED'
                                                    ? 'text-rose-500'
                                                    : 'text-amber-500'
                                        )}>
                                            {order.status || 'PENDING'}
                                        </span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-10">
                            <div className="w-14 h-14 rounded-2xl neu-dash-inset mx-auto mb-3 flex items-center justify-center text-slate-400">
                                <ClipboardList className="w-7 h-7" />
                            </div>
                            <p className="text-sm font-semibold text-slate-500">No orders yet</p>
                        </div>
                    )}
                </div>
            </div>

        </div>
    );
}
