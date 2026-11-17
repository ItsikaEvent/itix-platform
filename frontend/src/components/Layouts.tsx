import { Link, NavLink, Navigate, Outlet, useLocation } from "react-router-dom";
import { useState, useEffect, type ReactNode } from "react";
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
  Users,
  Scale,
  FileText,
  Menu,
  X,
  Coins,
} from "./icons";
import { useAuth } from "../context/AuthContext";
import { useClientAuth } from "../context/ClientAuthContext";
import { ConsentBanner } from "./ConsentBanner";
import { MustChangePasswordModal } from "./MustChangePasswordModal";

/* ═══════════════════════════════════════════════════════════════
   I-TIX — Logo Component
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium border-l-2 ${
      isActive
        ? "border-[#641C2D] bg-[#F8F7F4] text-[#641C2D] font-bold"
        : "border-transparent text-[#555555] hover:text-[#111111] hover:bg-[#FAF9F6]"
    }`;

  return (
    <div className="min-h-screen bg-[#FFFFFF] flex flex-col md:flex-row text-[#303030]">
      {/* Mobile Top Header (screens < md) */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-[#ECEAE6] bg-[#FFFFFF] sticky top-0 z-40">
        <Link to="/" onClick={() => setMobileOpen(false)} className="flex items-center">
          <ItixLogo size="small" />
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-[#111111] hover:bg-[#FAF9F6] border border-[#ECEAE6] transition-colors"
          aria-label={mobileOpen ? "Fermer le menu" : "Ouvrir le menu de navigation"}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Sidebar Navigation — Desktop permanent, Mobile collapsible */}
      <aside
        className={`w-full md:w-64 shrink-0 bg-[#FFFFFF] border-r border-[#ECEAE6] flex flex-col justify-between ${
          mobileOpen ? "block border-b md:border-b-0 animate-in fade-in duration-200" : "hidden md:flex"
        }`}
      >
        <div>
          {/* Brand Header (Desktop) */}
          <div className="hidden md:flex px-5 py-6 border-b border-[#ECEAE6] items-center justify-center">
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

      {/* Main Content Area with Footer */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#FFFFFF]">
        <main className="min-w-0 flex-1 p-4 md:p-8 overflow-y-auto">
          <Outlet />
        </main>

        {/* Global Public Footer */}
        <footer className="border-t border-[#ECEAE6] bg-[#FAF9F6] px-6 py-8 text-xs text-[#666666]">
          <div className="mx-auto max-w-6xl flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-center md:text-left space-y-1">
              <p className="font-serif font-bold text-sm text-[#111111]">
                ITIX — Event & Ticketing Platform
              </p>
              <p className="text-[11px] text-[#777777]">
                Plateforme officielle opérée par I-Tsika Events Madagascar. Billetterie sécurisée et contrôle d'accès numérique.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[11px] font-medium text-[#555555]">
              <Link to="/politique-de-confidentialite" className="hover:text-[#641C2D] transition-colors flex items-center gap-1">
                <Shield className="h-3 w-3 text-[#641C2D]" />
                <span>Confidentialité & RGPD/CMIL</span>
              </Link>
              <Link to="/conditions-generales-de-vente" className="hover:text-[#641C2D] transition-colors flex items-center gap-1">
                <Scale className="h-3 w-3 text-[#641C2D]" />
                <span>CGV</span>
              </Link>
              <Link to="/conditions-generales-d-utilisation" className="hover:text-[#641C2D] transition-colors flex items-center gap-1">
                <FileText className="h-3 w-3 text-[#641C2D]" />
                <span>CGU</span>
              </Link>
              <Link to="/messagerie" className="hover:text-[#641C2D] transition-colors flex items-center gap-1">
                <MessageSquare className="h-3 w-3 text-[#641C2D]" />
                <span>Contact & Support</span>
              </Link>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-[#ECEAE6] text-center text-[10px] text-[#888888]">
            Conforme aux normes de protection des données (Loi n° 2014-038 CMIL Madagascar & RGPD UE). Billets à QR Codes cryptographiques certifiés.
          </div>
        </footer>

        {/* RGPD & CMIL Cookie / Local Storage Banner */}
        <ConsentBanner />
      </div>
    </div>
  );
}

export function RequireAuth({ children }: { children: ReactNode }) {
  return useAuth().isAuth ? <>{children}</> : <Navigate to="/admin/login" replace />;
}

/* ═══════════════════════════════════════════════════════════════
   Admin Layout (Multi-Organisateur & Super Admin)
   ═══════════════════════════════════════════════════════════════ */

export function AdminLayout() {
  const { user, isSuperAdmin, logout } = useAuth();
  const [adminMobileOpen, setAdminMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setAdminMobileOpen(false);
  }, [location.pathname]);

  const adminNavLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3.5 py-2.5 text-xs font-medium border-l-2 ${
      isActive
        ? "border-[#641C2D] bg-[#1E1E1E] text-[#FFFFFF] font-bold"
        : "border-transparent text-[#9E9B94] hover:text-[#FFFFFF] hover:bg-[#181818]"
    }`;

  return (
    <div className="min-h-screen bg-[#FFFFFF] flex flex-col md:flex-row text-[#303030]">
      {/* Mobile Top Header (screens < md) */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-[#222222] bg-[#111111] text-white sticky top-0 z-40">
        <Link to="/admin" onClick={() => setAdminMobileOpen(false)} className="flex items-center">
          <ItixLogo size="small" variant="light" />
        </Link>
        <button
          type="button"
          onClick={() => setAdminMobileOpen(!adminMobileOpen)}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-white hover:bg-[#1E1E1E] border border-[#333333] transition-colors"
          aria-label={adminMobileOpen ? "Fermer le menu admin" : "Ouvrir le menu admin"}
        >
          {adminMobileOpen ? <X className="h-5 w-5 text-white" /> : <Menu className="h-5 w-5 text-white" />}
        </button>
      </div>

      {/* Dark Sidebar Admin — Desktop permanent, Mobile collapsible */}
      <aside
        className={`w-full md:w-64 shrink-0 bg-[#111111] border-r border-[#222222] text-[#FFFFFF] flex flex-col justify-between ${
          adminMobileOpen ? "block border-b md:border-b-0 animate-in fade-in duration-200" : "hidden md:flex"
        }`}
      >
        <div>
          {/* Header (Desktop) */}
          <div className="hidden md:flex px-5 py-6 border-b border-[#222222] items-center justify-center">
            <Link to="/admin" className="block w-full">
              <ItixLogo size="default" variant="light" />
            </Link>
          </div>

          {/* User Badge / Role Indicator */}
          {user && (
            <div className="px-4 py-3 border-b border-[#222222] bg-[#161616]">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-white truncate max-w-[130px]">
                  {user.name}
                </span>
                <span className={`px-2 py-0.5 rounded text-[9px] font-bold tracking-wider ${
                  user.role === "STAFF_SCANNER"
                    ? "bg-cyan-900/60 text-cyan-200 border border-cyan-700"
                    : isSuperAdmin
                    ? "bg-purple-900/60 text-purple-200 border border-purple-700"
                    : "bg-[#641C2D]/60 text-rose-200 border border-[#641C2D]"
                }`}>
                  {user.role === "STAFF_SCANNER" ? "CONTRÔLEUR" : isSuperAdmin ? "SUPER ADMIN" : "ORGANISATEUR"}
                </span>
              </div>
              <p className="text-[10px] text-[#888888] truncate mt-0.5">{user.email}</p>
            </div>
          )}

          {/* Admin Navigation */}
          <nav className="p-3 space-y-1">
            {user?.role === "STAFF_SCANNER" ? (
              <NavLink to="/admin/scanner" className={adminNavLinkClass}>
                <ScanLine className="h-4 w-4 text-[#641C2D]" />
                <span>Scanner Contrôle d'accès</span>
              </NavLink>
            ) : (
              <>
                <NavLink to="/admin" end className={adminNavLinkClass}>
                  <LayoutDashboard className="h-4 w-4 text-[#641C2D]" />
                  <span>Tableau de bord</span>
                </NavLink>

                {isSuperAdmin && (
                  <NavLink to="/admin/organizers" className={adminNavLinkClass}>
                    <Users className="h-4 w-4 text-[#641C2D]" />
                    <span>Organisateurs</span>
                  </NavLink>
                )}

                <NavLink to="/admin/concerts" className={adminNavLinkClass}>
                  <Music className="h-4 w-4 text-[#641C2D]" />
                  <span>Événements & Concerts</span>
                </NavLink>

                <NavLink to="/admin/orders" className={adminNavLinkClass}>
                  <Receipt className="h-4 w-4 text-[#641C2D]" />
                  <span>Commandes & Billets</span>
                </NavLink>

                <NavLink to="/admin/payouts" className={adminNavLinkClass}>
                  <Coins className="h-4 w-4 text-[#641C2D]" />
                  <span>Reversements</span>
                </NavLink>

                <NavLink to="/admin/staff" className={adminNavLinkClass}>
                  <Users className="h-4 w-4 text-[#641C2D]" />
                  <span>Équipe & Contrôleurs</span>
                </NavLink>

                <NavLink to="/admin/scanner" className={adminNavLinkClass}>
                  <ScanLine className="h-4 w-4 text-[#641C2D]" />
                  <span>Contrôle d'accès (QR)</span>
                </NavLink>

                <NavLink to="/admin/support" className={adminNavLinkClass}>
                  <MessageSquare className="h-4 w-4 text-[#641C2D]" />
                  <span>Messagerie Support</span>
                </NavLink>

                {isSuperAdmin && (
                  <NavLink to="/admin/email" className={adminNavLinkClass}>
                    <Mail className="h-4 w-4 text-[#641C2D]" />
                    <span>Configuration E-mails</span>
                  </NavLink>
                )}
              </>
            )}
          </nav>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-[#222222] space-y-2">
          {user?.role !== "STAFF_SCANNER" && (
            <Link
              to="/"
              className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-[#DCD9D3] hover:text-[#FFFFFF]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Portail Billetterie</span>
            </Link>
          )}

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

      {/* Forced Password Change Modal */}
      <MustChangePasswordModal />
    </div>
  );
}
