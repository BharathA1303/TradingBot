import { memo, useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '../../utils/cn';
import { CHART_PERIODS, isMcxSymbol } from '../../utils/constants';
import { formatPrice, formatPercent, pnlColorClass, cleanSymbol } from '../../utils/formatters';
import api from '../../services/api';
import { useZeroLossStore } from '../../stores/useZeroLossStore';
import { useNavigate } from 'react-router-dom';
import { usePortfolioStore } from '../../store/usePortfolioStore';

const ALL_PERIODS = Object.entries(CHART_PERIODS);
const INTRADAY = ALL_PERIODS.filter(([, v]) => v.group === 'intraday');
const DAILY = ALL_PERIODS.filter(([, v]) => v.group === 'daily');
const EXTENDED = ALL_PERIODS.filter(([, v]) => v.group === 'extended');

function ChartHeader({
    symbol,
    quote,
    period,
    onPeriodChange,
    strategyDockOpen,
    onToggleStrategyDock,
    isWatchlisted = false,
    onToggleWatchlist,
    watchlistBusy = false,
    trendData,
    isMobile = false,
    hasPositions = false,
    orderPanelVisible = true,
    onToggleOrderPanel,
}) {
    const [open, setOpen] = useState(false);
    const [killSwitchBusy, setKillSwitchBusy] = useState(false);
    const [zlPopup, setZlPopup] = useState(false);
    const dropRef = useRef(null);
    const zlRef = useRef(null);
    const navigate = useNavigate();

    // ZeroLoss store
    const zlEnabled = useZeroLossStore((s) => s.enabled);
    const zlStats = useZeroLossStore((s) => s.stats);
    const zlPositions = useZeroLossStore((s) => s.activePositions);
    const zlLog = useZeroLossStore((s) => s.liveLog);
    const zlPosCount = Object.keys(zlPositions || {}).length;

    const handleKillSwitch = useCallback(async () => {
        if (!confirm('⚠️ KILL SWITCH: Close ALL open positions immediately?')) return;
        setKillSwitchBusy(true);
        try {
            const res = await api.post('/orders/close-all');
            const data = res.data;
            alert(data.message + (data.errors?.length ? '\nErrors: ' + data.errors.join(', ') : ''));
            await usePortfolioStore.getState().refreshPortfolio();
            setTimeout(() => {
                usePortfolioStore.getState().refreshPortfolio();
            }, 500);
        } catch (err) {
            alert('Kill switch failed: ' + (err.response?.data?.detail || err.message));
        } finally {
            setKillSwitchBusy(false);
        }
    }, []);

    // Close on outside click
    useEffect(() => {
        if (!open) return;
        const handler = (e) => {
            if (dropRef.current && !dropRef.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    // Close ZL popup on outside click
    useEffect(() => {
        if (!zlPopup) return;
        const handler = (e) => {
            if (zlRef.current && !zlRef.current.contains(e.target)) setZlPopup(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [zlPopup]);

    if (!symbol) return null;

    const currentLabel = CHART_PERIODS[period]?.label ?? period;
    const exchangeLabel = symbol.endsWith('.BO')
        ? 'BSE'
        : isMcxSymbol(symbol)
            ? 'MCX'
            : 'NSE';

    return (
        <div className="neu-terminal-header flex items-center w-full h-12 px-3 sm:px-4 shadow-sm select-none">

            {/* ── LEFT: Symbol + Price + Change ──────────────────── */}
            <div className="flex items-center gap-2.5 sm:gap-3 flex-shrink-0">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl neu-pulse-pill flex items-center justify-center font-black text-xs text-heading flex-shrink-0">
                        {cleanSymbol(symbol).slice(0, 2)}
                    </div>
                    <div className="flex flex-col leading-none">
                        <span className="text-sm font-extrabold text-heading truncate max-w-[130px] sm:max-w-[160px]">
                            {cleanSymbol(symbol)}
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 font-bold">{exchangeLabel}</span>
                    </div>
                </div>

                {quote?.price != null && (
                    <div className="flex items-center gap-2">
                        <span className="text-base font-black font-price text-heading tabular-nums">
                            ₹{formatPrice(quote.price)}
                        </span>
                        {quote.change != null && !isMobile && (
                            <span className={cn(
                                'text-xs font-price font-bold px-2.5 py-0.5 rounded-full neu-dash-badge whitespace-nowrap tabular-nums',
                                pnlColorClass(quote.change)
                            )}>
                                {quote.change >= 0 ? '▲ +' : '▼ '}
                                {formatPrice(quote.change)} ({formatPercent(quote.change_percent)})
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* Divider */}
            <div className="w-px h-5 bg-slate-200 dark:bg-white/10 mx-2.5 sm:mx-3 flex-shrink-0" />

            {/* ── CENTER: Timeframe dropdown + Strategy ───────────── */}
            <div className="flex items-center gap-2 flex-1 justify-center">
                {/* Timeframe dropdown */}
                <div className="relative" ref={dropRef}>
                    <button
                        onClick={() => setOpen((v) => !v)}
                        className={cn(
                            'h-7 px-2.5 rounded-xl text-xs font-bold',
                            'inline-flex items-center gap-1.5 transition-all duration-150',
                            open
                                ? 'neu-btn-active scale-102'
                                : 'neu-terminal-pill-btn text-slate-600 dark:text-slate-300 hover:text-heading hover:scale-102'
                        )}
                    >
                        <span className="font-price tabular-nums">{currentLabel}</span>
                        <svg className={cn('w-3 h-3 transition-transform duration-150', open && 'rotate-180')} viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                        </svg>
                    </button>

                    {open && (
                        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 min-w-[170px] rounded-2xl neu-dash-card shadow-2xl p-2 space-y-1">
                            <p className="px-2 pt-1 pb-0.5 text-[9px] font-bold text-slate-400 uppercase tracking-wider">Intraday</p>
                            {INTRADAY.map(([key, { label }]) => (
                                <button
                                    key={key}
                                    onClick={() => { onPeriodChange?.(key); setOpen(false); }}
                                    className={cn(
                                        'w-full text-left px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors',
                                        'flex items-center justify-between',
                                        period === key
                                            ? 'neu-btn-active'
                                            : 'text-slate-600 dark:text-slate-300 hover:text-heading hover:bg-slate-500/10'
                                    )}
                                >
                                    <span>{label}</span>
                                    {period === key && (
                                        <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                    )}
                                </button>
                            ))}
                            <div className="h-px bg-slate-200/60 dark:bg-white/10 my-1 mx-1" />
                            <p className="px-2 pt-1 pb-0.5 text-[9px] font-bold text-slate-400 uppercase tracking-wider">Daily+</p>
                            {DAILY.map(([key, { label }]) => (
                                <button
                                    key={key}
                                    onClick={() => { onPeriodChange?.(key); setOpen(false); }}
                                    className={cn(
                                        'w-full text-left px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors',
                                        'flex items-center justify-between',
                                        period === key
                                            ? 'neu-btn-active'
                                            : 'text-slate-600 dark:text-slate-300 hover:text-heading hover:bg-slate-500/10'
                                    )}
                                >
                                    <span>{label}</span>
                                    {period === key && (
                                        <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                    )}
                                </button>
                            ))}
                            <div className="h-px bg-slate-200/60 dark:bg-white/10 my-1 mx-1" />
                            <p className="px-2 pt-1 pb-0.5 text-[9px] font-bold text-slate-400 uppercase tracking-wider">Extended</p>
                            {EXTENDED.map(([key, { label }]) => (
                                <button
                                    key={key}
                                    onClick={() => { onPeriodChange?.(key); setOpen(false); }}
                                    className={cn(
                                        'w-full text-left px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors',
                                        'flex items-center justify-between',
                                        period === key
                                            ? 'neu-btn-active'
                                            : 'text-slate-600 dark:text-slate-300 hover:text-heading hover:bg-slate-500/10'
                                    )}
                                >
                                    <span>{label}</span>
                                    {period === key && (
                                        <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {!isMobile && (
                    <>
                        <button
                            onClick={onToggleWatchlist}
                            disabled={watchlistBusy}
                            className={cn(
                                'h-7 px-2.5 rounded-xl text-xs font-bold',
                                'inline-flex items-center justify-center transition-all duration-150 flex-shrink-0',
                                watchlistBusy && 'opacity-60 cursor-not-allowed',
                                isWatchlisted
                                    ? 'neu-btn-active text-amber-400 scale-102'
                                    : 'neu-terminal-pill-btn text-slate-400 hover:text-amber-400 hover:scale-102'
                            )}
                            title={isWatchlisted ? 'In Watchlist' : 'Add to Watchlist'}
                            aria-label={isWatchlisted ? 'In Watchlist' : 'Add to Watchlist'}
                        >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill={isWatchlisted ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                                <path d="m12 2 3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14 2 9.27l6.91-1.01L12 2z" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </button>

                        <button
                            onClick={onToggleStrategyDock}
                            className={cn(
                                'h-7 px-2.5 rounded-xl text-xs font-bold',
                                'inline-flex items-center justify-center gap-1.5',
                                'transition-all duration-150 flex-shrink-0',
                                strategyDockOpen
                                    ? 'neu-btn-active scale-102'
                                    : 'neu-terminal-pill-btn text-slate-600 dark:text-slate-300 hover:text-heading hover:scale-102'
                            )}
                            title="Toggle Strategy Dock"
                        >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 20V10M18 20V4M6 20v-4" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            <span className="hidden md:inline">Strategies</span>
                        </button>

                        {/* Alpha Auto Quick View */}
                        <div className="relative" ref={zlRef}>
                            <button
                                onClick={() => setZlPopup(v => !v)}
                                className={cn(
                                    'h-7 px-2.5 rounded-xl text-[11px] font-bold',
                                    'inline-flex items-center justify-center gap-1.5',
                                    'transition-all duration-150 flex-shrink-0',
                                    zlEnabled
                                        ? 'neu-btn-active text-emerald-400 scale-102'
                                        : 'neu-terminal-pill-btn text-slate-500 hover:text-heading hover:scale-102'
                                )}
                                title="Alpha Auto Status"
                            >
                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                </svg>
                                <span>ZL</span>
                                {zlEnabled && zlPosCount > 0 && (
                                    <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-[9px] font-extrabold">{zlPosCount}</span>
                                )}
                            </button>

                            {zlPopup && (
                                <div className="absolute top-full right-0 mt-2 z-50 w-[320px] rounded-2xl neu-dash-card shadow-2xl p-4 space-y-3">
                                    {/* Header */}
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-heading flex items-center gap-1.5">
                                            <svg className="w-4 h-4 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                            </svg>
                                            Alpha Auto
                                        </span>
                                        <span className={cn(
                                            'px-2 py-0.5 rounded-full text-[9px] font-bold neu-dash-badge',
                                            zlEnabled ? 'text-emerald-500' : 'text-slate-400'
                                        )}>
                                            {zlEnabled ? 'LIVE' : 'OFF'}
                                        </span>
                                    </div>

                                    {/* Quick Stats */}
                                    <div className="grid grid-cols-4 gap-1.5">
                                        {[
                                            { l: 'Positions', v: zlPosCount, c: zlPosCount > 0 ? 'text-blue-500' : 'text-slate-400' },
                                            { l: 'Trades', v: zlStats?.today_trades ?? 0 },
                                            { l: 'Wins', v: zlStats?.today_profit ?? 0, c: 'text-emerald-500' },
                                            { l: 'P&L', v: `₹${(zlStats?.today_pnl ?? 0).toFixed(0)}`, c: (zlStats?.today_pnl ?? 0) >= 0 ? 'text-emerald-500' : 'text-rose-500' },
                                        ].map((s, i) => (
                                            <div key={i} className="neu-dash-inset text-center p-2 rounded-xl">
                                                <div className="text-[8px] text-slate-400 font-bold uppercase">{s.l}</div>
                                                <div className={cn('text-xs font-bold font-price tabular-nums mt-0.5', s.c || 'text-heading')}>{s.v}</div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Open Full Page */}
                                    <button
                                        onClick={() => { setZlPopup(false); navigate('/auto-alpha'); }}
                                        className="w-full text-center py-2 rounded-xl neu-terminal-pill-btn text-emerald-600 dark:text-emerald-400 text-xs font-bold hover:scale-102 transition-all"
                                    >
                                        Open Alpha Auto Dashboard →
                                    </button>
                                </div>
                            )}
                        </div>

                        <button
                            onClick={onToggleOrderPanel}
                            className={cn(
                                'h-7 px-3 rounded-xl text-[11px] font-bold',
                                'inline-flex items-center justify-center gap-1.5',
                                'transition-all duration-150 flex-shrink-0',
                                orderPanelVisible
                                    ? 'neu-btn-active scale-102'
                                    : 'neu-terminal-pill-btn text-slate-600 dark:text-slate-300 hover:text-heading hover:scale-102'
                            )}
                            title={orderPanelVisible ? 'Hide order panel' : 'Show order panel'}
                        >
                            Order Panel
                        </button>

                        {/* Kill Switch — visible when positions exist */}
                        {hasPositions && (
                            <button
                                onClick={handleKillSwitch}
                                disabled={killSwitchBusy}
                                className={cn(
                                    'h-7 px-2.5 rounded-xl text-[11px] font-extrabold',
                                    'inline-flex items-center justify-center gap-1.5',
                                    'transition-all duration-150 flex-shrink-0',
                                    'bg-rose-500/15 border border-rose-500/30 text-rose-500 hover:bg-rose-500/25 shadow-sm',
                                    killSwitchBusy && 'opacity-50 cursor-not-allowed'
                                )}
                                title="Kill Switch — Close all positions immediately"
                            >
                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                    <circle cx="12" cy="12" r="10" />
                                    <path d="M12 2v4M12 6v6" />
                                </svg>
                                <span>{killSwitchBusy ? 'CLOSING...' : 'KILL'}</span>
                            </button>
                        )}

                    </>
                )}
            </div>

        </div>
    );
}

export default memo(ChartHeader);
