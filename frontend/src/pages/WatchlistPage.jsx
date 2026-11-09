// WatchlistPage.jsx - Dedicated high-level, premier Watchlist section
import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWatchlistStore } from '../stores/useWatchlistStore';
import { useMarketStore } from '../store/useMarketStore';
import { useBrokerStore } from '../stores/useBrokerStore';
import AddSymbolModal from '../components/trading/AddSymbolModal';
import Modal from '../components/ui/Modal';
import { mergeWatchlistPrices } from '../utils/liveQuote';
import { formatCurrency, formatPercent, pnlColorClass, cleanSymbol } from '../utils/formatters';
import {
    Bookmark, Plus, Search, Trash2, Edit2, TrendingUp, TrendingDown,
    LineChart, Zap, Link2, ArrowUpRight, Check, X, ShieldAlert
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

    // Filter search within active watchlist
    const [filterQuery, setFilterQuery] = useState('');
    const [addModalOpen, setAddModalOpen] = useState(false);
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [newWlName, setNewWlName] = useState('');
    const [editingWlId, setEditingWlId] = useState(null);
    const [editingWlName, setEditingWlName] = useState('');

    // Fetch prices on mount & active watchlist change
    useEffect(() => {
        if (items.length > 0) {
            fetchPrices();
        }
    }, [activeId, items.length, fetchPrices]);

    const filteredItems = useMemo(() => {
        if (!filterQuery.trim()) return items;
        const q = filterQuery.toLowerCase().trim();
        return items.filter((item) => {
            const sym = (item.symbol || '').toLowerCase();
            const name = (item.name || '').toLowerCase();
            return sym.includes(q) || name.includes(q);
        });
    }, [items, filterQuery]);

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
        <div className="w-full min-h-full px-4 lg:px-8 py-4 space-y-6 max-w-7xl mx-auto">
            {/* ── Top Header ── */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-2xl neu-pill flex items-center justify-center text-emerald-500">
                            <Bookmark className="w-5 h-5 fill-emerald-500/20" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-heading font-display tracking-tight">
                                Watchlist
                            </h1>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Real-time stock quotes, price action & instant chart execution
                            </p>
                        </div>
                    </div>
                </div>

                {/* Header Actions */}
                <div className="flex items-center gap-2.5 flex-wrap">
                    {/* Search inside watchlist */}
                    <div className="relative min-w-[200px] sm:min-w-[240px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        <input
                            type="text"
                            placeholder="Filter watchlist..."
                            value={filterQuery}
                            onChange={(e) => setFilterQuery(e.target.value)}
                            className="w-full pl-9 pr-3 py-1.5 rounded-full text-xs neu-input text-heading focus:outline-none transition-all placeholder:text-slate-400"
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

                    {/* Add Symbol Button */}
                    <button
                        type="button"
                        onClick={() => setAddModalOpen(true)}
                        className="neu-pill inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold text-heading hover:text-emerald-500 transition-colors"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Symbol</span>
                    </button>

                    {/* New Watchlist Button */}
                    <button
                        type="button"
                        onClick={() => setCreateModalOpen(true)}
                        className="neu-pill inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-heading transition-colors"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        <span>New List</span>
                    </button>
                </div>
            </div>

            {/* ── Watchlist Tabs ── */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none select-none">
                {watchlists.map((wl) => {
                    const isActive = wl.id === activeWatchlist?.id;
                    const isEditing = editingWlId === wl.id;
                    const count = wl.items?.length ?? 0;

                    if (isEditing) {
                        return (
                            <div key={wl.id} className="flex items-center gap-1 neu-pill px-3 py-1 rounded-full">
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
                                    <Check className="w-3 h-3" />
                                </button>
                                <button
                                    onClick={() => setEditingWlId(null)}
                                    className="text-slate-400 p-0.5"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        );
                    }

                    return (
                        <div
                            key={wl.id}
                            className={cn(
                                "group flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all duration-200 flex-shrink-0",
                                isActive
                                    ? "neu-btn-active scale-102"
                                    : "neu-pill text-slate-600 dark:text-slate-300 hover:text-heading hover:scale-102"
                            )}
                            onClick={() => setActiveWatchlist(wl.id)}
                        >
                            <span>{wl.name}</span>
                            <span className={cn(
                                "px-1.5 py-0.2 rounded-full text-[10px] font-bold",
                                isActive ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-slate-800 text-slate-500"
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
                                        <Edit2 className="w-2.5 h-2.5" />
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
                                        <Trash2 className="w-2.5 h-2.5" />
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* ── Broker Disconnected Catchy Alert ── */}
            {statusLoaded && !anyConnected && (
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg shadow-amber-500/5">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center flex-shrink-0 text-amber-500">
                            <Zap className="w-5 h-5 animate-pulse" />
                        </div>
                        <div>
                            <h4 className="text-xs sm:text-sm font-bold text-heading flex items-center gap-1.5">
                                <span>Live Market Prices Paused</span>
                                <span className="text-[10px] uppercase font-extrabold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400">
                                    No Broker Connected
                                </span>
                            </h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                Please connect your broker (Zebu or Alice Blue) to stream real-time NSE & BSE quotes and execute live paper trades.
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => navigate('/brokers')}
                        className="self-start sm:self-center inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shadow-md transition-all duration-150 hover:scale-105"
                    >
                        <Link2 className="w-3.5 h-3.5" />
                        <span>Connect Broker</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                </div>
            )}

            {/* ── Watchlist Table / Stock Cards ── */}
            <div className="neu-pill rounded-3xl overflow-hidden border border-slate-200/60 dark:border-white/10 shadow-sm">
                {filteredItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                        <div className="w-14 h-14 rounded-3xl neu-pill flex items-center justify-center text-slate-400 mb-3">
                            <Bookmark className="w-6 h-6 stroke-[1.5]" />
                        </div>
                        <h3 className="text-base font-bold text-heading">
                            {filterQuery ? `No stocks match "${filterQuery}"` : "This watchlist is empty"}
                        </h3>
                        <p className="text-xs text-slate-400 max-w-sm mt-1 mb-4">
                            {filterQuery
                                ? "Try searching for a different stock symbol or company name."
                                : "Add your favorite NSE & BSE stocks to track real-time price action."}
                        </p>
                        <button
                            type="button"
                            onClick={() => setAddModalOpen(true)}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition-all hover:scale-105 shadow-md"
                        >
                            <Plus className="w-4 h-4" />
                            <span>Add Stocks to Watchlist</span>
                        </button>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-200/60 dark:border-white/10 text-[11px] font-bold uppercase tracking-wider text-slate-400 select-none">
                                    <th className="py-3 px-4 sm:px-6">Symbol & Company</th>
                                    <th className="py-3 px-4 text-right">LTP (₹)</th>
                                    <th className="py-3 px-4 text-right">Change</th>
                                    <th className="py-3 px-4 text-right hidden sm:table-cell">Day High / Low</th>
                                    <th className="py-3 px-4 text-right hidden md:table-cell">Volume</th>
                                    <th className="py-3 px-4 sm:px-6 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-xs">
                                {filteredItems.map((item) => {
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
                                            <td className="py-3.5 px-4 sm:px-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800/80 flex items-center justify-center font-bold text-xs text-heading group-hover:scale-105 transition-transform flex-shrink-0">
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
                                                        <div className="text-[11px] text-slate-400 truncate max-w-[180px] sm:max-w-[260px]">
                                                            {item.name || displaySymbol}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Last Traded Price */}
                                            <td className="py-3.5 px-4 text-right font-bold tabular-nums text-heading">
                                                {price != null ? formatCurrency(price) : '—'}
                                            </td>

                                            {/* Change */}
                                            <td className="py-3.5 px-4 text-right tabular-nums">
                                                {change != null ? (
                                                    <span className={cn(
                                                        "inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-md text-[11px]",
                                                        isPositive && "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
                                                        isNegative && "text-rose-600 dark:text-rose-400 bg-rose-500/10",
                                                        !isPositive && !isNegative && "text-slate-400 bg-slate-400/10"
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
                                            <td className="py-3.5 px-4 text-right font-medium text-slate-400 text-[11px] tabular-nums hidden sm:table-cell">
                                                {quote.high != null && quote.low != null ? (
                                                    <span>
                                                        <span className="text-emerald-500/90">{formatCurrency(quote.high)}</span>
                                                        <span className="mx-1 text-slate-300 dark:text-slate-600">/</span>
                                                        <span className="text-rose-500/90">{formatCurrency(quote.low)}</span>
                                                    </span>
                                                ) : (
                                                    '—'
                                                )}
                                            </td>

                                            {/* Volume */}
                                            <td className="py-3.5 px-4 text-right text-slate-400 text-[11px] tabular-nums hidden md:table-cell">
                                                {quote.volume ? quote.volume.toLocaleString('en-IN') : '—'}
                                            </td>

                                            {/* Action */}
                                            <td className="py-3.5 px-4 sm:px-6 text-center" onClick={(e) => e.stopPropagation()}>
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenChart(item.symbol)}
                                                        className="neu-pill inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:scale-105 transition-transform"
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
                )}
            </div>

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
