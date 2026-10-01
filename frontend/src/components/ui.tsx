import type { ButtonHTMLAttributes, ReactNode } from "react";
import { X, AlertCircle } from "./icons";

/* ═══════════════════════════════════════════════════════════════
   ITIX — UI Component Library
   Classical Elegance + Editorial Modernity
   ═══════════════════════════════════════════════════════════════ */

// ── Input class ───
export const inputCls = "itix-input";

// ── Buttons ───
const variants = {
  primary: "itix-btn-primary",
  secondary: "itix-btn-secondary",
  outline: "itix-btn-outline",
  gold: "itix-btn-gold",
  ghost: "itix-btn-ghost",
  danger: "bg-red-50 text-red-900 border border-red-300 hover:bg-red-100 font-medium",
  success: "bg-emerald-50 text-emerald-900 border border-emerald-300 hover:bg-emerald-100 font-medium",
};

export function Button({
  variant = "primary",
  className = "",
  ...p
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof variants }) {
  return (
    <button
      {...p}
      className={`inline-flex items-center justify-center gap-2 rounded px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
    />
  );
}

// ── Field ───
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-[#66625B] uppercase tracking-wider">
        {label}
      </span>
      {children}
    </label>
  );
}

// ── Badge ───
const tones = {
  green: "bg-emerald-50 text-emerald-800 border border-emerald-200",
  red: "bg-red-50 text-red-800 border border-red-200",
  amber: "bg-amber-50 text-amber-800 border border-amber-200",
  yellow: "bg-amber-50 text-amber-800 border border-amber-200",
  gray: "bg-[#EFE9DC] text-[#4A4742] border border-[#DCD4C5]",
  blue: "bg-sky-50 text-sky-800 border border-sky-200",
  burgundy: "bg-[#641C2D]/10 text-[#641C2D] border border-[#641C2D]/20",
  gold: "bg-[#C6A15B]/15 text-[#856525] border border-[#C6A15B]/40",
};

export function Badge({
  tone = "gray",
  children,
}: {
  tone?: keyof typeof tones;
  children: ReactNode;
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-medium tracking-wide ${tones[tone]}`}>
      {children}
    </span>
  );
}

// ── Modal ───
export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="itix-modal-overlay" onClick={onClose}>
      <div
        className={`itix-modal-content ${wide ? "max-w-3xl" : "max-w-lg"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between border-b border-[#E4DCD0] pb-3">
          <h2 className="font-serif text-xl font-semibold text-[#111111]">{title}</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded text-[#66625B] hover:bg-[#EFE9DC] hover:text-[#111111]"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Spinner ───
export const Spinner = () => (
  <div className="flex items-center justify-center p-8">
    <div className="h-8 w-8 border-2 border-[#D4C9BA] border-t-[#641C2D] rounded-full"></div>
  </div>
);

// ── Error Box ───
export const ErrorBox = ({ message }: { message: string }) =>
  message ? (
    <div className="flex items-center gap-2.5 rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
      <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
      <span>{message}</span>
    </div>
  ) : null;

// ── Status Maps ───
export const ORDER_STATUS: Record<string, [string, keyof typeof tones]> = {
  PENDING: ["En attente", "amber"],
  ACCEPTED: ["Confirmée", "green"],
  REJECTED: ["Annulée", "red"],
};

export const PAY_STATUS: Record<string, [string, keyof typeof tones]> = {
  UNPAID: ["Non payé", "red"],
  PROOF_SUBMITTED: ["Vérification en cours", "amber"],
  PAID: ["Payé", "green"],
};

export const CONCERT_STATUS: Record<string, [string, keyof typeof tones]> = {
  AVAILABLE: ["Ouvert aux réservations", "green"],
  ALMOST_FULL: ["Dernières places", "amber"],
  SOLD_OUT: ["Complet", "red"],
  FINISHED: ["Passé", "gray"],
};
