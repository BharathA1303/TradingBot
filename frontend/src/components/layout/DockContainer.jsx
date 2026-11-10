import { useState, memo } from 'react';
import { cn } from '../../utils/cn';

/**
 * DockContainer — tabbed bottom panel container for positions/orders/logs.
 *
 * Features:
 *  - Collapsible via a toggle handle (click the grab bar)
 *  - Tab bar with counts
 *  - Only active tab panel is rendered (lazy)
 *  - Respects parent height constraints
 *
 * Props:
 *  - tabs: Array<{ key: string, label: string, count?: number, content: ReactNode }>
 *  - defaultTab: string
 *  - collapsed: boolean
 *  - onToggleCollapse: () => void
 *  - className: string
 */
function DockContainer({
    tabs = [],
    defaultTab,
    collapsed = false,
    onToggleCollapse,
    onResizeStart,
    className,
}) {
    const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.key);

    const activeContent = tabs.find((t) => t.key === activeTab)?.content;

    return (
        <div className={cn(
            'flex flex-col neu-terminal-dock overflow-hidden transition-all duration-200',
            collapsed ? 'h-[36px]' : 'h-full',
            className,
        )}>
            {!collapsed && (
                <div
                    onMouseDown={onResizeStart}
                    className="h-1.5 w-full cursor-row-resize hover:bg-emerald-500/30 transition-colors flex items-center justify-center"
                    title="Drag to resize"
                >
                    <div className="w-8 h-0.5 rounded-full bg-slate-300 dark:bg-white/20" />
                </div>
            )}
            {/* Tab bar + collapse handle */}
            <div className="flex items-center gap-2 px-3 py-1.5 border-b border-slate-200/50 dark:border-white/5 flex-shrink-0">
                {/* Collapse toggle */}
                <button
                    onClick={onToggleCollapse}
                    className="w-7 h-7 rounded-lg neu-terminal-pill-btn flex items-center justify-center text-slate-500 hover:text-heading transition-all"
                    title={collapsed ? 'Expand panel' : 'Collapse panel'}
                >
                    <svg
                        className={cn('w-3.5 h-3.5 transition-transform duration-200', collapsed && 'rotate-180')}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                    >
                        <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </button>

                {/* Sunken Tab Track */}
                <div className="neu-dash-inset p-1 rounded-xl flex items-center gap-1 overflow-x-auto no-scrollbar">
                    {tabs.map(({ key, label, count }) => (
                        <button
                            key={key}
                            onClick={() => {
                                setActiveTab(key);
                                if (collapsed) onToggleCollapse?.();
                            }}
                            className={cn(
                                'px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-lg transition-all whitespace-nowrap',
                                activeTab === key
                                    ? 'neu-btn-active scale-102 shadow-sm'
                                    : 'text-slate-500 hover:text-heading hover:bg-slate-500/10'
                            )}
                        >
                            <span>{label}</span>
                            {count != null && (
                                <span className={cn(
                                    "ml-1.5 text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full",
                                    activeTab === key ? "bg-white/20 text-white" : "bg-slate-200/80 dark:bg-slate-800 text-slate-500"
                                )}>
                                    {count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Active tab content */}
            {!collapsed && (
                <div className="flex-1 overflow-y-auto min-h-0">
                    {activeContent}
                </div>
            )}
        </div>
    );
}

export default memo(DockContainer);
