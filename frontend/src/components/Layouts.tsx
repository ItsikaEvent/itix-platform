import { Link, NavLink, Navigate, Outlet } from "react-router-dom";
import type { ReactNode } from "react";
import {
  Ticket,
  MessageSquare,
  User,
  LogOut,
  LayoutDashboard,
  Music,
  Receipt,
  ScanLine,
  Mail,
  ArrowLeft,
  Shield,
  Layers,
  Compass,
} from "./icons";
import { useAuth } from "../context/AuthContext";
import { useClientAuth } from "../context/ClientAuthContext";

/* ═══════════════════════════════════════════════════════════════
   I-TIX — Exact Logo Component
   Fidelity with logo.png reference (Double Ticket + QR + I-Tix Wordmark)
   ═══════════════════════════════════════════════════════════════ */

export function ItixLogo({
  size = "default",
  className = "",
}: {
  size?: "small" | "default" | "large";
  variant?: "dark" | "light";
  className?: string;
}) {
  const heightClass =
    size === "small"
      ? "h-12 max-h-14 max-w-[150px]"
      : size === "large"
      ? "h-32 max-h-40 max-w-[260px]"
      : "h-20 md:h-24 max-h-28 max-w-[210px]";

  return (
    <div className={`flex items-center justify-center w-full ${className}`}>
      <img
        src="/logo.png"
        alt="ITIX"
        className={`${heightClass} w-auto object-contain block mx-auto transition-none`}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Public Layout (Pure White + Deep Black + Bordeaux Accent)
   ═══════════════════════════════════════════════════════════════ */

export function PublicLayout() {
  const { isAuth } = useAuth();
  const { clientUser, isClientAuth, logoutClient } = useClientAuth();

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium border-l-2 ${
      isActive
        ? "border-[#641C2D] bg-[#F8F7F4] text-[#641C2D] font-bold"
        : "border-transparent text-[#555555] hover:text-[#111111] hover:bg-[#FAF9F6]"
    }`;

  return (
    <div className="min-h-screen bg-[#FFFFFF] flex flex-col md:flex-row text-[#303030]">
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 shrink-0 bg-[#FFFFFF] border-r border-[#ECEAE6] flex flex-col justify-between">
        <div>
          {/* Brand Header */}
          <div className="px-5 py-6 border-b border-[#ECEAE6] flex items-center justify-center">
            <Link to="/" className="block w-full">
              <ItixLogo size="default" />
            </Link>
          </div>

          {/* Nav List */}
          <nav className="p-3 space-y-1">
            <NavLink to="/" end className={navLinkClass}>
              <Compass className="h-4 w-4 text-[#641C2D]" />
              <span>Accueil</span>
            </NavLink>

            <NavLink to="/billetterie" className={navLinkClass}>
              <Ticket className="h-4 w-4 text-[#641C2D]" />
              <span>Billetterie & Événements</span>
            </NavLink>

            <NavLink to="/mes-billets" className={navLinkClass}>
              <Layers className="h-4 w-4 text-[#641C2D]" />
              <span>Mes Billets</span>
            </NavLink>

            <NavLink to="/messagerie" className={navLinkClass}>
              <MessageSquare className="h-4 w-4 text-[#641C2D]" />
              <span>Assistance & Messages</span>
            </NavLink>
          </nav>
        </div>

        {/* User / Session Area */}
        <div className="p-4 border-t border-[#ECEAE6] bg-[#FAF9F6] space-y-3">
          {isClientAuth && clientUser ? (
            <div className="border border-[#ECEAE6] bg-[#FFFFFF] p-3 rounded-lg shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 overflow-hidden">
                  <User className="h-3.5 w-3.5 text-[#641C2D] shrink-0" />
                  <span className="font-semibold text-xs text-[#111111] truncate">{clientUser.name}</span>
                </div>
                <button
                  onClick={logoutClient}
                  className="text-xs text-[#641C2D] hover:underline font-medium ml-1"
                  title="Changer d'utilisateur"
                >
                  Quitter
                </button>
              </div>
              <p className="text-[11px] text-[#666666] truncate mt-0.5">{clientUser.email}</p>
            </div>
          ) : (
            <Link
              to="/mes-billets"
              className="flex items-center justify-center gap-2 w-full border border-[#DCD9D3] bg-[#FFFFFF] px-3 py-2 text-xs font-semibold text-[#111111] hover:border-[#641C2D] hover:text-[#641C2D] rounded-lg shadow-sm"
            >
              <User className="h-3.5 w-3.5 text-[#641C2D]" />
              <span>Espace Client / Billets</span>
            </Link>
          )}

          <div className="pt-2 text-center border-t border-[#ECEAE6]">
            <Link
              to={isAuth ? "/admin" : "/admin/login"}
              className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#666666] hover:text-[#641C2D]"
            >
              <Shield className="h-3 w-3 text-[#641C2D]" />
              <span>{isAuth ? "Administration I-Tix" : "Accès Gestionnaire"}</span>
            </Link>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="min-w-0 flex-1 p-4 md:p-8 overflow-y-auto bg-[#FFFFFF]">
        <Outlet />
      </main>
    </div>
  );
}

export function RequireAuth({ children }: { children: ReactNode }) {
  return useAuth().isAuth ? <>{children}</> : <Navigate to="/admin/login" replace />;
}

/* ═══════════════════════════════════════════════════════════════
   Admin Layout
   ═══════════════════════════════════════════════════════════════ */

export function AdminLayout() {
  const { logout } = useAuth();

  const adminNavLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3.5 py-2.5 text-xs font-medium border-l-2 ${
      isActive
        ? "border-[#641C2D] bg-[#1E1E1E] text-[#FFFFFF] font-bold"
        : "border-transparent text-[#9E9B94] hover:text-[#FFFFFF] hover:bg-[#181818]"
    }`;

  return (
    <div className="min-h-screen bg-[#FFFFFF] flex flex-col md:flex-row text-[#303030]">
      {/* Dark Sidebar Admin */}
      <aside className="w-full md:w-64 shrink-0 bg-[#111111] border-r border-[#222222] text-[#FFFFFF] flex flex-col justify-between">
        <div>
          {/* Header */}
          <div className="px-5 py-6 border-b border-[#222222] flex items-center justify-center">
            <Link to="/admin" className="block w-full">
              <ItixLogo size="default" variant="light" />
            </Link>
          </div>

          {/* Admin Navigation */}
          <nav className="p-3 space-y-1">
            <NavLink to="/admin" end className={adminNavLinkClass}>
              <LayoutDashboard className="h-4 w-4 text-[#641C2D]" />
              <span>Tableau de bord</span>
            </NavLink>

            <NavLink to="/admin/concerts" className={adminNavLinkClass}>
              <Music className="h-4 w-4 text-[#641C2D]" />
              <span>Événements & Concerts</span>
            </NavLink>

            <NavLink to="/admin/orders" className={adminNavLinkClass}>
              <Receipt className="h-4 w-4 text-[#641C2D]" />
              <span>Commandes & Billets</span>
            </NavLink>

            <NavLink to="/admin/scanner" className={adminNavLinkClass}>
              <ScanLine className="h-4 w-4 text-[#641C2D]" />
              <span>Contrôle d'accès (QR)</span>
            </NavLink>

            <NavLink to="/admin/support" className={adminNavLinkClass}>
              <MessageSquare className="h-4 w-4 text-[#641C2D]" />
              <span>Messagerie Support</span>
            </NavLink>

            <NavLink to="/admin/email" className={adminNavLinkClass}>
              <Mail className="h-4 w-4 text-[#641C2D]" />
              <span>Configuration E-mails</span>
            </NavLink>
          </nav>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-[#222222] space-y-2">
          <Link
            to="/"
            className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-[#DCD9D3] hover:text-[#FFFFFF]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Portail Billetterie</span>
          </Link>

          <button
            onClick={logout}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-red-400 hover:text-red-300"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Déconnexion</span>
          </button>
        </div>
      </aside>

      {/* Main Admin Content */}
      <main className="min-w-0 flex-1 p-4 md:p-8 overflow-y-auto bg-[#FFFFFF]">
        <Outlet />
      </main>
    </div>
  );
}
