// WatchlistPage.jsx - Dedicated high-level, premier Watchlist section
import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWatchlistStore } from '../stores/useWatchlistStore';
import { useMarketStore } from '../store/useMarketStore';
import { useBrokerStore } from '../stores/useBrokerStore';
import AddSymbolModal from '../components/trading/AddSymbolModal';
import Modal from '../components/ui/Modal';
import { mergeWatchlistPrices } from '../utils/liveQuote';
import { formatCurrency, formatPrice, formatPercent, cleanSymbol } from '../utils/formatters';
import {
    Bookmark, Plus, Search, Trash2, Edit2, TrendingUp, TrendingDown,
    LineChart, Zap, Link2, ArrowUpRight, Check, X,
    LayoutGrid, List, ArrowUpDown, ChevronRight, Activity, Flame
} from 'lucide-react';
import { cn } from '../utils/cn';

export default function WatchlistPage() {
    const navigate = useNavigate();
    const {
        watchlists,
        activeId,
        prices: watchlistPrices,
        isLoading,
        setActiveWatchlist,
        createWatchlist,
        renameWatchlist,
        deleteWatchlist,
        addItem,
        removeItem,
        fetchPrices,
    } = useWatchlistStore();

    const liveQuotes = useMarketStore((s) => s.symbols);
    const anyConnected = useBrokerStore((s) => s.anyConnected);
    const statusLoaded = useBrokerStore((s) => s.statusLoaded);

    const mergedPrices = useMemo(
        () => mergeWatchlistPrices(watchlistPrices, liveQuotes),
        [watchlistPrices, liveQuotes]
    );

    const activeWatchlist = useMemo(
        () => watchlists.find((w) => w.id === activeId) || watchlists[0],
        [watchlists, activeId]
    );

    const items = activeWatchlist?.items ?? [];

    // State
    const [viewMode, setViewMode] = useState(() => {
        try {
            return localStorage.getItem('tradingbot_wl_view') || 'grid';
        } catch {
            return 'grid';
        }
    });
    const [filterQuery, setFilterQuery] = useState('');
    const [sortBy, setSortBy] = useState('default');
    const [trendFilter, setTrendFilter] = useState('all'); // 'all' | 'gainers' | 'losers'
    const [addModalOpen, setAddModalOpen] = useState(false);
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [newWlName, setNewWlName] = useState('');
    const [editingWlId, setEditingWlId] = useState(null);
    const [editingWlName, setEditingWlName] = useState('');

    const handleSetViewMode = (mode) => {
        setViewMode(mode);
        try {
            localStorage.setItem('tradingbot_wl_view', mode);
        } catch {}
    };

    // Fetch prices on mount & active watchlist change
    useEffect(() => {
        if (items.length > 0) {
            fetchPrices();
        }
    }, [activeId, items.length, fetchPrices]);

    // Market Pulse Statistics
    const pulseStats = useMemo(() => {
        let advances = 0;
        let declines = 0;
        let unchanged = 0;
        let topGainer = null;
        let topLoser = null;

        items.forEach((item) => {
            const quote = mergedPrices[item.symbol] || mergedPrices[item.symbol?.replace(/\.(NS|BO)$/i, '')] || {};
            const chg = quote.change ?? (quote.price != null && quote.prev_close != null ? quote.price - quote.prev_close : null);
            const chgPct = quote.change_percent ?? (chg != null && quote.prev_close ? (chg / quote.prev_close) * 100 : null);

            if (chg != null) {
                if (chg > 0) advances++;
                else if (chg < 0) declines++;
                else unchanged++;
            }

            if (chgPct != null && quote.price != null) {
                if (!topGainer || chgPct > topGainer.pct) {
                    topGainer = { symbol: item.symbol, name: item.name, pct: chgPct, price: quote.price };
                }
                if (!topLoser || chgPct < topLoser.pct) {
                    topLoser = { symbol: item.symbol, name: item.name, pct: chgPct, price: quote.price };
                }
            }
        });

        return {
            total: items.length,
            advances,
            declines,
            unchanged,
            topGainer,
            topLoser,
        };
    }, [items, mergedPrices]);

    // Filter and Sort Pipeline
    const processedItems = useMemo(() => {
        let result = [...items];

        // 1. Text Search Filter
        if (filterQuery.trim()) {
            const q = filterQuery.toLowerCase().trim();
            result = result.filter((item) => {
                const sym = (item.symbol || '').toLowerCase();
                const name = (item.name || '').toLowerCase();
                return sym.includes(q) || name.includes(q);
            });
        }

        // 2. Trend Filter (All / Gainers / Losers)
        if (trendFilter === 'gainers') {
            result = result.filter((item) => {
                const q = mergedPrices[item.symbol] || mergedPrices[item.symbol?.replace(/\.(NS|BO)$/i, '')] || {};
                const chg = q.change ?? (q.price != null && q.prev_close != null ? q.price - q.prev_close : null);
                return (chg ?? 0) > 0;
            });
        } else if (trendFilter === 'losers') {
            result = result.filter((item) => {
                const q = mergedPrices[item.symbol] || mergedPrices[item.symbol?.replace(/\.(NS|BO)$/i, '')] || {};
                const chg = q.change ?? (q.price != null && q.prev_close != null ? q.price - q.prev_close : null);
                return (chg ?? 0) < 0;
            });
        }

        // 3. Sorting
        if (sortBy === 'gainers') {
            result.sort((a, b) => {
                const qa = mergedPrices[a.symbol] || {};
                const qb = mergedPrices[b.symbol] || {};
                return (qb.change_percent ?? -999) - (qa.change_percent ?? -999);
            });
        } else if (sortBy === 'losers') {
            result.sort((a, b) => {
                const qa = mergedPrices[a.symbol] || {};
                const qb = mergedPrices[b.symbol] || {};
                return (qa.change_percent ?? 999) - (qb.change_percent ?? 999);
            });
        } else if (sortBy === 'price_high') {
            result.sort((a, b) => {
                const qa = mergedPrices[a.symbol] || {};
                const qb = mergedPrices[b.symbol] || {};
                return (qb.price ?? 0) - (qa.price ?? 0);
            });
        } else if (sortBy === 'price_low') {
            result.sort((a, b) => {
                const qa = mergedPrices[a.symbol] || {};
                const qb = mergedPrices[b.symbol] || {};
                return (qa.price ?? 999999) - (qb.price ?? 999999);
            });
        } else if (sortBy === 'name') {
            result.sort((a, b) => cleanSymbol(a.symbol).localeCompare(cleanSymbol(b.symbol)));
        }

        return result;
    }, [items, filterQuery, trendFilter, sortBy, mergedPrices]);

    // Navigate to terminal and load chart for clicked stock
    const handleOpenChart = (symbol) => {
        navigate(`/terminal?symbol=${encodeURIComponent(symbol)}`);
    };

    const handleCreateWatchlist = (e) => {
        e?.preventDefault();
        if (!newWlName.trim()) return;
        createWatchlist(newWlName.trim());
        setNewWlName('');
        setCreateModalOpen(false);
    };

    const handleSaveRename = (id) => {
        if (editingWlName.trim()) {
            renameWatchlist(id, editingWlName.trim());
        }
        setEditingWlId(null);
    };

    const isSystemList = (id) => {
        const strId = String(id || '');
        return strId.startsWith('idx_') || ['nifty 50', 'banknifty', 'sensex'].includes(activeWatchlist?.name?.toLowerCase());
    };

    return (
        <div className="w-full min-h-full px-4 sm:px-6 lg:px-8 py-5 space-y-5 max-w-[1720px] mx-auto animate-fade-in">
            {/* ── Top Header & Controls ── */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl neu-pulse-pill flex items-center justify-center text-emerald-500 flex-shrink-0">
                        <Bookmark className="w-5 h-5 fill-emerald-500/20" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-black text-heading font-display tracking-tight">
                                Watchlist
                            </h1>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full neu-pulse-pill text-emerald-600 dark:text-emerald-400">
                                {items.length} stocks
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            Real-time quotes, dynamic price discovery & 1-click chart execution
                        </p>
                    </div>
                </div>

                {/* Header Toolbar */}
                <div className="flex items-center gap-2.5 flex-wrap">
                    {/* Search inside watchlist */}
                    <div className="relative min-w-[200px] sm:min-w-[240px]">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        <input
                            type="text"
                            placeholder="Search in watchlist..."
                            value={filterQuery}
                            onChange={(e) => setFilterQuery(e.target.value)}
                            className="w-full pl-9 pr-7 py-2 rounded-full text-xs neu-input text-heading focus:outline-none transition-all placeholder:text-slate-400"
                        />
                        {filterQuery && (
                            <button
                                onClick={() => setFilterQuery('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-heading"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    {/* Sort Selector */}
                    <div className="relative">
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="neu-pulse-pill pl-3 pr-8 py-2 rounded-full text-xs font-bold text-heading appearance-none cursor-pointer focus:outline-none"
                        >
                            <option value="default">Sort: Default</option>
                            <option value="gainers">Top Gainers (%)</option>
                            <option value="losers">Top Losers (%)</option>
                            <option value="price_high">Price: High to Low</option>
                            <option value="price_low">Price: Low to High</option>
                            <option value="name">Symbol (A-Z)</option>
                        </select>
                        <ArrowUpDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                    </div>

                    {/* View Switcher: Grid vs Table */}
                    <div className="neu-dash-inset p-1 rounded-full flex items-center gap-1">
                        <button
                            type="button"
                            onClick={() => handleSetViewMode('grid')}
                            className={cn(
                                "p-1.5 rounded-full transition-all",
                                viewMode === 'grid'
                                    ? "neu-btn-active scale-105"
                                    : "text-slate-400 hover:text-heading"
                            )}
                            title="Grid Tiles View (Recommended)"
                        >
                            <LayoutGrid className="w-4 h-4" />
                        </button>
                        <button
                            type="button"
                            onClick={() => handleSetViewMode('table')}
                            className={cn(
                                "p-1.5 rounded-full transition-all",
                                viewMode === 'table'
                                    ? "neu-btn-active scale-105"
                                    : "text-slate-400 hover:text-heading"
                            )}
                            title="Table View"
                        >
                            <List className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Add Symbol Button */}
                    <button
                        type="button"
                        onClick={() => setAddModalOpen(true)}
                        className="neu-dash-btn-primary inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold text-white transition-all hover:scale-102 shadow-md"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Symbol</span>
                    </button>

                    {/* New Watchlist Button */}
                    <button
                        type="button"
                        onClick={() => setCreateModalOpen(true)}
                        className="neu-pulse-pill inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-heading transition-colors"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        <span>New List</span>
                    </button>
                </div>
            </div>

            {/* ── Watchlist Tabs (Sunken Track) ── */}
            <div className="neu-dash-inset p-1.5 rounded-2xl flex items-center gap-2 overflow-x-auto no-scrollbar select-none">
                {watchlists.map((wl) => {
                    const isActive = wl.id === activeWatchlist?.id;
                    const isEditing = editingWlId === wl.id;
                    const count = wl.items?.length ?? 0;

                    if (isEditing) {
                        return (
                            <div key={wl.id} className="flex items-center gap-1 neu-pulse-pill px-3 py-1.5 rounded-xl">
                                <input
                                    type="text"
                                    value={editingWlName}
                                    onChange={(e) => setEditingWlName(e.target.value)}
                                    className="bg-transparent text-xs text-heading font-semibold w-24 outline-none"
                                    autoFocus
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleSaveRename(wl.id);
                                        if (e.key === 'Escape') setEditingWlId(null);
                                    }}
                                />
                                <button
                                    onClick={() => handleSaveRename(wl.id)}
                                    className="text-emerald-500 p-0.5"
                                >
                                    <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    onClick={() => setEditingWlId(null)}
                                    className="text-slate-400 p-0.5"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        );
                    }

                    return (
                        <div
                            key={wl.id}
                            className={cn(
                                "group flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all duration-200 flex-shrink-0",
                                isActive
                                    ? "neu-btn-active scale-102 shadow-sm"
                                    : "neu-pulse-pill text-slate-600 dark:text-slate-300 hover:text-heading hover:scale-102"
                            )}
                            onClick={() => setActiveWatchlist(wl.id)}
                        >
                            <span>{wl.name}</span>
                            <span className={cn(
                                "px-2 py-0.5 rounded-full text-[10px] font-extrabold tabular-nums",
                                isActive ? "bg-white/20 text-white" : "bg-slate-200/80 dark:bg-slate-800 text-slate-500"
                            )}>
                                {count}
                            </span>

                            {/* Rename & Delete actions for custom lists */}
                            {!isSystemList(wl.id) && (
                                <div className="hidden group-hover:flex items-center gap-1 ml-1 opacity-80 hover:opacity-100">
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setEditingWlId(wl.id);
                                            setEditingWlName(wl.name);
                                        }}
                                        className="hover:text-emerald-400 p-0.5"
                                        title="Rename list"
                                    >
                                        <Edit2 className="w-3 h-3" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (window.confirm(`Delete watchlist "${wl.name}"?`)) {
                                                deleteWatchlist(wl.id);
                                            }
                                        }}
                                        className="hover:text-red-400 p-0.5"
                                        title="Delete list"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* ── Market Pulse Strip ── */}
            <div className="neu-stock-card p-3 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-2 sm:gap-4 flex-wrap text-xs">
                    <div className="flex items-center gap-1.5 font-bold text-heading">
                        <Activity className="w-4 h-4 text-emerald-500" />
                        <span>Market Breadth:</span>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setTrendFilter('all')}
                            className={cn(
                                "px-2.5 py-1 rounded-full text-[11px] font-bold transition-all",
                                trendFilter === 'all'
                                    ? "neu-btn-active text-white scale-102"
                                    : "neu-pulse-pill text-slate-500 hover:text-heading"
                            )}
                        >
                            All ({items.length})
                        </button>

                        <button
                            type="button"
                            onClick={() => setTrendFilter('gainers')}
                            className={cn(
                                "px-2.5 py-1 rounded-full text-[11px] font-bold transition-all flex items-center gap-1",
                                trendFilter === 'gainers'
                                    ? "neu-btn-active text-white scale-102"
                                    : "neu-pulse-pill text-emerald-600 dark:text-emerald-400 hover:text-emerald-500"
                            )}
                        >
                            <TrendingUp className="w-3 h-3 text-emerald-500" />
                            <span>{pulseStats.advances > 0 ? `${pulseStats.advances} Gainers` : 'Gainers'}</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setTrendFilter('losers')}
                            className={cn(
                                "px-2.5 py-1 rounded-full text-[11px] font-bold transition-all flex items-center gap-1",
                                trendFilter === 'losers'
                                    ? "neu-btn-active text-white scale-102"
                                    : "neu-pulse-pill text-rose-600 dark:text-rose-400 hover:text-rose-500"
                            )}
                        >
                            <TrendingDown className="w-3 h-3 text-rose-500" />
                            <span>{pulseStats.declines > 0 ? `${pulseStats.declines} Losers` : 'Losers'}</span>
                        </button>
                    </div>
                </div>

                {/* Movers Ticker Summary */}
                <div className="flex items-center gap-3 text-xs flex-wrap">
                    {pulseStats.topGainer && (
                        <div
                            onClick={() => handleOpenChart(pulseStats.topGainer.symbol)}
                            className="neu-pulse-pill px-3 py-1 rounded-full flex items-center gap-1.5 cursor-pointer hover:border-emerald-500/40 transition-all"
                        >
                            <Flame className="w-3.5 h-3.5 text-emerald-500" />
                            <span className="font-bold text-heading">{cleanSymbol(pulseStats.topGainer.symbol)}</span>
                            <span className="font-bold text-emerald-500 tabular-nums">+{pulseStats.topGainer.pct.toFixed(2)}%</span>
                        </div>
                    )}
                    {pulseStats.topLoser && (
                        <div
                            onClick={() => handleOpenChart(pulseStats.topLoser.symbol)}
                            className="neu-pulse-pill px-3 py-1 rounded-full flex items-center gap-1.5 cursor-pointer hover:border-rose-500/40 transition-all"
                        >
                            <TrendingDown className="w-3.5 h-3.5 text-rose-500" />
                            <span className="font-bold text-heading">{cleanSymbol(pulseStats.topLoser.symbol)}</span>
                            <span className="font-bold text-rose-500 tabular-nums">{pulseStats.topLoser.pct.toFixed(2)}%</span>
                        </div>
                    )}
                    <span className="text-[11px] text-slate-400 hidden lg:inline">
                        Click any stock card to launch chart
                    </span>
                </div>
            </div>

            {/* ── Broker Disconnected Slim Alert Strip ── */}
            {statusLoaded && !anyConnected && (
                <div className="neu-stock-card p-3 sm:px-4 sm:py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-amber-500/30">
                    <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-amber-500/15 flex items-center justify-center flex-shrink-0 text-amber-500">
                            <Zap className="w-4 h-4 animate-pulse" />
                        </div>
                        <div className="text-xs">
                            <span className="font-bold text-heading mr-1.5">Live Market Prices Paused:</span>
                            <span className="text-slate-500 dark:text-slate-400">
                                Connect broker to stream real-time NSE/BSE feeds. Charts are fully functional in Terminal.
                            </span>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => navigate('/brokers')}
                        className="self-start sm:self-center inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shadow-sm transition-all duration-150 hover:scale-105"
                    >
                        <Link2 className="w-3 h-3" />
                        <span>Connect Broker</span>
                        <ArrowUpRight className="w-3 h-3" />
                    </button>
                </div>
            )}

            {/* ── Content View: Grid View vs Table View ── */}
            {processedItems.length === 0 ? (
                <div className="neu-stock-card p-12 text-center flex flex-col items-center justify-center">
                    <div className="w-14 h-14 rounded-2xl neu-dash-inset mx-auto mb-3 flex items-center justify-center text-slate-400">
                        <Bookmark className="w-7 h-7" />
                    </div>
                    <h3 className="text-base font-bold text-heading">
                        {filterQuery ? `No stocks match "${filterQuery}"` : "This watchlist is empty"}
                    </h3>
                    <p className="text-xs text-slate-400 max-w-sm mt-1 mb-4">
                        {filterQuery
                            ? "Try searching for a different stock symbol or reset your filter."
                            : "Add stocks to start tracking price action and executing instant charts."}
                    </p>
                    <button
                        type="button"
                        onClick={() => setAddModalOpen(true)}
                        className="neu-dash-btn-primary inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-white text-xs font-bold transition-all hover:scale-105 shadow-md"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Add Stocks to Watchlist</span>
                    </button>
                </div>
            ) : viewMode === 'grid' ? (
                /* ── High Density 4-Column Responsive Grid ── */
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4 gap-4">
                    {processedItems.map((item) => {
                        const quote = mergedPrices[item.symbol] || mergedPrices[item.symbol?.replace(/\.(NS|BO)$/i, '')] || {};
                        const price = quote.price ?? quote.last_price ?? null;
                        const change = quote.change ?? (quote.price != null && quote.prev_close != null ? quote.price - quote.prev_close : null);
                        const changePct = quote.change_percent ?? quote.changePercent ?? (change != null && quote.prev_close ? (change / quote.prev_close) * 100 : null);
                        const isPositive = Number(change) > 0;
                        const isNegative = Number(change) < 0;

                        const displaySymbol = cleanSymbol(item.symbol);
                        const exchange = item.exchange || (item.symbol?.endsWith('.BO') ? 'BSE' : 'NSE');

                        // Day Range Bar percentage calculation
                        let rangePct = 50;
                        if (quote.high != null && quote.low != null && price != null && quote.high > quote.low) {
                            rangePct = Math.min(100, Math.max(0, ((price - quote.low) / (quote.high - quote.low)) * 100));
                        }

                        return (
                            <div
                                key={item.symbol}
                                onClick={() => handleOpenChart(item.symbol)}
                                className="neu-stock-card p-4 flex flex-col justify-between cursor-pointer group select-none"
                            >
                                {/* Card Header */}
                                <div>
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <div className="w-9 h-9 rounded-xl neu-pulse-pill flex items-center justify-center font-black text-xs text-heading group-hover:scale-105 group-hover:text-emerald-500 transition-all flex-shrink-0">
                                                {displaySymbol.slice(0, 2)}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="font-extrabold text-sm text-heading group-hover:text-emerald-500 transition-colors truncate">
                                                        {displaySymbol}
                                                    </span>
                                                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-200/80 dark:bg-slate-800 text-slate-500 border border-slate-300/40 dark:border-white/10 flex-shrink-0">
                                                        {exchange}
                                                    </span>
                                                </div>
                                                <div className="text-[11px] text-slate-400 truncate max-w-[150px] sm:max-w-[170px]">
                                                    {item.name || displaySymbol}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                            <button
                                                type="button"
                                                onClick={() => handleOpenChart(item.symbol)}
                                                className="neu-pulse-pill w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 group-hover:text-emerald-500 group-hover:scale-105 transition-all"
                                                title="Open chart in Terminal"
                                            >
                                                <ArrowUpRight className="w-3.5 h-3.5" />
                                            </button>

                                            {!isSystemList(activeWatchlist?.id) && (
                                                <button
                                                    type="button"
                                                    onClick={() => removeItem(activeWatchlist.id, item.symbol)}
                                                    className="w-7 h-7 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 flex items-center justify-center transition-colors"
                                                    title="Remove from watchlist"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Price & Change Block */}
                                    <div className="mt-3.5 pt-3 border-t border-slate-200/50 dark:border-white/5 flex items-baseline justify-between gap-2">
                                        <div>
                                            <span className="text-xl font-black font-price text-heading tabular-nums block">
                                                {price != null ? formatCurrency(price) : '—'}
                                            </span>
                                            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                                                LTP (₹)
                                            </span>
                                        </div>

                                        <div className="text-right">
                                            {change != null ? (
                                                <span className={cn(
                                                    'inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-full text-[11px] neu-dash-badge tabular-nums',
                                                    isPositive && 'text-emerald-500',
                                                    isNegative && 'text-rose-500',
                                                    !isPositive && !isNegative && 'text-slate-400'
                                                )}>
                                                    {isPositive && <TrendingUp className="w-3 h-3" />}
                                                    {isNegative && <TrendingDown className="w-3 h-3" />}
                                                    <span>{isPositive ? '+' : ''}{Number(change).toFixed(2)}</span>
                                                    <span>({formatPercent(changePct)})</span>
                                                </span>
                                            ) : (
                                                <span className="neu-pulse-pill px-2 py-0.5 rounded-full text-[10px] font-semibold text-slate-400">
                                                    Pending stream
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Bottom Range Indicator & Quick Chart Prompt */}
                                <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-white/5">
                                    {quote.high != null && quote.low != null ? (
                                        <div className="space-y-1">
                                            <div className="flex justify-between text-[9px] text-slate-400 font-medium tabular-nums">
                                                <span>L: {formatPrice(quote.low)}</span>
                                                <span>H: {formatPrice(quote.high)}</span>
                                            </div>
                                            <div className="w-full h-1.5 rounded-full neu-stock-groove relative overflow-hidden">
                                                <div
                                                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300"
                                                    style={{ width: `${rangePct}%` }}
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                                            <span className="font-semibold">{exchange} Equity</span>
                                            <span className="text-emerald-600 dark:text-emerald-400 font-bold group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                                                View Chart <ChevronRight className="w-3 h-3" />
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                /* ── Dense Table View ── */
                <div className="neu-stock-card overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-200/60 dark:border-white/10 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 select-none">
                                    <th className="py-3 px-5">Symbol & Company</th>
                                    <th className="py-3 px-4 text-right">LTP (₹)</th>
                                    <th className="py-3 px-4 text-right">Change</th>
                                    <th className="py-3 px-4 text-right hidden sm:table-cell">Day High / Low</th>
                                    <th className="py-3 px-4 text-right hidden md:table-cell">Volume</th>
                                    <th className="py-3 px-5 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-xs">
                                {processedItems.map((item) => {
                                    const quote = mergedPrices[item.symbol] || mergedPrices[item.symbol?.replace(/\.(NS|BO)$/i, '')] || {};
                                    const price = quote.price ?? quote.last_price ?? null;
                                    const change = quote.change ?? (quote.price != null && quote.prev_close != null ? quote.price - quote.prev_close : null);
                                    const changePct = quote.change_percent ?? quote.changePercent ?? (change != null && quote.prev_close ? (change / quote.prev_close) * 100 : null);
                                    const isPositive = Number(change) > 0;
                                    const isNegative = Number(change) < 0;

                                    const displaySymbol = cleanSymbol(item.symbol);
                                    const exchange = item.exchange || (item.symbol?.endsWith('.BO') ? 'BSE' : 'NSE');

                                    return (
                                        <tr
                                            key={item.symbol}
                                            onClick={() => handleOpenChart(item.symbol)}
                                            className="group hover:bg-slate-500/5 cursor-pointer transition-colors"
                                        >
                                            {/* Symbol & Name */}
                                            <td className="py-3 px-5">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-xl neu-pulse-pill flex items-center justify-center font-bold text-xs text-heading group-hover:scale-105 transition-transform flex-shrink-0">
                                                        {displaySymbol.slice(0, 2)}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="font-bold text-heading group-hover:text-emerald-500 transition-colors">
                                                                {displaySymbol}
                                                            </span>
                                                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-200/70 dark:bg-slate-800 text-slate-500 border border-slate-300/40 dark:border-white/10">
                                                                {exchange}
                                                            </span>
                                                        </div>
                                                        <div className="text-[11px] text-slate-400 truncate max-w-[200px]">
                                                            {item.name || displaySymbol}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* LTP */}
                                            <td className="py-3 px-4 text-right font-black font-price tabular-nums text-heading">
                                                {price != null ? formatCurrency(price) : '—'}
                                            </td>

                                            {/* Change */}
                                            <td className="py-3 px-4 text-right tabular-nums">
                                                {change != null ? (
                                                    <span className={cn(
                                                        "inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-full text-[11px] neu-dash-badge",
                                                        isPositive && "text-emerald-500",
                                                        isNegative && "text-rose-500",
                                                        !isPositive && !isNegative && "text-slate-400"
                                                    )}>
                                                        {isPositive && <TrendingUp className="w-3 h-3" />}
                                                        {isNegative && <TrendingDown className="w-3 h-3" />}
                                                        <span>{isPositive ? '+' : ''}{Number(change).toFixed(2)}</span>
                                                        <span>({formatPercent(changePct)})</span>
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400">—</span>
                                                )}
                                            </td>

                                            {/* Day High / Low */}
                                            <td className="py-3 px-4 text-right font-medium text-slate-400 text-[11px] tabular-nums hidden sm:table-cell">
                                                {quote.high != null && quote.low != null ? (
                                                    <span>
                                                        <span className="text-emerald-500">{formatPrice(quote.high)}</span>
                                                        <span className="mx-1 text-slate-300 dark:text-slate-600">/</span>
                                                        <span className="text-rose-500">{formatPrice(quote.low)}</span>
                                                    </span>
                                                ) : (
                                                    '—'
                                                )}
                                            </td>

                                            {/* Volume */}
                                            <td className="py-3 px-4 text-right text-slate-400 text-[11px] tabular-nums hidden md:table-cell">
                                                {quote.volume ? quote.volume.toLocaleString('en-IN') : '—'}
                                            </td>

                                            {/* Action */}
                                            <td className="py-3 px-5 text-center" onClick={(e) => e.stopPropagation()}>
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenChart(item.symbol)}
                                                        className="neu-pulse-pill inline-flex items-center gap-1 px-3 py-1 rounded-lg text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:scale-105 transition-transform"
                                                        title="Load chart in Terminal"
                                                    >
                                                        <LineChart className="w-3 h-3" />
                                                        <span>Chart</span>
                                                    </button>

                                                    {!isSystemList(activeWatchlist?.id) && (
                                                        <button
                                                            type="button"
                                                            onClick={() => removeItem(activeWatchlist.id, item.symbol)}
                                                            className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                                                            title="Remove from watchlist"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ── Add Symbol Modal ── */}
            {addModalOpen && (
                <AddSymbolModal
                    isOpen={addModalOpen}
                    onClose={() => setAddModalOpen(false)}
                    onAddSymbol={(symbol, exchange) => {
                        addItem(activeWatchlist?.id, symbol, exchange);
                        setAddModalOpen(false);
                    }}
                    watchlistItems={items}
                />
            )}

            {/* ── Create Watchlist Modal ── */}
            {createModalOpen && (
                <Modal
                    isOpen={createModalOpen}
                    onClose={() => setCreateModalOpen(false)}
                    title="Create New Watchlist"
                >
                    <form onSubmit={handleCreateWatchlist} className="space-y-4">
                        <div>
                            <label className="block text-xs font-semibold text-heading mb-1.5">
                                Watchlist Name
                            </label>
                            <input
                                type="text"
                                placeholder="e.g. Bluechip Tech, Momentum Stocks"
                                value={newWlName}
                                onChange={(e) => setNewWlName(e.target.value)}
                                className="w-full px-3.5 py-2 rounded-xl neu-input text-heading text-xs focus:outline-none"
                                autoFocus
                            />
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => setCreateModalOpen(false)}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-heading"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={!newWlName.trim()}
                                className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-bold shadow-md transition-all"
                            >
                                Create List
                            </button>
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    );
}
