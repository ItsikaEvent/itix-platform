import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Shield, Check } from "./icons";

const CONSENT_KEY = "itix_cookie_consent_v1";

export function ConsentBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(CONSENT_KEY);
    if (!consent) {
      setShow(true);
    }
  }, []);

  const accept = () => {
    localStorage.setItem(CONSENT_KEY, "accepted");
    setShow(false);
  };

  const decline = () => {
    localStorage.setItem(CONSENT_KEY, "essential_only");
    setShow(false);
  };

  if (!show) return null;

  return (
    <aside
      aria-label="Consentement aux cookies et données personnelles"
      className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:max-w-md z-50 bg-[#111111] text-white p-5 rounded-2xl shadow-2xl border border-[#2B2B2B] animate-in fade-in slide-in-from-bottom-4 duration-300"
    >
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-xl bg-[#641C2D]/30 border border-[#641C2D] flex items-center justify-center shrink-0 text-[#E0A8B5]">
          <Shield className="h-5 w-5" />
        </div>
        <div className="space-y-1 text-xs">
          <p className="font-semibold text-sm text-white flex items-center gap-1.5">
            Confidentialité & Données Personnelles
          </p>
          <p className="text-[#A0A0A0] leading-relaxed">
            ITIX utilise des cookies et le stockage local strictement nécessaires au traitement des billets et à la sécurité de vos transactions (conforme RGPD & Loi n° 2014-038 CMIL Madagascar).
          </p>
          <div className="pt-1">
            <Link
              to="/politique-de-confidentialite"
              className="text-[#E0A8B5] underline hover:text-white transition-colors"
            >
              Consulter notre politique de confidentialité
            </Link>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-end gap-2 pt-2 border-t border-[#222222]">
        <button
          onClick={decline}
          className="px-3 py-1.5 text-xs text-[#888888] hover:text-white rounded-lg transition-colors"
        >
          Essentiels uniquement
        </button>
        <button
          onClick={accept}
          className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold bg-[#641C2D] text-white hover:bg-[#7D2338] rounded-lg transition-colors shadow-sm"
        >
          <Check className="h-3.5 w-3.5" />
          <span>Accepter</span>
        </button>
      </div>
    </aside>
  );
}
