// Sidebar.jsx - Floating Neumorphic Round Pill Sidebar with sideways price-tag tooltips
import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../stores/useAuthStore";
import { cn } from "../../utils/cn";
import {
  LayoutDashboard,
  ChartCandlestick,
  Briefcase,
  Shield,
  Settings,
  LogOut,
  ClipboardList,
  Lightbulb,
  Link2,
} from "lucide-react";

/* ─── Avatar initials helper ───────────────────────────────── */
function getInitials(user) {
  if (user?.full_name?.trim()) {
    const parts = user.full_name.trim().split(/\s+/);
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase();
  }
  if (user?.email) return user.email[0].toUpperCase();
  return "U";
}

/* ─── Nav item list (no logo, no brand title) ─────────────────── */
const NAV_ITEMS = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/brokers", icon: Link2, label: "Broker Connect" },
  { to: "/terminal", icon: ChartCandlestick, label: "Terminal" },
  { to: "/orders", icon: ClipboardList, label: "Orders" },
  { to: "/portfolio", icon: Briefcase, label: "Portfolio" },
  { to: "/auto-alpha", icon: Shield, label: "Alpha Auto" },
  { to: "/mentor", icon: Lightbulb, label: "AI Mentor" },
];

/* ─── Nav button with sideways price-tag tooltip ────────────── */
function PillNavItem({ to, icon: Icon, label, onNavigate }) {
  return (
    <div className="relative group flex items-center justify-center my-0.5">
      <NavLink
        to={to}
        onClick={onNavigate}
        aria-label={label}
        className={({ isActive }) =>
          cn(
            "w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-200 ease-out select-none",
            isActive
              ? "neu-btn-active scale-105"
              : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100/90 dark:hover:bg-slate-800/70 hover:scale-105"
          )
        }
      >
        <Icon className="w-5 h-5 transition-transform duration-200 group-hover:scale-110" />
      </NavLink>

      {/* Sideways price tag tooltip (matches reference website) */}
      <div className="absolute left-[calc(100%+14px)] top-1/2 -translate-y-1/2 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 pointer-events-none transition-all duration-200 z-50 whitespace-nowrap">
        <div className="relative flex items-center bg-[#0f172a] dark:bg-[#1e293b] text-white text-[11px] font-semibold tracking-wide px-3.5 py-1.5 rounded-lg shadow-xl shadow-black/40 border border-white/10">
          {/* Triangular notch pointing back towards the icon */}
          <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-0 h-0 border-y-[6px] border-y-transparent border-r-[7px] border-r-[#0f172a] dark:border-r-[#1e293b]" />
          {/* Price-tag perforation hole dot */}
          <div className="w-1.5 h-1.5 rounded-full bg-slate-400/50 mr-1.5 flex-shrink-0" />
          <span>{label}</span>
        </div>
      </div>
    </div>
  );
}

export default function Sidebar({ collapsed, onToggle }) {
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();

  const closeMobileDrawer = () => {
    if (typeof window !== "undefined" && window.innerWidth < 1024 && !collapsed) {
      onToggle?.();
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <>
      {/* Mobile backdrop overlay */}
      {!collapsed && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden backdrop-blur-sm"
          onClick={onToggle}
          aria-hidden="true"
        />
      )}

      {/* Floating Neumorphic Round Pill Sidebar */}
      <aside
        className={cn(
          "fixed left-3.5 top-3.5 bottom-3.5 w-16 sm:w-[68px] z-40",
          "neu-pill-sidebar rounded-[32px] py-4 px-2",
          "flex flex-col items-center justify-between",
          "transition-all duration-300 ease-in-out select-none",
          collapsed
            ? "max-lg:-translate-x-[120%]"
            : "max-lg:translate-x-0"
        )}
      >
        {/* ── Top Nav Items ── */}
        <div className="w-full flex flex-col items-center gap-1.5">
          {NAV_ITEMS.map((item) => (
            <PillNavItem
              key={item.to}
              {...item}
              onNavigate={closeMobileDrawer}
            />
          ))}
        </div>

        {/* ── Bottom Section (Settings, Logout, User Avatar) ── */}
        <div className="w-full flex flex-col items-center gap-2 pt-2 border-t border-slate-200/50 dark:border-white/10">
          {/* Settings */}
          <div className="relative group flex items-center justify-center">
            <NavLink
              to="/settings"
              onClick={closeMobileDrawer}
              aria-label="Settings"
              className={({ isActive }) =>
                cn(
                  "w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-200 ease-out select-none",
                  isActive
                    ? "neu-btn-active scale-105"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100/90 dark:hover:bg-slate-800/70 hover:scale-105"
                )
              }
            >
              <Settings className="w-5 h-5 transition-transform duration-200 group-hover:rotate-45" />
            </NavLink>
            <div className="absolute left-[calc(100%+14px)] top-1/2 -translate-y-1/2 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 pointer-events-none transition-all duration-200 z-50 whitespace-nowrap">
              <div className="relative flex items-center bg-[#0f172a] dark:bg-[#1e293b] text-white text-[11px] font-semibold tracking-wide px-3.5 py-1.5 rounded-lg shadow-xl shadow-black/40 border border-white/10">
                <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-0 h-0 border-y-[6px] border-y-transparent border-r-[7px] border-r-[#0f172a] dark:border-r-[#1e293b]" />
                <div className="w-1.5 h-1.5 rounded-full bg-slate-400/50 mr-1.5 flex-shrink-0" />
                <span>Settings</span>
              </div>
            </div>
          </div>

          {/* Logout */}
          <div className="relative group flex items-center justify-center">
            <button
              type="button"
              onClick={handleLogout}
              aria-label="Log Out"
              className="w-11 h-11 rounded-2xl flex items-center justify-center text-slate-500 hover:text-red-500 hover:bg-red-500/10 dark:text-slate-400 dark:hover:text-red-400 transition-all duration-200 hover:scale-105"
            >
              <LogOut className="w-5 h-5" />
            </button>
            <div className="absolute left-[calc(100%+14px)] top-1/2 -translate-y-1/2 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 pointer-events-none transition-all duration-200 z-50 whitespace-nowrap">
              <div className="relative flex items-center bg-[#0f172a] dark:bg-[#1e293b] text-white text-[11px] font-semibold tracking-wide px-3.5 py-1.5 rounded-lg shadow-xl shadow-black/40 border border-white/10">
                <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-0 h-0 border-y-[6px] border-y-transparent border-r-[7px] border-r-[#0f172a] dark:border-r-[#1e293b]" />
                <div className="w-1.5 h-1.5 rounded-full bg-red-400/60 mr-1.5 flex-shrink-0" />
                <span>Log Out</span>
              </div>
            </div>
          </div>

          {/* User Profile Avatar Pill */}
          {user && (
            <div className="relative group flex items-center justify-center mt-1">
              <button
                type="button"
                onClick={() => navigate("/settings?tab=profile")}
                aria-label="Profile"
                className="w-10 h-10 rounded-full flex items-center justify-center bg-gradient-to-tr from-emerald-500 to-teal-400 text-white font-bold text-xs ring-2 ring-white/60 dark:ring-white/10 shadow-sm hover:scale-105 transition-transform"
              >
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={getInitials(user)}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  getInitials(user)
                )}
              </button>
              <div className="absolute left-[calc(100%+14px)] top-1/2 -translate-y-1/2 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 pointer-events-none transition-all duration-200 z-50 whitespace-nowrap">
                <div className="relative flex items-center bg-[#0f172a] dark:bg-[#1e293b] text-white text-[11px] font-semibold tracking-wide px-3.5 py-1.5 rounded-lg shadow-xl shadow-black/40 border border-white/10">
                  <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-0 h-0 border-y-[6px] border-y-transparent border-r-[7px] border-r-[#0f172a] dark:border-r-[#1e293b]" />
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400/80 mr-1.5 flex-shrink-0" />
                  <span>{user.full_name || user.username || user.email}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
